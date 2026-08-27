import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  LayoutList,
  Columns3,
  Flame,
  Clock,
  ArrowRight,
  Globe,
  Mail,
  MessageCircle,
  Instagram,
  Share2,
  Layers,
  Facebook,
  Target,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { LeadStatus } from "../types";

export default function Leads() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [statusFilterTab, setStatusFilterTab] = useState<"all" | "active" | "converted" | "not_converted">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch Leads with Query Params
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads-workspace", selectedStatus, selectedChannel, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedChannel !== "ALL") {
        params.set("channel", selectedChannel);
        params.set("source", selectedChannel);
      }
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await apiClient.get<any>(`/api/v1/leads?${params.toString()}`);
      return res;
    }
  });

  const rawLeads: any[] = Array.isArray(leadsData) ? leadsData : leadsData?.data || [];
  const totalCount = leadsData?.total || rawLeads.length;
  const channelCounts: Record<string, number> = leadsData?.channelCounts || {};
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const CHANNEL_TABS: { key: string; label: string; icon: any; color?: string }[] = [
    { key: "ALL", label: "All", icon: Layers },
    { key: "Website", label: "Website", icon: Globe, color: "text-blue-600" },
    { key: "WhatsApp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
    { key: "Email", label: "Email", icon: Mail, color: "text-indigo-600" },
    { key: "Instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
    { key: "LinkedIn", label: "LinkedIn", icon: Share2, color: "text-sky-600" },
    { key: "Facebook", label: "Facebook / Meta", icon: Facebook, color: "text-blue-500" }
  ];

  // Filter based on status filter tab
  const leads = rawLeads.filter((l: any) => {
    const s = (l.status || "").toUpperCase();
    if (statusFilterTab === "active") {
      return s === "NEW" || s === "CONTACTED" || s === "QUALIFIED";
    }
    if (statusFilterTab === "converted") {
      return s === "CONVERTED";
    }
    if (statusFilterTab === "not_converted") {
      return s === "NOT_CONVERTED";
    }
    return true;
  });

  const LEAD_STAGES: { key: LeadStatus; label: string; color: string }[] = [
    { key: "NEW", label: "New", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "CONTACTED", label: "Contacted", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "QUALIFIED", label: "Qualified", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "CONVERTED", label: "Converted", color: "bg-purple-50 text-purple-700 border-purple-200 font-bold" },
    { key: "NOT_CONVERTED", label: "Not Converted", color: "bg-slate-100 text-slate-600 border-slate-200" }
  ];

  const getStatusBadge = (status: string) => {
    const sUpper = (status || "").toUpperCase();
    const stage = LEAD_STAGES.find((s) => s.key === sUpper) || {
      label: status || "NEW",
      color: "bg-slate-100 text-slate-700 border-slate-200"
    };
    return (
      <span className={`enterprise-badge ${stage.color}`}>
        {stage.label}
      </span>
    );
  };

  const getTemperatureBadge = (temp?: string) => {
    if (temp === "Hot") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
          <Flame className="w-3 h-3 text-red-500 fill-red-500" /> Hot
        </span>
      );
    }
    if (temp === "Warm") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
          <Flame className="w-3 h-3 text-amber-500" /> Warm
        </span>
      );
    }
    return <span className="text-[11px] text-slate-400">Cold</span>;
  };

  return (
    <div className="w-full px-6 md:px-8 py-6 space-y-5">
      {/* 1. Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-100 dark:border-blue-900 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pre-Sales Leads</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Capture, score, and qualify customer enquiries before commercial quotation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/opportunities")}
            className="enterprise-btn-secondary text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <Target className="w-3.5 h-3.5 text-emerald-600" />
            <span>Opportunities Pipeline</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Kanban View"
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          <button
            onClick={() => navigate("/leads/new")}
            className="enterprise-btn-primary text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Control Card: Status Tabs + Search + Channels */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-3 shadow-xs">
        {/* Top Filter Row: Segmented Status Pills + Search Box */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => { setStatusFilterTab("all"); setSelectedStatus("ALL"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Leads <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">{totalCount}</span>
            </button>
            <button
              onClick={() => { setStatusFilterTab("active"); setSelectedStatus("ALL"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "active"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Active Enquiries
            </button>
            <button
              onClick={() => { setStatusFilterTab("converted"); setSelectedStatus("CONVERTED"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "converted"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Converted Deals
            </button>
            <button
              onClick={() => { setStatusFilterTab("not_converted"); setSelectedStatus("NOT_CONVERTED"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "not_converted"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Not Converted
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search company, name, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full !pl-10 pr-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Bottom Filter Row: Channel Quick Filters */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Channel:</span>
            {CHANNEL_TABS.map((tab) => {
              const isSelected = selectedChannel === tab.key;
              const count = tab.key === "ALL" ? (channelCounts.ALL ?? totalCount) : channelCounts[tab.key];
              const Icon = tab.icon;

              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSelectedChannel(tab.key);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                  {count !== undefined && count !== null && (
                    <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                      isSelected ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900" : "text-slate-400"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 font-medium shrink-0 hidden sm:block">
            Showing <strong className="text-slate-700 dark:text-slate-300">{leads.length}</strong> of {totalCount}
          </div>
        </div>
      </div>

      {/* 3. Content Area */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading pre-sales leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="enterprise-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">No leads found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no leads matching your current filters. Try changing filters or create a new lead.
            </p>
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lead / Company</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Person</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Channel</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Temperature</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Budget</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Next Action</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {leads.map((l: any) => {
                const isConverted = (l.status || "").toUpperCase() === "CONVERTED";
                return (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    className="cursor-pointer transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          {(l.company || l.firstName || "L")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {l.company || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unnamed Enquiry"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            #{l.leadNumber || l.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {l.firstName || l.lastName ? `${l.firstName || ""} ${l.lastName || ""}`.trim() : "—"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {l.email || l.phone || "No contact info"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(l.status)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const src = (l.source || l.sourceChannel || l.sourceType || "Website").toLowerCase();
                          if (src.includes("whatsapp")) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
                              </span>
                            );
                          }
                          if (src.includes("email")) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <Mail className="w-3 h-3 text-blue-600" />
                                <span>Email</span>
                              </span>
                            );
                          }
                          if (src.includes("instagram")) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                <Instagram className="w-3 h-3 text-pink-600" />
                                <span>Instagram</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <Globe className="w-3 h-3 text-slate-500" />
                              <span>{l.source || "Website"}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {l.assignedTo?.name || "Unassigned"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getTemperatureBadge(l.temperature)}</td>
                    <td className="py-3.5 px-4">
                      {isConverted ? (
                        <div
                          onClick={(e) => {
                            if (l.convertedDealId) {
                              e.stopPropagation();
                              navigate(`/opportunities/${l.convertedDealId}`);
                            } else if (l.convertedAccountId) {
                              e.stopPropagation();
                              navigate(`/accounts/${l.convertedAccountId}`);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          <Target className="w-3 h-3 text-purple-600" />
                          <span>Deal →</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {l.budgetRange || (l.leadScore ? `₹${(l.leadScore * 10000).toLocaleString()}` : "—")}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{l.nextAction || (isConverted ? "Converted" : "Qualify Lead")}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/leads/${l.id}`);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 text-slate-400 dark:text-slate-400 transition-colors"
                        title="Open Lead"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total leads)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD FOR PRE-SALES LEAD STAGES */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => (l.status || "").toUpperCase() === stage.key);
            return (
              <div
                key={stage.key}
                className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80 flex flex-col min-h-[500px] shadow-2xs"
              >
                <div className="flex items-center justify-between px-1 py-1.5 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">{stage.label}</span>
                  <span className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                  {stageLeads.map((l) => {
                    const isConverted = stage.key === "CONVERTED";
                    return (
                      <div
                        key={l.id}
                        onClick={() => navigate(`/leads/${l.id}`)}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 cursor-pointer space-y-2 transition-all"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-xs font-bold text-slate-800 leading-snug">
                            {l.company || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Enquiry"}
                          </div>
                          {getTemperatureBadge(l.temperature)}
                        </div>

                        <div className="text-[11px] text-slate-500">
                          {l.firstName || l.lastName ? `${l.firstName || ""} ${l.lastName || ""}`.trim() : "—"}
                        </div>

                        {isConverted && (l.convertedDealId || l.convertedAccountId) ? (
                          <div
                            onClick={(e) => {
                              if (l.convertedDealId) {
                                e.stopPropagation();
                                navigate(`/opportunities/${l.convertedDealId}`);
                              } else if (l.convertedAccountId) {
                                e.stopPropagation();
                                navigate(`/accounts/${l.convertedAccountId}`);
                              }
                            }}
                            className="text-[10px] font-bold text-purple-600 flex items-center gap-1 hover:underline pt-1 border-t border-slate-100"
                          >
                            <Target className="w-3 h-3" />
                            <span>Linked Opportunity →</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>{l.sourceChannel || l.source || "Website"}</span>
                            <span className="font-semibold text-slate-600">{l.assignedTo?.name || "Unassigned"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
