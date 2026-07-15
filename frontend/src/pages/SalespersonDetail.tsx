import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, User, Phone, Mail, Award, Compass, DollarSign, Briefcase, FileSpreadsheet,
  FileText, Clock, Pin, MessageSquare, TrendingUp, Users, CheckSquare, History,
  Instagram, Globe, Facebook, CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, Minus, Plus
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface Quote {
  id: string;
  quoteNumber: string | null;
  version: number;
  status: string;
  cycleStage: string;
  totalAmount: number;
  dealId: string;
  dealName: string;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  expirationDate: string | null;
  approvalStatus?: string | null;
  approvalComments?: string | null;
  approvedBy?: string | null;
}

interface ActivityEntry {
  id: string;
  type: string;
  outcome: string | null;
  createdAt: string;
  leadId: string | null;
  leadName: string | null;
  pinned: boolean;
  priority: string | null;
}

interface LeadHistoryEntry {
  id: string;
  name: string;
  company: string;
  dealValue: number;
  closeDate: string;
  source: string;
  type: "won" | "lost";
}

interface Salesperson {
  id: string;
  name: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  totalLeads: number;
  totalDeals: number;
  purchaseOrders: {
    id: string;
    poNumber: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  wonClients: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
  }[];
  leadSources: { source: string; count: number }[];
  dealTypes: { stage: string; count: number }[];
  quotes: Quote[];
  activities: ActivityEntry[];
  wonLeads: LeadHistoryEntry[];
  lostLeads: LeadHistoryEntry[];
  successRate: number;
  sourceBreakdown: Record<string, { total: number; won: number; winRate: number }>;
  bestFitSuggestion: {
    source: string | null;
    winRate: number | null;
    reason?: string;
  } | null;
}

