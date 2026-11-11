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
  Camera,
  Droplets,
  PanelLeft,
  Navigation,
  Loader2,
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

function KmStepper({
  value,
  onChange,
  disabled,
  step = 0.5,
  min = 0,
}: {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  disabled?: boolean;
  step?: number;
  min?: number;
}) {
  const current = value != null ? Number(value) : 0;
  return (
    <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 focus-within:ring-1 focus-within:ring-slate-400">
      <button
        type="button"
        disabled={disabled || current <= min}
        onClick={() => onChange(Math.max(min, Number((current - step).toFixed(1))))}
        className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none"
      >
        −
      </button>
      <input
        type="number"
        step={step}
        min={min}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="0.0"
        className="w-full text-center font-black text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Number((current + step).toFixed(1)))}
        className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none"
      >
        +
      </button>
      <span className="pr-2.5 text-[10px] font-extrabold text-slate-400 uppercase select-none">
        KM
      </span>
    </div>
  );
}

const DEFAULT_BASES = [
  { id: "11111111-1111-4111-a111-111111111111", code: "JUBAIL", name: "Jubail Operations Base", region: "Eastern Province", latitude: 27.0, longitude: 49.65 },
  { id: "22222222-2222-4222-a222-222222222222", code: "JAFURAH", name: "Jafurah Operations Base", region: "Eastern Province", latitude: 25.55, longitude: 49.85 },
  { id: "33333333-3333-4333-a333-333333333333", code: "YANBU", name: "Yanbu Operations Base", region: "Western Province", latitude: 24.09, longitude: 38.06 },
  { id: "44444444-4444-4444-a444-444444444444", code: "RIYADH", name: "Riyadh Operations Base", region: "Central Province", latitude: 24.71, longitude: 46.68 },
];

