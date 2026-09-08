import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Target, CheckCircle2, Sparkles, DollarSign, Calendar, UserCheck, FileText, AlertCircle, ArrowRight, User } from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface QualificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  token: string | null;
  onSuccess: () => void;
}

export function QualificationDrawer({ isOpen, onClose, lead, token, onSuccess }: QualificationDrawerProps) {
  const navigate = useNavigate();
  const existingQual = lead?.qualificationData || {};

  const [requirement, setRequirement] = useState(existingQual.requirement || lead?.body || "");
  const [budget, setBudget] = useState(existingQual.budget || lead?.budgetRange || "500000");
  const [timeline, setTimeline] = useState(existingQual.timeline || "Within 30 Days");
  const [decisionMaker, setDecisionMaker] = useState(existingQual.decisionMaker || `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim());
  const [estimatedValue, setEstimatedValue] = useState(existingQual.estimatedValue || lead?.leadScore ? String(lead.leadScore * 10000) : "500000");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-Step Modal Flow States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resultModalData, setResultModalData] = useState<any | null>(null);

  if (!isOpen) return null;

  // Step 1: Rep clicks form submit -> Show Confirmation Modal first
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowConfirmModal(true);
  };

  // Step 2: Rep confirms in modal -> Execute API qualification & auto-assignment
  const handleExecuteQualification = async () => {
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

      const data = await res.json();
      setShowConfirmModal(false);
      setResultModalData(data);
    } catch (err: any) {
      setShowConfirmModal(false);
      setError(err.message || "An error occurred during qualification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishResult = (navigateToOpp: boolean = false) => {
    const oppId = resultModalData?.deal?.id || resultModalData?.opportunity?.id;
    onSuccess();
    onClose();
    if (navigateToOpp && oppId) {
      navigate(`/opportunities/${oppId}`);
    }
  };

  // Compute actual assigned rep name & outcome text for Result Modal
  const assignOutcome = resultModalData?.autoAssignResult || resultModalData || {};
  const isAssigned = assignOutcome.assigned || resultModalData?.autoAssigned;
  const assignedRepName = assignOutcome.assignee?.name || resultModalData?.deal?.owner?.name || resultModalData?.lead?.assignedTo?.name || "Assigned Closer";
  const qualifyingRepName = lead?.assignedTo?.name || "qualifying rep";

  return (
    <>
      {/* Drawer Overlay & Panel */}
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/80 rounded-xl text-indigo-700 dark:text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lead Qualification Drawer</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Qualify {lead?.company || `${lead?.firstName} ${lead?.lastName}`} in 5 simple questions</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form id="qualification-form" onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Requirements */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                1. Product / Solution Requirement Summary
              </label>
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="What specific product, features, or service packages is the customer inquiring about?"
                rows={3}
                required
                className="w-full enterprise-input text-xs"
              />
            </div>

            {/* 2. Budget Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                2. Customer Stated Budget
              </label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full enterprise-input text-xs"
              >
                <option value="Under SAR 50,000">Under SAR 50,000</option>
                <option value="SAR 50,000 - 100,000">SAR 50,000 - 100,000</option>
                <option value="SAR 100,000 - 500,000">SAR 100,000 - 500,000</option>
                <option value="SAR 500,000 - 1,000,000">SAR 500,000 - 1,000,000</option>
                <option value="Above SAR 1,000,000">Above SAR 1,000,000</option>
              </select>
            </div>

            {/* 3. Expected Value (Numeric) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                3. Estimated Commercial Value (SAR)
              </label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="500000"
                required
                min={1000}
                className="w-full enterprise-input text-xs font-semibold"
              />
              <p className="text-[11px] text-slate-400">Used for deal size cutoff safety gates & pipeline forecasting.</p>
            </div>

            {/* 4. Decision Timeline */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                4. Estimated Decision Timeline
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full enterprise-input text-xs"
              >
                <option value="Immediate (< 7 Days)">Immediate (&lt; 7 Days)</option>
                <option value="Within 30 Days">Within 30 Days</option>
                <option value="1 - 3 Months">1 - 3 Months</option>
                <option value="3+ Months / Future Project">3+ Months / Future Project</option>
              </select>
            </div>

            {/* 5. Primary Decision Maker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-purple-600" />
                5. Key Contact & Decision Maker Name
              </label>
              <input
                type="text"
                value={decisionMaker}
                onChange={(e) => setDecisionMaker(e.target.value)}
                placeholder="e.g. Sheikh Moidin (Procurement Director)"
                required
                className="w-full enterprise-input text-xs"
              />
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="qualification-form"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow flex items-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Qualify Lead & Create Opportunity</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 1 MODAL: CONFIRMATION DIALOG                                         */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Lead Qualification</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Step 1 of 2: Pre-Conversion Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Convert this lead to a commercial <strong>Opportunity</strong>? It will be automatically assigned to the best available closer based on capacity and deal size cutoff rules.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Est. Opportunity Value:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(parseFloat(estimatedValue) || 500000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Qualifying Representative:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{lead?.assignedTo?.name || "Current Rep"}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteQualification}
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow flex items-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <span>Converting & Auto-Assigning...</span>
                ) : (
                  <>
                    <span>Confirm & Qualify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 2 MODAL: RESULT & ASSIGNMENT CONFIRMATION DIALOG                       */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {resultModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="text-center space-y-2">
              <div className={`w-12 h-12 rounded-full ${isAssigned ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'} flex items-center justify-center mx-auto border border-emerald-200/50`}>
                {isAssigned ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAssigned ? "Lead Converted & Auto-Assigned!" : "Lead Converted — Manual Assignment Needed"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Step 2 of 2: Conversion Summary & Ownership Status
              </p>
            </div>

            {/* Detailed Result Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Account Created:</span>
                <span className="font-bold text-slate-900 dark:text-white">{resultModalData.account?.name || lead.company || "Customer Account"}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Opportunity Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{resultModalData.deal?.name || "Commercial Opportunity"}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Deal Amount:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(resultModalData.deal?.amount || parseFloat(estimatedValue))}</span>
              </div>

              <div className="flex justify-between items-start pt-1">
                <span className="text-slate-500 dark:text-slate-400">Assigned Closer:</span>
                <div className="text-right">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 justify-end">
                    <User className="w-3.5 h-3.5" />
                    {assignedRepName}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
                    {isAssigned
                      ? "Assigned to the highest-scoring eligible closer."
                      : `No eligible closer found — retained by ${qualifyingRepName}.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleFinishResult(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleFinishResult(true)}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow flex items-center gap-2 transition-all"
              >
                <span>View Opportunity</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
