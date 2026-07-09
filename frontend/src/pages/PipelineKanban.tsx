import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2, X, AlertCircle } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function PipelineKanban() {
  const { token } = useAuth();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [myPipelineOnly, setMyPipelineOnly] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeMenuDealId, setActiveMenuDealId] = useState<string | null>(null);

  const { data: pipelineColumns, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/v1/pipeline", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    }
  });

  const queryClient = useQueryClient();
  const [transitionModal, setTransitionModal] = useState<{ dealId: string, toStageId: string, toStageName: string } | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [reason, setReason] = useState("");
  const [lossReasonCategory, setLossReasonCategory] = useState("Price");
  const [recontactDate, setRecontactDate] = useState("");
  const [newDeal, setNewDeal] = useState({ name: "", amount: "" });
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

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
      setNewDeal({ name: "", amount: "" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, toStageId, reason, lossCategory, recontactDate }: any) => {
      const res = await fetch(`/api/v1/pipeline/deals/${dealId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ toStageId, reason, lossCategory, recontactDate })
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
      if (stageName === "Won") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
  };

  const submitStageChange = () => {
    if (!transitionModal) return;
    updateStageMutation.mutate({ 
      dealId: transitionModal.dealId, 
      toStageId: transitionModal.toStageId, 
      reason, 
      lossCategory: transitionModal.toStageName === 'Lost' ? lossReasonCategory : undefined,
      recontactDate 
    });
  };

  // Filter deals based on "My Pipeline"
  const filteredPipeline = pipelineColumns?.map((col: any) => ({
    ...col,
    deals: myPipelineOnly ? col.deals.filter((d: any) => (d.rep || d.assignedTo) === 'Me' || Math.random() > 0.5) : col.deals // Using random as fallback for mock data
  })) || [];

  const totalOpportunityValue = filteredPipeline.reduce((acc: number, col: any) => acc + col.totalValue, 0) || 0;

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
              className={`px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "kanban" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <View className="w-4 h-4" /> Kanban
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "list" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <List className="w-4 h-4" /> List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-4">
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMvsbUdHzPc68XYDJJ99ReON1N-i4XebZxklXStKLhC28lVkQuD41QSfYgzrbGIiQzMYDq7RhJrL0Ut2WhyZjcESYYKi6UhddvcRQEOrdTpVORu28cZgzL1tp5SIO5twMJ6eKZDND23Nuqg3Ng9o-2fhKoDYc7ohwobNF3aB5xPVbEABzTwwt4UyjMv2mbtK4fMre1wfkNJixV5ddEJ0vUQz37e-BDIQ6AZva220_ZlyJfw5WjE2miFwW9y8SM-M_WpZar_DorbqtG" alt="rep" />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyvj-mY9fPXOykhTV53eLGv26B64soQCJxqp5NXTeH3v0zfP8xW5P-7bkRg9DOSCkW2pT2WcZPWCYOkybYDX7CtbDFqSsn-CWpzPdQWGHdYA8xTuorjJVY8KjU8dQRcsUEazjiL7He8xeZMr0-zJy9Um95NSvxw6D804dxDDhwDKTUNWaypNvVmt9ih-Ql3Ba-38qSLm9oTDO5oueuoVtxSwM7S9Zn0xIP5GWnXEPDVqaXDYi7g5vQlAeOfqHxyXDwWlo9QHMS_Be_" alt="rep" />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-[10px] font-bold text-on-primary">+8</div>
          </div>
          
          <div className="flex items-center gap-2 mr-4 bg-surface-container rounded p-1">
             <button 
                onClick={() => setMyPipelineOnly(!myPipelineOnly)}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${myPipelineOnly ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
             >
                My Pipeline
             </button>
          </div>
          <button 
            onClick={() => alert("Filter panel coming soon.")}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
          >
            <Filter className="w-5 h-5" />
          </button>
          <button 
            onClick={() => alert("Pipeline settings coming soon.")}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* KANBAN CANVAS / LIST VIEW */}
      <section className="flex-1 overflow-auto bg-surface-container-low flex p-8 gap-6 items-start">
        {isLoading ? (
          <div className="w-full h-full flex justify-center items-center text-on-surface-variant animate-pulse">Loading Pipeline...</div>
        ) : viewMode === "kanban" ? (
          filteredPipeline.map((col: any) => (
          <div 
            key={col.id || col.stage} 
            className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id, col.stage)}
          >
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">{col.stage}</h3>
                <p className="font-bold text-lg">{formatCurrencyCompact(col.totalValue)} <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· {col.deals.length} deals</span></p>
              </div>
              <button 
                onClick={() => setShowAddDealModal(true)}
                className="text-on-surface-variant hover:text-primary transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {col.deals.map((deal: any) => {
                const isStale = deal.lastActivity?.includes("days ago") && parseInt(deal.lastActivity) > 5;
                return (
                <div 
                  key={deal.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id)}
                  onClick={(e) => {
                    // Prevent firing if dragging (simple heuristic)
                    if (e.defaultPrevented) return;
                    setSelectedDeal(deal);
                  }}
                  className={`bg-surface-container-lowest p-4 rounded-lg border ${deal.isUrgent ? 'border-error/50' : isStale ? 'border-warning/50' : 'border-outline-variant'} hover:shadow-md transition-all cursor-grab active:cursor-grabbing`} 
                  style={deal.isUrgent ? { borderLeft: "4px solid #ba1a1a" } : isStale ? { borderLeft: "4px solid #ffb4a1" } : {}}
                >
                  <div className="flex justify-between items-start mb-2 relative">
                    <span className="text-sm font-bold text-on-surface leading-tight">{deal.name}</span>
                    {deal.isUrgent ? <span className="text-error"><CheckCircle2 className="w-4 h-4" /></span> : isStale ? <span className="w-2 h-2 rounded-full bg-orange-500 mt-1"></span> : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setActiveMenuDealId(activeMenuDealId === deal.id ? null : deal.id); }}
                        className="p-1 hover:bg-surface-container rounded"
                        aria-label="Deal options"
                      >
                        <MoreVertical className="text-tertiary w-4 h-4" />
                      </button>
                    )}
                    
                    {activeMenuDealId === deal.id && (
                      <div className="absolute right-0 top-6 w-48 bg-surface border border-outline-variant shadow-lg rounded-xl z-10 py-2">
                        <div className="px-3 py-1 text-xs font-bold text-on-surface-variant uppercase">Move To</div>
                        {pipelineColumns.map((c: any) => c.stage !== col.stage && (
                          <button 
                            key={c.id} 
                            onClick={(e) => { e.stopPropagation(); updateStageMutation.mutate({ dealId: deal.id, newStageId: c.id }); setActiveMenuDealId(null); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-low"
                          >
                            {c.stage}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-primary font-bold">{formatCurrency(deal.value)}</p>
                        <span className="text-[10px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-bold">{deal.probability || 50}%</span>
                      </div>
                      <p className={`text-[11px] ${deal.isUrgent ? 'text-error font-medium' : isStale ? 'text-orange-600 font-bold' : 'text-on-surface-variant'}`}>{isStale ? `Stale: ${deal.lastActivity}` : deal.lastActivity}</p>
                    </div>
                    {deal.tag && (
                      <div className={`px-2 py-0.5 ${deal.isUrgent ? 'bg-error-container/20 text-error' : 'bg-secondary-container/20 text-secondary'} font-semibold text-[10px] rounded`}>
                        {deal.tag}
                      </div>
                    )}
                  </div>
                  {deal.progress !== undefined && (
                    <div className="mt-3">
                       <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${deal.progress}%` }}></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-medium">{deal.progress}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        ))
      ) : (
          <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-surface-container-low border-b border-outline-variant text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Deal Name</th>
                  <th className="px-6 py-4">Stage</th>
                  <th className="px-6 py-4">Value</th>
                  <th className="px-6 py-4">Probability</th>
                  <th className="px-6 py-4">Close Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredPipeline.flatMap((col:any) => col.deals.map((deal:any) => {
                  const isOverdue = new Date(deal.closeDate || '2026-12-01') < new Date();
                  return (
                  <tr key={deal.id} className="hover:bg-surface-container-high transition-colors text-sm touch-pan-x">
                    <td className="px-6 py-4 font-bold">{deal.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-surface-container rounded text-xs font-semibold">{col.stage}</span>
                    </td>
                    <td className="px-6 py-4 text-primary font-bold">{formatCurrency(deal.value)}</td>
                    <td className="px-6 py-4">{deal.probability || 50}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${new Date(deal.closeDate || '2026-12-01') < new Date() ? 'bg-error-container text-error' : 'text-on-surface-variant'}`}>
                        {deal.closeDate || '2026-12-01'}
                        {new Date(deal.closeDate || '2026-12-01') < new Date() && ' (Overdue)'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       {deal.isUrgent ? <span className="text-error font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Urgent</span> : <span className="text-on-surface-variant">Active</span>}
                    </td>
                  </tr>
                );
              }))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      {/* Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
          <div className="w-full h-full absolute inset-0 bg-success/10 backdrop-blur-[2px] transition-all"></div>
          <div className="relative text-center">
            <h1 className="text-6xl font-black text-primary animate-bounce shadow-xl">DEAL WON! 🎉</h1>
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
            <h3 className="text-xl font-bold mb-2">Move to {transitionModal.toStageName}</h3>
            <p className="text-sm text-on-surface-variant mb-6">Please provide additional details to update the deal stage.</p>
            
            <div className="space-y-4">
              {transitionModal.toStageName === "On Hold" && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Re-contact Date *</label>
                  <input 
                    type="date" 
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    value={recontactDate}
                    onChange={(e) => setRecontactDate(e.target.value)}
                  />
                </div>
              )}
              
              {transitionModal.toStageName === "Lost" && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Loss Reason Category *</label>
                  <select 
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4"
                    value={lossReasonCategory}
                    onChange={(e) => setLossReasonCategory(e.target.value)}
                  >
                    <option value="Price">Price</option>
                    <option value="Competitor">Competitor</option>
                    <option value="Missing Feature">Missing Feature</option>
                    <option value="Timing">Timing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {transitionModal.toStageName === "Lost" ? "Additional Notes" : "Reason / Notes *"}
                </label>
                <textarea 
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm h-24 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Enter details..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  onClick={() => setTransitionModal(null)}
                  className="px-4 py-2 rounded text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitStageChange}
                  disabled={!reason || (transitionModal.toStageName === "On Hold" && !recontactDate) || updateStageMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateStageMutation.isPending ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[400px] max-w-full shadow-2xl relative">
            <button 
              onClick={() => setShowAddDealModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2">Add New Deal</h3>
            <p className="text-sm text-on-surface-variant mb-6">Enter deal details to add it to the pipeline.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Deal Name</label>
                <input 
                  type="text" 
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Enterprise License - Q4"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Value ($)</label>
                <input 
                  type="number" 
                  value={newDeal.amount}
                  onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="10000"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  onClick={() => setShowAddDealModal(false)}
                  className="px-4 py-2 rounded text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => createDealMutation.mutate({ name: newDeal.name, amount: Number(newDeal.amount) })}
                  disabled={createDealMutation.isPending || !newDeal.name || !newDeal.amount}
                  className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createDealMutation.isPending ? "Creating..." : "Create Deal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail / Edit Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[500px] max-w-full shadow-2xl relative">
            <button 
              onClick={() => setSelectedDeal(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2">Deal Details</h3>
            
            <div className="space-y-4 mt-6">
              <div>
                <label className="block text-sm font-semibold mb-1">Deal Name</label>
                <input 
                  type="text" 
                  value={selectedDeal.name}
                  readOnly
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm text-on-surface-variant"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Value ($)</label>
                  <input 
                    type="number" 
                    value={selectedDeal.value}
                    readOnly
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm text-on-surface-variant"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Probability (%)</label>
                  <input 
                    type="number" 
                    value={selectedDeal.probability || 50}
                    readOnly
                    className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm text-on-surface-variant"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Competitor Tracking</label>
                <input 
                  type="text" 
                  defaultValue={selectedDeal.competitor || ""}
                  placeholder="e.g. Salesforce, HubSpot"
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant mt-1">Note: In a real app, this would save automatically or via a Save button.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedDeal(null)}
                  className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
