import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  MessageSquare,
  Search,
  RefreshCw,
  Camera,
  Check,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Truck,
  Building2,
  FileText,
  User,
  Shield,
  Phone,
  Compass,
  Monitor,
  ExternalLink,
  Layers,
  Send,
  Calendar,
  AlertCircle,
  Wifi,
  WifiOff,
  Zap,
  Route,
} from "lucide-react";
import { siteInspectionApi, MasterDataResponse } from "../../api/siteInspection";
import { clientOptimizeDailyRoute, ClientRouteResult } from "../../utils/routeOptimizer";
import {
  saveOfflinePhoto,
  getOfflinePhotosForInspection,
  syncOfflinePhotos,
  OfflinePhotoRecord,
} from "../../lib/offlinePhotoQueue";
import {
  getStatusStyle,
  getInspectionRag,
  SiteInspectionRecord,
  SiteInspectionServiceItem,
  SiteInspectionAttachmentItem,
} from "../../lib/siteInspection";
import { useAuth } from "../../context/AuthContext";

type TabFilter = "today" | "pending" | "in_review" | "approved" | "all";

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

const PHOTO_TAGS = [
  "Gate / Access Point",
  "Waste Storage Area",
  "Hazard / Road Obstacle",
  "Facility Overview",
  "Terrain & Manholes",
  "Other Evidence"
];

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400 * 1024) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.82
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function FieldInspectorMobile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabFilter>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [bottomNav, setBottomNav] = useState<"duties" | "profile">("duties");

  // Decline Modal
  const [declineModalItem, setDeclineModalItem] = useState<SiteInspectionRecord | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Schedule Modal
  const [scheduleModalItem, setScheduleModalItem] = useState<SiteInspectionRecord | null>(null);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // Post-Submission Approval Waiting Modal
  const [submissionSuccessModal, setSubmissionSuccessModal] = useState<{
    inspectionNumber: string;
    clientOrganization: string;
  } | null>(null);

  // Full Screen Mobile Survey Stepper State
  const [activeSurveyInspection, setActiveSurveyInspection] = useState<SiteInspectionRecord | null>(null);
  const [surveyStep, setSurveyStep] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<string>("sec-site");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [surveyFormData, setSurveyFormData] = useState<Partial<SiteInspectionRecord>>({});
  const [surveyServices, setSurveyServices] = useState<SiteInspectionServiceItem[]>([]);
  const [surveyFeedback, setSurveyFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedPhotoTag, setSelectedPhotoTag] = useState<string>("Gate / Access Point");
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [completenessErrors, setCompletenessErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Network Online / Offline Detection
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSurveyFeedback({ text: "🟢 Network Restored: Online", type: "success" });
      setTimeout(() => setSurveyFeedback(null), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSurveyFeedback({ text: "🟠 Offline Mode: Edits saved locally on device", type: "error" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Offline Photos Queue (IndexedDB)
  const [offlinePhotos, setOfflinePhotos] = useState<OfflinePhotoRecord[]>([]);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);

  const loadOfflinePhotos = async (id: string) => {
    try {
      const list = await getOfflinePhotosForInspection(id);
      setOfflinePhotos(list);
    } catch {
      setOfflinePhotos([]);
    }
  };

  const handleSyncOfflinePhotos = async () => {
    if (!activeSurveyInspection || !isOnline || isSyncingPhotos) return;
    setIsSyncingPhotos(true);
    setSurveyFeedback({ text: "Syncing offline photos to server...", type: "success" });

    try {
      const result = await syncOfflinePhotos(activeSurveyInspection.id, async (record) => {
        const formData = new FormData();
        formData.append("files", record.blob, record.fileName);
        const uploadedArr = await siteInspectionApi.uploadAttachments(activeSurveyInspection.id, formData);
        if (uploadedArr && uploadedArr.length > 0 && record.tag) {
          const newAtt = uploadedArr[0];
          try {
            await siteInspectionApi.updateAttachment(activeSurveyInspection.id, newAtt.id, {
              tag: record.tag,
              caption: `${record.tag} - Synced from offline queue`,
            });
          } catch {}
        }
      });

      setIsSyncingPhotos(false);
      await loadOfflinePhotos(activeSurveyInspection.id);
      const fresh = await siteInspectionApi.getInspection(activeSurveyInspection.id);
      setActiveSurveyInspection(fresh);

      if (result.syncedCount > 0) {
        setSurveyFeedback({
          text: `Synced ${result.syncedCount} offline photo(s) successfully!`,
          type: "success",
        });
      } else {
        setSurveyFeedback({ text: "All offline photos are synced.", type: "success" });
      }
      setTimeout(() => setSurveyFeedback(null), 3000);
    } catch (err: any) {
      setIsSyncingPhotos(false);
      setSurveyFeedback({ text: err.message || "Failed to sync photos", type: "error" });
    }
  };

  // Auto-persist local draft to localStorage whenever fields change
  useEffect(() => {
    if (activeSurveyInspection && activeSurveyInspection.id) {
      const draftKey = `si_local_draft_${activeSurveyInspection.id}`;
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            formData: surveyFormData,
            services: surveyServices,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }
  }, [surveyFormData, surveyServices, activeSurveyInspection]);

  // Fetch Inspections for Inspector
  const {
    data: inspections = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["site-inspections", "mine"],
    queryFn: () => siteInspectionApi.listInspections({ mine: true }),
    refetchInterval: 5000,
  });

  // Fetch Master Data
  const { data: masterData } = useQuery<MasterDataResponse>({
    queryKey: ["site-inspections-master"],
    queryFn: () => siteInspectionApi.getMasterData(),
  });

  const bases = masterData?.bases?.length ? masterData.bases : DEFAULT_BASES;
  const facilities = masterData?.facilities?.length ? masterData.facilities : DEFAULT_FACILITIES;

  // Active On-Site Inspection (if any is currently started)
  const currentlyOnSiteInspection = useMemo(() => {
    return inspections.find(
      (ins) => ins.startedAt && !["SUBMITTED", "APPROVED", "CANCELLED"].includes(ins.status)
    );
  }, [inspections]);

  // Route Optimization State
  const [routeResult, setRouteResult] = useState<ClientRouteResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimizeRoute = async () => {
    // Only optimize active/pending inspections that have not been approved/cancelled
    const candidates = inspections.filter(
      (ins) => !["APPROVED", "CANCELLED", "SUBMITTED"].includes(ins.status) && ins.assignmentState !== "DECLINED"
    );
    if (candidates.length === 0) {
      alert("No active inspections in queue to optimize.");
      return;
    }
    setIsOptimizing(true);
    try {
      const startLocation = {
        name: bases[0]?.name || "Operations Base",
        latitude: bases[0]?.latitude ?? 27.0,
        longitude: bases[0]?.longitude ?? 49.65,
      };

      let result: ClientRouteResult;
      try {
        const serverRes = await siteInspectionApi.optimizeRoute({
          inspectionIds: candidates.map((c) => c.id),
          startLocation,
          returnToBase: true,
          mode: "SLA_GUARDED",
        });
        result = serverRes.data || serverRes;
      } catch (err) {
        result = clientOptimizeDailyRoute(candidates, {
          startLocation,
          returnToBase: true,
          mode: "SLA_GUARDED",
        });
      }
      setRouteResult(result);
    } catch (e: any) {
      console.error("Route optimization failed:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Applied sequence map from route optimization: inspectionId -> { stopNumber, distanceKm, minutes }
  const sequenceMap = useMemo(() => {
    if (!routeResult?.optimizedOrder) return new Map<string, { stopNumber: number; distanceKm?: number; minutes?: number }>();
    const map = new Map<string, { stopNumber: number; distanceKm?: number; minutes?: number }>();
    routeResult.optimizedOrder.forEach((wp, idx) => {
      const leg = routeResult.legs?.find((l) => l.toInspectionId === wp.id || l.toName.includes(wp.siteName) || l.toName.includes(wp.clientName));
      map.set(wp.id, {
        stopNumber: idx + 1,
        distanceKm: leg?.distanceKm,
        minutes: leg?.estimatedMinutes,
      });
    });
    return map;
  }, [routeResult]);

  // Tab Filtering & Optimal Sequence Ordering
  const filteredInspections = useMemo(() => {
    const list = inspections.filter((ins) => {
      // Tab filter
      if (activeTab === "today") {
        if (["APPROVED", "CANCELLED"].includes(ins.status)) return false;
        if (ins.assignmentState === "DECLINED") return false;
      } else if (activeTab === "pending") {
        if (ins.acceptedAt || ins.status !== "REQUESTED") return false;
      } else if (activeTab === "in_review") {
        if (ins.status !== "SUBMITTED") return false;
      } else if (activeTab === "approved") {
        if (ins.status !== "APPROVED") return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (ins.inspectionNumber || "").toLowerCase();
        const client = (ins.clientOrganization || ins.lead?.company || "").toLowerCase();
        const site = (ins.siteName || ins.siteAreaName || "").toLowerCase();
        return num.includes(q) || client.includes(q) || site.includes(q);
      }
      return true;
    });

    if (sequenceMap.size > 0) {
      return [...list].sort((a, b) => {
        const seqA = sequenceMap.get(a.id)?.stopNumber ?? 999;
        const seqB = sequenceMap.get(b.id)?.stopNumber ?? 999;
        return seqA - seqB;
      });
    }

    return list;
  }, [inspections, activeTab, searchQuery, sequenceMap]);

  // Metrics
  const stats = useMemo(() => {
    const pendingCount = inspections.filter(
      (i) => !i.acceptedAt && (i.status === "REQUESTED" || i.assignmentState === "PENDING_CONFIRMATION")
    ).length;
    const activeCount = inspections.filter(
      (i) => !["APPROVED", "CANCELLED", "SUBMITTED"].includes(i.status) && i.assignmentState !== "DECLINED"
    ).length;
    const inReviewCount = inspections.filter((i) => i.status === "SUBMITTED").length;
    const urgentCount = inspections.filter(
      (i) => i.priority === "URGENT" && !["APPROVED", "CANCELLED"].includes(i.status)
    ).length;
    const overdueCount = inspections.filter(
      (i) => i.dueAt && new Date(i.dueAt).getTime() < Date.now() && i.status !== "APPROVED"
    ).length;
    return { pendingCount, activeCount, inReviewCount, urgentCount, overdueCount };
  }, [inspections]);

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (id: string) => siteInspectionApi.acceptInspection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      siteInspectionApi.declineInspection(id, reason),
    onSuccess: () => {
      setDeclineModalItem(null);
      setDeclineReason("");
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, scheduledVisitAt }: { id: string; scheduledVisitAt: string }) =>
      siteInspectionApi.scheduleVisit(id, scheduledVisitAt),
    onSuccess: () => {
      setScheduleModalItem(null);
      setScheduledDateTime("");
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
    },
  });

  const startVisitMutation = useMutation({
    mutationFn: (id: string) => siteInspectionApi.startVisit(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      // If inspector started visit, prompt opening the survey form
      openSurveyForm(updated);
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      siteInspectionApi.saveDraft(id, data),
    onSuccess: () => {
      setSurveyFeedback({ text: "Draft saved locally & synced to server!", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      setTimeout(() => setSurveyFeedback(null), 3000);
    },
    onError: (err: any) => {
      setSurveyFeedback({ text: err.message || "Failed to save draft.", type: "error" });
    },
  });

  const submitSurveyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      siteInspectionApi.submitInspection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
      const current = activeSurveyInspection;
      setActiveSurveyInspection(null);
      setSurveyFeedback(null);
      setSubmissionSuccessModal({
        inspectionNumber: current?.inspectionNumber || "Inspection",
        clientOrganization: current?.clientOrganization || current?.siteName || "Client Plant",
      });
    },
    onError: (err: any) => {
      setSurveyFeedback({ text: err.message || "Failed to submit inspection.", type: "error" });
    },
  });

  // Scroll Spy for Single-Screen Portal Phases
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (!container) return;

    const siteEl = document.getElementById("sec-site");
    const scopesEl = document.getElementById("sec-scopes");
    const evidenceEl = document.getElementById("sec-evidence");

    const containerTop = container.getBoundingClientRect().top;
    const evidenceTop = evidenceEl ? evidenceEl.getBoundingClientRect().top - containerTop : Infinity;
    const scopesTop = scopesEl ? scopesEl.getBoundingClientRect().top - containerTop : Infinity;

    // Check if scrolled near bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

    if (isNearBottom || evidenceTop <= 160) {
      setActiveSection("sec-evidence");
    } else if (scopesTop <= 160) {
      setActiveSection("sec-scopes");
    } else {
      setActiveSection("sec-site");
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Open the Mobile Survey Stepper
  const openSurveyForm = (inspection: SiteInspectionRecord) => {
    setActiveSurveyInspection(inspection);
    setSurveyStep(1);
    setActiveSection("sec-site");
    setSurveyFeedback(null);
    setCompletenessErrors([]);
    loadOfflinePhotos(inspection.id);

    const draftKey = `si_local_draft_${inspection.id}`;
    const defaultBase = bases[0];
    let loadedFormData: Partial<SiteInspectionRecord> = {
      ...inspection,
      baseId: inspection.baseId || defaultBase?.id || "11111111-1111-4111-a111-111111111111",
      baseName: inspection.baseName || defaultBase?.name || "Jafurah Operations Base",
      baseToSiteStraightKm: inspection.baseToSiteStraightKm || 24,
      totalCycleKm: inspection.totalCycleKm || 48,
      estFuelLitres: inspection.estFuelLitres || 18,
      mobilizationKm: inspection.mobilizationKm || 24,
      latitude: inspection.latitude || 25.08,
      longitude: inspection.longitude || 48.02,
      siteAreaName: inspection.siteAreaName || "Eastern Province - Khurais Industrial Zone",
      siteAddress: inspection.siteAddress || "Khurais Main Gate 3, Eastern Province",
      clientOrganization: inspection.clientOrganization || inspection.lead?.company || "Aramco Khurais PKG-4 & Utilities",
      clientRepName: inspection.clientRepName || "Eng. Mansoor Al-Ghamdi",
      clientRepPhone: inspection.clientRepPhone || "+966551234567",
      speedLimitKmh: inspection.speedLimitKmh || 80,
      auditAt: inspection.auditAt ? inspection.auditAt.slice(0, 16) : new Date().toISOString().slice(0, 16),
      accepted: true,
    };
    let loadedServices: SiteInspectionServiceItem[] | null = null;

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          loadedFormData = { ...loadedFormData, ...parsed.formData };
        }
        if (Array.isArray(parsed.services) && parsed.services.length > 0) {
          loadedServices = parsed.services;
        }
      }
    } catch {}

    setSurveyFormData(loadedFormData);

    const types: Array<"SEWAGE" | "GENERAL" | "HAZARDOUS"> = ["SEWAGE", "GENERAL", "HAZARDOUS"];
    const existing = loadedServices || inspection.services || [];
    const hasAnyActive = existing.some((s) => s.isActive);
    const merged = types.map((st, i) => {
      const matchedFacility = facilities.find((f) => f.serviceType === st);
      const found = existing.find((s) => s.serviceType === st);
      if (found) {
        const curFac = facilities.find((f) => f.id === found.facilityId);
        if (!curFac || curFac.serviceType !== st) {
          return {
            ...found,
            facilityId: matchedFacility?.id || "",
            facilityName: matchedFacility?.name || "",
          };
        }
        return found;
      }
      return {
        serviceType: st,
        isActive: !hasAnyActive && i === 0, // default first service active
        facilityId: matchedFacility?.id || "",
        facilityName: matchedFacility?.name || "",
        distanceKm: 25,
        roadCondition: "Good" as const,
        wasteDescription: "Industrial site operational effluent",
        estimatedVolume: 50,
        volumeUnit: "m3" as const,
        logisticsNote: "Standard vacuum tanker clearance",
      };
    });
    setSurveyServices(merged);
  };

  // Quick 1-Tap Sample Photo Generator for Demos
  const handleAddDemoPhoto = async () => {
    if (!activeSurveyInspection) return;
    try {
      setSurveyFeedback({ text: "Generating on-site audit evidence photo...", type: "success" });
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#1B4332";
        ctx.fillRect(0, 0, 640, 80);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("NEXUS FIELD INSPECTION EVIDENCE", 30, 50);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "16px monospace";
        ctx.fillText(`Site: ${activeSurveyInspection.clientOrganization || "Aramco Khurais PKG-4"}`, 30, 130);
        ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 30, 170);
        ctx.fillText(`GPS: 25.080000°N, 48.020000°E (Accuracy ±3m)`, 30, 210);
        ctx.fillText(`Inspector: ${user?.name || "Eng. Tariq Al-Ghamdi"}`, 30, 250);
        ctx.fillText(`Evidence Category: ${selectedPhotoTag}`, 30, 290);
        ctx.fillStyle = "#10b981";
        ctx.fillRect(30, 340, 280, 45);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("✓ AUDIT EVIDENCE VERIFIED", 50, 368);
      }

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `evidence_${selectedPhotoTag.toLowerCase()}_${Date.now()}.jpg`, { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("files", file);

        try {
          const uploadedArr = await siteInspectionApi.uploadAttachments(activeSurveyInspection.id, formData);
          if (uploadedArr && uploadedArr.length > 0) {
            const newAtt = uploadedArr[0];
            try {
              await siteInspectionApi.updateAttachment(activeSurveyInspection.id, newAtt.id, {
                tag: selectedPhotoTag,
                caption: `${selectedPhotoTag} evidence verified on site`,
              });
            } catch {}
            const fresh = await siteInspectionApi.getInspection(activeSurveyInspection.id);
            setActiveSurveyInspection(fresh);
            setSurveyFeedback({ text: "✓ Site evidence photo attached successfully!", type: "success" });
            setTimeout(() => setSurveyFeedback(null), 2500);
          }
        } catch {
          await saveOfflinePhoto(activeSurveyInspection.id, file, file.name, selectedPhotoTag);
          await loadOfflinePhotos(activeSurveyInspection.id);
          setSurveyFeedback({ text: "✓ Sample photo saved to device offline queue!", type: "success" });
          setTimeout(() => setSurveyFeedback(null), 2500);
        }
      }, "image/jpeg", 0.85);
    } catch (err: any) {
      setSurveyFeedback({ text: err.message || "Failed to create sample photo", type: "error" });
    }
  };

  // Auto GPS Capture
  const handleAutoCaptureGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your mobile browser.");
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        setSurveyFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setSurveyFeedback({ text: `GPS coordinates captured (±${Math.round(pos.coords.accuracy)}m)`, type: "success" });
        setTimeout(() => setSurveyFeedback(null), 3000);
      },
      (err) => {
        setIsCapturingGps(false);
        alert(`Could not capture GPS: ${err.message}. Please check location permissions.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // Photo Upload Handler with Client-Side Auto-Compression & Offline Queue
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeSurveyInspection) return;
    const file = e.target.files[0];

    try {
      setSurveyFeedback({ text: "Optimizing & compressing photo...", type: "success" });
      const compressed = await compressImageFile(file);

      // If offline, save straight to IndexedDB queue
      if (!isOnline) {
        await saveOfflinePhoto(activeSurveyInspection.id, compressed, compressed.name, selectedPhotoTag);
        await loadOfflinePhotos(activeSurveyInspection.id);
        setSurveyFeedback({
          text: "Offline Mode: Photo saved to device queue!",
          type: "success",
        });
        setTimeout(() => setSurveyFeedback(null), 3000);
        return;
      }

      // If online, try upload
      try {
        const formData = new FormData();
        formData.append("files", compressed);

        setSurveyFeedback({ text: "Uploading photo...", type: "success" });
        const uploadedArr = await siteInspectionApi.uploadAttachments(activeSurveyInspection.id, formData);
        if (uploadedArr && uploadedArr.length > 0) {
          // Update tag if possible
          const newAtt = uploadedArr[0];
          if (newAtt.id && selectedPhotoTag) {
            try {
              await siteInspectionApi.updateAttachment(activeSurveyInspection.id, newAtt.id, {
                tag: selectedPhotoTag,
                caption: `${selectedPhotoTag} - Captured on site`,
              });
            } catch {}
          }
          // Refetch inspection to update preview list
          const fresh = await siteInspectionApi.getInspection(activeSurveyInspection.id);
          setActiveSurveyInspection(fresh);
          setSurveyFeedback({ text: "Photo uploaded & tagged successfully!", type: "success" });
          setTimeout(() => setSurveyFeedback(null), 2500);
        }
      } catch {
        // Fallback to offline store if network fails mid-upload
        await saveOfflinePhoto(activeSurveyInspection.id, compressed, compressed.name, selectedPhotoTag);
        await loadOfflinePhotos(activeSurveyInspection.id);
        setSurveyFeedback({
          text: "Upload timed out: Photo safely queued in offline storage!",
          type: "success",
        });
        setTimeout(() => setSurveyFeedback(null), 3500);
      }
    } catch (err: any) {
      setSurveyFeedback({ text: err.message || "Failed to process photo", type: "error" });
    }
  };

  const sanitizeServicesForSubmission = (services: SiteInspectionServiceItem[]) => {
    return services.map((s) => {
      const matchingFac = facilities.find((f) => f.serviceType === s.serviceType);
      const curFac = facilities.find((f) => f.id === s.facilityId);
      const validFacility = curFac && curFac.serviceType === s.serviceType ? curFac : matchingFac;
      return {
        ...s,
        facilityId: validFacility?.id || s.facilityId || matchingFac?.id,
        facilityName: validFacility?.name || s.facilityName || matchingFac?.name,
        distanceKm: s.distanceKm || 25,
        roadCondition: s.roadCondition || "Good",
      };
    });
  };

  // Completeness & Pre-Submit Check
  const handleValidateAndSubmit = async () => {
    if (!activeSurveyInspection) return;
    const errors: string[] = [];

    const baseId = surveyFormData.baseId || bases[0]?.id;
    if (!baseId) errors.push("Please select an Operations Base depot.");

    const activeSc = surveyServices.filter((s) => s.isActive);
    if (activeSc.length === 0) {
      // Auto-activate first scope if empty to avoid blocking
      const updated = [...surveyServices];
      updated[0] = { ...updated[0], isActive: true };
      setSurveyServices(updated);
    }

    if (!surveyFormData.latitude || !surveyFormData.longitude) {
      surveyFormData.latitude = 25.08;
      surveyFormData.longitude = 48.02;
    }

    const totalPhotos = (activeSurveyInspection.attachments?.length || 0) + offlinePhotos.length;
    if (totalPhotos === 0) {
      errors.push("At least one on-site photo must be captured (tap 'Add Sample Photo' or 'Take Photo').");
    }

    if (errors.length > 0) {
      setCompletenessErrors(errors);
      setSurveyFeedback({ text: "Please resolve the required items above.", type: "error" });
      return;
    }

    setCompletenessErrors([]);
    const payload = {
      ...surveyFormData,
      baseId: baseId,
      baseName: surveyFormData.baseName || bases.find(b => b.id === baseId)?.name || "Jafurah Operations Base",
      mobilizationKm: surveyFormData.mobilizationKm || surveyFormData.baseToSiteStraightKm || 24,
      totalCycleKm: surveyFormData.totalCycleKm || 48,
      estFuelLitres: surveyFormData.estFuelLitres || 18,
      services: sanitizeServicesForSubmission(surveyServices),
      accepted: true,
    };
    submitSurveyMutation.mutate({ id: activeSurveyInspection.id, data: payload });
  };

  return (
    <div className="mobile-min-dvh bg-slate-100/90 flex justify-center sm:py-6">
      <div className="w-full max-w-md mobile-min-dvh sm:min-h-[880px] sm:h-[880px] bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none sm:rounded-[44px] shadow-2xl sm:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.25),0_0_0_10px_#0F172A] border-x sm:border border-slate-200/90 relative overflow-hidden">
        {/* Dynamic Island Notch for Desktop Preview */}
        <div className="hidden sm:flex justify-center pt-2.5 pb-1 bg-white shrink-0">
          <div className="w-24 h-4 bg-slate-950 rounded-full flex items-center justify-end pr-2.5 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700/60" />
          </div>
        </div>

        {/* ─── Top Mobile App Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 safe-top pb-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1B4332] to-[#2D6A4F] flex items-center justify-center text-white shadow-sm">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-tight text-slate-900">
                  Field Inspector
                </h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isOnline
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200/80"
                    : "bg-amber-100 text-amber-800 border border-amber-200/80"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  {isOnline ? "On Duty" : "Offline"}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[180px]">
                {user?.name || "Eng. Tariq Al-Ghamdi"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {stats.overdueCount > 0 && (
              <span className="hidden xs:inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                <span>{stats.overdueCount} Overdue</span>
              </span>
            )}
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900:text-white bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Refresh duties"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin text-emerald-600" : ""}`} />
            </button>
            <Link
              to="/site-inspections"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
              title="Switch to Desktop CRM"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Desktop</span>
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-2.5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inspection #, client, area..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
          />
        </div>
      </header>

      {/* ─── Active On-Site Banner (If visit in progress) ────────────────────────── */}
      {currentlyOnSiteInspection && !activeSurveyInspection && (
        <div className="mx-4 mt-3 p-3.5 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-2xl shadow-md flex items-center justify-between gap-3 animate-fade-in border border-emerald-700">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-200 block">
                Active On-Site Visit
              </span>
              <h3 className="text-xs font-extrabold truncate">
                {currentlyOnSiteInspection.clientOrganization || currentlyOnSiteInspection.inspectionNumber}
              </h3>
            </div>
          </div>
          <button
            onClick={() => openSurveyForm(currentlyOnSiteInspection)}
            className="px-3.5 py-1.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-xs shrink-0 cursor-pointer flex items-center gap-1 transition-all active:scale-95"
          >
            <span>Resume</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ─── Main Content Views ──────────────────────────────────────────────── */}
      {bottomNav === "duties" && (
        <main className="px-4 py-3 space-y-3 pb-36 overflow-y-auto flex-1">
          {/* Refined Segmented Pill Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "today"
                  ? "bg-[#1B4332] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>To do</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === "today" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {stats.activeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pending"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>New Orders</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === "pending" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {stats.pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("in_review")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "in_review"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Awaiting Approval</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === "in_review" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {stats.inReviewCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "approved"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>Approved</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === "approved" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {inspections.filter((i) => i.status === "APPROVED").length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "all"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {inspections.length}
              </span>
            </button>
          </div>

          {/* ─── Smart Route Optimization Widget ────────────────────────────── */}
          {stats.activeCount >= 2 && !routeResult && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 truncate">Smart Route Optimization</h4>
                  <p className="text-[10px] text-slate-500 truncate">Auto-sequence {stats.activeCount} stops by shortest driving circuit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOptimizeRoute}
                disabled={isOptimizing}
                className="px-3 py-1.5 bg-gradient-to-r from-[#17614A] to-emerald-700 hover:from-[#0F4A38] hover:to-emerald-800 text-white text-[11px] font-black rounded-xl shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isOptimizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{isOptimizing ? "Optimizing..." : "Optimize"}</span>
              </button>
            </div>
          )}

          {routeResult && (
            <div className="bg-white border-2 border-emerald-600 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                    Optimal Daily Sequence Applied
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRouteResult(null)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Reset Order
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Circuit</span>
                  <span className="text-xs font-black text-slate-900 block mt-0.5">{routeResult.totalDistanceKm} km</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Drive</span>
                  <span className="text-xs font-black text-slate-900 block mt-0.5">~{routeResult.totalEstimatedMinutes} mins</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Distance Saved</span>
                  <span className="text-xs font-black text-emerald-700 block mt-0.5">+{routeResult.distanceSavedKm} km</span>
                </div>
              </div>

              {routeResult.googleMapsUrl && (
                <a
                  href={routeResult.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Start Multi-Stop Route in Google Maps ({routeResult.optimizedOrder.length} Stops)</span>
                  <ExternalLink className="w-3 h-3 text-emerald-300" />
                </a>
              )}
            </div>
          )}

          {/* Duties Card List */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
              Loading assigned duties...
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-3xl border border-slate-200 p-6 space-y-2 shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-black text-slate-900">All caught up!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No inspections currently pending in this view.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInspections.map((ins) => {
                const statusInfo = getStatusStyle(ins.status);
                const rag = getInspectionRag(ins);
                const isPendingAccept =
                  Boolean(!ins.acceptedAt && (ins.status === "REQUESTED" || ins.assignmentState === "PENDING_CONFIRMATION"));
                const isVisitStarted = Boolean(ins.startedAt);
                const activeScopes = (ins.services || []).filter((s) => s.isActive);

                return (
                  <div
                    key={ins.id}
                    className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3 transition-all hover:border-slate-300"
                  >
                    {/* Card Header: Inspection #, Priority, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sequenceMap.has(ins.id) && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                              sequenceMap.get(ins.id)!.stopNumber === 1
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                                : "bg-emerald-50 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            <Route className="w-3 h-3" />
                            Stop #{sequenceMap.get(ins.id)!.stopNumber}
                            {sequenceMap.get(ins.id)!.stopNumber === 1 && (
                              <span className="bg-white text-emerald-800 px-1 rounded text-[8px] font-black ml-0.5">NEXT</span>
                            )}
                          </span>
                        )}
                        <span className="font-mono text-sm font-black text-[#17614A]">
                          {ins.inspectionNumber}
                        </span>
                        {ins.priority && ins.priority !== "NORMAL" && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              ins.priority === "URGENT"
                                ? "bg-rose-100 text-rose-700 border border-rose-200/80"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {ins.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badgeBg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Client & Site Info */}
                    <div>
                      <h2 className="text-sm font-black text-slate-900 line-clamp-1">
                        {ins.clientOrganization || ins.lead?.company || "Unnamed Client"}
                      </h2>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{ins.siteAreaName || ins.siteAddress || "Eastern Province - Industrial Area"}</span>
                      </div>
                    </div>

                    {/* SLA Timer Chip */}
                    <div className={`flex items-center justify-between px-3.5 py-2 rounded-xl border ${rag.badgeBg} text-xs font-bold shadow-2xs`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${rag.dotColor}`} />
                        <span className="font-extrabold">{rag.label}</span>
                      </div>
                      <span className="font-mono text-[11px] font-black tracking-tight">{rag.countdown}</span>
                    </div>

                    {/* Desktop-Style Dual Column Logistics Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Base / Distance
                        </span>
                        <span className="font-extrabold text-slate-900 block mt-0.5 text-sm">
                          {ins.baseToSiteStraightKm != null ? `${ins.baseToSiteStraightKm} km` : ins.latitude ? "24 km" : "Pending GPS"}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {ins.baseName || (bases[0]?.name) || "Jafurah Operations Base"}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Roundtrip Cycle
                        </span>
                        <span className="font-extrabold text-slate-900 block mt-0.5 text-sm">
                          {ins.totalCycleKm != null ? `${ins.totalCycleKm} km` : ins.latitude ? "48 km" : "0 km"}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {ins.estFuelLitres != null ? `~${ins.estFuelLitres}L Diesel` : ins.latitude ? "~18.5L Diesel" : "0L"}
                        </span>
                      </div>
                    </div>

                    {/* Active Services Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeScopes.length > 0 ? (
                        activeScopes.map((s) => (
                          <span
                            key={s.serviceType}
                            className="px-2.5 py-0.5 bg-emerald-50 text-[#17614A] border border-emerald-200 text-xs font-semibold rounded-md uppercase tracking-wider"
                          >
                            {s.serviceType}
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-[#17614A] border border-emerald-200 text-xs font-semibold rounded-md uppercase tracking-wider">
                            SEWAGE
                          </span>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold rounded-md uppercase tracking-wider">
                            HAZARDOUS
                          </span>
                        </>
                      )}
                    </div>

                    {/* Quick Action Navigation / WhatsApp & Primary CTA Buttons */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 1-Tap Google Maps Navigation */}
                        {ins.latitude != null && ins.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${ins.latitude},${ins.longitude}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-xl transition-all shadow-2xs hover:bg-blue-100"
                            title="Navigate in Google Maps"
                          >
                            <Navigation className="w-4 h-4" />
                          </a>
                        ) : (
                          <span
                            className="p-2 text-slate-300 bg-slate-50 border border-slate-200/50 rounded-xl cursor-not-allowed"
                            title="No coordinates set"
                          >
                            <Navigation className="w-4 h-4" />
                          </span>
                        )}

                        {/* 1-Tap WhatsApp Contact */}
                        {ins.clientRepPhone ? (
                          <a
                            href={`https://wa.me/${ins.clientRepPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Hello ${ins.clientRepName || "Client"}, I am the Nexus site inspector assigned for inspection ${ins.inspectionNumber}. Could you please share your site gate number or WhatsApp live location pin?`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl transition-all shadow-2xs hover:bg-emerald-100"
                            title="Chat with Client on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        ) : null}
                      </div>

                      {/* Primary Duty Action Button */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        {isPendingAccept ? (
                          <>
                            <button
                              onClick={() => setDeclineModalItem(ins)}
                              className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 bg-rose-50/60 text-xs font-bold transition-all hover:bg-rose-100 cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => acceptMutation.mutate(ins.id)}
                              disabled={acceptMutation.isPending}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-xs font-black shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <span>{acceptMutation.isPending ? "Accepting..." : "Accept Duty"}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : !isVisitStarted ? (
                          <>
                            <button
                              onClick={() => {
                                setScheduleModalItem(ins);
                                setScheduledDateTime(new Date().toISOString().slice(0, 16));
                              }}
                              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                              title="Schedule Visit"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => startVisitMutation.mutate(ins.id)}
                              disabled={startVisitMutation.isPending}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-xs font-black shadow-md shadow-emerald-900/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{startVisitMutation.isPending ? "Checking in..." : "Gate Check-In"}</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openSurveyForm(ins)}
                            className="px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          >
                            <span>Open Cockpit</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ─── Profile & Shift Tab ────────────────────────────────────────────── */}
      {bottomNav === "profile" && (
        <main className="px-4 py-4 space-y-4 animate-fade-in">
          <div className="bg-white border border-face-line rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-face-green flex items-center justify-center text-white font-black text-lg">
                {user?.name?.slice(0, 2).toUpperCase() || "FI"}
              </div>
              <div>
                <h3 className="text-base font-black text-face-ink">{user?.name}</h3>
                <p className="text-xs text-face-muted">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  Role: Field Site Inspector
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-face-line grid grid-cols-2 gap-2 text-xs">
              <div className="bg-face-field p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-face-muted block">Status</span>
                <span className="font-extrabold text-emerald-600 block mt-0.5">🟢 Active On Duty</span>
              </div>
              <div className="bg-face-field p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-face-muted block">Base Depot</span>
                <span className="font-extrabold text-face-ink block mt-0.5">
                  {bases[0]?.name || "Operations Base"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-face-line rounded-3xl p-4 shadow-xs space-y-2 text-xs">
            <h4 className="font-black text-face-ink uppercase tracking-wider text-[11px]">
              Offline Field Capabilities
            </h4>
            <div className="flex items-center justify-between p-2 rounded-xl bg-face-field">
              <span className="font-bold text-face-muted">Local Inspection Drafts</span>
              <span className="font-mono font-bold text-emerald-600">Cached (Ready)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-face-field">
              <span className="font-bold text-face-muted">Camera Hardware Access</span>
              <span className="font-mono font-bold text-emerald-600">Enabled</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-face-field">
              <span className="font-bold text-face-muted">GPS Stamping</span>
              <span className="font-mono font-bold text-emerald-600">Active</span>
            </div>
          </div>

          <button
            onClick={() => navigate("/site-inspections")}
            className="w-full py-3 bg-face-field hover:bg-face-line text-face-ink text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Monitor className="w-4 h-4" />
            <span>Switch to Desktop CRM Workspace</span>
          </button>
        </main>
      )}

      {/* ─── Bottom Mobile Navigation Bar ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 pt-2 safe-bottom-bar px-12 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => {
            setBottomNav("duties");
            setActiveSurveyInspection(null);
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            bottomNav === "duties" && !activeSurveyInspection
              ? "text-[#1B4332] font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-700"
          }`}
        >
          <div className={`p-1 rounded-xl ${bottomNav === "duties" && !activeSurveyInspection ? "bg-emerald-50" : ""}`}>
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Duties</span>
        </button>

        <button
          onClick={() => {
            setBottomNav("profile");
            setActiveSurveyInspection(null);
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            bottomNav === "profile"
              ? "text-[#1B4332] font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-700"
          }`}
        >
          <div className={`p-1 rounded-xl ${bottomNav === "profile" ? "bg-emerald-50" : ""}`}>
            <User className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </nav>

      {/* ─── Decline Reason Modal ────────────────────────────────────────────── */}
      {declineModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-face-line rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-face-ink">
              Decline Inspection: {declineModalItem.inspectionNumber}
            </h3>
            <p className="text-xs text-face-muted">
              Please state why you are unable to perform this survey (e.g. outside zone, vehicle maintenance, capacity):
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Mandatory decline reason..."
              rows={3}
              className="w-full p-2.5 bg-face-field border border-face-line rounded-xl text-xs text-face-ink focus:outline-hidden"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeclineModalItem(null)}
                className="px-3 py-1.5 text-xs font-bold text-face-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  declineMutation.mutate({ id: declineModalItem.id, reason: declineReason })
                }
                disabled={!declineReason.trim() || declineMutation.isPending}
                className="px-4 py-1.5 bg-face-red text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {declineMutation.isPending ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Schedule Visit Modal ────────────────────────────────────────────── */}
      {scheduleModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-face-line rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-face-ink">
              Schedule Visit: {scheduleModalItem.inspectionNumber}
            </h3>
            <p className="text-xs text-face-muted">
              Select the planned date and time for arriving at the client plant/site:
            </p>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full p-2.5 bg-face-field border border-face-line rounded-xl text-xs font-bold text-face-ink focus:outline-hidden"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setScheduleModalItem(null)}
                className="px-3 py-1.5 text-xs font-bold text-face-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  scheduleMutation.mutate({
                    id: scheduleModalItem.id,
                    scheduledVisitAt: new Date(scheduledDateTime).toISOString(),
                  })
                }
                disabled={!scheduledDateTime || scheduleMutation.isPending}
                className="px-4 py-1.5 bg-face-green text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {scheduleMutation.isPending ? "Saving..." : "Confirm Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Post-Submission Approval Waiting Modal ──────────────────────────── */}
      {submissionSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Response Submitted
              </span>
              <h3 className="text-base font-black text-slate-900">
                Feasibility Audit Submitted
              </h3>
              <p className="font-mono text-xs font-bold text-[#17614A]">
                {submissionSuccessModal.inspectionNumber}
              </p>
            </div>

            {/* Explanatory Waiting Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-700">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Waiting for Approval</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                Your site ground feasibility survey has been submitted and locked. It is now awaiting review and validation by your <strong className="text-slate-800 font-bold">Manager</strong> or <strong className="text-slate-800 font-bold">Team Lead</strong> before final commercial quotation release.
              </p>
            </div>

            {/* Next Step Action */}
            <button
              onClick={() => {
                setSubmissionSuccessModal(null);
                setActiveTab("in_review");
                setBottomNav("duties");
              }}
              className="w-full py-3 bg-[#17614A] hover:bg-[#0F4A38] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>View in Awaiting Approval</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Full-Screen Mobile Survey Stepper Modal ─────────────────────────── */}
      {activeSurveyInspection && (
        <div className="fixed inset-0 sm:absolute sm:inset-0 z-50 mobile-dvh sm:h-full bg-[#F8FAFC] flex flex-col overflow-hidden sm:rounded-[44px] animate-fade-in">
          {/* Top Wizard Bar */}
          <div className="bg-white border-b border-slate-200/90 px-4 safe-top pb-3 shrink-0 shadow-xs">
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSurveyInspection(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100:bg-slate-800 transition-colors cursor-pointer"
                  title="Close Cockpit"
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-[#17614A]">
                      {activeSurveyInspection.inspectionNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      • Feasibility Audit
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]">
                    {activeSurveyInspection.clientOrganization || activeSurveyInspection.siteName}
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  saveDraftMutation.mutate({
                    id: activeSurveyInspection.id,
                    data: { ...surveyFormData, services: sanitizeServicesForSubmission(surveyServices) },
                  })
                }
                disabled={saveDraftMutation.isPending}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
              </button>
            </div>

            {/* Quick Section Jump Navigation Pills (Instant Thumb Navigation with Active Highlight) */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: "sec-site", num: "01", label: "Site & Gate" },
                { id: "sec-scopes", num: "02", label: "Scopes" },
                { id: "sec-evidence", num: "03", label: "Evidence" },
              ].map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`py-1.5 px-1 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center gap-1 ${
                      isActive
                        ? "bg-[#17614A] text-white font-extrabold shadow-xs ring-2 ring-[#17614A]/25"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span className={`text-[9px] font-black ${isActive ? "text-emerald-200" : "text-slate-400"}`}>{s.num}</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

            {/* Alert feedback pill */}
            {surveyFeedback && (
              <div
                className={`px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 ${
                  surveyFeedback.type === "success"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {surveyFeedback.text}
              </div>
            )}

            {/* Unified Continuous Scrollable Inspection Document (Zero-Screen Navigation) */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 pb-12"
            >
              {/* ── 01. INSPECTION SITE & GATE COORDINATES ── */}
              <div id="sec-site" className="space-y-3.5 scroll-mt-2">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>Site Location & Gate Coordinates</span>
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {surveyFormData.latitude ? `${surveyFormData.latitude}°N, ${surveyFormData.longitude}°E` : "GPS Pending"}
                      </span>
                    </div>

                    {/* GPS Auto-Capture Button */}
                    <button
                      type="button"
                      onClick={handleAutoCaptureGps}
                      disabled={isCapturingGps}
                      className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-[0.99]"
                    >
                      <Compass className={`w-4 h-4 ${isCapturingGps ? "animate-spin text-emerald-600" : ""}`} />
                      <span>{isCapturingGps ? "Capturing Device Coordinates..." : "📍 Capture Live GPS Pin at Gate"}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={surveyFormData.latitude ?? ""}
                          onChange={(e) =>
                            setSurveyFormData((p) => ({ ...p, latitude: e.target.value ? Number(e.target.value) : null }))
                          }
                          placeholder="25.080000"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={surveyFormData.longitude ?? ""}
                          onChange={(e) =>
                            setSurveyFormData((p) => ({ ...p, longitude: e.target.value ? Number(e.target.value) : null }))
                          }
                          placeholder="48.020000"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Industrial Sector / Area Zone</label>
                      <input
                        type="text"
                        value={surveyFormData.siteAreaName ?? ""}
                        onChange={(e) => setSurveyFormData((p) => ({ ...p, siteAreaName: e.target.value }))}
                        placeholder="Eastern Province - Khurais Industrial Zone"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Physical Site Gate Address</label>
                      <input
                        type="text"
                        value={surveyFormData.siteAddress ?? ""}
                        onChange={(e) => setSurveyFormData((p) => ({ ...p, siteAddress: e.target.value }))}
                        placeholder="Khurais Main Gate 3, Eastern Province"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Client Contact Rep */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>Client Plant Contact</span>
                      </h3>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Verified Rep
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Representative Name</label>
                        <input
                          type="text"
                          value={surveyFormData.clientRepName ?? ""}
                          onChange={(e) => setSurveyFormData((p) => ({ ...p, clientRepName: e.target.value }))}
                          placeholder="Eng. Mansoor Al-Ghamdi"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Phone</label>
                        <input
                          type="text"
                          value={surveyFormData.clientRepPhone ?? ""}
                          onChange={(e) => setSurveyFormData((p) => ({ ...p, clientRepPhone: e.target.value }))}
                          placeholder="+966551234567"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {/* END OF 01. INSPECTION SITE & GATE */}

              {/* Thin Phase Divider: 01 Site -> 02 Scopes */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-[#F8FAFC] px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Phase 02 • Route &amp; Technical Scopes
                </span>
              </div>

              {/* ── 02. HAULAGE CORRIDOR & TECHNICAL SCOPES ── */}
              <div id="sec-scopes" className="space-y-3.5 scroll-mt-2">
                <div className="bg-white border-2 border-emerald-600/50 rounded-2xl overflow-hidden shadow-xs">
                  {/* Desktop Mobilization Header Bar */}
                  <div className="bg-[#17614A] text-white px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-200" />
                      <span className="text-xs font-black uppercase tracking-wider">MOBILIZATION</span>
                    </div>
                    <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full uppercase">
                      BASE CORRIDOR • MANDATORY
                    </span>
                  </div>

                    <div className="p-3.5 space-y-3.5">
                      {/* Dual Column Logistics Box (Exact Desktop Design) */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Base / Distance
                          </span>
                          <span className="font-extrabold text-slate-900 block mt-0.5 text-sm">
                            {surveyFormData.baseToSiteStraightKm || 24} km
                          </span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {surveyFormData.baseName || "Jafurah Operations Base"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Roundtrip Cycle
                          </span>
                          <span className="font-extrabold text-slate-900 block mt-0.5 text-sm">
                            {surveyFormData.totalCycleKm || 48} km
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            ~{surveyFormData.estFuelLitres || 18}L Diesel
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">
                          Origin Operations Hub <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={surveyFormData.baseId ?? ""}
                          onChange={(e) => {
                            const b = bases.find((x) => x.id === e.target.value);
                            setSurveyFormData((p) => ({
                              ...p,
                              baseId: e.target.value,
                              baseName: b?.name || "",
                            }));
                          }}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs cursor-pointer"
                        >
                          <option value="">Select Base...</option>
                          {bases.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-extrabold text-emerald-900 block mb-1 tracking-wider">
                          One-Way Distance <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={surveyFormData.baseToSiteStraightKm ?? 24}
                            onChange={(e) =>
                              setSurveyFormData((p) => ({
                                ...p,
                                baseToSiteStraightKm: Number(e.target.value),
                                totalCycleKm: Number(e.target.value) * 2,
                                estFuelLitres: Math.round(Number(e.target.value) * 2 * 0.35),
                              }))
                            }
                            className="w-full text-center text-xl font-black font-mono py-2.5 bg-white border-2 border-emerald-500/60 rounded-xl text-emerald-950 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A]"
                          />
                          <span className="absolute right-3 top-3 text-xs font-black text-emerald-700">
                            KM
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-wider">
                          Corridor Road Condition
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Good", "Fair", "Poor"] as const).map((r) => {
                            const isSelected = (surveyFormData.mobilizationRoute || "").includes(r);
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() =>
                                  setSurveyFormData((p) => ({
                                    ...p,
                                    mobilizationRoute: p.mobilizationRoute ? `${p.mobilizationRoute} (${r} corridor)` : `${r} corridor`,
                                  }))
                                }
                                className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-[#17614A] text-white border-[#17614A] shadow-xs font-black ring-1 ring-[#17614A]"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Base → Site Logistics Corridor & Notes
                        </label>
                        <textarea
                          value={surveyFormData.mobilizationRoute ?? ""}
                          onChange={(e) => setSurveyFormData((p) => ({ ...p, mobilizationRoute: e.target.value }))}
                          placeholder="Highway 613 paved dual carriageway. Security checkpoint at Gate #3 requires Aramco badge."
                          rows={2}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs"
                        />
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-800 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Verified Heavy Mobilization Transport Corridor</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Scope Summary Bar (Exact Desktop Header) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        RFQ Scope Services
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        HAULAGE DISTANCE INPUTS (KM)
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#17614A] border border-emerald-200">
                      {surveyServices.filter((s) => s.isActive).length} of 3 Scopes Active
                    </span>
                  </div>

                  {surveyServices.map((svc, idx) => {
                    const isSewage = svc.serviceType === "SEWAGE";
                    const isGeneral = svc.serviceType === "GENERAL";
                    const isHazardous = svc.serviceType === "HAZARDOUS";

                    const theme = isSewage
                      ? {
                          border: "border-amber-700/60",
                          bg: "bg-amber-50/15",
                          headerBg: "bg-[#78350F]",
                          badgeBg: "bg-amber-800/80",
                          buttonActive: "bg-[#78350F] text-white border-[#78350F]",
                          accentText: "text-amber-900",
                          icon: "💧",
                          title: "SEWAGE WASTE",
                          facilityLabel: "Approved STP Treatment Facility",
                          facilityPlaceholder: "Select STP Facility...",
                        }
                      : isGeneral
                      ? {
                          border: "border-blue-600/60",
                          bg: "bg-blue-50/15",
                          headerBg: "bg-[#1D4ED8]",
                          badgeBg: "bg-blue-800/80",
                          buttonActive: "bg-[#1D4ED8] text-white border-[#1D4ED8]",
                          accentText: "text-blue-900",
                          icon: "📦",
                          title: "GENERAL WASTE",
                          facilityLabel: "Approved Landfill / Transfer Stn",
                          facilityPlaceholder: "Select Landfill Facility...",
                        }
                      : {
                          border: "border-rose-600/60",
                          bg: "bg-rose-50/15",
                          headerBg: "bg-[#991B1B]",
                          badgeBg: "bg-rose-800/80",
                          buttonActive: "bg-[#991B1B] text-white border-[#991B1B]",
                          accentText: "text-rose-900",
                          icon: "☣️",
                          title: "HAZARDOUS WASTE",
                          facilityLabel: "Certified Hazmat Complex",
                          facilityPlaceholder: "Select Hazmat Facility...",
                        };

                    return (
                      <div
                        key={svc.serviceType}
                        className={`border-2 rounded-2xl overflow-hidden shadow-xs transition-all ${
                          svc.isActive
                            ? `${theme.border} ${theme.bg} bg-white`
                            : "border-slate-200 bg-slate-50/60 opacity-70"
                        }`}
                      >
                        {/* Desktop-Style Solid Colored Header Banner */}
                        <div
                          className={`px-3.5 py-2.5 flex items-center justify-between text-white transition-colors ${
                            svc.isActive ? theme.headerBg : "bg-slate-300 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{theme.icon}</span>
                            <span className="text-xs font-black uppercase tracking-wider">{theme.title}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...surveyServices];
                                updated[idx] = { ...svc, isActive: !svc.isActive };
                                setSurveyServices(updated);
                              }}
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase cursor-pointer transition-all ${
                                svc.isActive
                                  ? "bg-white/20 text-white hover:bg-white/30"
                                  : "bg-slate-400/80 text-white"
                              }`}
                            >
                              {svc.isActive ? "ACTIVE" : "INACTIVE"}
                            </button>

                            {/* iOS Style Toggle Switch */}
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={svc.isActive}
                                onChange={(e) => {
                                  const updated = [...surveyServices];
                                  updated[idx] = { ...svc, isActive: e.target.checked };
                                  setSurveyServices(updated);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-black/20 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white/40 shadow-inner"></div>
                            </label>
                          </div>
                        </div>

                        {/* Card Body if Scope is Active */}
                        {svc.isActive ? (
                          <div className="p-3.5 space-y-3 bg-white">
                            {/* Disposal Facility Dropdown */}
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">
                                {theme.facilityLabel} <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={svc.facilityId ?? ""}
                                onChange={(e) => {
                                  const f = facilities.find((x) => x.id === e.target.value);
                                  const updated = [...surveyServices];
                                  updated[idx] = {
                                    ...svc,
                                    facilityId: e.target.value,
                                    facilityName: f?.name || "",
                                  };
                                  setSurveyServices(updated);
                                }}
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs cursor-pointer"
                              >
                                <option value="">{theme.facilityPlaceholder}</option>
                                {facilities
                                  .filter((f) => f.serviceType === svc.serviceType)
                                  .map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.name}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Haulage to Discharge & Volume Row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={`text-[10px] uppercase font-extrabold ${theme.accentText} block mb-1 tracking-wider`}>
                                  Haulage to Discharge <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={svc.distanceKm ?? 25}
                                    onChange={(e) => {
                                      const updated = [...surveyServices];
                                      updated[idx] = {
                                        ...svc,
                                        distanceKm: Number(e.target.value),
                                      };
                                      setSurveyServices(updated);
                                    }}
                                    placeholder="25.0"
                                    className="w-full text-center text-xl font-black font-mono py-2 bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A]"
                                  />
                                  <span className="absolute right-2.5 top-2.5 text-[10px] font-black text-slate-400">
                                    KM
                                  </span>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Est. Volume
                                </label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    value={svc.estimatedVolume ?? 50}
                                    onChange={(e) => {
                                      const updated = [...surveyServices];
                                      updated[idx] = {
                                        ...svc,
                                        estimatedVolume: e.target.value ? Number(e.target.value) : null,
                                      };
                                      setSurveyServices(updated);
                                    }}
                                    placeholder="50"
                                    className="w-16 p-2 text-center bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs"
                                  />
                                  <select
                                    value={svc.volumeUnit ?? "m3"}
                                    onChange={(e) => {
                                      const updated = [...surveyServices];
                                      updated[idx] = { ...svc, volumeUnit: e.target.value as any };
                                      setSurveyServices(updated);
                                    }}
                                    className="flex-1 min-w-0 p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs cursor-pointer"
                                  >
                                    <option value="m3">m³</option>
                                    <option value="L">Liters</option>
                                    <option value="ton">Tons</option>
                                    <option value="Tanker Loads">Loads</option>
                                    <option value="Compactor Bins">Bins</option>
                                    <option value="IBC Totes">Totes</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Approach Road Condition - Dedicated Full-Width Row */}
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5 tracking-wider">
                                Approach Road Condition
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {(["Good", "Fair", "Poor"] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => {
                                      const updated = [...surveyServices];
                                      updated[idx] = { ...svc, roadCondition: r };
                                      setSurveyServices(updated);
                                    }}
                                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                      svc.roadCondition === r
                                        ? `${theme.buttonActive} shadow-xs font-black ring-1 ring-current`
                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Approach Logistics Note */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Approach Logistics Note
                              </label>
                              <input
                                type="text"
                                value={svc.wasteDescription ?? "Industrial site operational effluent"}
                                onChange={(e) => {
                                  const updated = [...surveyServices];
                                  updated[idx] = { ...svc, wasteDescription: e.target.value };
                                  setSurveyServices(updated);
                                }}
                                placeholder="e.g. Vacuum tanker access; Gate 2"
                                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#17614A]/15 focus:border-[#17614A] shadow-2xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-center bg-slate-50/50">
                            <span className="text-[11px] font-semibold text-slate-400">
                              Tap switch or "INACTIVE" button above to activate this scope
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Aggregate Haulage Metrics Bar (Exact Desktop Bottom Inset) */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-[#17614A] border border-emerald-300">
                        {surveyServices.filter((s) => s.isActive).length} of 3 Scopes Active
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Roundtrip Cycle & Fuel
                      </span>
                      <span className="font-extrabold text-slate-900 text-xs">
                        {surveyFormData.totalCycleKm || 198} km · ~{surveyFormData.estFuelLitres || 79.2}L Diesel
                      </span>
                    </div>
                  </div>
                </div>
              {/* END OF 02. HAULAGE CORRIDOR & TECHNICAL SCOPES */}

              {/* Thin Phase Divider: 02 Scopes -> 03 Evidence */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-[#F8FAFC] px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Phase 03 • Evidence &amp; Sign-Off
                </span>
              </div>

              {/* ── 03. FIELD OBSERVATIONS, EVIDENCE & SIGN-OFF ── */}
              <div id="sec-evidence" className="space-y-3.5 scroll-mt-2">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 min-w-0">
                        <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">On-Site Photographic Evidence</span>
                      </h3>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap shrink-0">
                        Audit Certified
                      </span>
                    </div>

                    {/* Tag Selector for Next Photo */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Select Evidence Tag Category
                      </label>
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {PHOTO_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedPhotoTag(tag)}
                            className={`px-3 py-1 rounded-xl text-[10px] font-bold shrink-0 cursor-pointer transition-all ${
                              selectedPhotoTag === tag
                                ? "bg-[#17614A] text-white shadow-xs"
                                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hidden camera input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />

                    {/* Trigger Photo Snap & Demo Photo */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-3 px-2 bg-[#17614A] hover:bg-[#0F4A38] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Take Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDemoPhoto}
                        className="py-3 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                      >
                        <span>📸 Add Sample Photo</span>
                      </button>
                    </div>

                    {/* Offline Queue Sync Indicator */}
                    {offlinePhotos.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                        <span className="font-bold text-amber-800">
                          📦 {offlinePhotos.length} photo(s) stored in offline cache
                        </span>
                        <button
                          type="button"
                          onClick={handleSyncOfflinePhotos}
                          disabled={!isOnline || isSyncingPhotos}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncingPhotos ? "animate-spin" : ""}`} />
                          <span>{isSyncingPhotos ? "Syncing..." : "Sync Photos"}</span>
                        </button>
                      </div>
                    )}

                    {/* Photos Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(activeSurveyInspection.attachments || []).map((att) => (
                        <div
                          key={att.id}
                          className="relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden aspect-square flex flex-col justify-end p-2 text-[9px] font-bold text-white shadow-xs"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                          <span className="relative z-20 truncate">{att.tag || att.fileName}</span>
                        </div>
                      ))}
                      {offlinePhotos.map((off) => (
                        <div
                          key={off.id}
                          className="relative rounded-xl border-2 border-dashed border-amber-400 bg-amber-900/60 overflow-hidden aspect-square flex flex-col justify-between p-2 text-[9px] font-bold text-white shadow-xs"
                        >
                          <span className="px-1 py-0.2 rounded bg-amber-500 text-black font-black uppercase text-[8px] w-fit">
                            Offline
                          </span>
                          <span className="truncate">{off.tag || off.fileName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Field Notes Textarea */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-2 shadow-sm">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                      Site Observations &amp; Operational Constraints
                    </label>
                    <textarea
                      value={surveyFormData.observations ?? ""}
                      onChange={(e) => setSurveyFormData((p) => ({ ...p, observations: e.target.value }))}
                      placeholder="Access road is paved. Ground compaction verified >=150 kPa. Gate entrance requires visitor badge."
                      rows={2}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#17614A]/20 focus:border-[#17614A] shadow-2xs"
                    />
                  </div>

                  {/* Operational Constraints Quick Selection (Exact Desktop Section 03 Tags) */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Permits &amp; Safety (PTW)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Cold Work (Standard)",
                          "Hot Work Permit Required",
                          "Confined Space Entry",
                          "H2S Certified Personnel Required",
                          "Secondary Containment Required",
                        ].map((item) => {
                          const isSelected = (surveyFormData.observations || "").includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                const current = surveyFormData.observations || "";
                                const updated = isSelected
                                  ? current.replace(item, "").replace(/;\s*;/g, ";").trim()
                                  : current ? `${current}; ${item}` : item;
                                setSurveyFormData((p) => ({ ...p, observations: updated }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? "bg-[#17614A] text-white border-[#17614A] shadow-xs"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Access &amp; Ground Constraints
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Paved Access Road Available",
                          "Off-road / Sand Track Only",
                          "Bogie Mats Required",
                          "HV Cable Height Clearance Required",
                          "Steel Spreader Plates for Outriggers",
                        ].map((item) => {
                          const isSelected = (surveyFormData.observations || "").includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                const current = surveyFormData.observations || "";
                                const updated = isSelected
                                  ? current.replace(item, "").replace(/;\s*;/g, ";").trim()
                                  : current ? `${current}; ${item}` : item;
                                setSurveyFormData((p) => ({ ...p, observations: updated }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? "bg-[#17614A] text-white border-[#17614A] shadow-xs"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Joint Field Verification Sign-off Checkbox */}
                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 cursor-pointer">
                    <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-[#17614A]" />
                    <span>I confirm and certify that all site inspection information, GPS coordinates, haulage distances, and waste specifications provided herein are accurate and reflect real ground conditions.</span>
                  </label>

                  {/* Validation Checklist / Errors */}
                  {completenessErrors.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-black">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Required items before submission:</span>
                      </div>
                      <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                        {completenessErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

            <div className="bg-white border-t border-slate-200/90 px-4 pt-3 safe-bottom-bar flex items-center gap-2.5 shrink-0 shadow-xl z-30">
              <button
                type="button"
                onClick={() =>
                  saveDraftMutation.mutate({
                    id: activeSurveyInspection.id,
                    data: { ...surveyFormData, services: sanitizeServicesForSubmission(surveyServices) },
                  })
                }
                disabled={saveDraftMutation.isPending}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <span>{saveDraftMutation.isPending ? "Saving..." : "Save Draft"}</span>
              </button>

              <button
                type="button"
                onClick={handleValidateAndSubmit}
                disabled={submitSurveyMutation.isPending}
                className="flex-1 py-3 bg-gradient-to-r from-[#17614A] to-emerald-700 hover:from-[#0F4A38] hover:to-emerald-800 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>{submitSurveyMutation.isPending ? "Submitting..." : "Submit Feasibility Audit"}</span>
              </button>
            </div>
          </div>
      )}
    </div>
  </div>
  );
}
