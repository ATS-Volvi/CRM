import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Target, Save } from "lucide-react";

interface KpiMaster {
  id: string;
  name: string;
  category: string;
  targetValue: number;
  frequency: string;
  weightage: number;
  isActive: boolean;
}

const CATEGORIES = [
  "Lead Generation",
  "Prospecting",
  "Meetings",
  "Sales",
  "Conversion",
  "Finance",
  "Customer",
  "Performance"
];

export default function Kpis() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiMaster | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    category: "Lead Generation",
    targetValue: 0,
    frequency: "monthly",
    weightage: 10,
    isActive: true
  });

  const [errorMsg, setErrorMsg] = useState("");

  const { data: kpis, isLoading } = useQuery<KpiMaster[]>({
    queryKey: ["kpiMasters"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/kpis", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/master-data/kpis/${data.id}` : "/api/v1/master-data/kpis", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const text = await res.json();
        throw new Error(text.error || "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpiMasters"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/kpis/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpiMasters"] });
    }
  });

  const openAddModal = () => {
    setEditingKpi(null);
    setForm({
      name: "",
      category: "Lead Generation",
      targetValue: 0,
      frequency: "monthly",
      weightage: 10,
      isActive: true
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
      isActive: kpi.isActive
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
    saveMutation.mutate({
      ...kpi,
      isActive: !kpi.isActive
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-8 animate-fade-in text-on-surface">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">KPI Master Template</h2>
            <p className="text-xs text-on-surface-variant">Configure standard performance metric definitions propagated to all sales representatives.</p>
          </div>
        </div>
        <button 
          onClick={openAddModal} 
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
        >
          <span>+ Add KPI Definition</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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
                  <td className="px-6 py-4 font-bold text-on-surface">
                    {kpi.name}
                  </td>
                  <td className="px-6 py-4 font-bold text-on-surface">
                    {kpi.targetValue}
                  </td>
                  <td className="px-6 py-4 capitalize text-on-surface-variant text-xs">
                    {kpi.frequency}
                  </td>
                  <td className="px-6 py-4 font-semibold text-on-surface-variant">
                    {kpi.weightage}%
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleToggleStatus(kpi)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all border ${
                        kpi.isActive 
                          ? "bg-green-500/10 text-green-600 border-green-500/20" 
                          : "bg-outline-variant/20 text-on-surface-variant border-transparent"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${kpi.isActive ? "bg-green-500" : "bg-on-surface-variant/60"}`}></span>
                      {kpi.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => openEditModal(kpi)}
                        className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary transition-all"
                        title="Edit KPI Template"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${kpi.name}"? This will delete all representative assignments for this KPI.`)) {
                            deleteMutation.mutate(kpi.id);
                          }
                        }}
                        className="p-1.5 hover:bg-red-500/10 rounded text-on-surface-variant hover:text-red-500 transition-all"
                        title="Delete KPI"
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

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-surface rounded-2xl border border-outline p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-on-surface">{editingKpi ? "Edit KPI Definition" : "Add KPI Definition"}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-surface-container rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            
            {errorMsg && (
              <div className="text-xs font-bold text-error bg-error-container/30 p-2.5 rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">KPI Name</label>
                <input 
                  type="text" 
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Warm Calls"
                  className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Category</label>
                <select 
                  value={form.category} 
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Default Target</label>
                  <input 
                    type="number" 
                    value={form.targetValue}
                    onChange={e => setForm({ ...form, targetValue: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Frequency</label>
                  <select 
                    value={form.frequency} 
                    onChange={e => setForm({ ...form, frequency: e.target.value })}
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
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Weightage (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={form.weightage}
                    onChange={e => setForm({ ...form, weightage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.isActive}
                      onChange={e => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-outline bg-surface-container-low text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-on-surface">Active</span>
                  </label>
                </div>
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
