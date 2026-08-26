import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import {
  Target,
  Search,
  Plus,
  Building2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  X
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { OpportunityQuoteNegotiationStrip } from "../components/OpportunityQuoteNegotiationStrip";
import {
  deriveOpportunityPhase,
  OpportunityLifecycleStatus,
  OpportunityCommercialPhase
} from "../utils/opportunityPhases";

export type CommercialPhaseFilter = "ALL" | "Discovery" | "Negotiation" | "PO";

export default function Opportunities() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Primary Lifecycle: OPEN | WON | LOST | ALL
  const [statusFilter, setStatusFilter] = useState<OpportunityLifecycleStatus>("OPEN");

  // Secondary Phase Filter (for OPEN pipeline): ALL | Discovery | Negotiation | PO
  const [phaseFilter, setPhaseFilter] = useState<CommercialPhaseFilter>("ALL");

  const [search, setSearch] = useState("");

  // Modals
  const [lossModalOpp, setLossModalOpp] = useState<any | null>(null);
  const [lossReason, setLossReason] = useState<string>("PRICE");
  const [lossNotes, setLossNotes] = useState<string>("");

  const [wonModalOpp, setWonModalOpp] = useState<any | null>(null);
  const [wonReason, setWonReason] = useState<string>("QUOTE_ACCEPTED");

  // Fetch opportunities from backend
  const { data: oppsData, isLoading } = useQuery({
    queryKey: ["opportunities-master-list", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await apiClient.get<any>(`/api/v1/opportunities?${params.toString()}`);
      return res;
    }
  });

  const rawOpportunities: any[] = Array.isArray(oppsData) ? oppsData : oppsData?.data || [];

  // Filter open opportunities by secondary cosmetic phase
  const filteredOpportunities = useMemo(() => {
    if (statusFilter === "OPEN" && phaseFilter !== "ALL") {
      return rawOpportunities.filter((opp) => deriveOpportunityPhase(opp).phase === phaseFilter);
    }
    return rawOpportunities;
  }, [rawOpportunities, statusFilter, phaseFilter]);

  // Overall counts for tabs
  const openCount = rawOpportunities.filter((o) => (o.status || "OPEN") === "OPEN").length;
  const wonCount = rawOpportunities.filter((o) => o.status === "WON").length;
  const lostCount = rawOpportunities.filter((o) => o.status === "LOST").length;
  const totalCount = rawOpportunities.length;

  const totalOpenValue = rawOpportunities
    .filter((o) => (o.status || "OPEN") === "OPEN")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const markWonMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiClient.post(`/api/v1/opportunities/${id}/mark-won`, { reason });
    },
    onSuccess: () => {
      setWonModalOpp(null);
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  const markLostMutation = useMutation({
    mutationFn: async ({ id, lossReason, lossNotes }: { id: string; lossReason: string; lossNotes: string }) => {
      return apiClient.post(`/api/v1/opportunities/${id}/mark-lost`, { lossReason, lossNotes });
    },
    onSuccess: () => {
      setLossModalOpp(null);
      setLossNotes("");
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "WON":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Won
          </span>
        );
      case "LOST":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Lost
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Open
          </span>
        );
    }
  };

  const renderPhaseBadge = (phase: OpportunityCommercialPhase) => {
    switch (phase) {
      case "Discovery":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Discovery
          </span>
        );
      case "Negotiation":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
            Negotiation
          </span>
        );
      case "PO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            PO
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* ── MINIMAL HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-xs text-slate-500">
            Manage your sales pipeline and track deal progression.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/leads")}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>Leads</span>
          </button>
          <button
            onClick={() => navigate("/quotes/new")}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* ── UNIFIED FILTER & SEARCH BAR ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => {
              setStatusFilter("OPEN");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "OPEN"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Open</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              statusFilter === "OPEN" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {openCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("WON");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "WON"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Won</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              statusFilter === "WON" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {wonCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("LOST");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "LOST"
                ? "bg-rose-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Lost</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              statusFilter === "LOST" ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {lostCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("ALL");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>All Deals</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              statusFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {totalCount}
            </span>
          </button>
        </div>

        {/* Right Search & Pipeline Value */}
        <div className="flex items-center gap-3">
          {statusFilter === "OPEN" && (
            <span className="text-xs text-slate-500 hidden lg:inline">
              Pipeline: <strong className="text-slate-900">{formatCurrency(totalOpenValue)}</strong>
            </span>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search deals, accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── INLINE PHASE PILLS (FOR OPEN DEALS) ── */}
      {statusFilter === "OPEN" && (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1">Phase:</span>
          {(["ALL", "Discovery", "Negotiation", "PO"] as CommercialPhaseFilter[]).map((phase) => {
            const count =
              phase === "ALL"
                ? openCount
                : rawOpportunities.filter(
                    (o) => (o.status || "OPEN") === "OPEN" && deriveOpportunityPhase(o).phase === phase
                  ).length;

            return (
              <button
                key={phase}
                onClick={() => setPhaseFilter(phase)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                  phaseFilter === phase
                    ? "bg-slate-200/80 text-slate-900 font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span>{phase === "ALL" ? "All Open" : phase}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── OPPORTUNITIES TABLE ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs text-slate-400 mt-2 font-medium">Loading deals...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-xs text-slate-400">
            <Target className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">No opportunities found</p>
            <p>{search ? "Try adjusting your search query." : "No deals in this category."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Deal &amp; Account</th>
                  <th className="py-3 px-4">Status &amp; Phase</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Win Rate</th>
                  <th className="py-3 px-4">Expected Close</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOpportunities.map((opp) => {
                  const phaseInfo = deriveOpportunityPhase(opp);
                  const isWon = opp.status === "WON";
                  const isLost = opp.status === "LOST";

                  return (
                    <tr
                      key={opp.id}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      {/* Deal & Account */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 hover:text-blue-600 transition-colors truncate">
                          {opp.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {opp.account?.name || opp.lead?.company || "Direct Account"}
                        </div>
                      </td>

                      {/* Status & Phase */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {renderStatusBadge(opp.status)}
                          {!isWon && !isLost && renderPhaseBadge(phaseInfo.phase)}
                        </div>
                      </td>

                      {/* Owner with Hover Handoff Expansion */}
                      <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap relative group/owner">
                        <div className="flex items-center gap-1.5 cursor-pointer">
                          <span className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                            {opp.currentOwner?.name || opp.owner?.name || "Sales Rep"}
                          </span>
                          {opp.handoffChain && opp.handoffChain.length > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                              Handoff ({opp.handoffChain.length})
                            </span>
                          )}
                        </div>

                        {/* Hover Expansion Card */}
                        <div className="absolute left-0 bottom-full mb-2 w-80 p-3.5 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl shadow-2xl z-50 border border-slate-700 space-y-2.5 opacity-0 pointer-events-none group-hover/owner:opacity-100 group-hover/owner:pointer-events-auto transition-all duration-200">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-slate-200 flex items-center gap-1">
                              🔄 Commercial Handoff Context
                            </span>
                            {opp.actualClosedAt ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                                Closed
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                Active Deal
                              </span>
                            )}
                          </div>

                          {/* Salesman 1 (Original Rep) */}
                          <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                🌱 Salesman 1 (Original Rep)
                              </span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {opp.originalRep?.name || opp.handoffChain?.[0]?.name || opp.owner?.name || "Qualifying Rep"}
                            </div>
                            {opp.originalRep?.email && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {opp.originalRep.email}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              Converted: {opp.convertedAt ? new Date(opp.convertedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A"}
                            </div>
                          </div>

                          {/* Intermediate Hops (Multi-hop handoff) */}
                          {opp.handoffChain && opp.handoffChain.length > 2 && (
                            <div className="space-y-1 pl-2 border-l-2 border-blue-500/40 my-1">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Intermediate Chain ({opp.handoffChain.length - 2} hops)</div>
                              {opp.handoffChain.slice(1, -1).map((hop: any, idx: number) => (
                                <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between">
                                  <span>↳ {hop.name} ({hop.role || "Rep"})</span>
                                  <span className="text-[10px] text-slate-500">{new Date(hop.assignedAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Salesman 2 (Current Owner) */}
                          <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                                👤 Salesman 2 (Current Owner)
                              </span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {opp.currentOwner?.name || opp.handoffChain?.[opp.handoffChain.length - 1]?.name || opp.owner?.name || "Closer"}
                            </div>
                            {opp.currentOwner?.email && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {opp.currentOwner.email}
                              </div>
                            )}
                            <div className="text-[10px] pt-0.5">
                              {opp.actualClosedAt ? (
                                <span className="text-emerald-400 font-semibold">
                                  Closed: {new Date(opp.actualClosedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-slate-400">Close Date: Not yet closed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(opp.amount || 0)}
                      </td>

                      {/* Probability */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {opp.probability !== null && opp.probability !== undefined
                          ? `${opp.probability}%`
                          : isWon
                          ? "100%"
                          : isLost
                          ? "0%"
                          : "60%"}
                      </td>

                      {/* Expected Close */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {opp.expectedCloseDate
                          ? new Date(opp.expectedCloseDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric"
                            })
                          : "Unset"}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isWon && !isLost ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setWonModalOpp(opp)}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                            >
                              Won
                            </button>
                            <button
                              onClick={() => setLossModalOpp(opp)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                            >
                              Lost
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {wonModalOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirm Won
              </h3>
              <button onClick={() => setWonModalOpp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Mark <strong className="text-slate-900">{wonModalOpp.name}</strong> as Won.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Won Reason</label>
              <select
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
              >
                <option value="QUOTE_ACCEPTED">Final Quote Accepted</option>
                <option value="PURCHASE_ORDER">Purchase Order Received</option>
                <option value="CONTRACT_SIGNED">Contract Signed</option>
                <option value="MANUAL_CONFIRMATION">Manager Authorization</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWonModalOpp(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  markWonMutation.mutate({
                    id: wonModalOpp.id,
                    reason: wonReason
                  })
                }
                disabled={markWonMutation.isPending}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {markWonMutation.isPending ? "Confirming..." : "Confirm Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lossModalOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Close as Lost
              </h3>
              <button onClick={() => setLossModalOpp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Specify loss reason for <strong className="text-slate-900">{lossModalOpp.name}</strong>.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Loss Reason *</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500"
                >
                  <option value="PRICE">Price / Commercial terms</option>
                  <option value="COMPETITOR">Lost to Competitor</option>
                  <option value="NO_BUDGET">No budget / Project cancelled</option>
                  <option value="TIMING">Delayed / Bad timing</option>
                  <option value="NO_RESPONSE">Customer unresponsive</option>
                  <option value="SCOPE_CHANGE">Scope incompatibility</option>
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
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setLossModalOpp(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  markLostMutation.mutate({
                    id: lossModalOpp.id,
                    lossReason,
                    lossNotes
                  })
                }
                disabled={markLostMutation.isPending}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {markLostMutation.isPending ? "Updating..." : "Confirm Lost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
