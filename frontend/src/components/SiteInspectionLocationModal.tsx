import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Sparkles,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import { SiteInspectionRecord } from "../lib/siteInspection";
import {
  SAUDI_INDUSTRIAL_ZONES,
  parseLocationInput,
  ParsedLocationResult,
} from "../utils/siteLocationParser";

interface LocationModalProps {
  isOpen: boolean;
  inspection: SiteInspectionRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SiteInspectionLocationModal({
  isOpen,
  inspection,
  onClose,
  onSaved,
}: LocationModalProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [siteAreaName, setSiteAreaName] = useState<string>("");
  const [siteAddress, setSiteAddress] = useState<string>("");
  const [locationInput, setLocationInput] = useState<string>("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedLocationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && inspection) {
      setSiteAreaName(inspection.siteAreaName || "");
      setSiteAddress(inspection.siteAddress || "");
      setLat(inspection.latitude != null ? String(inspection.latitude) : "");
      setLng(inspection.longitude != null ? String(inspection.longitude) : "");
      setLocationInput("");
      setParsed(null);
      setSelectedZoneId("");
      setError(null);
    }
  }, [isOpen, inspection]);

  if (!isOpen || !inspection) return null;

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    if (!zoneId) return;

    const zone = SAUDI_INDUSTRIAL_ZONES.find((z) => z.id === zoneId);
    if (zone) {
      setSiteAreaName(zone.name);
      setLat(String(zone.latitude));
      setLng(String(zone.longitude));
      setError(null);
    }
  };

  const handleLocationInputChange = (val: string) => {
    setLocationInput(val);
    if (!val.trim()) {
      setParsed(null);
      return;
    }

    const res = parseLocationInput(val);
    setParsed(res);

    if (res.latitude != null && res.longitude != null) {
      setLat(String(res.latitude));
      setLng(String(res.longitude));
      if (!siteAreaName || siteAreaName === "Location not set" || siteAreaName.length < 3) {
        setSiteAreaName(res.areaName);
      }
    }
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser/device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = Math.round(pos.coords.latitude * 100000) / 100000;
        const currentLng = Math.round(pos.coords.longitude * 100000) / 100000;
        setLat(String(currentLat));
        setLng(String(currentLng));
        if (!siteAreaName || siteAreaName === "Location not set") {
          setSiteAreaName("Mobile GPS Pin");
        }
      },
      (err) => {
        alert("Failed to get current GPS location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedArea = siteAreaName.trim();
    if (!trimmedArea && !lat && !lng && !locationInput.trim()) {
      setError("Please select a zone, enter an area name, or paste a Google Maps link.");
      return;
    }

    setIsSaving(true);
    try {
      await siteInspectionApi.updateLocation(inspection.id, {
        locationInput: locationInput.trim() || undefined,
        siteAreaName: trimmedArea || undefined,
        siteAddress: siteAddress.trim() || undefined,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update location.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Set Site Inspection Location
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {inspection.inspectionNumber} • {inspection.clientOrganization || inspection.siteName || "Client Facility"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Preset Zone Dropdown */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Standard Saudi Industrial Zone</span>
              <span className="text-[10px] text-slate-400 font-normal">Pre-configured coordinates</span>
            </label>
            <select
              value={selectedZoneId}
              onChange={(e) => handleZoneSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose industrial zone or city --</option>
              {SAUDI_INDUSTRIAL_ZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} ({zone.region})
                </option>
              ))}
            </select>
          </div>

          {/* Paste Google Maps Link or Coordinates */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Maps URL, Coordinates, or National Address</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Capture current phone/device GPS location"
              >
                <Navigation className="w-2.5 h-2.5" />
                <span>My Location</span>
              </button>
            </div>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              placeholder="Paste https://maps.app.goo.gl/..., 27.02,49.61, or JBLA2941"
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400"
            />
            {parsed && parsed.confidence === "EXACT" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                <span>GPS Pin Detected: {parsed.latitude?.toFixed(4)}° N, {parsed.longitude?.toFixed(4)}° E</span>
              </div>
            )}
            {parsed && parsed.source === "NATIONAL_ADDRESS" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-indigo-600" />
                <span>{parsed.areaName}</span>
              </div>
            )}
          </div>

          {/* Project Area Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Project Area Name
            </label>
            <input
              type="text"
              value={siteAreaName}
              onChange={(e) => setSiteAreaName(e.target.value)}
              placeholder="e.g. Jubail Industrial City 2, Support Industries"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Plant Gate / Specific Street Address */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Plant Gate / Physical Address (Optional)
            </label>
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="e.g. Road 114, Gate 3, opposite SABIC Hadeed"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Exact Coordinates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="27.0200"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="49.6100"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Location Pin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
