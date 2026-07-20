import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Filter, ClipboardList, AlertTriangle, Landmark, 
  Gavel, FileEdit, Check, X, Info, History, Plus, Trash2
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function ApprovalQueue() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showTierForm, setShowTierForm] = useState(false);
  const [newTierName, setNewTierName] = useState("");
  const [newTierThreshold, setNewTierThreshold] = useState("");
  const [newTierRole, setNewTierRole] = useState("sales_manager");
  const [filterStatus, setFilterStatus] = useState("All");

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approvals", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    }
  });

  const filteredApprovals = approvals?.filter((item: any) => {
    if (filterStatus === "All") return true;
    return item.status === filterStatus;
  });

  const { data: tiers, refetch: refetchTiers } = useQuery({
    queryKey: ["approvalTiers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approval-tiers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const createTierMutation = useMutation({
    mutationFn: async (newTier: any) => {
      const res = await fetch("/api/v1/approval-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(newTier)
      });
      if (!res.ok) throw new Error("Failed to create tier");
      return res.json();
    },
    onSuccess: () => {
      refetchTiers();
      setNewTierName("");
      setNewTierThreshold("");
      setShowTierForm(false);
    }
  });

  const deleteTierMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const res = await fetch(`/api/v1/approval-tiers/${tierId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete tier");
      return true;
    },
    onSuccess: () => {
      refetchTiers();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/v1/approvals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update approval");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] })
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 flex gap-8 h-full">
        
        {/* Approval Queue List */}
        <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden h-full">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Approval Queue
              <span className="bg-secondary text-on-secondary text-[12px] px-2 py-0.5 rounded-full">
                {approvals?.filter((item: any) => item.status === 'Pending').length || 0} Pending
              </span>
            </h2>
            <div className="flex gap-2">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container-high z-10">
                <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase">
                  <th className="p-4 border-b border-outline-variant">Trigger Reason</th>
                  <th className="p-4 border-b border-outline-variant">Requestor</th>
                  <th className="p-4 border-b border-outline-variant">Assigned Approver</th>
                  <th className="p-4 border-b border-outline-variant">Quote Summary</th>
                  <th className="p-4 border-b border-outline-variant">Value</th>
                  <th className="p-4 border-b border-outline-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant animate-pulse">Loading approvals...</td>
                  </tr>
                ) : (
                  filteredApprovals?.map((item: any, i: number) => {
                    const clientName = item.target?.deal?.lead?.company || item.target?.deal?.lead?.firstName + " " + item.target?.deal?.lead?.lastName || "Unknown Client";
                    const value = item.target?.totalAmount || 0;
                    return (
                    <tr key={item.id || i} className={`hover:bg-surface-container-low transition-colors group ${item.status === 'Rejected' ? 'bg-error-container/10' : ''}`}>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{item.type} Approval</span>
                          <span className={`text-[11px] flex items-center gap-1 text-on-surface-variant`}>
                            <AlertTriangle className="w-3 h-3" />
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] bg-primary-container text-on-primary-container`}>
                            {item.requestedBy?.name?.[0] || 'U'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold">{item.requestedBy?.name || 'Unknown'}</span>
                            <span className="text-[11px] text-on-surface-variant">Requestor</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{item.assignedApprover?.name || 'Auto-assigning...'}</span>
                          <span className="text-[11px] text-outline">{item.assignedApprover?.role || 'Manager'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{clientName}</span>
                          <span className="text-[12px] text-on-surface-variant truncate w-48 italic">"{item.comments || 'No comments'}"</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{formatCurrency(value)}</span>
                          <span className="text-[11px] text-on-surface-variant">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {item.status === 'Pending' && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => updateMutation.mutate({ id: item.id, status: 'Rejected' })} className="p-1 text-error hover:bg-error-container rounded-lg" title="Reject">
                              <X className="w-5 h-5" />
                            </button>
                            <button onClick={() => updateMutation.mutate({ id: item.id, status: 'Approved' })} className="p-1 text-on-primary bg-primary rounded-lg shadow-sm hover:scale-105 active:scale-95" title="Approve">
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sidebar: Approval Tiers & Audit Trail */}
        <aside className="w-80 flex flex-col gap-8 h-full">
          
          {/* Approval Tiers Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-primary border-b border-outline-variant pb-2 mb-4 flex items-center justify-between">
              Approval Tiers
              <button onClick={() => setShowTierForm(!showTierForm)} className="text-secondary hover:text-primary transition-colors flex items-center gap-1 font-bold text-[10px]">
                <Plus className="w-3.5 h-3.5" /> ADD
              </button>
            </h3>
            
            {showTierForm && (
              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 mb-4 space-y-3">
                <div className="text-xs font-bold text-on-surface">New Tier Rule</div>
                <input 
                  type="text"
                  placeholder="Tier Name (e.g. Director)"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded p-1.5 text-xs"
                />
                <input 
                  type="number"
                  placeholder="Threshold Value ($)"
                  value={newTierThreshold}
                  onChange={(e) => setNewTierThreshold(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded p-1.5 text-xs"
                />
                <select
                  value={newTierRole}
                  onChange={(e) => setNewTierRole(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded p-1.5 text-xs"
                >
                  <option value="sales_manager">Sales Manager</option>
                  <option value="director">Regional Director</option>
                  <option value="cro">Chief Revenue Officer</option>
                  <option value="admin">Administrator</option>
                </select>
                <div className="flex justify-end gap-2 text-xs">
                  <button onClick={() => setShowTierForm(false)} className="px-2 py-1 font-bold">Cancel</button>
                  <button 
                    onClick={() => createTierMutation.mutate({ name: newTierName, thresholdValue: Number(newTierThreshold), requiredRole: newTierRole })}
                    className="px-2 py-1 bg-primary text-white font-bold rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {tiers?.map((tier: any, idx: number) => (
                <div key={tier.id || idx} className="flex gap-4 group/tier">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                    {idx < tiers.length - 1 && <div className="w-[2px] h-full bg-outline-variant mt-1"></div>}
                  </div>
                  <div className="pb-2 flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-on-surface">{tier.name}</p>
                      <button 
                        onClick={() => deleteTierMutation.mutate(tier.id)}
                        className="text-error opacity-0 group-hover/tier:opacity-100 transition-opacity hover:scale-105"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">Threshold: &gt; {formatCurrency(tier.thresholdValue)}</p>
                    <div className="mt-1 bg-surface-container-low px-2 py-1 rounded border border-outline-variant text-[10px] text-on-surface-variant">
                      Assigned to: {tier.requiredRole}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trail Card */}
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-on-surface-variant border-b border-outline-variant pb-2 mb-4 flex items-center justify-between">
              Recent Decisions
              <History className="w-4 h-4" />
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-green-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase">Approved</span>
                  <span className="text-[10px] text-on-surface-variant">10m ago</span>
                </div>
                <p className="text-sm font-bold">Al Futtaim Digital Quote</p>
                <p className="text-[11px] text-on-surface-variant">Approved by Sarah J. (CRO)</p>
              </div>

              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-primary">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-primary bg-primary-container/20 px-1.5 py-0.5 rounded uppercase">Revision</span>
                  <span className="text-[10px] text-on-surface-variant">2h ago</span>
                </div>
                <p className="text-sm font-bold">Mobily Network Extension</p>
                <p className="text-[11px] text-on-surface-variant">"Please adjust hardware tax rates for SA."</p>
              </div>

              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-error">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-error bg-error-container px-1.5 py-0.5 rounded uppercase">Rejected</span>
                  <span className="text-[10px] text-on-surface-variant">5h ago</span>
                </div>
                <p className="text-sm font-bold">Standard Chartered Q3</p>
                <p className="text-[11px] text-on-surface-variant">"Discount exceeds regional limit."</p>
              </div>

            </div>
            <Link to="/quotes" className="w-full mt-4 text-center text-primary font-bold text-[12px] py-2 hover:bg-surface-container transition-colors rounded block border border-primary/20">
              View Full History
            </Link>
          </div>

        </aside>
      </div>
    </div>
  );
}
