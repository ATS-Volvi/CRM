export type SiteInspectionStatus =
  | "REQUESTED"
  | "DRAFT"
  | "WAITING_ON_CLIENT"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "CANCELLED"
  | "NOT_REQUESTED";

export interface SiteBase {
  id: string;
  code: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface SiteFacility {
  id: string;
  serviceType: "SEWAGE" | "GENERAL" | "HAZARDOUS";
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
}

export interface SiteInspectionServiceItem {
  id?: string;
  inspectionId?: string;
  serviceType: "SEWAGE" | "GENERAL" | "HAZARDOUS";
  isActive: boolean;
  facilityId?: string | null;
  facilityName?: string | null;
  distanceKm: number;
  roadCondition?: "Good" | "Fair" | "Poor" | "";
  logisticsNote?: string;
  wasteDescription?: string;
  estimatedVolume?: number | null;
  volumeUnit?: "L" | "m3" | "ton" | "loads" | "";
  facility?: SiteFacility;
}

export interface SiteInspectionAttachmentItem {
  id: string;
  inspectionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  caption?: string | null;
  tag?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  takenAt?: string | null;
  uploadedById?: string | null;
  uploadedBy?: { id: string; name: string };
}

export interface SiteInspectionRecord {
  id: string;
  inspectionNumber: string;
  leadId: string;
  dealId?: string | null;
  status: SiteInspectionStatus;
  assignedToId?: string | null;
  requestedById?: string | null;
  requestNote?: string | null;
  dueAt?: string | null;
  baseId?: string | null;
  baseName?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  auditAt?: string | null;
  rfqNumber?: string | null;
  scopeSummary?: string | null;
  clientOrganization?: string | null;
  clientRepName?: string | null;
  clientRepPhone?: string | null;
  mobilizationRoute?: string | null;
  mobilizationKm?: number | null;
  speedLimitKmh: number;
  baseToSiteStraightKm?: number | null;
  totalCycleKm?: number | null;
  estFuelLitres?: number | null;
  observations?: string | null;
  accepted: boolean;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;

  // Phase 2 Assignment & Timeline fields
  siteAreaName?: string | null;
  siteLatitudeHint?: number | null;
  siteLongitudeHint?: number | null;
  siteLocationSource?: string | null;
  priority?: "LOW" | "NORMAL" | "URGENT";
  priorityReason?: string | null;
  requiredCertifications?: string[] | null;
  assignmentMode?: string | null;
  assignmentState?: "ASSIGNED" | "UNASSIGNED" | "NEEDS_AREA" | "PENDING_CONFIRMATION" | "ACCEPTED" | "DECLINED" | "VISIT_SCHEDULED" | "VISIT_STARTED";
  assignmentReason?: string | null;
  assignedAt?: string | null;
  requestedInspectorId?: string | null;
  requestedInspectorReason?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  scheduledVisitAt?: string | null;
  startedAt?: string | null;
  slaAcceptDueAt?: string | null;
  slaScheduleDueAt?: string | null;
  slaSubmitDueAt?: string | null;
  slaReviewDueAt?: string | null;

  // Phase 2 Stage B Timelines & Escalation fields
  waitingOnClientReason?: string | null;
  waitingOnClientExpectedAt?: string | null;
  slaPausedAt?: string | null;
  slaTotalPausedMinutes?: number;
  moreTimeReason?: string | null;
  moreTimeRequestedHours?: number | null;
  moreTimeStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  moreTimeApprovedById?: string | null;
  moreTimeApprovedAt?: string | null;
  escalatedToOpsAt?: string | null;
  escalatedToDirectorAt?: string | null;

  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    company: string;
    leadNumber?: string;
    status: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  base?: SiteBase;
  services?: SiteInspectionServiceItem[];
  attachments?: SiteInspectionAttachmentItem[];
}

export interface SiteInspectionSettingsData {
  assignmentMode: "legacy" | "nearest" | "balanced";
  maxOpenInspections: number;
  maxVisitsPerDay: number;
  maxDistanceKm: number;
  balancedWeights: { distance: number; load: number };
  slaHours: {
    accept: number;
    schedule: number;
    submit: number;
    review: number;
    acceptHours?: number;
    scheduleHours?: number;
    submitHours?: number;
    reviewHours?: number;
  };
  workingWeek: Array<number | string>;
  workingHours: { start: string; end: string };
  timezone?: string;
  automation: boolean;
  autoQualify: boolean;
}

export interface SiteHolidayRecord {
  id: string;
  date: string;
  name: string;
  isRecurringYearly: boolean;
  notes?: string | null;
}

export interface SiteInspectorProfileRecord {
  id: string;
  userId: string;
  user?: { id: string; name: string; email: string; role: string; isAvailable: boolean };
  isAvailable: boolean;
  leaveStartDate?: string | null;
  leaveEndDate?: string | null;
  maxOpenInspections: number;
  maxVisitsPerDay: number;
  maxDistanceKm: number;
  certifications: string[];
  defaultBaseId?: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  lastAssignedAt?: string | null;
}

export interface SiteInspectionAuditLogRecord {
  id: string;
  inspectionId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  actor?: { id: string; name: string; email: string; role: string };
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface SiteInspectionGateResult {
  allowed: boolean;
  status: SiteInspectionStatus;
  message: string;
}

export const APPROVER_ROLES = ["admin", "director", "manager", "sales_manager", "ops_manager"];

export function canApproveInspection(userRole?: string, assignedToId?: string | null, userId?: string): boolean {
  if (!userRole) return false;
  const isApprover = APPROVER_ROLES.includes(userRole.toLowerCase());
  if (!isApprover) return false;
  // Nobody may approve their own inspection
  if (assignedToId && userId && assignedToId === userId) return false;
  return true;
}

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers.
 * Rounded to 0.1km.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
      lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
    return 0;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Computes single cycle km and diesel fuel estimate.
 * totalCycleKm = 2 * (mobilizationKm + sum of active waste service distanceKm)
 * estFuelLitres = totalCycleKm * 0.4
 */
export function computeMetrics(
  mobilizationKm: number,
  services: Array<{ isActive?: boolean; distanceKm?: number | null }>
): { totalCycleKm: number; estFuelLitres: number } {
  const mob = Math.max(0, Number(mobilizationKm) || 0);
  const activeWasteKm = (services || [])
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + Math.max(0, Number(s.distanceKm) || 0), 0);

