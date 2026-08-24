import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

export interface PipelineStageInfo {
  id?: string;
  name: string;
  order: number;
  probability?: number;
  color: string;
  badgeColor: string;
  headerBg: string;
  headerText: string;
  headerBorder: string;
}

export const CANONICAL_PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    name: "Discovery",
    order: 1,
    probability: 10,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50/80",
    headerText: "text-blue-900",
    headerBorder: "border-blue-200"
  },
  {
    name: "Requirements",
    order: 2,
    probability: 20,
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    headerBg: "bg-cyan-50/80",
    headerText: "text-cyan-900",
    headerBorder: "border-cyan-200"
  },
  {
    name: "Solution/Scope",
    order: 3,
    probability: 40,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    headerBg: "bg-indigo-50/80",
    headerText: "text-indigo-900",
    headerBorder: "border-indigo-200"
  },
  {
    name: "Quote Preparation",
    order: 4,
    probability: 60,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    headerBg: "bg-amber-50/90",
    headerText: "text-amber-950",
    headerBorder: "border-amber-200"
  },
  {
    name: "Quote Sent",
    order: 5,
    probability: 70,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    headerBg: "bg-orange-50/90",
    headerText: "text-orange-950",
    headerBorder: "border-orange-200"
  },
  {
    name: "Negotiation",
    order: 6,
    probability: 80,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    headerBg: "bg-purple-50/90",
    headerText: "text-purple-950",
    headerBorder: "border-purple-200"
  },
  {
    name: "Agreed",
    order: 7,
    probability: 90,
    color: "bg-teal-50 text-teal-700 border-teal-200",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    headerBg: "bg-teal-50/90",
    headerText: "text-teal-950",
    headerBorder: "border-teal-200"
  },
  {
    name: "Won",
    order: 8,
    probability: 100,
    color: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
    headerBg: "bg-emerald-50/90",
    headerText: "text-emerald-950",
    headerBorder: "border-emerald-200"
  },
  {
    name: "Lost",
    order: 9,
    probability: 0,
    color: "bg-slate-100 text-slate-600 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
    headerBg: "bg-slate-100/90",
    headerText: "text-slate-900",
    headerBorder: "border-slate-300"
  }
];

export const STAGE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  "Discovery": { bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200" },
  "Requirements": { bg: "bg-cyan-50/80", text: "text-cyan-900", border: "border-cyan-200" },
  "Solution/Scope": { bg: "bg-indigo-50/80", text: "text-indigo-900", border: "border-indigo-200" },
  "Quote Preparation": { bg: "bg-amber-50/90", text: "text-amber-950", border: "border-amber-200" },
  "Quote Sent": { bg: "bg-orange-50/90", text: "text-orange-950", border: "border-orange-200" },
  "Negotiation": { bg: "bg-purple-50/90", text: "text-purple-950", border: "border-purple-200" },
  "Agreed": { bg: "bg-teal-50/90", text: "text-teal-950", border: "border-teal-200" },
  "Won": { bg: "bg-emerald-50/90", text: "text-emerald-950", border: "border-emerald-200" },
  "Lost": { bg: "bg-slate-100/90", text: "text-slate-900", border: "border-slate-300" },
  // Backward compatibility mappings
  "Proposal": { bg: "bg-amber-50/90", text: "text-amber-950", border: "border-amber-200" },
  "Needs Analysis": { bg: "bg-cyan-50/80", text: "text-cyan-900", border: "border-cyan-200" },
  "Closed Won": { bg: "bg-emerald-50/90", text: "text-emerald-950", border: "border-emerald-200" },
  "Closed Lost": { bg: "bg-slate-100/90", text: "text-slate-900", border: "border-slate-300" }
};

export function normalizeStageName(rawStage: string | undefined | null): string {
  if (!rawStage) return "Discovery";
  const s = rawStage.trim();
  if (s === "Proposal" || s === "PROPOSAL_QUOTE") return "Quote Preparation";
  if (s === "Needs Analysis" || s === "REQUIREMENTS") return "Requirements";
  if (s === "Solution" || s === "SOLUTION_DESIGN" || s === "Solution Design") return "Solution/Scope";
  if (s === "QUOTE_SENT") return "Quote Sent";
  if (s === "NEGOTIATION") return "Negotiation";
  if (s === "AGREED_PENDING_ORDER" || s === "Agreed / Pending Order") return "Agreed";
  if (s === "Closed Won" || s === "CLOSED_WON" || s === "Won") return "Won";
  if (s === "Closed Lost" || s === "CLOSED_LOST" || s === "Lost") return "Lost";
  if (s === "DISCOVERY") return "Discovery";
  return s;
}

export function getStageHeaderColor(stageName: string, isClosed: boolean = false) {
  const normalized = normalizeStageName(stageName);
  return (
    STAGE_COLOR_MAP[normalized] ||
    (isClosed
      ? { bg: "bg-slate-100/90", text: "text-slate-900", border: "border-slate-300" }
      : { bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200" })
  );
}

export function getStageBadgeClass(stageName: string): string {
  const normalized = normalizeStageName(stageName);
  const found = CANONICAL_PIPELINE_STAGES.find((s) => s.name.toLowerCase() === normalized.toLowerCase());
  return found?.badgeColor || "bg-slate-100 text-slate-700 border-slate-200";
}

export function usePipelineStages() {
  return useQuery<PipelineStageInfo[]>({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/api/v1/pipeline-stages");
      if (Array.isArray(res) && res.length > 0) {
        return res.map((s) => {
          const matched = CANONICAL_PIPELINE_STAGES.find(
            (c) => c.name.toLowerCase() === s.name.toLowerCase()
          );
          return {
            id: s.id,
            name: s.name,
            order: s.order || 0,
            probability: s.probability || matched?.probability || 0,
            color: matched?.color || "bg-slate-100 text-slate-700 border-slate-200",
            badgeColor: matched?.badgeColor || "bg-slate-100 text-slate-700 border-slate-200",
            headerBg: matched?.headerBg || "bg-blue-50/80",
            headerText: matched?.headerText || "text-blue-900",
            headerBorder: matched?.headerBorder || "border-blue-200"
          };
        });
      }
      return CANONICAL_PIPELINE_STAGES;
    },
    staleTime: 5 * 60 * 1000,
    initialData: CANONICAL_PIPELINE_STAGES
  });
}
