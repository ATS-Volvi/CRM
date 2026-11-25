import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Bot,
  Check,
  Wrench,
  Droplets,
  Truck,
  Building2,
  Save,
  FileCheck2,
  HelpCircle
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
  discoveryLocation?: string;
  setDiscoveryLocation?: (val: string) => void;
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
  discoveryLocation,
  setDiscoveryLocation,
  onActionClick,
  onLogCallClick,
  className = ""
}) => {
  const queryClient = useQueryClient();
  const [internalTab, setInternalTab] = useState<IntelligenceTab>("scope");
  const currentTab = externalTab !== undefined ? externalTab : internalTab;

  const currentLocation = discoveryLocation !== undefined ? discoveryLocation : (lead?.city || lead?.territory || "");

  const handleLocationUpdate = async (newLoc: string) => {
    if (setDiscoveryLocation) {
      setDiscoveryLocation(newLoc);
    }
    if (leadId) {
      try {
        await apiClient.put(`/api/v1/leads/${leadId}`, { city: newLoc });
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      } catch (err) {
        console.warn("Could not auto-save location to lead:", err);
      }
    }
  };

  // Selected technical scoping chips for zero-callback discovery
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [customDiscoveryNotes, setCustomDiscoveryNotes] = useState<string>("");
  const [isSavingSpecs, setIsSavingSpecs] = useState<boolean>(false);
  const [specsSavedFeedback, setSpecsSavedFeedback] = useState<boolean>(false);

  const toggleSpecChip = (spec: string) => {
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleSaveDiscoverySpecs = async () => {
    if (!leadId) return;
    setIsSavingSpecs(true);
    try {
      const divisionLabels: Record<string, string> = {
        industrial_hydrojetting: "Industrial Services & High-Pressure Hydrojetting (40,000 PSI)",
        wms_waste_management: "Waste Management Solutions (WMS - NCEC HazMat & Recycling)",
        heavy_equipment: "Heavy & Light Equipment Rental (Cranes, Super Suckers, Rig Fleet)",
        tcf_modular_camp: "Temporary Construction Facilities (TCF & Modular Units)",
        industrial_chem_tank: "Chemical Cleaning & Industrial Tank Decon"
      };

      const facilityLabels: Record<string, string> = {
        aramco_restricted: "Saudi Aramco Facility (Restricted Zone - 48h Advance Pass)",
        sabic_rcjy: "SABIC / Royal Commission (Jubail / Yanbu - EHS Badge Mandated)",
        modon_industrial: "MODON Industrial City / Secondary Zone",
        neom_remote: "NEOM / Red Sea / Remote Project Site (Self-Sustained Dispatch)",
        commercial_open: "Commercial / Municipal Infrastructure"
      };

      const urgencyLabels: Record<string, string> = {
        emergency_shutdown: "Emergency Outage (< 24h Rapid Mobilization)",
        scheduled_tam: "Scheduled Turnaround / TAM (2–4 Weeks Notice)",
        recurring_contract: "Ongoing Operations (Monthly / Annual Framework)",
        spot_project: "Spot Job / Pre-Commissioning Phase"
      };

      const divisionName = divisionLabels[discoveryService] || discoveryService;
      const facilityName = facilityLabels[discoveryFacility] || discoveryFacility;
      const urgencyName = urgencyLabels[discoveryUrgency] || discoveryUrgency;

      const lines = [
        `📋 **5-MIN DISCOVERY CALL TECHNICAL SPECIFICATIONS**`,
        `• **Service Division:** ${divisionName}`,
        `• **Project Site Location:** ${currentLocation || "Not specified / To be confirmed"}`,
        `• **Plant Access & Permits:** ${facilityName}`,
        `• **Mobilization Window:** ${urgencyName}`,
        `• **Verified Protocols:** SOW/MSDS Verified: ${discoverySowCheck ? "YES" : "NO"} | Site Utilities Verified: ${discoveryUtilitiesCheck ? "YES" : "NO"}`,
        "",
        `🔍 **Engineering & Operational Scoping (Zero-Callback Parameters):**`,
        selectedSpecs.length > 0
          ? selectedSpecs.map((s) => `  - [✓] ${s}`).join("\n")
          : "  - Standard commercial catalogue specifications apply",
        ""
      ];

      if (customDiscoveryNotes.trim()) {
        lines.push(`📝 **Client Specific Notes & Additional Requirements:**\n${customDiscoveryNotes.trim()}`);
      }

      await apiClient.post(`/api/v1/leads/${leadId}/activities`, {
        type: "note",
        title: `Discovery Specs: ${divisionName.split("(")[0].trim()}`,
        notes: lines.join("\n")
      });

      queryClient.invalidateQueries({ queryKey: ["leadActivities", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      setSpecsSavedFeedback(true);
      setTimeout(() => setSpecsSavedFeedback(false), 4000);
    } catch (err: any) {
      alert("Error saving discovery specifications: " + (err.message || "Failed to save specs"));
    } finally {
      setIsSavingSpecs(false);
    }
  };

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
    <div className={`bg-white dark:bg-slate-900 border-2 border-emerald-400/60 dark:border-emerald-600/50 ring-4 ring-emerald-500/10 rounded-[22px] p-4 sm:p-5 shadow-[0_8px_28px_-6px_rgba(5,150,105,0.12)] text-slate-900 dark:text-slate-100 relative overflow-hidden transition-all duration-200 ${className}`}>
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
              Zero-Callback Verification • Technical Scope, Gate Access &amp; Fleet Readiness
            </span>
          </div>

          {/* 4 Top-Level Gatekeeping & Location Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                <option value="industrial_hydrojetting">Industrial Services &amp; High-Pressure Hydrojetting (40,000 PSI)</option>
                <option value="wms_waste_management">Waste Management Solutions (WMS - NCEC HazMat &amp; Recycling)</option>
                <option value="heavy_equipment">Heavy &amp; Light Equipment Rental (Cranes, Super Suckers, Rig Fleet)</option>
                <option value="tcf_modular_camp">Temporary Construction Facilities (TCF &amp; Modular Units)</option>
                <option value="industrial_chem_tank">Chemical Cleaning &amp; Industrial Tank Decon</option>
              </select>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                {discoveryService === "industrial_hydrojetting" && "➔ Hydrojetting: Confirm line diameter, scale hardness & water point (40k PSI certified lance)."}
                {discoveryService === "wms_waste_management" && "➔ WMS Sludge: Confirm waste classification (Hazardous/RCJY) & NCEC manifest."}
                {discoveryService === "heavy_equipment" && "➔ Heavy Equipment: Confirm load tonnage chart, boom radius & Aramco/TUV operator certs."}
                {discoveryService === "tcf_modular_camp" && "➔ Modular / TCF: Confirm workforce headcount & sewage pumping schedule."}
                {discoveryService === "industrial_chem_tank" && "➔ Chemical / Decon: Verify metallurgy, volume & H₂S purge standards."}
              </p>
            </div>

            {/* Question 2: Project Site Location */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                  2. Project Site Location
                </label>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                  Mob/Demob
                </span>
              </div>

              {/* 1-Click Industrial Zone Chips */}
              <div className="flex flex-wrap gap-1">
                {["Jubail", "Dammam", "Ras Al-Khair", "Yanbu", "Remote Site"].map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => handleLocationUpdate(area)}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition cursor-pointer border ${
                      currentLocation === area
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={currentLocation}
                onChange={(e) => handleLocationUpdate(e.target.value)}
                placeholder="Type gate or paste map link..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                ➔ Auto-syncs to Contacted outreach popup &amp; calculates travel distance.
              </p>
            </div>

            {/* Question 3: Plant Access & Gate Permits */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                3. Plant Access &amp; Permits (PTW)
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

            {/* Question 4: Mobilization Window */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5 shadow-2xs">
              <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                4. Mobilization Window &amp; Readiness
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

          {/* ── DYNAMIC TECHNICAL SCOPING CHECKLIST (ZERO-CALLBACK QUESTIONNAIRE) ── */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800/60 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  {discoveryService === "industrial_hydrojetting" && <Droplets className="w-3.5 h-3.5" />}
                  {discoveryService === "wms_waste_management" && <Truck className="w-3.5 h-3.5" />}
                  {discoveryService === "heavy_equipment" && <Wrench className="w-3.5 h-3.5" />}
                  {discoveryService === "tcf_modular_camp" && <Building2 className="w-3.5 h-3.5" />}
                  {discoveryService === "industrial_chem_tank" && <Droplets className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    Operational Technical Discovery
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-300/50">
                      Eliminates 2nd Calls
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pre-sales rep must ask these specific engineering questions to formulate an immediate commercial quote.
                  </p>
                </div>
              </div>

              {/* Counter Pill */}
              <div className="flex items-center gap-1.5 self-start sm:self-center">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {selectedSpecs.length} specs captured
                </span>
                {selectedSpecs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSpecs([])}
                    className="text-[10px] text-slate-400 hover:text-rose-500 underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Division-Specific Question Blocks */}
            {/* 1. INDUSTRIAL SERVICES & HIGH-PRESSURE HYDROJETTING (40,000 PSI) */}
            {discoveryService === "industrial_hydrojetting" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Q1 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      1. Target Asset &amp; Fouling Hardness
                    </span>
                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                      Determines PSI &amp; Pump
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "What asset are we jetting, and what is the fouling material (polymer coke vs scale)?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Asset: Shell & Tube Exchanger",
                      "Asset: Process Piping / Headers",
                      "Asset: Storage Tank Shell",
                      "Asset: Boiler / Economizer Tubes",
                      "Fouling: Baked Coke / Polymer (Mandates 40,000 PSI UHP)",
                      "Fouling: Hard Mineral Scale (25k–35k PSI)",
                      "Fouling: Soft Sludge / Wax (15k PSI)"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q2 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      2. Line Diameter &amp; Lance System Tooling
                    </span>
                    <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-semibold shrink-0">
                      Nozzle Metallurgy
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "What is internal pipe/tube ID, and do we need automated 2-lance / 3-lance indexers?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Exchanger Tubes: 1/2\" to 1\" ID",
                      "Process Pipe: 2\" to 6\" ID",
                      "Main Header: 8\" to 24\" ID",
                      "Tooling: Automated 2/3-Lance Indexer",
                      "Tooling: Rigid Lance Machine",
                      "Tooling: Flexible High-Pressure Hose"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      3. Site Water Supply (Utility Point)
                    </span>
                    <span className="text-[9px] text-blue-700 dark:text-blue-400 font-semibold shrink-0">
                      Stops Idle Charges
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is continuous fresh water available within 50m, or must we mobilize water tanker shuttles?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Continuous Fresh Water Supply Available on Site (< 50m)",
                      "Contractor Water Tanker Shuttle Required (Supplied by Us)",
                      "Closed-Loop Effluent Recycling Filter Required"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      4. Effluent Washout &amp; Vacuum Evacuation
                    </span>
                    <span className="text-[9px] text-purple-700 dark:text-purple-400 font-semibold shrink-0">
                      Waste Containment
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Can washout water drain into plant trench, or is a Super Sucker vacuum truck needed in tandem?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Washout Drains into Plant Effluent Trench",
                      "Super Sucker Tandem Evacuation Required (Concurrent Vacuum)",
                      "Poly Containment Berm Required"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. WASTE MANAGEMENT SOLUTIONS (WMS - NCEC HAZMAT & RECYCLING) */}
            {discoveryService === "wms_waste_management" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Q1 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      1. Physical State &amp; Storage Containment
                    </span>
                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                      Vehicle Selection
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is waste pumpable liquid, thick sludge, or solid cake? In sumps, IBCs, or drums?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "State: Pumpable Liquid / Slurry",
                      "State: Viscous Heavy Sludge",
                      "State: Dry Solid / Centrifuge Cake",
                      "Storage: Underground Sump / Concrete Pit",
                      "Storage: 1,000L Intermediate Bulk Containers (IBC)",
                      "Storage: 55-Gallon UN Steel Drums"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q2 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      2. Hazard Classification &amp; MSDS Lab Report
                    </span>
                    <span className="text-[9px] text-rose-700 dark:text-rose-400 font-semibold shrink-0">
                      Mandatory Gate Pass
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Do you have an MSDS or lab assay? Is it hydrocarbon, acidic/caustic, or toxic H2S?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "MSDS / Certified Lab Assay Available",
                      "Hazard: Hydrocarbon / Heavy Oily Sludge",
                      "Hazard: Acidic / Caustic Corrosive Waste",
                      "Hazard: High H2S / Toxic Volatiles Present",
                      "Non-Hazardous Industrial Waste"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      3. Total Volume &amp; Removal Frequency
                    </span>
                    <span className="text-[9px] text-blue-700 dark:text-blue-400 font-semibold shrink-0">
                      Fleet Logistics
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "What is total quantity (m³ or tons), and is it a 1-time emergency or recurring hauling?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Volume: 10 to 50 m³",
                      "Volume: 50 to 200 m³",
                      "Volume: 200+ m³ Large Batch Project",
                      "Cadence: One-Time Rapid Clearance (< 48h)",
                      "Cadence: Recurring Scheduled Hauling Contract"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      4. Disposal Facility &amp; Destruction Certificate
                    </span>
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
                      NCEC Compliance
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Do you require certified NCEC Green Manifests, and is disposal mandated at Bee'ah or EDCO?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "NCEC Green Manifest & Certificate of Destruction Required",
                      "Mandated Facility: Bee'ah Jubail",
                      "Mandated Facility: EDCO Dammam/Jubail",
                      "Mandated Facility: SEPCO Yanbu / Western Province"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. HEAVY & LIGHT EQUIPMENT RENTAL (CRANES, SUPER SUCKERS, RIG FLEET) */}
            {discoveryService === "heavy_equipment" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Q1 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      1. Single Lift Weight &amp; Working Radius
                    </span>
                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                      Load Chart Sizing
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "What is max single lift weight (tons) AND working radius (meters from crane center)?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Single Lift Weight: < 15 Metric Tons",
                      "Single Lift Weight: 15 to 45 Metric Tons",
                      "Single Lift Weight: 50 to 100+ Metric Tons",
                      "Working Radius: < 12m from Center Pin",
                      "Working Radius: 15 to 30 Meters",
                      "Boom Tip Height: 20 to 50+ Meters"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q2 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      2. Third-Party Inspection &amp; Operator Badging
                    </span>
                    <span className="text-[9px] text-purple-700 dark:text-purple-400 font-semibold shrink-0">
                      Gate Rejection Risk
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Does machine and operator require Aramco-approved cards, TUV, or SABIC plant stickers?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Saudi Aramco Certified Operator & Machine Sticker",
                      "TUV Third-Party Certified & Valid Sticker",
                      "SABIC Plant Security Entry Induction Badge",
                      "Standard Commercial Civil Contractor Induction"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      3. Ground Compaction &amp; Outrigger Pad Area
                    </span>
                    <span className="text-[9px] text-slate-700 dark:text-slate-400 font-semibold shrink-0">
                      Civil Ground Safety
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is ground paved concrete/asphalt, or uncompacted desert soil requiring steel outrigger mats?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Setup Ground: Paved Concrete / Heavy Asphalt",
                      "Setup Ground: Uncompacted Soil (Steel Spreader Mats Required)",
                      "Overhead Power Line / Underground Utility Clearance Confirmed"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      4. Rental Terms &amp; Operating Shift Schedule
                    </span>
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
                      Commercial Rate Basis
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is rate 'Wet' (operator + fuel included) or 'Dry', and is it single shift vs 24/7 continuous?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Wet Rate (Certified Operator + Fuel + Maintenance Included)",
                      "Dry Rate (Bare Equipment Only - Client Supplies Fuel & Driver)",
                      "Shift: Single Shift (10 Hours / Day)",
                      "Shift: 24/7 Continuous Double Shift"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. TEMPORARY CONSTRUCTION FACILITIES (TCF & MODULAR UNITS) */}
            {discoveryService === "tcf_modular_camp" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Q1 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      1. Unit Type &amp; Floor Plan Configuration
                    </span>
                    <span className="text-[9px] text-indigo-700 dark:text-indigo-400 font-semibold shrink-0">
                      Civil Blueprint
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "What specific modular layout is needed (12x3m office, ensuite executive, ablution block, guard house)?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Layout: 12m x 3m Open Workstation Office",
                      "Layout: Executive Site Cabin with Ensuite Restroom",
                      "Layout: 40-Man Ablution / Restroom Block",
                      "Layout: Workforce Dining Mess Hall & Kitchen",
                      "Layout: Security Guard House & Gate Office"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q2 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      2. Power Generation &amp; Electrical Distribution
                    </span>
                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold shrink-0">
                      HVAC &amp; Generator
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is grid power available at boundary, or do we provide a diesel generator + fuel tanker package?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Dedicated Diesel Generator + Fuel Tanker Service Required",
                      "Synchronized Generator Package with Main DB Distribution",
                      "Grid Power Hookup Available at Site Boundary"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q3 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      3. Potable Water &amp; Sewage Servicing Cycle
                    </span>
                    <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-semibold shrink-0">
                      Recurring Service
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Do you require external water booster tanks &amp; sewage holding tanks with scheduled vacuum pumping?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Potable Water Booster Tank + Scheduled Refill Service",
                      "Underground Sewage Holding Tank + Scheduled Vacuum Pumping",
                      "Client Self-Manages Utilities & Sanitary Drainage"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q4 */}
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                      4. Site Pad Grading &amp; Crane Offloading
                    </span>
                    <span className="text-[9px] text-slate-700 dark:text-slate-400 font-semibold shrink-0">
                      Rigging &amp; Placement
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    "Is pad leveled/compacted, and will site crane offload flatbeds or do we mobilize a boom truck?"
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Pad is Leveled & Compacted Gravel/Concrete (Client Offloads)",
                      "Mobilize Contractor Boom Truck / Mobile Crane for Placement",
                      "Aramco Camp Security Fence & Lighting Required"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 5. CHEMICAL CLEANING & INDUSTRIAL TANK DECON (BACKWARD COMPATIBLE) */}
            {discoveryService === "industrial_chem_tank" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white block">
                    1. System Metallurgy &amp; Chemical Loop
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Metallurgy: Carbon Steel Loop",
                      "Metallurgy: Stainless Steel 304/316",
                      "Target: H2S Scavenging & Degassing",
                      "Target: Pyrophoric Iron Sulfide Neutralization",
                      "Target: Pickling & Passivation"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white block">
                    2. Chemical Waste &amp; Safety Permits
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Effluent Neutralization Required on Site",
                      "Off-Site Acid/Caustic HazMat Hauling to EDCO/Bee'ah",
                      "Confined Space Entry (CSE) with Breathing Air Trailer",
                      "Aramco Hot/Cold Work Permit Verified"
                    ].map((opt) => {
                      const isSelected = selectedSpecs.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleSpecChip(opt)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Notes Input & Sync Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <input
                type="text"
                value={customDiscoveryNotes}
                onChange={(e) => setCustomDiscoveryNotes(e.target.value)}
                placeholder="Additional client details (e.g., tube bundle OD 32mm, 420 tubes, requires 48h emergency mobilization)..."
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Saves directly to <strong>Activity Timeline &amp; Internal Notes</strong> for Commercial Estimators</span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {specsSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
                      <Check className="w-3.5 h-3.5" /> Specs Saved to Timeline!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveDiscoverySpecs}
                    disabled={isSavingSpecs}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSavingSpecs ? "animate-spin" : ""}`} />
                    <span>{isSavingSpecs ? "Saving Specs..." : "Save Specs to Lead Timeline"}</span>
                  </button>
                </div>
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
