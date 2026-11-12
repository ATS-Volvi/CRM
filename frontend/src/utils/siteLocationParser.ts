/**
 * Frontend Site Inspection Location & Navigation Parser
 */

export interface ParsedLocationResult {
  latitude: number | null;
  longitude: number | null;
  areaName: string;
  source: "COORDINATES" | "GOOGLE_MAPS_URL" | "NATIONAL_ADDRESS" | "PRESET_ZONE" | "CUSTOM_TEXT";
  confidence: "EXACT" | "REGIONAL_APPROX" | "TEXT_ONLY";
  googleMapsUrl?: string;
}

export interface IndustrialZonePreset {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  description: string;
}

export const SAUDI_INDUSTRIAL_ZONES: IndustrialZonePreset[] = [
  {
    id: "jubail_2",
    name: "Jubail Industrial City 2",
    region: "Eastern Province",
    latitude: 27.0600,
    longitude: 49.5200,
    description: "Support Industries, King Fahd Industrial Port & Heavy Plants"
  },
  {
    id: "jubail_1",
    name: "Jubail Industrial City 1",
    region: "Eastern Province",
    latitude: 27.0125,
    longitude: 49.6200,
    description: "SABIC Petrochemical Corridor & Royal Commission Area"
  },
  {
    id: "ras_tanura",
    name: "Ras Tanura / Tanajib",
    region: "Eastern Province",
    latitude: 26.6500,
    longitude: 50.1500,
    description: "Refinery Complex, Marine Terminal & Offshore Hub"
  },
  {
    id: "dammam_2",
    name: "Dammam 2nd Industrial City (MODON)",
    region: "Eastern Province",
    latitude: 26.2300,
    longitude: 49.9800,
    description: "MODON 2nd Industrial Area, Fabrication & Oilfield Equipment"
  },
  {
    id: "dammam_1",
    name: "Dammam 1st Industrial City",
    region: "Eastern Province",
    latitude: 26.3900,
    longitude: 50.1400,
    description: "Port Area, Light Manufacturing & Warehouses"
  },
  {
    id: "khobar_dhahran",
    name: "Al Khobar / Dhahran",
    region: "Eastern Province",
    latitude: 26.2800,
    longitude: 50.2100,
    description: "Aramco Tech Hub & Commercial Centers"
  },
  {
    id: "jafurah",
    name: "Jafurah Gas Basin",
    region: "Eastern Province",
    latitude: 25.5500,
    longitude: 49.8500,
    description: "Unconventional Gas Field, Remote Operations & Exploration"
  },
  {
    id: "yanbu_ind",
    name: "Yanbu Industrial City",
    region: "Western Province",
    latitude: 24.0100,
    longitude: 38.1500,
    description: "Royal Commission Petrochemical Zone & Red Sea Port"
  },
  {
    id: "riyadh_modon_2",
    name: "Riyadh 2nd Industrial City",
    region: "Central Province",
    latitude: 24.5700,
    longitude: 46.8800,
    description: "MODON South Riyadh, Food, Chemical & Heavy Plants"
  },
  {
    id: "jeddah_ind_1",
    name: "Jeddah Industrial City (Phase 1 & 2)",
    region: "Western Province",
    latitude: 21.4300,
    longitude: 39.2500,
    description: "South Jeddah Manufacturing & Marine Logistics"
  }
];

const NATIONAL_ADDRESS_PREFIX_MAP: Record<string, { lat: number; lng: number; area: string }> = {
  JBL: { lat: 27.02, lng: 49.61, area: "Jubail Industrial" },
  RDM: { lat: 26.42, lng: 50.09, area: "Dammam MODON" },
  KHB: { lat: 26.28, lng: 50.21, area: "Al Khobar" },
  RYD: { lat: 24.71, lng: 46.68, area: "Riyadh Central" },
  YNB: { lat: 24.09, lng: 38.06, area: "Yanbu Industrial" },
  JED: { lat: 21.54, lng: 39.17, area: "Jeddah" },
  RTN: { lat: 26.65, lng: 50.15, area: "Ras Tanura" }
};

