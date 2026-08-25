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
      <div className={`bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-6 backdrop-blur-md shadow-xl text-white ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30 animate-pulse">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                Synthesizing Core Requirements...
              </h3>
              <p className="text-xs text-slate-400">Filtering conversation noise and extracting actionable specifications</p>
            </div>
          </div>
        </div>
        <div className="space-y-2.5 animate-pulse">
          <div className="h-4 bg-slate-800 rounded-md w-3/4"></div>
          <div className="h-4 bg-slate-800 rounded-md w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-white ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">AI Requirement Summary</h3>
              <p className="text-xs text-slate-400">Enquiry summary not generated yet</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate Summary
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
    <div className={`bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/40 border border-indigo-500/25 rounded-2xl p-6 backdrop-blur-md shadow-2xl text-white transition-all ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/20">
            <Zap className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-slate-100 text-base tracking-wide flex items-center gap-2">
                Executive Requirement Breakdown
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-400" />
                Filtered & Verified
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Conversational pleasantries filtered out — showing only concrete deliverables & specifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Intent Score Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
            <span className="text-slate-400">Buying Intent:</span>
            <span className={`font-bold ${intentScore >= 80 ? 'text-emerald-400' : intentScore >= 60 ? 'text-amber-400' : 'text-slate-300'}`}>
              {intentScore}%
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="Copy requirements markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Re-analyze and refresh requirements"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Core Need Banner */}
      <div className="mt-4 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-start gap-3">
        <Layers className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Core Demand</span>
          <p className="text-sm font-medium text-slate-100 mt-0.5 leading-relaxed">
            {data.coreRequest || "Official commercial quotation requested."}
          </p>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-5">
          {/* Main 2-Column Grid: Deliverables & Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Deliverables */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Deliverables & Items ({deliverables.length})
                </h4>
              </div>
              {deliverables.length > 0 ? (
                <ul className="space-y-2">
                  {deliverables.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 bg-slate-900/60 p-2 rounded-lg border border-slate-700/40">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No specific line item list extracted.</p>
              )}
            </div>

            {/* Technical Specifications */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-violet-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Technical Specifications & Standards
                </h4>
              </div>
              {specs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {specs.map((spec, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 text-violet-200 text-xs font-medium tracking-wide flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      {spec}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Standard industry specifications apply.</p>
              )}
            </div>
          </div>

          {/* Secondary Info Row: Context, Timeline, Commercials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Project Context */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
              <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Deployment Scope</span>
                <p className="text-xs font-medium text-slate-200 mt-0.5 line-clamp-2">
                  {data.projectContext || "Commercial Procurement Project"}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Timeline / Lead Time</span>
                <p className="text-xs font-medium text-slate-200 mt-0.5 line-clamp-2">
                  {data.timelineAndConstraints || "Standard 30-day quote validity"}
                </p>
              </div>
            </div>

            {/* Budget / Commercials */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Commercial Target</span>
                <p className="text-xs font-semibold text-emerald-300 mt-0.5 line-clamp-2">
                  {data.budgetAndCommercials || "Catalogue Price Book Standard"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Recommendation Banner */}
          {data.recommendedAction && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900/40 via-violet-900/30 to-slate-900/40 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    Recommended Next Step
                  </span>
                  <p className="text-xs font-medium text-slate-100 mt-0.5">
                    {data.recommendedAction}
                  </p>
                </div>
              </div>

              {onActionClick && (
                <button
                  onClick={() => onActionClick(data.recommendedAction)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                >
                  <span>Execute Action</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Tags Footer */}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[11px] text-slate-400 mr-1 font-medium">Requirement Tags:</span>
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] border border-slate-700/60 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
