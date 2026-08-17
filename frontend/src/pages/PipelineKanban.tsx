import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2, XCircle, X, Clock, Calendar, CheckSquare, ChevronRight, Building2, AlertTriangle, ShieldAlert } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { useSearchParams, useNavigate } from "react-router-dom";
import { LeadBoard } from "../components/LeadBoard";
import { StageEvidenceModal } from "../components/StageEvidenceModal";

function DealMilestonesWidget({ dealId, token }: { dealId: string; token: string }) {
  const queryClient = useQueryClient();
  const [newMilestoneName, setNewMilestoneName] = useState("");

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["dealMilestones", dealId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/milestones`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!dealId && !!token
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/deals/milestones/${id}/toggle`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealMilestones", dealId] });
    }
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/v1/deals/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ dealId, name })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setNewMilestoneName("");
      queryClient.invalidateQueries({ queryKey: ["dealMilestones", dealId] });
    }
  });

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
        <span>Milestones ({milestones.filter((m: any) => m.isCompleted).length}/{milestones.length})</span>
      </div>
      <div className="space-y-1">
        {milestones.map((m: any) => (
          <div 
            key={m.id} 
            onClick={(e) => {
              e.stopPropagation();
              toggleMilestoneMutation.mutate(m.id);
            }}
            className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors text-[11px]"
          >
            <input 
              type="checkbox" 
              checked={m.isCompleted} 
              readOnly 
              className="rounded text-primary focus:ring-0 cursor-pointer w-3 h-3"
            />
            <span className={m.isCompleted ? "line-through text-muted-foreground" : "font-medium text-foreground"}>
              {m.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PipelineKanban() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ownerId = searchParams.get("ownerId");
  const queryClient = useQueryClient();


  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data: pipelineColumns, isLoading } = useQuery({
    queryKey: ["pipeline", ownerId],
    queryFn: async () => {
      const url = ownerId ? `/api/v1/pipeline?ownerId=${ownerId}` : "/api/v1/pipeline";
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    }
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const [transitionModal, setTransitionModal] = useState<{ dealId: string, toStageId: string, toStageName: string } | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ name: "", amount: "", competitors: "", probability: "" });
  const [activeDealDetail, setActiveDealDetail] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [recontactDate, setRecontactDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"leads" | "opportunities" | "deals">("opportunities");

  // Tab mapping via group field returned by the pipeline API:
  // Opportunities: any stage whose group is NOT "Closed"
  // Deals: any stage whose group is "Closed"
  const isOpenGroup = (group: string) => group !== "Closed";
  const isClosedGroup = (group: string) => group === "Closed";

  // Real Counts computation
  const leadsCount = leads?.length || 0;
  const oppsCount = pipelineColumns
    ?.filter((col: any) => isOpenGroup(col.group))
    .reduce((sum: number, col: any) => sum + (col.deals?.length || 0), 0) || 0;
  const dealsCount = pipelineColumns
    ?.filter((col: any) => isClosedGroup(col.group))
    .reduce((sum: number, col: any) => sum + (col.deals?.length || 0), 0) || 0;

  // Stage color scheme — keyed by new stage names
  const stageHeaderColors: { [key: string]: { bg: string; text: string; border: string } } = {
    "Qualification": { bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200" },
    "Needs Analysis": { bg: "bg-indigo-50/80", text: "text-indigo-900", border: "border-indigo-200" },
    "Proposal": { bg: "bg-amber-50/90", text: "text-amber-950", border: "border-amber-200" },
    "Negotiation": { bg: "bg-orange-50/90", text: "text-orange-950", border: "border-orange-200" },
    "Closed Won": { bg: "bg-emerald-50/90", text: "text-emerald-950", border: "border-emerald-200" },
    "Closed Lost": { bg: "bg-rose-50/90", text: "text-rose-950", border: "border-rose-200" },
  };
  const getStageColor = (stageName: string, group: string) =>
    stageHeaderColors[stageName] || (
      group === "Closed"
        ? { bg: "bg-slate-100/90", text: "text-slate-900", border: "border-slate-300" }
        : { bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200" }
    );

  const createDealMutation = useMutation({
    mutationFn: async (deal: any) => {
      const res = await fetch("/api/v1/pipeline/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(deal),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      setShowAddDealModal(false);
      setNewDeal({ name: "", amount: "", competitors: "", probability: "" });
    },
  });

  const [evidenceModal, setEvidenceModal] = useState<{
    isOpen: boolean;
    recordName: string;
    recordId: string;
    validation: any;
    daysInStage?: number;
    lastCustomerActivity?: string;
    pendingTargetStageId?: string;
  }>({ isOpen: false, recordName: "", recordId: "", validation: null });

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, toStageId, reason, recontactDate, forceBypass, dealObj }: any) => {
      const res = await fetch(`/api/v1/pipeline/deals/${dealId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ toStageId, reason, recontactDate, forceBypass })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.validation) {
          setEvidenceModal({
            isOpen: true,
            recordName: dealObj?.name || "Pipeline Deal",
            recordId: dealId,
            validation: data.validation,
            daysInStage: dealObj?.daysInStage || 0,
            lastCustomerActivity: dealObj?.lastActivity || "Recent",
            pendingTargetStageId: toStageId
          });
        }
        throw new Error(data.error || "Stage transition failed");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      setTransitionModal(null);
    }
  });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("dealId", dealId);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent, stageId: string, stageName: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;

    const targetDeal = allDeals.find((d: any) => d.id === dealId);

    if (stageName === "Closed Lost") {
      setTransitionModal({ dealId, toStageId: stageId, toStageName: stageName });
      setReason("");
      setRecontactDate("");
    } else {
      updateStageMutation.mutate({ dealId, toStageId: stageId, dealObj: targetDeal });
    }
  };

  const allDeals = pipelineColumns?.flatMap((col: any) => col.deals?.map((d: any) => ({ ...d, stageName: col.stage })) || []) || [];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/60 font-sans">
      
      {/* TOP NAVBAR / HEADER AREA MATCHING REFERENCE */}
      <header className="bg-white px-8 py-5 flex items-center justify-between border-b border-slate-200/80 shadow-2xs z-30">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Pipeline</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Track your sales process from lead to close</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Quick Add Button */}
          <button 
            onClick={() => setShowAddDealModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Quick Add
          </button>
        </div>
      </header>

      {/* TOP CONTROLS SECTION */}
      <section className="px-8 pt-5 pb-3 flex items-center justify-between">
        {viewMode === "kanban" ? (
          /* KANBAN BOARD: SEGMENTED TABS (Leads / Opportunities / Deals) */
          <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
            {/* 1. LEADS TAB */}
            <button
              onClick={() => setActiveTab("leads")}
              className={`px-8 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === "leads"
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Leads ({leadsCount})</span>
            </button>

            {/* 2. OPPORTUNITIES TAB */}
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`px-8 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === "opportunities"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Opportunities ({oppsCount})</span>
            </button>

            {/* 3. DEALS TAB */}
            <button
              onClick={() => setActiveTab("deals")}
              className={`px-8 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === "deals"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Deals ({dealsCount})</span>
            </button>
          </div>
        ) : (
          /* LIST VIEW: FILTER OPTIONS ON TOP */
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pipeline records..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Filter Pipeline Stage */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Pipeline Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All 8 Pipeline Stages</option>
                <option value="New">1. New</option>
                <option value="Contacted">2. Contacted</option>
                <option value="Qualification">3. Qualification</option>
                <option value="Needs Analysis">4. Needs Analysis</option>
                <option value="Proposal">5. Proposal</option>
                <option value="Negotiation">6. Negotiation</option>
                <option value="Closed Won">7. Closed Won 🟢</option>
                <option value="Closed Lost">8. Closed Lost 🔴</option>
              </select>
            </div>

            {/* Filter Verification Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Verification:</span>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Verification Statuses</option>
                <option value="VERIFIED">Verified ✓ Only</option>
                <option value="NEEDS_REVIEW">Needs Review ⚠ Only</option>
                <option value="stuck">Stuck in Stage (&gt; 14 Days)</option>
              </select>
            </div>
          </div>
        )}

        {/* View Mode Toggle (Board / List) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-200/60 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <View className="w-3.5 h-3.5" /> Board
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </section>

      {/* SHARED TOOLBAR: Action Button */}
      {viewMode === "kanban" && (
        <section className="px-8 py-2 flex items-center justify-between">
          <button 
            onClick={() => navigate("/rules")}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-2"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" /> Filter
          </button>

          {activeTab === "leads" ? (
            <button 
              onClick={() => navigate("/leads/new")}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> + Add Lead
            </button>
          ) : activeTab === "opportunities" ? (
            <button 
              onClick={() => setShowAddDealModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> + Add Opportunity
            </button>
          ) : (
            <button 
              onClick={() => setShowAddDealModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> + Record Deal
            </button>
          )}
        </section>
      )}

      {/* MAIN CONTENT AREA */}
      <section className="flex-1 overflow-auto px-8 py-4">
        {viewMode === "kanban" ? (
          /* KANBAN BOARD FOR ALL 3 TABS (LEADS, OPPORTUNITIES, DEALS) */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {activeTab === "leads" ? (
              /* LEADS KANBAN COLUMNS */
              ["New", "Contacted", "Qualified"].map((leadStage) => {
                const colorScheme = stageHeaderColors[leadStage] || {
                  bg: "bg-slate-50",
                  text: "text-slate-900",
                  border: "border-slate-200"
                };

                const filteredStageLeads = leads.filter((l: any) => {
                  const matchStage = (l.status || "New") === leadStage;
                  if (!matchStage) return false;
                  if (!searchQuery) return true;
                  const searchLower = searchQuery.toLowerCase();
                  const nameStr = `${l.firstName || ""} ${l.lastName || ""}`.toLowerCase();
                  const companyStr = (l.company || "").toLowerCase();
                  return nameStr.includes(searchLower) || companyStr.includes(searchLower);
                });

                const totalStageValue = filteredStageLeads.reduce(
                  (acc: number, l: any) => acc + Number(l.leadScore || 50) * 100,
                  0
                );

                return (
                  <div key={leadStage} className="flex flex-col gap-3 min-w-[270px]">
                    {/* Tinted Stage Header Card */}
                    <div className={`p-4 rounded-2xl border ${colorScheme.bg} ${colorScheme.border} shadow-2xs flex items-center justify-between`}>
                      <div>
                        <h3 className={`text-sm font-black ${colorScheme.text}`}>{leadStage}</h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          {filteredStageLeads.length} leads
                        </p>
                      </div>
                      <div className="text-base font-black text-slate-900 tracking-tight font-mono">
                        {formatCurrencyCompact(totalStageValue)}
                      </div>
                    </div>

                    {/* Lead Cards Stack */}
                    <div className="space-y-3 min-h-[160px] pb-6">
                      {filteredStageLeads.length === 0 ? (
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 italic bg-white/50">
                          No leads in {leadStage}
                        </div>
                      ) : (
                        filteredStageLeads.map((lead: any) => {
                          const repName = lead.assignedTo?.name || "Unassigned Rep";
                          const initials = repName
                            .split(" ")
                            .filter(Boolean)
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "UN";

                          const score = Number(lead.leadScore || 50);
                          let priorityLabel = "Warm";
                          let priorityStyle = "bg-amber-50 text-amber-700 border-amber-200";
                          if (score >= 70) {
                            priorityLabel = "Hot";
                            priorityStyle = "bg-rose-50 text-rose-700 border-rose-200";
                          } else if (score < 40) {
                            priorityLabel = "Cold";
                            priorityStyle = "bg-blue-50 text-blue-700 border-blue-200";
                          }

                          const estValue = Number(lead.leadScore || 50) * 100;

                          return (
                            <div
                              key={lead.id}
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="bg-white border border-slate-200/90 hover:border-blue-400 p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-3 group relative"
                            >
                              {/* Lead Title & Priority Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                                  {lead.company || `${lead.firstName} ${lead.lastName}`}
                                </h4>
                                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border shrink-0 ${priorityStyle}`}>
                                  {priorityLabel}
                                </span>
                              </div>

                              {/* Contact Name & Building */}
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.firstName} {lead.lastName}</span>
                              </div>

                              {/* Formatted Expected Amount */}
                              <div>
                                <span className="text-base font-black text-slate-900 tracking-tight">
                                  {formatCurrency(estValue)}
                                </span>
                              </div>

                              {/* Source & Rep Avatar */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{lead.source || "Inbound"}</span>
                                </div>

                                <div
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-black text-[9px] flex items-center justify-center shadow-2xs shrink-0"
                                  title={`Assigned Rep: ${repName}`}
                                >
                                  {initials}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* OPPORTUNITIES & DEALS KANBAN COLUMNS */
              (() => {
                const targetColumns = pipelineColumns?.filter((col: any) =>
                  activeTab === "opportunities" ? isOpenGroup(col.group) : isClosedGroup(col.group)
                ) || [];

                return targetColumns.map((stageCol: any) => {
                  const colorScheme = getStageColor(stageCol.stage, stageCol.group);

                  const filteredDeals = (stageCol.deals || []).filter((d: any) => {
                    if (!searchQuery) return true;
                    const searchLower = searchQuery.toLowerCase();
                    const nameStr = (d.name || "").toLowerCase();
                    const companyStr = (d.company || "").toLowerCase();
                    return nameStr.includes(searchLower) || companyStr.includes(searchLower);
                  });

                  return (
                    <div 
                      key={stageCol.id} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, stageCol.id, stageCol.stage)}
                      className="flex flex-col gap-3 min-w-[270px]"
                    >
                      {/* Tinted Stage Header Card */}
                      <div className={`p-4 rounded-2xl border ${colorScheme.bg} ${colorScheme.border} shadow-2xs flex items-center justify-between`}>
                        <div>
                          <h3 className={`text-sm font-black ${colorScheme.text}`}>{stageCol.stage}</h3>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            {filteredDeals.length} {activeTab === "opportunities" ? "opportunities" : "deals"}
                          </p>
                        </div>
                        <div className="text-base font-black text-slate-900 tracking-tight font-mono">
                          {formatCurrencyCompact(stageCol.totalValue)}
                        </div>
                      </div>

                      {/* Stage Deal Cards Stack */}
                      <div className="space-y-3 min-h-[160px] pb-6">
                        {filteredDeals.length === 0 ? (
                          <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 italic bg-white/50">
                            Drag deals here to assign to {stageCol.stage}
                          </div>
                        ) : (
                          filteredDeals.map((deal: any) => {
                            const repName = deal.owner?.name || deal.ownerName || "Unassigned Rep";
                            const initials = repName
                              .split(" ")
                              .filter(Boolean)
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "U";

                            return (
                              <div 
                                key={deal.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                onClick={() => {
                                  if (deal.leadId) {
                                    navigate(`/leads/${deal.leadId}`);
                                  } else {
                                    navigate(`/leads/${deal.id}`);
                                  }
                                }}
                                className="bg-white border border-slate-200/90 hover:border-blue-400 p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-3 group relative"
                              >
                                {/* Deal Title & Stage Badge */}
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                                    {deal.name}
                                  </h4>
                                  {stageCol.stage === "Won" ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-md shrink-0 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Won
                                    </span>
                                  ) : stageCol.stage === "Lost" ? (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold rounded-md shrink-0 flex items-center gap-1">
                                      <XCircle className="w-3 h-3 text-rose-600" /> Lost
                                    </span>
                                  ) : deal.probability != null ? (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold rounded-full border border-slate-200 shrink-0">
                                      {deal.probability}%
                                    </span>
                                  ) : null}
                                </div>

                                {/* Company / Client Name */}
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{deal.company || deal.name}</span>
                                </div>

                                {/* Formatted Amount */}
                                <div>
                                  <span className="text-base font-black text-slate-900 tracking-tight">
                                    {formatCurrency(deal.value)}
                                  </span>
                                </div>

                                {/* Close Date & Rep Avatar */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Closed: {deal.lastActivity || "Mar 30"}</span>
                                  </div>

                                  <div 
                                    className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-black text-[9px] flex items-center justify-center shadow-2xs shrink-0"
                                    title={`Assigned Rep: ${repName}`}
                                  >
                                    {initials}
                                  </div>
                                </div>

                                {/* Tag / Competitor Badge */}
                                {deal.competitors && (
                                  <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                                    {stageCol.stage === "Won" ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> {deal.competitors}
                                      </span>
                                    ) : stageCol.stage === "Lost" ? (
                                      <span className="text-rose-600 font-bold flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> {deal.competitors}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                                        {deal.competitors}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Milestone Checklist Component */}
                                <DealMilestonesWidget dealId={deal.id} token={token || ""} />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        ) : (
          /* STRUCTURED UNIFIED LIST VIEW TABLE FOR PIPELINE */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left divide-y divide-slate-100 text-xs">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Record / Client Name</th>
                    <th className="py-3.5 px-4">Company</th>
                    <th className="py-3.5 px-4">Stage / Status</th>
                    <th className="py-3.5 px-4">Pipeline Value</th>
                    <th className="py-3.5 px-4">Assigned Rep</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(() => {
                    const allPipelineItems = [
                      ...leads.map((l: any) => ({
                        id: l.id,
                        name: `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.company || "Lead",
                        company: l.company || "—",
                        stageName: l.status || "New",
                        value: Number(l.leadScore || 50) * 100,
                        ownerName: l.assignedTo?.name || "Unassigned",
                        verificationStatus: "VERIFIED",
                        daysInStage: 2,
                        stageEvidence: [],
                        lastActivity: "Recent",
                        type: "lead"
                      })),
                      ...(pipelineColumns || []).flatMap((col: any) =>
                        (col.deals || []).map((d: any) => ({
                          id: d.id,
                          leadId: d.leadId,
                          name: d.name,
                          company: d.company || d.name,
                          stageName: col.stage,
                          value: d.value,
                          ownerName: d.owner?.name || d.ownerName || "Unassigned",
                          verificationStatus: d.verificationStatus || "VERIFIED",
                          daysInStage: d.daysInStage || 0,
                          stageEvidence: d.stageEvidence || [],
                          lastActivity: d.lastActivity || "Recent",
                          type: "deal"
                        }))
                      )
                    ].filter((item: any) => {
                      const matchesStage = stageFilter === "all" || item.stageName === stageFilter;
                      if (!matchesStage) return false;

                      const matchesVerification = verificationFilter === "all" || (
                        verificationFilter === "stuck"
                          ? item.daysInStage > 14
                          : item.verificationStatus === verificationFilter
                      );
                      if (!matchesVerification) return false;

                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (item.name || "").toLowerCase().includes(q) || (item.company || "").toLowerCase().includes(q) || (item.stageName || "").toLowerCase().includes(q);
                    });

                    if (allPipelineItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                            No records found matching search and verification criteria.
                          </td>
                        </tr>
                      );
                    }

                    return allPipelineItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => navigate(item.leadId ? `/leads/${item.leadId}` : `/leads/${item.id}`)}
                            className="font-black text-slate-900 hover:text-blue-600 text-left block"
                          >
                            {item.name}
                          </button>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.daysInStage} days in stage
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">{item.company}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full border ${
                              item.stageName === "Closed Won" || item.stageName === "Won"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.stageName === "Closed Lost" || item.stageName === "Lost"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {item.stageName}
                            </span>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEvidenceModal({
                                  isOpen: true,
                                  recordName: item.name,
                                  recordId: item.id,
                                  validation: {
                                    allowed: item.verificationStatus === "VERIFIED",
                                    fromStage: item.stageName,
                                    toStage: item.stageName,
                                    missingRequirements: item.verificationStatus === "VERIFIED" ? [] : ["Stage entry criteria pending customer-side evidence."],
                                    evidence: item.stageEvidence || [],
                                    verificationStatus: item.verificationStatus || "VERIFIED"
                                  },
                                  daysInStage: item.daysInStage || 0,
                                  lastCustomerActivity: item.lastActivity || "Recent"
                                });
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition-all cursor-pointer ${
                                item.verificationStatus === "VERIFIED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                              }`}
                            >
                              {item.verificationStatus === "VERIFIED" ? "Verified ✓" : "Needs Review ⚠"}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900">{formatCurrency(item.value)}</td>
                        <td className="py-3.5 px-4 text-slate-600">{item.ownerName}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => navigate(item.leadId ? `/leads/${item.leadId}` : `/leads/${item.id}`)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition-all cursor-pointer"
                          >
                            View Record
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* CREATE DEAL MODAL */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-black text-foreground">Create New Deal</h3>
              <button onClick={() => setShowAddDealModal(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Deal Title</label>
                <input 
                  type="text" 
                  value={newDeal.name}
                  onChange={e => setNewDeal({ ...newDeal, name: e.target.value })}
                  placeholder="e.g. Enterprise Software Supply Agreement"
                  className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Deal Value ($)</label>
                <input 
                  type="number" 
                  value={newDeal.amount}
                  onChange={e => setNewDeal({ ...newDeal, amount: e.target.value })}
                  placeholder="e.g. 75000"
                  className="w-full bg-muted border border-border rounded-lg p-2 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-border">
              <button onClick={() => setShowAddDealModal(false)} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg">Cancel</button>
              <button 
                onClick={() => {
                  if (!newDeal.name || !newDeal.amount) return alert("Title and amount are required.");
                  createDealMutation.mutate({ name: newDeal.name, amount: Number(newDeal.amount) });
                }}
                className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-2xs"
              >
                Create Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Modal */}
      {transitionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[400px] max-w-full shadow-2xl relative">
            <button 
              onClick={() => setTransitionModal(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-on-surface mb-2">Stage Change Details</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Moving deal to <span className="font-bold text-primary">{transitionModal.toStageName}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Reason / Notes *</label>
                <textarea 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Why is this deal ${transitionModal.toStageName.toLowerCase()}?`}
                  className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-lg text-xs outline-none focus:border-primary"
                  rows={3}
                />
              </div>

              {transitionModal.toStageName === "On Hold" && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Re-contact Date *</label>
                  <input 
                    type="date"
                    value={recontactDate}
                    onChange={(e) => setRecontactDate(e.target.value)}
                    className="w-full p-2.5 bg-surface-container border border-outline-variant rounded-lg text-xs outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setTransitionModal(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => updateStageMutation.mutate({ 
                    dealId: transitionModal.dealId, 
                    toStageId: transitionModal.toStageId,
                    reason,
                    recontactDate
                  })}
                  disabled={updateStageMutation.isPending || !reason || (transitionModal.toStageName === "On Hold" && !recontactDate)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Confirm Stage Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE DEAL DETAIL MODAL */}
      {activeDealDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{activeDealDetail.name}</h3>
                <p className="text-xs text-slate-500 font-semibold">{activeDealDetail.company || "Enterprise Account"}</p>
              </div>
              <button onClick={() => setActiveDealDetail(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Deal Value</span>
                <strong className="text-emerald-600 font-black text-sm">{formatCurrency(activeDealDetail.value)}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Probability</span>
                <strong className="text-blue-600 font-black text-sm">{activeDealDetail.probability || 80}%</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Assigned Rep</span>
                <strong className="text-slate-800 font-bold">{activeDealDetail.owner?.name || "Rahul Verma"}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Competitor / Tag</span>
                <strong className="text-slate-800 font-bold">{activeDealDetail.competitors || "Standard SLA"}</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-100">
              <button
                onClick={() => {
                  const leadId = activeDealDetail.leadId || activeDealDetail.id;
                  navigate(`/queue?selectedId=${leadId}`);
                }}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
              >
                <span>Open Dedicated Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setActiveDealDetail(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE EVIDENCE VERIFICATION MODAL */}
      <StageEvidenceModal
        isOpen={evidenceModal.isOpen}
        onClose={() => setEvidenceModal((prev) => ({ ...prev, isOpen: false }))}
        recordName={evidenceModal.recordName}
        recordId={evidenceModal.recordId}
        validation={evidenceModal.validation}
        daysInStage={evidenceModal.daysInStage}
        lastCustomerActivity={evidenceModal.lastCustomerActivity}
        onForceBypass={() => {
          if (evidenceModal.recordId && evidenceModal.pendingTargetStageId) {
            updateStageMutation.mutate({
              dealId: evidenceModal.recordId,
              toStageId: evidenceModal.pendingTargetStageId,
              forceBypass: true
            });
            setEvidenceModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      />
    </div>
  );
}
