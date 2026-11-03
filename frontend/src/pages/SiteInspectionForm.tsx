import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Printer,
  MapPin,
  Compass,
  Building2,
  Calendar,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Upload,
  Trash2,
  FileText,
  Tag,
  Eye,
  ShieldCheck,
  UserCheck,
  Check,
  AlertTriangle,
} from "lucide-react";
import { siteInspectionApi, MasterDataResponse } from "../api/siteInspection";
import {
  SiteInspectionRecord,
  SiteInspectionServiceItem,
  SiteInspectionAttachmentItem,
  haversineKm,
  computeMetrics,
  getStatusStyle,
  APPROVER_ROLES,
  canApproveInspection,
} from "../lib/siteInspection";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";

function InspectionAttachmentThumbnail({
  inspectionId,
  attachmentId,
  fileName,
  className = "w-full h-full object-cover",
}: {
  inspectionId: string;
  attachmentId: string;
  fileName: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function fetchAttachmentBlob() {
      try {
        setLoading(true);
        setHasError(false);
        const res = await apiClient(
          `/api/v1/site-inspections/${inspectionId}/attachments/${attachmentId}/file`,
          { headers: { Accept: "application/json, image/*, */*" } }
        );

        if (!res.ok) {
          console.error("[AttachmentLoad] Backend file endpoint returned status:", res.status, res.statusText);
          if (active) setHasError(true);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        let finalBlob: Blob;

        if (contentType.includes("application/json")) {
          const data = await res.json();
          // Fetch signed storage URL directly without any Authorization header
          const s3Res = await fetch(data.url);
          if (!s3Res.ok) {
            console.error("[AttachmentLoad] S3 fetch returned status:", s3Res.status, s3Res.statusText);
            if (active) setHasError(true);
            return;
          }
          finalBlob = await s3Res.blob();
        } else {
          finalBlob = await res.blob();
        }

        if (active) {
          createdUrl = URL.createObjectURL(finalBlob);
          setBlobUrl(createdUrl);
        }
      } catch (err: any) {
        console.error("[AttachmentLoad] Exception occurred during load:", err?.name, err?.message);
        if (active) setHasError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAttachmentBlob();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [inspectionId, attachmentId]);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400 text-[10px]">
        Failed to load image
      </div>
    );
  }

  if (loading || !blobUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 animate-pulse text-slate-400 text-[10px]">
        Loading...
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={fileName}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

const SERVICE_THEME: Record<string, { head: string; border: string }> = {
  SEWAGE:    { head: "bg-face-brown", border: "border-face-brown" },
  GENERAL:   { head: "bg-face-blue",  border: "border-face-blue" },
  HAZARDOUS: { head: "bg-face-red",   border: "border-face-red" },
};
const getServiceTheme = (type: string) =>
  SERVICE_THEME[type] || { head: "bg-face-green", border: "border-face-green" };

const ALLOWED_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const getCanonicalMimeType = (fileName: string, detectedType?: string): string => {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return detectedType && detectedType !== "application/octet-stream"
        ? detectedType
        : "application/octet-stream";
  }
};

const sanitizePresignedUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split("?")[0];
  }
};

