import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Target,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  X,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
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

  // Owner popover hover state
  const [hoveredOwnerId, setHoveredOwnerId] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number; flipped: boolean }>({ x: 0, y: 0, flipped: false });
  const ownerCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const POPOVER_HEIGHT = 240;
  const POPOVER_WIDTH = 340;

  const handleOwnerMouseEnter = useCallback((oppId: string) => {
    const cell = ownerCellRefs.current[oppId];
    if (cell) {
      const rect = cell.getBoundingClientRect();
      const flipped = rect.top < POPOVER_HEIGHT + 16;
      const x = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8);
      const y = flipped ? rect.bottom + 6 : rect.top - 6;
      setPopoverPos({ x, y, flipped });
    }
    setHoveredOwnerId(oppId);
  }, []);

  const handleOwnerMouseLeave = useCallback(() => {
    setHoveredOwnerId(null);
  }, []);

  // Modals
  const [lossModalOpp, setLossModalOpp] = useState<any | null>(null);
  const [lossReason, setLossReason] = useState<string>("PRICE");
  const [lossNotes, setLossNotes] = useState<string>("");

  const [wonModalOpp, setWonModalOpp] = useState<any | null>(null);
  const [wonReason, setWonReason] = useState<string>("QUOTE_ACCEPTED");
  const [createWorkOrderOnWon, setCreateWorkOrderOnWon] = useState(false);
  const [workOrderNotes, setWorkOrderNotes] = useState<string>("");

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
    mutationFn: async ({
      id,
      reason,
      createInstallationWorkOrder,
      workOrderNotes
    }: {
      id: string;
      reason: string;
      createInstallationWorkOrder?: boolean;
      workOrderNotes?: string;
    }) => {
      return apiClient.post(`/api/v1/opportunities/${id}/mark-won`, {
        reason,
        createInstallationWorkOrder,
        workOrderNotes
      });
    },
    onSuccess: () => {
      setWonModalOpp(null);
      setCreateWorkOrderOnWon(false);
      setWorkOrderNotes("");
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Won
          </span>
        );
      case "LOST":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Lost
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-sky-600" /> Open
          </span>
        );
    }
  };

  const renderPhaseBadge = (phase: OpportunityCommercialPhase) => {
    switch (phase) {
      case "Discovery":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Discovery
          </span>
        );
      case "Negotiation":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            Negotiation
          </span>
        );
      case "PO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            PO
          </span>
        );
    }
  };

  const getAvatarGradient = (str: string) => {
    const charCode = (str || "O").toUpperCase().charCodeAt(0);
    const gradients = [
      "from-emerald-600 to-teal-700 text-white",
      "from-blue-600 to-indigo-700 text-white",
      "from-violet-600 to-purple-700 text-white",
      "from-amber-600 to-rose-600 text-white",
      "from-teal-600 to-cyan-700 text-white",
      "from-indigo-600 to-sky-700 text-white"
    ];
    return gradients[charCode % gradients.length];
  };

  return (
    <div className="w-full px-6 md:px-8 py-6 space-y-5 bg-[#F8FAFC] dark:bg-slate-950 min-h-screen">
      {/* ── 1. TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-200/70 dark:border-emerald-800/80 shadow-2xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Opportunities
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Manage your sales pipeline and track deal progression.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate("/leads")}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex items-center gap-2 shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
            <span>Leads</span>
          </button>
          <button
            onClick={() => navigate("/quotes/new")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#17614A] hover:bg-[#124e3b] flex items-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* ── 2. UNIFIED FILTER & SEARCH BAR ── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
          <button
            onClick={() => {
              setStatusFilter("OPEN");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "OPEN"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Open</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "OPEN"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {openCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("WON");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "WON"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Won</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "WON" ? "bg-emerald-700 text-white" : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {wonCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("LOST");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "LOST"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Lost</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "LOST" ? "bg-rose-700 text-white" : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {lostCount}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusFilter("ALL");
              setPhaseFilter("ALL");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "ALL"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>All Deals</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "ALL" ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900" : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {totalCount}
            </span>
          </button>
        </div>

        {/* Right Search & Pipeline Value */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {statusFilter === "OPEN" && (
            <div className="text-xs text-slate-500 dark:text-slate-400 hidden lg:flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400">Pipeline:</span>
              <strong className="text-slate-900 dark:text-white font-extrabold">{formatCurrency(totalOpenValue)}</strong>
            </div>
          )}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search deals, accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full !pl-10 pr-9 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. INLINE PHASE PILLS (FOR OPEN DEALS) ── */}
      {statusFilter === "OPEN" && (
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Phase:
          </span>
          {(["ALL", "Discovery", "Negotiation", "PO"] as CommercialPhaseFilter[]).map((phase) => {
            const count =
              phase === "ALL"
                ? openCount
                : rawOpportunities.filter(
                    (o) => (o.status || "OPEN") === "OPEN" && deriveOpportunityPhase(o).phase === phase
                  ).length;
            const isSelected = phaseFilter === phase;

            return (
              <button
                key={phase}
                onClick={() => setPhaseFilter(phase)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs"
                    : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60"
                }`}
              >
                <span>{phase === "ALL" ? "All Open" : phase}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900" : "text-slate-400"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 4. OPPORTUNITIES TABLE ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Loading opportunities...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="p-16 text-center space-y-3.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200/70 dark:border-emerald-800/80 shadow-2xs">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No opportunities found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {search ? "No deals matching your search query." : "No deals in this category."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 select-none">
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Deal &amp; Account
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Status &amp; Phase
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Expected Close
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredOpportunities.map((opp) => {
                  const phaseInfo = deriveOpportunityPhase(opp);
                  const isWon = opp.status === "WON";
                  const isLost = opp.status === "LOST";
                  const accountLabel = opp.account?.name || opp.lead?.company || "Direct Account";
                  const firstChar = (opp.name || accountLabel || "O")[0].toUpperCase();

                  return (
                    <tr
                      key={opp.id}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-[#F4FAF6]/70 dark:hover:bg-slate-800/40 group"
                    >
                      {/* Deal & Account */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${getAvatarGradient(opp.name)} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}>
                            {firstChar}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {opp.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {accountLabel}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status & Phase */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {renderStatusBadge(opp.status)}
                          {!isWon && !isLost && renderPhaseBadge(phaseInfo.phase)}
                        </div>
                      </td>

                      {/* Owner with Hover Handoff Expansion */}
                      <td
                        ref={el => { ownerCellRefs.current[opp.id] = el; }}
                        className="py-3.5 px-4 whitespace-nowrap"
                        style={{ position: 'relative' }}
                        onMouseEnter={() => handleOwnerMouseEnter(opp.id)}
                        onMouseLeave={handleOwnerMouseLeave}
                      >
                        <div className="flex items-center gap-2 cursor-pointer">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {((opp.currentOwner?.name || opp.owner?.name || "S")[0]).toUpperCase()}
                          </div>
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {opp.currentOwner?.name || opp.owner?.name || "Sales Rep"}
                          </span>
                          {opp.handoffChain && opp.handoffChain.length > 1 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/70 dark:border-sky-800 shadow-2xs">
                              Handoff ({opp.handoffChain.length})
                            </span>
                          )}
                        </div>

                        {/* Owner Handoff Popover — position:fixed to escape table overflow clipping */}
                        <div
                          style={{
                            position: 'fixed',
                            left: popoverPos.x,
                            ...(popoverPos.flipped
                              ? { top: popoverPos.y }
                              : { top: popoverPos.y - POPOVER_HEIGHT }
                            ),
                            width: POPOVER_WIDTH,
                            padding: '16px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: 16,
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            zIndex: 9999,
                            opacity: hoveredOwnerId === opp.id ? 1 : 0,
                            pointerEvents: hoveredOwnerId === opp.id ? 'auto' : 'none',
                            transform: hoveredOwnerId === opp.id ? 'translateY(0)' : (popoverPos.flipped ? 'translateY(-4px)' : 'translateY(4px)'),
                            transition: 'opacity 180ms ease-out, transform 180ms ease-out',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          {/* Original Rep Block */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: '#E2E8F0', color: '#475569',
                              fontWeight: 700, fontSize: 11,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, marginTop: 2,
                              border: '1px solid #CBD5E1'
                            }}>
                              {(opp.originalRep?.name || opp.handoffChain?.[0]?.name || 'SR').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Original Rep</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {opp.originalRep?.name || opp.handoffChain?.[0]?.name || opp.owner?.name || 'Qualifying Rep'}
                              </div>
                              {opp.originalRep?.email && (
                                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {opp.originalRep.email}
                                </div>
                              )}
                              <div style={{ marginTop: 4 }}>
                                <span style={{
                                  display: 'inline-block', fontSize: 10, fontWeight: 700,
                                  color: '#B45309', background: '#FEF3C7',
                                  borderRadius: 6, padding: '2px 8px',
                                  border: '1px solid #FDE68A'
                                }}>
                                  Converted {opp.convertedAt ? new Date(opp.convertedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Connecting line(s) */}
                          {opp.handoffChain && opp.handoffChain.length > 2 ? (
                            opp.handoffChain.slice(1, -1).map((hop: any, idx: number) => (
                              <div key={idx}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 14, marginBottom: 8 }}>
                                  <div style={{ width: 1, height: 12, background: '#BFDBFE' }} />
                                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ marginTop: -2 }}>
                                    <path d="M7 10L0.937822 0.25H13.0622L7 10Z" fill="#93C5FD" />
                                  </svg>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <div style={{
                                    width: 30, height: 30, borderRadius: '50%',
                                    background: '#DBEAFE', color: '#1D4ED8',
                                    fontWeight: 700, fontSize: 11,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, marginTop: 2, border: '1px solid #BFDBFE'
                                  }}>
                                    {(hop.name || 'SR').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Intermediate Handoff</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hop.name}</div>
                                    <div style={{ marginTop: 4 }}>
                                      <span style={{
                                        display: 'inline-block', fontSize: 10, fontWeight: 700,
                                        color: '#B45309', background: '#FEF3C7',
                                        borderRadius: 6, padding: '2px 8px',
                                        border: '1px solid #FDE68A'
                                      }}>
                                        Handoff {new Date(hop.assignedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 14 }}>
                              <div style={{ width: 1, height: 14, background: '#CBD5E1' }} />
                              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ marginTop: -2 }}>
                                <path d="M7 10L0.937822 0.25H13.0622L7 10Z" fill="#94A3B8" />
                              </svg>
                            </div>
                          )}

                          {/* Current Owner Block */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: '#DCFCE7', color: '#16A34A',
                              fontWeight: 700, fontSize: 11,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, marginTop: 2,
                              border: '1px solid #BBF7D0'
                            }}>
                              {(opp.currentOwner?.name || opp.handoffChain?.[opp.handoffChain?.length - 1]?.name || opp.owner?.name || 'SR').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Current Owner</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {opp.currentOwner?.name || opp.handoffChain?.[opp.handoffChain?.length - 1]?.name || opp.owner?.name || 'Closer'}
                              </div>
                              {opp.currentOwner?.email && (
                                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {opp.currentOwner.email}
                                </div>
                              )}
                              <div style={{ marginTop: 4 }}>
                                {opp.actualClosedAt ? (
                                  <span style={{
                                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                                    color: '#16A34A', background: '#DCFCE7',
                                    borderRadius: 6, padding: '2px 8px',
                                    border: '1px solid #BBF7D0'
                                  }}>
                                    Closed on {new Date(opp.actualClosedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                                    color: '#059669', background: '#ECFDF5',
                                    borderRadius: 6, padding: '2px 8px',
                                    border: '1px solid #A7F3D0'
                                  }}>
                                    In Progress
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-3.5 px-4 font-black text-xs text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {formatCurrency(opp.amount || 0)}
                      </td>

                      {/* Win Rate */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {opp.probability !== null && opp.probability !== undefined
                          ? `${opp.probability}%`
                          : isWon
                          ? "100%"
                          : isLost
                          ? "0%"
                          : "60%"}
                      </td>

                      {/* Expected Close */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {opp.expectedCloseDate
                          ? new Date(opp.expectedCloseDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric"
                            })
                          : "Unset"}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isWon && !isLost ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setWonModalOpp(opp)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg border border-emerald-200/80 dark:border-emerald-800 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                              Won
                            </button>
                            <button
                              onClick={() => setLossModalOpp(opp)}
                              className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            >
                              Lost
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
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

      {/* ── 5. MODALS ── */}
      {wonModalOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirm Won
              </h3>
              <button onClick={() => setWonModalOpp(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Mark <strong className="text-slate-900 dark:text-white">{wonModalOpp.name}</strong> as Won.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Won Reason</label>
              <select
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="QUOTE_ACCEPTED">Final Quote Accepted</option>
                <option value="PURCHASE_ORDER">Purchase Order Received</option>
                <option value="CONTRACT_SIGNED">Contract Signed</option>
                <option value="MANUAL_CONFIRMATION">Manager Authorization</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createWorkOrderOnWon}
                  onChange={(e) => setCreateWorkOrderOnWon(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Create Installation & Delivery Work Order</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Auto-drafts a Field Service Work Order for machinery/rental delivery. Leave unchecked for Waste Disposal / Pure Brokerage deals.
                  </p>
                </div>
              </label>

              {createWorkOrderOnWon && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Installation Notes / Site Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={workOrderNotes}
                    onChange={(e) => setWorkOrderNotes(e.target.value)}
                    placeholder="e.g. Needs flatbed truck and site gate pass..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setWonModalOpp(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  markWonMutation.mutate({
                    id: wonModalOpp.id,
                    reason: wonReason,
                    createInstallationWorkOrder: createWorkOrderOnWon,
                    workOrderNotes
                  })
                }
                disabled={markWonMutation.isPending}
                className="px-4 py-2 bg-[#17614A] hover:bg-[#124e3b] text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                {markWonMutation.isPending ? "Confirming..." : "Confirm Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lossModalOpp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Close as Lost
              </h3>
              <button onClick={() => setLossModalOpp(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Specify loss reason for <strong className="text-slate-900 dark:text-white">{lossModalOpp.name}</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Loss Reason *</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="Optional context..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setLossModalOpp(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
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
