import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Filter, ClipboardList, AlertTriangle, Landmark, 
  Gavel, FileEdit, Check, X, Info, History, Settings
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function ApprovalQueue() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [auditQuoteId, setAuditQuoteId] = useState<string | null>(null);

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
              <span className="bg-secondary text-on-secondary text-[12px] px-2 py-0.5 rounded-full">12 Pending</span>
            </h2>
            <div className="flex gap-2">
              <button className="flex items-center gap-1 px-3 py-1.5 border border-outline text-sm rounded hover:bg-surface-container transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container-high z-10">
                <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase">
                  <th className="p-4 border-b border-outline-variant">Trigger Reason</th>
                  <th className="p-4 border-b border-outline-variant">Requestor</th>
                  <th className="p-4 border-b border-outline-variant">Quote Summary</th>
                  <th className="p-4 border-b border-outline-variant">Value</th>
                  <th className="p-4 border-b border-outline-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant animate-pulse">Loading approvals...</td>
                  </tr>
                ) : (
                  approvals?.map((item: any, i: number) => {
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
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setAuditQuoteId(item.id)} className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg" title="Audit Trail">
                            <History className="w-5 h-5" />
                          </button>
                          {item.status === 'Pending' && (
                            <>
                              <button onClick={() => updateMutation.mutate({ id: item.id, status: 'Rejected' })} className="p-1 text-error hover:bg-error-container rounded-lg" title="Reject">
                                <X className="w-5 h-5" />
                              </button>
                              <button onClick={() => updateMutation.mutate({ id: item.id, status: 'Approved' })} className="p-1 text-on-primary bg-primary rounded-lg shadow-sm hover:scale-105 active:scale-95" title="Approve">
                                <Check className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
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
              <span className="flex items-center gap-1">Approval Tiers <Info className="w-4 h-4" /></span>
              <button onClick={() => setShowTiersModal(true)} className="text-outline hover:text-primary transition-colors" title="Configure Tiers">
                <Settings className="w-4 h-4" />
              </button>
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">01</div>
                  <div className="w-[2px] h-full bg-outline-variant mt-1"></div>
                </div>
                <div className="pb-2">
                  <p className="text-sm font-bold">Direct Manager</p>
                  <p className="text-[11px] text-on-surface-variant">Standard Quotes &lt; {formatCurrencyCompact(50000)}</p>
                  <div className="mt-1 bg-surface-container-low px-2 py-1 rounded border border-outline-variant text-[10px] text-on-surface-variant">
                    Auto-approves if within +/- 5% margin
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">02</div>
                  <div className="w-[2px] h-full bg-outline-variant mt-1"></div>
                </div>
                <div className="pb-2">
                  <p className="text-sm font-bold">Regional Director</p>
                  <p className="text-[11px] text-on-surface-variant">Discounts &gt; 10% or &gt; {formatCurrencyCompact(100000)}</p>
                  <div className="mt-1 bg-primary-container/10 border-l-2 border-primary px-2 py-1 rounded text-[10px] text-primary font-bold">
                    Current Active Tier
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-outline-variant text-on-surface-variant flex items-center justify-center text-[10px] font-bold">03</div>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface-variant">Chief Revenue Officer</p>
                  <p className="text-[11px] text-on-surface-variant">Strategic Deals &gt; {formatCurrencyCompact(1000000)}</p>
                </div>
              </div>
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
            <button className="w-full mt-4 text-primary font-bold text-[12px] py-2 hover:bg-surface-container transition-colors rounded">
              View Full History
            </button>
          </div>

        </aside>
      </div>

      {/* Configure Tiers Modal */}
      {showTiersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[600px] max-w-full shadow-2xl relative">
            <button onClick={() => setShowTiersModal(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4">Configure Approval Tiers</h3>
            <p className="text-sm text-on-surface-variant mb-6">Define logic for auto-approvals and required manual sign-offs.</p>
            
            <div className="space-y-4">
              <div className="border border-outline-variant rounded p-4 bg-surface-container-lowest">
                <h4 className="font-bold text-sm mb-2 flex justify-between">Tier 1: Direct Manager <span className="text-primary text-[10px] uppercase font-bold px-2 bg-primary-container rounded">Active</span></h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Discount %</label>
                    <input type="number" defaultValue="5" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Quote Value ($)</label>
                    <input type="number" defaultValue="50000" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                </div>
              </div>
              <div className="border border-outline-variant rounded p-4 bg-surface-container-lowest">
                <h4 className="font-bold text-sm mb-2 flex justify-between">Tier 2: Regional Director</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Discount %</label>
                    <input type="number" defaultValue="15" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Quote Value ($)</label>
                    <input type="number" defaultValue="100000" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                </div>
              </div>
              <div className="border border-outline-variant rounded p-4 bg-surface-container-lowest">
                <h4 className="font-bold text-sm mb-2 flex justify-between">Tier 3: Chief Revenue Officer</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Discount %</label>
                    <input type="number" defaultValue="30" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Quote Value ($)</label>
                    <input type="number" defaultValue="1000000" className="w-full border rounded p-1 text-sm bg-surface" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowTiersModal(false)} className="px-4 py-2 text-sm font-bold">Cancel</button>
              <button onClick={() => setShowTiersModal(false)} className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90">Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditQuoteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[500px] max-w-full shadow-2xl relative">
            <button onClick={() => setAuditQuoteId(null)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2">Quote Audit Trail</h3>
            <p className="text-sm text-on-surface-variant mb-6">Approval history for {approvals?.find((a:any) => a.id === auditQuoteId)?.target?.deal?.lead?.company || 'this quote'}</p>
            
            <div className="space-y-4">
              <div className="flex gap-4 items-start relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-[2px] before:bg-outline-variant">
                <div className="absolute left-[3px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface"></div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Submitted for Tier 2 Approval</p>
                  <p className="text-xs text-on-surface-variant">By System • Just now</p>
                  <p className="text-xs mt-1">Discount exceeded Tier 1 limits.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-[2px] before:bg-outline-variant">
                <div className="absolute left-[3px] top-1 w-2.5 h-2.5 rounded-full bg-outline ring-4 ring-surface"></div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Tier 1 Auto-Approved</p>
                  <p className="text-xs text-on-surface-variant">By System • 1m ago</p>
                </div>
              </div>
              <div className="flex gap-4 items-start relative pl-6">
                <div className="absolute left-[3px] top-1 w-2.5 h-2.5 rounded-full bg-outline ring-4 ring-surface"></div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Quote Draft Submitted</p>
                  <p className="text-xs text-on-surface-variant">By Requestor • 2m ago</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button onClick={() => setAuditQuoteId(null)} className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
