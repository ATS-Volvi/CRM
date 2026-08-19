import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface HistoryRecord {
  id: string;
  dealId: string;
  oldOwnerId: string | null;
  newOwnerId: string;
  changedByUserId: string;
  assignmentType: "AUTOMATIC" | "MANUAL" | string;
  dealAmountAtReassignment: number | string | null;
  exceededCutoff: boolean;
  exceededCapacity: boolean;
  reason: string | null;
  createdAt: string;
  oldOwner?: { id: string; name: string; email: string; role: string } | null;
  newOwner?: { id: string; name: string; email: string; role: string } | null;
  changedByUser?: { id: string; name: string; email: string; role: string } | null;
}

export function DealReassignmentHistorySection({ dealId }: { dealId: string }) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  const { data: historyData, isLoading, error } = useQuery<{
    success: boolean;
    dealId: string;
    history: HistoryRecord[];
  }>({
    queryKey: ["deal-reassignment-history", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/reassignment-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch reassignment history");
      return res.json();
    },
    enabled: !!dealId && !!token
  });

  const history = historyData?.history || [];

  return (
    <div className="enterprise-card p-4 space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left focus:outline-none group"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Reassignment &amp; Audit History ({history.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">
            {history.length} change{history.length === 1 ? "" : "s"} logged
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="pt-2 border-t border-slate-100">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Loading audit logs...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              Failed to load audit trail.
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
              No reassignments recorded yet. Deal is with its initial owner.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => {
                const oldName = record.oldOwner?.name || (record.oldOwnerId ? "Previous Rep" : "Unassigned");
                const newName = record.newOwner?.name || "Senior AE";
                const changerName = record.changedByUser?.name || "System";
                const isAuto = record.assignmentType === "AUTOMATIC";

                return (
                  <div
                    key={record.id}
                    className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs transition-colors"
                  >
                    {/* Header Row: Transfer and Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="text-slate-500 font-medium">{oldName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-blue-700 font-extrabold">{newName}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isAuto
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                        >
                          {isAuto ? "⚡ AUTOMATIC" : "👤 MANUAL OVERRIDE"}
                        </span>
                      </div>
                    </div>

                    {/* Override Warning Badges */}
                    {(record.exceededCutoff || record.exceededCapacity) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {record.exceededCutoff && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Over Deal Cutoff
                          </span>
                        )}
                        {record.exceededCapacity && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Over Capacity Limit
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reason Text */}
                    {record.reason && (
                      <div className="p-2 bg-white rounded-lg border border-slate-200/60 text-slate-700 text-[11px] leading-relaxed">
                        <span className="font-semibold text-slate-500">Reason: </span>
                        {record.reason}
                      </div>
                    )}

                    {/* Footer Row: Timestamp & Triggered By */}
                    <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(record.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      <span>
                        Changed by: <strong className="text-slate-600">{changerName}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
