import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Package,
  Cpu,
  Clock,
  DollarSign,
  Building,
  ArrowRight,
  Copy,
  Check,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface AiRequirementSummaryCardProps {
  type: "lead" | "opportunity";
  id: string;
  onActionClick?: (actionText: string) => void;
  className?: string;
}

export const AiRequirementSummaryCard: React.FC<AiRequirementSummaryCardProps> = ({
  type,
  id,
  onActionClick,
  className = ""
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const endpoint = type === "lead" ? `/api/v1/leads/${id}/ai-summary` : `/api/v1/opportunities/${id}/ai-summary`;

  const { data, isLoading, isFetching, refetch, error } = useQuery<any>({
    queryKey: ["ai-requirement-summary", type, id],
    queryFn: async () => {
      return await apiClient.get<any>(endpoint);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const handleCopy = () => {
    if (!data) return;
    const textToCopy = data.rawSummaryText || `Requirements for ${type.toUpperCase()} #${id}:\n${data.coreRequest}\nDeliverables: ${(data.primaryDeliverables || []).join(", ")}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">Analyzing Customer Requirements...</h3>
            <p className="text-[11px] text-slate-400">Extracting deliverables and technical specifications</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Customer Requirements</h3>
              <p className="text-[11px] text-slate-400">Requirements summary has not been generated yet</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="enterprise-btn-primary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate Breakdown</span>
          </button>
        </div>
      </div>
    );
  }

  const deliverables: string[] = data.primaryDeliverables || [];
  const specs: string[] = data.technicalSpecs || [];
  const tags: string[] = data.keyTags || [];
  const intentScore: number = data.intentScore || 85;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/70 to-blue-100/60 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 border-2 border-blue-400/90 dark:border-blue-600/80 rounded-2xl p-5 shadow-lg shadow-blue-500/10 text-slate-900 dark:text-slate-100 space-y-4 transition-all ${className}`}>
      
      {/* Subtle AI Ambient Electric Cobalt Glow */}
      <div className="absolute top-0 right-0 w-80 h-36 bg-gradient-to-bl from-blue-600/20 via-indigo-500/15 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-blue-200/70 dark:border-blue-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-blue-950 dark:text-white text-sm tracking-tight flex items-center gap-1.5">
                AI Customer Scope & Requirements Insight
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                AI Verified
              </span>
            </div>
            <p className="text-xs text-blue-900/70 dark:text-blue-300/70 mt-0.5 font-medium">
              Structured deliverables, requested equipment, and scope details extracted from customer communication
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Buying Intent */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-800 shadow-2xs">
            <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Intent Score:</span>
            <span className={`font-black ${intentScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : intentScore >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700'}`}>
              {intentScore}%
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white/95 dark:bg-slate-800 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition-all border border-blue-200 dark:border-blue-800 shadow-2xs cursor-pointer"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Core Demand Card */}
      <div className="relative p-4 rounded-xl bg-white/95 dark:bg-slate-800/90 border-l-4 border-l-blue-600 border border-blue-200/90 dark:border-blue-800/70 flex items-start gap-3 shadow-xs">
        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1">
            Core Customer Demand
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-relaxed">
            {data.coreRequest || "Official commercial quotation requested."}
          </p>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1">
          {/* Main 2-Column Grid: Deliverables & Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Deliverables */}
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-800/70 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
              <div className="flex items-center gap-2 mb-2.5">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider">
                  Deliverables & Items ({deliverables.length})
                </h4>
              </div>
              {deliverables.length > 0 ? (
                <ul className="space-y-1.5">
                  {deliverables.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-900 dark:text-slate-200 bg-blue-50/50 dark:bg-slate-900 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/60 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-bold">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">Standard catalog service item.</p>
              )}
            </div>

            {/* Technical Specifications */}
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-800/70 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
              <div className="flex items-center gap-2 mb-2.5">
                <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider">
                  Technical Specifications & Standards
                </h4>
              </div>
              {specs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {specs.map((spec, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-blue-100/80 dark:bg-slate-900 text-blue-900 dark:text-blue-200 border border-blue-200/90 dark:border-blue-800 text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      {spec}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Standard commercial tier specifications.</p>
              )}
            </div>
          </div>

          {/* Secondary Info Row: Context, Timeline, Commercials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Deployment Scope */}
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-blue-200/70 dark:border-blue-800/50 flex items-start gap-2.5 shadow-2xs">
              <Building className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-blue-700/80 dark:text-blue-300/80 tracking-wider">Deployment Scope</span>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-0.5 line-clamp-2">
                  {data.projectContext || "Commercial Procurement Scope"}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-blue-200/70 dark:border-blue-800/50 flex items-start gap-2.5 shadow-2xs">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-blue-700/80 dark:text-blue-300/80 tracking-wider">Timeline / Lead Time</span>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-0.5 line-clamp-2">
                  {data.timelineAndConstraints || "Standard 30-day quote validity and delivery lead-time"}
                </p>
              </div>
            </div>

            {/* Budget / Commercials */}
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-blue-200/70 dark:border-blue-800/50 flex items-start gap-2.5 shadow-2xs">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-blue-700/80 dark:text-blue-300/80 tracking-wider">Commercial Target</span>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 line-clamp-2">
                  {data.budgetAndCommercials || "Price Book Target"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Recommendation Banner */}
          {data.recommendedAction && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/10 via-indigo-600/15 to-sky-600/10 border-2 border-blue-300/80 dark:border-blue-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" /> Recommended AI Action
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {data.recommendedAction}
                  </p>
                </div>
              </div>

              {onActionClick && (
                <button
                  onClick={() => onActionClick(data.recommendedAction)}
                  className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-indigo-600/35 hover:shadow-indigo-600/50 border border-white/20 ring-2 ring-indigo-500/25 hover:ring-indigo-500/50 flex items-center gap-2 transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-95 shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Execute Action</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
