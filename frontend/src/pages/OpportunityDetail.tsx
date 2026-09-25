import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  DollarSign,
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  Lock,
  RefreshCw,
  X,
  XCircle,
  Send,
  Download,
  History,
  Check,
  Percent,
  Shield,
  Briefcase,
  TrendingUp,
  Tag,
  Share2,
  CheckSquare
} from "lucide-react";

import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import { DealReassignModal } from "../components/DealReassignModal";
import { DealReassignmentHistorySection } from "../components/DealReassignmentHistorySection";
import { DealSplitsSection } from "../components/DealSplitsSection";
import { HandoffChatWidget } from "../components/HandoffChatWidget";
import { deriveOpportunityPhase } from "../utils/opportunityPhases";
import { usePipelineStages } from "../utils/pipelineStages";
import { QuoteBillModal } from "../components/QuoteBillModal";
import { SendQuoteChannelModal } from "../components/SendQuoteChannelModal";
import { AiRequirementSummaryCard } from "../components/AiRequirementSummaryCard";

// ── Dynamic Rule-Derived Risk Indicator ──────────────────────────────────────────
function computeDealRisk(opp: any, quotes: any[], activities: any[]) {
  const status = (opp?.status || "OPEN").toUpperCase();
  if (status === "WON") {
    return {
      level: "LOW",
      label: "Deal Won",
      color: "emerald",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      reason: "Opportunity closed and won. Commercial terms finalized."
    };
  }
  if (status === "LOST") {
    return {
      level: "CLOSED",
      label: "Deal Lost",
      color: "rose",
      bgClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      reason: opp.lossReason
        ? `Closed as lost (${opp.lossReason}). ${opp.lossNotes ? `Note: ${opp.lossNotes}` : ""}`
        : "Deal marked as lost."
    };
  }

  // 1. Revision requested on quote
  const revisionQuote = quotes.find(
    (q: any) =>
      q.status === "Revision Requested" ||
      (q.deliveries || []).some(
        (d: any) =>
          (d.notes || "").toLowerCase().includes("revision") ||
          (d.notes || "").toLowerCase().includes("change")
      )
  );
  if (revisionQuote) {
    return {
      level: "HIGH",
      label: "Revision Requested",
      color: "rose",
      bgClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      reason: `Client requested commercial revisions on Quote #${revisionQuote.quoteNumber || revisionQuote.id.slice(0, 8)}. Revise quotation to prevent stall.`
    };
  }

  // 2. Pending manager approval
  const pendingApprovalQuote = quotes.find(
    (q: any) => q.status === "Pending Approval" || q.status === "Pending"
  );
  if (pendingApprovalQuote) {
    return {
      level: "MEDIUM",
      label: "Approval Bottleneck",
      color: "amber",
      bgClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      reason: `Quote #${pendingApprovalQuote.quoteNumber || pendingApprovalQuote.id.slice(0, 8)} is waiting for manager approval.`
    };
  }

  // 3. Days since last activity
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const lastActivityTime = sortedActivities[0]?.createdAt || opp?.createdAt;
  const daysSinceLastActivity = lastActivityTime
    ? Math.max(0, Math.floor((Date.now() - new Date(lastActivityTime).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (daysSinceLastActivity > 7) {
    return {
      level: "HIGH",
      label: "Cadence Risk",
      color: "rose",
      bgClass: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      reason: `No interactions logged in ${daysSinceLastActivity} days. Re-engagement outreach recommended immediately.`
    };
  }
  if (daysSinceLastActivity > 3) {
    return {
      level: "MEDIUM",
      label: "Moderate Inactivity",
      color: "amber",
      bgClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      reason: `Last touchpoint was ${daysSinceLastActivity} days ago. Follow-up advised to maintain momentum.`
    };
  }

  // 4. Quote sent > 5 days ago without acceptance
  const sentQuote = quotes.find((q: any) => q.status === "Sent" || q.status === "Viewed");
  if (sentQuote) {
    const sentTime = sentQuote.updatedAt || sentQuote.createdAt;
    const daysSinceSent = Math.floor((Date.now() - new Date(sentTime).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceSent >= 5) {
      return {
        level: "MEDIUM",
        label: "Quote Stalled",
        color: "amber",
        bgClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        reason: `Quote #${sentQuote.quoteNumber || sentQuote.id.slice(0, 8)} sent ${daysSinceSent} days ago with no final decision yet.`
      };
    }
  }

  return {
    level: "LOW",
    label: "Healthy Pipeline Cadence",
    color: "emerald",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    reason: `Touchpoints actively recorded. Recent contact within ${daysSinceLastActivity === 0 ? "today" : `${daysSinceLastActivity} day(s)`}.`
  };
}

// ── Dynamic Rule-Derived Recommended Action ─────────────────────────────────────
function computeRecommendedAction(opp: any, quotes: any[]) {
  const status = (opp?.status || "OPEN").toUpperCase();
  if (status === "WON") {
    return "Initiate post-sale fulfillment, generate purchase order, and schedule delivery handoff.";
  }
  if (status === "LOST") {
    return "Archive opportunity notes and schedule automated re-contact in 90 days.";
  }

  const acceptedQuote = quotes.find((q: any) => q.status === "Accepted");
  if (acceptedQuote) {
    return `Customer accepted Quote #${acceptedQuote.quoteNumber || acceptedQuote.id.slice(0, 8)}. Submit for executive approval or confirm PO to close deal.`;
  }

  const revisionQuote = quotes.find((q: any) => q.status === "Revision Requested");
  if (revisionQuote) {
    return `Review client feedback on Quote #${revisionQuote.quoteNumber || revisionQuote.id.slice(0, 8)} and create revised quotation version.`;
  }

  const viewedQuote = quotes.find((q: any) => q.status === "Viewed");
  if (viewedQuote) {
    return `Client viewed Quote #${viewedQuote.quoteNumber || viewedQuote.id.slice(0, 8)}. Call or message client now to address commercial questions.`;
  }

  if (quotes.length === 0) {
    return `Configure line items and generate an initial commercial proposal based on customer scope.`;
  }

  return `Follow up on open quotation and confirm schedule/procurement timing with ${opp.primaryContact?.firstName || opp.lead?.firstName || "client"}.`;
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"timeline" | "quotes" | "splits" | "history" | "handoff_chat">("timeline");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "note" | "communication" | "quote">("all");
  const [noteText, setNoteText] = useState("");
  const [viewQuoteId, setViewQuoteId] = useState<string | null>(null);
  const [rejectModalQuoteId, setRejectModalQuoteId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("Price too high / Commercial terms");
  const [sendQuoteId, setSendQuoteId] = useState<string | null>(null);

  // Modals for actions
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossReason, setLossReason] = useState<string>("PRICE");
  const [lossNotes, setLossNotes] = useState<string>("");

  const [showWonModal, setShowWonModal] = useState(false);
  const [wonReason, setWonReason] = useState<string>("QUOTE_ACCEPTED");

  // Reassign Modal & Auto-Assign Banner States
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [autoAssignBanner, setAutoAssignBanner] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

  // Fetch Opportunity Detail
  const { data: opp, isLoading, error } = useQuery({
    queryKey: ["opportunity-detail", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/opportunities/${id}`);
      return res;
    },
    enabled: !!id
  });

  // Fetch Pipeline Stages for Stepper
  const { data: pipelineStages = [] } = usePipelineStages();

  // Fetch Quotes belonging to this Opportunity
  const { data: quotesData } = useQuery({
    queryKey: ["opportunity-quotes", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/opportunities/${id}/quotes`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });
  const quotes: any[] = Array.isArray(quotesData) ? quotesData : [];

  // Fetch Opportunity Timeline Activities
  const { data: timelineData } = useQuery({
    queryKey: ["opportunity-timeline", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/opportunities/${id}/timeline`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });
  const activities: any[] = Array.isArray(timelineData) ? timelineData : [];

  // Fetch Approvals related to this Opportunity / Quotes
  const { data: approvalsData } = useQuery({
    queryKey: ["opportunity-approvals", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/approvals`);
      const all = Array.isArray(res) ? res : res?.data || [];
      return all.filter((a: any) =>
        quotes.some((q: any) => q.id === a.targetId) || a.dealId === id
      );
    },
    enabled: !!id
  });
  const approvals: any[] = Array.isArray(approvalsData) ? approvalsData : [];

  // Move Stage Mutation
  const moveStageMutation = useMutation({
    mutationFn: async (targetStageId: string) => {
      return await apiClient.post(`/api/v1/opportunities/${id}/stage`, { stageId: targetStageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    },
    onError: (err: any) => {
      alert("Failed to advance stage: " + (err?.response?.data?.error || err.message));
    }
  });

  // Submit Accepted Quote for Approval Mutation
  const submitApprovalMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiClient.post(`/api/v1/quotes/${quoteId}/submit-approval`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-approvals", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
      alert(data?.message || "Quote successfully submitted for manager approval!");
    },
    onError: (err: any) => {
      alert("Failed to submit for approval: " + (err?.message || "Error submitting quote"));
    }
  });

  // Accept Quote Mutation
  const acceptQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiClient.post(`/api/v1/quotes/${quoteId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-approvals", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
    }
  });

  // Reject Quote Mutation
  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, rejectionReason }: { quoteId: string; rejectionReason: string }) => {
      return await apiClient.post(`/api/v1/quotes/${quoteId}/reject`, { rejectionReason });
    },
    onSuccess: () => {
      setRejectModalQuoteId(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || err.message || "Failed to mark quote as rejected.");
    }
  });

  // Mark Won Mutation
  const markWonMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      return apiClient.post(`/api/v1/opportunities/${id}/mark-won`, { reason });
    },
    onSuccess: () => {
      setShowWonModal(false);
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  // Mark Lost Mutation
  const markLostMutation = useMutation({
    mutationFn: async ({ lossReason, lossNotes }: { lossReason: string; lossNotes: string }) => {
      return apiClient.post(`/api/v1/opportunities/${id}/mark-lost`, { lossReason, lossNotes });
    },
    onSuccess: () => {
      setShowLossModal(false);
      setLossNotes("");
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiClient.post(`/api/v1/activities`, {
        opportunityId: id,
        customerId: opp?.accountId || opp?.customerId,
        type: "note",
        outcome: text,
        pinned: false,
        isCompleted: true
      });
    },
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", id] });
    }
  });

  // Auto-Assign Mutation
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/deals/${id}/auto-assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Auto-assignment failed" }));
        throw new Error(err.error || "Auto-assignment failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["deal-reassignment-history", id] });
      queryClient.invalidateQueries({ queryKey: ["dealAssignmentCutoffs"] });

      if (data.assigned) {
        setAutoAssignBanner({
          type: "success",
          message: `Deal assigned to ${data.assignee?.name || "Closer"}.`
        });
      } else {
        setAutoAssignBanner({
          type: "info",
          message: data.reason || "No eligible sales rep available under current capacity."
        });
      }
    },
    onError: (err: any) => {
      setAutoAssignBanner({
        type: "error",
        message: err.message || "Failed to auto-assign."
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-5xl mx-auto space-y-3">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-500 font-semibold">Loading opportunity workspace...</p>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Opportunity Not Found</h2>
        <p className="text-xs text-slate-500">This record may have been deleted, moved, or access is restricted.</p>
        <button
          onClick={() => navigate("/opportunities")}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Back to Opportunities
        </button>
      </div>
    );
  }

  const status = (opp.status || "OPEN").toUpperCase();
  const phaseInfo = deriveOpportunityPhase(opp, quotes);
  const dealRisk = computeDealRisk(opp, quotes, activities);
  const recommendedAction = computeRecommendedAction(opp, quotes);

  // Filtered timeline activities
  const filteredActivities = activities.filter((act) => {
    if (timelineFilter === "all") return true;
    if (timelineFilter === "note") return act.type === "note" || !act.type;
    if (timelineFilter === "communication") return ["call", "email", "whatsapp", "meeting"].includes(act.type);
    if (timelineFilter === "quote") return act.type?.includes("quote");
    return true;
  });

  // Active stage determination
  const currentStageIndex = pipelineStages.findIndex((s) => s.id === opp.stageId || s.name === opp.stage?.name);

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
      {/* ── 1. TOP BREADCRUMB & ACTION TOOLBAR (Stitch Header Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link
            to="/opportunities"
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <span>Opportunities</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
            {opp.name}
          </span>
        </div>

        {!opp?.isViewOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsReassignModalOpen(true)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Reassign</span>
            </button>

            <button
              onClick={() => autoAssignMutation.mutate()}
              disabled={autoAssignMutation.isPending}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Auto-Assign Rep"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${autoAssignMutation.isPending ? "animate-spin" : ""}`} />
              <span>Auto-Assign</span>
            </button>

            {status === "OPEN" && (
              <>
                <button
                  onClick={() => setShowWonModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Won</span>
                </button>
                <button
                  onClick={() => setShowLossModal(true)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Mark Lost</span>
                </button>
              </>
            )}

            <button
              onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quote</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 2. SPECIAL STATE NOTIFICATIONS / BANNERS ── */}
      {/* Handed Off View-Only Banner */}
      {opp?.isViewOnly && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-200/70 dark:bg-amber-900/60 rounded-xl text-amber-800 dark:text-amber-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-amber-950 dark:text-amber-100">
                Handed Off — View Only Access
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 font-medium mt-0.5">
                This opportunity has been reassigned to another representative. You retain permanent read-only access to historical timeline, activities, and quotes.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-extrabold text-xs rounded-lg uppercase tracking-wider shrink-0 border border-amber-300 dark:border-amber-700">
            Read Only
          </span>
        </div>
      )}

      {/* Auto-Assignment Notification */}
      {autoAssignBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-2xs ${
            autoAssignBanner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : autoAssignBanner.type === "info"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="font-medium">{autoAssignBanner.message}</span>
          </div>
          <button onClick={() => setAutoAssignBanner(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quote Accepted -> Send for Approval Banner */}
      {(() => {
        const acceptedQuote = quotes.find((q: any) => q.status === "Accepted");
        const acceptedQuoteApproval = acceptedQuote ? approvals.find((a: any) => a.targetId === acceptedQuote.id) : null;

        if (acceptedQuote && !acceptedQuoteApproval) {
          return (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    Customer Accepted Quote #{acceptedQuote.quoteNumber || acceptedQuote.id.slice(0, 8)} ({formatCurrency(acceptedQuote.totalAmount || 0)})
                  </div>
                  <div className="text-amber-700 dark:text-amber-300/80 mt-0.5">
                    Proposal accepted by client. Submit for management approval before generating purchase order and closing deal.
                  </div>
                </div>
              </div>
              <button
                onClick={() => submitApprovalMutation.mutate(acceptedQuote.id)}
                disabled={submitApprovalMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-2xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{submitApprovalMutation.isPending ? "Submitting..." : "Send for Approval"}</span>
              </button>
            </div>
          );
        }

        if (acceptedQuote && acceptedQuoteApproval) {
          return (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-semibold text-blue-900 dark:text-blue-200">
                  Approval for Quote #{acceptedQuote.quoteNumber || acceptedQuote.id.slice(0, 8)}:
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  acceptedQuoteApproval.status === "Approved"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : acceptedQuoteApproval.status === "Rejected"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}>
                  {acceptedQuoteApproval.status === "Pending" ? "Pending Manager Approval" : `Approval: ${acceptedQuoteApproval.status}`}
                </span>
              </div>
              {acceptedQuoteApproval.comments && (
                <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-md">
                  {acceptedQuoteApproval.comments}
                </span>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* ── 3. HERO OVERVIEW & INTERACTIVE STAGE STEPPER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
        {/* Deal Header Info & Financials */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {opp.name}
              </h1>

              {/* Status Badge */}
              {status === "WON" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Closed Won
                </span>
              ) : status === "LOST" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" /> Closed Lost
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Clock className="w-3.5 h-3.5 text-blue-600" /> Open Opportunity
                </span>
              )}

              {/* Phase Badge */}
              {status === "OPEN" && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${phaseInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${phaseInfo.dotClass} animate-pulse`} />
                  {phaseInfo.label}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {opp.account?.name || opp.lead?.company || "Direct Account"}
              </span>
              <span>•</span>
              <span>
                Owner: <strong className="text-slate-800 dark:text-slate-200">{opp.owner?.name || "Assigned Rep"}</strong>
              </span>
              <span>•</span>
              <span>
                Expected Close:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {opp.expectedCloseDate
                    ? new Date(opp.expectedCloseDate).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })
                    : "Unscheduled"}
                </strong>
              </span>
            </div>
          </div>

          {/* Right Metrics Hero (Deal Value & Win Probability) */}
          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 shrink-0">
            <div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Deal Value
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(opp.amount || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Win Probability
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                {opp.probability !== null && opp.probability !== undefined
                  ? `${opp.probability}%`
                  : status === "WON"
                  ? "100%"
                  : status === "LOST"
                  ? "0%"
                  : "60%"}
              </div>
            </div>
          </div>
        </div>

        {/* Stage Stepper Progress Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Pipeline Progression</span>
            <span>
              Stage {currentStageIndex >= 0 ? currentStageIndex + 1 : 1} of {pipelineStages.length || 7}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {pipelineStages.map((stage: any, index: number) => {
              const isCurrent = stage.id === opp.stageId || stage.name === opp.stage?.name;
              const isPast = currentStageIndex > -1 && index < currentStageIndex;
              const isFuture = currentStageIndex > -1 && index > currentStageIndex;

              return (
                <button
                  key={stage.id || stage.name}
                  onClick={() => {
                    if (status === "OPEN" && !isCurrent) {
                      moveStageMutation.mutate(stage.id);
                    }
                  }}
                  disabled={status !== "OPEN" || isCurrent || moveStageMutation.isPending}
                  className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isCurrent
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                      : isPast
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 cursor-pointer"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 cursor-pointer"
                  } ${status !== "OPEN" ? "cursor-default" : ""}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-extrabold uppercase opacity-80">
                      Step {index + 1}
                    </span>
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div className="font-bold text-xs truncate w-full" title={stage.name}>
                    {stage.name}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isCurrent ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}`}>
                    {stage.probability}% win target
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. AI CUSTOMER SCOPE & REQUIREMENTS INSIGHT CARD ── */}
      <AiRequirementSummaryCard
        type="opportunity"
        id={id!}
        onActionClick={() => {
          navigate(`/quotes/new?dealId=${opp.id}`);
        }}
      />

      {/* ── 5. MAIN 2-COLUMN BENTO WORKSPACE (Stitch Layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── LEFT / SIDEBAR COLUMN (4 Cols): AI Copilot, Customer Details, Company Intelligence ── */}
        <div className="lg:col-span-4 space-y-5">
          {/* AI Sales Copilot Card */}
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs space-y-3.5 relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" /> AI Sales Copilot & Insights
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                Real-time
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Win Probability metric */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Deal Win Probability:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {opp.probability !== null && opp.probability !== undefined
                    ? `${opp.probability}%`
                    : status === "WON"
                    ? "100%"
                    : status === "LOST"
                    ? "0%"
                    : "60%"}
                </span>
              </div>

              {/* Recommended Action */}
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px] uppercase tracking-wider">
                  Recommended Action:
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 leading-relaxed">
                  {recommendedAction}
                </p>
              </div>

              {/* Dynamic Rule-Derived Risk Indicator */}
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1 text-[11px] uppercase tracking-wider">
                  Risk Indicator ({dealRisk.label}):
                </span>
                <div className={`p-3 rounded-xl border text-[11px] font-medium leading-relaxed ${dealRisk.bgClass}`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {dealRisk.level === "HIGH" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    ) : dealRisk.level === "MEDIUM" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>{dealRisk.label}</span>
                  </div>
                  <p>{dealRisk.reason}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Customer Details
              </h3>
              {opp.account?.id && (
                <Link
                  to={`/accounts/${opp.account.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-xs inline-flex items-center gap-1"
                >
                  <span>View 360</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {opp.account?.name || opp.lead?.company || "Direct Account"}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Contact</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {opp.primaryContact?.firstName
                    ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName || ""}`
                    : opp.lead?.firstName
                    ? `${opp.lead.firstName} ${opp.lead.lastName || ""}`
                    : "Unassigned Contact"}
                </span>
                {(opp.primaryContact?.email || opp.lead?.email) && (
                  <div className="text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{opp.primaryContact?.email || opp.lead?.email}</span>
                  </div>
                )}
                {(opp.primaryContact?.phone || opp.lead?.phone) && (
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{opp.primaryContact?.phone || opp.lead?.phone}</span>
                  </div>
                )}
              </div>

              {/* Assigned Representative */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Assigned Closer
                </span>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {opp.owner?.name ? opp.owner.name.substring(0, 2).toUpperCase() : "REP"}
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {opp.owner?.name || "Assigned Rep"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                      {opp.owner?.role || "Account Executive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Intelligence Card (Option A: Genuine Account Metadata Only) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Company Intelligence
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                Account Data
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Industry</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {opp.account?.industry || opp.lead?.industry || "Commercial"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Account Type</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {opp.account?.customerType || (opp.account ? "Existing Account" : "Prospect")}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">HQ / Territory</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {[opp.account?.city, opp.account?.country].filter(Boolean).join(", ") || opp.account?.territory || "Domestic"}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Website</span>
                {opp.account?.website ? (
                  <a
                    href={opp.account.website.startsWith("http") ? opp.account.website : `https://${opp.account.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-blue-600 hover:underline truncate block flex items-center gap-1"
                  >
                    <span className="truncate">{opp.account.website.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : (
                  <span className="font-medium text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Marketing Source / Attribution */}
          {(opp.sourceChannel || opp.sourceType) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2 text-xs">
              <span className="font-black text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider block">
                Lead Ingestion Attribution
              </span>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Marketing Channel:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{opp.sourceChannel || "Inbound"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Campaign / Source:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{opp.sourceType || "Organic"}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT / MAIN WORKSPACE COLUMN (8 Cols): Inbound Inquiry, Playbook, Tabbed Feed ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Submitted Inbound Inquiry & Requirements (If lead body/subject exists) */}
          {(opp.lead?.body || opp.lead?.subject) && (
            <div className="bg-white dark:bg-slate-900 border border-blue-200/90 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Submitted Inbound Inquiry & Requirements</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">
                  {opp.sourceChannel || "Inbound Lead"}
                </span>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/80 whitespace-pre-line">
                {opp.lead?.body || opp.lead?.subject}
              </p>
            </div>
          )}

          {/* Next Best Step & Sales Playbook Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Next Best Step & Sales Playbook
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                Active Playbook
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Primary Recommended Action
                </span>
                <p className="text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                  {recommendedAction}
                </p>
              </div>

              <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1">
                <span className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> Proposal Readiness
                </span>
                <p className="text-indigo-950 dark:text-indigo-100 font-medium leading-relaxed">
                  {quotes.length > 0
                    ? `${quotes.length} proposal version${quotes.length === 1 ? "" : "s"} on file. Most recent: Quote #${quotes[0].quoteNumber || quotes[0].id.slice(0, 8)} (${quotes[0].status}).`
                    : "No quotation generated yet. Click 'New Quote' to configure line items from catalog."}
                </p>
              </div>
            </div>
          </div>

          {/* ── Segmented Horizontal Tabs ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 px-3 pt-1 rounded-t-2xl border-t border-x border-slate-200/90 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("timeline")}
                className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "timeline"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Activity &amp; Notes ({activities.length})
              </button>
              <button
                onClick={() => setActiveTab("quotes")}
                className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "quotes"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Quotations ({quotes.length})
              </button>
              <button
                onClick={() => setActiveTab("splits")}
                className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "splits"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Commission Splits
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "history"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Audit History
              </button>
              <button
                onClick={() => setActiveTab("handoff_chat")}
                className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "handoff_chat"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Handoff Chat (Internal)
              </button>
            </div>

            {/* TAB 1: TIMELINE & NOTE COMPOSER */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                {/* Note Composer */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Log a commercial note, client requirement update, or meeting outcome..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] text-slate-400">
                      Notes are recorded in real-time onto the deal history.
                    </span>
                    <button
                      onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{addNoteMutation.isPending ? "Posting..." : "Post Note"}</span>
                    </button>
                  </div>
                </div>

                {/* Timeline Filters & Feed */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Activity Timeline
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setTimelineFilter("all")}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                          timelineFilter === "all"
                            ? "bg-slate-900 text-white dark:bg-blue-600"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        All Activity
                      </button>
                      <button
                        onClick={() => setTimelineFilter("note")}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                          timelineFilter === "note"
                            ? "bg-slate-900 text-white dark:bg-blue-600"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        Notes
                      </button>
                      <button
                        onClick={() => setTimelineFilter("communication")}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                          timelineFilter === "communication"
                            ? "bg-slate-900 text-white dark:bg-blue-600"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        Communications
                      </button>
                    </div>
                  </div>

                  {filteredActivities.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                      No activity records match the selected filter.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                      {filteredActivities.map((act) => (
                        <div key={act.id} className="relative group">
                          {/* Dot / Icon */}
                          <div className="absolute -left-[23px] top-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-blue-600 dark:text-blue-400 z-10 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                          </div>

                          <div className="bg-slate-50/70 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                {act.type || "Note"}
                              </span>
                              <span className="text-slate-400">
                                {new Date(act.createdAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {act.outcome || act.notes || "Activity recorded."}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: QUOTATIONS */}
            {activeTab === "quotes" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {quotes.length} quotation revision{quotes.length === 1 ? "" : "s"} on file
                  </span>
                  <button
                    onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Quote</span>
                  </button>
                </div>

                {quotes.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs text-slate-400 bg-white dark:bg-slate-900">
                    <p className="font-bold text-slate-600 dark:text-slate-300">No quotes generated yet.</p>
                    <button
                      onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                      Create initial quotation
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                    {quotes.map((q) => {
                      const isAccepted = q.status === "Accepted";
                      const isSuperseded = q.status === "Superseded";
                      const isRejected = q.status === "Rejected" || q.status === "Declined";
                      const quoteApproval = approvals.find((a: any) => a.targetId === q.id);

                      return (
                        <div key={q.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {q.quoteNumber || `QT-${q.id.slice(0, 6)}`}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                v{q.version || 1}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                                  isAccepted
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                    : isRejected
                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                                    : isSuperseded
                                    ? "bg-slate-50 text-slate-400 border-slate-200 line-through"
                                    : q.status === "Pending Approval" || q.status === "Pending"
                                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {isRejected
                                  ? "REJECTED"
                                  : q.status === "Pending Approval" || q.status === "Pending"
                                  ? "WAITING FOR APPROVAL"
                                  : q.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Created {new Date(q.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
                            <div className="text-right font-black text-slate-900 dark:text-white text-sm">
                              {formatCurrency(q.totalAmount || 0)}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {/* 1. If Waiting for Approval */}
                              {q.status === "Pending Approval" || q.status === "Pending" || quoteApproval?.status === "Pending" ? (
                                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                                  <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                                  <span>Waiting for Approval</span>
                                </span>
                              ) : (
                                <>
                                  {/* 2. Accept Final */}
                                  {!isAccepted && !isRejected && !isSuperseded && (
                                    <button
                                      onClick={() => acceptQuoteMutation.mutate(q.id)}
                                      disabled={acceptQuoteMutation.isPending}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                                    >
                                      Accept Final
                                    </button>
                                  )}

                                  {/* 3. Send for Approval */}
                                  {isAccepted && !quoteApproval && (
                                    <button
                                      onClick={() => submitApprovalMutation.mutate(q.id)}
                                      disabled={submitApprovalMutation.isPending}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                                    >
                                      <Shield className="w-3 h-3" />
                                      <span>{submitApprovalMutation.isPending ? "Submitting..." : "Send for Approval"}</span>
                                    </button>
                                  )}

                                  {/* 4. Approved Badge */}
                                  {quoteApproval?.status === "Approved" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Approved</span>
                                    </span>
                                  )}
                                </>
                              )}

                              {/* Rejection */}
                              {!isRejected && (
                                <button
                                  onClick={() => setRejectModalQuoteId(q.id)}
                                  className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-rose-50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                                  title="Mark Quote as Declined by Customer"
                                >
                                  Mark Rejected
                                </button>
                              )}

                              {/* Revise */}
                              {isRejected && (
                                <button
                                  onClick={() =>
                                    navigate(`/quotes/new?parentQuoteId=${q.id}${opp.id ? `&dealId=${opp.id}` : ""}`)
                                  }
                                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Revise Quote</span>
                                </button>
                              )}

                              <button
                                onClick={() => setViewQuoteId(q.id)}
                                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                              >
                                View
                              </button>

                              {!isSuperseded && !isRejected && (
                                <button
                                  onClick={() => setSendQuoteId(q.id)}
                                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{q.status === "Sent" ? "Re-send" : "Send"}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Rejection reason box */}
                          {isRejected && (
                            <div className="w-full mt-2 p-2.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <div className="font-bold text-rose-950 dark:text-rose-100">
                                  Rejected by {q.rejectedByUser?.name || "Client"}
                                </div>
                                <div className="font-medium text-rose-800 dark:text-rose-300 italic">
                                  "{q.rejectionReason || "No reason specified"}"
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: COMMISSION SPLITS */}
            {activeTab === "splits" && (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                <DealSplitsSection
                  dealId={opp.id}
                  dealAmount={Number(opp.amount || 0)}
                  ownerId={opp.ownerId}
                  ownerName={opp.owner?.name}
                />
              </div>
            )}

            {/* TAB 4: AUDIT HISTORY */}
            {activeTab === "history" && (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                <DealReassignmentHistorySection dealId={opp.id} />
              </div>
            )}

            {/* TAB 5: HANDOFF CHAT (INTERNAL) */}
            {activeTab === "handoff_chat" && (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                <HandoffChatWidget
                  dealId={opp.id}
                  leadId={opp.leadId}
                  recordTitle={opp.name}
                  dealAmount={Number(opp.amount || 0)}
                  participantsData={opp.handoffParticipants}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 6. MODALS PRESERVED ── */}
      {/* Mark Won Modal */}
      {showWonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mark as Won
              </h3>
              <button onClick={() => setShowWonModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirm closing <strong className="text-slate-900 dark:text-white">{opp.name}</strong> as Won.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Won Reason</label>
              <select
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="QUOTE_ACCEPTED">Final Quote Accepted</option>
                <option value="PURCHASE_ORDER">Purchase Order Received</option>
                <option value="CONTRACT_SIGNED">Contract Signed</option>
                <option value="MANUAL_CONFIRMATION">Manager Authorization</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowWonModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => markWonMutation.mutate({ reason: wonReason })}
                disabled={markWonMutation.isPending}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {markWonMutation.isPending ? "Confirming..." : "Confirm Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Lost Modal */}
      {showLossModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Mark as Lost
              </h3>
              <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Specify the loss reason for <strong className="text-slate-900 dark:text-white">{opp.name}</strong>.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loss Reason *</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="PRICE">Price / Commercial Terms</option>
                  <option value="COMPETITOR">Lost to Competitor</option>
                  <option value="NO_BUDGET">No Budget / Project Cancelled</option>
                  <option value="TIMING">Delayed / Bad Timing</option>
                  <option value="NO_RESPONSE">Customer Unresponsive</option>
                  <option value="SCOPE_CHANGE">Scope Incompatibility</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="Optional context..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowLossModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => markLostMutation.mutate({ lossReason, lossNotes })}
                disabled={markLostMutation.isPending}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {markLostMutation.isPending ? "Updating..." : "Confirm Lost"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reassign Modal */}
      <DealReassignModal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        dealId={opp.id}
        dealName={opp.name}
        dealAmount={Number(opp.amount || 0)}
        currentOwnerName={opp.owner?.name}
        currentOwnerId={opp.ownerId}
      />

      {/* Bill Preview Modal Popup */}
      {viewQuoteId && (
        <QuoteBillModal
          quoteId={viewQuoteId}
          onClose={() => setViewQuoteId(null)}
        />
      )}

      {/* Manual Quote Rejection Prompt Modal */}
      {rejectModalQuoteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Mark Quote as Rejected
              </h3>
              <button
                onClick={() => {
                  setRejectModalQuoteId(null);
                  setRejectReason("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Why did the customer reject this quote? <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. price too high, needed faster delivery, competitor discount."
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              {!rejectReason.trim() && (
                <p className="text-[11px] text-rose-500 font-medium">Rejection reason is required before submitting.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setRejectModalQuoteId(null);
                  setRejectReason("");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectQuoteMutation.mutate({
                    quoteId: rejectModalQuoteId,
                    rejectionReason: rejectReason
                  })
                }
                disabled={!rejectReason.trim() || rejectQuoteMutation.isPending}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              >
                {rejectQuoteMutation.isPending ? "Submitting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Quote Channel Modal */}
      {sendQuoteId && (
        <SendQuoteChannelModal
          quoteId={sendQuoteId}
          isOpen={!!sendQuoteId}
          onClose={() => setSendQuoteId(null)}
        />
      )}
    </div>
  );
}