  const totalCycleKm = Math.round(2 * (mob + activeWasteKm) * 10) / 10;
  const estFuelLitres = Math.round(totalCycleKm * 0.4 * 10) / 10;

  return { totalCycleKm, estFuelLitres };
}

export function getStatusStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
        dotColor: "bg-emerald-500",
      };
    case "SUBMITTED":
      return {
        label: "Awaiting Approval",
        badgeBg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
        dotColor: "bg-purple-500",
      };
    case "CHANGES_REQUESTED":
      return {
        label: "Changes Requested",
        badgeBg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
        dotColor: "bg-rose-500",
      };
    case "DRAFT":
      return {
        label: "Draft",
        badgeBg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "REQUESTED":
      return {
        label: "Requested",
        badgeBg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "WAITING_ON_CLIENT":
      return {
        label: "Waiting on Client",
        badgeBg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
        dotColor: "bg-orange-500",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        badgeBg: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        dotColor: "bg-slate-400",
      };
    case "NOT_REQUESTED":
    default:
      return {
        label: "Not Requested",
        badgeBg: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        dotColor: "bg-slate-400",
      };
  }
}

/**
 * Calculates RAG status and countdown string for UI cards and badges.
 */
export function getInspectionRag(inspection: SiteInspectionRecord): {
  rag: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "PAUSED" | "COMPLETED";
  label: string;
  countdown: string;
  badgeBg: string;
  dotColor: string;
} {
  if (inspection.status === "APPROVED") {
    return {
      rag: "COMPLETED",
      label: "Approved",
      countdown: "Completed",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      dotColor: "bg-emerald-500",
    };
  }

  if (inspection.status === "WAITING_ON_CLIENT" || inspection.slaPausedAt) {
    return {
      rag: "PAUSED",
      label: "SLA Paused",
      countdown: inspection.waitingOnClientExpectedAt
        ? `Expected: ${new Date(inspection.waitingOnClientExpectedAt).toLocaleDateString()}`
        : "Waiting on client",
      badgeBg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
      dotColor: "bg-orange-500",
    };
  }

  // Determine active milestone deadline
  let targetDueStr = inspection.slaSubmitDueAt || inspection.dueAt;
  let targetStartStr = inspection.acceptedAt || inspection.createdAt;

  if (inspection.status === "REQUESTED" && inspection.slaAcceptDueAt) {
    targetDueStr = inspection.slaAcceptDueAt;
    targetStartStr = inspection.assignedAt || inspection.createdAt;
  } else if (inspection.status === "SUBMITTED" && inspection.slaReviewDueAt) {
    targetDueStr = inspection.slaReviewDueAt;
    targetStartStr = inspection.submittedAt || inspection.updatedAt;
  }

  if (!targetDueStr) {
    return {
      rag: "ON_TRACK",
      label: "Standard SLA",
      countdown: "48h Standard",
      badgeBg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      dotColor: "bg-slate-400",
    };
  }

  const now = new Date().getTime();
  const due = new Date(targetDueStr).getTime();
  const start = targetStartStr ? new Date(targetStartStr).getTime() : now - 3600000;
  const totalWindow = Math.max(1, due - start);
  const remainingMs = due - now;

  if (remainingMs <= 0) {
    const overdueMin = Math.round(Math.abs(remainingMs) / 60000);
    const h = Math.floor(overdueMin / 60);
    const m = overdueMin % 60;
    return {
      rag: "OVERDUE",
      label: "Overdue",
      countdown: `Overdue by ${h}h ${m}m`,
      badgeBg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
      dotColor: "bg-rose-500",
    };
  }

  const elapsed = Math.max(0, now - start);
  const pct = Math.min(100, Math.round((elapsed / totalWindow) * 100));

  const remMin = Math.round(remainingMs / 60000);
  const h = Math.floor(remMin / 60);
  const m = remMin % 60;
  const countdown = `${h}h ${m}m remaining`;

  if (pct >= 80) {
    return {
      rag: "AT_RISK",
      label: "At Risk (80%)",
      countdown,
      badgeBg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      dotColor: "bg-amber-500",
    };
  }

  return {
    rag: "ON_TRACK",
    label: "On Track",
    countdown,
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  };
}
