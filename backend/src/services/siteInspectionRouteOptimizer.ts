import { haversineKm } from "./siteInspectionService";
import { REGION_COORDINATES } from "./siteInspectionAssignmentService";

export interface RouteWaypoint {
  id: string;
  inspectionNumber: string;
  clientName: string;
  siteName: string;
  areaName: string;
  latitude: number | null;
  longitude: number | null;
  dueAt: Date | string | null;
  priority: string;
  status: string;
  hasCoordinates: boolean;
  resolvedSource: "GPS_EXPLICIT" | "REGION_FALLBACK" | "UNRESOLVED";
}

export interface RouteOptimizationOptions {
  startLocation?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  returnToBase?: boolean; // default: true
  mode?: "SHORTEST_DISTANCE" | "SLA_GUARDED"; // default: "SHORTEST_DISTANCE"
  avgSpeedKmh?: number; // default: 70 km/h
  fuelLitrePerKm?: number; // default: 0.4 L/km
}

export interface RouteLeg {
  fromName: string;
  toName: string;
  toInspectionId?: string;
  distanceKm: number;
  estimatedMinutes: number;
}

export interface RouteOptimizationResult {
  optimizedOrder: RouteWaypoint[];
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  estimatedFuelLitres: number;
  unoptimizedDistanceKm: number;
  distanceSavedKm: number;
  timeSavedMinutes: number;
  fuelSavedLitres: number;
  googleMapsUrl: string;
  unresolvedCount: number;
  modeUsed: "SHORTEST_DISTANCE" | "SLA_GUARDED";
}

/**
 * Resolves coordinate for a site using explicit GPS first, then REGION_COORDINATES fallback.
 */
export function resolveWaypointCoordinates(raw: any): {
  latitude: number | null;
  longitude: number | null;
  resolvedSource: "GPS_EXPLICIT" | "REGION_FALLBACK" | "UNRESOLVED";
} {
  const lat = Number(raw.latitude ?? raw.siteLatitudeHint);
  const lng = Number(raw.longitude ?? raw.siteLongitudeHint);

  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng, resolvedSource: "GPS_EXPLICIT" };
  }

  // Fallback to text matching against REGION_COORDINATES
  const textCandidates = [
    raw.siteAreaName,
    raw.siteName,
    raw.clientOrganization,
    raw.lead?.city,
    raw.lead?.territory,
    raw.lead?.address
  ]
    .filter(Boolean)
    .map(t => String(t).toLowerCase().trim());

  for (const text of textCandidates) {
    for (const [key, coords] of Object.entries(REGION_COORDINATES)) {
      const normalizedKey = key.replace(/_/g, " ");
      if (text.includes(normalizedKey) || text.includes(key)) {
        return { latitude: coords.lat, longitude: coords.lng, resolvedSource: "REGION_FALLBACK" };
      }
    }
  }

  return { latitude: null, longitude: null, resolvedSource: "UNRESOLVED" };
}

/**
 * Generates all permutations of an array.
 */
function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(remaining);
    for (const p of perms) {
      result.push([current, ...p]);
    }
  }
  return result;
}

/**
 * Calculates total route distance for a sequence of waypoints from a start location.
 */
function calculatePathDistance(
  start: { latitude: number; longitude: number },
  stops: RouteWaypoint[],
  returnToBase: boolean
): number {
  if (stops.length === 0) return 0;
  let total = 0;
  let currentLat = start.latitude;
  let currentLng = start.longitude;

  for (const stop of stops) {
    if (stop.latitude !== null && stop.longitude !== null) {
      total += haversineKm(currentLat, currentLng, stop.latitude, stop.longitude);
      currentLat = stop.latitude;
      currentLng = stop.longitude;
    }
  }

  if (returnToBase) {
    total += haversineKm(currentLat, currentLng, start.latitude, start.longitude);
  }

  return Math.round(total * 10) / 10;
}

/**
 * Greedy 2-opt nearest neighbor for larger stop sets (N > 6).
 */