export function parseLocationInput(rawInput: string): ParsedLocationResult {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) {
    return {
      latitude: null,
      longitude: null,
      areaName: "",
      source: "CUSTOM_TEXT",
      confidence: "TEXT_ONLY"
    };
  }

  // 1. Raw Coordinates check: e.g. "27.0214, 49.6120"
  const cleanCoordStr = trimmed.replace(/[°NSEW]/gi, "");
  const coordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  const coordMatch = cleanCoordStr.match(/([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)/);
  if (coordMatch && coordRegex.test(cleanCoordStr.replace(/\s+/g, " ").trim())) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        latitude: Math.round(lat * 100000) / 100000,
        longitude: Math.round(lng * 100000) / 100000,
        areaName: `GPS (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`,
        source: "COORDINATES",
        confidence: "EXACT",
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      };
    }
  }

  // 2. Google Maps URLs
  if (
    trimmed.includes("google.com/maps") ||
    trimmed.includes("maps.google.") ||
    trimmed.includes("maps.app.goo.gl") ||
    trimmed.includes("goo.gl/maps")
  ) {
    const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      return {
        latitude: lat,
        longitude: lng,
        areaName: "Google Maps Pin",
        source: "GOOGLE_MAPS_URL",
        confidence: "EXACT",
        googleMapsUrl: trimmed
      };
    }

    const queryMatch = trimmed.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (queryMatch) {
      const lat = parseFloat(queryMatch[1]);
      const lng = parseFloat(queryMatch[2]);
      return {
        latitude: lat,
        longitude: lng,
        areaName: "Google Maps Pin",
        source: "GOOGLE_MAPS_URL",
        confidence: "EXACT",
        googleMapsUrl: trimmed
      };
    }

    const protoMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (protoMatch) {
      const lat = parseFloat(protoMatch[1]);
      const lng = parseFloat(protoMatch[2]);
      return {
        latitude: lat,
        longitude: lng,
        areaName: "Google Maps Place Pin",
        source: "GOOGLE_MAPS_URL",
        confidence: "EXACT",
        googleMapsUrl: trimmed
      };
    }

    return {
      latitude: null,
      longitude: null,
      areaName: "Google Maps Link",
      source: "GOOGLE_MAPS_URL",
      confidence: "TEXT_ONLY",
      googleMapsUrl: trimmed
    };
  }

  // 3. Saudi National Address Code
  const nationalAddressMatch = trimmed.match(/^([A-Za-z]{3,4})\s*(\d{4})$/);
  if (nationalAddressMatch) {
    const prefix = nationalAddressMatch[1].toUpperCase().slice(0, 3);
    const code = `${nationalAddressMatch[1].toUpperCase()}${nationalAddressMatch[2]}`;
    const hub = NATIONAL_ADDRESS_PREFIX_MAP[prefix];
    if (hub) {
      return {
        latitude: hub.lat,
        longitude: hub.lng,
        areaName: `National Address: ${code} (${hub.area})`,
        source: "NATIONAL_ADDRESS",
        confidence: "REGIONAL_APPROX",
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${hub.lat},${hub.lng}`
      };
    }
  }

  // 4. Match against Saudi Industrial Zones presets
  const lower = trimmed.toLowerCase();
  for (const zone of SAUDI_INDUSTRIAL_ZONES) {
    const zoneLower = zone.name.toLowerCase();
    const idLower = zone.id.replace(/_/g, " ");
    if (
      lower === zoneLower ||
      lower === zone.id ||
      lower.includes(zoneLower) ||
      lower.includes(idLower) ||
      (lower.includes("jubail") && lower.includes("2") && zone.id === "jubail_2") ||
      (lower.includes("jubail") && (lower.includes("1") || lower.includes("support")) && zone.id === "jubail_1") ||
      (lower.includes("dammam") && lower.includes("2") && zone.id === "dammam_2") ||
      (lower.includes("dammam") && lower.includes("1") && zone.id === "dammam_1") ||
      (lower.includes("ras tanura") && zone.id === "ras_tanura") ||
      (lower.includes("yanbu") && zone.id === "yanbu_ind") ||
      (lower.includes("jafurah") && zone.id === "jafurah")
    ) {
      return {
        latitude: zone.latitude,
        longitude: zone.longitude,
        areaName: zone.name,
        source: "PRESET_ZONE",
        confidence: "REGIONAL_APPROX",
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${zone.latitude},${zone.longitude}`
      };
    }
  }

  return {
    latitude: null,
    longitude: null,
    areaName: trimmed,
    source: "CUSTOM_TEXT",
    confidence: "TEXT_ONLY"
  };
}
