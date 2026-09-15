import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Target, Users, Lock, Unlock, Save, ChevronDown, History, X,
  AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, UserCheck
} from "lucide-react";
import { MasterDataNav } from "../../components/MasterDataNav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId: string | null;
  department?: string | null;
  team?: string | null;
}

interface KpiMaster {
  id: string;
  name: string;
  category: string;
  targetValue: number;
  frequency: string;
  weightage: number;
  teamLeadId: string | null;
  isActive: boolean;
}

interface KpiTarget {
  id: string;
  salespersonId: string;
  kpiMasterId?: string | null;
  kpiName: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  weightage: number;
  status: "Active" | "Locked";
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  category?: string;
}

interface HistoryEntry {
  id: string;
  oldValue: number;
  newValue: number;
  reason: string;
  changeDate: string;
  changedByUser?: { name: string; email: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KpiAssignments() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const callerRole: string = user?.role ?? "";
  const callerId: string = user?.id ?? "";

  const isAdmin = ["admin", "director"].includes(callerRole);
  const isManager = ["manager", "sales_manager"].includes(callerRole);

  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, Partial<KpiTarget>>>({});
  const [historyKpiId, setHistoryKpiId] = useState<string | null>(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [bulk, setBulk] = useState<{
    kpiMasterId: string;
    kpiName: string;
    targetValue: number;
    frequency: string;
    weightage: number;
    scopeType: "selected" | "team" | "department";
    scopeValue: string;
  }>({
    kpiMasterId: "",
    kpiName: "",
    targetValue: 0,
    frequency: "monthly",
    weightage: 10,
    scopeType: "selected",
    scopeValue: "",
  });
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch reps list ──────────────────────────────────────────────────────
  const { data: reps = [] } = useQuery<Rep[]>({
    queryKey: ["reps-for-kpi-assign", callerId, callerRole],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch reps");
      const all: Rep[] = await res.json();
      // Admin sees everyone; manager sees own direct reports; rep sees only self
      if (isAdmin) return all;
      if (isManager) return all.filter((r) => r.managerId === callerId);
      return all.filter((r) => r.id === callerId);
    },
  });

  // ── Fetch KPI master definitions (scoped to caller by backend) ───────────
  const { data: kpiMasters = [] } = useQuery<KpiMaster[]>({
    queryKey: ["kpiMasters", callerId, callerRole],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/kpis", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch KPI definitions");
      return res.json();
    },
  });

  // ── Fetch KPI targets for selected rep ───────────────────────────────────
  const { data: targets = [], isLoading: targetsLoading } = useQuery<KpiTarget[]>({
    queryKey: ["kpiTargets", selectedRepId],
    enabled: !!selectedRepId,
    queryFn: async () => {
      const res = await fetch(`/api/v1/salespersons/${selectedRepId}/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch KPI targets");
      return res.json();
    },
  });

  // ── Fetch history for a KPI target ───────────────────────────────────────
  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ["kpiHistory", historyKpiId],
    enabled: !!historyKpiId,
    queryFn: async () => {
      const res = await fetch(`/api/v1/kpis/target/${historyKpiId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  // ── Save single target ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ kpiId, data }: { kpiId: string; data: Partial<KpiTarget> }) => {
      const res = await fetch(`/api/v1/kpis/target/${kpiId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, reason: "Manual target update via KPI Assignments" }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["kpiTargets", selectedRepId] });
      setEditState((s) => { const n = { ...s }; delete n[vars.kpiId]; return n; });
      showToast("ok", "Target saved successfully");
    },
    onError: (e: any) => showToast("err", e.message),
  });

  // ── Lock / Unlock targets ─────────────────────────────────────────────────
  const lockMutation = useMutation({
    mutationFn: async (status: "Locked" | "Active") => {
      const res = await fetch("/api/v1/kpis/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ salespersonId: selectedRepId, status }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Lock failed");
      }
      return res.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["kpiTargets", selectedRepId] });
      showToast("ok", `All targets ${status === "Locked" ? "locked" : "unlocked"}`);
    },
    onError: (e: any) => showToast("err", e.message),
  });

  // ── Bulk assign ───────────────────────────────────────────────────────────
  const bulkMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        kpiMasterId: bulk.kpiMasterId || undefined,
        kpiName: bulk.kpiName,
        targetValue: bulk.targetValue,
        frequency: bulk.frequency,
        weightage: bulk.weightage,
      };

      if (isAdmin) {
        if (bulk.scopeType === "selected") {
          const repId = bulk.scopeValue || selectedRepId;
          if (!repId) throw new Error("Please select a salesperson");
          body.salespersonIds = [repId];
        } else if (bulk.scopeType === "team") {
          if (!bulk.scopeValue) throw new Error("Please select a team");
          body.team = bulk.scopeValue;
        } else if (bulk.scopeType === "department") {
          if (!bulk.scopeValue) throw new Error("Please select a department");
          body.department = bulk.scopeValue;
        }
      } else if (isManager) {
        body.salespersonIds = reps.map((r) => r.id);
      }

      const res = await fetch("/api/v1/kpis/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Bulk assign failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kpiTargets"] });
      setBulkModal(false);
      setConfirmStep(false);
      showToast("ok", data.message ?? "Bulk assignment complete");
    },
    onError: (e: any) => showToast("err", e.message),
  });

  const allLocked = targets.length > 0 && targets.every((t) => t.status === "Locked");
  const selectedRep = reps.find((r) => r.id === selectedRepId);

  // ── Distinct team & department lists ─────────────────────────────────────
  const availableTeams = Array.from(
    new Set(reps.map((r) => r.team).filter((t): t is string => !!t && t.trim().length > 0))
  ).sort();

  const availableDepartments = Array.from(
    new Set(reps.map((r) => r.department).filter((d): d is string => !!d && d.trim().length > 0))
  ).sort();

  // ── Compute target reps for preview & safety checks ───────────────────────
  const getTargetReps = (): Rep[] => {
    if (isManager && !isAdmin) {
      return reps; // Already scoped to manager's reports
    }
    if (bulk.scopeType === "selected") {
      const targetId = bulk.scopeValue || selectedRepId;
      const r = reps.find((rep) => rep.id === targetId);
      return r ? [r] : [];
    }
    if (bulk.scopeType === "team") {
      return reps.filter((r) => r.team === bulk.scopeValue);
    }
    if (bulk.scopeType === "department") {
      return reps.filter((r) => r.department === bulk.scopeValue);
    }
    return [];
  };

  const targetReps = getTargetReps();
  const targetCount = targetReps.length;

  // ── Open modal handler ───────────────────────────────────────────────────
  const handleOpenBulkModal = () => {
    setConfirmStep(false);
    const initialScopeType = selectedRepId
      ? "selected"
      : availableTeams.length > 0
      ? "team"
      : availableDepartments.length > 0
      ? "department"
      : "selected";

    const initialScopeValue =
      initialScopeType === "selected"
        ? (selectedRepId || (reps[0]?.id ?? ""))
        : initialScopeType === "team"
        ? (availableTeams[0] ?? "")
        : (availableDepartments[0] ?? "");

    // Pick first KPI master if none chosen
    const firstMaster = kpiMasters[0];
    setBulk({
      kpiMasterId: firstMaster?.id ?? "",
      kpiName: firstMaster?.name ?? "",
      targetValue: firstMaster?.targetValue ?? 0,
      frequency: firstMaster?.frequency ?? "monthly",
      weightage: firstMaster?.weightage ?? 10,
      scopeType: initialScopeType,
      scopeValue: initialScopeValue,
    });
    setBulkModal(true);
  };

  const handleKpiMasterChange = (masterId: string) => {
    const master = kpiMasters.find((m) => m.id === masterId);
    if (master) {
      setBulk((prev) => ({
        ...prev,
        kpiMasterId: master.id,
        kpiName: master.name,
        targetValue: master.targetValue,
        frequency: master.frequency,
        weightage: master.weightage,
      }));
    } else {
      setBulk((prev) => ({
        ...prev,
        kpiMasterId: "",
        kpiName: "",
      }));
    }
  };

  // ── Helper: get inline edit value ────────────────────────────────────────
  const getField = <K extends keyof KpiTarget>(t: KpiTarget, k: K): KpiTarget[K] =>
    (editState[t.id]?.[k] ?? t[k]) as KpiTarget[K];

  const setField = (id: string, k: keyof KpiTarget, v: unknown) =>
    setEditState((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const isDirty = (id: string) => !!editState[id] && Object.keys(editState[id]).length > 0;

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-6 animate-fade-in text-on-surface">
      <MasterDataNav />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${
            toast.type === "ok"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">KPI Assignments</h2>
            <p className="text-xs text-on-surface-variant">
              {isManager
                ? "Edit individual KPI targets for your direct reports."
                : "Edit and manage KPI targets for all sales representatives."}
            </p>
          </div>
        </div>
        {(isAdmin || isManager) && (
          <div className="flex items-center gap-2">
            {selectedRepId && (
              <button
                onClick={() => lockMutation.mutate(allLocked ? "Active" : "Locked")}
                disabled={lockMutation.isPending}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  allLocked
                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20"
                    : "bg-surface-container-low border border-outline text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {allLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {allLocked ? "Unlock All" : "Lock All"}
              </button>
            )}
            <button
              onClick={handleOpenBulkModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              Bulk Assign Targets
            </button>
          </div>
        )}
      </div>

      {/* Rep picker */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          Select Salesperson
        </p>
        <div className="flex flex-wrap gap-2">
          {reps.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRepId(r.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedRepId === r.id
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-surface-container-low border-outline text-on-surface hover:border-primary/40"
              }`}
            >
              {r.name}
              {r.team && (
                <span className={`ml-1.5 text-[10px] opacity-80 ${selectedRepId === r.id ? "text-white/80" : "text-on-surface-variant"}`}>
                  • {r.team}
                </span>
              )}
            </button>
          ))}
          {reps.length === 0 && (
            <p className="text-xs text-on-surface-variant">No reps available.</p>
          )}
        </div>
      </div>

      {/* KPI targets table */}
      {selectedRepId && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-on-surface">
              KPI Targets — {selectedRep?.name}
            </p>
            {allLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Lock className="w-3 h-3" /> All Locked
              </span>
            )}
          </div>

          {targetsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-primary" />
            </div>
          ) : targets.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-10 text-center">
              <Target className="w-7 h-7 mx-auto mb-2 text-on-surface-variant opacity-40" />
              <p className="text-sm font-bold text-on-surface-variant">No KPI targets found.</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="px-5 py-3.5">KPI</th>
                    <th className="px-5 py-3.5">Target</th>
                    <th className="px-5 py-3.5">Frequency</th>
                    <th className="px-5 py-3.5">Weight (%)</th>
                    <th className="px-5 py-3.5">Progress</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-sm">
                  {targets.map((t) => {
                    const locked = t.status === "Locked";
                    const progress = pct(t.currentValue, getField(t, "targetValue") as number);
                    return (
                      <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-bold text-on-surface text-xs">{t.kpiName}</p>
                          {t.category && (
                            <p className="text-[10px] text-on-surface-variant capitalize">{t.category}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            value={getField(t, "targetValue") as number}
                            onChange={(e) => setField(t.id, "targetValue", parseFloat(e.target.value) || 0)}
                            disabled={locked}
                            className={`w-20 bg-surface-container-low border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                              locked ? "opacity-50 cursor-not-allowed border-outline-variant" : "border-outline"
                            }`}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={getField(t, "frequency") as string}
                            onChange={(e) => setField(t.id, "frequency", e.target.value)}
                            disabled={locked}
                            className={`bg-surface-container-low border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer ${
                              locked ? "opacity-50 cursor-not-allowed border-outline-variant" : "border-outline"
                            }`}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={getField(t, "weightage") as number}
                            onChange={(e) => setField(t.id, "weightage", parseFloat(e.target.value) || 0)}
                            disabled={locked}
                            className={`w-16 bg-surface-container-low border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                              locked ? "opacity-50 cursor-not-allowed border-outline-variant" : "border-outline"
                            }`}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progress >= 100
                                    ? "bg-green-500"
                                    : progress >= 60
                                    ? "bg-primary"
                                    : "bg-amber-500"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-on-surface-variant">
                              {t.currentValue} / {getField(t, "targetValue") as number}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                              locked
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-green-500/10 text-green-600 border border-green-500/20"
                            }`}
                          >
                            {locked ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {isDirty(t.id) && !locked && (
                              <button
                                onClick={() => saveMutation.mutate({ kpiId: t.id, data: editState[t.id] })}
                                disabled={saveMutation.isPending}
                                className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-60"
                              >
                                <Save className="w-3 h-3" /> Save
                              </button>
                            )}
                            <button
                              onClick={() => setHistoryKpiId(historyKpiId === t.id ? null : t.id)}
                              className={`p-1.5 rounded-lg text-on-surface-variant transition-all hover:bg-surface-container ${
                                historyKpiId === t.id ? "bg-surface-container text-primary" : ""
                              }`}
                              title="View history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* History drawer */}
          {historyKpiId && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-on-surface">
                    Change History — {targets.find((t) => t.id === historyKpiId)?.kpiName}
                  </p>
                </div>
                <button onClick={() => setHistoryKpiId(null)} className="p-1 hover:bg-surface-container rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No history recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 text-xs bg-surface-container-low rounded-lg px-3 py-2">
                      <span className="font-bold text-on-surface-variant w-24 shrink-0">
                        {new Date(h.changeDate).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-on-surface">{h.oldValue}</span>
                      <ArrowRight className="w-3 h-3 text-on-surface-variant" />
                      <span className="font-bold text-primary">{h.newValue}</span>
                      <span className="text-on-surface-variant flex-1 truncate">{h.reason}</span>
                      {h.changedByUser && (
                        <span className="text-on-surface-variant shrink-0">{h.changedByUser.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk assign modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setBulkModal(false)}>
          <div
            className="bg-surface rounded-2xl border border-outline p-6 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">Bulk Assign KPI Target</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    {isManager && !isAdmin
                      ? "Assign to your direct reports with explicit verification."
                      : "Scoped assignment to prevent accidental organization-wide updates."}
                  </p>
                </div>
              </div>
              <button onClick={() => setBulkModal(false)} className="p-1 hover:bg-surface-container rounded-lg text-on-surface-variant">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!confirmStep ? (
              /* STEP 1: Configuration Form */
              <div className="space-y-4">
                {/* Admin Scope Selector */}
                {isAdmin && (
                  <div className="space-y-2 bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Assignment Scope <span className="text-primary">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-surface-container p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setBulk((b) => ({
                            ...b,
                            scopeType: "selected",
                            scopeValue: selectedRepId || reps[0]?.id || "",
                          }));
                        }}
                        className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                          bulk.scopeType === "selected"
                            ? "bg-surface shadow-sm text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulk((b) => ({
                            ...b,
                            scopeType: "team",
                            scopeValue: availableTeams[0] || "",
                          }));
                        }}
                        className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                          bulk.scopeType === "team"
                            ? "bg-surface shadow-sm text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        By Team
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBulk((b) => ({
                            ...b,
                            scopeType: "department",
                            scopeValue: availableDepartments[0] || "",
                          }));
                        }}
                        className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                          bulk.scopeType === "department"
                            ? "bg-surface shadow-sm text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        Department
                      </button>
                    </div>

                    {/* Sub-selectors per scopeType */}
                    {bulk.scopeType === "selected" && (
                      <select
                        value={bulk.scopeValue}
                        onChange={(e) => setBulk({ ...bulk, scopeValue: e.target.value })}
                        className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      >
                        <option value="">Select Salesperson…</option>
                        {reps.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} {r.team ? `(${r.team})` : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {bulk.scopeType === "team" && (
                      availableTeams.length > 0 ? (
                        <select
                          value={bulk.scopeValue}
                          onChange={(e) => setBulk({ ...bulk, scopeValue: e.target.value })}
                          className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        >
                          <option value="">Select Team…</option>
                          {availableTeams.map((t) => (
                            <option key={t} value={t}>
                              Team: {t} ({reps.filter((r) => r.team === t).length} reps)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-600 font-medium">No teams defined on salespersons.</p>
                      )
                    )}

                    {bulk.scopeType === "department" && (
                      availableDepartments.length > 0 ? (
                        <select
                          value={bulk.scopeValue}
                          onChange={(e) => setBulk({ ...bulk, scopeValue: e.target.value })}
                          className="w-full bg-surface border border-outline rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        >
                          <option value="">Select Department…</option>
                          {availableDepartments.map((d) => (
                            <option key={d} value={d}>
                              Dept: {d} ({reps.filter((r) => r.department === d).length} reps)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-600 font-medium">No departments defined on salespersons.</p>
                      )
                    )}
                  </div>
                )}

                {/* Manager Scope Info */}
                {isManager && !isAdmin && (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <UserCheck className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-on-surface">
                      Will be assigned to all <strong className="text-primary">{reps.length} direct reports</strong> on your team.
                    </p>
                  </div>
                )}

                {/* KPI Master Definition Select */}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    KPI Definition <span className="text-primary">*</span>
                  </label>
                  <select
                    value={bulk.kpiMasterId}
                    onChange={(e) => handleKpiMasterChange(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="">Choose a KPI Definition…</option>
                    {kpiMasters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.teamLeadId ? "(Team Scoped)" : "(Global)"} — Target: {m.targetValue} ({m.frequency})
                      </option>
                    ))}
                  </select>
                  {kpiMasters.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      No KPI definitions found. Please define them under Master Data → KPI Master.
                    </p>
                  )}
                </div>

                {/* KPI Name fallback if custom/legacy */}
                {!bulk.kpiMasterId && (
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Or Custom KPI Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Monthly Revenue"
                      value={bulk.kpiName}
                      onChange={(e) => setBulk({ ...bulk, kpiName: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                )}

                {/* Values: Target, Freq, Weight */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Target Value</label>
                    <input
                      type="number"
                      value={bulk.targetValue}
                      onChange={(e) => setBulk({ ...bulk, targetValue: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Frequency</label>
                    <select
                      value={bulk.frequency}
                      onChange={(e) => setBulk({ ...bulk, frequency: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Weight (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={bulk.weightage}
                      onChange={(e) => setBulk({ ...bulk, weightage: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Impact Preview Card */}
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-on-surface-variant">Target Recipients:</span>
                    <span className={targetCount > 0 ? "text-primary" : "text-amber-600"}>
                      {targetCount} {targetCount === 1 ? "salesperson" : "salespersons"}
                    </span>
                  </div>
                  {targetCount > 0 ? (
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {targetReps.slice(0, 4).map((r) => r.name).join(", ")}
                      {targetCount > 4 ? ` +${targetCount - 4} more` : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-600">
                      No salespersons match the chosen scope criteria. Please select a valid scope.
                    </p>
                  )}
                </div>

                {/* Step 1 Actions */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setBulkModal(false)}
                    className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setConfirmStep(true)}
                    disabled={!bulk.kpiName || targetCount === 0}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    Review & Confirm
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: Pre-Mutation Confirmation */
              <div className="space-y-4 animate-fade-in">
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-700">Confirm Bulk Assignment</p>
                    <p className="text-amber-900/80 leading-relaxed">
                      You are about to assign or update <strong>{bulk.kpiName}</strong> for{" "}
                      <strong>{targetCount} {targetCount === 1 ? "salesperson" : "salespersons"}</strong>.
                      Any existing targets for this KPI will be updated with the new target value and weightage.
                    </p>
                  </div>
                </div>

                {/* Summary Table */}
                <div className="bg-surface-container-low rounded-xl p-3.5 border border-outline-variant text-xs space-y-2">
                  <div className="flex justify-between py-1 border-b border-outline-variant/60">
                    <span className="text-on-surface-variant">KPI Name:</span>
                    <span className="font-bold text-on-surface">{bulk.kpiName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/60">
                    <span className="text-on-surface-variant">Target Value:</span>
                    <span className="font-bold text-on-surface">{bulk.targetValue}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-outline-variant/60">
                    <span className="text-on-surface-variant">Frequency / Weight:</span>
                    <span className="font-bold text-on-surface">{bulk.frequency} / {bulk.weightage}%</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-on-surface-variant">Scope Target:</span>
                    <span className="font-bold text-primary">
                      {isAdmin
                        ? bulk.scopeType === "selected"
                          ? `Individual (${targetReps[0]?.name})`
                          : bulk.scopeType === "team"
                          ? `Team: ${bulk.scopeValue}`
                          : `Department: ${bulk.scopeValue}`
                        : `Direct Reports (${targetCount} reps)`}
                    </span>
                  </div>
                </div>

                {/* Step 2 Actions */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setConfirmStep(false)}
                    disabled={bulkMutation.isPending}
                    className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => bulkMutation.mutate()}
                    disabled={bulkMutation.isPending}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {bulkMutation.isPending ? "Assigning Targets…" : `Confirm & Assign (${targetCount})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
