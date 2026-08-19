import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Percent,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  X,
  RotateCcw,
  Users,
  Shield,
  UserCheck,
  Building2,
  DollarSign
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface SplitRecord {
  id: string;
  dealId: string;
  userId: string;
  splitPercentage: number;
  configuredByUserId: string | null;
  isCrossTeam: boolean;
  rep?: {
    id: string;
    name: string;
    email: string;
    role: string;
    managerId?: string;
    isAvailable?: boolean;
  } | null;
  configuredBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface DealSplitsResponse {
  success: boolean;
  isDefault: boolean;
  dealId: string;
  splits: SplitRecord[];
}

interface DealSplitsSectionProps {
  dealId: string;
  dealAmount: number;
  ownerId?: string;
  ownerName?: string;
}

export function DealSplitsSection({
  dealId,
  dealAmount,
  ownerId,
  ownerName
}: DealSplitsSectionProps) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const isManager = ["manager", "admin", "director"].includes(
    (user?.role || "").toLowerCase()
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [splitRows, setSplitRows] = useState<{ userId: string; splitPercentage: number }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Fetch deal splits
  const { data: splitsData, isLoading } = useQuery<DealSplitsResponse>({
    queryKey: ["deal-splits", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/splits`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch deal splits");
      return res.json();
    },
    enabled: !!dealId && !!token
  });

  // 2. Fetch manager team (to detect cross-team members client-side)
  const { data: managerTeamData } = useQuery<{ success: boolean; team: any[] }>({
    queryKey: ["manager-team"],
    queryFn: async () => {
      const res = await fetch("/api/v1/manager/team", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return { success: false, team: [] };
      return res.json();
    },
    enabled: isManager && !!token
  });

  // 3. Fetch all reps for rep picker
  const { data: allReps = [] } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const managerTeamUserIds = new Set((managerTeamData?.team || []).map((m: any) => m.id));

  // Mutation: Save Splits
  const saveSplitsMutation = useMutation({
    mutationFn: async (splits: { userId: string; splitPercentage: number }[]) => {
      const res = await fetch(`/api/v1/deals/${dealId}/splits`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ splits })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save splits failed" }));
        throw new Error(err.error || "Failed to update commission splits");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-splits", dealId] });
      setSuccessMessage("Deal commission splits saved successfully!");
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setValidationError(err.message || "Failed to save splits");
    }
  });

  // Mutation: Reset to Default Splits
  const resetSplitsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/splits`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to reset splits");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-splits", dealId] });
      setSuccessMessage("Deal commission split reset to default 100% to owner.");
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setValidationError(err.message || "Failed to reset splits");
    }
  });

  const splits = splitsData?.splits || [];
  const isDefault = splitsData?.isDefault ?? true;

  // Open modal with existing or default splits
  const handleOpenModal = () => {
    setValidationError(null);
    if (splits.length > 0) {
      setSplitRows(
        splits.map((s) => ({
          userId: s.userId,
          splitPercentage: s.splitPercentage
        }))
      );
    } else if (ownerId) {
      setSplitRows([{ userId: ownerId, splitPercentage: 100 }]);
    } else {
      setSplitRows([]);
    }
    setIsModalOpen(true);
  };

  const handleAddRepRow = () => {
    // Find a rep not yet in the list
    const existingIds = new Set(splitRows.map((r) => r.userId));
    const candidate = allReps.find((r) => !existingIds.has(r.id));
    if (candidate) {
      setSplitRows([...splitRows, { userId: candidate.id, splitPercentage: 0 }]);
    } else if (allReps.length > 0) {
      setSplitRows([...splitRows, { userId: allReps[0].id, splitPercentage: 0 }]);
    }
  };

  const handleRemoveRow = (index: number) => {
    const updated = splitRows.filter((_, i) => i !== index);
    setSplitRows(updated);
  };

  const handleRowChange = (index: number, field: "userId" | "splitPercentage", value: any) => {
    const updated = [...splitRows];
    updated[index] = {
      ...updated[index],
      [field]: field === "splitPercentage" ? Number(value) : value
    };
    setSplitRows(updated);
  };

  const totalSplitPercentage = splitRows.reduce((sum, r) => sum + (Number(r.splitPercentage) || 0), 0);
  const roundedSum = Math.round(totalSplitPercentage * 100) / 100;
  const isSumValid = Math.abs(roundedSum - 100) <= 0.01;

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (splitRows.length === 0) {
      setValidationError("At least one sales representative is required.");
      return;
    }

    if (!isSumValid) {
      setValidationError(`Total split percentages must equal 100.00% (currently ${roundedSum.toFixed(2)}%).`);
      return;
    }

    // Check duplicate user entries
    const seenUsers = new Set<string>();
    for (const r of splitRows) {
      if (!r.userId) {
        setValidationError("Please select a sales representative for each row.");
        return;
      }
      if (seenUsers.has(r.userId)) {
        setValidationError("Duplicate sales reps detected. Each rep may only appear once.");
        return;
      }
      if (r.splitPercentage <= 0 || r.splitPercentage > 100) {
        setValidationError("Each rep split percentage must be greater than 0% and at most 100%.");
        return;
      }
      seenUsers.add(r.userId);
    }

    saveSplitsMutation.mutate(splitRows);
  };

  return (
    <div className="enterprise-card p-4 space-y-3">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-emerald-600" />
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Commission Split Allocation
            </h3>
            <p className="text-[11px] text-slate-400">Rep commission percentage accounting</p>
          </div>
        </div>

        {isManager && (
          <button
            onClick={handleOpenModal}
            className="px-2.5 py-1 bg-surface hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-3 h-3 text-slate-500" />
            <span>{isDefault ? "Configure Split" : "Edit Splits"}</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Loading split accounting...
        </div>
      ) : isDefault ? (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-bold">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Not configured — 100% to owner ({ownerName || "Deal Owner"})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
              Default 100%
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            No custom rep split is configured. Full deal value ({formatCurrency(dealAmount)}) is credited solely to the deal owner.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {splits.map((s) => {
            const repAmount = (dealAmount * s.splitPercentage) / 100;
            return (
              <div
                key={s.id}
                className="p-2.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                    {s.rep?.name ? s.rep.name.slice(0, 2).toUpperCase() : "RP"}
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <span>{s.rep?.name || "Unknown Rep"}</span>
                      {s.isCrossTeam && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shrink-0" title="Rep does not report directly to the configuring manager">
                          Cross-team
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {s.rep?.role || "sales_rep"} {s.rep?.email ? `• ${s.rep.email}` : ""}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-extrabold text-slate-900 text-xs">
                    {s.splitPercentage.toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700">
                    {formatCurrency(repAmount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Commission Splits Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-outline-variant pb-3">
              <div>
                <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  Configure Deal Commission Splits
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Total Deal Value: <strong>{formatCurrency(dealAmount)}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {splitRows.map((row, index) => {
                  const repObj = allReps.find((r) => r.id === row.userId);
                  const isCrossTeamEstimate = row.userId
                    ? user?.id
                      ? !managerTeamUserIds.has(row.userId)
                      : false
                    : false;

                  return (
                    <div
                      key={index}
                      className="p-3 rounded-xl bg-surface border border-outline-variant flex items-center gap-2.5"
                    >
                      {/* Rep Dropdown */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                            Representative #{index + 1}
                          </label>
                          {isCrossTeamEstimate && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Cross-team
                            </span>
                          )}
                        </div>
                        <select
                          value={row.userId}
                          onChange={(e) => handleRowChange(index, "userId", e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline rounded-lg p-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="">-- Choose Representative --</option>
                          {allReps.map((r) => {
                            const isDirect = managerTeamUserIds.has(r.id);
                            return (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.role}) {isDirect ? "• [My Team]" : "• [Cross-team]"}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Percentage Input */}
                      <div className="w-28 space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                          Split %
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={row.splitPercentage}
                            onChange={(e) => handleRowChange(index, "splitPercentage", e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline rounded-lg p-2 pr-6 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <span className="absolute right-2 top-2 text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      {/* Remove Row */}
                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors mt-4 cursor-pointer"
                          title="Remove Rep"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Rep Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleAddRepRow}
                  className="px-3 py-1.5 bg-surface hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Representative</span>
                </button>

                {/* Running Total Live Indicator */}
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                    isSumValid
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}
                >
                  Total: {roundedSum.toFixed(1)}% {isSumValid ? "✓ (Valid)" : "— Must equal 100%"}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                {!isDefault ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Reset commission split back to 100% to owner?")) {
                        resetSplitsMutation.mutate();
                      }
                    }}
                    disabled={resetSplitsMutation.isPending}
                    className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default (100% to owner)
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 bg-surface hover:bg-surface-container-high text-on-surface font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveSplitsMutation.isPending || !isSumValid}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {saveSplitsMutation.isPending && (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Save Commission Splits
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
