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
  AlertCircle
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState<any | null>(null);

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
        <button onClick={() => navigate("/opportunities")} className="enterprise-btn-primary mx-auto">
          Back to Opportunities
        </button>
      </div>
    );
  }

  const STAGES = [
    { key: "DISCOVERY", label: "Discovery" },
    { key: "REQUIREMENTS", label: "Requirements" },
    { key: "SOLUTION_DESIGN", label: "Solution" },
    { key: "PROPOSAL_QUOTE", label: "Quote Prep" },
    { key: "QUOTE_SENT", label: "Quote Sent" },
    { key: "NEGOTIATION", label: "Negotiation" },
    { key: "AGREED_PENDING_ORDER", label: "Agreed" },
    { key: "CLOSED_WON", label: "Won" }
  ];

  const currentStageIndex = STAGES.findIndex((s) => s.key === opp.stageId);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Back Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/opportunities")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Opportunities</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/quotes/new?dealId=${opp.id}`)}
            className="enterprise-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Quote</span>
          </button>
        </div>
      </div>

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
          <span className="text-blue-600">Current: {opp.stageId || "DISCOVERY"}</span>
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
        {/* LEFT COLUMN: Account & Contact Context (3 cols) */}
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
                Activity & Engagement Log
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

            {/* Timeline Placeholder/List */}
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>SYSTEM EVENT</span>
                  <span>{new Date(opp.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-slate-700 font-medium">
                  Opportunity created from converted lead enquiry.
                </div>
              </div>
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
    </div>
  );
}
