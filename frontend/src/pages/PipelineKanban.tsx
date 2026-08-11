import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import {
  Search, Plus, Download, MoreHorizontal, Mail, Phone,
  MessageSquare, Calendar, CheckSquare, Sparkles, ExternalLink,
  ChevronLeft, ChevronRight, ChevronDown, X, Filter, UserPlus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// STAGE STYLING & DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = [
  "All",
  "New",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost"
] as const;

const EDITABLE_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost"
] as const;

const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  new:         { bg: "bg-slate-100",    text: "text-slate-700",  border: "border-slate-200" },
  contacted:   { bg: "bg-blue-50",      text: "text-blue-700",   border: "border-blue-200" },
  qualified:   { bg: "bg-indigo-50",    text: "text-indigo-700", border: "border-indigo-200" },
  meeting:     { bg: "bg-violet-50",    text: "text-violet-700", border: "border-violet-200" },
  proposal:    { bg: "bg-amber-50",     text: "text-amber-700",  border: "border-amber-200" },
  negotiation: { bg: "bg-orange-50",    text: "text-orange-700", border: "border-orange-200" },
  won:         { bg: "bg-emerald-50",   text: "text-emerald-700",border: "border-emerald-200" },
  "closed won":{ bg: "bg-emerald-50",   text: "text-emerald-700",border: "border-emerald-200" },
  lost:        { bg: "bg-rose-50",      text: "text-rose-700",   border: "border-rose-200" },
  "closed lost":{ bg: "bg-rose-50",     text: "text-rose-700",   border: "border-rose-200" },
};

