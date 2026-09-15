import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Edit2, Trash2, X, ShieldAlert, Target, Save, Globe, Users, Filter } from "lucide-react";
import { MasterDataNav } from "../../components/MasterDataNav";

interface TeamLead {
  id: string;
  name: string;
  email: string;
}

interface KpiMaster {
  id: string;
  name: string;
  category: string;
  targetValue: number;
  frequency: string;
  weightage: number;
  isActive: boolean;
  teamLeadId: string | null;
  teamLead?: TeamLead;
}

const CATEGORIES = [
  "Lead Generation",
  "Prospecting",
  "Meetings",
  "Sales",
  "Conversion",
  "Finance",
  "Customer",
  "Performance",
];

type ScopeFilter = "all" | "global" | string; // string = specific teamLeadId

export default function Kpis() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const role: string = user?.role ?? "";

  const isAdmin = ["admin", "director"].includes(role);
  const isManager = ["manager", "sales_manager"].includes(role);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiMaster | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  // Form state
  const [form, setForm] = useState({
    name: "",
    category: "Lead Generation",
    targetValue: 0,
    frequency: "monthly",
    weightage: 10,
    isActive: true,
    teamLeadId: null as string | null,
  });

  const [errorMsg, setErrorMsg] = useState("");

  // Build the fetch URL with scope params
  const buildKpiUrl = () => {
    const base = "/api/v1/master-data/kpis";
    if (!isAdmin) return base; // backend scopes for managers/reps automatically
    if (scopeFilter === "global") return `${base}?scope=global`;
    if (scopeFilter !== "all") return `${base}?teamLeadId=${scopeFilter}`;
    return base;
  };

  const { data: kpis, isLoading } = useQuery<KpiMaster[]>({
    queryKey: ["kpiMasters", scopeFilter],
    queryFn: async () => {
      const res = await fetch(buildKpiUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
  });

  // Derive unique managers from returned KPIs for the filter dropdown
  const teamLeads: TeamLead[] = [];
  if (kpis) {
    const seen = new Set<string>();
    for (const k of kpis) {
      if (k.teamLead && !seen.has(k.teamLead.id)) {
        seen.add(k.teamLead.id);
        teamLeads.push(k.teamLead);
      }
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(
        isEdit ? `/api/v1/master-data/kpis/${data.id}` : "/api/v1/master-data/kpis",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpiMasters"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/kpis/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpiMasters"] });
    },
  });

  const openAddModal = () => {
    setEditingKpi(null);
    setForm({
      name: "",
      category: "Lead Generation",
      targetValue: 0,
      frequency: "monthly",
      weightage: 10,
      isActive: true,
      teamLeadId: isManager ? (user?.id ?? null) : null,
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (kpi: KpiMaster) => {
    setEditingKpi(kpi);
    setForm({
      name: kpi.name,
      category: kpi.category,
      targetValue: kpi.targetValue,
      frequency: kpi.frequency,
      weightage: kpi.weightage,
      isActive: kpi.isActive,
      teamLeadId: kpi.teamLeadId,
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingKpi(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    saveMutation.mutate(editingKpi ? { ...form, id: editingKpi.id } : form);
  };

  const handleToggleStatus = (kpi: KpiMaster) => {
    saveMutation.mutate({ ...kpi, isActive: !kpi.isActive });
  };

  // Can this caller edit/delete a given KPI?
  const canModify = (kpi: KpiMaster) => {
    if (isAdmin) return true;
    if (isManager) return kpi.teamLeadId === user?.id;
    return false;
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-6 animate-fade-in text-on-surface">
      <MasterDataNav />

      {/* Page Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">KPI Master Template</h2>
            <p className="text-xs text-on-surface-variant">
              {isManager
                ? "Your team's KPI definitions. Global KPIs (company-wide) are read-only."
                : "Configure standard and team-specific KPI definitions for all sales representatives."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope filter — admin/director only */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-surface-container-low border border-outline rounded-lg px-2 py-1.5">
              <Filter className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
                className="text-xs font-semibold bg-transparent text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="all">All Teams</option>
                <option value="global">Global Only</option>
                {teamLeads.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.name}'s Team
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add KPI Definition
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      ) : !kpis || kpis.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center">
          <Target className="w-8 h-8 text-on-surface-variant mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold text-on-surface-variant">No KPI definitions found.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">KPI Name</th>
                <th className="px-6 py-3.5">Default Target</th>
                <th className="px-6 py-3.5">Frequency</th>
                <th className="px-6 py-3.5">Weightage (%)</th>
                <th className="px-6 py-3.5">Scope</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40 text-sm">
              {kpis.map((kpi) => (
                <tr key={kpi.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-xs uppercase tracking-wide text-primary">
                    {kpi.category}
                  </td>
                  <td className="px-6 py-4 font-bold text-on-surface">{kpi.name}</td>
                  <td className="px-6 py-4 font-bold text-on-surface">{kpi.targetValue}</td>
                  <td className="px-6 py-4 capitalize text-on-surface-variant text-xs">{kpi.frequency}</td>
                  <td className="px-6 py-4 font-semibold text-on-surface-variant">{kpi.weightage}%</td>
                  <td className="px-6 py-4">
                    {kpi.teamLeadId === null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        <Globe className="w-3 h-3" /> Global
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 border border-violet-500/20">
                        <Users className="w-3 h-3" />
                        {kpi.teamLead?.name ?? "Team"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => canModify(kpi) && handleToggleStatus(kpi)}
                      disabled={!canModify(kpi)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all border ${
                        kpi.isActive
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-outline-variant/20 text-on-surface-variant border-transparent"
                      } ${!canModify(kpi) ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${kpi.isActive ? "bg-green-500" : "bg-on-surface-variant/60"}`} />
                      {kpi.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(kpi)}
                        disabled={!canModify(kpi)}
                        className={`p-1.5 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary transition-all ${
                          !canModify(kpi) ? "opacity-30 cursor-not-allowed" : ""
                        }`}
                        title={canModify(kpi) ? "Edit KPI" : "You can only edit your own team's KPIs"}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!canModify(kpi)) return;
                          if (confirm(`Delete "${kpi.name}"? This will also delete all rep assignments for this KPI.`)) {
                            deleteMutation.mutate(kpi.id);
                          }
                        }}
                        disabled={!canModify(kpi)}
                        className={`p-1.5 hover:bg-red-500/10 rounded text-on-surface-variant hover:text-red-500 transition-all ${
                          !canModify(kpi) ? "opacity-30 cursor-not-allowed" : ""
                        }`}
                        title={canModify(kpi) ? "Delete KPI" : "You can only delete your own team's KPIs"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-surface rounded-2xl border border-outline p-6 w-full max-w-md shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-on-surface">
                {editingKpi ? "Edit KPI Definition" : "Add KPI Definition"}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-surface-container rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="text-xs font-bold text-error bg-error-container/30 p-2.5 rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  KPI Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Warm Calls"
                  className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Default Target
                  </label>
                  <input
                    type="number"
                    value={form.targetValue}
                    onChange={(e) => setForm({ ...form, targetValue: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Frequency
                  </label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Weightage (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.weightage}
                    onChange={(e) => setForm({ ...form, weightage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-outline bg-surface-container-low text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-on-surface">Active</span>
                  </label>
                </div>
              </div>

              {/* Scope selector */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Scope
                </label>
                {isManager ? (
                  <div className="flex items-center gap-2 p-2.5 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                    <Users className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-violet-600">My Team only</span>
                  </div>
                ) : (
                  <select
                    value={form.teamLeadId ?? ""}
                    onChange={(e) => setForm({ ...form, teamLeadId: e.target.value || null })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="">Global (all teams)</option>
                    {teamLeads.map((tl) => (
                      <option key={tl.id} value={tl.id}>{tl.name}'s Team</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? "Saving..." : "Save KPI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
