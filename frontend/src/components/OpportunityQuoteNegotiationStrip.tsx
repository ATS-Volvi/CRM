import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Check,
  Sparkles,
  ArrowRight,
  TrendingDown,
  MessageSquare,
  History,
  ShieldCheck
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { QuickQuoteRevisionModal } from "./QuickQuoteRevisionModal";
import { QuoteBillModal } from "./QuoteBillModal";

interface QuoteItem {
  id: string;
  quoteNumber?: string;
  version: number;
  status: string;
  totalAmount: number;
  isFinalAgreed?: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
}

interface OpportunityQuoteNegotiationStripProps {
  opportunity: any;
  isDetailedView?: boolean;
}

export function OpportunityQuoteNegotiationStrip({
  opportunity,
  isDetailedView = false
}: OpportunityQuoteNegotiationStripProps) {
  const queryClient = useQueryClient();
  const [revisionQuoteId, setRevisionQuoteId] = useState<string | null>(null);
  const [viewQuoteModalId, setViewQuoteModalId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const rawQuotes: QuoteItem[] = Array.isArray(opportunity.quotes) ? opportunity.quotes : [];

  // Sort quotes by version ascending
  const sortedQuotes = [...rawQuotes].sort((a, b) => (Number(a.version) || 1) - (Number(b.version) || 1));

  // Determine active quote (highest non-superseded version, or latest created)
  const activeQuote =
    [...sortedQuotes].reverse().find((q) => q.status !== "Superseded" && q.status !== "Cancelled") ||
    sortedQuotes[sortedQuotes.length - 1];

  // Has any quote been marked as final agreed
  const finalAgreedQuote = sortedQuotes.find((q) => q.isFinalAgreed === true || q.status === "Accepted");

  // Customer activity calculation
  const customerActivityInfo = React.useMemo(() => {
    const rawDate =
      opportunity.lastCustomerActivityAt ||
      opportunity.lastInboundActivityAt ||
      (opportunity.activities &&
        opportunity.activities.find((a: any) => a.direction === "inbound" || a.isCustomerSide)?.createdAt);

    if (!rawDate) {
      return { label: "No inbound reply yet", isSilent: false, days: 0, textClass: "text-slate-400" };
    }

    const activityTime = new Date(rawDate).getTime();
    const diffMs = Date.now() - activityTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return {
        label: `Customer replied ${diffHours === 0 ? "just now" : `${diffHours}h ago`}`,
        isSilent: false,
        days: 0,
        textClass: "text-emerald-700 font-bold"
      };
    } else if (diffDays <= 3) {
      return {
        label: `Customer replied ${diffDays}d ago`,
        isSilent: false,
        days: diffDays,
        textClass: "text-slate-600 font-semibold"
      };
    } else {
      return {
        label: `Silent for ${diffDays} days`,
        isSilent: true,
        days: diffDays,
        textClass: "text-amber-800 font-bold"
      };
    }
  }, [opportunity]);

  // Mark as final agreed mutation
  const markFinalMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiClient.post(`/api/v1/quotes/${quoteId}/mark-final`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setStatusMessage("Marked as Final Agreed Quote!");
      setTimeout(() => setStatusMessage(null), 3000);
    }
  });

  const getStatusBadge = (q: QuoteItem, isActive: boolean) => {
    const isSuperseded = q.status === "Superseded";
    const isAccepted = q.status === "Accepted" || q.isFinalAgreed;
    const isSent = q.status === "Sent" || q.status === "Viewed";
    const isPending = q.status === "Pending Approval";

    let bg = "bg-slate-100 text-slate-600 border-slate-200";
    let statusText = q.status || "Draft";

    if (isAccepted) {
      bg = "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold";
      statusText = "Accepted";
    } else if (isSuperseded) {
      bg = "bg-slate-100/70 text-slate-400 border-slate-200 line-through";
      statusText = "Superseded";
    } else if (isSent) {
      bg = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
      statusText = "Sent";
    } else if (isPending) {
      bg = "bg-purple-100 text-purple-900 border-purple-300 font-bold";
      statusText = "Under Approval";
    } else if (q.status === "Rejected") {
      bg = "bg-rose-100 text-rose-800 border-rose-200";
      statusText = "Rejected";
    }

    return (
      <button
        key={q.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setViewQuoteModalId(q.id);
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-all cursor-pointer hover:opacity-90 active:scale-95 ${bg} ${
          isActive && !isSuperseded ? "ring-2 ring-amber-500/40 shadow-2xs" : ""
        }`}
        title={`View quote ${q.quoteNumber || `v${q.version}`} document - ${formatCurrency(q.totalAmount)}`}
      >
        <span className="font-mono font-bold">v{q.version || 1}</span>
        <span className="text-[9px] uppercase tracking-wider">{statusText}</span>
        {q.isFinalAgreed && (
          <span className="text-emerald-700 font-extrabold text-[10px]" title="Final Agreed Quote">
            ★
          </span>
        )}
        <span className="font-mono font-semibold ml-0.5">{formatCurrencyCompact(q.totalAmount)}</span>
      </button>
    );
  };

  if (sortedQuotes.length === 0) {
    return (
      <div className="flex items-center justify-between text-xs text-slate-400 py-1" onClick={(e) => e.stopPropagation()}>
        <span className="italic flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-slate-300" /> No formal quote issued yet
        </span>
        <button
          onClick={() => (window.location.href = `/quotes/new?opportunityId=${opportunity.id}`)}
          className="px-2 py-0.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors"
        >
          + Prepare Quote
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-1" onClick={(e) => e.stopPropagation()}>
      {/* Version History Strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
          <History className="w-3 h-3 text-slate-400" /> Revisions:
        </span>
        {sortedQuotes.map((q) => {
          const isActive = activeQuote ? activeQuote.id === q.id : false;
          return getStatusBadge(q, isActive);
        })}
      </div>

      {/* Active Quote Details, Customer Activity & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-slate-100/80">
        <div className="flex items-center gap-3 text-[11px]">
          {/* Active Version Highlight */}
          {activeQuote && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Active Terms:</span>
              <span className="font-bold text-slate-900">
                v{activeQuote.version} ({formatCurrency(activeQuote.totalAmount)})
              </span>
            </div>
          )}

          {/* Customer Activity / Inbound Signal */}
          <div className={`flex items-center gap-1 text-[11px] ${customerActivityInfo.textClass}`}>
            {customerActivityInfo.isSilent ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span>{customerActivityInfo.label}</span>
          </div>
        </div>

        {/* Quick Actions (1-Click without page navigation) */}
        <div className="flex items-center gap-1.5">
          {statusMessage && (
            <span className="text-[10px] font-bold text-emerald-700 animate-fade-in bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {statusMessage}
            </span>
          )}

          {/* Mark Final Action */}
          {activeQuote && !activeQuote.isFinalAgreed && activeQuote.status !== "Accepted" && (
            <button
              onClick={() => markFinalMutation.mutate(activeQuote.id)}
              disabled={markFinalMutation.isPending}
              type="button"
              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
              title="Mark this active quote revision as the Final Agreed terms"
            >
              <Check className="w-3 h-3 stroke-[3] text-emerald-700" />
              {markFinalMutation.isPending ? "Marking..." : "Mark as Final"}
            </button>
          )}

          {/* Final Agreed indicator badge */}
          {finalAgreedQuote && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
              <ShieldCheck className="w-3 h-3 text-emerald-700" />
              Final Agreed (v{finalAgreedQuote.version})
            </span>
          )}

          {/* View Bill Action */}
          {activeQuote && (
            <button
              onClick={() => setViewQuoteModalId(activeQuote.id)}
              type="button"
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-2xs cursor-pointer"
              title="Preview Bill / Quotation Document"
            >
              <FileText className="w-3 h-3 text-slate-400" />
              View Quote
            </button>
          )}

          {/* Create Revision Action */}
          {activeQuote && activeQuote.status !== "Cancelled" && (
            <button
              onClick={() => setRevisionQuoteId(activeQuote.id)}
              type="button"
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
              title="Create a new quote revision prefilled with active quote items"
            >
              <Plus className="w-3 h-3 stroke-[3] text-amber-700" />
              Create Revision
            </button>
          )}
        </div>
      </div>

      {/* Quick Revision Modal */}
      {revisionQuoteId && (
        <QuickQuoteRevisionModal
          quoteId={revisionQuoteId}
          opportunityId={opportunity.id}
          opportunityName={opportunity.name}
          onClose={() => setRevisionQuoteId(null)}
          onSuccess={() => setRevisionQuoteId(null)}
        />
      )}

      {/* Bill Preview Modal Popup */}
      {viewQuoteModalId && (
        <QuoteBillModal
          quoteId={viewQuoteModalId}
          onClose={() => setViewQuoteModalId(null)}
        />
      )}
    </div>
  );
}
