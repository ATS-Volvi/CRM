import React, { useState } from "react";
import {
  Phone,
  PhoneCall,
  X,
  Copy,
  Check,
  MessageSquare,
  Building2,
  HardHat,
  FileCheck,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  ExternalLink
} from "lucide-react";

interface ContactCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onConfirm: (options: {
    notes: string;
    requiresSiteInspection: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const ContactCustomerModal: React.FC<ContactCustomerModalProps> = ({
  isOpen,
  onClose,
  lead,
  onConfirm,
  isSubmitting = false,
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [notes, setNotes] = useState("");
  const [requiresSiteInspection, setRequiresSiteInspection] = useState<boolean>(() => {
    if (lead?.status === "NEW") return false;
    return lead?.requiresSiteInspection === true;
  });

  if (!isOpen || !lead) return null;

  const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Customer Contact";
  const companyName = lead.company || "Client Company";
  const rawPhone = lead.phone || "";
  const cleanPhone = rawPhone.replace(/[^0-9+]/g, "");

  const handleCopyPhone = () => {
    if (!rawPhone) return;
    navigator.clipboard.writeText(rawPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleQuickChipClick = (chipText: string) => {
    setNotes((prev) => (prev ? `${prev} • ${chipText}` : chipText));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      notes: notes.trim() || "Spoke with client regarding project scope & site access.",
      requiresSiteInspection,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/60 via-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Client Outreach &amp; Scoping
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wider">
                  Contact Step
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Call the customer to discuss requirements, job scope, and site accessibility.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* 1. Customer & Phone Callout */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                  Customer &amp; Account
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {clientName}
                </h3>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {companyName}
                </p>
              </div>
              {lead.source && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
                  {lead.source}
                </span>
              )}
            </div>

            {/* CX Phone Number Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/90 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-[#059669]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Customer Phone (CX Number)
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono tracking-tight text-slate-900 dark:text-white truncate block">
                    {rawPhone || "No phone number available"}
                  </span>
                </div>
              </div>

              {/* Action Buttons for Phone */}
              {rawPhone && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                    title="Copy Customer Phone Number"
                  >
                    {copiedPhone ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`tel:${cleanPhone}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                    title="Call Customer Directly"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Now</span>
                  </a>

                  {cleanPhone && (
                    <a
                      href={`https://wa.me/${cleanPhone.replace("+", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Open WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Site Inspection Scoping Option (The Core Choice) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-emerald-600" />
                Is an On-Site Technical Inspection Needed for this Job?
              </label>
              <span className="text-[10px] font-bold text-slate-400">Required Selection</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: YES */}
              <div
                onClick={() => setRequiresSiteInspection(true)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  requiresSiteInspection === true
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        requiresSiteInspection === true ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {requiresSiteInspection === true && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Yes — Inspection Needed
                      </span>
                    </div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 uppercase">
                      Site Visit
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Field technician must visit the facility for equipment staging, UHP hydrojetting measurement, or Aramco/RCJY gate access.
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <span>✓ Adds Site Inspection to progress bar</span>
                </div>
              </div>

              {/* Option 2: NO */}
              <div
                onClick={() => setRequiresSiteInspection(false)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  requiresSiteInspection === false
                    ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        requiresSiteInspection === false ? "border-blue-600 bg-blue-600" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {requiresSiteInspection === false && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        No — Standard Scope
                      </span>
                    </div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 uppercase">
                      Direct Quote
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Standard catalog pricing, remote specifications, or client-provided drawings. No physical field survey required.
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-blue-200/60 dark:border-blue-900/60 text-[10px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <span>✓ Standard 4-step pipeline</span>
                </div>
              </div>
            </div>

            {requiresSiteInspection && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong>Approval Rule:</strong> Once Site Inspection is added, advancing this lead to <em>Qualified</em> will require the site inspector's audit report to be reviewed and accepted by a <strong>Team Lead or Higher Authority</strong>.
                </div>
              </div>
            )}
          </div>

          {/* 3. Call Notes & Outcome */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Call Notes &amp; Scope Summary
              </label>
              <span className="text-[10px] text-slate-400">Saved to Activity Timeline</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="E.g. Called customer at Jubail plant. Confirmed tank farm cleaning requirements, target schedule for Q1 turnaround, and preliminary gate clearances."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
            />

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "Discussed scope & specs",
                "Aramco/RCJY gate access verified",
                "Client sent tank drawings",
                "Target mobilization: <14 days",
                "Call completed successfully"
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickChipClick(chip)}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-slate-600 dark:text-slate-400 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  + {chip}
                </button>
              ))}
            </div>
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
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] hover:opacity-95 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Stage...</span>
                </>
              ) : (
                <>
                  <span>Confirm Outreach &amp; Set Stage</span>
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
