import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2, X, Clock, Calendar, CheckSquare, ChevronRight } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { useSearchParams, useNavigate } from "react-router-dom";

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

  const [viewMode, setViewMode] = useState<"kanban" | "list" | "gantt">("kanban");

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

  const queryClient = useQueryClient();
  const [transitionModal, setTransitionModal] = useState<{ dealId: string, toStageId: string, toStageName: string } | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [activeDealDetail, setActiveDealDetail] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [recontactDate, setRecontactDate] = useState("");
  const [newDeal, setNewDeal] = useState({ name: "", amount: "", competitors: "", probability: "" });

  const groups = ["Prospecting", "Active Deal", "Closed"];
  const groupMappings: { [key: string]: string[] } = {
    "Prospecting": ["New", "Contacted", "Qualified"],
    "Active Deal": ["Meeting/Demo", "Proposal", "Negotiation"],
    "Closed": ["Won", "Lost", "On Hold"]
  };

  const [expandedStages, setExpandedStages] = useState<{ [key: string]: boolean }>({
    "New": true,
    "Contacted": true,
    "Qualified": true,
    "Meeting/Demo": true,
    "Proposal": true,
    "Negotiation": true,
    "Won": true,
    "Lost": true,
    "On Hold": true
  });

  const toggleStage = (stageName: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageName]: !prev[stageName]
    }));
  };

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

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, toStageId, reason, recontactDate }: any) => {
      const res = await fetch(`/api/v1/pipeline/deals/${dealId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ toStageId, reason, recontactDate })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
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

    if (stageName === "Lost" || stageName === "On Hold") {
      setTransitionModal({ dealId, toStageId: stageId, toStageName: stageName });
      setReason("");
      setRecontactDate("");
    } else {
      updateStageMutation.mutate({ dealId, toStageId: stageId });
    }
  };

  const totalOpportunityValue = pipelineColumns?.reduce((acc: number, col: any) => acc + col.totalValue, 0) || 0;
  const allDeals = pipelineColumns?.flatMap((col: any) => col.deals.map((d: any) => ({ ...d, stageName: col.stage }))) || [];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* PIPELINE UTILITY BAR */}
      <section className="bg-surface px-8 py-4 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-8">
          <div>
            <h2 className="text-2xl font-semibold">Global Pipeline</h2>
            <p className="text-sm text-on-surface-variant mt-1">Total Opportunity Value: <span className="font-bold text-primary">{formatCurrency(totalOpportunityValue)}</span></p>
          </div>
          
          <div className="flex items-center bg-surface-container border border-outline-variant rounded-lg p-1">
            <button 
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <View className="w-3.5 h-3.5" /> Kanban
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === "list" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button 
              onClick={() => setViewMode("gantt")}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === "gantt" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <Clock className="w-3.5 h-3.5" /> Timeline Gantt
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddDealModal(true)}
            className="bg-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-xl shadow-2xs hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Deal
          </button>
          <button 
            onClick={() => navigate("/rules")}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
            title="Assignment Rules"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MAIN VIEW */}
      <section className="flex-1 overflow-auto bg-surface-container-low flex p-6 gap-6 items-start">
        {isLoading ? (
          <div className="w-full h-full flex justify-center items-center text-on-surface-variant animate-pulse">Loading Pipeline...</div>
        ) : viewMode === "list" ? (
          <div className="w-full bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant/30 text-on-surface-variant text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Deal Name</th>
                  <th className="p-4 font-semibold">Stage</th>
                  <th className="p-4 font-semibold">Value</th>
                  <th className="p-4 font-semibold">Probability</th>
                  <th className="p-4 font-semibold">Competitors</th>
                  <th className="p-4 font-semibold">Milestones</th>
                </tr>
              </thead>
              <tbody>
                {allDeals.map((deal: any) => (
                  <tr key={deal.id} className="border-b border-outline-variant/20 hover:bg-surface-container-lowest transition-colors">
                    <td className="p-4 font-medium">{deal.name} {deal.isUrgent && <CheckCircle2 className="inline w-4 h-4 text-error ml-2" />}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-surface-container rounded text-xs font-semibold text-on-surface-variant">{deal.stageName}</span>
                    </td>
                    <td className="p-4 font-bold text-primary">{formatCurrency(deal.value)}</td>
                    <td className="p-4 text-sm">{deal.probability != null ? `${deal.probability}%` : '-'}</td>
                    <td className="p-4 text-sm text-on-surface-variant">{deal.competitors || '-'}</td>
                    <td className="p-4 text-sm">
                      <DealMilestonesWidget dealId={deal.id} token={token || ""} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === "gantt" ? (
          /* TIMELINE GANTT VIEW FOR DEALS */
          <div className="w-full bg-card border border-border rounded-xl p-6 shadow-2xs space-y-6 overflow-x-auto">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-black text-foreground">Deals Schedule & Milestone Timeline</h3>
                <p className="text-xs text-muted-foreground">Horizontal timeline plotted against expected close schedule.</p>
              </div>
              <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Prospecting</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500" /> Active Deal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Closed Won</span>
              </div>
            </div>

            {/* Ruler Header */}
            <div className="min-w-[800px]">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-muted-foreground pb-2 border-b border-border">
                <div className="col-span-3">Deal & Owner</div>
                <div className="col-span-1 text-center">Stage</div>
                <div className="col-span-8 grid grid-cols-6 gap-1 text-center">
                  <span>Month 1</span><span>Month 2</span><span>Month 3</span><span>Month 4</span><span>Month 5</span><span>Month 6</span>
                </div>
              </div>

              {/* Deal Rows */}
              <div className="divide-y divide-border/60">
                {allDeals.map((deal: any, idx: number) => {
                  const progressPct = Math.min(100, Math.max(15, (deal.probability || 30)));
                  const startCol = (idx % 4) + 1;
                  const spanCols = Math.min(6, (idx % 3) + 3);

                  return (
                    <div key={deal.id} className="grid grid-cols-12 gap-2 py-3 items-center hover:bg-muted/40 transition-colors">
                      <div className="col-span-3">
                        <span className="font-bold text-foreground text-xs block truncate">{deal.name}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">{formatCurrency(deal.value)}</span>
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                          {deal.stageName}
                        </span>
                      </div>
                      <div className="col-span-8 grid grid-cols-6 gap-1 relative items-center">
                        <div 
                          className="h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center px-2 text-[10px] font-bold text-primary shadow-2xs truncate transition-all hover:bg-primary/30 cursor-pointer"
                          style={{ gridColumnStart: startCol, gridColumnEnd: `span ${spanCols}` }}
                        >
                          <span className="truncate">{deal.name} ({progressPct}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          groups.map((group) => {
            const stageNames = groupMappings[group];
            const groupStages = pipelineColumns?.filter((col: any) => stageNames.includes(col.stage)) || [];
            const totalValue = groupStages.reduce((acc: number, col: any) => acc + col.totalValue, 0);

            return (
              <div key={group} className="flex-1 flex flex-col gap-4 min-w-[320px]">
                {/* Group Header */}
                <div className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/60">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-on-surface text-sm uppercase tracking-wider">{group}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                      {groupStages.reduce((acc: number, s: any) => acc + s.deals.length, 0)}
                    </span>
                  </div>
                  <span className="font-bold text-primary text-sm">{formatCurrencyCompact(totalValue)}</span>
                </div>

                {/* Sub Stages */}
                <div className="space-y-4">
                  {groupStages.map((stageCol: any) => {
                    const isExpanded = expandedStages[stageCol.stage];

                    return (
                      <div key={stageCol.id} className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl overflow-hidden shadow-2xs">
                        <div 
                          onClick={() => toggleStage(stageCol.stage)}
                          className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between cursor-pointer hover:bg-muted transition-colors select-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-on-surface-variant font-bold text-xs">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">{stageCol.stage}</span>
                            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-[10px] font-bold text-on-surface-variant">
                              {stageCol.deals.length}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-primary">{formatCurrencyCompact(stageCol.totalValue)}</span>
                        </div>

                        {/* Collapsible Area */}
                        {isExpanded && (
                          <div 
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stageCol.id, stageCol.stage)}
                            className="p-3 space-y-3 min-h-[80px]"
                          >
                            {stageCol.deals.length === 0 ? (
                              <p className="text-[11px] text-center text-on-surface-variant/65 py-4 italic">Drag deals here to assign to {stageCol.stage}</p>
                            ) : (
                              stageCol.deals.map((deal: any) => (
                                <div 
                                  key={deal.id} 
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, deal.id)}
                                  className={`bg-surface-container-lowest p-3 rounded-lg border ${deal.isUrgent ? 'border-error/50' : 'border-outline-variant'} hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2`} 
                                  style={deal.isUrgent ? { borderLeft: "4px solid #ba1a1a" } : {}}
                                >
                                  <div className="flex justify-between items-start mb-1 gap-2">
                                    <span className="text-sm font-bold text-on-surface leading-tight">{deal.name}</span>
                                    <select
                                      value={stageCol.id}
                                      onChange={(e) => {
                                        const stageId = e.target.value;
                                        const stageName = e.target.options[e.target.selectedIndex].text;
                                        if (stageName === "Lost" || stageName === "On Hold") {
                                          setTransitionModal({ dealId: deal.id, toStageId: stageId, toStageName: stageName });
                                          setReason("");
                                          setRecontactDate("");
                                        } else {
                                          updateStageMutation.mutate({ dealId: deal.id, toStageId: stageId });
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[10px] bg-surface border border-outline-variant rounded px-1.5 py-0.5 outline-none focus:border-primary text-on-surface-variant max-w-[90px] truncate cursor-pointer hover:bg-surface-container-high transition-colors"
                                    >
                                      {pipelineColumns?.map((sc: any) => (
                                        <option key={sc.id} value={sc.id}>{sc.stage}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-end justify-between">
                                    <div>
                                      <p className="text-sm text-primary font-bold">{formatCurrency(deal.value)}</p>
                                      <p className={`text-[11px] ${deal.isUrgent ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{deal.lastActivity}</p>
                                    </div>
                                  </div>

                                  {/* Milestone Checklist Component */}
                                  <DealMilestonesWidget dealId={deal.id} token={token || ""} />

                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
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
    </div>
  );
}
