import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  AlertTriangle,
  User,
  Shield,
  FileText,
  Send,
  Navigation,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import {
  SAUDI_INDUSTRIAL_ZONES,
  parseLocationInput,
  ParsedLocationResult,
} from "../utils/siteLocationParser";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    siteAreaName?: string;
    siteLatitudeHint?: number;
    siteLongitudeHint?: number;
    locationInput?: string;
    priority: "LOW" | "NORMAL" | "URGENT";
    priorityReason?: string;
    requestedInspectorId?: string;
    requestedInspectorReason?: string;
    requiredCertifications?: string[];
    requestNote?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  defaultAreaName?: string;
}

export function SiteInspectionRequestModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  defaultAreaName = "",
}: RequestModalProps) {
  const [siteAreaName, setSiteAreaName] = useState(defaultAreaName);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [locationInput, setLocationInput] = useState<string>("");
  const [parsedLocation, setParsedLocation] = useState<ParsedLocationResult | null>(null);

  const [latHint, setLatHint] = useState<string>("");
  const [lngHint, setLngHint] = useState<string>("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "URGENT">("NORMAL");
  const [priorityReason, setPriorityReason] = useState("");
  const [requestedInspectorId, setRequestedInspectorId] = useState("");
  const [requestedInspectorReason, setRequestedInspectorReason] = useState("");
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [requestNote, setRequestNote] = useState("");
  const [inspectors, setInspectors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      siteInspectionApi
        .getSiteManagers()
        .then((data) => setInspectors(data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    if (!zoneId) return;

    const zone = SAUDI_INDUSTRIAL_ZONES.find((z) => z.id === zoneId);
    if (zone) {
      setSiteAreaName(zone.name);
      setLatHint(String(zone.latitude));
      setLngHint(String(zone.longitude));
      setError(null);
    }
  };

  const handleLocationInputChange = (val: string) => {
    setLocationInput(val);
    if (!val.trim()) {
      setParsedLocation(null);
      return;
    }

    const res = parseLocationInput(val);
    setParsedLocation(res);

    if (res.latitude != null && res.longitude != null) {
      setLatHint(String(res.latitude));
      setLngHint(String(res.longitude));
      if (!siteAreaName || siteAreaName === "Location not set" || siteAreaName.length < 3) {
        setSiteAreaName(res.areaName);
      }
    }
  };

  const handleCertToggle = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedArea = siteAreaName.trim();
    if (!trimmedArea || trimmedArea.length < 2) {
      setError("Please specify a valid project site area or select an industrial zone.");
      return;
    }

    if (trimmedArea.length === 1) {
      setError(`"${trimmedArea}" is too short. Please enter a full area name like "Jubail 2" or "Ras Tanura".`);
      return;
    }

    if (priority === "URGENT" && !priorityReason.trim()) {
      setError("Priority URGENT requires a justification reason.");
      return;
    }

    if (requestedInspectorId && !requestedInspectorReason.trim()) {
      setError("Requesting a specific inspector requires a justification reason.");
      return;
    }

    const payload: any = {
      siteAreaName: trimmedArea,
      siteLatitudeHint: latHint ? parseFloat(latHint) : undefined,
      siteLongitudeHint: lngHint ? parseFloat(lngHint) : undefined,
      locationInput: locationInput.trim() || undefined,
      priority,
      priorityReason: priority === "URGENT" ? priorityReason.trim() : undefined,
      requestedInspectorId: requestedInspectorId || undefined,
      requestedInspectorReason: requestedInspectorId ? requestedInspectorReason.trim() : undefined,
      requiredCertifications: selectedCerts.length > 0 ? selectedCerts : undefined,
      requestNote: requestNote.trim() || undefined,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit request.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Request Site Inspection
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Dispatch site manager & configure assignment criteria
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

          {/* 1. Quick Industrial Zone Preset Dropdown */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Select Industrial Zone or City</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Pre-calibrated GPS</span>
            </label>
            <select
              value={selectedZoneId}
              onChange={(e) => handleZoneSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose standard Saudi industrial zone --</option>
              {SAUDI_INDUSTRIAL_ZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} ({zone.region})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Custom Area / Gate Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Project Site Area &amp; Gate Details <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={siteAreaName}
              onChange={(e) => {
                setSiteAreaName(e.target.value);
                setSelectedZoneId("");
              }}
              placeholder="e.g. Jubail Industrial City 2, Support Area Gate 4"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* 3. Google Maps Link / National Address Code */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Google Maps URL, Coordinates, or National Address</span>
              </label>
            </div>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              placeholder="Paste https://maps.app.goo.gl/..., 27.02,49.61, or JBLA2941"
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400"
            />
            {parsedLocation && parsedLocation.confidence === "EXACT" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                <span>GPS Coordinates detected: {parsedLocation.latitude?.toFixed(4)}° N, {parsedLocation.longitude?.toFixed(4)}° E</span>
              </div>
            )}
            {parsedLocation && parsedLocation.source === "NATIONAL_ADDRESS" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-indigo-600" />
                <span>{parsedLocation.areaName}</span>
              </div>
            )}
          </div>

          {/* Coordinates Hint Preview */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={latHint}
                onChange={(e) => setLatHint(e.target.value)}
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
                value={lngHint}
                onChange={(e) => setLngHint(e.target.value)}
                placeholder="49.6100"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Inspection Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["LOW", "NORMAL", "URGENT"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                    priority === p
                      ? p === "URGENT"
                        ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300"
                        : "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {priority === "URGENT" && (
              <div className="pt-2 space-y-1">
                <label className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Priority Justification Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={priorityReason}
                  onChange={(e) => setPriorityReason(e.target.value)}
                  placeholder="e.g. Aramco turnaround audit scheduled for tomorrow morning"
                  className="w-full px-3 py-1.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Requested Specific Inspector */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Request Specific Inspector (Optional)</span>
            </label>
            <select
              value={requestedInspectorId}
              onChange={(e) => setRequestedInspectorId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="">Auto-assign closest inspector (Default)</option>
              {inspectors.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name} ({ins.email})
                </option>
              ))}
            </select>

            {requestedInspectorId && (
              <div className="pt-2 space-y-1">
                <label className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  Inspector Request Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={requestedInspectorReason}
                  onChange={(e) => setRequestedInspectorReason(e.target.value)}
                  placeholder="e.g. Client requested previous auditor who knows their facility safety protocol"
                  className="w-full px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Required Certifications */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Required Certifications</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                "ARAMCO_APPROVED",
                "SABIC_PASSPORT",
                "HAZMAT_CERTIFIED",
                "CONFINED_SPACE",
                "OFFSHORE_BOSIET",
              ].map((cert) => {
                const isChecked = selectedCerts.includes(cert);
                return (
                  <button
                    type="button"
                    key={cert}
                    onClick={() => handleCertToggle(cert)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {cert.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Request Notes */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Inspection Notes / Gate Instructions</span>
            </label>
            <textarea
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              rows={2}
              placeholder="e.g. Enter through Gate 4, ask for Eng. Fahad at security reception."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Dispatching..." : "Submit Inspection Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
