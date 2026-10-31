import { haversineKm } from "./siteInspectionService";

export interface EngineSiteBase {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface EngineCandidate {
  userId: string;
  name: string;
  isAvailable: boolean;
  userStatus?: string | null;
  onLeaveFrom?: Date | string | null;
  onLeaveTo?: Date | string | null;
  homeBaseId?: string | null;
  coverageBaseIds?: string[];
  maxOpenInspections?: number | null;
  maxVisitsPerDay?: number | null;
  maxDistanceKm?: number | null;
  certifications?: string[];
  languages?: string[];
  lastAssignedAt?: Date | string | null;
  openInspectionsCount: number;
  scheduledVisitsTodayCount: number;
}

export interface EngineProjectLocation {
  latitude: number;
  longitude: number;
  areaName?: string | null;
}

export interface AssignmentEngineInput {
  mode: "legacy" | "nearest" | "balanced";
  projectLocation?: EngineProjectLocation | null;
  requiredCertifications?: string[]; // e.g. ["HAZARDOUS", "SEWAGE"]
  targetDate?: Date | string | null;
  candidates: EngineCandidate[];
  bases: EngineSiteBase[];
  settings: {
    maxOpenInspections: number;
    maxVisitsPerDay: number;
    maxDistanceKm: number;
    balancedWeights: { distance: number; load: number };
  };
}

export interface CandidateEvaluation {
  candidate: EngineCandidate;
  qualified: boolean;
  disqualificationReasons: string[];
  minDistanceKm: number | null;
  nearestBase: EngineSiteBase | null;
  effectiveCapacity: number;
  effectiveMaxVisits: number;
  effectiveMaxDistance: number;
  balancedScore?: number;
}

export interface AssignmentDecision {
  selectedUserId: string | null;
  selectedUserName: string | null;
  assignmentMode: "legacy" | "nearest" | "balanced";
  assignmentState: "ASSIGNED" | "UNASSIGNED";
  assignmentReason: string;
  evaluations: CandidateEvaluation[];
}

/**
 * Checks if a candidate is on leave on a given target date.
 */
export function isCandidateOnLeave(candidate: EngineCandidate, targetDate: Date = new Date()): boolean {
  if (!candidate.onLeaveFrom || !candidate.onLeaveTo) return false;
  const from = new Date(candidate.onLeaveFrom).getTime();
  const to = new Date(candidate.onLeaveTo).getTime();
  const target = targetDate.getTime();
  return target >= from && target <= to;
}

/**
 * Evaluates candidate qualifications and ranks them according to the selected assignment mode.
 * Pure, deterministic function without side effects or database calls.
 */
export function evaluateAndRankCandidates(input: AssignmentEngineInput): AssignmentDecision {
  const { mode, projectLocation, requiredCertifications = [], targetDate, candidates, bases, settings } = input;
  const evalDate = targetDate ? new Date(targetDate) : new Date();

  const basesMap = new Map<string, EngineSiteBase>();
  for (const b of bases) {
    basesMap.set(b.id, b);
  }

  const evaluations: CandidateEvaluation[] = candidates.map((cand) => {
    const reasons: string[] = [];

    // 1. Availability & Status
    if (cand.isAvailable === false) {
      reasons.push("Marked unavailable in inspector profile");
    }
    if (cand.userStatus && cand.userStatus.toLowerCase() === "inactive") {
      reasons.push("User account is inactive");
    }

    // 2. Leave
    if (isCandidateOnLeave(cand, evalDate)) {
      reasons.push("On approved leave during assessment date");
    }

    // 3. Workload capacity
    const effectiveCapacity =
      typeof cand.maxOpenInspections === "number" && cand.maxOpenInspections > 0
        ? cand.maxOpenInspections
        : settings.maxOpenInspections;
    if (cand.openInspectionsCount >= effectiveCapacity) {
      reasons.push(`At maximum workload capacity (${cand.openInspectionsCount}/${effectiveCapacity} open inspections)`);
    }

    // 4. Daily visit cap
    const effectiveMaxVisits =
      typeof cand.maxVisitsPerDay === "number" && cand.maxVisitsPerDay > 0
        ? cand.maxVisitsPerDay
        : settings.maxVisitsPerDay;
    if (cand.scheduledVisitsTodayCount >= effectiveMaxVisits) {
      reasons.push(`At daily site visit limit (${cand.scheduledVisitsTodayCount}/${effectiveMaxVisits} visits scheduled today)`);
    }

    // 5. Certifications (case-insensitive)
    if (requiredCertifications && requiredCertifications.length > 0) {
      const candCerts = new Set((cand.certifications || []).map((c) => String(c).toUpperCase().trim()));
      const missing = requiredCertifications.filter(
        (req) => !candCerts.has(String(req).toUpperCase().trim())
      );
      if (missing.length > 0) {
        reasons.push(`Missing required scope certification(s): ${missing.join(", ")}`);
      }
    }

    // 6. Base distance (applies to nearest and balanced modes)
    const effectiveMaxDistance =
      typeof cand.maxDistanceKm === "number" && cand.maxDistanceKm > 0
        ? cand.maxDistanceKm
        : settings.maxDistanceKm;

    let minDistanceKm: number | null = null;
    let nearestBase: EngineSiteBase | null = null;

    if (
      projectLocation &&
      projectLocation.latitude != null &&
      projectLocation.longitude != null &&
      !isNaN(projectLocation.latitude) &&
      !isNaN(projectLocation.longitude)
    ) {
      // Find all eligible bases: home base + coverage bases
      const eligibleBaseIds = new Set<string>();
      if (cand.homeBaseId) eligibleBaseIds.add(cand.homeBaseId);
      for (const covId of cand.coverageBaseIds || []) {
        eligibleBaseIds.add(covId);
      }

      // If candidate has no home or coverage base assigned, evaluate against all bases
      const basesToEvaluate =
        eligibleBaseIds.size > 0
          ? Array.from(eligibleBaseIds)
              .map((id) => basesMap.get(id))
              .filter(Boolean) as EngineSiteBase[]
          : bases;

      for (const b of basesToEvaluate) {
        const d = haversineKm(b.latitude, b.longitude, projectLocation.latitude, projectLocation.longitude);
        if (minDistanceKm === null || d < minDistanceKm) {
          minDistanceKm = d;
          nearestBase = b;
        }
      }

      if (mode !== "legacy" && minDistanceKm !== null && minDistanceKm > effectiveMaxDistance) {
        reasons.push(
          `Project site is ${minDistanceKm} km away, exceeding maximum travel radius of ${effectiveMaxDistance} km`
        );
      }
    }

    return {
      candidate: cand,
      qualified: reasons.length === 0,
      disqualificationReasons: reasons,
      minDistanceKm,
      nearestBase,
      effectiveCapacity,
      effectiveMaxVisits,
      effectiveMaxDistance,
    };
  });

  const qualified = evaluations.filter((e) => e.qualified);

  // If no candidates qualify
  if (qualified.length === 0) {
    const summaryReasons = evaluations
      .map((e) => `${e.candidate.name}: ${e.disqualificationReasons.join("; ")}`)
      .slice(0, 4)
      .join(" | ");

    return {
      selectedUserId: null,
      selectedUserName: null,
      assignmentMode: mode,
      assignmentState: "UNASSIGNED",
      assignmentReason: `No qualified inspector available. [${summaryReasons || "No site managers registered"}]`,
      evaluations,
    };
  }

  // Legacy mode: pick lowest open load, then round-robin
  if (mode === "legacy") {
    qualified.sort((a, b) => {
      if (a.candidate.openInspectionsCount !== b.candidate.openInspectionsCount) {
        return a.candidate.openInspectionsCount - b.candidate.openInspectionsCount;
      }
      const aTime = a.candidate.lastAssignedAt ? new Date(a.candidate.lastAssignedAt).getTime() : 0;
      const bTime = b.candidate.lastAssignedAt ? new Date(b.candidate.lastAssignedAt).getTime() : 0;
      return aTime - bTime;
    });

    const chosen = qualified[0];
    return {
      selectedUserId: chosen.candidate.userId,
      selectedUserName: chosen.candidate.name,
      assignmentMode: "legacy",
      assignmentState: "ASSIGNED",
      assignmentReason: `Legacy round-robin: open load ${chosen.candidate.openInspectionsCount}/${chosen.effectiveCapacity}`,
      evaluations,
    };
  }

  // Nearest mode: rank by minDistanceKm, then load, then round-robin
  if (mode === "nearest") {
    qualified.sort((a, b) => {
      const distA = a.minDistanceKm ?? 99999;
      const distB = b.minDistanceKm ?? 99999;
      if (distA !== distB) return distA - distB;

      if (a.candidate.openInspectionsCount !== b.candidate.openInspectionsCount) {
        return a.candidate.openInspectionsCount - b.candidate.openInspectionsCount;
      }

      const aTime = a.candidate.lastAssignedAt ? new Date(a.candidate.lastAssignedAt).getTime() : 0;
      const bTime = b.candidate.lastAssignedAt ? new Date(b.candidate.lastAssignedAt).getTime() : 0;
      return aTime - bTime;
    });

    const chosen = qualified[0];
    const baseInfo = chosen.nearestBase ? `${chosen.nearestBase.name}, ` : "";
    const distInfo = chosen.minDistanceKm !== null ? `${chosen.minDistanceKm} km, ` : "";

    return {
      selectedUserId: chosen.candidate.userId,
      selectedUserName: chosen.candidate.name,
      assignmentMode: "nearest",
      assignmentState: "ASSIGNED",
      assignmentReason: `Nearest base: ${baseInfo}${distInfo}load ${chosen.candidate.openInspectionsCount}/${chosen.effectiveCapacity}`,
      evaluations,
    };
  }

  // Balanced mode: weighted score of distance and workload
  const maxAllowedDist = settings.maxDistanceKm || 300;
  const weightDist = settings.balancedWeights?.distance ?? 0.5;
  const weightLoad = settings.balancedWeights?.load ?? 0.5;

  for (const q of qualified) {
    const normDist = (q.minDistanceKm ?? maxAllowedDist) / maxAllowedDist;
    const normLoad = q.candidate.openInspectionsCount / Math.max(1, q.effectiveCapacity);
    q.balancedScore = Math.round((normDist * weightDist + normLoad * weightLoad) * 1000) / 1000;
  }

  qualified.sort((a, b) => {
    if (a.balancedScore !== b.balancedScore) {
      return (a.balancedScore ?? 0) - (b.balancedScore ?? 0);
    }
    if (a.candidate.openInspectionsCount !== b.candidate.openInspectionsCount) {
      return a.candidate.openInspectionsCount - b.candidate.openInspectionsCount;
    }
    const aTime = a.candidate.lastAssignedAt ? new Date(a.candidate.lastAssignedAt).getTime() : 0;
    const bTime = b.candidate.lastAssignedAt ? new Date(b.candidate.lastAssignedAt).getTime() : 0;
    return aTime - bTime;
  });

  const chosen = qualified[0];
  const baseInfo = chosen.nearestBase ? `${chosen.nearestBase.name}, ` : "";
  const distInfo = chosen.minDistanceKm !== null ? `${chosen.minDistanceKm} km, ` : "";

  return {
    selectedUserId: chosen.candidate.userId,
    selectedUserName: chosen.candidate.name,
    assignmentMode: "balanced",
    assignmentState: "ASSIGNED",
    assignmentReason: `Balanced score: ${chosen.balancedScore?.toFixed(2)} (${baseInfo}${distInfo}load ${chosen.candidate.openInspectionsCount}/${chosen.effectiveCapacity})`,
    evaluations,
  };
}
