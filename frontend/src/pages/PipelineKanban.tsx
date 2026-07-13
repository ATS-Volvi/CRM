import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2, X } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function PipelineKanban() {
  const { token } = useAuth();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

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
  const [recontactDate, setRecontactDate] = useState("");
  const [newDeal, setNewDeal] = useState({ name: "", amount: "", competitors: "", probability: "" });

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

  const submitStageChange = () => {
    if (!transitionModal) return;
    updateStageMutation.mutate({ 
      dealId: transitionModal.dealId, 
      toStageId: transitionModal.toStageId, 
      reason, 
      recontactDate 
    });
  };

  const totalOpportunityValue = pipelineColumns?.reduce((acc: number, col: any) => acc + col.totalValue, 0) || 0;

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

      {/* KANBAN CANVAS */}
      <section className="flex-1 overflow-x-auto overflow-y-hidden bg-surface-container-low flex p-8 gap-6 items-start">
        {isLoading ? (
          <div className="w-full h-full flex justify-center items-center text-on-surface-variant animate-pulse">Loading Pipeline...</div>
        ) : pipelineColumns?.map((col: any) => (
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
              {col.deals.map((deal: any) => (
                <div 
                  key={deal.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id)}
                  className={`bg-surface-container-lowest p-4 rounded-lg border ${deal.isUrgent ? 'border-error/50' : 'border-outline-variant'} hover:shadow-md transition-all cursor-grab active:cursor-grabbing`} 
                  style={deal.isUrgent ? { borderLeft: "4px solid #ba1a1a" } : {}}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-on-surface leading-tight">{deal.name}</span>
                    {deal.isUrgent ? <span className="text-error"><CheckCircle2 className="w-4 h-4" /></span> : <MoreVertical className="text-tertiary w-4 h-4" />}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-primary font-bold">{formatCurrency(deal.value)}</p>
                      <p className={`text-[11px] ${deal.isUrgent ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{deal.lastActivity}</p>
                    </div>
                    {deal.tag && (
                      <div className={`px-2 py-0.5 ${deal.isUrgent ? 'bg-error-container/20 text-error' : 'bg-secondary-container/20 text-secondary'} font-semibold text-[10px] rounded`}>
                        {deal.tag}
                      </div>
                    )}
                  </div>
                  {deal.competitors && (
                    <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-wider mr-1">vs:</span>
                      <span className="font-semibold text-on-surface">{deal.competitors}</span>
                    </p>
                  )}
                  {deal.probability !== undefined && deal.probability !== null && (
                    <div className="mt-3">
                       <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-on-surface-variant font-medium">Prob:</span>
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${deal.probability}%` }}></div>
                        </div>
                        <span className="text-[10px] text-primary font-bold">{deal.probability}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Removed Mock Empty stage block since we now fetch from DB dynamically */}
      </section>

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
              
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {transitionModal.toStageName === "Lost" ? "Loss Reason *" : "Reason / Notes *"}
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
                <label className="block text-sm font-semibold mb-1">Value (SAR)</label>
                <input 
                  type="number" 
                  value={newDeal.amount}
                  onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="10000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Competitors</label>
                <input 
                  type="text" 
                  value={newDeal.competitors}
                  onChange={(e) => setNewDeal({ ...newDeal, competitors: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Al-Futtaim, Zamil"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Probability (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={newDeal.probability}
                  onChange={(e) => setNewDeal({ ...newDeal, probability: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="e.g. 70"
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
                  onClick={() => createDealMutation.mutate({ 
                    name: newDeal.name, 
                    amount: Number(newDeal.amount), 
                    competitors: newDeal.competitors || null,
                    probability: newDeal.probability ? Number(newDeal.probability) : null
                  })}
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
    </div>
  );
}