export default function SiteInspectionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-file upload progress and status
  const [uploadProgress, setUploadProgress] = useState<{ [fileName: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);

  // Modal for viewing an attachment
  const [previewAttachment, setPreviewAttachment] = useState<SiteInspectionAttachmentItem | null>(null);

  // Review comment state
  const [reviewComment, setReviewComment] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Reassign state
  const [selectedReassignUser, setSelectedReassignUser] = useState("");

  // Fetch Master Data
  const { data: masterData } = useQuery<MasterDataResponse>({
    queryKey: ["site-inspections-master"],
    queryFn: () => siteInspectionApi.getMasterData(),
  });

  // Fetch Site Managers for reassign
  const { data: siteManagers = [] } = useQuery({
    queryKey: ["site-managers"],
    queryFn: () => siteInspectionApi.getSiteManagers(),
  });

  // Fetch Inspection
  const {
    data: inspection,
    isLoading,
    error,
    refetch,
  } = useQuery<SiteInspectionRecord>({
    queryKey: ["site-inspection", id],
    queryFn: () => siteInspectionApi.getInspection(id!),
    enabled: Boolean(id),
  });

  // Local Form State
  const [formData, setFormData] = useState<Partial<SiteInspectionRecord>>({});
  const [services, setServices] = useState<SiteInspectionServiceItem[]>([]);

  const isInitializedRef = useRef(false);

  // Initialize form data once on load so subsequent queries do not overwrite local draft edits
  useEffect(() => {
    if (inspection && !isInitializedRef.current) {
      isInitializedRef.current = true;
      setFormData({
        ...inspection,
        auditAt: inspection.auditAt ? inspection.auditAt.slice(0, 16) : "",
      });

      // Initialize 3 default service types
      const types: Array<"SEWAGE" | "GENERAL" | "HAZARDOUS"> = ["SEWAGE", "GENERAL", "HAZARDOUS"];
      const existingServices = inspection.services || [];
      const merged = types.map((st) => {
        const found = existingServices.find((s) => s.serviceType === st);
        return (
          found || {
            serviceType: st,
            isActive: false,
            facilityId: null,
            facilityName: "",
            distanceKm: 0,
            roadCondition: "" as const,
            wasteDescription: "",
            estimatedVolume: null,
            volumeUnit: "" as const,
            logisticsNote: "",
          }
        );
      });
      setServices(merged);
    }
  }, [inspection]);

  const userRole = (user?.role || "").toLowerCase();
  const isApprover = APPROVER_ROLES.includes(userRole);
  const isAssignedManager = inspection?.assignedToId === user?.id;

  // Can user edit draft?
  const isEditable =
    Boolean(inspection) &&
    ["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(inspection?.status || "") &&
    (isAssignedManager || isApprover);

  // Live straight line distance calculation
  const liveBaseToSiteKm = useMemo(() => {
    const base = masterData?.bases.find((b) => b.id === formData.baseId);
    if (!base || formData.latitude == null || formData.longitude == null) {
      return formData.baseToSiteStraightKm || 0;
    }
    return haversineKm(base.latitude, base.longitude, Number(formData.latitude), Number(formData.longitude));
  }, [masterData, formData.baseId, formData.latitude, formData.longitude, formData.baseToSiteStraightKm]);

  // Live metrics calculation
  const liveMetrics = useMemo(() => {
    return computeMetrics(Number(formData.mobilizationKm) || 0, services);
  }, [formData.mobilizationKm, services]);

  // Mutations
  const saveDraftMutation = useMutation({
    mutationFn: (data: any) => siteInspectionApi.saveDraft(id!, data),
    onSuccess: (updated) => {
      setFormData((prev) => ({ ...prev, ...updated }));
      setSaveSuccessMsg("Draft saved successfully.");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || "Failed to save draft.");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => siteInspectionApi.submitInspection(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      setSaveSuccessMsg("Site inspection submitted for review!");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || "Failed to submit inspection.");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ action, comment }: { action: "APPROVE" | "REQUEST_CHANGES"; comment?: string }) =>
      siteInspectionApi.reviewInspection(id!, action, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      setIsRejecting(false);
      setReviewComment("");
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || "Review failed.");
    },
  });

  const reassignMutation = useMutation({
    mutationFn: (newUserId: string) => siteInspectionApi.reassignInspection(id!, newUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
      setSelectedReassignUser("");
      setSaveSuccessMsg("Inspection reassigned.");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || "Reassign failed.");
    },
  });

  const deleteAttMutation = useMutation({
    mutationFn: (attId: string) => siteInspectionApi.deleteAttachment(id!, attId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
    },
  });

  // GPS Current Location helper
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Math.round(pos.coords.latitude * 10000) / 10000,
          longitude: Math.round(pos.coords.longitude * 10000) / 10000,
        }));
      },
      (err) => {
        alert("Failed to retrieve location: " + err.message);
      }
    );
  };

  // Road estimate helper
  const handleApplyRoadEstimate = () => {
    if (liveBaseToSiteKm > 0) {
      const estimated = Math.round(liveBaseToSiteKm * 1.3 * 10) / 10;
      setFormData((prev) => ({ ...prev, mobilizationKm: estimated }));
    }
  };

  // Observation Quick Chips
  const quickChips = [
    "Hot Work Permit Required",
    "HV Cable Height Clearance Required",
    "Bogie Mats Required",
    "Confined Space Entry",
    "Secondary Containment Required",
    "Paved Access Road Available",
    "Off-road / Sand Track Only",
    "H2S Certified Personnel Required",
  ];

  const handleAddChip = (chip: string) => {
    setFormData((prev) => {
      const current = prev.observations || "";
      if (current.includes(chip)) return prev;
      const updated = current ? `${current}; ${chip}` : chip;
      return { ...prev, observations: updated };
    });
  };

  // Handler to safely view an attachment without exposing token in URL
  const handleViewAttachment = async (attId: string) => {
    try {
      const res = await apiClient(
        `/api/v1/site-inspections/${id}/attachments/${attId}/file`,
        { headers: { Accept: "application/json, image/*, */*" } }
      );
      if (!res.ok) throw new Error("Failed to load attachment");
      const contentType = res.headers.get("content-type") || "";
      let blob: Blob;
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const s3Res = await fetch(data.url);
        if (!s3Res.ok) throw new Error("Failed to fetch attachment");
        blob = await s3Res.blob();
      } else {
        blob = await res.blob();
      }
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch {
      alert("Unable to view attachment.");
    }
  };

  // File Upload Handler (validate -> presign -> direct PUT via fetch -> complete; fall back to multipart if local driver)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    e.target.value = ""; // reset file input

    setFormError(null);

    // 1. Client-side validation: file type (JPG, PNG, WEBP, PDF) and size (max 25MB) before requesting presigned URL
    for (const file of fileList) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
        const err = `File "${file.name}" has an unsupported format (${ext || "unknown"}). Allowed formats: JPG, PNG, WEBP, PDF.`;
        console.error(`[Upload Validation] ${err}`);
        setFormError(err);
        return;
      }

      if (file.size <= 0) {
        const err = `File "${file.name}" is empty (0 bytes).`;
        console.error(`[Upload Validation] ${err}`);
        setFormError(err);
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const err = `File "${file.name}" exceeds the 25MB limit (${sizeMb}MB). Please select a file smaller than 25MB.`;
        console.error(`[Upload Validation] ${err}`);
        setFormError(err);
        return;
      }
    }

    setIsUploading(true);
    const isS3Driver = masterData?.storageDriver === "s3";

    try {
      if (!isS3Driver) {
        // Fallback to legacy/local multipart upload
        const fd = new FormData();
        fileList.forEach((file) => fd.append("files", file));
        fd.append("tag", "Site Overview");
        await siteInspectionApi.uploadAttachments(id!, fd);
      } else {
        // Direct upload flow per file
        for (const file of fileList) {
          const fileName = file.name;
          const resolvedMime = getCanonicalMimeType(fileName, file.type);
          setUploadProgress((prev) => ({ ...prev, [fileName]: 10 }));

          // 2. Request presigned URL
          let presignRes: { uploadUrl: string; storageKey: string };
          try {
            presignRes = await siteInspectionApi.presignAttachment(id!, {
              fileName: file.name,
              mimeType: resolvedMime,
              sizeBytes: file.size,
            });
          } catch (presignErr: any) {
            const serverMsg =
              presignErr.response?.data?.error || presignErr.message || "Failed to generate upload URL";
            console.error(`[Upload Error] Presign request failed for "${fileName}":`, presignErr);
            throw new Error(`Presign request failed for "${fileName}": ${serverMsg}`);
          }

          const { uploadUrl, storageKey } = presignRes;
          const sanitizedHostUrl = sanitizePresignedUrl(uploadUrl);
          setUploadProgress((prev) => ({ ...prev, [fileName]: 40 }));

          // 3. Direct S3 PUT via fetch: no credentials, only Content-Type header
          let s3Response: Response;
          try {
            s3Response = await fetch(uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": resolvedMime,
              },
              body: file,
              credentials: "omit",
              mode: "cors",
            });
          } catch (networkOrCorsErr: any) {
            console.error(
              `[Upload Error] Network or CORS preflight failure for "${fileName}". S3 Target: ${sanitizedHostUrl}`,
              networkOrCorsErr
            );
            throw new Error(
              `Upload blocked by network or CORS policy for "${fileName}". Check browser console and ensure the S3 bucket CORS allows PUT and Content-Type from this origin, and that AWS_REGION matches the bucket's actual region.`
            );
          }

          // Check S3 response status
          if (!s3Response.ok) {
            const responseBody = await s3Response.text().catch(() => "");
            console.error(
              `[Upload Error] S3 PUT failed for "${fileName}". Status: ${s3Response.status} ${s3Response.statusText}. S3 Target: ${sanitizedHostUrl}. Response body: ${responseBody}`
            );
            throw new Error(
              `S3 upload failed for "${fileName}" (HTTP ${s3Response.status}: ${s3Response.statusText || "Forbidden / Rejected"}). Verify S3 bucket permissions.`
            );
          }

          setUploadProgress((prev) => ({ ...prev, [fileName]: 80 }));

          // 4. Complete attachment registration in database
          try {
            await siteInspectionApi.completeAttachment(id!, {
              storageKey,
              fileName: file.name,
              tag: "Site Overview",
            });
          } catch (completeErr: any) {
            const serverMsg =
              completeErr.response?.data?.error || completeErr.message || "Failed to save attachment metadata";
            console.error(`[Upload Error] Complete registration failed for "${fileName}":`, completeErr);
            throw new Error(`Failed to save attachment "${fileName}" to database: ${serverMsg}`);
          }

          setUploadProgress((prev) => ({ ...prev, [fileName]: 100 }));
        }
      }

      // Invalidate queries and refetch to update counter and attachments list
      await queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
      await refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  // Save draft helper
  const handleSaveDraft = async () => {
    setFormError(null);
    const payload = {
      ...formData,
      services,
      baseToSiteStraightKm: liveBaseToSiteKm,
      totalCycleKm: liveMetrics.totalCycleKm,
      estFuelLitres: liveMetrics.estFuelLitres,
    };
    await saveDraftMutation.mutateAsync(payload);
  };

  // Submit helper
  const handleSubmit = async () => {
    setFormError(null);
    const payload = {
      ...formData,
      services,
      baseToSiteStraightKm: liveBaseToSiteKm,
      totalCycleKm: liveMetrics.totalCycleKm,
      estFuelLitres: liveMetrics.estFuelLitres,
    };
    await submitMutation.mutateAsync(payload);
  };

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading inspection portal...</div>;
  }

  if (!inspection) {
    return (
      <div className="py-20 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Inspection Not Found</h2>
        <Link to="/site-inspections" className="text-xs text-indigo-600 font-bold hover:underline">
          Return to Inspections List
        </Link>
      </div>
    );
  }

  const statusInfo = getStatusStyle(inspection.status);

  return (
    <>
      <style>{`
        @media print {
          body, html, #root, .h-screen, main, div {
            height: auto !important;
            overflow: visible !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          nav, header, aside, .sidebar, [role="navigation"] {
            display: none !important;
          }
          .inspection-screen-view {
            display: none !important;
          }
          .inspection-print-view {
            display: block !important;
          }
        }
        @media screen {
          .inspection-print-view {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Interactive View */}
      <div className="inspection-screen-view font-sans tracking-normal max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 print:hidden">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between border-b border-face-line dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/site-inspections")}
            className="p-2 hover:bg-face-field dark:hover:bg-slate-800 rounded-xl text-face-muted cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-face-green dark:text-face-green-mint">
                {inspection.inspectionNumber}
              </span>
              <span className="text-face-line dark:text-slate-700">·</span>
              <h1 className="text-lg font-extrabold uppercase tracking-tight text-face-ink dark:text-white">
                Site Inspection & Assessment Portal
              </h1>
            </div>
            <span className="text-xs text-face-muted font-medium">
              Lead: {inspection.lead?.company || inspection.clientOrganization}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${statusInfo.badgeBg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
            {statusInfo.label} (Rev {inspection.revision || 1})
          </span>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccessMsg && (
        <div className="p-3 bg-face-green-light dark:bg-emerald-950/40 border border-face-green/30 dark:border-emerald-800 text-face-green-dark dark:text-emerald-300 text-sm font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-face-green" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-face-red-light dark:bg-rose-950/40 border border-face-red/30 dark:border-rose-800 text-face-red dark:text-rose-300 text-sm font-bold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-face-red shrink-0" />
            <span>{formError}</span>
          </div>
          <button onClick={() => setFormError(null)} className="text-face-red hover:opacity-80">
            ×
          </button>
        </div>
      )}

      {/* Reviewer / Ops Manager Review Panel */}
      {isApprover && inspection.status === "SUBMITTED" && (
        <div className="bg-gradient-to-r from-face-blue-light to-face-green-light dark:from-purple-950/30 dark:to-indigo-950/30 border border-face-blue/30 dark:border-purple-800/60 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-face-blue dark:text-purple-400" />
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-face-ink dark:text-purple-200">
                  Supervisor & Ops Review Panel
                </h3>
                <p className="text-xs text-face-muted dark:text-purple-300">
                  Site Manager {inspection.assignedTo?.name || ""} submitted this inspection. Approving allows lead qualification.
                </p>
              </div>
            </div>

            {/* Self-approval Warning if applicable */}
            {inspection.assignedToId === user?.id && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-lg">
                Self-approval prohibited
              </span>
            )}
          </div>

          {canApproveInspection(userRole, inspection.assignedToId, user?.id) && (
            <div className="space-y-3 pt-2 border-t border-face-line dark:border-purple-800/60">
              {isRejecting ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-face-ink dark:text-slate-300 block">
                    Reason for Requesting Changes (Required):
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Describe specific changes or corrections needed by the Site Manager..."
                    rows={3}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-face-blue/30 dark:border-purple-700 rounded-xl text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setIsRejecting(false)}
                      className="px-3 py-1.5 text-sm font-bold text-face-muted hover:text-face-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({ action: "REQUEST_CHANGES", comment: reviewComment })
                      }
                      disabled={!reviewComment.trim() || reviewMutation.isPending}
                      className="px-4 py-1.5 bg-face-red hover:opacity-90 text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                    >
                      {reviewMutation.isPending ? "Submitting..." : "Confirm Changes Request"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Optional approval note..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-face-blue/30 dark:border-purple-800 rounded-xl text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRejecting(true)}
                      className="px-3 py-2 bg-white hover:bg-face-red-light text-face-red border border-face-red/30 text-sm font-bold rounded-xl cursor-pointer"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({ action: "APPROVE", comment: reviewComment })
                      }
                      disabled={reviewMutation.isPending}
                      className="px-4 py-2 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? "Approving..." : "Approve Site Inspection"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Comment Banner if CHANGES_REQUESTED */}
      {inspection.status === "CHANGES_REQUESTED" && inspection.reviewComment && (
        <div className="p-4 bg-face-red-light dark:bg-rose-950/30 border border-face-red/30 dark:border-rose-900 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-face-red shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold text-face-red dark:text-rose-200">
              Changes Requested by {inspection.reviewedBy?.name || "Operations Manager"}:
            </h4>
            <p className="text-face-red dark:text-rose-300 mt-1 leading-relaxed">
              {inspection.reviewComment}
            </p>
          </div>
        </div>
      )}

      {/* Reassign Panel for Approvers */}
      {isApprover && (
        <div className="flex items-center justify-between p-3 bg-face-field dark:bg-slate-800/40 border border-face-line dark:border-slate-800 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-face-muted" />
            <span className="font-bold text-face-ink dark:text-slate-300">
              Assigned Site Manager: {inspection.assignedTo?.name || "Unassigned"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedReassignUser}
              onChange={(e) => setSelectedReassignUser(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg px-2.5 py-1 text-sm text-face-ink dark:text-white"
            >
              <option value="">Select Site Manager...</option>
              {siteManagers.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.name} ({sm.email})
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (selectedReassignUser) reassignMutation.mutate(selectedReassignUser);
              }}
              disabled={!selectedReassignUser || reassignMutation.isPending}
              className="px-3 py-1 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Reassign
            </button>
          </div>
        </div>
      )}

      {/* 3-Step Wizard Navigation */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-face-field dark:bg-slate-800 rounded-2xl border border-face-line dark:border-slate-700/80">
        {[
          { stepNum: 1, title: "1. Site & Client", subtitle: "Base, GPS & RFQ" },
          { stepNum: 2, title: "2. Haulage & Waste", subtitle: "Mobilization & Services" },
          { stepNum: 3, title: "3. Observations", subtitle: "Notes & Photos" },
        ].map((s) => (
          <button
            key={s.stepNum}
            onClick={() => setStep(s.stepNum as any)}
            className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
              step === s.stepNum
                ? "bg-white dark:bg-slate-900 text-face-green dark:text-face-green-mint shadow-sm font-bold"
                : "text-face-muted hover:text-face-ink dark:hover:text-white"
            }`}
          >
            <span className="text-sm font-black block leading-none">{s.title}</span>
            <span className="text-xs text-face-muted font-medium block mt-1">{s.subtitle}</span>
          </button>
        ))}
      </div>

      {/* Step Contents */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(40,50,120,0.07)] space-y-6">
        {/* ================= STEP 1: Site & Client ================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-face-line dark:border-slate-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-face-ink dark:text-white">
                Step 1: Operations Base, Site Location & Client
              </h2>
              <p className="text-sm text-face-muted">
                Specify the deploying operations hub, ground audit timestamp, and precise GPS coordinates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Operations Base */}
              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Operations Base <span className="text-face-red">*</span>
                </label>
                <select
                  disabled={!isEditable}
                  value={formData.baseId || ""}
                  onChange={(e) => setFormData({ ...formData, baseId: e.target.value })}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                >
                  <option value="">Select Deploying Base...</option>
                  {(masterData?.bases || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code} - {b.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Audit Date & Time */}
              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Audit Date & Time <span className="text-face-red">*</span>
                </label>
                <input
                  type="datetime-local"
                  disabled={!isEditable}
                  value={formData.auditAt || ""}
                  onChange={(e) => setFormData({ ...formData, auditAt: e.target.value })}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* Site Name */}
              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Site / Facility Name <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.siteName || ""}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  placeholder="e.g. Ras Tanura Refinery - Plant 4 Gate"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* Site Address */}
              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Site Physical Address / Plot
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.siteAddress || ""}
                  onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                  placeholder="Street, Gate #, Industrial Zone"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* GPS Coordinates & Current Location Button */}
              <div className="md:col-span-2 space-y-2 p-4 bg-face-field dark:bg-slate-800/40 border border-face-line dark:border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-face-green" />
                    <span className="text-sm font-bold text-face-ink dark:text-white uppercase tracking-wider">
                      GPS Coordinates <span className="text-face-red">*</span>
                    </span>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 hover:bg-face-field text-face-green dark:text-face-green-mint text-sm font-bold rounded-lg shadow-2xs cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Use my current location</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      type="number"
                      step="any"
                      disabled={!isEditable}
                      value={formData.latitude ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latitude: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="e.g. 26.6500"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-sm font-mono text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      type="number"
                      step="any"
                      disabled={!isEditable}
                      value={formData.longitude ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          longitude: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="e.g. 50.1500"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-sm font-mono text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                    />
                  </div>
                </div>

                {/* Straight line distance indicator */}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-face-line dark:border-slate-700/60">
                  <span className="text-face-muted">Live straight-line distance base → site:</span>
                  <span className="font-extrabold text-face-green dark:text-face-green-mint">
                    {liveBaseToSiteKm > 0 ? `${liveBaseToSiteKm} km` : "Set base & GPS to compute"}
                  </span>
                </div>
              </div>

              {/* Client Info (Pre-filled from lead) */}
              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Client Organisation <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientOrganization || ""}
                  onChange={(e) => setFormData({ ...formData, clientOrganization: e.target.value })}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  RFQ / Reference ID (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.rfqNumber || ""}
                  className="w-full p-2.5 bg-face-field/70 dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-xl text-sm font-mono text-face-muted"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Field Representative Name <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientRepName || ""}
                  onChange={(e) => setFormData({ ...formData, clientRepName: e.target.value })}
                  placeholder="Client Site Contact"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  Field Representative Phone
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientRepPhone || ""}
                  onChange={(e) => setFormData({ ...formData, clientRepPhone: e.target.value })}
                  placeholder="+966..."
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs uppercase font-bold text-face-muted tracking-wider block mb-1.5">
                  RFQ Scope Summary (from Lead)
                </label>
                <textarea
                  disabled={!isEditable}
                  value={formData.scopeSummary || ""}
                  onChange={(e) => setFormData({ ...formData, scopeSummary: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: Haulage & Waste ================= */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b border-face-line dark:border-slate-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-face-ink dark:text-white">
                Step 2: Mobilization Haulage & Waste Scopes
              </h2>
              <p className="text-sm text-face-muted">
                Configure one-way mobilization distance, select active waste streams, and assign approved disposal facilities.
              </p>
            </div>

            {/* Mandatory Mobilization Section */}
            <div className="p-4 bg-face-field dark:bg-slate-800/40 border border-face-line dark:border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-face-green" />
                  <span className="text-sm font-bold text-face-ink dark:text-white uppercase tracking-wider">
                    Mandatory Mobilization (Base → Site)
                  </span>
                </div>
                {isEditable && liveBaseToSiteKm > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyRoadEstimate}
                    className="text-xs font-bold text-face-green hover:text-face-green-dark dark:hover:text-face-green-mint flex items-center gap-1 cursor-pointer"
                  >
                    <span>Use road estimate (×1.3 = {Math.round(liveBaseToSiteKm * 1.3)} km)</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                    Mobilization Route Description
                  </label>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={formData.mobilizationRoute || ""}
                    onChange={(e) => setFormData({ ...formData, mobilizationRoute: e.target.value })}
                    placeholder="e.g. Highway 613 via Abu Hadriyah Expressway"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                    One-way Distance (KM) <span className="text-face-red">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    disabled={!isEditable}
                    value={formData.mobilizationKm ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mobilizationKm: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="km"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-sm font-mono font-bold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                  />
                </div>
              </div>
            </div>

            {/* Three Toggleable Waste Types */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-face-ink dark:text-white uppercase tracking-wider">
                Waste Types & Disposal Streams (At least 1 required)
              </h3>

              {services.map((svc, idx) => {
                const facilitiesForType = (masterData?.facilities || []).filter(
                  (f) => f.serviceType === svc.serviceType
                );
                const theme = getServiceTheme(svc.serviceType);

                return (
                  <div
                    key={svc.serviceType}
                    className={`border transition-all overflow-hidden ${
                      svc.isActive
                        ? `border-2 rounded-3xl ${theme.border} bg-white dark:bg-slate-900 shadow-xs`
                        : "border-face-line dark:border-slate-800 rounded-2xl bg-face-field/60 dark:bg-slate-800/20 opacity-80"
                    }`}
                  >
                    {/* Header with Toggle */}
                    <div
                      className={`p-4 flex items-center justify-between border-b ${
                        svc.isActive
                          ? `${theme.head} border-transparent text-white`
                          : "border-face-line dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`toggle-${svc.serviceType}`}
                          disabled={!isEditable}
                          checked={svc.isActive}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].isActive = e.target.checked;
                            setServices(updated);
                          }}
                          className={`w-4 h-4 rounded cursor-pointer ${
                            svc.isActive ? "accent-white" : "text-face-green"
                          }`}
                        />
                        <label
                          htmlFor={`toggle-${svc.serviceType}`}
                          className={`text-sm font-black cursor-pointer uppercase tracking-wider ${
                            svc.isActive ? "text-white" : "text-face-ink dark:text-white"
                          }`}
                        >
                          {svc.serviceType} WASTE STREAM
                        </label>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          svc.isActive
                            ? "bg-white/20 text-white"
                            : "bg-face-line text-face-muted"
                        }`}
                      >
                        {svc.isActive ? "ACTIVE SCOPE" : "INACTIVE"}
                      </span>
                    </div>

                    {/* Service Fields if Active */}
                    {svc.isActive && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Facility Select */}
                        <div>
                          <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                            Disposal Facility <span className="text-face-red">*</span>
                          </label>
                          <select
                            disabled={!isEditable}
                            value={svc.facilityId || ""}
                            onChange={(e) => {
                              const updated = [...services];
                              const facId = e.target.value;
                              const fac = facilitiesForType.find((f) => f.id === facId);
                              updated[idx].facilityId = facId || null;
                              updated[idx].facilityName = fac?.name || "";
                              setServices(updated);
                            }}
                            className="w-full p-2 bg-face-field dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-lg text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                          >
                            <option value="">Select Facility...</option>
                            {facilitiesForType.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Haulage KM */}
                        <div>
                          <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                            Haulage One-Way Distance (KM) <span className="text-face-red">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            disabled={!isEditable}
                            value={svc.distanceKm ?? ""}
                            onChange={(e) => {
                              const updated = [...services];
                              updated[idx].distanceKm = Number(e.target.value);
                              setServices(updated);
                            }}
                            placeholder="km"
                            className="w-full p-2 bg-face-field dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-lg text-sm font-mono font-bold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                          />
                        </div>

                        {/* Road Condition Buttons */}
                        <div>
                          <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                            Road Condition Rating <span className="text-face-red">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(["Good", "Fair", "Poor"] as const).map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                disabled={!isEditable}
                                onClick={() => {
                                  const updated = [...services];
                                  updated[idx].roadCondition = rating;
                                  setServices(updated);
                                }}
                                className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                  svc.roadCondition === rating
                                    ? rating === "Good"
                                      ? "bg-face-green text-white border-face-green"
                                      : rating === "Fair"
                                      ? "bg-amber-600 text-white border-amber-600"
                                      : "bg-face-red text-white border-face-red"
                                    : "bg-face-field dark:bg-slate-800 text-face-muted border-face-line dark:border-slate-700 hover:bg-face-line/50"
                                }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Volume & Unit */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                              Estimated Volume
                            </label>
                            <input
                              type="number"
                              disabled={!isEditable}
                              value={svc.estimatedVolume ?? ""}
                              onChange={(e) => {
                                const updated = [...services];
                                updated[idx].estimatedVolume =
                                  e.target.value === "" ? null : Number(e.target.value);
                                setServices(updated);
                              }}
                              placeholder="Qty"
                              className="w-full p-2 bg-face-field dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-lg text-sm font-mono text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                              Unit
                            </label>
                            <select
                              disabled={!isEditable}
                              value={svc.volumeUnit || ""}
                              onChange={(e) => {
                                const updated = [...services];
                                updated[idx].volumeUnit = e.target.value as any;
                                setServices(updated);
                              }}
                              className="w-full p-2 bg-face-field dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-lg text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                            >
                              <option value="">Select Unit...</option>
                              {(masterData?.volumeUnits || ["L", "m3", "ton", "loads"]).map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Waste description */}
                        <div>
                          <label className="text-[11px] uppercase font-bold text-face-muted block mb-1 tracking-wider">
                            Waste Description
                          </label>
                          <input
                            type="text"
                            disabled={!isEditable}
                            value={svc.wasteDescription || ""}
                            onChange={(e) => {
                              const updated = [...services];
                              updated[idx].wasteDescription = e.target.value;
                              setServices(updated);
                            }}
                            placeholder="e.g. Sludge, chemicals, oily water"
                            className="w-full p-2 bg-face-field dark:bg-slate-800 border border-face-line dark:border-slate-700 rounded-lg text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Metrics Calculation Panel */}
            <div className="p-4 bg-gradient-to-r from-face-green-light to-face-blue-light dark:from-indigo-950/40 dark:to-blue-950/40 border border-face-line dark:border-indigo-800 rounded-2xl">
              <span className="text-xs font-black uppercase text-face-green-dark dark:text-indigo-300 tracking-wider block mb-2">
                Real-Time Transport & Cycle Metrics
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-face-line dark:border-indigo-900">
                  <span className="text-[11px] font-bold text-face-muted uppercase block">Single Cycle KM</span>
                  <span className="text-lg font-black text-face-ink dark:text-white mt-0.5 block">
                    {liveMetrics.totalCycleKm} km
                  </span>
                  <span className="text-[11px] text-face-muted block">2 × (Mob + Active Scopes)</span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-face-line dark:border-indigo-900">
                  <span className="text-[11px] font-bold text-face-muted uppercase block">Est. Diesel Fuel</span>
                  <span className="text-lg font-black text-face-ink dark:text-white mt-0.5 block">
                    {liveMetrics.estFuelLitres} L
                  </span>
                  <span className="text-[11px] text-face-muted block">@ 0.4 L/km</span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-face-line dark:border-indigo-900">
                  <span className="text-[11px] font-bold text-face-muted uppercase block">Base → Site</span>
                  <span className="text-lg font-black text-face-ink dark:text-white mt-0.5 block">
                    {liveBaseToSiteKm} km
                  </span>
                  <span className="text-[11px] text-face-muted block">Straight Line</span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-face-line dark:border-indigo-900">
                  <span className="text-[11px] font-bold text-face-muted uppercase block">Active Scopes</span>
                  <span className="text-lg font-black text-face-ink dark:text-white mt-0.5 block">
                    {services.filter((s) => s.isActive).length} / 3
                  </span>
                  <span className="text-[11px] text-face-muted block">Services</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: Observations & Attachments ================= */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-face-line dark:border-slate-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-face-ink dark:text-white">
                Step 3: Ground Observations & Evidence Attachments
              </h2>
              <p className="text-sm text-face-muted">
                Log critical ground conditions, safety clearances, and upload photos with optional EXIF GPS metadata.
              </p>
            </div>

            {/* Quick Chips & Textarea */}
            <div className="space-y-3">
              <label className="text-xs uppercase font-bold text-face-muted tracking-wider block">
                Ground Observations & Safety Restrictions
              </label>

              {/* Quick Insert Chips */}
              {isEditable && (
                <div className="flex flex-wrap gap-1.5">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAddChip(chip)}
                      className="px-2.5 py-1 bg-face-field dark:bg-slate-800 hover:bg-face-green-light dark:hover:bg-face-green-dark/40 text-face-muted hover:text-face-green dark:text-slate-300 dark:hover:text-face-green-mint text-xs font-bold rounded-lg border border-face-line dark:border-slate-700 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                disabled={!isEditable}
                value={formData.observations || ""}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                rows={4}
                placeholder="Enter detailed site access notes, overhead restrictions, pipe clearance, marsh ground conditions..."
                className="w-full p-3 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
              />
            </div>

            {/* Attachments Upload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-face-ink dark:text-white uppercase tracking-wider">
                    Site Photos & Document Attachments ({inspection.attachments?.length || 0}) <span className="text-face-red">*</span>
                  </h3>
                  <p className="text-[11px] text-face-muted">
                    JPG, PNG, WEBP, or PDF (Max 25MB). At least 1 attachment is required to submit.
                  </p>
                </div>

                {isEditable && (
                  <label className="flex items-center gap-1.5 px-3.5 py-2 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? "Uploading..." : "Upload Files"}</span>
                    <input
                      type="file"
                      multiple
                      disabled={isUploading}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Upload Progress Bar if uploading */}
              {isUploading && Object.keys(uploadProgress).length > 0 && (
                <div className="p-3 bg-face-green-light dark:bg-indigo-950/30 border border-face-green/30 dark:border-indigo-800 rounded-xl space-y-2">
                  <div className="text-sm font-bold text-face-green-dark dark:text-indigo-300 flex items-center justify-between">
                    <span>Uploading direct to storage...</span>
                  </div>
                  {Object.entries(uploadProgress).map(([fName, pct]) => (
                    <div key={fName} className="space-y-1">
                      <div className="flex justify-between text-xs text-face-muted dark:text-slate-300 font-medium">
                        <span className="truncate max-w-[250px]">{fName}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-face-line dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-face-green transition-all duration-200"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attachments List */}
              {(inspection.attachments || []).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {inspection.attachments?.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 bg-face-field dark:bg-slate-800/50 border border-face-line dark:border-slate-700 rounded-xl space-y-2 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-face-green shrink-0" />
                          <span className="text-sm font-bold text-face-ink dark:text-white truncate">
                            {att.fileName}
                          </span>
                        </div>

                        {/* Thumbnail preview */}
                      {(att.mimeType?.startsWith("image/") || att.fileName?.match(/\.(jpe?g|png|webp)$/i)) && (
                        <div className="w-full h-32 overflow-hidden rounded-lg bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700">
                          <InspectionAttachmentThumbnail
                            inspectionId={id!}
                            attachmentId={att.id}
                            fileName={att.fileName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* EXIF GPS Badge if present */}
                        {att.latitude != null && att.longitude != null && (
                          <span
                            title={`EXIF GPS: ${att.latitude}, ${att.longitude}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-face-green-light text-face-green-dark text-[11px] font-bold rounded shrink-0"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            GPS
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-face-muted flex items-center justify-between">
                        <span>Tag: {att.tag || "Site Overview"}</span>
                        <span>{Math.round(att.sizeBytes / 1024)} KB</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-face-line dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => handleViewAttachment(att.id)}
                          className="text-xs font-bold text-face-green hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>

                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => deleteAttMutation.mutate(att.id)}
                            className="text-xs font-bold text-face-red hover:opacity-80 cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-face-line dark:border-slate-800 rounded-2xl text-center space-y-2">
                  <Upload className="w-6 h-6 text-face-muted mx-auto" />
                  <p className="text-sm font-bold text-face-muted">No attachments uploaded yet</p>
                  <p className="text-[11px] text-face-muted">
                    Upload photos of ground conditions, gates, overhead cables, and waste holding pits.
                  </p>
                </div>
              )}
            </div>

            {/* Certification Checkbox */}
            <div className="p-4 bg-face-field dark:bg-slate-800/40 border border-face-line dark:border-slate-800 rounded-2xl flex items-start gap-3">
              <input
                type="checkbox"
                id="certification-check"
                disabled={!isEditable}
                checked={Boolean(formData.accepted)}
                onChange={(e) => setFormData({ ...formData, accepted: e.target.checked })}
                className="w-4 h-4 text-face-green rounded mt-0.5 cursor-pointer accent-face-green"
              />
              <label
                htmlFor="certification-check"
                className="text-sm text-face-muted dark:text-slate-300 font-medium leading-relaxed cursor-pointer select-none"
              >
                <strong className="font-bold text-face-ink dark:text-white block">
                  Ground Assessment Certification & Accuracy Guarantee
                </strong>
                I confirm and certify that all site inspection information, GPS coordinates, haulage distances, and waste specifications provided herein are accurate and reflect real ground conditions.
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 bg-face-field hover:bg-face-line dark:bg-slate-800 dark:hover:bg-slate-700 text-face-ink dark:text-slate-200 text-sm font-bold rounded-xl transition-all cursor-pointer"
            >
              Previous
            </button>
          )}
          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as any)}
              className="px-4 py-2 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Print PDF Report */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-800 text-face-ink dark:text-slate-200 text-sm font-bold rounded-xl hover:bg-face-field cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Preview PDF Report</span>
          </button>

          {/* Save Draft */}
          {isEditable && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-face-field hover:bg-face-line dark:bg-slate-800 text-face-ink dark:text-white text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveDraftMutation.isPending ? "Saving..." : "Save Draft"}</span>
            </button>
          )}

          {/* Submit / Resubmit */}
          {isEditable && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl shadow-md shadow-face-green/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitMutation.isPending
                  ? "Submitting..."
                  : inspection.status === "CHANGES_REQUESTED"
                  ? "Resubmit Inspection"
                  : "Submit for Approval"}
              </span>
            </button>
          )}
        </div>
      </div>
      </div>

      {/* ================= DEDICATED PRINT VIEW ================= */}
      <div className="inspection-print-view hidden print:block max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans space-y-6">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
              Technical Site Inspection Report
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Nexus CRM Commercial Pipeline — Pre-Qualification Technical Audit
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-mono font-bold text-slate-900 block">
              {inspection.inspectionNumber} (Rev {inspection.revision})
            </span>
            <span className="text-xs font-bold text-indigo-700 uppercase block mt-1">
              Status: {inspection.status}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Generated: {new Date().toLocaleDateString("en-GB")}
            </span>
          </div>
        </div>

        {/* Lead & Assignment Metadata */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Client / Account</span>
            <span className="font-bold text-slate-900 text-sm block">
              {inspection.lead?.company || formData.clientOrganization || "Commercial Client"}
            </span>
            <span className="text-slate-600 block mt-1">
              Contact: {inspection.lead ? `${inspection.lead.firstName || ""} ${inspection.lead.lastName || ""}`.trim() || formData.clientRepName || "N/A" : (formData.clientRepName || "N/A")}
              {formData.clientRepPhone && ` (${formData.clientRepPhone})`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Site Manager Assignee</span>
            <span className="font-bold text-slate-900 text-sm block">
              {inspection.assignedTo?.name || "Assigned Site Manager"}
            </span>
            <span className="text-slate-600 block mt-1">
              {inspection.assignedTo?.email || "site_manager@nexus.com"}
            </span>
          </div>
        </div>

        {/* SECTION 1: Operations Base & Site Location */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-black uppercase border-b border-slate-300 pb-1 text-slate-900 tracking-wider">
            Section 1: Operations Base, Site Location & Client
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Operations Base:</span>
              <span className="text-slate-900 font-semibold">{formData.baseName || "Jubail Operations Base"}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Straight Line to Site: <strong>{liveBaseToSiteKm} km</strong>
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Site / Facility Name:</span>
              <span className="text-slate-900 font-semibold">{formData.siteName || "Industrial Site"}</span>
              <span className="text-slate-600 block text-[11px] mt-0.5">{formData.siteAddress || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">GPS Coordinates:</span>
              <span className="font-mono text-slate-900 font-semibold">
                {formData.latitude != null ? formData.latitude.toFixed(4) : "N/A"}° N,{" "}
                {formData.longitude != null ? formData.longitude.toFixed(4) : "N/A"}° E
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Client Representative:</span>
              <span className="text-slate-900">
                {formData.clientRepName || "N/A"} {formData.clientRepPhone && `(${formData.clientRepPhone})`}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Mobilization Haulage & Waste Scopes */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-black uppercase border-b border-slate-300 pb-1 text-slate-900 tracking-wider">
            Section 2: Mobilization Haulage, Waste Scopes & Transport Metrics
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Mobilization Route:</span>
              <span className="text-slate-900">{formData.mobilizationRoute || "Direct Highway Route"}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Mobilization Distance: <strong>{formData.mobilizationKm || 0} km</strong> (Speed limit: {formData.speedLimitKmh || 80} km/h)
              </span>
            </div>
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-center grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-600 uppercase block">Total Cycle KM</span>
                <span className="text-base font-black text-indigo-900 block mt-0.5">
                  {liveMetrics.totalCycleKm} km
                </span>
                <span className="text-[9px] text-slate-500 block">2 × (Mob + Scopes)</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-600 uppercase block">Est. Diesel Fuel</span>
                <span className="text-base font-black text-indigo-900 block mt-0.5">
                  {liveMetrics.estFuelLitres} L
                </span>
                <span className="text-[9px] text-slate-500 block">@ 0.4 L/km</span>
              </div>
            </div>
          </div>

          {/* Active Waste Scopes Table */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-700 block mb-1">Active Waste Scopes & Facilities:</span>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2 border-b border-r border-slate-200">Service Type</th>
                  <th className="p-2 border-b border-r border-slate-200">Treatment Facility</th>
                  <th className="p-2 border-b border-r border-slate-200">Haulage (KM)</th>
                  <th className="p-2 border-b border-r border-slate-200">Road Cond.</th>
                  <th className="p-2 border-b border-r border-slate-200">Est. Volume</th>
                  <th className="p-2 border-b border-slate-200">Logistics & Notes</th>
                </tr>
              </thead>
              <tbody>
                {services.filter((s) => s.isActive).length > 0 ? (
                  services
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <tr key={s.serviceType} className="border-b border-slate-200">
                        <td className="p-2 font-bold border-r border-slate-200">{s.serviceType}</td>
                        <td className="p-2 border-r border-slate-200">{s.facilityName || "Designated Facility"}</td>
                        <td className="p-2 border-r border-slate-200">{s.distanceKm || 0} km</td>
                        <td className="p-2 border-r border-slate-200">{s.roadCondition || "Good"}</td>
                        <td className="p-2 border-r border-slate-200">
                          {s.estimatedVolume ? `${s.estimatedVolume} ${s.volumeUnit || "m3"}` : "N/A"}
                        </td>
                        <td className="p-2 text-slate-600 text-[11px]">
                          {s.wasteDescription || s.logisticsNote || "Standard vacuum/flatbed transport"}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-3 text-center text-slate-400 italic">
                      No active waste services specified.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: Observations & Photo Attachments */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-black uppercase border-b border-slate-300 pb-1 text-slate-900 tracking-wider">
            Section 3: Ground Observations & Evidence Photos
          </h2>

          <div className="text-xs">
            <span className="font-bold text-slate-700 block mb-1">Site Observations & Access Constraints:</span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
              {formData.observations || "Site inspection conducted with no critical hazards noted."}
            </div>
          </div>

          {/* Photo Evidence */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Ground Photo Evidence ({inspection.attachments?.length || 0} attachments):
            </span>
            <div className="grid grid-cols-2 gap-4">
              {(inspection.attachments || []).map((att) => (
                <div key={att.id} className="border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                  <div className="h-44 w-full bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                    <InspectionAttachmentThumbnail
                      inspectionId={id!}
                      attachmentId={att.id}
                      fileName={att.fileName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 pt-1 flex justify-between">
                    <span className="font-bold truncate">{att.fileName}</span>
                    <span>{att.tag || "Ground Photo"}</span>
                  </div>
                  {att.latitude != null && att.longitude != null && (
                    <div className="text-[9px] font-mono text-emerald-700">
                      EXIF GPS: {att.latitude.toFixed(4)}° N, {att.longitude.toFixed(4)}° E
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign-off / Review Signatures */}
        <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Submitted By</span>
            <span className="font-bold text-slate-900 block mt-1">
              {inspection.assignedTo?.name || "Site Manager"}
            </span>
            <span className="text-slate-500 block text-[11px]">
              Date: {inspection.submittedAt ? new Date(inspection.submittedAt).toLocaleString("en-GB") : "Pending"}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Operations / Approver Review</span>
            <span className="font-bold text-slate-900 block mt-1">
              {inspection.reviewedBy?.name || (inspection.status === "APPROVED" ? "Operations Manager" : "Awaiting Review")}
            </span>
            <span className="text-slate-500 block text-[11px]">
              Status: <strong>{inspection.status}</strong>
              {inspection.reviewedAt && ` on ${new Date(inspection.reviewedAt).toLocaleString("en-GB")}`}
            </span>
            {inspection.reviewComment && (
              <p className="text-[10px] text-slate-600 italic mt-1 bg-slate-50 p-1.5 border border-slate-200 rounded">
                Note: "{inspection.reviewComment}"
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
