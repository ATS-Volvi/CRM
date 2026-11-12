// Client-side route optimization & offline-capable geometric distance calculation

export interface Waypoint {
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

export interface RouteLeg {
  fromName: string;
  toName: string;
  toInspectionId?: string;
  distanceKm: number;
  estimatedMinutes: number;
}

export interface ClientRouteResult {
  optimizedOrder: Waypoint[];
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

const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  jubail: { lat: 27.0, lng: 49.65 },
  jafurah: { lat: 25.55, lng: 49.85 },
  yanbu: { lat: 24.09, lng: 38.06 },
  riyadh: { lat: 24.71, lng: 46.68 },
  dammam: { lat: 26.42, lng: 50.09 },
  khobar: { lat: 26.28, lng: 50.21 },
  jeddah: { lat: 21.54, lng: 39.17 },
  ras_tanura: { lat: 26.65, lng: 50.15 },
  eastern_province: { lat: 26.42, lng: 50.09 },
  western_province: { lat: 21.54, lng: 39.17 },
  central_province: { lat: 24.71, lng: 46.68 },
};

export function clientHaversineKm(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function clientResolveCoordinates(raw: any): {
  latitude: number | null;
  longitude: number | null;
  resolvedSource: "GPS_EXPLICIT" | "REGION_FALLBACK" | "UNRESOLVED";
} {
  const lat = Number(raw.latitude ?? raw.siteLatitudeHint);
  const lng = Number(raw.longitude ?? raw.siteLongitudeHint);

  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng, resolvedSource: "GPS_EXPLICIT" };
  }

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

function calculatePathDistance(
  start: { latitude: number; longitude: number },
  stops: Waypoint[],
  returnToBase: boolean
): number {
  if (stops.length === 0) return 0;
  let total = 0;
  let curLat = start.latitude;
  let curLng = start.longitude;

  for (const stop of stops) {
    if (stop.latitude !== null && stop.longitude !== null) {
      total += clientHaversineKm(curLat, curLng, stop.latitude, stop.longitude);
      curLat = stop.latitude;
      curLng = stop.longitude;
    }
  }

  if (returnToBase) {
    total += clientHaversineKm(curLat, curLng, start.latitude, start.longitude);
  }

  return Math.round(total * 10) / 10;
}

export function clientOptimizeDailyRoute(
  inspections: any[],
  options: {
    startLocation?: { name: string; latitude: number; longitude: number };
    returnToBase?: boolean;
    mode?: "SHORTEST_DISTANCE" | "SLA_GUARDED";
    avgSpeedKmh?: number;
    fuelLitrePerKm?: number;
  } = {}
): ClientRouteResult {
  const returnToBase = options.returnToBase ?? true;
  const mode = options.mode ?? "SHORTEST_DISTANCE";
  const avgSpeedKmh = options.avgSpeedKmh ?? 70;
  const fuelLitrePerKm = options.fuelLitrePerKm ?? 0.4;

  const startLoc = options.startLocation ?? {
    name: "Operations Base",
    latitude: 25.55,
    longitude: 49.85
  };

  const waypoints: Waypoint[] = inspections.map((ins) => {
    const resolved = clientResolveCoordinates(ins);
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

  const resolvable = waypoints.filter(w => w.hasCoordinates);
  const unresolvable = waypoints.filter(w => !w.hasCoordinates);

  const unoptimizedDistanceKm = calculatePathDistance(startLoc, resolvable, returnToBase);

  let bestSequence: Waypoint[] = [];

  if (resolvable.length === 0) {
    bestSequence = [];
  } else if (resolvable.length === 1) {
    bestSequence = [resolvable[0]];
  } else if (mode === "SLA_GUARDED") {
    const urgent = resolvable.filter(w => w.priority === "URGENT");
    const regular = resolvable.filter(w => w.priority !== "URGENT");

    let currentAnchor = startLoc;
    let orderedUrgent: Waypoint[] = [];
    if (urgent.length > 0) {
      const perms = getPermutations(urgent);
      let bestU = Infinity;
      orderedUrgent = urgent;
      for (const p of perms) {
        const d = calculatePathDistance(currentAnchor, p, false);
        if (d < bestU) {
          bestU = d;
          orderedUrgent = p;
        }
      }
      const lastU = orderedUrgent[orderedUrgent.length - 1];
      if (lastU.latitude && lastU.longitude) {
        currentAnchor = { name: lastU.clientName, latitude: lastU.latitude, longitude: lastU.longitude };
      }
    }

    let orderedRegular: Waypoint[] = [];
    if (regular.length > 0) {
      const perms = getPermutations(regular);
      let bestR = Infinity;
      orderedRegular = regular;
      for (const p of perms) {
        const d = calculatePathDistance(currentAnchor, p, returnToBase);
        if (d < bestR) {
          bestR = d;
          orderedRegular = p;
        }
      }
    }

    bestSequence = [...orderedUrgent, ...orderedRegular];
  } else {
    // SHORTEST_DISTANCE permutation search
    const perms = getPermutations(resolvable);
    let bestDist = Infinity;
    bestSequence = resolvable;
    for (const p of perms) {
      const d = calculatePathDistance(startLoc, p, returnToBase);
      if (d < bestDist) {
        bestDist = d;
        bestSequence = p;
      }
    }
  }

  const legs: RouteLeg[] = [];
  let totalDistanceKm = 0;
  let curName = startLoc.name;
  let curLat = startLoc.latitude;
  let curLng = startLoc.longitude;

  for (const stop of bestSequence) {
    if (stop.latitude !== null && stop.longitude !== null) {
      const legDist = clientHaversineKm(curLat, curLng, stop.latitude, stop.longitude);
      const legMins = Math.round((legDist / avgSpeedKmh) * 60);

      legs.push({
        fromName: curName,
        toName: `${stop.clientName} (${stop.areaName})`,
        toInspectionId: stop.id,
        distanceKm: legDist,
        estimatedMinutes: legMins
      });

      totalDistanceKm += legDist;
      curName = `${stop.clientName} (${stop.areaName})`;
      curLat = stop.latitude;
      curLng = stop.longitude;
    }
  }

  if (returnToBase && bestSequence.length > 0) {
    const returnDist = clientHaversineKm(curLat, curLng, startLoc.latitude, startLoc.longitude);
    const returnMins = Math.round((returnDist / avgSpeedKmh) * 60);
    legs.push({
      fromName: curName,
      toName: `${startLoc.name} (Return)`,
      distanceKm: returnDist,
      estimatedMinutes: returnMins
    });
    totalDistanceKm += returnDist;
  }

  totalDistanceKm = Math.round(totalDistanceKm * 10) / 10;
  const totalEstimatedMinutes = Math.round((totalDistanceKm / avgSpeedKmh) * 60);
  const estimatedFuelLitres = Math.round(totalDistanceKm * fuelLitrePerKm * 10) / 10;
  const distanceSavedKm = Math.max(0, Math.round((unoptimizedDistanceKm - totalDistanceKm) * 10) / 10);
  const timeSavedMinutes = Math.round((distanceSavedKm / avgSpeedKmh) * 60);
  const fuelSavedLitres = Math.round(distanceSavedKm * fuelLitrePerKm * 10) / 10;

  // Google Maps URL
  let googleMapsUrl = "";
  const validStops = bestSequence.filter(s => s.latitude !== null && s.longitude !== null);
  if (validStops.length > 0) {
    const origin = `${startLoc.latitude},${startLoc.longitude}`;
    const destination = returnToBase ? origin : `${validStops[validStops.length - 1].latitude},${validStops[validStops.length - 1].longitude}`;
    const waypointsList = returnToBase
      ? validStops.map(s => `${s.latitude},${s.longitude}`)
      : validStops.slice(0, -1).map(s => `${s.latitude},${s.longitude}`);
    const waypointsParam = waypointsList.length > 0 ? `&waypoints=${encodeURIComponent(waypointsList.join("|"))}` : "";
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
  }

  return {
    optimizedOrder: [...bestSequence, ...unresolvable],
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
