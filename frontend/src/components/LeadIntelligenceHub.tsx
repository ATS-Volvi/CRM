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
  Bot
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

export type IntelligenceTab = "scope" | "discovery" | "playbook";

interface LeadIntelligenceHubProps {
  leadId: string;
  lead: any;
  user?: any;
  winProbability?: number | null | string;
  riskIndicator?: { label: string; reason?: string } | null;
  activeTab?: IntelligenceTab;
  onTabChange?: (tab: IntelligenceTab) => void;
  // Discovery call checklist state
  discoveryService: string;
  setDiscoveryService: (val: string) => void;
  discoveryFacility: string;
  setDiscoveryFacility: (val: string) => void;
  discoveryUrgency: string;
  setDiscoveryUrgency: (val: string) => void;
  discoverySowCheck: boolean;
  setDiscoverySowCheck: (val: boolean) => void;
  discoveryUtilitiesCheck: boolean;
  setDiscoveryUtilitiesCheck: (val: boolean) => void;
  // Action callbacks
  onActionClick?: (actionText: string) => void;
  onLogCallClick?: () => void;
  className?: string;
}

export const LeadIntelligenceHub: React.FC<LeadIntelligenceHubProps> = ({
  leadId,
  lead,
  user,
  winProbability,
  riskIndicator,
  activeTab: externalTab,
  onTabChange,
  discoveryService,
  setDiscoveryService,
  discoveryFacility,
  setDiscoveryFacility,
  discoveryUrgency,
  setDiscoveryUrgency,
  discoverySowCheck,
  setDiscoverySowCheck,
  discoveryUtilitiesCheck,
  setDiscoveryUtilitiesCheck,
  onActionClick,
  onLogCallClick,
  className = ""
}) => {
  const [internalTab, setInternalTab] = useState<IntelligenceTab>("scope");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;

  const handleTabSelect = (tab: IntelligenceTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const endpoint = `/api/v1/leads/${leadId}/ai-summary`;

  const { data, isFetching, refetch } = useQuery<any>({
    queryKey: ["ai-requirement-summary", "lead", leadId],
    queryFn: async () => {
      return await apiClient.get<any>(endpoint);
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000
  });

  const deliverables: string[] = data?.primaryDeliverables || [];
  const specs: string[] = data?.technicalSpecs || [];
  const intentScore: number | null = typeof data?.intentScore === "number" ? data.intentScore : null;
  const budgetBenchmark = data?.budgetAndCommercials || data?.budgetBenchmark || "Budget not specified";
  const deliveryTimeline = data?.timelineAndConstraints || data?.deliveryTimeline || "Standard 30-day quote validity";
  const specTier = specs[0] || "Standard Commercial Tier Specifications";
  const scopeVolume = deliverables[0] || (lead?.body ? lead.body.slice(0, 50) + "..." : "Commercial Quotation Scope");
  const rawQuote = data?.coreRequest || data?.rawSummaryText || lead?.body || "Client is requesting official pricing for industrial scope.";
  const recommendedAction = data?.recommendedAction || (lead?.firstName ? `Schedule product demo & confirm quote parameters with ${lead.firstName}.` : "Prepare and review quotation package based on customer scope.");

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[20px] p-4 sm:p-5 shadow-[0_8px_24px_-4px_rgba(5,150,105,0.06)] text-slate-900 dark:text-slate-100 relative overflow-hidden transition-all duration-200 ${className}`}>
      {/* ── Top Header Bar: Title + Segmented Switcher + Intent & Win Prob Pills ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Lead Intelligence &amp; Playbook Hub
              </h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-[#059669] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-mono">
                AI Copilot
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Synthesized commercial scope, 5-minute technical discovery &amp; copilot guidance.
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
              <span>Scope &amp; Specs</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSelect("discovery")}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === "discovery"
                  ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60"
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>5-Min Discovery Call</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
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
              <span>AI Copilot &amp; Next Step</span>
            </button>
          </div>

          {/* Win Probability Pill */}
          {winProbability !== undefined && winProbability !== null && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200">
              <span className="text-[10px] text-slate-400 font-semibold">Win Prob:</span>
              <strong className="font-extrabold text-[#059669]">
                {typeof winProbability === "number" ? `${winProbability}%` : winProbability}
              </strong>
            </div>
          )}

          {/* Intent Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-200">
            <TrendingUp className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span className="text-[11px]">
              Intent: <strong className="font-extrabold text-[#1D4ED8]">{intentScore !== null ? `${intentScore}%` : "85%"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Active Tab View 1: Customer Scope & Requirements Insight ── */}
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
                <Clock className="w-3 h-3 text-[#059669]" /> Delivery Timeline
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                {deliveryTimeline}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                Commercial Procurement Scope
              </p>
            </div>

            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[#059669]" /> Budget Benchmark
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                {budgetBenchmark}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                Extracted from opportunity details
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Tab View 2: 5-Minute Consultative Discovery Call Guide ── */}
      {currentTab === "discovery" && (
        <div className="space-y-3.5 animate-fade-in bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-900/50">
          <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-900/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px]">
                Consultative Discovery Checklist ({user?.name || "Pre-Sales"} ➔ {lead?.firstName || "Client"})
              </span>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium hidden sm:inline">
              Verify division, gate clearances &amp; readiness
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Question 1: Service Division */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                1. Service Division &amp; Scope
              </label>
              <select
                value={discoveryService}
                onChange={(e: any) => setDiscoveryService(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="industrial_hydrojetting">Industrial • UHP Hydrojetting (15k–40k PSI)</option>
                <option value="industrial_chem_tank">Industrial • Chemical Cleaning &amp; Decon</option>
                <option value="wms_waste_management">Waste Management • Hazardous Sludge (WMS)</option>
                <option value="tcf_modular_camp">Modular • Camp Cabins &amp; Toilets (TCF)</option>
                <option value="heavy_equipment">Heavy Equipment • Cranes &amp; Vacuum Fleet</option>
              </select>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                {discoveryService === "industrial_hydrojetting" && "➔ Hydrojetting: Confirm line diameter, scale hardness & water point (40k PSI certified lance)."}
                {discoveryService === "industrial_chem_tank" && "➔ Chemical / Decon: Verify metallurgy, volume & H₂S purge standards."}
                {discoveryService === "wms_waste_management" && "➔ WMS Sludge: Confirm waste classification (Hazardous/RCJY) & manifest."}
                {discoveryService === "tcf_modular_camp" && "➔ Modular / TCF: Confirm workforce headcount & sewage pumping schedule."}
                {discoveryService === "heavy_equipment" && "➔ Heavy Equipment: Confirm load tonnage chart & Aramco/TUV operator certs."}
              </p>
            </div>

            {/* Question 2: Plant Access & Gate Permits */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                2. Plant Access &amp; Permits (PTW)
              </label>
              <select
                value={discoveryFacility}
                onChange={(e: any) => setDiscoveryFacility(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="aramco_restricted">Saudi Aramco Facility (Restricted Zone)</option>
                <option value="sabic_rcjy">SABIC / Royal Commission (Jubail / Yanbu)</option>
                <option value="modon_industrial">MODON Industrial City / Secondary Zone</option>
                <option value="neom_remote">NEOM / Red Sea / Remote Project Site</option>
                <option value="commercial_open">Commercial / Municipal Infrastructure</option>
              </select>
              <p className="text-[10px] leading-tight">
                {discoveryFacility === "aramco_restricted" && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ Aramco Protocol: Mandates 48h advance gate pass &amp; Aramco-approved PTW.
                  </span>
                )}
                {discoveryFacility === "sabic_rcjy" && (
                  <span className="text-blue-700 dark:text-blue-400 font-medium">
                    ⚠️ SABIC / RCJY Protocol: Requires contractor EHS badge &amp; environmental permit.
                  </span>
                )}
                {discoveryFacility === "neom_remote" && (
                  <span className="text-purple-700 dark:text-purple-400 font-medium">
                    ⚠️ Remote Site: Mobilize self-sustained fuel tanker escort &amp; satellite dispatch.
                  </span>
                )}
                {(discoveryFacility === "modon_industrial" || discoveryFacility === "commercial_open") && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ Standard Access: Standard contractor PPE and site safety induction required.
                  </span>
                )}
              </p>
            </div>

            {/* Question 3: Mobilization Window */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                3. Mobilization Window &amp; Readiness
              </label>
              <select
                value={discoveryUrgency}
                onChange={(e: any) => setDiscoveryUrgency(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="emergency_shutdown">Emergency Outage (&lt; 24h Rapid Mobilization)</option>
                <option value="scheduled_tam">Scheduled Turnaround / TAM (2–4 Weeks Notice)</option>
                <option value="recurring_contract">Ongoing Operations (Monthly / Annual Framework)</option>
                <option value="spot_project">Spot Job / Pre-Commissioning Phase</option>
              </select>
              <div className="space-y-1 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discoverySowCheck}
                    onChange={(e) => setDiscoverySowCheck(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                    ✓ SOW / MSDS / Drawings verified
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discoveryUtilitiesCheck}
                    onChange={(e) => setDiscoveryUtilitiesCheck(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                    ✓ Utilities verified at site battery limit
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Tab View 3: AI Sales Copilot & Next Best Step ── */}
      {currentTab === "playbook" && (
        <div className="space-y-3.5 animate-fade-in">
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
                  {winProbability !== undefined && winProbability !== null ? (typeof winProbability === "number" ? `${winProbability}%` : winProbability) : "95%"}
                </span>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                <span className="text-slate-500 font-semibold block mb-0.5">Recommended Action:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 text-[11px] leading-snug">
                  {recommendedAction}
                </p>
              </div>
            </div>

            {riskIndicator && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-medium">{riskIndicator.label}</span>
              </div>
            )}
          </div>

          {/* Action Recommendations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#059669]" /> Primary Recommended Action
              </span>
              <p className="text-emerald-950 dark:text-emerald-200 font-medium leading-relaxed">
                Send technical specification sheet for <strong>{lead?.body ? lead.body.slice(0, 45) : lead?.subject || "Requested Items"}</strong> and schedule technical discovery call.
              </p>
            </div>

            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1">
              <span className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" /> Quote Readiness
              </span>
              <p className="text-blue-950 dark:text-blue-200 font-medium leading-relaxed">
                Inbound request captured via {lead?.source || "website form"}. Review specs and prepare itemized pricing.
              </p>
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

          <button
            type="button"
            onClick={() => onActionClick && onActionClick(recommendedAction)}
            className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate All Quotes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
