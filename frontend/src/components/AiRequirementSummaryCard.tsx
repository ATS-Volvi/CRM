import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Package,
  Layers,
  Clock,
  DollarSign,
  ArrowRight,
  TrendingUp,
  FileText
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
  const endpoint = type === "lead" ? `/api/v1/leads/${id}/ai-summary` : `/api/v1/opportunities/${id}/ai-summary`;

  const { data, isLoading, isFetching, refetch, error } = useQuery<any>({
    queryKey: ["ai-requirement-summary", type, id],
    queryFn: async () => {
      return await apiClient.get<any>(endpoint);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-6 shadow-xs flex items-center justify-center gap-3 text-sm text-indigo-600 dark:text-indigo-400 ${className}`}>
        <Sparkles className="w-5 h-5 animate-spin" />
        <span className="font-semibold">Extracting and synthesizing customer scope &amp; requirements...</span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const deliverables: string[] = data.primaryDeliverables || [];
  const specs: string[] = data.technicalSpecs || [];
  const intentScore: number | null = typeof data.intentScore === "number" ? data.intentScore : null;
  const budgetBenchmark = data.budgetAndCommercials || data.budgetBenchmark || "Budget not specified";
  const deliveryTimeline = data.timelineAndConstraints || data.deliveryTimeline || "Timeline not specified";
  const specTier = specs[0] || "Standard Commercial Specifications";
  const scopeVolume = deliverables[0] || "Scope pending specification";

  return (
    <div className={`bg-white dark:bg-slate-900 border border-indigo-200/90 dark:border-indigo-900/60 rounded-2xl p-5 sm:p-6 shadow-xs text-slate-900 dark:text-slate-100 relative overflow-hidden transition-all ${className}`}>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/80 dark:border-indigo-800">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Customer Scope &amp; Requirements Insight
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">
              AI Extraction
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            {intentScore !== null ? (
              <span>
                Buying Intent:{" "}
                <strong className="font-extrabold">
                  {intentScore}% {intentScore >= 75 ? "(High Intent)" : intentScore >= 50 ? "(Moderate)" : "(Evaluating)"}
                </strong>
              </span>
            ) : (
              <span>Scope Synthesis: <strong className="font-extrabold">Extracted</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Main Quote Callout */}
      <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 mb-4">
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic font-medium leading-relaxed">
          &ldquo;{data.coreRequest || data.rawSummaryText || "Client requirement summary extracted from communications and recorded notes."}&rdquo;
        </p>
      </div>

      {/* 4-Column Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Metric 1 */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Package className="w-3 h-3 text-indigo-500" /> Estimated Scope &amp; Volume
          </span>
          <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
            {scopeVolume}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {deliverables[1] || (deliverables.length > 0 ? "Standard deliverables apply" : "No additional deliverables listed")}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-indigo-500" /> Specification Tier
          </span>
          <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
            {specTier}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {specs[1] || (specs.length > 0 ? "Standard grade requirements" : "No custom technical constraints")}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-500" /> Requested Delivery Timeline
          </span>
          <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
            {deliveryTimeline}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {data.projectContext || (data.timelineAndConstraints ? "Extracted from client communications" : "Standard fulfillment timeline")}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-xl space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-indigo-500" /> Budget Target / Benchmark
          </span>
          <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
            {budgetBenchmark}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {data.budgetAndCommercials ? "Extracted from opportunity details" : "Awaiting budget benchmark confirmation"}
          </p>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            <strong className="text-slate-800 dark:text-slate-200">Recommended Action:</strong>{" "}
            {data.recommendedAction || "Review client requirements and prepare quotation proposal."}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Remix Query</span>
          </button>

          <button
            onClick={() => onActionClick && onActionClick(data.recommendedAction)}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate All Quotes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

