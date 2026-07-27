import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { StandardTable } from "../components/StandardTable";
import {
  Table,
  Kanban,
  ChevronDown,
  ChevronRight,
  Plus,
  User,
  Tag,
  Calendar,
  DollarSign,
  Layers,
  Check,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  MessageCircle
} from "lucide-react";

/** WhatsApp Badge: shown on any lead with communicationChannel=whatsapp or source=WhatsApp */
function WhatsAppBadge({ lead }: { lead: any }) {
  const isWhatsApp =
    (lead.communicationChannel || "").toLowerCase() === "whatsapp" ||
    (lead.source || "").toLowerCase() === "whatsapp";
  if (!isWhatsApp) return null;

  const unread = lead.unreadWhatsappCount || 0;
  const preview = lead.body ? lead.body.slice(0, 40) + (lead.body.length > 40 ? "…" : "") : null;
  const lastTime = lead.lastWhatsappAt
    ? new Date(lead.lastWhatsappAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-col gap-0.5 mt-1">
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-bold text-emerald-700">
          <MessageCircle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
          WhatsApp
        </span>
        {unread > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {lastTime && (
          <span className="text-[10px] text-on-surface-variant font-medium ml-0.5">{lastTime}</span>
        )}
      </div>
      {preview && (
        <p className="text-[10px] text-on-surface-variant italic truncate max-w-[200px]">"{preview}"</p>
      )}
    </div>
  );
}


// Status Color Palette (Soft Muted Style)
const STATUS_CONFIG: Record<string, { bg: string; text: string; bar: string; border: string; hover: string }> = {
  New: { bg: "bg-blue-50", text: "text-blue-700", bar: "#93c5fd", border: "border-blue-200", hover: "hover:bg-blue-100/70 hover:border-blue-300" },
  Contacted: { bg: "bg-amber-50", text: "text-amber-700", bar: "#fcd34d", border: "border-amber-200", hover: "hover:bg-amber-100/70 hover:border-amber-300" },
  Qualified: { bg: "bg-purple-50", text: "text-purple-700", bar: "#d8b4fe", border: "border-purple-200", hover: "hover:bg-purple-100/70 hover:border-purple-300" },
  Proposal: { bg: "bg-indigo-50", text: "text-indigo-700", bar: "#a5b4fc", border: "border-indigo-200", hover: "hover:bg-indigo-100/70 hover:border-indigo-300" },
  Negotiation: { bg: "bg-cyan-50", text: "text-cyan-700", bar: "#67e8f9", border: "border-cyan-200", hover: "hover:bg-cyan-100/70 hover:border-cyan-300" },
  Won: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "#6ee7b7", border: "border-emerald-200", hover: "hover:bg-emerald-100/70 hover:border-emerald-300" },
  Lost: { bg: "bg-rose-50", text: "text-rose-700", bar: "#fda4af", border: "border-rose-200", hover: "hover:bg-rose-100/70 hover:border-rose-300" },
  "On Hold": { bg: "bg-slate-100", text: "text-slate-600", bar: "#cbd5e1", border: "border-slate-300", hover: "hover:bg-slate-200/70 hover:border-slate-400" },
};

const DEFAULT_STATUS_CONFIG = { bg: "bg-slate-100", text: "text-slate-600", bar: "#cbd5e1", border: "border-slate-300", hover: "hover:bg-slate-200/70 hover:border-slate-400" };

// Avatar color helper
function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-600 text-white",
    "bg-purple-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-indigo-600 text-white",
    "bg-cyan-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Helper to get initials