function getSourceIcon(source: string) {
  const src = source.toLowerCase().trim();
  if (src === "email") return Mail;
  if (src === "instagram" || src === "ig") return Instagram;
  if (src === "cold_call" || src === "cold call" || src === "coldcall") return Phone;
  if (src === "website" || src === "web") return Globe;
  if (src === "facebook" || src === "fb") return Facebook;
  return Compass;
}

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  
  // Local state for active segment filter
  const [filterSegment, setFilterSegment] = useState<string | null>(null);
  const [localCap, setLocalCap] = useState<number>(0);

  const updateCapMutation = useMutation({
    mutationFn: async (newCap: number) => {
      const res = await apiClient(`/api/v1/salespersons/${id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({ maxOpenLeads: newCap })
      });
      if (!res.ok) throw new Error("Failed to update capacity limit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salespersonPerformance", id] });
    }
  });

  const { data: rep, isLoading, error } = useQuery<Salesperson>({
    queryKey: ["salespersonPerformance", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/performance`);
      if (!res.ok) throw new Error("Failed to load representative profile");
      return res.json();
    },
    enabled: !!id && !!token
  });

  useEffect(() => {
    if (rep) {
      setLocalCap(rep.maxOpenLeads);
    }
  }, [rep]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !rep) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-error bg-error-container p-4 rounded-xl">
          {error instanceof Error ? error.message : "Could not load representative details"}
        </div>
        <button
          onClick={() => navigate("/salespersons")}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-surface-container transition-colors mx-auto"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Representatives
        </button>
      </div>
    );
  }

  // Combine won and lost leads for unified client-side filtering
  const allHistoryLeads: LeadHistoryEntry[] = [
    ...(rep.wonLeads || []).map(l => ({ ...l, type: "won" as const })),
    ...(rep.lostLeads || []).map(l => ({ ...l, type: "lost" as const }))
  ].sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());

  // Filter based on selected KPI card
  const filteredHistory = allHistoryLeads.filter(lead => {
    if (!filterSegment) return true;
    if (filterSegment === "won") return lead.type === "won";
    if (filterSegment === "lost") return lead.type === "lost";
    
    // Otherwise filter by lead source
    return lead.source.toLowerCase().trim() === filterSegment.toLowerCase().trim();
  });

  const leadSourceCounts = rep.leadSources.reduce((acc, curr) => {
    acc[curr.source] = curr.count;
    return acc;
  }, {} as Record<string, number>);

  const channels = [
    { label: "Email", key: "email", icon: Mail, color: "text-primary bg-primary/10" },
    { label: "Instagram", key: "instagram", icon: Instagram, color: "text-[#E1306C] bg-[#E1306C]/10" },
    { label: "Cold Call", key: "cold_call", icon: Phone, color: "text-secondary bg-secondary/10" },
    { label: "Website", key: "website", icon: Globe, color: "text-primary bg-primary/10" },
    { label: "Facebook", key: "facebook", icon: Facebook, color: "text-[#1877F2] bg-[#1877F2]/10" },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-8 animate-fade-in text-on-surface">
      {/* Breadcrumbs & Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/salespersons")}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors border border-outline-variant"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <span className="cursor-pointer hover:text-primary" onClick={() => navigate("/salespersons")}>Representatives</span>
            <span>/</span>
            <span className="font-bold text-on-surface">{rep.name}</span>
          </div>
        </div>
      </div>

      {/* Hero profile details */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-outline-variant">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-display-xs font-bold shrink-0">
              {rep.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-display-xs font-bold leading-tight">{rep.name}</h1>
              <div className="flex items-center space-x-3 text-body-md text-on-surface-variant mt-1.5 flex-wrap gap-y-1">
                <span className="capitalize px-3 py-1 rounded-full bg-primary/10 text-primary text-body-xs font-semibold">
                  {rep.role.replace("_", " ")}
                </span>
                <span>•</span>
                <span className={rep.isAvailable ? "text-green-500 font-semibold" : "text-amber-500 font-semibold"}>
                  {rep.isAvailable ? "Available for assignment" : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-md w-full lg:w-auto">
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center shadow-sm">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Won POs</div>
              <div className="text-display-xs font-extrabold text-primary mt-1">{rep.purchaseOrders.length}</div>
            </div>
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center shadow-sm">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Clients</div>
              <div className="text-display-xs font-extrabold text-secondary mt-1">{rep.wonClients.length}</div>
            </div>
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center col-span-2 md:col-span-1 shadow-sm flex flex-col items-center justify-between min-h-[135px]">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Leads Cap</div>
              <div className="flex items-center gap-4 mt-2">
                <button
                  disabled={localCap <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalCap(c => Math.max(0, c - 5));
                  }}
                  className="p-1.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all disabled:opacity-50 active:scale-90"
                  title="Decrease Capacity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-display-xs font-extrabold">{localCap}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalCap(c => c + 5);
                  }}
                  className="p-1.5 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all disabled:opacity-50 active:scale-90"
                  title="Increase Capacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {localCap !== rep.maxOpenLeads && (
                <button
                  disabled={updateCapMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCapMutation.mutate(localCap);
                  }}
                  className="mt-2.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 bg-primary text-white rounded hover:opacity-90 transition-all shadow active:scale-95"
                >
                  {updateCapMutation.isPending ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TOP CLICKABLE KPI CARDS ROW */}
        <div>
          <h3 className="text-title-xs font-bold text-on-surface mb-4">Click metrics to filter lead and deal history</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Total Leads KPI */}
            <button
              onClick={() => setFilterSegment(null)}
              className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                filterSegment === null ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-outline-variant bg-surface"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total Leads</span>
                <div className="p-1.5 rounded-lg bg-surface-container">
                  <Users className="w-4 h-4 text-on-surface-variant" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-on-surface mt-2">{rep.totalLeads}</div>
            </button>

            {/* Won Leads KPI */}
            <button
              onClick={() => setFilterSegment("won")}
              className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                filterSegment === "won" ? "border-green-500 bg-green-500/5 ring-1 ring-green-500" : "border-outline-variant bg-surface"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-600">Won Leads</span>
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-green-600 mt-2">{(rep.wonLeads || []).length}</div>
            </button>

            {/* Lost Leads KPI */}
            <button
              onClick={() => setFilterSegment("lost")}
              className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                filterSegment === "lost" ? "border-red-500 bg-red-500/5 ring-1 ring-red-500" : "border-outline-variant bg-surface"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Lost Leads</span>
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-red-600 mt-2">{(rep.lostLeads || []).length}</div>
            </button>

            {/* Success Rate (Not clickable) */}
            <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-sm flex flex-col justify-between h-28 select-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Success Rate</span>
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-on-surface mt-2">{Math.round((rep.successRate || 0) * 100)}%</div>
            </div>

            {/* Channel Source KPIs */}
            {channels.map((ch) => {
              const Icon = ch.icon;
              const count = leadSourceCounts[ch.key] || 0;
              const isSelected = filterSegment === ch.key;
              return (
                <button
                  key={ch.key}
                  onClick={() => setFilterSegment(ch.key)}
                  className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-outline-variant bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{ch.label}</span>
                    <div className={`p-1.5 rounded-lg ${ch.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-on-surface mt-2">{count}</div>
                </button>
              );
            })}

          </div>
        </div>

        {/* BEST FIT CALLOUT BLOCK */}
        {rep.bestFitSuggestion && (
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 rounded-xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-on-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-body-lg text-primary">Best Fit Lead Source Suggestion</h4>
              {rep.bestFitSuggestion.source ? (
                <p className="text-body-sm text-on-surface">
                  This representative performs exceptionally well with <span className="font-bold uppercase text-primary">{rep.bestFitSuggestion.source}</span> leads, boasting an overall win rate of <span className="font-bold text-primary">{rep.bestFitSuggestion.winRate}%</span>.
                </p>
              ) : (
                <p className="text-body-sm text-on-surface-variant italic">
                  Recommendation unavailable: {rep.bestFitSuggestion.reason || "insufficient closed deals to recommend"}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* LEAD AND DEAL HISTORY SECTION WITH CLIENT-SIDE FILTERING */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3 flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Lead & Deal History</h3>
            </div>
            
            {filterSegment && (
              <div className="flex items-center gap-2">
                <span className="text-body-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  Filter: {filterSegment}
                </span>
                <button
                  onClick={() => setFilterSegment(null)}
                  className="text-body-xs font-bold text-red-500 hover:underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic py-4">No closed leads/deals found matching this segment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                    <th className="py-2.5">Lead / Company</th>
                    <th className="py-2.5">Lead Source</th>
                    <th className="py-2.5">Deal Status</th>
                    <th className="py-2.5">Deal Value</th>
                    <th className="py-2.5">Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => {
                    const SourceIcon = getSourceIcon(item.source);
                    return (
                      <tr key={idx} className="border-b border-outline-variant/40 hover:bg-surface-container-high transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-on-surface">{item.name}</div>
                          <div className="text-body-xs text-on-surface-variant font-medium">{item.company}</div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5 text-body-xs bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/60 font-semibold text-on-surface-variant capitalize">
                            <SourceIcon className="w-3.5 h-3.5" />
                            {item.source}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 text-body-xs font-semibold px-2 py-0.5 rounded-full ${
                            item.type === "won" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                          }`}>
                            {item.type === "won" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {item.type === "won" ? "Won" : "Lost"}
                          </span>
                        </td>
                        <td className="py-3 font-bold">
                          ${Number(item.dealValue).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-on-surface-variant">
                          {new Date(item.closeDate).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Subsection grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead sources */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <Compass className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Lead Sources Distribution</h3>
            </div>
            <div className="space-y-3">
              {rep.leadSources.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant italic">No lead sources mapped.</p>
              ) : (
                rep.leadSources.map((ls, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{ls.source}</span>
                      <span className="text-on-surface-variant font-semibold">{ls.count} leads</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(ls.count / (rep.totalLeads || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Deal categories */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <Briefcase className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Deal Categories Mix</h3>
            </div>
            <div className="space-y-3">
              {rep.dealTypes.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant italic">No deals active or won yet.</p>
              ) : (
                rep.dealTypes.map((dt, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{dt.stage}</span>
                      <span className="text-on-surface-variant font-semibold">{dt.count} deals</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-secondary h-2 rounded-full"
                        style={{ width: `${(dt.count / (rep.totalDeals || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quotation Pipeline */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Quotation Pipeline ({rep.quotes?.length ?? 0})</h3>
          </div>
          {(!rep.quotes || rep.quotes.length === 0) ? (
            <p className="text-body-sm text-on-surface-variant italic">No quotations yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rep.quotes.map((q) => {
                const cycleColors: Record<string, string> = {
                  Draft:            "bg-surface-container-high text-on-surface-variant",
                  "Pending Approval": "bg-amber-500/10 text-amber-600",
                  Approved:         "bg-blue-500/10 text-blue-600",
                  Rejected:         "bg-red-500/10 text-red-600",
                  Sent:             "bg-indigo-500/10 text-indigo-600",
                  Viewed:           "bg-purple-500/10 text-purple-600",
                  Accepted:         "bg-green-500/10 text-green-600",
                  Expired:          "bg-slate-500/10 text-slate-500",
                  Superseded:       "bg-slate-500/10 text-slate-400",
                };
                const pillClass = cycleColors[q.cycleStage] ?? "bg-surface-container text-on-surface-variant";
                const isSuperseded = q.cycleStage === "Superseded";
                return (
                  <div key={q.id} className="flex flex-col gap-1 p-3 rounded-lg bg-surface-container border border-outline-variant/50 hover:border-outline-variant transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold text-body-sm font-mono shrink-0 ${isSuperseded ? "line-through text-on-surface-variant" : "text-primary"}`}>
                          {q.quoteNumber ?? "Draft"} v{q.version}
                        </span>
                        <span className="text-on-surface-variant text-body-xs truncate">{q.dealName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${pillClass}`}>{q.cycleStage}</span>
                        <span className="text-body-sm font-bold">${Number(q.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                        <span className="text-body-xs text-on-surface-variant">
                          {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {q.cycleStage === "Pending Approval" && q.approvalComments && (
                      <p className="text-body-xs text-on-surface-variant italic pl-1">
                        💬 {q.approvalComments}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Purchase Orders */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Associated Purchase Orders ({rep.purchaseOrders.length})</h3>
          </div>
          {rep.purchaseOrders.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic">No won purchase orders associated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                    <th className="py-2">PO Number</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Generated Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rep.purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-colors">
                      <td className="py-2.5 font-semibold text-primary">{po.poNumber}</td>
                      <td className="py-2.5 font-bold">${Number(po.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${
                          po.status === "Approved" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-on-surface-variant">{new Date(po.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Won Clients */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Client Portfolio ({rep.wonClients.length})</h3>
          </div>
          {rep.wonClients.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic">No client accounts activated yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rep.wonClients.map((client) => (
                <div key={client.id} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col justify-between space-y-2 hover:bg-surface-container-low transition-colors">
                  <div>
                    <div className="font-semibold text-body-md text-on-surface">{client.name}</div>
                    <div className="text-body-xs text-on-surface-variant font-medium">{client.company}</div>
                  </div>
                  <div className="flex items-center space-x-2 text-body-xs text-on-surface-variant font-semibold">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>{client.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activities Timeline */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Recent Activity</h3>
          </div>
          {(!rep.activities || rep.activities.length === 0) ? (
            <p className="text-body-sm text-on-surface-variant italic">No activities recorded yet.</p>
          ) : (
            <div className="relative space-y-6 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant max-h-80 overflow-y-auto pr-1">
              {rep.activities.map((act) => {
                const dotClass =
                  act.type === "call"         ? "bg-red-100 text-red-600" :
                  act.type === "email"        ? "bg-tertiary-container text-tertiary" :
                  act.type === "meeting"      ? "bg-secondary-container text-secondary" :
                  act.type === "stage_change" ? "bg-primary-container text-primary" :
                  act.type === "task"         ? "bg-surface-container-high text-on-surface" :
                                                "bg-surface-container-high text-on-surface-variant";
                const TypeIcon =
                  act.type === "call"         ? Phone :
                  act.type === "email"        ? Mail :
                  act.type === "meeting"      ? Users :
                  act.type === "stage_change" ? TrendingUp :
                  act.type === "task"         ? CheckSquare :
                                                MessageSquare;
                return (
                  <div key={act.id} className="relative pl-10">
                    <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-surface ${dotClass}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className={`p-3 rounded-lg border transition-colors ${
                      act.pinned ? "bg-secondary-container/10 border-secondary" : "bg-surface-container border-outline-variant/50"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-body-xs font-bold uppercase tracking-wide">{act.type.replace("_", " ")}</span>
                          {act.pinned && <Pin className="w-3 h-3 text-secondary fill-secondary" />}
                          {act.priority && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-body-xs font-semibold">{act.priority}</span>
                          )}
                        </div>
                        <span className="text-body-xs text-on-surface-variant shrink-0">
                          {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {act.outcome && <p className="text-body-sm text-on-surface mt-1 line-clamp-2">{act.outcome}</p>}
                      {act.leadName && <p className="text-body-xs text-on-surface-variant mt-1">📌 {act.leadName}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