function getStageBadgeStyle(status: string) {
  const key = (status || "new").toLowerCase();
  return STAGE_STYLES[key] || STAGE_STYLES.new;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE STAGE BADGE WITH DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

function EditableStageBadge({
  lead,
  onUpdateStage
}: {
  lead: any;
  onUpdateStage: (id: string, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const style = getStageBadgeStyle(lead.status);
  const currentStage = lead.status || "New";

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold border ${style.bg} ${style.text} ${style.border} hover:opacity-85 transition-all shadow-2xs`}
        title="Click to change stage"
      >
        <span>{currentStage}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-40 py-1 text-xs">
          <div className="px-3 py-1 text-[10px] font-extrabold uppercase text-slate-400 border-b border-slate-100">
            Change Stage
          </div>
          {EDITABLE_STAGES.map((st) => {
            const isSelected = currentStage.toLowerCase() === st.toLowerCase();
            return (
              <button
                key={st}
                onClick={() => {
                  onUpdateStage(String(lead.id), st);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center justify-between transition-colors ${
                  isSelected ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700"
                }`}
              >
                <span>{st}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW ACTION MENU ([ Call ] [ ⋯ ])
// ─────────────────────────────────────────────────────────────────────────────

function RowActionMenu({
  lead,
  onNavigate,
  onUpdateStage,
  onAssignOwner
}: {
  lead: any;
  onNavigate: (path: string) => void;
  onUpdateStage: (id: string, st: string) => void;
  onAssignOwner: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showStageSubmenu, setShowStageSubmenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
    setShowStageSubmenu(false);
  });

  return (
    <div ref={ref} className="relative flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => alert(`Initiating call to ${lead.phone || lead.firstName || "Customer"}...`)}
        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors flex items-center gap-1"
        title="Call contact"
      >
        <Phone className="w-3 h-3 text-emerald-600" />
        Call
      </button>

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        title="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-48 py-1 text-xs text-slate-700">
          <button
            onClick={() => { onNavigate(`/leads/${lead.id}`); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-bold flex items-center gap-2 text-slate-900"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" /> Open Lead
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowStageSubmenu((prev) => !prev)}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> Change Stage
              </span>
              <span className="text-[10px] text-slate-400">▸</span>
            </button>

            {showStageSubmenu && (
              <div className="absolute right-full top-0 mr-1 bg-white border border-slate-200 rounded-lg shadow-xl w-36 py-1 z-50">
                {EDITABLE_STAGES.map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onUpdateStage(String(lead.id), st);
                      setOpen(false);
                      setShowStageSubmenu(false);
                    }}
                    className="w-full text-left px-3 py-1 hover:bg-slate-50 font-medium text-slate-700"
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { onAssignOwner(String(lead.id)); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" /> Assign Owner
          </button>

          <button
            onClick={() => { alert(`Logging call for ${lead.company || lead.firstName}...`); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" /> Log Call
          </button>

          <button
            onClick={() => { alert(`Opening email composer for ${lead.email || "lead"}...`); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <Mail className="w-3.5 h-3.5 text-purple-600" /> Send Email
          </button>

          <button
            onClick={() => { alert(`Creating task for lead ${lead.id}...`); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> Create Task
          </button>

          <button
            onClick={() => { onNavigate(`/quotes/new?leadId=${lead.id}`); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Generate Quote
          </button>

          <div className="h-px bg-slate-100 my-1" />

          <button
            onClick={() => { onUpdateStage(String(lead.id), "Won"); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-bold"
          >
            Mark Won
          </button>

          <button
            onClick={() => { onUpdateStage(String(lead.id), "Lost"); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-700 font-bold"
          >
            Mark Lost
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SALES PIPELINE LIST VIEW PAGE (LIST VIEW ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export default function PipelineKanban() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [activeStageTab, setActiveStageTab] = useState<string>("All");
  const [search, setSearch]                 = useState("");
  const [stageFilter, setStageFilter]       = useState("all");
  const [ownerFilter, setOwnerFilter]       = useState("all");
  const [sourceFilter, setSourceFilter]     = useState("all");
  const [valueSort, setValueSort]           = useState("default");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  // Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Queries
  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/leads");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 12000,
  });

  const { data: salespersons = [] } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/salespersons");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  // Stage Mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const res = await apiClient(`/api/v1/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  // Dynamic stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: leads.length,
      New: 0, Contacted: 0, Qualified: 0, Meeting: 0,
      Proposal: 0, Negotiation: 0, Won: 0, Lost: 0
    };

    leads.forEach((l: any) => {
      const st = (l.status || "new").toLowerCase();
      if (st === "new") counts.New++;
      else if (st === "contacted") counts.Contacted++;
      else if (st === "qualified") counts.Qualified++;
      else if (st === "meeting") counts.Meeting++;
      else if (st === "proposal") counts.Proposal++;
      else if (st === "negotiation") counts.Negotiation++;
      else if (st === "won" || st === "closed won") counts.Won++;
      else if (st === "lost" || st === "closed lost") counts.Lost++;
    });

    return counts;
  }, [leads]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let val = 0;
    let meetings = 0;
    let proposals = 0;
    let negotiations = 0;

    leads.forEach((l: any) => {
      val += l.expectedValue ? Number(l.expectedValue) : 0;
      const st = (l.status || "").toLowerCase();
      if (st === "meeting") meetings++;
      if (st === "proposal") proposals++;
      if (st === "negotiation") negotiations++;
    });

    return {
      total: leads.length,
      pipelineValue: val,
      meetings,
      proposals,
      negotiations
    };
  }, [leads]);

  // Lead Sources
  const leadSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l: any) => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list = leads.filter((l: any) => {
      const st = (l.status || "new").toLowerCase();

      if (activeStageTab !== "All") {
        if (activeStageTab === "Won") {
          if (st !== "won" && st !== "closed won") return false;
        } else if (activeStageTab === "Lost") {
          if (st !== "lost" && st !== "closed lost") return false;
        } else if (st !== activeStageTab.toLowerCase()) {
          return false;
        }
      }

      if (stageFilter !== "all") {
        if (stageFilter === "won") {
          if (st !== "won" && st !== "closed won") return false;
        } else if (stageFilter === "lost") {
          if (st !== "lost" && st !== "closed lost") return false;
        } else if (st !== stageFilter.toLowerCase()) {
          return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${l.firstName || ""} ${l.lastName || ""}`.toLowerCase();
        const company = (l.company || "").toLowerCase();
        const email = (l.email || "").toLowerCase();
        const phone = (l.phone || "").toLowerCase();
        if (!name.includes(q) && !company.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      if (ownerFilter !== "all") {
        if (ownerFilter === "unassigned") {
          if (l.assignedToId || l.assignedTo?.id) return false;
        } else if (String(l.assignedToId || l.assignedTo?.id) !== ownerFilter) {
          return false;
        }
      }

      if (sourceFilter !== "all" && (l.source || "") !== sourceFilter) {
        return false;
      }

      return true;
    });

    if (valueSort === "high") {
      list = [...list].sort((a, b) => (Number(b.expectedValue) || 0) - (Number(a.expectedValue) || 0));
    } else if (valueSort === "low") {
      list = [...list].sort((a, b) => (Number(a.expectedValue) || 0) - (Number(b.expectedValue) || 0));
    }

    return list;
  }, [leads, activeStageTab, stageFilter, search, ownerFilter, sourceFilter, valueSort]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / perPage));
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredLeads.slice(start, start + perPage);
  }, [filteredLeads, page, perPage]);

  const isAllSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.has(String(l.id)));

  const handleToggleAll = () => {
    const next = new Set(selectedLeadIds);
    if (isAllSelected) {
      paginatedLeads.forEach((l) => next.delete(String(l.id)));
    } else {
      paginatedLeads.forEach((l) => next.add(String(l.id)));
    }
    setSelectedLeadIds(next);
  };

  const handleToggleOne = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Company", "Contact", "Stage", "Owner", "Source", "Value", "CreatedAt"];
    const rows = filteredLeads.map((l) => [
      l.id,
      `"${l.company || ""}"`,
      `"${l.firstName || ""} ${l.lastName || ""}"`,
      l.status || "New",
      `"${l.assignedTo?.name || "Unassigned"}"`,
      l.source || "",
      l.expectedValue || 0,
      l.createdAt || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sales_pipeline_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-6 space-y-3">
      
      {/* ─── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Sales Pipeline</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track and manage leads, opportunities and deals from one place.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-600 shadow-2xs"
            />
          </div>

          <button
            onClick={() => navigate("/leads/new")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-2xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            + New Opportunity
          </button>
        </div>
      </div>

      {/* ─── 2. COMPACT SUMMARY LINE ────────────────────────────────────────── */}
      <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-slate-900">{metrics.total} total leads</span>
          <span className="text-slate-300">·</span>
          <span className="font-black text-emerald-700">SAR {(metrics.pipelineValue / 1000000).toFixed(2)}M pipeline</span>
          <span className="text-slate-300">·</span>
          <span>{metrics.meetings} meetings</span>
          <span className="text-slate-300">·</span>
          <span>{metrics.proposals} proposals</span>
          <span className="text-slate-300">·</span>
          <span>{metrics.negotiations} negotiations</span>
        </div>
      </div>

      {/* ─── 3. PIPELINE STAGE FILTER BAR (COMPACT TABS) ────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {STAGES.map((st) => {
          const isSelected = activeStageTab === st;
          const count = stageCounts[st] ?? 0;
          return (
            <button
              key={st}
              onClick={() => {
                setActiveStageTab(st);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 flex items-center gap-2 border font-bold ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600 font-extrabold shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{st}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── 4. SINGLE FILTER CONTROL TOOLBAR ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads, companies, contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
          >
            <option value="all">Stage: All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="meeting">Meeting</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
          >
            <option value="all">Owner: All</option>
            <option value="unassigned">Unassigned</option>
            {salespersons.map((s: any) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
          >
            <option value="all">Source: All</option>
            {leadSources.map((src) => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>

          <select
            value={valueSort}
            onChange={(e) => setValueSort(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
          >
            <option value="default">Value: Default</option>
            <option value="high">Value: High to Low</option>
            <option value="low">Value: Low to High</option>
          </select>

          <button
            onClick={() => setMoreFiltersOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${
              moreFiltersOpen ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            More Filters
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {moreFiltersOpen && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="font-extrabold text-slate-800">Advanced Pipeline Filters</span>
            <button onClick={() => setMoreFiltersOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date Created</label>
              <input type="date" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Expected Close</label>
              <input type="date" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Min Value (SAR)</label>
              <input type="number" placeholder="e.g. 50000" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
            </div>
          </div>
        </div>
      )}

      {selectedLeadIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between text-xs font-bold text-blue-900 shadow-2xs">
          <span>{selectedLeadIds.size} record(s) selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => alert("Reassigning selected leads...")} className="px-3 py-1 bg-white border border-blue-200 rounded text-xs font-bold hover:bg-blue-100">
              Assign Owner
            </button>
            <button onClick={() => alert("Changing stage for selected leads...")} className="px-3 py-1 bg-white border border-blue-200 rounded text-xs font-bold hover:bg-blue-100">
              Change Stage
            </button>
            <button onClick={() => setSelectedLeadIds(new Set())} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ─── 5. FULL-WIDTH ENTERPRISE CRM TABLE (LIST VIEW ONLY) ───────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleAll}
                    className="rounded border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="p-3.5 min-w-[220px]">Lead / Company</th>
                <th className="p-3.5 w-36">Stage</th>
                <th className="p-3.5 min-w-[140px]">Owner</th>
                <th className="p-3.5 w-28">Source</th>
                <th className="p-3.5 w-32 text-right">Value</th>
                <th className="p-3.5 min-w-[140px]">Last Activity</th>
                <th className="p-3.5 min-w-[150px]">Next Action</th>
                <th className="p-3.5 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                    Loading pipeline records...
                  </td>
                </tr>
              ) : paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                    No leads match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead: any) => {
                  const isSelected = selectedLeadIds.has(String(lead.id));
                  const ownerName = lead.assignedTo?.name || "Unassigned";
                  const leadVal = lead.expectedValue ? Number(lead.expectedValue) : null;
                  const timeAgo = lead.createdAt
                    ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })
                    : "Recently";

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleOne(String(lead.id))}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>

                      <td className="p-3.5">
                        <span className="font-extrabold text-slate-900 block hover:text-blue-600 transition-colors">
                          {lead.company || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Lead #" + lead.id}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                          {lead.firstName || ""} {lead.lastName || ""}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <EditableStageBadge
                          lead={lead}
                          onUpdateStage={(id, st) => updateStageMutation.mutate({ leadId: id, newStatus: st })}
                        />
                      </td>

                      <td className="p-3.5 text-slate-700 font-semibold">
                        {ownerName}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10.5px] font-bold rounded">
                          {lead.source || "Web Form"}
                        </span>
                      </td>

                      <td className="p-3.5 text-right font-black text-emerald-700">
                        {leadVal ? `SAR ${leadVal.toLocaleString()}` : "—"}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-slate-800 block text-[11px]">
                          {lead.notes ? (lead.notes.slice(0, 24) + (lead.notes.length > 24 ? "…" : "")) : "Created Lead"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {timeAgo}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10.5px] font-extrabold rounded border border-amber-200 block w-fit">
                          Follow up today
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <RowActionMenu
                          lead={lead}
                          onNavigate={navigate}
                          onUpdateStage={(id, st) => updateStageMutation.mutate({ leadId: id, newStatus: st })}
                          onAssignOwner={(id) => alert(`Assigning owner for lead ${id}...`)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 6. PAGINATION FOOTER ────────────────────────────────────────────── */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <div>
            Showing <strong>{filteredLeads.length > 0 ? (page - 1) * perPage + 1 : 0}</strong>–
            <strong>{Math.min(page * perPage, filteredLeads.length)}</strong> of <strong>{filteredLeads.length}</strong>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
