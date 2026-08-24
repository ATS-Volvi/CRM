import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2, XCircle, X, Clock, Calendar, CheckSquare, ChevronRight, Building2, AlertTriangle, ShieldAlert, Target, User } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { useSearchParams, useNavigate } from "react-router-dom";
import { StageEvidenceModal } from "../components/StageEvidenceModal";
import { usePipelineStages, getStageBadgeClass, getStageHeaderColor, normalizeStageName } from "../utils/pipelineStages";

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
  const { data: pipelineStages = [] } = usePipelineStages();

  const { data: pipelineColumns = [], isLoading } = useQuery({
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

  const [transitionModal, setTransitionModal] = useState<{ dealId: string, toStageId: string, toStageName: string } | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ name: "", amount: "", competitors: "", probability: "", stageId: "" });
  const [activeDealDetail, setActiveDealDetail] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [recontactDate, setRecontactDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

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
      queryClient.invalidateQueries({ queryKey: ["opportunities-list"] });
      setShowAddDealModal(false);
      setNewDeal({ name: "", amount: "", competitors: "", probability: "", stageId: "" });
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
      queryClient.invalidateQueries({ queryKey: ["opportunities-list"] });
      setTransitionModal(null);
    }
  });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("dealId", dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toStageId: string, toStageName: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;

    if (toStageName === "Lost" || toStageName === "Closed Lost") {
      setTransitionModal({ dealId, toStageId, toStageName });
    } else {
      updateStageMutation.mutate({ dealId, toStageId });
    }
  };

  // Compute total pipeline stats
  const allDeals = pipelineColumns.flatMap((col: any) => col.deals || []);
  const totalValue = allDeals.reduce((sum: number, d: any) => sum + Number(d.value || d.amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 min-h-screen overflow-hidden">
      {/* ── STAGE EVIDENCE / VERIFICATION MODAL ── */}
      <StageEvidenceModal
        isOpen={evidenceModal.isOpen}
        onClose={() => setEvidenceModal((prev) => ({ ...prev, isOpen: false }))}
        recordName={evidenceModal.recordName}
        validation={evidenceModal.validation}
        recordId={evidenceModal.recordId}
        daysInStage={evidenceModal.daysInStage}
        lastCustomerActivity={evidenceModal.lastCustomerActivity}
        onForceBypass={() => {
          if (evidenceModal.pendingTargetStageId) {
            updateStageMutation.mutate({
              dealId: evidenceModal.recordId,
              toStageId: evidenceModal.pendingTargetStageId,
              forceBypass: true
            });
          }
        }}
      />

      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Commercial Pipeline</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                9-Stage Opportunity Lifecycle: Discovery to Won/Lost
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right mr-2 hidden sm:block">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Pipeline</div>
            <div className="text-sm font-black text-slate-900">{formatCurrency(totalValue)}</div>
          </div>

          <button
            onClick={() => navigate("/leads")}
            className="enterprise-btn-secondary text-xs cursor-pointer"
          >
            <span>Pre-Sales Leads</span>
          </button>

          <button 
            onClick={() => setShowAddDealModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Opportunity
          </button>
        </div>
      </header>

      {/* TOOLBAR */}
      <section className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search deals, accounts, competitors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Pipeline Stages</option>
              {pipelineStages.map((s) => (
                <option key={s.id || s.name} value={s.id || s.name}>
                  {s.order}. {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "kanban" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <View className="w-3.5 h-3.5" /> Board
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "list" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <section className="flex-1 overflow-auto px-8 py-4">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            Loading commercial pipeline...
          </div>
        ) : viewMode === "kanban" ? (
          /* KANBAN BOARD */
          <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px] no-scrollbar">
            {pipelineStages.map((stage) => {
              const matchedCol = pipelineColumns.find((col: any) => 
                col.id === stage.id ||
                normalizeStageName(col.stage || col.name).toLowerCase() === stage.name.toLowerCase()
              );

              const colorScheme = getStageHeaderColor(stage.name, stage.name === "Lost" || stage.name === "Won");
              const columnDeals = matchedCol?.deals || [];

              const filteredDeals = columnDeals.filter((d: any) => {
                if (!searchQuery) return true;
                const searchLower = searchQuery.toLowerCase();
                const nameStr = (d.name || "").toLowerCase();
                const compStr = (d.company || "").toLowerCase();
                return nameStr.includes(searchLower) || compStr.includes(searchLower);
              });

              const totalStageValue = filteredDeals.reduce(
                (sum: number, d: any) => sum + Number(d.value || d.amount || 0),
                0
              );

              return (
                <div 
                  key={stage.id || stage.name}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id || stage.name, stage.name)}
                  className="w-72 shrink-0 bg-white/70 rounded-2xl p-3 border border-slate-200/90 flex flex-col min-h-[550px] shadow-2xs"
                >
                  {/* Column Header */}
                  <div className={`p-2.5 rounded-xl border ${colorScheme.bg} ${colorScheme.border} mb-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${colorScheme.text} truncate`}>
                        {stage.order}. {stage.name}
                      </span>
                      <span className="text-[10px] font-bold bg-white/90 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                        {filteredDeals.length}
                      </span>
                    </div>
                    <div className="text-[11px] font-black text-slate-800 mt-1">
                      {formatCurrencyCompact(totalStageValue)}
                    </div>
                  </div>

                  {/* Deals List */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                    {filteredDeals.length === 0 ? (
                      <div className="h-32 border-2 border-dashed border-slate-200/80 rounded-xl flex items-center justify-center text-[11px] text-slate-400 font-medium">
                        Drag deals here
                      </div>
                    ) : (
                      filteredDeals.map((deal: any) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onClick={() => navigate(`/opportunities/${deal.id}`)}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all space-y-2.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 leading-snug">
                              {deal.name}
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shrink-0">
                              {deal.probability || stage.probability || 50}%
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">{deal.company || deal.name}</span>
                            </div>

                            {deal.owner && (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{deal.owner.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="font-black text-slate-900">
                              {formatCurrency(deal.value || deal.amount || 0)}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              {deal.lastActivity || "Active"}
                            </span>
                          </div>

                          {token && <DealMilestonesWidget dealId={deal.id} token={token} />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Opportunity</th>
                  <th className="p-3.5">Stage</th>
                  <th className="p-3.5">Owner</th>
                  <th className="p-3.5">Value</th>
                  <th className="p-3.5">Probability</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {allDeals.map((d: any) => {
                  const sName = normalizeStageName(d.stage);
                  return (
                    <tr 
                      key={d.id}
                      onClick={() => navigate(`/opportunities/${d.id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900">
                        <div>{d.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{d.company}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`enterprise-badge ${getStageBadgeClass(sName)}`}>
                          {sName}
                        </span>
                      </td>
                      <td className="p-3.5">{d.owner?.name || "Assigned Rep"}</td>
                      <td className="p-3.5 font-bold text-slate-900">{formatCurrency(d.value || d.amount || 0)}</td>
                      <td className="p-3.5 font-bold text-emerald-600">{d.probability || 50}%</td>
                      <td className="p-3.5 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/opportunities/${d.id}`);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── ADD OPPORTUNITY MODAL ── */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">Create Commercial Opportunity</h3>
              <button onClick={() => setShowAddDealModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Opportunity Title *</label>
                <input 
                  type="text"
                  placeholder="e.g. Modular Portacabins Supply - Tata Steel"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Expected Amount (₹) *</label>
                <input 
                  type="number"
                  placeholder="e.g. 1500000"
                  value={newDeal.amount}
                  onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Pipeline Stage</label>
                <select
                  value={newDeal.stageId || pipelineStages[0]?.id || ""}
                  onChange={(e) => setNewDeal({ ...newDeal, stageId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {pipelineStages.map((stage) => (
                    <option key={stage.id || stage.name} value={stage.id || stage.name}>
                      {stage.order}. {stage.name} ({stage.probability || 0}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Known Competitors</label>
                <input 
                  type="text"
                  placeholder="e.g. Reddys Prefab, Kwikspace"
                  value={newDeal.competitors}
                  onChange={(e) => setNewDeal({ ...newDeal, competitors: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setShowAddDealModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => createDealMutation.mutate(newDeal)}
                disabled={!newDeal.name || !newDeal.amount || createDealMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all"
              >
                {createDealMutation.isPending ? "Creating..." : "Create Opportunity"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
