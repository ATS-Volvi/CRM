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
  ChevronLeft,
  ChevronRight,
  Phone,
  Sparkles,
  X
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { LeadStatus } from "../types";
import { LeadCampaignBadge } from "../components/LeadCampaignBadge";
import { CampaignFilterDropdown } from "../components/CampaignFilterDropdown";

export default function Leads() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [statusFilterTab, setStatusFilterTab] = useState<"all" | "active" | "converted" | "not_converted">("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch Leads with Query Params
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads-workspace", selectedStatus, selectedChannel, search, selectedCampaigns, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedChannel !== "ALL") {
        params.set("channel", selectedChannel);
        params.set("source", selectedChannel);
      }
      if (search.trim()) params.set("search", search.trim());
      if (selectedCampaigns.length > 0) {
        params.set("campaignIds", selectedCampaigns.join(","));
      }
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

  const LEAD_STAGES: { key: LeadStatus; label: string; dot: string; bg: string; text: string; border: string }[] = [
    { key: "NEW", label: "New", dot: "bg-sky-500", bg: "bg-sky-50 dark:bg-sky-950/50", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200/80 dark:border-sky-800" },
    { key: "CONTACTED", label: "Contacted", dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/80 dark:border-amber-800" },
    { key: "QUALIFIED", label: "Qualified", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/80 dark:border-emerald-800" },
    { key: "CONVERTED", label: "Converted", dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200/80 dark:border-purple-800" },
    { key: "NOT_CONVERTED", label: "Not Converted", dot: "bg-slate-400", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" }
  ];

  const getStatusBadge = (status: string) => {
    const sUpper = (status || "").toUpperCase();
    const stage = LEAD_STAGES.find((s) => s.key === sUpper) || {
      label: status || "NEW",
      dot: "bg-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-700"
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${stage.bg} ${stage.text} ${stage.border} shadow-2xs`}>
        <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
        {stage.label}
      </span>
    );
  };

  const getTemperatureBadge = (temp?: string) => {
    if (temp === "Hot") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200/70 dark:border-rose-800/80">
          <Flame className="w-3 h-3 text-rose-500 fill-rose-500" /> Hot
        </span>
      );
    }
    if (temp === "Warm") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-800/80">
          <Flame className="w-3 h-3 text-amber-500 fill-amber-500" /> Warm
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-700">
        Cold
      </span>
    );
  };

  const getAvatarGradient = (str: string) => {
    const charCode = (str || "L").toUpperCase().charCodeAt(0);
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
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-200/70 dark:border-emerald-800/80 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Pre-Sales Leads
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Capture, score, and qualify customer enquiries before commercial quotation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Opportunities Pipeline Shortcut */}
          <button
            onClick={() => navigate("/opportunities")}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex items-center gap-2 shadow-2xs transition-all active:scale-[0.98]"
          >
            <Target className="w-3.5 h-3.5 text-emerald-600" />
            <span>Opportunities Pipeline</span>
          </button>

          {/* View Mode Switcher (List / Board) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
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

          {/* + New Lead Action */}
          <button
            onClick={() => navigate("/leads/new")}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17614A] hover:bg-[#124e3b] text-white flex items-center gap-1.5 shadow-xs hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* 2. UNIFIED CONTROL & FILTER CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3.5 shadow-xs">
        {/* Top Filter Row: Segmented Status Tabs + Search Box + Campaign Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Segmented Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
            <button
              onClick={() => { setStatusFilterTab("all"); setSelectedStatus("ALL"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilterTab === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>All Leads</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                statusFilterTab === "all"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  : "bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}>
                {totalCount}
              </span>
            </button>
            <button
              onClick={() => { setStatusFilterTab("active"); setSelectedStatus("ALL"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Active Enquiries
            </button>
            <button
              onClick={() => { setStatusFilterTab("converted"); setSelectedStatus("CONVERTED"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "converted"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Converted Deals
            </button>
            <button
              onClick={() => { setStatusFilterTab("not_converted"); setSelectedStatus("NOT_CONVERTED"); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilterTab === "not_converted"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Not Converted
            </button>
          </div>

          {/* Search Box & Campaign Multi-Select Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-lg w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search company, name, email, phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full !pl-10 pr-9 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <CampaignFilterDropdown
              selectedCampaignIds={selectedCampaigns}
              onChange={(ids) => {
                setSelectedCampaigns(ids);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Bottom Filter Row: Channel Quick Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
              Channel:
            </span>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${tab.color && !isSelected ? tab.color : ""}`} />
                  <span>{tab.label}</span>
                  {count !== undefined && count !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                        : "bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 font-medium shrink-0">
            Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{leads.length}</strong> of {totalCount}
          </div>
        </div>
      </div>

      {/* 3. CONTENT AREA */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-slate-600 dark:text-slate-300">Loading pre-sales leads...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-16 text-center space-y-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200/70 dark:border-emerald-800/80 shadow-2xs">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No pre-sales leads found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no leads matching your current filters. Try adjusting your search query, status tabs, or create a new lead.
            </p>
          </div>
          <button
            onClick={() => { setSearch(""); setStatusFilterTab("all"); setSelectedStatus("ALL"); setSelectedChannel("ALL"); setSelectedCampaigns([]); }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 transition-colors inline-block"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 select-none">
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Lead / Company
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Temperature
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Est. Budget
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Next Action
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {leads.map((l: any) => {
                  const isConverted = (l.status || "").toUpperCase() === "CONVERTED";
                  const displayName = l.company || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unnamed Enquiry";
                  const leadRef = l.leadNumber || l.id.slice(0, 8);
                  const firstChar = (l.company || l.firstName || "L")[0].toUpperCase();

                  return (
                    <tr
                      key={l.id}
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-[#F4FAF6]/70 dark:hover:bg-slate-800/40 group"
                    >
                      {/* 1. Lead / Company */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${getAvatarGradient(displayName)} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}>
                            {firstChar}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                              {displayName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tracking-tight mt-0.5">
                              #{leadRef}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact Person */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {l.firstName || l.lastName ? `${l.firstName || ""} ${l.lastName || ""}`.trim() : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[190px]">
                          {l.email || l.phone || "No contact info"}
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(l.status)}
                      </td>

                      {/* 4. Channel */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const src = (l.source || l.sourceChannel || l.sourceType || "Website").toLowerCase();
                            if (src.includes("whatsapp")) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                                  <MessageCircle className="w-3 h-3 text-emerald-600" />
                                  <span>WhatsApp</span>
                                </span>
                              );
                            }
                            if (src.includes("email")) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                                  <Mail className="w-3 h-3 text-blue-600" />
                                  <span>Email</span>
                                </span>
                              );
                            }
                            if (src.includes("instagram")) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/70 dark:border-pink-800">
                                  <Instagram className="w-3 h-3 text-pink-600" />
                                  <span>Instagram</span>
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                                <Globe className="w-3 h-3 text-slate-500" />
                                <span>{l.source || "Website"}</span>
                              </span>
                            );
                          })()}
                          <LeadCampaignBadge attribution={l.campaignAttribution} />
                        </div>
                      </td>

                      {/* 5. Assigned To */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {(l.assignedTo?.name || "U")[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {l.assignedTo?.name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* 6. Temperature */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getTemperatureBadge(l.temperature)}
                      </td>

                      {/* 7. Est. Budget */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 transition-colors shadow-2xs"
                          >
                            <Target className="w-3 h-3 text-purple-600" />
                            <span>Deal →</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                            {l.budgetRange || (l.leadScore ? `₹${(l.leadScore * 10000).toLocaleString()}` : "—")}
                          </span>
                        )}
                      </td>

                      {/* 8. Next Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isConverted ? (
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Converted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/leads/${l.id}?openCallGuide=true`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Open 5-Minute Technical Discovery Call Guide"
                            >
                              <Phone className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>5-Min Call</span>
                            </button>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden xl:inline">
                              {l.nextAction || "Reply to Lead"}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 9. Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${l.id}`);
                          }}
                          className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-slate-400 dark:text-slate-500 transition-all border border-slate-200/50 dark:border-slate-700/50 shadow-2xs group-hover:border-emerald-200"
                          title="Open Lead"
                        >
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing page <strong className="text-slate-900 dark:text-white font-bold">{page}</strong> of <strong className="text-slate-900 dark:text-white font-bold">{totalPages}</strong> ({totalCount} total leads)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-3 py-1 font-bold text-slate-800 dark:text-slate-200">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs transition-all"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD FOR PRE-SALES LEAD STAGES */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => (l.status || "").toUpperCase() === stage.key);
            return (
              <div
                key={stage.key}
                className="bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 flex flex-col min-h-[520px] shadow-2xs"
              >
                <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {stageLeads.map((l) => {
                    const isConverted = stage.key === "CONVERTED";
                    const displayName = l.company || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Enquiry";
                    return (
                      <div
                        key={l.id}
                        onClick={() => navigate(`/leads/${l.id}`)}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs cursor-pointer space-y-2.5 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {displayName}
                          </div>
                          {getTemperatureBadge(l.temperature)}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
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
                              }
                            }}
                            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline pt-1.5 border-t border-slate-100 dark:border-slate-800"
                          >
                            <Target className="w-3 h-3" />
                            <span>Linked Opportunity →</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800 gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{l.sourceChannel || l.source || "Website"}</span>
                              <LeadCampaignBadge attribution={l.campaignAttribution} />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{l.assignedTo?.name || "Unassigned"}</span>
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