function getInitials(name?: string) {
  if (!name || name === "Unassigned") return "UN";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LeadInbox() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<"table" | "board">("board");
  const [groupBy, setGroupBy] = useState<"status" | "owner">("status");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Inline Editing Dropdown States
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);

  // Group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // SINGLE SHARED DATA FETCH with 15s polling for real-time WhatsApp lead updates
  const { data: leads, isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 15000, // Poll every 15s — new WhatsApp leads appear automatically
    refetchIntervalInBackground: false,
  });

  // Salespersons list for inline owner editing
  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  // Shared Inline Lead Update Mutation (Status & Owner inline editing)
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: any }) => {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditingStatusId(null);
      setEditingOwnerId(null);
    }
  });

  // Filtered Leads (Used by both Table and Board views)
  const filteredLeads = useMemo(() => {
    return leads?.filter((lead: any) => {
      const numberStr = lead.leadNumber || "";
      const nameStr = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const companyStr = (lead.company || "").toLowerCase();
      const sourceStr = (lead.source || "").toLowerCase();
      const matchesSearch =
        numberStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nameStr.includes(searchQuery.toLowerCase()) ||
        companyStr.includes(searchQuery.toLowerCase()) ||
        sourceStr.includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    })?.slice()?.sort((a: any, b: any) => {
      // Sort WhatsApp unread leads first, then by lastWhatsappAt, then by createdAt
      if ((b.unreadWhatsappCount || 0) !== (a.unreadWhatsappCount || 0)) {
        return (b.unreadWhatsappCount || 0) - (a.unreadWhatsappCount || 0);
      }
      const bTime = b.lastWhatsappAt ? new Date(b.lastWhatsappAt).getTime() : 0;
      const aTime = a.lastWhatsappAt ? new Date(a.lastWhatsappAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }) || [];
  }, [leads, searchQuery, statusFilter]);

  // Source metrics computation including WhatsApp
  const sourceStats = useMemo(() => {
    const counts: Record<string, number> = {
      WhatsApp: 0,
      Email: 0,
      Instagram: 0,
      "Cold Call": 0,
      Website: 0,
      Facebook: 0,
      Other: 0
    };

    (leads || []).forEach((l: any) => {
      const src = (l.source || "").toLowerCase().trim();
      const channel = (l.communicationChannel || "").toLowerCase();
      if (src.includes("whatsapp") || channel === "whatsapp") counts["WhatsApp"]++;
      else if (src.includes("email")) counts["Email"]++;
      else if (src.includes("ig") || src.includes("instagram")) counts["Instagram"]++;
      else if (src.includes("cold")) counts["Cold Call"]++;
      else if (src.includes("web") || src.includes("site")) counts["Website"]++;
      else if (src.includes("fb") || src.includes("facebook")) counts["Facebook"]++;
      else counts["Other"]++;
    });

    return counts;
  }, [leads]);


  const totalValue = useMemo(() => {
    return filteredLeads.reduce((acc: number, l: any) => acc + (Number(l.leadScore || 50) * 100), 0);
  }, [filteredLeads]);

  const hotLeadsCount = useMemo(() => {
    return filteredLeads.filter((l: any) => (Number(l.leadScore || 50) * 100) >= 50000).length;
  }, [filteredLeads]);

  const avgScore = useMemo(() => {
    if (filteredLeads.length === 0) return 0;
    return Math.round(filteredLeads.reduce((acc: number, l: any) => acc + Number(l.leadScore || 50), 0) / filteredLeads.length);
  }, [filteredLeads]);

  // Grouped Leads calculation for Board View
  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {};

    if (groupBy === "status") {
      const allStatuses = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
      allStatuses.forEach(st => { groups[st] = []; });

      filteredLeads.forEach((lead: any) => {
        const status = lead.status || "New";
        if (!groups[status]) groups[status] = [];
        groups[status].push(lead);
      });
    } else {
      groups["Unassigned"] = [];
      if (salespersons) {
        salespersons.forEach((sp: any) => {
          groups[sp.name] = [];
        });
      }

      filteredLeads.forEach((lead: any) => {
        const ownerName = lead.assignedTo?.name || "Unassigned";
        if (!groups[ownerName]) groups[ownerName] = [];
        groups[ownerName].push(lead);
      });
    }

    return groups;
  }, [filteredLeads, groupBy, salespersons]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Table Columns Definition
  const columns = [
    {
      key: "leadNumber",
      header: "Lead #",
      render: (lead: any) => (
        <Link to={`/leads/${lead.id}`} className="text-primary font-bold hover:underline">
          {lead.leadNumber || "N/A"}
        </Link>
      )
    },
    {
      key: "name",
      header: "Client Name",
      render: (lead: any) => (
        <div>
          <Link to={`/leads/${lead.id}`} className="font-bold text-foreground hover:text-primary transition-colors">
            {lead.firstName} {lead.lastName}
          </Link>
          <p className="text-[10px] text-muted-foreground">{lead.company || "No Company"}</p>
          <WhatsAppBadge lead={lead} />
        </div>
      )
    },
    {
      key: "company",
      header: "Company",
      render: (lead: any) => lead.company || "N/A"
    },
    {
      key: "industry",
      header: "Pipeline / Industry",
      render: (lead: any) => lead.industry || "General"
    },
    {
      key: "owner",
      header: "Owner",
      render: (lead: any) => lead.assignedTo?.name || "Unassigned"
    },
    {
      key: "leadScore",
      header: "Revenue Value",
      align: "right" as const,
      render: (lead: any) => formatCurrency((lead.leadScore || 50) * 100)
    },
    {
      key: "status",
      header: "Status",
      render: (lead: any) => {
        const cfg = STATUS_CONFIG[lead.status] || DEFAULT_STATUS_CONFIG;
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} shadow-2xs`}>
            {lead.status}
          </span>
        );
      }
    },
    {
      key: "createdAt",
      header: "Last Contact Date",
      render: (lead: any) => {
        const wa = lead.lastWhatsappAt;
        if (wa) return <span className="text-emerald-700 font-semibold">{new Date(wa).toLocaleDateString()}</span>;
        return new Date(lead.createdAt).toLocaleDateString();
      }
    }
  ];


  const availableStatuses = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER BAR WITH VIEW SWITCHER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
            Leads Workspace
          </h1>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Manage, track, and convert sales pipeline opportunities
          </p>
        </div>

        {/* CONTROLS RIGHT SIDE */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* GROUP BY SWITCHER (Only visible in Board Mode) */}
          {viewMode === "board" && (
            <div className="flex items-center gap-2 bg-muted border border-border rounded-xl p-1 text-xs">
              <span className="text-[11px] font-bold text-foreground px-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-primary" /> Group:
              </span>
              <button
                onClick={() => setGroupBy("status")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${groupBy === "status"
                    ? "bg-card text-primary shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Status
              </button>
              <button
                onClick={() => setGroupBy("owner")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${groupBy === "owner"
                    ? "bg-card text-primary shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Salesperson
              </button>
            </div>
          )}

          {/* VIEW MODE TABS: Table vs Board */}
          <div className="flex items-center bg-muted border border-border rounded-xl p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "board"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          {/* ADD LEAD BUTTON */}
          <button
            onClick={() => navigate("/leads/new")}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* TOP KPI SUMMARY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Pipeline Value</span>
          <p className="text-xl font-black text-emerald-600">{formatCurrency(totalValue)}</p>
          <span className="text-[11px] text-muted-foreground font-semibold">{filteredLeads.length} active leads</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hot Prospects (&gt;₹50k)</span>
          <p className="text-xl font-black text-primary">{hotLeadsCount}</p>
          <span className="text-[11px] text-muted-foreground font-semibold">High revenue priority</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Lead Score</span>
          <p className="text-xl font-black text-amber-600">{avgScore} / 100</p>
          <span className="text-[11px] text-muted-foreground font-semibold">Quality index</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead Win Rate</span>
          <p className="text-xl font-black text-purple-600">
            {(leads || []).length > 0 ? Math.round(((leads || []).filter((l: any) => l.status === "Won").length / leads.length) * 100) : 0}%
          </p>
          <span className="text-[11px] text-muted-foreground font-semibold">Conversion ratio</span>
        </div>
      </div>

      {/* LEAD SOURCE ATTRIBUTION DISTRIBUTION (EMAIL, INSTAGRAM, COLD CALL, WEBSITE, FACEBOOK) */}
      <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-primary" /> Lead Source Channels:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(sourceStats).map(([src, count]) => {
            const isActive = searchQuery.toLowerCase() === src.toLowerCase();
            return (
              <button 
                key={src}
                onClick={() => setSearchQuery(isActive ? "" : src)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-muted/50 hover:bg-muted text-foreground border-border"
                }`}
              >
                <span>{src}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-foreground border border-border"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW RENDER: TABLE OR BOARD */}
      {viewMode === "table" ? (
        /* EXISTING TABLE VIEW (Kept 100% intact) */
        <StandardTable
          columns={columns}
          data={filteredLeads}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          statusOptions={[
            { value: "New", label: "New" },
            { value: "Contacted", label: "Contacted" },
            { value: "Qualified", label: "Qualified" },
            { value: "Proposal", label: "Proposal" },
            { value: "Negotiation", label: "Negotiation" },
            { value: "Won", label: "Won" },
            { value: "Lost", label: "Lost" }
          ]}
          addLabel="+ Add Lead"
          onAddClick={() => navigate("/leads/new")}
          onExport={() => window.open("/api/v1/exports/leads", "_blank")}
        />
      ) : (
        /* MONDAY.COM STYLE BOARD VIEW */
        <div className="space-y-6">
          {/* BOARD SEARCH & FILTER BAR */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-lowest border border-outline-variant p-4 rounded-2xl shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search leads, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-on-surface focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-xs font-semibold text-on-surface-variant">
                Showing <strong className="text-on-surface">{filteredLeads.length}</strong> leads
              </span>
              {statusFilter !== "all" && (
                <button
                  onClick={() => setStatusFilter("all")}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs font-bold text-on-surface-variant animate-pulse">
              Loading board leads...
            </div>
          ) : (
            /* GROUPED SECTIONS */
            <div className="space-y-6">
              {Object.entries(groupedLeads).map(([groupKey, groupItems]) => {
                const isCollapsed = collapsedGroups[groupKey];
                const groupConfig = STATUS_CONFIG[groupKey] || DEFAULT_STATUS_CONFIG;
                const groupSum = groupItems.reduce((acc, item) => acc + (Number(item.leadScore || 50) * 100), 0);

                return (
                  <div
                    key={groupKey}
                    className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden transition-all"
                    style={{ borderLeft: `6px solid ${groupConfig.bar}` }}
                  >
                    {/* GROUP HEADER */}
                    <div
                      onClick={() => toggleGroupCollapse(groupKey)}
                      className="flex items-center justify-between p-4 bg-surface-container-low/40 hover:bg-surface-container-low/80 cursor-pointer select-none border-b border-outline-variant/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-on-surface-variant hover:text-on-surface">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <h2 className="text-sm font-black text-on-surface flex items-center gap-2">
                          <span>{groupKey}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${groupConfig.bg} ${groupConfig.text} ${groupConfig.border}`}>
                            {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                          </span>
                        </h2>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
                        <span className="flex items-center gap-1 font-bold text-on-surface bg-surface px-2.5 py-1 rounded-lg border border-outline-variant/60 shadow-2xs">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{formatCurrency(groupSum)}</span>
                        </span>
                      </div>
                    </div>

                    {/* GROUP BODY (ITEMS TABLE) */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-outline-variant/60 bg-surface-container-lowest text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                              <th className="py-2.5 px-4 w-72">Lead Name</th>
                              <th className="py-2.5 px-4 w-40">Status</th>
                              <th className="py-2.5 px-4 w-44">Owner</th>
                              <th className="py-2.5 px-4 w-36 text-right">Expected Value</th>
                              <th className="py-2.5 px-4 w-32">Source</th>
                              <th className="py-2.5 px-4 w-32">Created Date</th>
                              <th className="py-2.5 px-4 w-16 text-center font-normal">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/40">
                            {groupItems.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-4 text-center text-xs text-on-surface-variant italic">
                                  No leads in this group
                                </td>
                              </tr>
                            ) : (
                              groupItems.map((lead: any) => {
                                const statusCfg = STATUS_CONFIG[lead.status] || DEFAULT_STATUS_CONFIG;
                                const ownerName = lead.assignedTo?.name || "Unassigned";
                                const isEditingStatus = editingStatusId === lead.id;
                                const isEditingOwner = editingOwnerId === lead.id;

                                return (
                                  <tr
                                    key={lead.id}
                                    className="hover:bg-surface-container-low/50 transition-colors group"
                                  >
                                    {/* 1. LEAD NAME & COMPANY (CLICKABLE) */}
                                    <td className="py-3 px-4">
                                      <Link
                                        to={`/leads/${lead.id}`}
                                        className="font-bold text-on-surface hover:text-primary transition-colors block text-xs"
                                      >
                                        {lead.firstName} {lead.lastName}
                                      </Link>
                                      <p className="text-[10px] text-on-surface-variant font-medium">
                                        {lead.company || "No Company"} • {lead.leadNumber || "N/A"}
                                      </p>
                                      <WhatsAppBadge lead={lead} />
                                    </td>

                                    {/* 2. STATUS CELL (INLINE EDITABLE MONDAY PILL) */}
                                    <td className="py-3 px-4 relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingStatusId(isEditingStatus ? null : lead.id);
                                          setEditingOwnerId(null);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} ${statusCfg.hover} transition-all flex items-center justify-between w-32 group/btn`}
                                      >
                                        <span className="truncate">{lead.status}</span>
                                        <ChevronDown className="w-3 h-3 opacity-70 group-hover/btn:opacity-100 transition-opacity ml-1" />
                                      </button>

                                      {/* STATUS INLINE DROPDOWN */}
                                      {isEditingStatus && (
                                        <div
                                          className="absolute z-30 top-12 left-4 w-40 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant px-2 py-1 border-b border-outline-variant/40">
                                            Change Status
                                          </div>
                                          {availableStatuses.map(st => {
                                            const stCfg = STATUS_CONFIG[st] || DEFAULT_STATUS_CONFIG;
                                            const isSelected = lead.status === st;
                                            return (
                                              <button
                                                key={st}
                                                onClick={() => {
                                                  updateLeadMutation.mutate({
                                                    leadId: lead.id,
                                                    payload: { status: st }
                                                  });
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors border ${stCfg.bg} ${stCfg.text} ${stCfg.border} ${stCfg.hover}`}
                                              >
                                                <span>{st}</span>
                                                {isSelected && <Check className={`w-3 h-3 ${stCfg.text}`} />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>

                                    {/* 3. OWNER CELL (INLINE EDITABLE AVATAR) */}
                                    <td className="py-3 px-4 relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingOwnerId(isEditingOwner ? null : lead.id);
                                          setEditingStatusId(null);
                                        }}
                                        className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-container border border-transparent hover:border-outline-variant/60 transition-all text-xs"
                                      >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shadow-2xs ${getAvatarColor(ownerName)}`}>
                                          {getInitials(ownerName)}
                                        </div>
                                        <span className="font-semibold text-on-surface truncate max-w-[100px]">{ownerName}</span>
                                      </button>

                                      {/* OWNER INLINE DROPDOWN */}
                                      {isEditingOwner && (
                                        <div
                                          className="absolute z-30 top-12 left-4 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant px-2 py-1 border-b border-outline-variant/40">
                                            Assign Representative
                                          </div>
                                          {salespersons?.map((sp: any) => {
                                            const isSelected = lead.assignedTo?.id === sp.id;
                                            return (
                                              <button
                                                key={sp.id}
                                                onClick={() => {
                                                  updateLeadMutation.mutate({
                                                    leadId: lead.id,
                                                    payload: { assignedToId: sp.id }
                                                  });
                                                }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-surface-container text-on-surface"
                                                  }`}
                                              >
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] ${getAvatarColor(sp.name)}`}>
                                                  {getInitials(sp.name)}
                                                </div>
                                                <span className="truncate">{sp.name}</span>
                                                {isSelected && <Check className="w-3 h-3 text-primary ml-auto" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>

                                    {/* 4. EXPECTED VALUE CELL */}
                                    <td className="py-3 px-4 text-right font-extrabold text-on-surface">
                                      {formatCurrency((lead.leadScore || 50) * 100)}
                                    </td>

                                    {/* 5. SOURCE CELL */}
                                    <td className="py-3 px-4">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/60">
                                        {lead.source || "Inbound"}
                                      </span>
                                    </td>

                                    {/* 6. DATE CELL */}
                                    <td className="py-3 px-4 text-[11px] text-on-surface-variant font-medium">
                                      {new Date(lead.createdAt).toLocaleDateString()}
                                    </td>

                                    {/* 7. ACTIONS */}
                                    <td className="py-3 px-4 text-center">
                                      <Link
                                        to={`/leads/${lead.id}`}
                                        className="text-primary font-bold hover:underline text-[11px]"
                                      >
                                        View
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>

                        {/* ADD ITEM ROW AT BOTTOM OF GROUP */}
                        <div className="p-3 bg-surface-container-low/20 border-t border-outline-variant/40 flex items-center">
                          <button
                            onClick={() => {
                              if (groupBy === "status") {
                                navigate("/leads/new", { state: { initialStatus: groupKey } });
                              } else {
                                navigate("/leads/new");
                              }
                            }}
                            className="text-xs font-bold text-on-surface-variant hover:text-primary flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-surface transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-primary" />
                            <span>+ Add item to {groupKey}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
