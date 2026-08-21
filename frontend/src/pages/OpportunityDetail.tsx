import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Target,
  Building2,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Phone,
  Mail,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  X,
  Sliders
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import { DealReassignModal } from "../components/DealReassignModal";
import { DealReassignmentHistorySection } from "../components/DealReassignmentHistorySection";
import { DealSplitsSection } from "../components/DealSplitsSection";

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const [noteText, setNoteText] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState<any | null>(null);

  // Phase 2: Reassign Modal & Auto-Assign Banner States
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [autoAssignBanner, setAutoAssignBanner] = useState<{
    type: "success" | "info" | "error";
    message: string;
    reason?: string;
  } | null>(null);

  // Fetch Opportunity Detail
  const { data: opp, isLoading, error } = useQuery({
    queryKey: ["opportunity-detail", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/opportunities/${id}`);
      return res;
    },
    enabled: !!id
  });

  // Fetch Quotes belonging to this Opportunity
  const { data: quotesData } = useQuery({
    queryKey: ["opportunity-quotes", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/deals/${id}/quotes`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  const quotes: any[] = Array.isArray(quotesData) ? quotesData : [];

  // Stage change mutation
  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      return await apiClient(`/api/v1/opportunities/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: newStage })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
    }
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiClient.post(`/api/v1/activities`, {
        opportunityId: id,
        type: "note",
        outcome: text,
        pinned: false,
        isCompleted: true
      });
    },
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
    }
  });

  // Phase 2: Auto-Assign Mutation
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
          message: `Deal successfully auto-assigned to ${data.assignee?.name || "Senior AE"}.`
        });
      } else {
        setAutoAssignBanner({
          type: "info",
          message: "No Senior AE is currently eligible for automated assignment.",
          reason: data.reason || "All reps exceed deal size cutoffs or are at open-deal capacity."
        });
      }
    },
    onError: (err: any) => {
      setAutoAssignBanner({
        type: "error",
        message: err.message || "Failed to auto-assign deal."
      });
    }
  });

  const handleCreateOrder = async (finalQuoteId: string) => {
    setIsCreatingOrder(true);
    try {
      const res = await apiClient.post(`/api/v1/orders/from-quote`, {
        quoteId: finalQuoteId
      });
      setOrderCreatedSuccess(res);
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail", id] });
    } catch (err: any) {
      alert("Failed to create Order: " + (err.message || err));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading opportunity workspace...
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-red-600 font-semibold text-sm">Opportunity not found</div>
        <button onClick={() => navigate("/pipeline")} className="enterprise-btn-primary mx-auto">
          Back to Opportunities
        </button>
      </div>
    );
  }

  const STAGES = [
    { key: "Discovery", label: "Discovery" },
    { key: "Requirements", label: "Requirements" },
    { key: "Solution/Scope", label: "Solution/Scope" },
    { key: "Quote Preparation", label: "Quote Preparation" },
    { key: "Quote Sent", label: "Quote Sent" },
    { key: "Negotiation", label: "Negotiation" },
    { key: "Agreed", label: "Agreed" },
    { key: "Won", label: "Won" },
    { key: "Lost", label: "Lost" }
  ];

  const currentStageName = opp.stage?.name || opp.stageId || "Discovery";
  const currentStageIndex = STAGES.findIndex(
    (s) =>
      s.key.toLowerCase() === currentStageName.toLowerCase() ||
      s.label.toLowerCase() === currentStageName.toLowerCase()
  );

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Back Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/pipeline")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Opportunities</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Phase 2: Manual Reassign Button */}
          <button
            onClick={() => setIsReassignModalOpen(true)}
            className="enterprise-btn-secondary flex items-center gap-1.5 text-xs"
            title="Reassign Opportunity to a Senior AE"
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Reassign Owner</span>
          </button>

          {/* Phase 2: Auto-Assign Trigger Button */}
          <button
            onClick={() => autoAssignMutation.mutate()}
            disabled={autoAssignMutation.isPending}
            className="enterprise-btn-outline flex items-center gap-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
            title="Trigger Automated Deal Routing Engine"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${autoAssignMutation.isPending ? "animate-spin" : ""}`} />
            <span>Auto-Assign Rep</span>
          </button>

          <button
            onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
            className="enterprise-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Quote</span>
          </button>
        </div>
      </div>

      {/* Auto-Assignment Notification / Guidance Banner */}
      {autoAssignBanner && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs animate-fade-in ${
            autoAssignBanner.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : autoAssignBanner.type === "info"
              ? "bg-blue-50 border-blue-300 text-blue-950"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {autoAssignBanner.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : autoAssignBanner.type === "info" ? (
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold">{autoAssignBanner.message}</div>
              {autoAssignBanner.reason && (
                <p className="text-[11px] opacity-90">{autoAssignBanner.reason}</p>
              )}
              {autoAssignBanner.type === "info" && (
                <div className="pt-1.5">
                  <button
                    onClick={() => {
                      setAutoAssignBanner(null);
                      setIsReassignModalOpen(true);
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Open Manual Reassign Modal →
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setAutoAssignBanner(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Opportunity Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Commercial Opportunity
            </span>
            <span className="text-xs text-slate-400">ID: {opp.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{opp.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1 font-medium text-slate-800">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              {opp.account?.name || "General Account"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Owner: <strong>{opp.owner?.name || "Assigned Rep"}</strong>
              <button
                onClick={() => setIsReassignModalOpen(true)}
                className="ml-1 text-[11px] text-blue-600 hover:underline font-bold"
              >
                (Reassign)
              </button>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Expected Close:{" "}
              {opp.expectedCloseDate
                ? new Date(opp.expectedCloseDate).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "Not set"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 shrink-0">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Deal Value</div>
            <div className="text-xl font-extrabold text-slate-900">
              ₹{Number(opp.amount || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Win Probability</div>
            <div className="text-xl font-bold text-blue-600">{opp.probability || 50}%</div>
          </div>
        </div>
      </div>

      {/* Stage Progression Stepper */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
          <span>Commercial Stage Progression</span>
          <span className="text-blue-600">Current: {opp.stage?.name || opp.stageId || "Discovery"}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
          {STAGES.map((s, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;

            return (
              <button
                key={s.key}
                onClick={() => updateStageMutation.mutate(s.key)}
                className={`py-2 px-2 rounded-lg text-center text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs"
                    : isCompleted
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                }`}
              >
                {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Account, Contact Context & Reassignment History (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Account Card */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Account Context
              </span>
              {opp.account?.id && (
                <Link
                  to={`/accounts/${opp.account.id}`}
                  className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                >
                  View 360 <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-slate-800">{opp.account?.name || "General Account"}</div>
              <div className="text-slate-500">Industry: {opp.account?.industry || "Manufacturing"}</div>
              <div className="text-slate-500">Email: {opp.account?.email || "—"}</div>
              <div className="text-slate-500">Phone: {opp.account?.phone || "—"}</div>
            </div>
          </div>

          {/* Primary Contact Card */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" /> Primary Contact
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-slate-800">
                {opp.primaryContact?.firstName
                  ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName || ""}`
                  : "No primary contact linked"}
              </div>
              <div className="text-slate-500">Role: {opp.primaryContact?.role || "Decision Maker"}</div>
              <div className="text-slate-500">Email: {opp.primaryContact?.email || "—"}</div>
              <div className="text-slate-500">Phone: {opp.primaryContact?.phone || "—"}</div>
            </div>
          </div>

          {/* Deal Commission Split Section */}
          <DealSplitsSection
            dealId={opp.id}
            dealAmount={Number(opp.amount || 0)}
            ownerId={opp.ownerId}
            ownerName={opp.owner?.name}
          />

          {/* Reassignment & Audit History Section */}
          <DealReassignmentHistorySection dealId={opp.id} />

          {/* Source Attribution Summary */}
          {(opp.sourceChannel || opp.sourceType) && (
            <div className="enterprise-card p-4 space-y-2 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Marketing Attribution
              </span>
              <div className="space-y-1 text-xs text-slate-600">
                <div>
                  Channel: <strong>{opp.sourceChannel || "Direct"}</strong>
                </div>
                <div>
                  Source Type: <strong>{opp.sourceType || "Organic"}</strong>
                </div>
                {opp.sourceName && (
                  <div>
                    Entity: <strong>{opp.sourceName}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Activity Timeline & Notes (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="enterprise-card p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Activity &amp; Engagement Log
              </h3>
            </div>

            {/* Note Composer */}
            <div className="space-y-2">
              <textarea
                rows={2}
                placeholder="Log commercial notes, meeting minutes, requirements..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="enterprise-input w-full resize-none text-xs"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                  className="enterprise-btn-primary"
                >
                  <span>Post Commercial Note</span>
                </button>
              </div>
            </div>

            {/* Handoff History Banner */}
            {opp.handoff && opp.handoff.length > 0 && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs text-indigo-950">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-indigo-900">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    Lead Handoff History
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                    {opp.handoff.length} Transfer(s)
                  </span>
                </div>
                {opp.handoff.map((h: any, idx: number) => (
                  <div key={h.id || idx} className="p-2 bg-white/80 rounded-lg border border-indigo-100 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>
                        Transferred: <strong>{h.oldAssignee?.name || "Junior Rep"}</strong> → <strong>{h.newAssignee?.name || "Senior AE"}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    {h.reason && <p className="text-slate-600 italic">Reason: "{h.reason}"</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Timeline Activities List */}
            <div className="space-y-3 pt-2 max-h-[500px] overflow-y-auto pr-1">
              {opp.timeline && opp.timeline.length > 0 ? (
                opp.timeline.map((act: any) => {
                  const type = (act.type || "").toLowerCase();
                  const Icon = type.includes("call") ? Phone :
                             type.includes("whatsapp") ? MessageSquare :
                             type.includes("email") ? Mail :
                             type.includes("stage") ? RefreshCw : FileText;

                  return (
                    <div key={act.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 uppercase flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-blue-600" />
                          {act.type} {act.direction ? `(${act.direction})` : ""}
                        </span>
                        <span className="text-slate-400 font-medium">
                          {act.createdAt ? new Date(act.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div className="text-slate-800 font-medium whitespace-pre-wrap">
                        {act.notes || act.outcome || "Activity recorded"}
                      </div>
                      {act.createdBy && (
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Logged by: {act.createdBy.name || act.createdBy.email}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>SYSTEM EVENT</span>
                    <span>{new Date(opp.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-slate-700 font-medium">
                    Opportunity created from converted lead enquiry.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Quotation Version History & Orders (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Order Created Success Banner */}
          {orderCreatedSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sales Order Created Successfully!
              </div>
              <p>
                Order <strong>#{orderCreatedSuccess.order?.poNumber || orderCreatedSuccess.order?.id.slice(0, 8)}</strong> has been confirmed and routed to the Supply team.
              </p>
              <button
                onClick={() => navigate(`/orders/${orderCreatedSuccess.order.id}`)}
                className="enterprise-btn-primary bg-emerald-600 hover:bg-emerald-700"
              >
                <span>View Order #{orderCreatedSuccess.order?.poNumber}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quotations Card with Multi-Version Lineage */}
          <div className="enterprise-card p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Quotations ({quotes.length})
                </h3>
                <p className="text-[11px] text-slate-400">Multi-version proposal history</p>
              </div>
              <button
                onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                className="enterprise-btn-primary text-xs py-1 px-2.5"
              >
                <Plus className="w-3 h-3" />
                <span>New Quote</span>
              </button>
            </div>

            {quotes.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300" />
                <p>No commercial quotations created yet.</p>
                <button
                  onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
                  className="enterprise-btn-outline mx-auto"
                >
                  Create Quote v1
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q: any) => {
                  const isFinalAgreed = q.status === "Accepted" || q.isFinalAgreed;
                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-lg border transition-all ${
                        isFinalAgreed
                          ? "bg-emerald-50/70 border-emerald-300 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Quote #{q.quoteNumber}</span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                              v{q.version || 1}
                            </span>
                            {isFinalAgreed && (
                              <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> FINAL AGREED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            ₹{Number(q.totalAmount || 0).toLocaleString()}
                          </div>
                        </div>

                        <span
                          className={`enterprise-badge ${
                            q.status === "Accepted"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : q.status === "Sent"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>

                      {/* Action buttons for Quote */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <Link
                          to={`/quotes/new?dealId=${opp.id}&revisionOf=${q.id}`}
                          className="text-blue-600 hover:underline font-medium text-[11px]"
                        >
                          Create Revision (v{(q.version || 1) + 1})
                        </Link>

                        {isFinalAgreed && !q.orderId && (
                          <button
                            onClick={() => handleCreateOrder(q.id)}
                            disabled={isCreatingOrder}
                            className="enterprise-btn-primary bg-emerald-600 hover:bg-emerald-700 text-[11px] py-1 px-2.5"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Create Sales Order</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}
