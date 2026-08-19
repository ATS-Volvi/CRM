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
  UserCheck,
  Layers,
  Facebook
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { LeadStatus } from "../types";

export default function Leads() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [page, setPage] = useState(1);

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
      params.set("limit", "25");

      const res = await apiClient.get(`/api/v1/leads?${params.toString()}`);
      return res;
    }
  });

  const leads: any[] = Array.isArray(leadsData) ? leadsData : leadsData?.data || [];
  const totalCount = leadsData?.total || leads.length;
  const channelCounts: Record<string, number> = leadsData?.channelCounts || {};

  const CHANNEL_TABS: { key: string; label: string; icon: any; color?: string }[] = [
    { key: "ALL", label: "All", icon: Layers },
    { key: "Website", label: "Website", icon: Globe, color: "text-blue-600" },
    { key: "WhatsApp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
    { key: "Email", label: "Email", icon: Mail, color: "text-indigo-600" },
    { key: "Instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
    { key: "LinkedIn", label: "LinkedIn", icon: Share2, color: "text-sky-600" },
    { key: "Facebook", label: "Facebook / Meta", icon: Facebook, color: "text-blue-500" },
    { key: "Referral", label: "Referral", icon: UserCheck, color: "text-amber-600" }
  ];

  const LEAD_STAGES: { key: LeadStatus; label: string; color: string }[] = [
    { key: "NEW", label: "New", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "CONTACTED", label: "Contacted", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "QUALIFIED", label: "Qualified", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "CONVERTED", label: "Converted", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { key: "NOT_CONVERTED", label: "Not Converted", color: "bg-slate-100 text-slate-600 border-slate-200" }
  ];

  const getStatusBadge = (status: string) => {
    const stage = LEAD_STAGES.find((s) => s.key === status) || {
      label: status,
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
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Pre-Sales Leads
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and qualify early customer enquiries before commercial conversion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="List View"
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "kanban"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Kanban View"
            >
              <Columns3 className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          <button
            onClick={() => navigate("/leads/new")}
            className="enterprise-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* Channel Quick-Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : tab.color || "text-slate-400"}`} />
              <span>{tab.label}</span>
              {count !== undefined && count !== null && (
                <span
                  className={`ml-1 text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search company, name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="enterprise-input pl-9 w-full"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="enterprise-input shrink-0"
          >
            <option value="ALL">All Stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={selectedChannel}
            onChange={(e) => {
              setSelectedChannel(e.target.value);
              setPage(1);
            }}
            className="enterprise-input shrink-0 hidden md:block"
          >
            <option value="ALL">All Channels</option>
            <option value="Website">Website</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Facebook">Facebook / Meta</option>
            <option value="Referral">Referral</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <strong>{leads.length}</strong> of {totalCount} leads
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading pre-sales leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="enterprise-card p-12 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">No leads found</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Try modifying search filters or create a new enquiry record.
            </p>
          </div>
          <button onClick={() => navigate("/leads/new")} className="enterprise-btn-primary mx-auto">
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Lead</span>
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* PRIMARY VIEW: UNIFIED CLEAN TABLE */
        <div className="enterprise-card overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Lead / Company</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Est. Value</th>
                <th>Next Action</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/leads/${l.id}`)}
                  className="cursor-pointer transition-colors"
                >
                  <td className="font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {(l.company || l.firstName || "L")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 hover:text-blue-600">
                          {l.company || `${l.firstName} ${l.lastName}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          #{l.leadNumber || l.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-700">
                      {l.firstName} {l.lastName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {l.email || l.phone || "No contact info"}
                    </div>
                  </td>
                  <td>{getStatusBadge(l.status)}</td>
                  <td>
                    <div className="text-xs font-medium text-slate-700 capitalize">
                      {l.source || l.sourceChannel || "Website"}
                    </div>
                    {l.sourceDetail && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{l.sourceDetail}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-xs text-slate-700">
                      {l.assignedTo?.name || "Unassigned"}
                    </div>
                  </td>
                  <td>{getTemperatureBadge(l.temperature)}</td>
                  <td className="font-semibold text-slate-800">
                    {l.budgetRange || (l.leadScore ? `₹${(l.leadScore * 10000).toLocaleString()}` : "—")}
                  </td>
                  <td>
                    <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{l.nextAction || "Reply to Lead"}</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/leads/${l.id}`);
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Open Lead"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* OPTIONAL VIEW: KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.status === stage.key);
            return (
              <div
                key={stage.key}
                className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80 flex flex-col min-h-[500px]"
              >
                <div className="flex items-center justify-between px-1 py-1.5 mb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">{stage.label}</span>
                  <span className="text-[11px] font-semibold bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {stageLeads.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className="enterprise-card p-3 cursor-pointer space-y-2 hover:border-blue-400"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-xs font-bold text-slate-800">
                          {l.company || `${l.firstName} ${l.lastName}`}
                        </div>
                        {getTemperatureBadge(l.temperature)}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        {l.firstName} {l.lastName}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>{l.sourceChannel || l.source || "Website"}</span>
                        <span>{l.assignedTo?.name || "Unassigned"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
