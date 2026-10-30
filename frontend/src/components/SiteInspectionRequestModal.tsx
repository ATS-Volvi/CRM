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
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    siteAreaName?: string;
    siteLatitudeHint?: number;
    siteLongitudeHint?: number;
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

  const handleCertToggle = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (priority === "URGENT" && !priorityReason.trim()) {
      setError("Priority URGENT requires a justification reason.");
      return;
    }

    if (requestedInspectorId && !requestedInspectorReason.trim()) {
      setError("Requesting a specific inspector requires a justification reason.");
      return;
    }

    const payload: any = {
      siteAreaName: siteAreaName.trim() || undefined,
      siteLatitudeHint: latHint ? parseFloat(latHint) : undefined,
      siteLongitudeHint: lngHint ? parseFloat(lngHint) : undefined,
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

          {/* Area / Location */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Project Site Area / City</span>
            </label>
            <input
              type="text"
              value={siteAreaName}
              onChange={(e) => setSiteAreaName(e.target.value)}
              placeholder="e.g. Jubail Industrial City, Ras Tanura, Dammam 2nd"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
            />
            <p className="text-[10px] text-slate-400">
              The engine matches this area name to find the closest available site inspector.
            </p>
          </div>

          {/* Coordinates Hint (Optional) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Latitude Hint (Optional)
              </label>
              <input
                type="number"
                step="any"
                value={latHint}
                onChange={(e) => setLatHint(e.target.value)}
                placeholder="27.0200"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Longitude Hint (Optional)
              </label>
              <input
                type="number"
                step="any"
                value={lngHint}
                onChange={(e) => setLngHint(e.target.value)}
                placeholder="49.6100"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
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
                <label className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Justification Reason for URGENT (Required)</span>
                </label>
                <textarea
                  rows={2}
                  value={priorityReason}
                  onChange={(e) => setPriorityReason(e.target.value)}
                  placeholder="Explain why this requires expedited emergency dispatch..."
                  className="w-full px-3 py-2 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Scope Certifications Required */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Required Scope Certifications</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {["GENERAL", "SEWAGE", "HAZARDOUS"].map((cert) => {
                const active = selectedCerts.includes(cert);
                return (
                  <button
                    type="button"
                    key={cert}
                    onClick={() => handleCertToggle(cert)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {cert}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Only inspectors certified in all selected scopes will be eligible for dispatch.
            </p>
          </div>

          {/* Specific Inspector Request (Optional) */}
          <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Request Specific Inspector (Optional)</span>
            </label>
            <select
              value={requestedInspectorId}
              onChange={(e) => setRequestedInspectorId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="">Auto-assign best candidate (Recommended)</option>
              {inspectors.map((insp) => (
                <option key={insp.id} value={insp.id}>
                  {insp.name} ({insp.email})
                </option>
              ))}
            </select>

            {requestedInspectorId && (
              <div className="pt-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Reason for Requesting Specific Inspector (Required)
                </label>
                <input
                  type="text"
                  value={requestedInspectorReason}
                  onChange={(e) => setRequestedInspectorReason(e.target.value)}
                  placeholder="e.g. Inspector previously audited this client facility"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Note: A requested inspector requires Ops Manager confirmation before assignment.
                </p>
              </div>
            )}
          </div>

          {/* Request Notes */}
          <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Special Instructions / Logistics Notes</span>
            </label>
            <textarea
              rows={2}
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="e.g. High security gate pass required at checkpoint; safety shoes mandatory."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Dispatching..." : "Dispatch Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
