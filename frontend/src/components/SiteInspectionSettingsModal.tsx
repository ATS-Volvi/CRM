import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Sliders,
  Calendar,
  Users,
  Shield,
  History,
  CheckCircle2,
  AlertTriangle,
  Save,
  Plus,
  Trash2,
  MapPin,
  Clock,
  RotateCcw,
  Info,
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type TabType = "engine" | "holidays" | "inspectors" | "audit";

export function SiteInspectionSettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("engine");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [effectExplanations, setEffectExplanations] = useState<Record<string, string>>({});

  // Settings State
  const [settings, setSettings] = useState({
    assignmentMode: "legacy" as "legacy" | "nearest" | "balanced",
    maxOpenInspections: 5,
    maxVisitsPerDay: 4,
    maxDistanceKm: 300,
    balancedWeights: { distance: 0.5, load: 0.5 },
    workingHours: { start: "08:00", end: "17:00" },
    automation: false,
    autoQualify: false,
  });

  // Holidays State
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState({
    date: "",
    name: "",
    isRecurringYearly: false,
    notes: "",
  });

  // Inspectors State
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [editingInspector, setEditingInspector] = useState<any | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedSettings, fetchedHolidays, fetchedInspectors, fetchedLogs] = await Promise.all([
        siteInspectionApi.getSettings(),
        siteInspectionApi.getHolidays().catch(() => []),
        siteInspectionApi.getInspectorProfiles().catch(() => []),
        siteInspectionApi.getAuditLogs({ limit: 20 }).catch(() => ({ rows: [] })),
      ]);

      if (fetchedSettings) {
        setSettings({
          assignmentMode: fetchedSettings.assignmentMode || "legacy",
          maxOpenInspections: fetchedSettings.maxOpenInspections || 5,
          maxVisitsPerDay: fetchedSettings.maxVisitsPerDay || 4,
          maxDistanceKm: fetchedSettings.maxDistanceKm || 300,
          balancedWeights: fetchedSettings.balancedWeights || { distance: 0.5, load: 0.5 },
          workingHours: fetchedSettings.workingHours || { start: "08:00", end: "17:00" },
          automation: Boolean(fetchedSettings.automation),
          autoQualify: Boolean(fetchedSettings.autoQualify),
        });
      }
      setHolidays(fetchedHolidays || []);
      setInspectors(fetchedInspectors || []);
      setAuditLogs(fetchedLogs?.rows || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load settings data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await siteInspectionApi.updateSettings({
        assignmentMode: settings.assignmentMode,
        maxOpenInspections: Number(settings.maxOpenInspections),
        maxVisitsPerDay: Number(settings.maxVisitsPerDay),
        maxDistanceKm: Number(settings.maxDistanceKm),
        balancedWeights: settings.balancedWeights,
        workingHours: settings.workingHours,
        automation: settings.automation,
        autoQualify: settings.autoQualify,
      });

      setSuccessMessage("Settings updated successfully.");
      if (res?.explanations) {
        setEffectExplanations(res.explanations);
      }
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name.trim()) return;
    try {
      const created = await siteInspectionApi.addHoliday(newHoliday);
      setHolidays((prev) => [...prev, created]);
      setNewHoliday({ date: "", name: "", isRecurringYearly: false, notes: "" });
    } catch (err: any) {
      setError(err?.message || "Failed to add holiday.");
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await siteInspectionApi.deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete holiday.");
    }
  };

  const handleSaveInspectorProfile = async () => {
    if (!editingInspector) return;
    try {
      await siteInspectionApi.updateInspectorProfile(editingInspector.userId, {
        isAvailable: editingInspector.isAvailable,
        maxOpenInspections: Number(editingInspector.maxOpenInspections),
        maxVisitsPerDay: Number(editingInspector.maxVisitsPerDay),
        maxDistanceKm: Number(editingInspector.maxDistanceKm),
        leaveStartDate: editingInspector.leaveStartDate || null,
        leaveEndDate: editingInspector.leaveEndDate || null,
        certifications: editingInspector.certifications,
      });
      setEditingInspector(null);
      loadAllData();
    } catch (err: any) {
      setError(err?.message || "Failed to update inspector profile.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Site Inspection Engine & SLA Settings
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Phase 2 Intelligent Assignment Engine, Working Hours & Inspector Governance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-100 dark:border-slate-800 gap-1 bg-white dark:bg-slate-900">
          {[
            { key: "engine", label: "Assignment Engine", icon: Sliders },
            { key: "holidays", label: "Working Hours & Holidays", icon: Calendar },
            { key: "inspectors", label: "Inspector Profiles", icon: Users },
            { key: "audit", label: "Audit Trail", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: ASSIGNMENT ENGINE */}
          {activeTab === "engine" && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Assignment Mode Selection */}
              <div className="space-y-2">
                <label className="font-extrabold text-sm text-slate-900 dark:text-white block">
                  Assignment Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "legacy",
                      name: "Legacy Mode",
                      desc: "Round Robin / Lowest Open Workload. No distance filtering.",
                    },
                    {
                      id: "nearest",
                      name: "Nearest Mode",
                      desc: "Shortest Proximity from inspector base or home to project site.",
                    },
                    {
                      id: "balanced",
                      name: "Balanced Mode",
                      desc: "Weighted scoring combining proximity and active inspector workload.",
                    },
                  ].map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => setSettings((s) => ({ ...s, assignmentMode: mode.id as any }))}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        settings.assignmentMode === mode.id
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {mode.name}
                        </span>
                        {settings.assignmentMode === mode.id && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">{mode.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balanced Weights Slider (if balanced) */}
              {settings.assignmentMode === "balanced" && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 dark:text-white">
                      Balanced Mode Weighting Ratio
                    </label>
                    <span className="font-mono text-xs font-black text-indigo-600">
                      {Math.round(settings.balancedWeights.distance * 100)}% Distance /{" "}
                      {Math.round(settings.balancedWeights.load * 100)}% Workload
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.balancedWeights.distance}
                    onChange={(e) => {
                      const dist = parseFloat(e.target.value);
                      const load = parseFloat((1 - dist).toFixed(2));
                      setSettings((s) => ({
                        ...s,
                        balancedWeights: { distance: dist, load },
                      }));
                    }}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>100% Proximity Prioritized</span>
                    <span>50/50 Equal Ratio</span>
                    <span>100% Workload Prioritized</span>
                  </div>
                </div>
              )}

              {/* Capacity Limits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Max Open Inspections
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.maxOpenInspections}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maxOpenInspections: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Inspectors with this many open inspections are disqualified.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Max Visits Per Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.maxVisitsPerDay}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maxVisitsPerDay: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Limits scheduled field audits per inspector on the same day.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Max Travel Distance (km)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.maxDistanceKm}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maxDistanceKm: parseInt(e.target.value) || 10 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Proximity cutoff for Nearest and Balanced modes.
                  </p>
                </div>
              </div>

              {/* Explanations Display */}
              {Object.keys(effectExplanations).length > 0 && (
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>Configuration Effect Summary</span>
                  </span>
                  <div className="space-y-1 text-[11px] text-indigo-800 dark:text-indigo-300">
                    {Object.entries(effectExplanations).map(([key, desc]) => (
                      <div key={key} className="flex items-start gap-1.5">
                        <span className="text-indigo-500">•</span>
                        <span>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving Changes..." : "Save Engine Settings"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: WORKING HOURS & HOLIDAYS */}
          {activeTab === "holidays" && (
            <div className="space-y-6">
              {/* Working Hours Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    Official Working Calendar (Asia/Riyadh)
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Sunday to Thursday, 08:00 AM – 05:00 PM (AST). SLA timers pause outside these hours and on holidays.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono font-bold">
                  Sun – Thu · 08:00 - 17:00
                </div>
              </div>

              {/* Add Holiday Form */}
              <form
                onSubmit={handleAddHoliday}
                className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <h4 className="font-bold text-slate-900 dark:text-white">Add Public Holiday</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Holiday Date
                    </label>
                    <input
                      type="date"
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Holiday Name
                    </label>
                    <input
                      type="text"
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
                      placeholder="e.g. Saudi National Day"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={newHoliday.notes}
                      onChange={(e) => setNewHoliday((h) => ({ ...h, notes: e.target.value }))}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newHoliday.isRecurringYearly}
                      onChange={(e) =>
                        setNewHoliday((h) => ({ ...h, isRecurringYearly: e.target.checked }))
                      }
                      className="rounded accent-indigo-600"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Recurring yearly holiday
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Holiday</span>
                  </button>
                </div>
              </form>

              {/* Holidays Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Holiday Name</th>
                      <th className="px-4 py-3">Recurring</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No official holidays configured yet.
                        </td>
                      </tr>
                    ) : (
                      holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {h.date}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {h.name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {h.isRecurringYearly ? "Yes (Annual)" : "One-time"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{h.notes || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INSPECTOR PROFILES */}
          {activeTab === "inspectors" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Site Inspector Profiles</h4>
                  <p className="text-slate-500 text-[11px]">
                    Manage individual capacities, certifications, and leave schedules
                  </p>
                </div>
              </div>

              {/* Inspector Profiles Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Inspector</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Max Load</th>
                      <th className="px-4 py-3">Max Dist</th>
                      <th className="px-4 py-3">Certifications</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inspectors.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No site manager profiles found.
                        </td>
                      </tr>
                    ) : (
                      inspectors.map((insp) => {
                        const certs: string[] = Array.isArray(insp.profile?.certifications)
                          ? insp.profile.certifications
                          : [];
                        return (
                          <tr key={insp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {insp.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{insp.email}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  insp.profile?.isAvailable && insp.isAvailable
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {insp.profile?.isAvailable && insp.isAvailable ? "Available" : "Unavailable"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                              {insp.profile?.maxOpenInspections || 5} open
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {insp.profile?.maxDistanceKm || 300} km
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {certs.length > 0 ? (
                                  certs.map((c) => (
                                    <span
                                      key={c}
                                      className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold"
                                    >
                                      {c}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() =>
                                  setEditingInspector({
                                    userId: insp.id,
                                    name: insp.name,
                                    isAvailable: insp.profile?.isAvailable ?? true,
                                    maxOpenInspections: insp.profile?.maxOpenInspections || 5,
                                    maxVisitsPerDay: insp.profile?.maxVisitsPerDay || 4,
                                    maxDistanceKm: insp.profile?.maxDistanceKm || 300,
                                    leaveStartDate: insp.profile?.leaveStartDate || "",
                                    leaveEndDate: insp.profile?.leaveEndDate || "",
                                    certifications: certs,
                                  })
                                }
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Edit Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Edit Inspector Modal */}
              {editingInspector && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h5 className="font-bold text-slate-900 dark:text-white">
                      Edit Inspector Profile: {editingInspector.name}
                    </h5>
                    <button
                      onClick={() => setEditingInspector(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Max Open Inspections
                      </label>
                      <input
                        type="number"
                        value={editingInspector.maxOpenInspections}
                        onChange={(e) =>
                          setEditingInspector((p: any) => ({
                            ...p,
                            maxOpenInspections: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Max Travel Distance (km)
                      </label>
                      <input
                        type="number"
                        value={editingInspector.maxDistanceKm}
                        onChange={(e) =>
                          setEditingInspector((p: any) => ({
                            ...p,
                            maxDistanceKm: parseInt(e.target.value) || 10,
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Availability Status
                      </label>
                      <select
                        value={editingInspector.isAvailable ? "true" : "false"}
                        onChange={(e) =>
                          setEditingInspector((p: any) => ({
                            ...p,
                            isAvailable: e.target.value === "true",
                          }))
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                      >
                        <option value="true">Active / Available</option>
                        <option value="false">Unavailable</option>
                      </select>
                    </div>
                  </div>

                  {/* Certifications */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                      Scope Certifications
                    </label>
                    <div className="flex gap-2">
                      {["GENERAL", "SEWAGE", "HAZARDOUS"].map((cert) => {
                        const active = editingInspector.certifications.includes(cert);
                        return (
                          <button
                            type="button"
                            key={cert}
                            onClick={() => {
                              setEditingInspector((p: any) => ({
                                ...p,
                                certifications: active
                                  ? p.certifications.filter((c: string) => c !== cert)
                                  : [...p.certifications, cert],
                              }));
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              active
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-slate-900 border-slate-200 text-slate-500"
                            }`}
                          >
                            {cert}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingInspector(null)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveInspectorProfile}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Immutable Governance Audit Trail
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Tamper-evident record of assignment decisions, manual overrides, and setting changes
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Reason / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          No audit log entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(log.createdAt).toISOString().replace("T", " ").substring(0, 19)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {log.actor?.name || log.actorRole || "System"}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-sans">
                            {log.reason || log.toValue || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
