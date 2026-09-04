import { useState } from "react";
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
  ShieldCheck
} from "lucide-react";

import { useMarkQuoteFinal } from "../hooks/useMarkQuoteFinal";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import { DealReassignModal } from "../components/DealReassignModal";
import { DealReassignmentHistorySection } from "../components/DealReassignmentHistorySection";
import { DealSplitsSection } from "../components/DealSplitsSection";
import { HandoffChatWidget } from "../components/HandoffChatWidget";
import { deriveOpportunityPhase } from "../utils/opportunityPhases";
import { QuoteBillModal } from "../components/QuoteBillModal";
import { SendQuoteChannelModal } from "../components/SendQuoteChannelModal";
import { AiRequirementSummaryCard } from "../components/AiRequirementSummaryCard";

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"timeline" | "quotes" | "splits" | "history" | "handoff_chat">("timeline");
  const [noteText, setNoteText] = useState("");
  const [viewQuoteId, setViewQuoteId] = useState<string | null>(null);
  const [rejectModalQuoteId, setRejectModalQuoteId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("Price too high / Commercial terms");
  const [rejectNotes, setRejectNotes] = useState("");
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

  // Submit Accepted Quote for Approval Mutation (from Opportunity Page)
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

  const {
    markFinal,
    isPending: isMarkingFinal,
    approvalFeedback,
    setApprovalFeedback,
    statusMessage
  } = useMarkQuoteFinal();

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
    },
    onError: (err: any) => {
      alert("Failed to accept quote: " + (err?.response?.data?.error || err?.message || "Unknown error"));
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
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-5xl mx-auto space-y-2">
        <div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400 font-medium">Loading opportunity...</p>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-3">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Opportunity Not Found</h2>
        <p className="text-xs text-slate-500">This record may have been deleted or moved.</p>
        <button
          onClick={() => navigate("/opportunities")}
          className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Back to Opportunities
        </button>
      </div>
    );
  }

  const status = (opp.status || "OPEN").toUpperCase();
  const phaseInfo = deriveOpportunityPhase(opp, quotes);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ── TOP BREADCRUMB & ACTION TOOLBAR ── */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Opportunities</span>
        </Link>

        {!opp?.isViewOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReassignModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Reassign</span>
            </button>

            <button
              onClick={() => autoAssignMutation.mutate()}
              disabled={autoAssignMutation.isPending}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Auto-Assign Rep"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${autoAssignMutation.isPending ? "animate-spin" : ""}`} />
              <span>Auto-Assign</span>
            </button>

            {status === "OPEN" && (
              <>
                <button
                  onClick={() => setShowWonModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Won</span>
                </button>
                <button
                  onClick={() => setShowLossModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Mark Lost</span>
                </button>
              </>
            )}

            <button
              onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quote</span>
            </button>
          </div>
        )}
      </div>

      {/* Handed Off View-Only Banner */}
      {opp?.isViewOnly && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-200/70 rounded-xl">
              <Lock className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-amber-950">Handed Off — View Only Access</h4>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                This opportunity has been reassigned to another representative. You retain permanent read-only access to historical timeline, activities, and quotes. Write operations are restricted.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-200 text-amber-900 font-extrabold text-xs rounded-lg uppercase tracking-wider shrink-0 border border-amber-300">
            Read Only
          </span>
        </div>
      )}

      {/* Auto-Assignment Notification */}
      {autoAssignBanner && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            autoAssignBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : autoAssignBanner.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <span>{autoAssignBanner.message}</span>
          <button onClick={() => setAutoAssignBanner(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── STAGE + NEXT ACTION HERO BANNER (REUSING LEADDETAIL STYLING) ─────────── */}
      {(() => {
        const sortedQuotes = [...quotes].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        const latestQuote = sortedQuotes[0];
        const latestDeliveries = latestQuote?.deliveries
          ? [...latestQuote.deliveries].sort(
              (a: any, b: any) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
            )
          : [];
        const latestDelivery = latestDeliveries[0];

        const isViewed = latestQuote?.status === "Viewed" || latestDelivery?.status === "VIEWED";
        const isRevisionReq =
          latestQuote?.status === "Revision Requested" ||
          (latestDelivery?.notes || "").toLowerCase().includes("revision") ||
          (latestDelivery?.notes || "").toLowerCase().includes("changes");

        let bannerHeading = "";
        let bannerSubtext = "";
        let bannerIcon = <Sparkles className="w-4 h-4 text-indigo-400" />;
        let bannerBadge = "Action Recommended";
        let bannerActionBtn = null;

        if (isRevisionReq && latestQuote) {
          bannerHeading = `Customer Requested Changes on Quote #${latestQuote.quoteNumber || latestQuote.id.slice(0, 8)}`;
          bannerSubtext = `Customer reviewed the quotation and requested revisions (${latestDelivery?.notes || "Customer requested adjustments via portal"}). Prepare a revised quotation.`;
          bannerBadge = "Revision Requested";
          bannerIcon = <AlertCircle className="w-4 h-4 text-amber-400" />;
          bannerActionBtn = (
            <button
              onClick={() => {
                setViewQuoteId(latestQuote.id);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Review & Create Revision</span>
            </button>
          );
        } else if (isViewed && latestQuote && latestQuote.status !== "Accepted") {
          const viewedTimeStr = latestQuote.viewedAt || latestDelivery?.occurredAt;
          const timeAgo = viewedTimeStr
            ? new Date(viewedTimeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "recently";
          bannerHeading = `Customer Viewed Quote #${latestQuote.quoteNumber || latestQuote.id.slice(0, 8)} (${timeAgo})`;
          bannerSubtext = "The client opened and reviewed your proposal online. This is an optimal window for follow-up to answer questions and close the deal.";
          bannerBadge = "Customer Engaged";
          bannerIcon = <Sparkles className="w-4 h-4 text-emerald-400" />;
          bannerActionBtn = (
            <button
              onClick={() => {
                setActiveTab("timeline");
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Log Follow-Up Activity</span>
            </button>
          );
        }

        if (!bannerHeading) return null;

        return (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  {bannerIcon}
                  {bannerBadge}
                </span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-[11px] font-medium text-slate-300">
                  Opportunity: {opp?.name}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {bannerHeading}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{bannerSubtext}</p>
            </div>
            {bannerActionBtn && <div className="shrink-0 flex items-center gap-2">{bannerActionBtn}</div>}
          </div>
        );
      })()}

      {/* Quote Accepted -> Send for Approval Banner */}
      {(() => {
        const acceptedQuote = quotes.find((q: any) => q.status === "Accepted");
        const acceptedQuoteApproval = acceptedQuote ? approvals.find((a: any) => a.targetId === acceptedQuote.id) : null;

        if (acceptedQuote && !acceptedQuoteApproval) {
          return (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-900">
                    Customer Accepted Quote #{acceptedQuote.quoteNumber || acceptedQuote.id.slice(0, 8)} ({formatCurrency(acceptedQuote.totalAmount || 0)})
                  </div>
                  <div className="text-amber-700 mt-0.5">
                    Quote accepted by customer. Submit for Management / Admin Approval before generating purchase order and closing deal.
                  </div>
                </div>
              </div>
              <button
                onClick={() => submitApprovalMutation.mutate(acceptedQuote.id)}
                disabled={submitApprovalMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors shadow-2xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{submitApprovalMutation.isPending ? "Submitting..." : "Send for Approval"}</span>
              </button>
            </div>
          );
        }

        if (acceptedQuote && acceptedQuoteApproval) {
          return (
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-semibold text-blue-900">
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
                <span className="text-slate-500 text-[11px] truncate max-w-md">
                  {acceptedQuoteApproval.comments}
                </span>
              )}
            </div>
          );
        }
        return null;
      })()}


      {/* ── DEAL HEADER HERO ── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{opp.name}</h1>

            {/* Lifecycle Badge */}
            {status === "WON" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Won
              </span>
            ) : status === "LOST" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <XCircle className="w-3 h-3" /> Lost
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3 h-3" /> Open
              </span>
            )}

            {/* Cosmetic Phase */}
            {status === "OPEN" && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${phaseInfo.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${phaseInfo.dotClass}`} />
                {phaseInfo.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {opp.account?.name || opp.lead?.company || "Direct Account"}
            </span>
            <span>•</span>
            <span>
              Owner: <strong className="text-slate-800">{opp.owner?.name || "Assigned Rep"}</strong>
            </span>
            <span>•</span>
            <span>
              Close: {opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Unset"}
            </span>
          </div>
        </div>

        {/* Right Financials */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 shrink-0">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Deal Value</div>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(opp.amount || 0)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Win Probability</div>
            <div className="text-xl font-bold text-blue-600">
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

      {/* AI REQUIREMENT SYNTHESIS CARD */}
      <AiRequirementSummaryCard
        type="opportunity"
        id={id!}
        onActionClick={() => {
          navigate(`/quotes/new?dealId=${opp.id}`);
        }}
      />

      {/* ── 2-COLUMN MINIMALIST WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MAIN COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Segmented Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-px text-xs font-semibold">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "timeline"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Activity &amp; Notes ({activities.length})
            </button>
            <button
              onClick={() => setActiveTab("quotes")}
              className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "quotes"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Quotations ({quotes.length})
            </button>
            <button
              onClick={() => setActiveTab("splits")}
              className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "splits"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Commission Splits
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "history"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Audit History
            </button>
            <button
              onClick={() => setActiveTab("handoff_chat")}
              className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "handoff_chat"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Handoff Chat (Internal)
            </button>
          </div>

          {/* TAB 1: TIMELINE & NOTES */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              {/* Note Composer */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <textarea
                  rows={2}
                  placeholder="Log a commercial note, meeting summary, or next action..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Post Note</span>
                  </button>
                </div>
              </div>

              {/* Timeline Feed */}
              {activities.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No activity records logged yet.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                  {activities.map((act) => (
                    <div key={act.id} className="p-3.5 hover:bg-slate-50/60 transition-colors space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 uppercase tracking-wide">
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
                      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                        {act.outcome || act.notes || "Activity recorded."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUOTATIONS */}
          {activeTab === "quotes" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">
                  {quotes.length} quotation revision{quotes.length === 1 ? "" : "s"} on file
                </span>
                <button
                  onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Quote</span>
                </button>
              </div>

              {statusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {approvalFeedback && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{approvalFeedback.title}</span>
                  </div>
                  <p className="text-amber-800 font-medium pl-5.5">{approvalFeedback.message}</p>
                </div>
              )}

              {quotes.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2 text-xs text-slate-400">
                  <p className="font-semibold text-slate-600">No quotes generated yet.</p>
                  <button
                    onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                    className="text-blue-600 hover:underline font-bold"
                  >
                    Create initial quotation
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                  {quotes.map((q) => {
                    const isAccepted = q.status === "Accepted";
                    const isSuperseded = q.status === "Superseded";
                    const isRejected = q.status === "Rejected" || q.status === "Declined";
                    const quoteApproval = approvals.find((a: any) => a.targetId === q.id);

                    return (
                      <div key={q.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{q.quoteNumber || `QT-${q.id.slice(0, 6)}`}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              v{q.version || 1}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                                isAccepted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                                  : isRejected
                                  ? "bg-rose-50 text-rose-700 border-rose-200 font-extrabold"
                                  : isSuperseded
                                  ? "bg-slate-50 text-slate-400 border-slate-200 line-through"
                                  : q.status === "Pending Approval" || q.status === "Pending"
                                  ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {isRejected ? "REJECTED" : q.status === "Pending Approval" || q.status === "Pending" ? "WAITING FOR APPROVAL" : q.status}
                            </span>
                            {q.isFinalAgreed && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center gap-1 shadow-2xs" title="Final Agreed Quote">
                                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                Final Agreed
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Created {new Date(q.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right font-bold text-slate-900 text-sm">
                            {formatCurrency(q.totalAmount || 0)}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {/* Mark as Final action button */}
                            {!q.isFinalAgreed && !isAccepted && !isRejected && !isSuperseded && (
                              <button
                                onClick={() => markFinal(q.id)}
                                disabled={isMarkingFinal}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                title="Mark this quote revision as Final Agreed terms"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-700" />
                                {isMarkingFinal ? "Marking..." : "Mark as Final"}
                              </button>
                            )}
                            {/* 1. If Waiting for Approval */}
                            {q.status === "Pending Approval" || q.status === "Pending" || quoteApproval?.status === "Pending" ? (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                                <span>Waiting for Approval</span>
                              </span>
                            ) : (
                              <>
                                {/* 2. If not accepted/rejected/pending, allow Accept Final */}
                                {!isAccepted && !isRejected && !isSuperseded && (
                                  <button
                                    onClick={() => acceptQuoteMutation.mutate(q.id)}
                                    disabled={acceptQuoteMutation.isPending}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Accept Final
                                  </button>
                                )}

                                {/* 3. If Quote is Accepted: allow sending for Manager Approval */}
                                {isAccepted && !quoteApproval && (
                                  <button
                                    onClick={() => submitApprovalMutation.mutate(q.id)}
                                    disabled={submitApprovalMutation.isPending}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  >
                                    <Shield className="w-3 h-3" />
                                    <span>{submitApprovalMutation.isPending ? "Submitting..." : "Send for Approval"}</span>
                                  </button>
                                )}

                                {/* 4. If Approval Granted */}
                                {quoteApproval?.status === "Approved" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Approved</span>
                                  </span>
                                )}
                              </>
                            )}

                            {/* Allow manual rejection for any quote that is not already rejected */}
                            {!isRejected && (
                              <button
                                onClick={() => setRejectModalQuoteId(q.id)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                                title="Mark Quote as Declined / Rejected by Customer"
                              >
                                Mark Rejected
                              </button>
                            )}

                            {/* If Rejected, offer 1-click Create Revision */}
                            {isRejected && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/quotes/new?parentQuoteId=${q.id}${opp.id ? `&dealId=${opp.id}` : ""}`
                                  )
                                }
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Revise Quote</span>
                              </button>
                            )}

                            <button
                              onClick={() => setViewQuoteId(q.id)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              View Quote
                            </button>

                            {/* Send Quote to Client */}
                            {!isSuperseded && !isRejected && (
                              <button
                                onClick={() => setSendQuoteId(q.id)}
                                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Send className="w-3 h-3" />
                                <span>{q.status === "Sent" ? "Re-send" : "Send Quote"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rejection Reason Display Box */}
                        {isRejected && (
                          <div className="mt-2.5 p-2.5 bg-rose-50/80 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-bold text-rose-950">
                                Rejected by {q.rejectedByUser?.name || "Sales Rep"}{q.rejectedAt ? ` on ${new Date(q.rejectedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : (q.statusChangedAt ? ` on ${new Date(q.statusChangedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : "")}
                              </div>
                              <div className="font-medium text-rose-800 italic">
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
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
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
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <DealReassignmentHistorySection dealId={opp.id} />
            </div>
          )}

          {/* TAB 5: HANDOFF CHAT (INTERNAL) */}
          {activeTab === "handoff_chat" && (
            <HandoffChatWidget
              dealId={opp.id}
              leadId={opp.leadId}
              recordTitle={opp.name}
              dealAmount={Number(opp.amount || 0)}
              participantsData={opp.handoffParticipants}
            />
          )}
        </div>

        {/* SIDEBAR (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Account & Contact Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                Account &amp; Contact
              </span>
              {opp.account?.id && (
                <Link
                  to={`/accounts/${opp.account.id}`}
                  className="text-blue-600 hover:underline font-semibold text-[11px] inline-flex items-center gap-0.5"
                >
                  View 360 <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Company</div>
                <div className="font-bold text-slate-900">{opp.account?.name || opp.lead?.company || "Direct Lead"}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-medium">Industry</div>
                <div className="text-slate-700">{opp.account?.industry || opp.lead?.industry || "General"}</div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] text-slate-400 font-medium">Primary Contact</div>
                <div className="font-semibold text-slate-800">
                  {opp.primaryContact?.firstName
                    ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName || ""}`
                    : opp.lead?.firstName
                    ? `${opp.lead.firstName} ${opp.lead.lastName || ""}`
                    : "Unassigned contact"}
                </div>
                {(opp.primaryContact?.email || opp.lead?.email) && (
                  <div className="text-slate-500 truncate mt-0.5">
                    {opp.primaryContact?.email || opp.lead?.email}
                  </div>
                )}
                {(opp.primaryContact?.phone || opp.lead?.phone) && (
                  <div className="text-slate-500 mt-0.5">
                    {opp.primaryContact?.phone || opp.lead?.phone}
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Marketing Source */}
          {(opp.sourceChannel || opp.sourceType) && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
              <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                Attribution
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500">Channel:</span>
                <span className="font-semibold text-slate-800">{opp.sourceChannel || "Inbound"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span className="font-semibold text-slate-800">{opp.sourceType || "Organic"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS: MARK WON / MARK LOST ── */}
      {showWonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mark as Won
              </h3>
              <button onClick={() => setShowWonModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Confirm closing <strong className="text-slate-900">{opp.name}</strong> as Won.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Won Reason</label>
              <select
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="QUOTE_ACCEPTED">Final Quote Accepted</option>
                <option value="PURCHASE_ORDER">Purchase Order Received</option>
                <option value="CONTRACT_SIGNED">Contract Signed</option>
                <option value="MANUAL_CONFIRMATION">Manager Authorization</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowWonModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => markWonMutation.mutate({ reason: wonReason })}
                disabled={markWonMutation.isPending}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {markWonMutation.isPending ? "Confirming..." : "Confirm Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLossModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Mark as Lost
              </h3>
              <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Specify the loss reason for <strong className="text-slate-900">{opp.name}</strong>.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Loss Reason *</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="Optional context..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowLossModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => markLostMutation.mutate({ lossReason, lossNotes })}
                disabled={markLostMutation.isPending}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
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
          <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Mark Quote as Rejected
              </h3>
              <button onClick={() => { setRejectModalQuoteId(null); setRejectReason(""); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Why did the customer reject this quote? <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. price too high, needed faster delivery, went with a competitor."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400"
              />
              {!rejectReason.trim() && (
                <p className="text-[11px] text-rose-500 font-medium">Rejection reason is required before submitting.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => { setRejectModalQuoteId(null); setRejectReason(""); }}
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

      {/* Bill Preview Modal Popup */}
      {viewQuoteId && (
        <QuoteBillModal
          quoteId={viewQuoteId}
          onClose={() => setViewQuoteId(null)}
        />
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
