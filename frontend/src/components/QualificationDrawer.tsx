import React, { useState } from "react";
import { X, Target, CheckCircle, Sparkles, DollarSign, Calendar, UserCheck, FileText, AlertCircle } from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface QualificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  token: string | null;
  onSuccess: () => void;
}

export function QualificationDrawer({ isOpen, onClose, lead, token, onSuccess }: QualificationDrawerProps) {
  const existingQual = lead?.qualificationData || {};

  const [requirement, setRequirement] = useState(existingQual.requirement || lead?.body || "");
  const [budget, setBudget] = useState(existingQual.budget || lead?.budgetRange || "500000");
  const [timeline, setTimeline] = useState(existingQual.timeline || "Within 30 Days");
  const [decisionMaker, setDecisionMaker] = useState(existingQual.decisionMaker || `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim());
  const [estimatedValue, setEstimatedValue] = useState(existingQual.estimatedValue || lead?.leadScore ? String(lead.leadScore * 10000) : "500000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/qualify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          requirement,
          budget,
          timeline,
          decisionMaker,
          estimatedValue: parseFloat(estimatedValue) || 500000
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to qualify lead.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lead Qualification Drawer</h2>
              <p className="text-xs text-slate-500">Qualify {lead?.company || `${lead?.firstName} ${lead?.lastName}`} in 5 simple questions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form id="qualification-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              Submitting this drawer auto-promotes lead to <span className="font-extrabold text-indigo-700">Qualified</span>, auto-creates the <span className="font-extrabold text-indigo-700">Opportunity</span> & <span className="font-extrabold text-indigo-700">Customer Account</span>, and sets Next Action to <span className="font-extrabold text-indigo-700">Prepare Quote</span>.
            </p>
          </div>

          {/* 1. Requirement */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              1. Key Customer Requirement *
            </label>
            <textarea
              required
              rows={3}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="e.g. Needs 5 custom control panels with Schneider components and 2-week delivery."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/50"
            />
          </div>

          {/* 2. Budget */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              2. Stated Budget Range
            </label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. ₹5,00,000 - ₹10,00,000"
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/50"
            />
          </div>

          {/* 3. Timeline */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              3. Purchase Timeline
            </label>
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/50"
            >
              <option value="Immediate (< 7 Days)">Immediate (&lt; 7 Days)</option>
              <option value="Within 30 Days">Within 30 Days</option>
              <option value="This Quarter (60-90 Days)">This Quarter (60-90 Days)</option>
              <option value="Budgeting for Next FY">Budgeting for Next FY</option>
            </select>
          </div>

          {/* 4. Decision Maker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              4. Key Decision Maker / Contact
            </label>
            <input
              type="text"
              value={decisionMaker}
              onChange={(e) => setDecisionMaker(e.target.value)}
              placeholder="e.g. Michael Hill (VP Procurement)"
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/50"
            />
          </div>

          {/* 5. Estimated Value */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              5. Estimated Opportunity Value (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                required
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="500000"
                className="w-full text-xs pl-7 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-slate-50/50 font-bold text-slate-900"
              />
            </div>
            {estimatedValue && (
              <p className="text-[11px] text-emerald-700 font-semibold text-right">
                Formatted: {formatCurrency(parseFloat(estimatedValue) || 0)}
              </p>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="qualification-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Qualifying...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Qualify Lead & Create Opportunity</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
