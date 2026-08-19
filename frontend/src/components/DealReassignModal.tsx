import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  AlertTriangle,
  CheckCircle,
  X,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  DollarSign,
  Layers
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface DealReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealName: string;
  dealAmount: number;
  currentOwnerName?: string;
  currentOwnerId?: string;
  onReassigned?: () => void;
}

export function DealReassignModal({
  isOpen,
  onClose,
  dealId,
  dealName,
  dealAmount,
  currentOwnerName,
  currentOwnerId,
  onReassigned
}: DealReassignModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [selectedRepId, setSelectedRepId] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<{
    cutoff?: boolean;
    capacity?: boolean;
    repName?: string;
  } | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Fetch Senior AEs to populate dropdown with contextual workload & cutoffs
  const { data: repsData, isLoading: isLoadingReps } = useQuery({
    queryKey: ["dealAssignmentCutoffs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/settings/deal-assignment-cutoffs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch senior AEs");
      return res.json();
    },
    enabled: isOpen && !!token
  });

  const reps: any[] = repsData?.users || [];

  // Manual Reassign Mutation
  const reassignMutation = useMutation({
    mutationFn: async ({
      dealId,
      newOwnerId,
      reason
    }: {
      dealId: string;
      newOwnerId: string;
      reason: string;
    }) => {
      const res = await fetch(`/api/v1/deals/${dealId}/reassign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newOwnerId, reason })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Reassignment failed" }));
        throw new Error(err.error || "Failed to reassign deal");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deal-reassignment-history", dealId] });
      queryClient.invalidateQueries({ queryKey: ["dealAssignmentCutoffs"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });

      if (data.exceededCutoff || data.exceededCapacity) {
        setWarningMessage({
          cutoff: data.exceededCutoff,
          capacity: data.exceededCapacity,
          repName: data.newOwner?.name || "Selected Rep"
        });
      } else {
        setSuccessInfo(`Deal successfully reassigned to ${data.newOwner?.name || "new rep"}.`);
        setTimeout(() => {
          handleClose();
          onReassigned?.();
        }, 1500);
      }
    },
    onError: (err: any) => {
      setValidationError(err.message || "Failed to reassign deal");
    }
  });

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedRepId("");
    setReason("");
    setValidationError(null);
    setWarningMessage(null);
    setSuccessInfo(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedRepId) {
      setValidationError("Please select a Senior Account Executive.");
      return;
    }

    if (!reason || !reason.trim()) {
      setValidationError("A specific reassignment reason is strictly required.");
      return;
    }

    reassignMutation.mutate({
      dealId,
      newOwnerId: selectedRepId,
      reason: reason.trim()
    });
  };

  const selectedRep = reps.find((r) => r.id === selectedRepId);
  const isSelectedRepOverCutoff =
    selectedRep &&
    selectedRep.dealValueCutoff !== null &&
    selectedRep.dealValueCutoff !== undefined &&
    dealAmount > Number(selectedRep.dealValueCutoff);
  const isSelectedRepOverCapacity =
    selectedRep &&
    selectedRep.maxOpenDeals !== null &&
    selectedRep.maxOpenDeals !== undefined &&
    selectedRep.currentOpenDeals >= Number(selectedRep.maxOpenDeals);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-up">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Reassign Opportunity Owner
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              <strong>{dealName}</strong> ({formatCurrency(dealAmount)})
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Owner Context */}
        <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-outline-variant text-xs">
          <div>
            <span className="text-on-surface-variant font-medium">Current Owner:</span>{" "}
            <strong className="text-on-surface">{currentOwnerName || "Unassigned"}</strong>
          </div>
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Phase 2 Senior AE Target
          </span>
        </div>

        {/* Non-blocking Warning Banner after successful override */}
        {warningMessage && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900 animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Reassignment Completed with Manager Override
            </div>
            <p className="text-[11px]">
              Deal was assigned to <strong>{warningMessage.repName}</strong>. Note the following guardrail flags were logged to the audit trail:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] font-semibold text-amber-800">
              {warningMessage.cutoff && (
                <li>Deal amount ({formatCurrency(dealAmount)}) exceeds rep&apos;s configured deal size cutoff.</li>
              )}
              {warningMessage.capacity && (
                <li>Rep is at or over their maximum open-deal capacity limit.</li>
              )}
            </ul>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onReassigned?.();
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
              >
                Acknowledge &amp; Close
              </button>
            </div>
          </div>
        )}

        {successInfo && !warningMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            {successInfo}
          </div>
        )}

        {validationError && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {validationError}
          </div>
        )}

        {/* Reassign Form */}
        {!warningMessage && !successInfo && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Representative Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-on-surface flex items-center justify-between">
                <span>Select New Senior AE</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  {reps.length} Senior AEs available
                </span>
              </label>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                disabled={isLoadingReps || reassignMutation.isPending}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">-- Choose Senior Account Executive --</option>
                {reps.map((r) => {
                  const isCurrent = r.id === currentOwnerId;
                  const cutoffText =
                    r.dealValueCutoff !== null ? `Cap: ${formatCurrency(r.dealValueCutoff)}` : "Uncapped";
                  const capacityText =
                    r.maxOpenDeals !== null ? `Load: ${r.currentOpenDeals}/${r.maxOpenDeals}` : `Load: ${r.currentOpenDeals}`;

                  return (
                    <option key={r.id} value={r.id} disabled={isCurrent}>
                      {r.name} {isCurrent ? "(Current Owner)" : ""} — [{cutoffText} | {capacityText}] {!r.isAvailable ? "(OOO)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Rep Live Guardrail Preview */}
            {selectedRep && (
              <div className="p-3 rounded-xl bg-surface border border-outline-variant space-y-1.5">
                <div className="text-[11px] font-bold text-on-surface flex items-center justify-between">
                  <span>Guardrail Check for {selectedRep.name}:</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${selectedRep.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {selectedRep.isAvailable ? "Available" : "OOO"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-1.5 rounded border ${isSelectedRepOverCutoff ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold" : "bg-slate-50 text-slate-700 border-slate-100"}`}>
                    Cutoff: {selectedRep.dealValueCutoff !== null ? formatCurrency(selectedRep.dealValueCutoff) : "Uncapped"}
                    {isSelectedRepOverCutoff && " ⚠️ Exceeded"}
                  </div>
                  <div className={`p-1.5 rounded border ${isSelectedRepOverCapacity ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold" : "bg-slate-50 text-slate-700 border-slate-100"}`}>
                    Capacity: {selectedRep.maxOpenDeals !== null ? `${selectedRep.currentOpenDeals}/${selectedRep.maxOpenDeals}` : `${selectedRep.currentOpenDeals} (Uncapped)`}
                    {isSelectedRepOverCapacity && " ⚠️ Exceeded"}
                  </div>
                </div>
                {(isSelectedRepOverCutoff || isSelectedRepOverCapacity) && (
                  <p className="text-[10px] text-amber-700 pt-0.5">
                    ℹ️ Manual reassignment will proceed and record an override flag in the audit trail.
                  </p>
                )}
              </div>
            )}

            {/* Reason Field (REQUIRED) */}
            <div className="space-y-1.5">
              <label className="font-bold text-on-surface flex items-center justify-between">
                <span>Reassignment Reason <span className="text-red-500">*</span></span>
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase">Strictly Required</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specify the business justification (e.g. Account executive strategic alignment, vertical expertise, capacity rebalancing)..."
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none resize-none"
              />
              <p className="text-[10px] text-on-surface-variant">
                This reason will be permanently recorded in the deal reassignment audit history.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 bg-surface hover:bg-surface-container-high text-on-surface font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reassignMutation.isPending || !selectedRepId || !reason.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {reassignMutation.isPending && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Confirm Reassignment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