const DEFAULT_FACILITIES = [
  { id: "f1010000-0000-4000-a000-000000000001", serviceType: "SEWAGE", name: "Ras Tanura STP", lat: 26.65, lng: 50.15 },
  { id: "f1020000-0000-4000-a000-000000000002", serviceType: "SEWAGE", name: "Jubail Industrial Wastewater Treatment Plant", lat: 27.02, lng: 49.58 },
  { id: "f1030000-0000-4000-a000-000000000003", serviceType: "SEWAGE", name: "Yanbu Municipal Wastewater Facility", lat: 24.05, lng: 38.12 },
  { id: "f2010000-0000-4000-a000-000000000001", serviceType: "GENERAL", name: "Jubail Ind. Waste Landfill #4", lat: 27.08, lng: 49.52 },
  { id: "f2020000-0000-4000-a000-000000000002", serviceType: "GENERAL", name: "Dammam Municipal Landfill", lat: 26.35, lng: 49.98 },
  { id: "f2030000-0000-4000-a000-000000000003", serviceType: "GENERAL", name: "Yanbu Industrial Sanitary Landfill", lat: 23.98, lng: 38.22 },
  { id: "f3010000-0000-4000-a000-000000000001", serviceType: "HAZARDOUS", name: "Bee'ah/EDCO Hazmat Complex Jubail", lat: 26.96, lng: 49.61 },
  { id: "f3020000-0000-4000-a000-000000000002", serviceType: "HAZARDOUS", name: "SEPCO Environmental Services Yanbu", lat: 24.12, lng: 38.02 },
  { id: "f3030000-0000-4000-a000-000000000003", serviceType: "HAZARDOUS", name: "National Environmental Preservation Co (BEEA) Jubail", lat: 27.04, lng: 49.49 },
];

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

  // GPS coordinates sub-panel visibility
  const [showCoordinatesModal, setShowCoordinatesModal] = useState(false);

  // Review comment state
  const [reviewComment, setReviewComment] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Reassign state
  const [selectedReassignUser, setSelectedReassignUser] = useState("");

  // Mobilization auto-routing state
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [showRouteMapModal, setShowRouteMapModal] = useState(false);
  const [routeSteps, setRouteSteps] = useState<Array<{ road: string; distanceKm: number }>>([]);
  const [routingNotice, setRoutingNotice] = useState<{
    text: string;
    type: "success" | "warning" | "error";
  } | null>(null);

  // Fetch Master Data
  const { data: masterData } = useQuery<MasterDataResponse>({
    queryKey: ["site-inspections-master"],
    queryFn: () => siteInspectionApi.getMasterData(),
  });

  const availableBases = useMemo(() => {
    return masterData?.bases && masterData.bases.length > 0
      ? masterData.bases
      : DEFAULT_BASES;
  }, [masterData]);

  const availableFacilities = useMemo(() => {
    return masterData?.facilities && masterData.facilities.length > 0
      ? masterData.facilities
      : DEFAULT_FACILITIES;
  }, [masterData]);

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
    const base = availableBases.find((b) => b.id === formData.baseId);
    if (!base || formData.latitude == null || formData.longitude == null) {
      return formData.baseToSiteStraightKm || 0;
    }
    return haversineKm(base.latitude, base.longitude, Number(formData.latitude), Number(formData.longitude));
  }, [availableBases, formData.baseId, formData.latitude, formData.longitude, formData.baseToSiteStraightKm]);

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

  const startVisitMutation = useMutation({
    mutationFn: () => siteInspectionApi.startVisit(id!),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["site-inspection", id] });
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      setFormData((prev) => ({ ...prev, startedAt: updated.startedAt || new Date().toISOString() }));
      setSaveSuccessMsg("On-site arrival timestamp recorded successfully.");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || err.message || "Failed to record site check-in.");
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

  // Auto-detect route via Option A (OSRM) with Tier 2 Fallback (1.3× Haversine)
  const handleAutoDetectRoute = async () => {
    const base = availableBases.find((b) => b.id === formData.baseId);
    if (!base) {
      setRoutingNotice({
        text: "Please select an Operations Base first.",
        type: "error",
      });
      return;
    }

    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);
    if (!formData.latitude || !formData.longitude || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      setRoutingNotice({
        text: "Please enter valid GPS coordinates for the site first.",
        type: "error",
      });
      return;
    }

    setIsRoutingLoading(true);
    setRoutingNotice(null);

    const baseName = base.name || "Base";
    const siteName = formData.siteName || "Client Site";

    try {
      // Option A: OSRM Driving Routing API (lng,lat order) with 9s timeout for long cross-country routes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const url = `https://router.project-osrm.org/route/v1/driving/${base.longitude},${base.latitude};${lng},${lat}?overview=false&steps=true`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`OSRM HTTP error status ${res.status}`);
      }

      const data = await res.json();
      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        throw new Error("No road routing path found in response");
      }

      const route = data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;

      // Extract unique major road names and their accumulated distances from steps
      const roadMap = new Map<string, number>();
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        for (const step of route.legs[0].steps) {
          const stepName = (step.name || "").trim();
          if (!stepName) continue;
          const dKm = (step.distance || 0) / 1000;
          roadMap.set(stepName, (roadMap.get(stepName) || 0) + dKm);
        }
      }

      const extractedSteps = Array.from(roadMap.entries()).map(([road, km]) => ({
        road,
        distanceKm: Math.round(km * 10) / 10,
      }));
      setRouteSteps(extractedSteps);

      // Format corridor: Base -> Top Highways/Roads -> Site
      const majorRoads = extractedSteps.slice(0, 3).map((s) => s.road);
      let corridor = `Route: ${baseName}`;
      if (majorRoads.length > 0) {
        corridor += ` → ${majorRoads.join(" → ")}`;
      }
      corridor += ` → ${siteName}`;

      setFormData((prev) => ({
        ...prev,
        mobilizationKm: distanceKm,
        mobilizationRoute: corridor,
      }));

      setRoutingNotice({
        text: `Live road corridor calculated (${distanceKm} km via OpenStreetMap)`,
        type: "success",
      });
    } catch (err: any) {
      console.warn("[Auto-Route] OSRM live routing failed, applying Tier 2 fallback:", err?.message);
      // Tier 2 Fallback: Straight-line Haversine * 1.3 curvature factor
      const straightKm = haversineKm(base.latitude, base.longitude, lat, lng);
      const detourKm = Math.round(straightKm * 1.3 * 10) / 10;
      const fallbackCorridor = `Route: ${baseName} → ${siteName} (1.3× Highway Detour)`;

      setRouteSteps([{ road: "Standard 1.3× Highway Detour Corridor", distanceKm: detourKm }]);
      setFormData((prev) => ({
        ...prev,
        mobilizationKm: detourKm,
        mobilizationRoute: fallbackCorridor,
      }));

      setRoutingNotice({
        text: `Road network service unreachable. Applied standard 1.3× detour factor (${detourKm} km)`,
        type: "warning",
      });
    } finally {
      setIsRoutingLoading(false);
    }
  };

  // Road estimate helper (Tier 2 shortcut)
  const handleApplyRoadEstimate = () => {
    if (liveBaseToSiteKm > 0) {
      const base = availableBases.find((b) => b.id === formData.baseId);
      const estimated = Math.round(liveBaseToSiteKm * 1.3 * 10) / 10;
      setRouteSteps([{ road: "Standard 1.3× Highway Detour Corridor", distanceKm: estimated }]);
      setFormData((prev) => ({
        ...prev,
        mobilizationKm: estimated,
        mobilizationRoute:
          prev.mobilizationRoute ||
          `Route: ${base?.name || "Base"} → ${prev.siteName || "Site"} (1.3× Highway Detour)`,
      }));
      setRoutingNotice({
        text: `Applied standard 1.3× highway curvature estimate (${estimated} km)`,
        type: "warning",
      });
    }
  };

  // Categorized Fieldwork Assessment Quick Options
  const HSE_CATEGORIES = [
    {
      category: "Permits & Safety (PTW)",
      chips: [
        "Cold Work (Standard)",
        "Hot Work Permit Required",
        "Confined Space Entry",
        "H2S Certified Personnel Required",
        "Secondary Containment Required",
      ],
    },
    {
      category: "Access & Ground Constraints",
      chips: [
        "Paved Access Road Available",
        "Off-road / Sand Track Only",
        "Bogie Mats Required",
        "HV Cable Height Clearance Required",
        "Steel Spreader Plates for Outriggers",
      ],
    },
    {
      category: "Equipment & Fleet Sizing",
      chips: [
        "Super Sucker (28kL) Required",
        "Standard Vacuum Tanker (12kL)",
        "High-Pressure Jetting (500 BAR)",
        "Long Suction Reach (>30m)",
      ],
    },
  ];

  const handleToggleChip = (chip: string) => {
    setFormData((prev) => {
      const current = prev.observations || "";
      if (current.includes(chip)) {
        const cleaned = current
          .replace(new RegExp(`;?\\s*${chip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;?`, "g"), "; ")
          .replace(/^;\s*|;\s*$/g, "")
          .trim();
        return { ...prev, observations: cleaned };
      } else {
        const updated = current.trim() ? `${current.trim()}; ${chip}` : chip;
        return { ...prev, observations: updated };
      }
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
      <div className="inspection-screen-view font-sans tracking-normal max-w-[1360px] mx-auto px-4 sm:px-6 py-5 space-y-4 print:hidden">
        {/* Top Banner Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/site-inspections")}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer"
              title="Back to Site Inspections"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <PanelLeft className="w-4 h-4 text-slate-500" />
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Site Inspection &amp; Assessment Portal
              </h1>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="font-mono text-xs font-semibold text-slate-500">
                {inspection.inspectionNumber}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeBg}`}
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

      {/* On-Site Visit Check-In Action Banner for Assigned Inspector */}
      {isInspector && !inspection.startedAt && ["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(inspection.status) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                <span>On-Site Field Visit Check-In</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono">
                  SLA Tracked
                </span>
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                Arrived at client plant gate? Timestamp your arrival to verify physical site inspection attendance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startVisitMutation.mutate()}
            disabled={startVisitMutation.isPending}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{startVisitMutation.isPending ? "Recording Check-In..." : "Check In at Site Gate"}</span>
          </button>
        </div>
      )}

      {/* Active On-Site Status Indicator */}
      {inspection.startedAt && (
        <div className="flex items-center justify-between p-2.5 px-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold">On-Site Field Visit In Progress</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span className="text-slate-600 dark:text-slate-400">
              Checked in: {new Date(inspection.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} AST
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
            Active Audit
          </span>
        </div>
      )}

      {/* ================= UNIFIED SINGLE-SCREEN INSPECTION DASHBOARD (LOVABLE REPLICA) ================= */}
      <div className="space-y-4">

        {/* ── 01. INSPECTION SITE & CLIENT DETAILS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#065f46] text-white text-xs font-black rounded">
                01
              </span>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                INSPECTION SITE
              </h2>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              STEP VERIFIED
            </span>
          </div>

          {/* Row 1: 4 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Col 1: Assigned Operations Base */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                Assigned Operations Base <span className="text-red-500">*</span>
              </label>
              <select
                disabled={!isEditable}
                value={formData.baseId || ""}
                onChange={(e) => setFormData({ ...formData, baseId: e.target.value })}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">Select Deploying Base...</option>
                {availableBases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.region})
                  </option>
                ))}
              </select>
            </div>

            {/* Col 2: Inspection Site & Coordinates */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Inspection Site &amp; Coordinates <span className="text-red-500">*</span>
                </label>
                {isEditable && (
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    <span>GPS</span>
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.siteName || ""}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  placeholder="e.g. Tanajib Offshore Gas Facility"
                  className="w-full pl-8 pr-24 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowCoordinatesModal(!showCoordinatesModal)}
                  title="Click to view/edit GPS coordinates"
                  className="absolute right-1 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                >
                  {formData.latitude != null && formData.longitude != null
                    ? `${formData.latitude.toFixed(2)}°, ${formData.longitude.toFixed(2)}°`
                    : "Set GPS"}
                </button>
              </div>

              {showCoordinatesModal && (
                <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg grid grid-cols-2 gap-2 text-xs shadow-xs">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      disabled={!isEditable}
                      value={formData.latitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="e.g. 27.8341"
                      className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      disabled={!isEditable}
                      value={formData.longitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="e.g. 48.8872"
                      className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
                    />
                  </div>
                  {liveBaseToSiteKm > 0 && (
                    <div className="col-span-2 text-[10px] text-emerald-700 font-semibold pt-0.5">
                      Straight line: {liveBaseToSiteKm} km
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Col 3: Audit Date & Time (AST) */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                Audit Date &amp; Time (AST) <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                disabled={!isEditable}
                value={formData.auditAt || ""}
                onChange={(e) => setFormData({ ...formData, auditAt: e.target.value })}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Col 4: Approved RFQ Scope Summary */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                Approved RFQ Scope Summary
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={formData.scopeSummary || ""}
                onChange={(e) => setFormData({ ...formData, scopeSummary: e.target.value })}
                placeholder="Comprehensive Industrial Site Assessment..."
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 truncate"
              />
            </div>
          </div>

          {/* Client Details Row */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Client Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                  RFQ Identifier
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.rfqNumber || inspection.inspectionNumber}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                  Client Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={formData.clientOrganization || ""}
                  onChange={(e) => setFormData({ ...formData, clientOrganization: e.target.value })}
                  placeholder="e.g. Saudi Aramco (Vendor Code: CL-ARM-001)"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                  Client Field Representative <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isEditable}
                  value={
                    formData.clientRepPhone
                      ? `${formData.clientRepName || ""} (${formData.clientRepPhone})`.trim()
                      : (formData.clientRepName || "")
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = val.match(/^(.*?)(?:\s*\((.*?)\))?$/);
                    if (match) {
                      setFormData({
                        ...formData,
                        clientRepName: match[1]?.trim() || val,
                        clientRepPhone: match[2]?.trim() || formData.clientRepPhone || "",
                      });
                    } else {
                      setFormData({ ...formData, clientRepName: val });
                    }
                  }}
                  placeholder="Eng. Fahad Al-Zahrani (+966 54 112 7901)"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 02. HAULAGE DISTANCE INPUTS (KM) & ACCESSIBILITY ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#065f46] text-white text-xs font-black rounded">
              02
            </span>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              HAULAGE DISTANCE INPUTS (KM) &amp; ACCESSIBILITY
            </h2>
          </div>

          {/* Scope Services Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mr-1">
              RFQ SCOPE SERVICES:
            </span>

            {/* Mobilization Base (Mandatory) */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#065f46] text-white rounded-md text-[11px] font-bold">
              <Lock className="w-3 h-3" />
              <span>MOBILIZATION (MANDATORY BASE)</span>
            </div>

            {/* Sewage Waste Toggle */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "SEWAGE");
              const svc = services[idx] || ({} as any);
              return (
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    svc.isActive
                      ? "bg-[#fbf7f4] border-[#78350f]/30 text-[#78350f]"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#78350f]" />
                  <span>SEWAGE WASTE</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                      svc.isActive ? "bg-[#78350f] text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {svc.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </button>
              );
            })()}

            {/* General Waste Toggle */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "GENERAL");
              const svc = services[idx] || ({} as any);
              return (
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    svc.isActive
                      ? "bg-blue-50/60 border-blue-300 text-blue-900"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>GENERAL WASTE</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                      svc.isActive ? "bg-[#1d4ed8] text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {svc.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </button>
              );
            })()}

            {/* Hazardous Waste Toggle */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "HAZARDOUS");
              const svc = services[idx] || ({} as any);
              return (
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    svc.isActive
                      ? "bg-red-50/60 border-red-300 text-red-900"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>HAZARDOUS WASTE</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                      svc.isActive ? "bg-[#b91c1c] text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {svc.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
            {/* 1. MOBILIZATION */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-2xs">
              <div className="bg-[#065f46] text-white px-3 py-2 flex items-center justify-between font-black text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" />
                  <span>MOBILIZATION</span>
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider">
                  MANDATORY
                </span>
              </div>

              <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      DIRECT MOBILIZATION TRACK
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowRouteMapModal(true)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                        title="View interactive route corridor map & turn-by-turn highways"
                      >
                        <Compass className="w-3 h-3 text-emerald-600" />
                        <span>Map</span>
                      </button>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={handleAutoDetectRoute}
                          disabled={isRoutingLoading}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Auto-calculate real driving route & distance from road network (OSRM)"
                        >
                          {isRoutingLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                              <span>Routing...</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-3 h-3 text-emerald-600" />
                              <span>⚡ Auto-Route</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={formData.mobilizationRoute || ""}
                    onChange={(e) => setFormData({ ...formData, mobilizationRoute: e.target.value })}
                    placeholder="Route: Base → Highway → Site Gate"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  />
                  {routingNotice && (
                    <div
                      className={`mt-1.5 p-1.5 px-2 rounded text-[10px] flex items-center gap-1.5 leading-tight ${
                        routingNotice.type === "success"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : routingNotice.type === "warning"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      {routingNotice.type === "success" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                      {routingNotice.type === "warning" && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      {routingNotice.type === "error" && <AlertCircle className="w-3 h-3 shrink-0" />}
                      <span className="flex-1">{routingNotice.text}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    One-Way Mobilization (KM) <span className="text-red-500">*</span>
                  </label>
                  <KmStepper
                    disabled={!isEditable}
                    value={formData.mobilizationKm}
                    onChange={(val) => setFormData({ ...formData, mobilizationKm: val })}
                  />
                  {isEditable && liveBaseToSiteKm > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyRoadEstimate}
                      className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 hover:underline mt-1 block text-center w-full cursor-pointer transition-colors"
                      title="Force standard Haversine × 1.3 highway curvature calculation"
                    >
                      Use standard detour fallback (×1.3 = {Math.round(liveBaseToSiteKm * 1.3)} km)
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                    VERIFIED FLEET SPEED LIMIT
                  </label>
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Highway Heavy Speed Cap</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formData.speedLimitKmh || 80} KM/H
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Transport Corridor</span>
                </div>
              </div>
            </div>

            {/* 2. SEWAGE WASTE */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "SEWAGE");
              const svc = services[idx] || ({} as any);
              const facilities = availableFacilities.filter((f) => f.serviceType === "SEWAGE");
              return (
                <div className={`border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-2xs ${
                  !svc.isActive ? "opacity-60" : ""
                }`}>
                  <div className="bg-[#78350f] text-white px-3 py-2 flex items-center justify-between font-black text-xs">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-3.5 h-3.5" />
                      <span>SEWAGE WASTE</span>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider">
                      {svc.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        ASSIGNED STP TREATMENT FACILITY <span className="text-red-500">*</span>
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
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100"
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
                      <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Haulage to Discharge (KM) <span className="text-red-500">*</span>
                      </label>
                      <KmStepper
                        disabled={!isEditable || !svc.isActive}
                        value={svc.distanceKm}
                        onChange={(val) => {
                          const updated = [...services];
                          updated[idx].distanceKm = val ?? 0;
                          setServices(updated);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH ROAD CONDITION
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
                            className={`py-1 text-[11px] font-bold rounded border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-[#78350f] text-white border-[#78350f]"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          EST. VOLUME / CAPACITY
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.estimatedVolume ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].estimatedVolume = e.target.value ? parseFloat(e.target.value) : null;
                            setServices(updated);
                          }}
                          placeholder="e.g. 30"
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          VOLUME UNIT
                        </label>
                        <select
                          disabled={!isEditable || !svc.isActive}
                          value={svc.volumeUnit || "m³"}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].volumeUnit = e.target.value;
                            setServices(updated);
                          }}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          <option value="m³">m³ (Cubic Meters)</option>
                          <option value="Liters">Liters</option>
                          <option value="Tanker Loads">Tanker Loads (10,000L)</option>
                          <option value="Gallons">Gallons</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH LOGISTICS NOTE
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
                        placeholder="e.g. Heavy vacuum tanker access via Gate 2"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. GENERAL WASTE */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "GENERAL");
              const svc = services[idx] || ({} as any);
              const facilities = availableFacilities.filter((f) => f.serviceType === "GENERAL");
              return (
                <div className={`border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-2xs ${
                  !svc.isActive ? "opacity-60" : ""
                }`}>
                  <div className="bg-[#1d4ed8] text-white px-3 py-2 flex items-center justify-between font-black text-xs">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>GENERAL WASTE</span>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider">
                      {svc.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        ASSIGNED LANDFILL / TRANSFER STN <span className="text-red-500">*</span>
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
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100"
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
                      <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Haulage to Landfill (KM) <span className="text-red-500">*</span>
                      </label>
                      <KmStepper
                        disabled={!isEditable || !svc.isActive}
                        value={svc.distanceKm}
                        onChange={(val) => {
                          const updated = [...services];
                          updated[idx].distanceKm = val ?? 0;
                          setServices(updated);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH ROAD CONDITION
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
                            className={`py-1 text-[11px] font-bold rounded border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-[#1d4ed8] text-white border-[#1d4ed8]"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          EST. VOLUME / CAPACITY
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.estimatedVolume ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].estimatedVolume = e.target.value ? parseFloat(e.target.value) : null;
                            setServices(updated);
                          }}
                          placeholder="e.g. 30"
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          VOLUME UNIT
                        </label>
                        <select
                          disabled={!isEditable || !svc.isActive}
                          value={svc.volumeUnit || "m³"}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].volumeUnit = e.target.value;
                            setServices(updated);
                          }}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          <option value="m³">m³ (Skip Bin Size)</option>
                          <option value="Tons">Tons</option>
                          <option value="Compactor Bins">Compactor Bins (20m³)</option>
                          <option value="Trips">Trips / Loads</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH LOGISTICS NOTE
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
                        placeholder="e.g. Double trailer compactor trucks accessible"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4. HAZARDOUS WASTE */}
            {(() => {
              const idx = services.findIndex((s) => s.serviceType === "HAZARDOUS");
              const svc = services[idx] || ({} as any);
              const facilities = availableFacilities.filter((f) => f.serviceType === "HAZARDOUS");
              return (
                <div className={`border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 shadow-2xs ${
                  !svc.isActive ? "opacity-60" : ""
                }`}>
                  <div className="bg-[#b91c1c] text-white px-3 py-2 flex items-center justify-between font-black text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>HAZARDOUS WASTE</span>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider">
                      {svc.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        CERTIFIED HAZMAT COMPLEX <span className="text-red-500">*</span>
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
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100"
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
                      <label className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Haulage to Haz Treatment (KM) <span className="text-red-500">*</span>
                      </label>
                      <KmStepper
                        disabled={!isEditable || !svc.isActive}
                        value={svc.distanceKm}
                        onChange={(val) => {
                          const updated = [...services];
                          updated[idx].distanceKm = val ?? 0;
                          setServices(updated);
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH ROAD CONDITION
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
                            className={`py-1 text-[11px] font-bold rounded border transition-all cursor-pointer ${
                              svc.roadCondition === r
                                ? "bg-[#b91c1c] text-white border-[#b91c1c]"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          EST. VOLUME / CAPACITY
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!isEditable || !svc.isActive}
                          value={svc.estimatedVolume ?? ""}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].estimatedVolume = e.target.value ? parseFloat(e.target.value) : null;
                            setServices(updated);
                          }}
                          placeholder="e.g. 30"
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                          VOLUME UNIT
                        </label>
                        <select
                          disabled={!isEditable || !svc.isActive}
                          value={svc.volumeUnit || "m³"}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx].volumeUnit = e.target.value;
                            setServices(updated);
                          }}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        >
                          <option value="m³">m³ (Industrial Sludge)</option>
                          <option value="Tons">Tons (Contaminated Solid)</option>
                          <option value="IBC Totes">IBC Totes (1000L)</option>
                          <option value="200L Drums">200L Steel Drums</option>
                          <option value="Tanker Loads">Dedicated Vacuum Tanker</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        APPROACH LOGISTICS NOTE
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
                        placeholder="e.g. Requires Aramco work permit Level 2"
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Full-Width Aggregate Operational Haulage Metrics Bar */}
          <div className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 text-emerald-800 dark:text-emerald-300" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Aggregate Operational Haulage Metrics
                </span>
                <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                  {services.filter((s) => s.isActive).length === 3
                    ? "ALL 3 SCOPES ACTIVE"
                    : `${services.filter((s) => s.isActive).length} OF 3 SCOPES ACTIVE`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                  SINGLE COMPLETE CYCLE
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white leading-tight">
                  {liveMetrics.totalCycleKm} KM
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                  EST. DIESEL FUEL BURN
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white leading-tight">
                  {liveMetrics.estFuelLitres} L
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 03. SITE OBSERVATIONS & FIELD ATTACHMENTS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#065f46] text-white text-xs font-black rounded">
              03
            </span>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              SITE OBSERVATIONS
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Ground Observations & Operational Constraints */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                Site Observations &amp; Operational Constraints
              </label>
              <div className="relative">
                <textarea
                  disabled={!isEditable}
                  rows={6}
                  value={formData.observations || ""}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Record ground conditions, crane access, load restrictions, environmental hazards, hot work restrictions..."
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600 leading-relaxed"
                />
              </div>

              {isEditable && (
                <div className="space-y-2.5 pt-1.5">
                  {HSE_CATEGORIES.map((catGroup) => (
                    <div key={catGroup.category} className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                        {catGroup.category}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {catGroup.chips.map((chip) => {
                          const isActive = (formData.observations || "").includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => handleToggleChip(chip)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                                  : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <span>{isActive ? "✓" : "+"}</span>
                              <span>{chip}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Field Photos & Environmental Passes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Field Photos &amp; Environmental Passes
                </label>
                <span className="text-[10px] font-bold text-slate-400">
                  {inspection.attachments?.length || 0} File{(inspection.attachments?.length || 0) === 1 ? "" : "s"}
                </span>
              </div>

              {isEditable && (
                <label className="border-2 border-dashed border-slate-300 hover:border-slate-400 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/40 p-6 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <Camera className="w-6 h-6 text-slate-400 mb-1.5" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isUploading ? "Uploading..." : "Add field photos"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    JPG, PNG, WEBP, or PDF up to 25MB (EXIF GPS auto-extracted)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    disabled={!isEditable || isUploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Attachments List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
                {(inspection.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        <InspectionAttachmentThumbnail
                          inspectionId={id!}
                          attachmentId={att.id}
                          fileName={att.fileName}
                        />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                          {att.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : "Attachment"}
                          {att.latitude != null && att.longitude != null && (
                            <span className="text-emerald-700 dark:text-emerald-400 ml-1.5 font-mono">
                              GPS: {att.latitude.toFixed(2)}°, {att.longitude.toFixed(2)}°
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        className="p-1 hover:text-indigo-600 text-slate-400 cursor-pointer"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => deleteAttMutation.mutate(att.id)}
                          disabled={deleteAttMutation.isPending}
                          className="p-1 hover:text-red-600 text-slate-400 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── CLIENT FIELD REP JOINT VERIFICATION CARD ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Joint Field Verification &amp; Client Representative Sign-Off
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Field Compliance
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Client Field Representative
              </span>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-800 dark:text-slate-200">
                {formData.clientRepName || "Client Representative (Specified in RFQ)"}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Contact Phone / WhatsApp
              </span>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200">
                {formData.clientRepPhone || "N/A"}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Designated Inspection Site Gate
              </span>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-800 dark:text-slate-200 truncate">
                {formData.siteAddress || formData.siteName || "Plant Access Gate"}
              </div>
            </div>
          </div>
        </div>

        {/* ── STICKY ACTION FOOTER ── */}
        <div className="sticky bottom-4 z-30 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="accept-certification"
              disabled={!isEditable}
              checked={Boolean(formData.accepted)}
              onChange={(e) => setFormData({ ...formData, accepted: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-700 accent-[#065f46] cursor-pointer shrink-0"
            />
            <label
              htmlFor="accept-certification"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-tight"
            >
              I confirm and certify that all site inspection information, GPS coordinates, haulage distances, and waste specifications provided herein are accurate and reflect real ground conditions.
            </label>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Preview PDF Report</span>
            </button>

            {isEditable && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveDraftMutation.isPending ? "Saving..." : "Save as Draft"}</span>
              </button>
            )}

            {isEditable && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#065f46] hover:bg-[#047857] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
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
    </div>

    {/* Route Map Modal */}
    {showRouteMapModal && (() => {
      const mapBase = availableBases.find((b) => b.id === formData.baseId);
      const mapBaseLat = mapBase?.latitude || 27.0;
      const mapBaseLng = mapBase?.longitude || 49.65;
      const mapSiteLat = Number(formData.latitude) || mapBaseLat;
      const mapSiteLng = Number(formData.longitude) || mapBaseLng;

      const minLat = (Math.min(mapBaseLat, mapSiteLat) - 0.25).toFixed(4);
      const maxLat = (Math.max(mapBaseLat, mapSiteLat) + 0.25).toFixed(4);
      const minLng = (Math.min(mapBaseLng, mapSiteLng) - 0.25).toFixed(4);
      const maxLng = (Math.max(mapBaseLng, mapSiteLng) + 0.25).toFixed(4);

      const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${mapSiteLat}%2C${mapSiteLng}`;
      const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${mapBaseLat},${mapBaseLng}&destination=${mapSiteLat},${mapSiteLng}&travelmode=driving`;
      const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${mapBaseLat}%2C${mapBaseLng}%3B${mapSiteLat}%2C${mapSiteLng}`;

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Mobilization Route Corridor Map</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      {formData.mobilizationKm || 0} KM
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {mapBase?.name || "Operations Base"} → {formData.siteName || "Client Site"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRouteMapModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Map View Column (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-2 min-h-[320px] lg:min-h-[440px]">
                <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-inner">
                  <iframe
                    title="Mobilization Route Corridor Map"
                    src={osmEmbedUrl}
                    className="w-full h-full min-h-[320px] lg:min-h-[440px] border-0"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>© OpenStreetMap contributors</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      Open in Google Maps ↗
                    </a>
                    <a
                      href={osmDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      Open in OpenStreetMap ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* Turn-by-Turn Corridor Column (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                {/* Metrics summary banner */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Haulage</span>
                    <span className="text-sm font-black font-mono text-emerald-800 dark:text-emerald-300">
                      {formData.mobilizationKm || 0} km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Speed Cap</span>
                    <span className="text-sm font-black font-mono text-blue-800 dark:text-blue-300">
                      {formData.speedLimitKmh || 80} km/h
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Est. Drive</span>
                    <span className="text-sm font-black font-mono text-indigo-800 dark:text-indigo-300">
                      {Math.floor(((Number(formData.mobilizationKm) || 0) / (formData.speedLimitKmh || 80)))}h{" "}
                      {Math.round((((Number(formData.mobilizationKm) || 0) / (formData.speedLimitKmh || 80)) % 1) * 60)}m
                    </span>
                  </div>
                </div>

                {/* Turn-by-Turn Corridor Breakdown */}
                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Highway Corridors</span>
                    <span className="text-[10px] text-slate-400 lowercase font-normal">
                      {routeSteps.length > 0 ? `${routeSteps.length} segments` : "corridor view"}
                    </span>
                  </h4>
                  <div className="overflow-y-auto max-h-[260px] space-y-2 pr-1 text-xs">
                    {/* Origin */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div className="flex-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block text-[11px]">
                          Departure: {mapBase?.name || "Assigned Base"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {mapBaseLat.toFixed(4)}°, {mapBaseLng.toFixed(4)}°
                        </span>
                      </div>
                    </div>

                    {/* Steps */}
                    {routeSteps.length > 0 ? (
                      routeSteps.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 font-bold">#{sIdx + 1}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200 text-[11px]">{step.road}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300 text-[10px] shrink-0">
                            {step.distanceKm} km
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        {formData.mobilizationRoute || "Direct Highway Corridor"}
                      </div>
                    )}

                    {/* Destination */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                      <div className="flex-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block text-[11px]">
                          Arrival: {formData.siteName || "Client Inspection Site"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {mapSiteLat.toFixed(4)}°, {mapSiteLng.toFixed(4)}°
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRouteMapModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Close Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

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
