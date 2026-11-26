import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  Package,
  Layers,
  Clock,
  DollarSign,
  TrendingUp,
  FileText,
  Phone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Bot,
  Send,
  Plus,
  ShieldCheck,
  Wrench,
  Truck
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

export type OpportunityIntelligenceTab = "scope" | "sow" | "playbook";

interface OpportunityIntelligenceHubProps {
  oppId: string;
  opp: any;
  quotes?: any[];
  dealRisk?: { label: string; reason?: string; level?: string; bgClass?: string };
  activeTab?: OpportunityIntelligenceTab;
  onTabChange?: (tab: OpportunityIntelligenceTab) => void;
  onActionClick?: (actionText: string) => void;
  onSendEmailClick?: () => void;
  onLogCallClick?: () => void;
  onRecordPoClick?: () => void;
  onSendQuoteClick?: (quoteId: string) => void;
  className?: string;
}

export const OpportunityIntelligenceHub: React.FC<OpportunityIntelligenceHubProps> = ({
  oppId,
  opp,
  quotes = [],
  dealRisk,
  activeTab: externalTab,
  onTabChange,
  onActionClick,
  onSendEmailClick,
  onLogCallClick,
  onRecordPoClick,
  onSendQuoteClick,
  className = ""
}) => {
  const [internalTab, setInternalTab] = useState<OpportunityIntelligenceTab>("scope");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;

  // Technical SOW & Site Readiness execution state
  const [executionDivision, setExecutionDivision] = useState("UHP Hydrojetting 40k PSI");
  const [plantAccessGate, setPlantAccessGate] = useState("Saudi Aramco Restricted Area");
  const [mobilizationSchedule, setMobilizationSchedule] = useState("Scheduled Turnaround (Within 14-30 Days)");
  const [sowMsdsVerified, setSowMsdsVerified] = useState(true);
  const [securityPermitsVerified, setSecurityPermitsVerified] = useState(true);
  const [jsaPermitVerified, setJsaPermitVerified] = useState(false);
  const [utilitiesHookupVerified, setUtilitiesHookupVerified] = useState(false);

  const handleTabSelect = (tab: OpportunityIntelligenceTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const endpoint = `/api/v1/opportunities/${oppId}/ai-summary`;

  const { data, isFetching, refetch } = useQuery<any>({
    queryKey: ["ai-requirement-summary", "opportunity", oppId],
    queryFn: async () => {
      return await apiClient.get<any>(endpoint);
    },
    enabled: !!oppId,
    staleTime: 5 * 60 * 1000
  });

  const deliverables: string[] = data?.primaryDeliverables || [];
  const specs: string[] = data?.technicalSpecs || [];
  const intentScore: number | null = typeof data?.intentScore === "number" ? data.intentScore : null;
  const budgetBenchmark =
    data?.budgetAndCommercials ||
    data?.budgetBenchmark ||
    (opp?.amount ? `SAR ${Number(opp.amount).toLocaleString()}` : "SAR 120,000 (Target Commercial Scope)");
  const deliveryTimeline = data?.timelineAndConstraints || data?.deliveryTimeline || "Standard 30-day quote validity & turnaround schedule";
  const specTier = specs[0] || "Standard Commercial Tier Specifications (Industrial Grade)";
  const scopeVolume = deliverables[0] || opp?.name || "Standard General Industry Commercial Equipment";
  const rawQuote =
    data?.coreRequest ||
    data?.rawSummaryText ||
    opp?.lead?.body ||
    opp?.lead?.subject ||
    `Client is requesting official pricing for ${opp?.name || "Standard General Industry Commercial Equipment"}.`;
  const recommendedAction =
    data?.recommendedAction ||
    (quotes.some((q: any) => q.status === "Approved")
      ? "Follow up on approved quote & prepare customer execution agreement."
      : quotes.length > 0
      ? `Follow up on open quotation #${quotes[0].quoteNumber || quotes[0].id?.slice(0, 8)} and confirm schedule/procurement timing with client.`
      : "Configure and send itemized quotation package from catalog based on confirmed scope.");

  return (
    <div
      className={`bg-white dark:bg-slate-900 border-2 border-emerald-400/60 dark:border-emerald-600/50 ring-4 ring-emerald-500/10 rounded-[22px] p-4 sm:p-5 shadow-[0_8px_28px_-6px_rgba(5,150,105,0.12)] text-slate-900 dark:text-slate-100 relative overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* ── Top Header Bar: Title + Segmented Switcher + Intent & Win Prob Pills ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Opportunity Intelligence &amp; Playbook Hub
              </h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-[#059669] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-mono">
                Deal Copilot
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Synthesized commercial scope, contractor execution SOW &amp; deal closing guidance.
            </p>
          </div>
        </div>

        {/* ── Segmented Pill Switcher & Metrics ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => handleTabSelect("scope")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === "scope"
                  ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Scope &amp; Commercials</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSelect("sow")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === "sow"
                  ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Technical SOW &amp; Execution</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>

            <button
              type="button"
              onClick={() => handleTabSelect("playbook")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === "playbook"
                  ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Deal Strategy &amp; Closing</span>
            </button>
          </div>

          {/* Win Probability Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200">
            <span className="text-[10px] text-slate-400 font-semibold">Win Prob:</span>
            <strong className="font-extrabold text-[#059669]">
              {opp?.probability !== null && opp?.probability !== undefined
                ? `${opp.probability}%`
                : opp?.status === "WON"
                ? "100%"
                : "85%"}
            </strong>
          </div>

          {/* Intent Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">
            <TrendingUp className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span className="text-[11px]">
              Intent:{" "}
              <strong className="font-extrabold text-[#1D4ED8]">
                {intentScore !== null ? `${intentScore}%` : "85% (High Intent)"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Active Tab View 1: Customer Scope & Commercials ── */}
      {currentTab === "scope" && (
        <div className="space-y-3.5 animate-fade-in">
          {/* Main Inbound Quote Callout */}
          <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5">
            <span className="text-base leading-none text-emerald-600 dark:text-emerald-400 font-serif">&ldquo;</span>
            <p className="text-xs text-slate-700 dark:text-slate-300 italic font-medium leading-relaxed">
              {rawQuote}
            </p>
          </div>

          {/* 4-Column Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Package className="w-3 h-3 text-[#059669]" /> Estimated Scope &amp; Volume
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={scopeVolume}>
                {scopeVolume}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {deliverables[1] || "Standard deliverables apply"}
              </p>
            </div>

            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#059669]" /> Specification Tier
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={specTier}>
                {specTier}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {specs[1] || "Standard Industrial Warranty"}
              </p>
            </div>

            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#059669]" /> Delivery &amp; Staging Schedule
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={deliveryTimeline}>
                {deliveryTimeline}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {data?.projectContext || "Commercial Procurement Scope"}
              </p>
            </div>

            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[#059669]" /> Commercial Target Benchmark
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={budgetBenchmark}>
                {budgetBenchmark}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                Extracted from opportunity details
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Tab View 2: Technical SOW & Site Readiness (FACE Contractor Services) ── */}
      {currentTab === "sow" && (
        <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#059669]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-200">
                Technical Execution Scope &amp; SOW Verification
              </h4>
            </div>
            <span className="text-[10px] text-[#059669] dark:text-emerald-300 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Execution Readiness &amp; Plant Clearances
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Service Division & Equipment Staging */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200/70 dark:border-slate-800 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                1. Service Division &amp; Equipment
              </label>
              <select
                value={executionDivision}
                onChange={(e) => setExecutionDivision(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="UHP Hydrojetting 40k PSI">Industrial Services &amp; High-Pressure Hydrojetting (40,000 PSI)</option>
                <option value="Hazardous Waste Sludge">Waste Management Solutions (WMS - NCEC HazMat &amp; Recycling)</option>
                <option value="Heavy Equipment Rental">Heavy &amp; Light Equipment Rental (Cranes, Super Suckers, Rig Fleet)</option>
                <option value="Modular TCF Facilities">Temporary Construction Facilities (TCF &amp; Modular Units)</option>
                <option value="Chemical & Tank Decon">Chemical &amp; Tank Decontamination</option>
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Operating pressure, flow rate (GPM), and required chemical compatibility verified.
              </p>
            </div>

            {/* 2. Plant Access & Gate Clearance */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200/70 dark:border-slate-800 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                2. Plant Access &amp; Gate Clearance
              </label>
              <select
                value={plantAccessGate}
                onChange={(e) => setPlantAccessGate(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Saudi Aramco Restricted Area">Saudi Aramco Restricted Area (Plant ID / Sticker)</option>
                <option value="SABIC / RCJY Royal Commission">SABIC / RCJY Royal Commission Zone</option>
                <option value="MODON Industrial City">MODON Industrial City (Standard Gate Access)</option>
                <option value="Remote Greenfield / NEOM">Remote Greenfield / NEOM Utilities Grid</option>
              </select>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                Driver Aramco ID, medical fit-to-work, and vehicle safety stickers verified for dispatch.
              </p>
            </div>

            {/* 3. Mobilization & Compliance Checklist */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200/70 dark:border-slate-800 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                3. Mobilization &amp; Site Readiness
              </label>
              <select
                value={mobilizationSchedule}
                onChange={(e) => setMobilizationSchedule(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Emergency Shutdown (<24h)">Emergency Mobilization (&lt;24 hrs - Priority)</option>
                <option value="Scheduled Turnaround (Within 14-30 Days)">Scheduled Turnaround (14-30 Days)</option>
                <option value="Annual Maintenance Contract (AMC)">Annual Maintenance Framework (AMC)</option>
                <option value="Capital Project Expansion">Capital Project Expansion Scope</option>
              </select>

              <div className="space-y-1 pt-1">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sowMsdsVerified}
                    onChange={(e) => setSowMsdsVerified(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Verified detailed SOW &amp; MSDS sheets</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securityPermitsVerified}
                    onChange={(e) => setSecurityPermitsVerified(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Gate security passes &amp; stickers cleared</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jsaPermitVerified}
                    onChange={(e) => setJsaPermitVerified(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>JSA (Job Safety Analysis) &amp; Work Permits ready</span>
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={utilitiesHookupVerified}
                    onChange={(e) => setUtilitiesHookupVerified(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Water &amp; electrical hookup locations confirmed</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Tab View 3: Deal Strategy & Closing Guidance ── */}
      {currentTab === "playbook" && (
        <div className="space-y-3 animate-fade-in">
          {/* AI Sales Copilot Card Contents */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/70 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-[#059669]" /> AI Sales Copilot &amp; Deal Guidance
              </span>
              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-[#059669] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                Real-time
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-700/70 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 font-medium block">Win Probability:</span>
                  <span className="text-[10px] text-slate-400">Score-based estimate</span>
                </div>
                <span className="font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 text-xs">
                  {opp?.probability !== null && opp?.probability !== undefined
                    ? `${opp.probability}%`
                    : opp?.status === "WON"
                    ? "100%"
                    : "85%"}
                </span>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                <span className="text-slate-500 font-semibold block mb-0.5">Recommended Action:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 text-[11px] leading-snug">
                  {recommendedAction}
                </p>
              </div>
            </div>

            {dealRisk && (
              <div
                className={`p-2.5 rounded-lg border text-xs leading-relaxed flex items-center justify-between gap-2 ${
                  dealRisk.bgClass || "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {dealRisk.level === "HIGH" ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : dealRisk.level === "MEDIUM" ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="font-bold">{dealRisk.label}: </span>
                    <span className="font-normal">{dealRisk.reason}</span>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-900/60 shrink-0">
                  Cadence Status
                </span>
              </div>
            )}
          </div>

          {/* Action Recommendations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" /> Primary Closing Action
                </span>
                <p className="text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                  {recommendedAction}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onSendEmailClick}
                  className="px-3 py-1.5 bg-[#059669] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Send className="w-3 h-3" />
                  <span>Send Follow-Up via Email</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 flex flex-col justify-between">
              <div>
                <span className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1">
                  <FileText className="w-4 h-4 text-indigo-600" /> Proposal Readiness
                </span>
                <p className="text-indigo-950 dark:text-indigo-100 font-medium leading-relaxed">
                  {quotes.length > 0
                    ? `${quotes.length} proposal version${quotes.length === 1 ? "" : "s"} on file. Most recent: Quote #${
                        quotes[0].quoteNumber || quotes[0].id?.slice(0, 8)
                      } (${quotes[0].status || "Active"}).`
                    : "No quotation generated yet. Click 'Launch Proposal Builder' to configure line items from catalog."}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onActionClick && onActionClick(recommendedAction)}
                  className="px-3 py-1.5 bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>Launch Proposal Builder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Persistent Bottom Action Bar ── */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#059669] shrink-0" />
          <span className="truncate">
            <strong className="text-slate-900 dark:text-white">Recommended:</strong>{" "}
            {recommendedAction}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
            title="Re-run AI extraction query"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#059669]" : ""}`} />
            <span>Remix</span>
          </button>

          <button
            type="button"
            onClick={onLogCallClick}
            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Phone className="w-3.5 h-3.5 text-[#059669]" />
            <span>Log Call</span>
          </button>

          {quotes.length > 0 && onSendQuoteClick && (
            <button
              type="button"
              onClick={() => onSendQuoteClick(quotes[0].id)}
              className="px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 text-xs font-bold transition-all border border-sky-300 dark:border-sky-800 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
              title="Send quote via Email or WhatsApp"
            >
              <Send className="w-3.5 h-3.5 text-sky-600" />
              <span>Send Quote (Email/WhatsApp)</span>
            </button>
          )}

          {onRecordPoClick && (
            <button
              type="button"
              onClick={onRecordPoClick}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
              title="Record client purchase order"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Record PO</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onActionClick && onActionClick(recommendedAction)}
            className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Launch Proposal Builder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
