export type OpportunityLifecycleStatus = "OPEN" | "WON" | "LOST" | "ALL";
export type OpportunityCommercialPhase = "Discovery" | "Negotiation" | "PO";

export interface OpportunityPhaseResult {
  phase: OpportunityCommercialPhase;
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
}

/**
 * Deterministically derives the 3 cosmetic sub-labels for Opportunities:
 * - Discovery: No quotes generated / early scoping
 * - Negotiation: 2+ quote versions, quote marked isFinalAgreed, or latest active quote is Sent/Viewed/Under Review awaiting reply
 * - PO: Purchase Order received / pending reconciliation or accepted
 */
export function deriveOpportunityPhase(opp: any, quotesOverride?: any[]): OpportunityPhaseResult {
  if (!opp) {
    return {
      phase: "Discovery",
      label: "Discovery",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      description: "Initial scoping & discovery — no quotes published yet"
    };
  }

  const quotes: any[] = Array.isArray(quotesOverride)
    ? quotesOverride
    : Array.isArray(opp.quotes)
    ? opp.quotes
    : [];

  // Check PO signals (PO received, verified, pending reconciliation, or quote marked Accepted)
  const hasPurchaseOrderSignal =
    Boolean(opp.purchaseOrder) ||
    Boolean(opp.hasPurchaseOrder) ||
    (Array.isArray(opp.purchaseOrders) && opp.purchaseOrders.length > 0) ||
    quotes.some(
      (q: any) =>
        q?.status === "Accepted" ||
        (Array.isArray(q?.purchaseOrders) && q.purchaseOrders.length > 0)
    );

  if (hasPurchaseOrderSignal) {
    return {
      phase: "PO",
      label: "PO",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-600",
      description: "Purchase Order received — pending reconciliation or confirmed"
    };
  }

  // Check Negotiation signals:
  // - 2+ quote versions (or quotes.length > 1 or version > 1)
  // - OR quote is marked isFinalAgreed
  // - OR latest active quote is Sent / Viewed / Under Review / Pending Approval
  const hasMultipleVersions = quotes.some((q: any) => Number(q?.version || 1) > 1) || quotes.length > 1;
  const hasFinalAgreedQuote = quotes.some((q: any) => q?.isFinalAgreed === true);

  const sortedQuotes = [...quotes].sort((a: any, b: any) => (Number(a?.version) || 1) - (Number(b?.version) || 1));
  const activeQuote = [...sortedQuotes].reverse().find((q: any) => q?.status !== "Superseded" && q?.status !== "Cancelled");
  const isAwaitingReplyOrInReview = !!activeQuote && (
    activeQuote.status === "Sent" ||
    activeQuote.status === "Viewed" ||
    activeQuote.status === "Pending Approval" ||
    activeQuote.status === "Under Review" ||
    activeQuote.status === "Draft"
  );

  if (hasMultipleVersions || hasFinalAgreedQuote || isAwaitingReplyOrInReview) {
    return {
      phase: "Negotiation",
      label: "Negotiation",
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
      dotClass: "bg-violet-600",
      description: "Commercial terms negotiation & quote revision in progress"
    };
  }

  // Default: Discovery
  return {
    phase: "Discovery",
    label: "Discovery",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    description: "Initial scoping & discovery — no quotes published yet"
  };
}
