import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { StandardTable } from "../components/StandardTable";
import { LeadBoard } from "../components/LeadBoard";
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
  MessageCircle,
  Phone,
  Users
} from "lucide-react";
import { RelatedInquiriesModal } from "../components/RelatedInquiriesModal";

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


/** Temperature Badge */
function TemperatureBadge({ temperature }: { temperature?: string }) {
  if (!temperature) return null;
  const config: Record<string, { bg: string, text: string, icon: string }> = {
    Hot: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "🔥" },
    Warm: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "🟡" },
    Cold: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: "🧊" }
  };
  const cfg = config[temperature] || config["Warm"];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] font-bold ${cfg.bg} ${cfg.text} shadow-2xs`}>
      {cfg.icon} {temperature}
    </span>
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

  // View state: Table is now default
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [groupBy, setGroupBy] = useState<"status" | "owner">("status");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState("all");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [isViewPopoverOpen, setIsViewPopoverOpen] = useState(false);
  const [relatedInquiriesLead, setRelatedInquiriesLead] = useState<any>(null);

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
      const channelStr = (lead.communicationChannel || "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const cf = channelFilter.toLowerCase();

      // Check channel filter first if active
      if (cf) {
        const hasWaContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("whatsapp"));
        const hasEmailContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("email"));
        const hasIgContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("instagram") || c.sourceChannel?.toLowerCase().includes("ig"));
        const hasWebContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("web") || c.sourceChannel?.toLowerCase().includes("site"));
        const hasColdContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("cold"));
        const hasFbContact = lead.contacts?.some((c: any) => c.sourceChannel?.toLowerCase().includes("fb") || c.sourceChannel?.toLowerCase().includes("facebook"));

        if (cf === "whatsapp") {
          const isWa = sourceStr.includes("whatsapp") || channelStr.includes("whatsapp") || (lead.unreadWhatsappCount || 0) > 0 || !!lead.lastWhatsappAt || hasWaContact;
          if (!isWa) return false;
        } else if (cf === "email") {
          if (!sourceStr.includes("email") && !channelStr.includes("email") && !hasEmailContact) return false;
        } else if (cf === "instagram") {
          if (!sourceStr.includes("instagram") && !sourceStr.includes("ig") && !channelStr.includes("instagram") && !hasIgContact) return false;
        } else if (cf === "website") {
          if (!sourceStr.includes("web") && !sourceStr.includes("site") && !channelStr.includes("website") && !hasWebContact) return false;
        } else if (cf === "cold call") {
          if (!sourceStr.includes("cold") && !hasColdContact) return false;
        } else if (cf === "facebook") {
          if (!sourceStr.includes("fb") && !sourceStr.includes("facebook") && !hasFbContact) return false;
        }
      }

      // If search box has 'whatsapp' (e.g. from user typing), match any WhatsApp lead
      if (q === "whatsapp") {
        return sourceStr.includes("whatsapp") || channelStr.includes("whatsapp") || (lead.unreadWhatsappCount || 0) > 0 || !!lead.lastWhatsappAt;
      }

      const matchesSearch =
        !q || q === cf ||
        numberStr.toLowerCase().includes(q) ||
        nameStr.includes(q) ||
        companyStr.includes(q) ||
        sourceStr.includes(q) ||
        channelStr.includes(q);

      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesTemp = temperatureFilter === "all" || lead.temperature === temperatureFilter;
      return matchesSearch && matchesStatus && matchesTemp;
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
  }, [leads, searchQuery, channelFilter, statusFilter, temperatureFilter]);

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
      const hasWa = (l.unreadWhatsappCount || 0) > 0 || !!l.lastWhatsappAt;

      if (src.includes("whatsapp") || channel === "whatsapp" || hasWa) counts["WhatsApp"]++;
      else if (src.includes("email") || channel === "email") counts["Email"]++;
      else if (src.includes("ig") || src.includes("instagram") || channel === "instagram") counts["Instagram"]++;
      else if (src.includes("cold")) counts["Cold Call"]++;
      else if (src.includes("web") || src.includes("site") || channel === "website") counts["Website"]++;
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
  const allColumns = [
    {
      key: "name",
      header: "Client Name",
      render: (lead: any) => (
        <div>
          <span className="font-bold text-foreground hover:text-primary transition-colors">
            {lead.firstName} {lead.lastName}
          </span>
          <p className="text-[10px] text-muted-foreground mb-1">{lead.company || "No Company"}</p>
          <div className="flex items-center gap-2">
            <TemperatureBadge temperature={lead.temperature} />
            <WhatsAppBadge lead={lead} />
            {lead.contacts && lead.contacts.length > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setRelatedInquiriesLead(lead); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 border border-border rounded text-[10px] font-bold text-muted-foreground hover:bg-muted transition-colors shadow-2xs"
              >
                <Users className="w-2.5 h-2.5" />
                +{lead.contacts.length} more
              </button>
            )}
          </div>
        </div>
      )
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
      key: "leadNumber",
      header: "Lead #",
      render: (lead: any) => (
        <span className="text-primary font-bold">
          {lead.leadNumber || "N/A"}
        </span>
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
      key: "createdAt",
      header: "Last Contact Date",
      render: (lead: any) => {
        const wa = lead.lastWhatsappAt;
        if (wa) return <span className="text-emerald-700 font-semibold">{new Date(wa).toLocaleDateString()}</span>;
        return new Date(lead.createdAt).toLocaleDateString();
      }
    }
  ];

  const columns = showAllColumns ? allColumns : allColumns.slice(0, 4);


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
          {/* CONSOLIDATED SINGLE "VIEW" CONTROL DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setIsViewPopoverOpen(!isViewPopoverOpen)}
              className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border text-foreground px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>{viewMode === "table" ? "Table View" : `Board (${groupBy === "status" ? "Status" : "Owner"})`}</span>
              {statusFilter !== "all" && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {isViewPopoverOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-50 p-3 space-y-3 animate-scale-up text-xs">
                {/* View Mode Toggle */}
                <div>
                  <label className="block font-bold text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">View Layout</label>
                  <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition-all ${
                        viewMode === "table" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" /> Table
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition-all ${
                        viewMode === "board" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Kanban className="w-3.5 h-3.5" /> Board
                    </button>
                  </div>
                </div>

                {/* Group By (in Board Mode) */}
                {viewMode === "board" && (
                  <div>
                    <label className="block font-bold text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">Group Cards By</label>
                    <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-xl">
                      <button
                        onClick={() => setGroupBy("status")}
                        className={`py-1.5 rounded-lg font-bold transition-all ${
                          groupBy === "status" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Status
                      </button>
                      <button
                        onClick={() => setGroupBy("owner")}
                        className={`py-1.5 rounded-lg font-bold transition-all ${
                          groupBy === "owner" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Owner
                      </button>
                    </div>
                  </div>
                )}

                {/* TEMPERATURE FILTER */}
                <div>
                  <label className="block font-bold text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">Filter Temperature</label>
                  <select
                    value={temperatureFilter}
                    onChange={(e) => setTemperatureFilter(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
                  >
                    <option value="all">All Temperatures</option>
                    <option value="Hot">🔥 Hot</option>
                    <option value="Warm">🟡 Warm</option>
                    <option value="Cold">🧊 Cold</option>
                  </select>
                </div>

                {/* Filter By Status */}
                <div>
                  <label className="block font-bold text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">Filter Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    {availableStatuses.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Table Columns Density Toggle (Table Mode) */}
          {viewMode === "table" && (
            <button
              onClick={() => setShowAllColumns(!showAllColumns)}
              className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold px-3 py-2 rounded-xl transition-all"
              title="Toggle additional columns"
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>{showAllColumns ? "Compact Columns" : "All Columns"}</span>
            </button>
          )}

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
            {(leads || []).length > 0 ? Math.round(((leads || []).filter((l: any) => l.status === "Won").length / (leads || []).length) * 100) : 0}%
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
            const isActive = channelFilter.toLowerCase() === src.toLowerCase() || (searchQuery.toLowerCase() === src.toLowerCase() && !channelFilter);
            return (
              <button 
                key={src}
                onClick={() => {
                  if (isActive) {
                    setChannelFilter("");
                    setSearchQuery("");
                  } else {
                    setChannelFilter(src);
                    setSearchQuery(src);
                  }
                }}
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
          onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
          quickActionIcon={Phone}
          quickActionLabel="Call"
          onQuickAction={(lead) => navigate(`/leads/${lead.id}?action=log_call`)}
        />
      ) : (
        /* SHARED LEAD BOARD VIEW (Used on LeadInbox and Sales Pipeline Leads tab) */
        <LeadBoard searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      )}

      {/* Related Inquiries Modal */}
      <RelatedInquiriesModal
        isOpen={!!relatedInquiriesLead}
        onClose={() => setRelatedInquiriesLead(null)}
        lead={relatedInquiriesLead}
      />
    </div>
  );
}