function greedyNearestNeighbor(
  start: { latitude: number; longitude: number },
  stops: RouteWaypoint[]
): RouteWaypoint[] {
  const remaining = [...stops];
  const ordered: RouteWaypoint[] = [];
  let currentLat = start.latitude;
  let currentLng = start.longitude;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (item.latitude !== null && item.longitude !== null) {
        const d = haversineKm(currentLat, currentLng, item.latitude, item.longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    if (next.latitude !== null && next.longitude !== null) {
      currentLat = next.latitude;
      currentLng = next.longitude;
    }
  }

  return ordered;
}

/**
 * Core Route Optimizer:
 * Calculates optimal visit sequence (1st, 2nd, 3rd...), leg-by-leg metrics, and travel savings.
 */
export function optimizeDailyRoute(
  inspections: any[],
  options: RouteOptimizationOptions = {}
): RouteOptimizationResult {
  const returnToBase = options.returnToBase ?? true;
  const mode = options.mode ?? "SHORTEST_DISTANCE";
  const avgSpeedKmh = options.avgSpeedKmh ?? 70;
  const fuelLitrePerKm = options.fuelLitrePerKm ?? 0.4;

  // 1. Normalize Start Location
  const startLoc = options.startLocation ?? {
    name: "Operations Base",
    latitude: 25.55,
    longitude: 49.85 // Default Jafurah / Eastern Province Hub
  };

  // 2. Resolve coordinates for all inspections
  const waypoints: RouteWaypoint[] = inspections.map((ins) => {
    const resolved = resolveWaypointCoordinates(ins);
    return {
      id: ins.id,
      inspectionNumber: ins.inspectionNumber || "SI-Pending",
      clientName: ins.clientOrganization || ins.lead?.company || "Unnamed Client",
      siteName: ins.siteName || "Site",
      areaName: ins.siteAreaName || ins.siteName || "Area",
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      dueAt: ins.dueAt || null,
      priority: ins.priority || "NORMAL",
      status: ins.status || "REQUESTED",
      hasCoordinates: resolved.latitude !== null && resolved.longitude !== null,
      resolvedSource: resolved.resolvedSource
    };
  });

  const resolvable = waypoints.filter((w) => w.hasCoordinates);
  const unresolvable = waypoints.filter((w) => !w.hasCoordinates);

  // 3. Calculate Baseline Unoptimized Distance
  const unoptimizedDistanceKm = calculatePathDistance(startLoc, resolvable, returnToBase);

  let bestSequence: RouteWaypoint[] = [];

  if (resolvable.length === 0) {
    bestSequence = [];
  } else if (resolvable.length === 1) {
    bestSequence = [resolvable[0]];
  } else if (mode === "SLA_GUARDED") {
    // SLA Guarded: Urgent / Overdue first, then distance-optimized for each priority tier
    const urgentStops = resolvable.filter(w => w.priority === "URGENT");
    const regularStops = resolvable.filter(w => w.priority !== "URGENT");

    let currentAnchor = startLoc;
    let orderedUrgent: RouteWaypoint[] = [];
    if (urgentStops.length > 0) {
      orderedUrgent = urgentStops.length <= 4
        ? findShortestPermutation(currentAnchor, urgentStops, false)
        : greedyNearestNeighbor(currentAnchor, urgentStops);
      const lastUrgent = orderedUrgent[orderedUrgent.length - 1];
      if (lastUrgent.latitude && lastUrgent.longitude) {
        currentAnchor = { name: lastUrgent.clientName, latitude: lastUrgent.latitude, longitude: lastUrgent.longitude };
      }
    }

    let orderedRegular: RouteWaypoint[] = [];
    if (regularStops.length > 0) {
      orderedRegular = regularStops.length <= 5
        ? findShortestPermutation(currentAnchor, regularStops, returnToBase)
        : greedyNearestNeighbor(currentAnchor, regularStops);
    }

    bestSequence = [...orderedUrgent, ...orderedRegular];
  } else {
    // Pure Shortest Distance (Eco-Routing)
    if (resolvable.length <= 6) {
      bestSequence = findShortestPermutation(startLoc, resolvable, returnToBase);
    } else {
      bestSequence = greedyNearestNeighbor(startLoc, resolvable);
    }
  }

  // 4. Build Leg-by-Leg Details
  const legs: RouteLeg[] = [];
  let totalDistanceKm = 0;
  let currentPointName = startLoc.name;
  let currentLat = startLoc.latitude;
  let currentLng = startLoc.longitude;

  for (const stop of bestSequence) {
    if (stop.latitude !== null && stop.longitude !== null) {
      const legDist = haversineKm(currentLat, currentLng, stop.latitude, stop.longitude);
      const legMins = Math.round((legDist / avgSpeedKmh) * 60);

      legs.push({
        fromName: currentPointName,
        toName: `${stop.clientName} (${stop.areaName})`,
        toInspectionId: stop.id,
        distanceKm: legDist,
        estimatedMinutes: legMins
      });

      totalDistanceKm += legDist;
      currentPointName = `${stop.clientName} (${stop.areaName})`;
      currentLat = stop.latitude;
      currentLng = stop.longitude;
    }
  }

  if (returnToBase && bestSequence.length > 0) {
    const returnDist = haversineKm(currentLat, currentLng, startLoc.latitude, startLoc.longitude);
    const returnMins = Math.round((returnDist / avgSpeedKmh) * 60);
    legs.push({
      fromName: currentPointName,
      toName: `${startLoc.name} (Return)`,
      distanceKm: returnDist,
      estimatedMinutes: returnMins
    });
    totalDistanceKm += returnDist;
  }

  totalDistanceKm = Math.round(totalDistanceKm * 10) / 10;
  const totalEstimatedMinutes = Math.round((totalDistanceKm / avgSpeedKmh) * 60);
  const estimatedFuelLitres = Math.round(totalDistanceKm * fuelLitrePerKm * 10) / 10;

  // 5. Savings vs Unoptimized
  const distanceSavedKm = Math.max(0, Math.round((unoptimizedDistanceKm - totalDistanceKm) * 10) / 10);
  const timeSavedMinutes = Math.round((distanceSavedKm / avgSpeedKmh) * 60);
  const fuelSavedLitres = Math.round(distanceSavedKm * fuelLitrePerKm * 10) / 10;

  // 6. Generate Multi-Stop Google Maps Navigation URL
  const googleMapsUrl = generateGoogleMapsUrl(startLoc, bestSequence, returnToBase);

  // Combine resolvable in optimal sequence + unresolvable at end
  const finalOptimizedOrder = [...bestSequence, ...unresolvable];

  return {
    optimizedOrder: finalOptimizedOrder,
    legs,
    totalDistanceKm,
    totalEstimatedMinutes,
    estimatedFuelLitres,
    unoptimizedDistanceKm,
    distanceSavedKm,
    timeSavedMinutes,
    fuelSavedLitres,
    googleMapsUrl,
    unresolvedCount: unresolvable.length,
    modeUsed: mode
  };
}

function findShortestPermutation(
  start: { latitude: number; longitude: number },
  stops: RouteWaypoint[],
  returnToBase: boolean
): RouteWaypoint[] {
  const perms = getPermutations(stops);
  let bestDist = Infinity;
  let bestSeq = stops;

  for (const perm of perms) {
    const dist = calculatePathDistance(start, perm, returnToBase);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeq = perm;
    }
  }

  return bestSeq;
}

function generateGoogleMapsUrl(
  start: { latitude: number; longitude: number },
  stops: RouteWaypoint[],
  returnToBase: boolean
): string {
  if (stops.length === 0) return "";

  const validStops = stops.filter(s => s.latitude !== null && s.longitude !== null);
  if (validStops.length === 0) return "";

  const origin = `${start.latitude},${start.longitude}`;
  const destination = returnToBase ? origin : `${validStops[validStops.length - 1].latitude},${validStops[validStops.length - 1].longitude}`;

  const waypointsList = returnToBase
    ? validStops.map(s => `${s.latitude},${s.longitude}`)
    : validStops.slice(0, -1).map(s => `${s.latitude},${s.longitude}`);

  const waypointsParam = waypointsList.length > 0 ? `&waypoints=${encodeURIComponent(waypointsList.join("|"))}` : "";

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
}
