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
  const isInspector =
    Boolean(inspection) &&
    userRole === "site_manager" &&
    (!inspection?.assignedToId || inspection.assignedToId === user?.id);

  // Can user edit draft? Inspector-only writes
  const isEditable =
    Boolean(inspection) &&
    ["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(inspection?.status || "") &&
    isInspector;

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

      {/* Read-only view banner when user is not the assigned inspector */}
      {!isInspector && (
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-2xl flex items-center gap-3">
          <Lock className="w-5 h-5 text-slate-500 shrink-0" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white">Read-only view:</span>{" "}
            {inspection.assignedTo ? (
              <span>
                This site inspection is being completed by{" "}
                <span className="font-bold text-slate-900 dark:text-white">{inspection.assignedTo.name}</span>
                {inspection.assignedTo.email ? ` (${inspection.assignedTo.email})` : ""}. Only the assigned site inspector can modify details or upload attachments.
              </span>
            ) : (
              <span>
                This site inspection has not been assigned to an inspector yet. Only an assigned site inspector can modify details.
              </span>
            )}
          </div>
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

      {/* ================= UNIFIED SINGLE-SCREEN INSPECTION DASHBOARD ================= */}
      <div className="space-y-6">

        {/* ── 01. INSPECTION SITE & CLIENT DETAILS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Card: 01 INSPECTION SITE (spans 2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(40,50,120,0.06)] border border-face-line/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-face-line/70 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-xs font-black rounded-lg">
                  01
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  INSPECTION SITE
                </h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                STEP VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Operations Base */}
              <div>
                <label className="text-[11px] uppercase font-bold text-face-muted tracking-wider block mb-1">
                  Assigned Operations Base <span className="text-face-red">*</span>
                </label>
                <select
                  disabled={!isEditable}
                  value={formData.baseId || ""}
                  onChange={(e) => setFormData({ ...formData, baseId: e.target.value })}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
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
                <label className="text-[11px] uppercase font-bold text-face-muted tracking-wider block mb-1">
                  Audit Date & Time (AST) <span className="text-face-red">*</span>
                </label>
                <input
                  type="datetime-local"
                  disabled={!isEditable}
                  value={formData.auditAt || ""}
                  onChange={(e) => setFormData({ ...formData, auditAt: e.target.value })}
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* Site Name */}
              <div>
                <label className="text-[11px] uppercase font-bold text-face-muted tracking-wider block mb-1">
                  Inspection Site Name <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.siteName || ""}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  placeholder="e.g. Tanajib Offshore Gas Facility - Sector 4B"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* Site Address */}
              <div>
                <label className="text-[11px] uppercase font-bold text-face-muted tracking-wider block mb-1">
                  Physical Plot / Gate Address
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.siteAddress || ""}
                  onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                  placeholder="e.g. Gate 3, Tanajib Industrial Zone"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              {/* GPS Coordinates Box */}
              <div className="md:col-span-2 p-3 bg-face-field dark:bg-slate-800/40 border border-face-line dark:border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-face-ink dark:text-white">
                    <Compass className="w-3.5 h-3.5 text-face-green" />
                    <span>Inspection Site GPS Coordinates</span>
                    <span className="text-face-red">*</span>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="text-[11px] font-bold text-face-green hover:text-face-green-dark dark:hover:text-face-green-mint flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Use my GPS</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
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
                      placeholder="Latitude (e.g. 27.8341)"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-face-ink dark:text-white"
                    />
                  </div>
                  <div>
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
                      placeholder="Longitude (e.g. 48.8872)"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-face-line dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-face-ink dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-face-muted pt-1">
                  <span>Calculated straight-line deployment:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {liveBaseToSiteKm > 0 ? `${liveBaseToSiteKm} km straight line` : "Set base & coordinates"}
                  </span>
                </div>
              </div>

              {/* Approved RFQ Scope Summary */}
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase font-bold text-face-muted tracking-wider block mb-1">
                  Approved RFQ Scope Summary (from Lead)
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.scopeSummary || ""}
                  onChange={(e) => setFormData({ ...formData, scopeSummary: e.target.value })}
                  placeholder="e.g. Comprehensive Industrial Site Assessment for Sludge Dewatering, Hazardous Pit Action"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>
            </div>
          </div>

          {/* Right Card: Client Details (spans 1 col) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(40,50,120,0.06)] border border-face-line/70 dark:border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="border-b border-face-line/70 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Client Details
                </h2>
              </div>

              <div>
                <label className="text-[10px] uppercase font-extrabold text-face-muted block mb-1 tracking-wider">
                  RFQ Identifier
                </label>
                <div className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  {formData.rfqNumber || inspection.inspectionNumber}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-extrabold text-face-muted block mb-1 tracking-wider">
                  Client Organisation <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientOrganization || ""}
                  onChange={(e) => setFormData({ ...formData, clientOrganization: e.target.value })}
                  placeholder="e.g. Saudi Aramco (Vendor Code: CL-ARM101)"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-extrabold text-face-muted block mb-1 tracking-wider">
                  Client Field Representative <span className="text-face-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientRepName || ""}
                  onChange={(e) => setFormData({ ...formData, clientRepName: e.target.value })}
                  placeholder="e.g. Eng. Fahad Al-Zahrani"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-extrabold text-face-muted block mb-1 tracking-wider">
                  Representative Phone / WhatsApp
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientRepPhone || ""}
                  onChange={(e) => setFormData({ ...formData, clientRepPhone: e.target.value })}
                  placeholder="+966 54 112 7101"
                  className="w-full p-2.5 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-semibold text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-face-line dark:border-slate-800 text-[11px] text-face-muted flex items-center justify-between">
              <span>Origin Assignment:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {inspection.assignedTo?.name || "Assigned Inspector"}
              </span>
            </div>
          </div>
        </div>

        {/* ── 02. HAULAGE DISTANCE INPUTS (KM) & ACCESSIBILITY ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(40,50,120,0.06)] border border-face-line/70 dark:border-slate-800 space-y-5">
          {/* Section Header with Quick Scope Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-face-line/70 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 bg-blue-600 text-white text-xs font-black rounded-lg">
                02
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  HAULAGE DISTANCE INPUTS (KM) &amp; ACCESSIBILITY
                </h2>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md uppercase inline-block mt-0.5">
                  {services.filter((s) => s.isActive).length} of 3 OPTIONAL SCOPES ACTIVE
                </span>
              </div>
            </div>

            {/* Quick scope activation pills */}
            {isEditable && (
              <div className="flex flex-wrap items-center gap-2">
                {(["SEWAGE", "GENERAL", "HAZARDOUS"] as const).map((type) => {
                  const idx = services.findIndex((s) => s.serviceType === type);
                  const active = services[idx]?.isActive;
                  const theme =
                    type === "SEWAGE"
                      ? "border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                      : type === "GENERAL"
                      ? "border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                      : "border-rose-600 text-rose-700 dark:text-rose-300 hover:bg-rose-50";

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const updated = [...services];
                        if (idx >= 0) {
                          updated[idx].isActive = !active;
                          setServices(updated);
                        }
                      }}
                      className={`px-3 py-1 text-xs font-black uppercase rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? type === "SEWAGE"
                            ? "bg-amber-700 text-white border-amber-700"
                            : type === "GENERAL"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-rose-600 text-white border-rose-600"
                          : `bg-white dark:bg-slate-900 ${theme}`
                      }`}
                    >
                      <span>{active ? "✓" : "+"}</span>
                      <span>{type} WASTE</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4-Column Card Grid: MOBILIZATION, SEWAGE, GENERAL, HAZARDOUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
            {/* 1. MOBILIZATION CARD (Emerald) */}
            <div className="flex flex-col justify-between border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-2xl bg-emerald-50/20 dark:bg-emerald-950/10 overflow-hidden shadow-xs">
              <div className="bg-emerald-600 text-white p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider">MOBILIZATION</span>
                </div>
                <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full uppercase">
                  BASE CORRIDOR
                </span>
              </div>

              <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                {/* Route label */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                    Base → Site Logistics Corridor
                  </label>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={formData.mobilizationRoute || ""}
                    onChange={(e) => setFormData({ ...formData, mobilizationRoute: e.target.value })}
                    placeholder="e.g. Route: Al-Zour Base → Site Gate 3"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>

                {/* Big Distance KM input */}
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-emerald-800 dark:text-emerald-300 block mb-1 tracking-wider">
                    One-Way Mobilization (KM) <span className="text-face-red">*</span>
                  </label>
                  <div className="relative">
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
                      placeholder="0.0"
                      className="w-full text-center text-2xl font-black font-mono py-2 bg-white dark:bg-slate-900 border-2 border-emerald-500/60 rounded-xl text-emerald-950 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <span className="absolute right-3 top-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      KM
                    </span>
                  </div>
                  {isEditable && liveBaseToSiteKm > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyRoadEstimate}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 mt-1 block w-full text-center cursor-pointer"
                    >
                      Use road estimate (×1.3 = {Math.round(liveBaseToSiteKm * 1.3)} km)
                    </button>
                  )}
                </div>

                {/* Road Condition */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                    Corridor Condition
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["Good", "Fair", "Poor"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={!isEditable}
                        onClick={() => setFormData({ ...formData, mobilizationRoadCondition: r } as any)}
                        className={`py-1 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                          (formData as any).mobilizationRoadCondition === r
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {r === "Good" ? "Smooth" : r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified Transport Corridor</span>
                </div>
              </div>
            </div>

            {/* 2. SEWAGE WASTE CARD (Amber) */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "SEWAGE");
              const svc = services[idx] || ({} as any);
              const facilities = (masterData?.facilities || []).filter((f) => f.serviceType === "SEWAGE");

              return (
                <div
                  className={`flex flex-col justify-between border-2 rounded-2xl overflow-hidden shadow-xs transition-all ${
                    svc.isActive
                      ? "border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70"
                  }`}
                >
                  <div
                    className={`p-3 flex items-center justify-between ${
                      svc.isActive ? "bg-amber-700 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wider">SEWAGE WASTE</span>
                    <button
                      type="button"
                      disabled={!isEditable}
                      onClick={() => {
                        const updated = [...services];
                        if (idx >= 0) {
                          updated[idx].isActive = !svc.isActive;
                          setServices(updated);
                        }
                      }}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase cursor-pointer ${
                        svc.isActive ? "bg-white/20 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {svc.isActive ? "SCOPE ACTIVE" : "INACTIVE"}
                    </button>
                  </div>

                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Approved STP Treatment Facility <span className="text-face-red">*</span>
                      </label>
                      <select
                        disabled={!isEditable || !svc.isActive}
                        value={svc.facilityId || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          const f = facilities.find((item) => item.id === e.target.value);
                          updated[idx].facilityId = e.target.value || null;
                          updated[idx].facilityName = f?.name || "";
                          setServices(updated);
                        }}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                      >
                        <option value="">Select STP Facility...</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-amber-900 dark:text-amber-300 block mb-1 tracking-wider">
                        Haulage to Discharge (KM) <span className="text-face-red">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.distanceKm ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].distanceKm = Number(e.target.value);
                            setServices(updated);
                          }}
                          placeholder="0.0"
                          className="w-full text-center text-2xl font-black font-mono py-2 bg-white dark:bg-slate-900 border-2 border-amber-600/50 rounded-xl text-amber-950 dark:text-amber-100 focus:outline-none"
                        />
                        <span className="absolute right-3 top-3 text-[11px] font-black text-amber-700 dark:text-amber-400">
                          KM
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Road Condition
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["Good", "Fair", "Poor"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={!isEditable || !svc.isActive}
                            onClick={() => {
                              const updated = [...services];
                              updated[idx].roadCondition = r;
                              setServices(updated);
                            }}
                            className={`py-1 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-amber-700 text-white border-amber-700"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r === "Good" ? "Smooth" : r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Clearance Notes
                      </label>
                      <input
                        type="text"
                        disabled={!isEditable || !svc.isActive}
                        value={svc.wasteDescription || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx].wasteDescription = e.target.value;
                          setServices(updated);
                        }}
                        placeholder="e.g. Vacuum tanker access; Gate 2"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. GENERAL WASTE CARD (Blue) */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "GENERAL");
              const svc = services[idx] || ({} as any);
              const facilities = (masterData?.facilities || []).filter((f) => f.serviceType === "GENERAL");

              return (
                <div
                  className={`flex flex-col justify-between border-2 rounded-2xl overflow-hidden shadow-xs transition-all ${
                    svc.isActive
                      ? "border-blue-600/60 bg-blue-50/20 dark:bg-blue-950/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70"
                  }`}
                >
                  <div
                    className={`p-3 flex items-center justify-between ${
                      svc.isActive ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wider">GENERAL WASTE</span>
                    <button
                      type="button"
                      disabled={!isEditable}
                      onClick={() => {
                        const updated = [...services];
                        if (idx >= 0) {
                          updated[idx].isActive = !svc.isActive;
                          setServices(updated);
                        }
                      }}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase cursor-pointer ${
                        svc.isActive ? "bg-white/20 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {svc.isActive ? "SCOPE ACTIVE" : "INACTIVE"}
                    </button>
                  </div>

                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Approved Landfill / Transfer Stn <span className="text-face-red">*</span>
                      </label>
                      <select
                        disabled={!isEditable || !svc.isActive}
                        value={svc.facilityId || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          const f = facilities.find((item) => item.id === e.target.value);
                          updated[idx].facilityId = e.target.value || null;
                          updated[idx].facilityName = f?.name || "";
                          setServices(updated);
                        }}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                      >
                        <option value="">Select Landfill Facility...</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-blue-900 dark:text-blue-300 block mb-1 tracking-wider">
                        Haulage to Landfill (KM) <span className="text-face-red">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.distanceKm ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].distanceKm = Number(e.target.value);
                            setServices(updated);
                          }}
                          placeholder="0.0"
                          className="w-full text-center text-2xl font-black font-mono py-2 bg-white dark:bg-slate-900 border-2 border-blue-600/50 rounded-xl text-blue-950 dark:text-blue-100 focus:outline-none"
                        />
                        <span className="absolute right-3 top-3 text-[11px] font-black text-blue-600 dark:text-blue-400">
                          KM
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Road Condition
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["Good", "Fair", "Poor"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={!isEditable || !svc.isActive}
                            onClick={() => {
                              const updated = [...services];
                              updated[idx].roadCondition = r;
                              setServices(updated);
                            }}
                            className={`py-1 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r === "Good" ? "Smooth" : r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Clearance Notes
                      </label>
                      <input
                        type="text"
                        disabled={!isEditable || !svc.isActive}
                        value={svc.wasteDescription || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx].wasteDescription = e.target.value;
                          setServices(updated);
                        }}
                        placeholder="e.g. Double-trailer compactors accessible"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4. HAZARDOUS WASTE CARD (Red) */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "HAZARDOUS");
              const svc = services[idx] || ({} as any);
              const facilities = (masterData?.facilities || []).filter((f) => f.serviceType === "HAZARDOUS");

              return (
                <div
                  className={`flex flex-col justify-between border-2 rounded-2xl overflow-hidden shadow-xs transition-all ${
                    svc.isActive
                      ? "border-rose-600/60 bg-rose-50/20 dark:bg-rose-950/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70"
                  }`}
                >
                  <div
                    className={`p-3 flex items-center justify-between ${
                      svc.isActive ? "bg-rose-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wider">HAZARDOUS WASTE</span>
                    <button
                      type="button"
                      disabled={!isEditable}
                      onClick={() => {
                        const updated = [...services];
                        if (idx >= 0) {
                          updated[idx].isActive = !svc.isActive;
                          setServices(updated);
                        }
                      }}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase cursor-pointer ${
                        svc.isActive ? "bg-white/20 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {svc.isActive ? "SCOPE ACTIVE" : "INACTIVE"}
                    </button>
                  </div>

                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Certified Hazmat Complex <span className="text-face-red">*</span>
                      </label>
                      <select
                        disabled={!isEditable || !svc.isActive}
                        value={svc.facilityId || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          const f = facilities.find((item) => item.id === e.target.value);
                          updated[idx].facilityId = e.target.value || null;
                          updated[idx].facilityName = f?.name || "";
                          setServices(updated);
                        }}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                      >
                        <option value="">Select Hazmat Facility...</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-rose-900 dark:text-rose-300 block mb-1 tracking-wider">
                        Haulage for Haz Treatment (KM) <span className="text-face-red">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.distanceKm ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].distanceKm = Number(e.target.value);
                            setServices(updated);
                          }}
                          placeholder="0.0"
                          className="w-full text-center text-2xl font-black font-mono py-2 bg-white dark:bg-slate-900 border-2 border-rose-600/50 rounded-xl text-rose-950 dark:text-rose-100 focus:outline-none"
                        />
                        <span className="absolute right-3 top-3 text-[11px] font-black text-rose-600 dark:text-rose-400">
                          KM
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Road Condition
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["Good", "Fair", "Poor"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={!isEditable || !svc.isActive}
                            onClick={() => {
                              const updated = [...services];
                              updated[idx].roadCondition = r;
                              setServices(updated);
                            }}
                            className={`py-1 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-rose-600 text-white border-rose-600"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r === "Good" ? "Smooth" : r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1 tracking-wider">
                        Clearance Notes
                      </label>
                      <input
                        type="text"
                        disabled={!isEditable || !svc.isActive}
                        value={svc.wasteDescription || ""}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx].wasteDescription = e.target.value;
                          setServices(updated);
                        }}
                        placeholder="e.g. Aramco permit Level 2 required"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Full-Width Aggregate Operational Haulage Metrics Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    Aggregate Operational Haulage Metrics
                  </span>
                  <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                    {services.filter((s) => s.isActive).length} Scopes Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Calculated total single-cycle haulage including mobilization and facility discharge channels.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 sm:gap-8 shrink-0">
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 block leading-none">
                  {liveMetrics.totalCycleKm} KM
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mt-1">
                  Single Complete Cycle
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black font-mono text-sky-400 block leading-none">
                  {liveMetrics.estFuelLitres} L
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mt-1">
                  Est. Diesel Fuel Burn
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 03. SITE OBSERVATIONS & FIELD ATTACHMENTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Card: Ground Observations & Operational Constraints */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(40,50,120,0.06)] border border-face-line/70 dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between border-b border-face-line/70 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-black rounded-lg">
                  03
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Site Observations &amp; Operational Constraints
                </h2>
              </div>
            </div>

            <textarea
              disabled={!isEditable}
              rows={6}
              value={formData.observations || ""}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Record ground conditions, crane access, load restrictions, environmental hazards, hot work restrictions..."
              className="w-full p-3 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-xs font-medium text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green leading-relaxed"
            />

            {/* Quick Insert Chips */}
            {isEditable && (
              <div>
                <span className="text-[10px] uppercase font-extrabold text-face-muted block mb-1.5 tracking-wider">
                  Quick-Insert Operational Chips:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAddChip(chip)}
                      className="px-2 py-0.5 bg-face-field dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-face-muted hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 text-[11px] font-bold rounded-md border border-face-line dark:border-slate-700 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Card: Field Photos & Environmental Passes */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(40,50,120,0.06)] border border-face-line/70 dark:border-slate-800 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-face-line/70 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Field Photos &amp; Environmental Passes
                </h2>
                <span className="text-xs font-bold text-face-muted">
                  {inspection.attachments?.length || 0} File{(inspection.attachments?.length || 0) === 1 ? "" : "s"}
                </span>
              </div>

              {/* Upload Dropzone */}
              {isEditable && (
                <label className="border-2 border-dashed border-face-green/40 hover:border-face-green dark:border-face-green-dark bg-face-green-light/40 dark:bg-slate-800/40 hover:bg-face-green-light/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <Upload className="w-5 h-5 text-face-green mb-1" />
                  <span className="text-xs font-bold text-face-ink dark:text-white">
                    {isUploading ? "Uploading..." : "Click or drag to upload field photos & permits"}
                  </span>
                  <span className="text-[10px] text-face-muted mt-0.5">
                    JPG, PNG, WEBP, or PDF up to 25MB (EXIF GPS auto-extracted)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    disabled={isUploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Attachments List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(inspection.attachments || []).length === 0 ? (
                  <p className="text-xs text-face-muted text-center py-4 italic">
                    No field attachments uploaded yet. At least 1 photo is required.
                  </p>
                ) : (
                  (inspection.attachments || []).map((att) => {
                    const isPdf = att.fileName.toLowerCase().endsWith(".pdf");
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-face-field dark:bg-slate-800 rounded-xl border border-face-line dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black rounded uppercase ${
                              isPdf ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {isPdf ? "PDF" : "PHOTO"}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {att.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(att.id)}
                            className="p-1 hover:text-blue-600 text-slate-400"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => deleteAttMutation.mutate(att.id)}
                              disabled={deleteAttMutation.isPending}
                              className="p-1 hover:text-red-600 text-slate-400"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        </div>

        {/* ── STICKY ACTION FOOTER ── */}
        <div className="sticky bottom-4 z-30 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="accept-certification"
              disabled={!isEditable}
              checked={Boolean(formData.accepted)}
              onChange={(e) => setFormData({ ...formData, accepted: e.target.checked })}
              className="w-4 h-4 rounded text-face-green accent-face-green cursor-pointer shrink-0"
            />
            <label
              htmlFor="accept-certification"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-tight"
            >
              I confirm and certify that all site inspection information, GPS coordinates, haulage distances, and waste specifications provided herein are accurate and reflect real ground conditions.
            </label>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            {/* Print PDF Report */}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveDraftMutation.isPending ? "Saving..." : "Save as Draft"}</span>
              </button>
            )}

            {/* Submit / Resubmit */}
            {isEditable && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submitMutation.isPending
                    ? "Submitting..."
                    : inspection.status === "CHANGES_REQUESTED"
                    ? "Resubmit Inspection"
                    : "SUBMIT INSPECTION FOR REVIEW"}
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
