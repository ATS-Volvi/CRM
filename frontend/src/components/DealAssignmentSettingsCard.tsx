import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Edit2,
  CheckCircle,
  X,
  UserCheck,
  Briefcase,
  AlertCircle,
  Sliders,
  DollarSign,
  Layers,
  Infinity as InfinityIcon
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface SeniorAeSettings {
  id: string;
  name: string;
  email: string;
  role: string;
  dealValueCutoff: number | null;
  maxOpenDeals: number | null;
  isAvailable: boolean;
  department?: string;
  territory?: string;
  status?: string;
  currentOpenDeals: number;
}

export function DealAssignmentSettingsCard() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [editingRep, setEditingRep] = useState<SeniorAeSettings | null>(null);
  const [cutoffInput, setCutoffInput] = useState<string>("");
  const [isCutoffUncapped, setIsCutoffUncapped] = useState<boolean>(false);
  const [capacityInput, setCapacityInput] = useState<string>("");
  const [isCapacityUncapped, setIsCapacityUncapped] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Senior AE cutoffs and capacities
  const { data: repsData, isLoading, error } = useQuery<{ success: boolean; users: SeniorAeSettings[] }>({
    queryKey: ["dealAssignmentCutoffs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/settings/deal-assignment-cutoffs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch deal assignment settings");
      return res.json();
    },
    enabled: !!token
  });

  const reps = repsData?.users || [];

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      userId,
      dealValueCutoff,
      maxOpenDeals
    }: {
      userId: string;
      dealValueCutoff: number | null;
      maxOpenDeals: number | null;
    }) => {
      const res = await fetch(`/api/v1/settings/deal-assignment-cutoffs/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ dealValueCutoff, maxOpenDeals })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(errorData.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dealAssignmentCutoffs"] });
      setSuccessMsg("Senior AE deal assignment settings updated successfully!");
      setEditingRep(null);
      setTimeout(() => setSuccessMsg(null), 3500);
    },
    onError: (err: any) => {
      setValidationError(err.message || "Failed to update settings");
    }
  });

  const handleOpenEdit = (rep: SeniorAeSettings) => {
    setEditingRep(rep);
    setValidationError(null);

    if (rep.dealValueCutoff === null || rep.dealValueCutoff === undefined) {
      setIsCutoffUncapped(true);
      setCutoffInput("");
    } else {
      setIsCutoffUncapped(false);
      setCutoffInput(String(rep.dealValueCutoff));
    }

    if (rep.maxOpenDeals === null || rep.maxOpenDeals === undefined) {
      setIsCapacityUncapped(true);
      setCapacityInput("");
    } else {
      setIsCapacityUncapped(false);
      setCapacityInput(String(rep.maxOpenDeals));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!editingRep) return;

    let finalCutoff: number | null = null;
    if (!isCutoffUncapped) {
      if (cutoffInput.trim() === "") {
        finalCutoff = null;
      } else {
        const parsed = Number(cutoffInput);
        if (isNaN(parsed) || parsed < 0) {
          setValidationError("Deal Value Cutoff must be a non-negative number.");
          return;
        }
        finalCutoff = parsed;
      }
    }

    let finalCapacity: number | null = null;
    if (!isCapacityUncapped) {
      if (capacityInput.trim() === "") {
        finalCapacity = null;
      } else {
        const parsed = Number(capacityInput);
        if (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
          setValidationError("Max Open Deals Capacity must be a whole non-negative integer.");
          return;
        }
        finalCapacity = parsed;
      }
    }

    updateMutation.mutate({
      userId: editingRep.id,
      dealValueCutoff: finalCutoff,
      maxOpenDeals: finalCapacity
    });
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Senior AE Deal Assignment &amp; Capacity
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Configure deal-value ceilings and open-deal capacity limits for Senior Account Executives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Phase 2 Pipeline Controls
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading Senior AE settings...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          Failed to load Senior AE settings.
        </div>
      ) : reps.length === 0 ? (
        <div className="p-6 text-center text-xs text-on-surface-variant bg-surface rounded-xl border border-outline-variant">
          No active Senior Account Executives (role: &quot;senior_ae&quot;) found in this workspace.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-outline-variant">
            <thead>
              <tr className="bg-surface text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Senior AE</th>
                <th className="py-3 px-3">Availability</th>
                <th className="py-3 px-3">Current Active Deals</th>
                <th className="py-3 px-3">Deal Value Cutoff</th>
                <th className="py-3 px-3">Max Open Deals Cap</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-medium">
              {reps.map((rep) => {
                const isOverCapacity = rep.maxOpenDeals !== null && rep.currentOpenDeals >= rep.maxOpenDeals;

                return (
                  <tr key={rep.id} className="hover:bg-surface/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {rep.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface">{rep.name}</div>
                          <div className="text-[11px] text-on-surface-variant">{rep.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          rep.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {rep.isAvailable ? "Available" : "Unavailable / OOO"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">{rep.currentOpenDeals}</span>
                        <span className="text-[11px] text-on-surface-variant">open deals</span>
                        {isOverCapacity && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="At or over capacity cap">
                            At Cap
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {rep.dealValueCutoff !== null && rep.dealValueCutoff !== undefined ? (
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {formatCurrency(Number(rep.dealValueCutoff))}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <InfinityIcon className="w-3 h-3" /> Uncapped
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {rep.maxOpenDeals !== null && rep.maxOpenDeals !== undefined ? (
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {rep.maxOpenDeals} Deals Max
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <InfinityIcon className="w-3 h-3" /> Uncapped
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleOpenEdit(rep)}
                        className="px-3 py-1.5 bg-surface hover:bg-surface-container-high border border-outline rounded-lg text-xs font-bold text-primary hover:text-primary-container transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit Controls
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingRep && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-scale-up">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Configure Rep Assignment Limits</h4>
                <p className="text-xs text-on-surface-variant font-medium">{editingRep.name} ({editingRep.email})</p>
              </div>
              <button
                onClick={() => setEditingRep(null)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {validationError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Deal Value Cutoff Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-on-surface flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Deal Value Cutoff (Max Size)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={isCutoffUncapped}
                      onChange={(e) => {
                        setIsCutoffUncapped(e.target.checked);
                        if (e.target.checked) setCutoffInput("");
                      }}
                      className="rounded border-outline text-primary focus:ring-primary"
                    />
                    Uncapped
                  </label>
                </div>
                {!isCutoffUncapped && (
                  <div className="relative">
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={cutoffInput}
                      onChange={(e) => setCutoffInput(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}
                <p className="text-[11px] text-on-surface-variant">
                  {isCutoffUncapped
                    ? "Rep is eligible for deals of any monetary value."
                    : "Rep will only be auto-assigned deals with amount ≤ cutoff."}
                </p>
              </div>

              {/* Max Open Deals Capacity Input */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/60">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-on-surface flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Max Open Deals (Capacity Cap)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={isCapacityUncapped}
                      onChange={(e) => {
                        setIsCapacityUncapped(e.target.checked);
                        if (e.target.checked) setCapacityInput("");
                      }}
                      className="rounded border-outline text-primary focus:ring-primary"
                    />
                    Uncapped
                  </label>
                </div>
                {!isCapacityUncapped && (
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-surface border border-outline rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}
                <p className="text-[11px] text-on-surface-variant">
                  Currently holding <strong>{editingRep.currentOpenDeals}</strong> active open deals.
                  {isCapacityUncapped
                    ? " No maximum workload limit."
                    : " Automated routing will pause when open deals hit this number."}
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setEditingRep(null)}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-container-high text-on-surface font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updateMutation.isPending && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Save Limits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
