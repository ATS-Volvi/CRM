import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Percent, Edit2, Trash2, Check, X, ShieldAlert, Plus, Info } from "lucide-react";
import { MasterDataNav } from "../../components/MasterDataNav";

interface DiscountPolicy {
  id: string;
  role: string;
  maxDiscountPercent: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function DiscountRules() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [addRole, setAddRole] = useState("");
  const [addPercent, setAddPercent] = useState<string>("10");
  const [addDescription, setAddDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editPercent, setEditPercent] = useState<string>("10");
  const [editDescription, setEditDescription] = useState("");

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      addInputRef.current?.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  const { data: policies, isLoading } = useQuery<DiscountPolicy[]>({
    queryKey: ["discountRules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/discount-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch discount policies");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<DiscountPolicy>) => {
      const isEdit = !!data.id;
      const res = await fetch(
        isEdit ? `/api/v1/master-data/discount-rules/${data.id}` : "/api/v1/master-data/discount-rules",
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
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save discount policy");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discountRules"] });
      setIsAdding(false);
      setAddRole("");
      setAddPercent("10");
      setAddDescription("");
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/discount-rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discountRules"] });
    },
  });

  const handleToggleStatus = (policy: DiscountPolicy) => {
    saveMutation.mutate({
      id: policy.id,
      isActive: !policy.isActive,
    });
  };

  const handleAddSubmit = () => {
    if (!addRole.trim()) return;
    saveMutation.mutate({
      role: addRole.trim(),
      maxDiscountPercent: parseFloat(addPercent) || 0,
      description: addDescription.trim() || undefined,
      isActive: true,
    });
  };

  const handleEditSubmit = (policy: DiscountPolicy) => {
    if (!editRole.trim()) return;
    saveMutation.mutate({
      id: policy.id,
      role: editRole.trim(),
      maxDiscountPercent: parseFloat(editPercent) || 0,
      description: editDescription.trim() || undefined,
      isActive: policy.isActive,
    });
  };

  const startEdit = (policy: DiscountPolicy) => {
    setEditingId(policy.id);
    setEditRole(policy.role);
    setEditPercent(String(policy.maxDiscountPercent));
    setEditDescription(policy.description || "");
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-6 animate-fade-in">
      <MasterDataNav />

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Percent className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Discount Rules & Approval Limits</h2>
            <p className="text-xs text-on-surface-variant">
              Configure maximum discretionary discount limits by user role. Quotes and Work Orders exceeding these limits trigger manager approval.
            </p>
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Role Rule
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Automated Governance Hierarchy:</span> Discretionary discounts within a role's limit save immediately without delay. If a Quote or Work Order line item discount exceeds the frontline limit (default 10%), it routes to the Team Lead queue. Discounts exceeding the Team Lead limit (default 20%) route to Executive/Admin sign-off.
        </div>
      </div>

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">User Role</th>
              <th className="px-6 py-3.5">Max Authority Discount</th>
              <th className="px-6 py-3.5">Description</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {/* Inline Add Row */}
            {isAdding && (
              <tr className="bg-primary/5">
                <td className="px-6 py-3">
                  <input
                    ref={addInputRef}
                    type="text"
                    placeholder="e.g. Senior Account Exec"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  />
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={addPercent}
                      onChange={(e) => setAddPercent(e.target.value)}
                      className="w-20 text-xs font-bold px-2 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white text-right"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <input
                    type="text"
                    placeholder="Authority notes or scope"
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  />
                </td>
                <td className="px-6 py-3 text-xs text-emerald-700 font-semibold">Active</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleAddSubmit}
                      disabled={saveMutation.isPending}
                      className="p-1.5 text-white bg-primary rounded-lg hover:opacity-90"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">
                  Loading discount rules...
                </td>
              </tr>
            ) : !policies || policies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">
                  No discount rules configured. Click "Add Role Rule" above to create one.
                </td>
              </tr>
            ) : (
              policies.map((p) => {
                const isEditing = editingId === p.id;

                if (isEditing) {
                  return (
                    <tr key={p.id} className="bg-primary/5">
                      <td className="px-6 py-3">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={editPercent}
                            onChange={(e) => setEditPercent(e.target.value)}
                            className="w-20 text-xs font-bold px-2 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white text-right"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-primary/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-bold ${p.isActive ? "text-emerald-700" : "text-slate-400"}`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditSubmit(p)}
                            disabled={saveMutation.isPending}
                            className="p-1.5 text-white bg-primary rounded-lg hover:opacity-90"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {p.role}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        {Number(p.maxDiscountPercent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 max-w-[340px]">
                      {p.description || "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                          p.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {p.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                          title="Edit discount policy"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete discount rule for "${p.role}"?`)) {
                              deleteMutation.mutate(p.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Delete discount policy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
