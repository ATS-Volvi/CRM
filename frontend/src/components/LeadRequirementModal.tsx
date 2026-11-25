import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  X,
  Sparkles,
  DollarSign,
  Calendar,
  UserCheck,
  Building2,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface LeadRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  token: string | null;
  onSuccess: () => void;
}

export const LeadRequirementModal: React.FC<LeadRequirementModalProps> = ({
  isOpen,
  onClose,
  lead,
  token,
  onSuccess,
}) => {
  const existingQual = typeof lead?.qualificationData === "string"
    ? JSON.parse(lead.qualificationData)
    : lead?.qualificationData || {};

  const initialRequirement = existingQual.requirement || existingQual.notes || lead?.body || lead?.notes || "";
  const initialBudget = existingQual.estimatedValue || existingQual.budget || lead?.expectedValue || lead?.budgetRange || "120000";
  const initialTimeline = existingQual.timeline || "Within 30 Days";
  const initialDecisionMaker = existingQual.decisionMaker || `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim() || "Procurement Manager";

  const [requirement, setRequirement] = useState(initialRequirement);
  const [budget, setBudget] = useState(String(initialBudget));
  const [timeline, setTimeline] = useState(initialTimeline);
  const [decisionMaker, setDecisionMaker] = useState(initialDecisionMaker);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !lead) return null;

  const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Customer Contact";
  const companyName = lead.company || "Client Company";

  const handleQuickChip = (chip: string) => {
    setRequirement((prev: string) => (prev ? `${prev} • ${chip}` : chip));
  };

  const handleSaveAndQualify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!requirement.trim()) {
      setError("Please fill in the customer requirements to qualify this lead.");
      return;
    }

    setIsSubmitting(true);
    try {
      const numBudget = parseFloat(budget.replace(/[^0-9.]/g, "")) || 0;

      // 1. First ensure an activity note is logged so qualification validation passes
      try {
        await fetch(`/api/v1/leads/${lead.id}/activities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            type: "note",
            outcome: "Customer Requirements Documented",
            notes: `Scope & Requirements: ${requirement.trim()} | Budget: SAR ${numBudget.toLocaleString()} | Timeline: ${timeline} | Decision Maker: ${decisionMaker}`,
            direction: "internal"
          })
        });
      } catch (actErr) {
        console.warn("Log qualification activity warn:", actErr);
      }

      // 2. Update lead with requirements, estimated value, and status -> QUALIFIED
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "QUALIFIED",
          requirements: requirement.trim(),
          expectedValue: numBudget,
          budgetRange: String(numBudget),
          qualificationData: {
            requirement: requirement.trim(),
            budget: String(numBudget),
            estimatedValue: numBudget,
            timeline,
            decisionMaker
          }
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to qualify lead.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to qualify lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/50 dark:from-slate-800/60 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Document Requirements &amp; Qualify Lead
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wider">
                  Mandatory Gate
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Record verified job requirements and commercial parameters before advancing to Qualified.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSaveAndQualify} className="p-6 space-y-4 overflow-y-auto">
          {/* Customer Context Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
              <span className="font-black text-slate-900 dark:text-white truncate block">{clientName}</span>
              <span className="text-[11px] font-semibold text-slate-500 truncate block">{companyName}</span>
            </div>
            {lead.phone && (
              <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shrink-0">
                {lead.phone}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 text-xs rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Job Scope & Technical Requirements (REQUIRED) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#059669]" />
                Customer Requirements &amp; Job Scope <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-emerald-600">Required to Qualify</span>
            </div>
            <textarea
              value={requirement}
              onChange={(e) => {
                setRequirement(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              placeholder="Describe the exact requirements: services required, equipment specs, plant gate clearance, safety hazards, volume, and mobilization requirements..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none leading-relaxed"
              required
            />

            {/* Quick Chips for Industrial Services */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "Hydrojetting (40,000 PSI)",
                "Waste Management (NCEC HazMat)",
                "Equipment Rental (Cranes & Fleet)",
                "Modular Units & TCF Cabins",
                "Aramco Restricted Gate Pass",
                "SABIC / RCJY Environmental Permit"
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickChip(chip)}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-slate-600 dark:text-slate-400 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Commercial Parameters: Estimated Value & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                Estimated Deal Value / Budget (SAR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">SAR</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="120000"
                  className="w-full text-xs pl-12 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Target Execution Timeline
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold focus:outline-hidden"
              >
                <option value="Immediate (< 7 Days)">Immediate (&lt; 7 Days — Emergency)</option>
                <option value="Within 14 Days">Within 14 Days (Urgent)</option>
                <option value="Within 30 Days">Within 30 Days (Scheduled Turnaround)</option>
                <option value="30 - 60 Days">30 - 60 Days (Project Shutdown)</option>
                <option value="Quarterly / Long Term">Quarterly / Long Term Contract</option>
              </select>
            </div>
          </div>

          {/* 3. Decision Maker / Stakeholder */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Primary Decision Maker / Authority
            </label>
            <input
              type="text"
              value={decisionMaker}
              onChange={(e) => setDecisionMaker(e.target.value)}
              placeholder="e.g. Eng. Mansoor (Procurement Director)"
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold focus:outline-hidden"
            />
          </div>

          {/* Informative Note */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Saving requirements will log an official requirement note to the lead's activity timeline and transition the status to <strong>Qualified</strong>.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !requirement.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] hover:opacity-95 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validating &amp; Qualifying...</span>
                </>
              ) : (
                <>
                  <span>Save Requirements &amp; Qualify Lead</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
