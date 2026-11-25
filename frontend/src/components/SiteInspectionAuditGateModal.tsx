import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  ShieldCheck,
  HardHat,
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import { canApproveInspection } from "../lib/siteInspection";
import { useAuth } from "../context/AuthContext";

interface SiteInspectionAuditGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  inspection: any;
  gateMessage?: string;
  onAuditApproved?: () => void;
}

export const SiteInspectionAuditGateModal: React.FC<SiteInspectionAuditGateModalProps> = ({
  isOpen,
  onClose,
  lead,
  inspection,
  gateMessage,
  onAuditApproved
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const userRole = user?.role || "";
  const isApprover = canApproveInspection(userRole, inspection?.assignedToId, user?.id);

  const inspectionStatus = inspection?.status || lead?.siteInspectionStatus || "REQUESTED";
  const inspectionNumber = inspection?.inspectionNumber || "SI-NEW";
  const inspectorName = inspection?.assignedTo?.name || "Assigned Field Inspector";

  const handleApprove = async () => {
    if (!inspection?.id) {
      setError("No active inspection record found to approve.");
      return;
    }
    setIsApproving(true);
    setError(null);
    try {
      await siteInspectionApi.reviewInspection(
        inspection.id,
        "APPROVE",
        approvalComment.trim() || "Site inspection audit accepted and approved by Team Lead."
      );
      if (onAuditApproved) {
        onAuditApproved();
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to approve site inspection.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-amber-100 dark:border-amber-900/50 flex items-start justify-between gap-3 bg-amber-50/70 dark:bg-amber-950/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-amber-950 dark:text-amber-200 tracking-tight">
                  Site Inspection Audit Required
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Gate Locked
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium mt-0.5">
                Qualification gate is held pending site inspection audit approval.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-amber-700/60 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              This job was designated as requiring an on-site technical inspection. Per operational compliance rules, the sales representative cannot advance this lead to <strong>Qualified</strong> until the site inspector's audit report is reviewed and accepted by a <strong>Team Lead, Supervisor, or Operations Manager</strong>.
            </p>
            {gateMessage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{gateMessage}</span>
              </div>
            )}
          </div>

          {/* Inspection Metadata Card */}
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Inspection Reference
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {inspectionNumber}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Audit Status
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {inspectionStatus}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Site Inspector
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {inspectorName}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 text-xs rounded-xl border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          {/* Quick Team Lead Approval Section (If User is an Approver) */}
          {isApprover && inspection?.id && (
            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                    Team Lead / Manager Authority Detected
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded">
                  {userRole}
                </span>
              </div>

              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-tight">
                As an authorized manager, you may review and accept this audit report directly to unlock the qualification gate.
              </p>

              {showApprovalForm ? (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Approval note (e.g. Approved: Plant gate clearance and tank volume verified)"
                    className="w-full text-xs p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApprovalForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isApproving ? "Approving..." : "Confirm & Accept Audit"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowApprovalForm(true)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition active:scale-98 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Accept &amp; Approve Site Audit as Team Lead</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>

          {inspection?.id ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/site-inspections/${inspection.id}`);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Open Site Inspection Dossier</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
