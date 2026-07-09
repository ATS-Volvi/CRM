import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Download, MoreVertical, Plus, AlertTriangle, X } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function PurchaseOrders() {
  const { token } = useAuth();

  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const res = await fetch("/api/v1/purchase-orders", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      return res.json();
    }
  });

  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [newPO, setNewPO] = useState({ poNumber: "", amount: "", clientId: "" });

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mock API call
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setIsCreateModalOpen(false);
      setNewPO({ poNumber: "", amount: "", clientId: "" });
    }
  });

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Purchase Orders</h1>
          <p className="text-on-surface-variant">Manage and track POs from clients</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold hover:opacity-90">
          <Plus className="w-5 h-5" /> New PO
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
          <h2 className="text-lg font-semibold">Recent Purchase Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">PO Number</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Client</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Amount</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading purchase orders...</td>
                </tr>
              ) : (
                pos?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">No purchase orders found.</td>
                  </tr>
                ) : (
                pos?.map((po: any) => {
                  const clientName = po.quote?.deal?.lead?.company || po.quote?.deal?.lead?.firstName + " " + po.quote?.deal?.lead?.lastName || "Unknown Client";
                  const quoteAmount = po.quote?.amount || po.amount; // Fallback if mock is missing
                  const hasMismatch = Number(po.amount) !== Number(quoteAmount);
                  
                  return (
                  <tr key={po.id} onClick={() => setSelectedPO(po)} className="hover:bg-surface-container transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-bold text-primary">{po.poNumber || po.id.substring(0,8)}</td>
                    <td className="px-6 py-4">{clientName}</td>
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      {formatCurrency(po.amount)}
                      {hasMismatch && (
                        <div className="group relative flex items-center">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-max bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded">
                            Mismatch! Quote was {formatCurrency(quoteAmount)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${po.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); }} className="p-2 text-on-surface-variant hover:text-primary"><Download className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); }} className="p-2 text-on-surface-variant hover:text-primary"><MoreVertical className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  );
                })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[400px] max-w-full shadow-2xl relative">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-6">Create Purchase Order</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">PO Number</label>
                <input 
                  type="text" 
                  value={newPO.poNumber}
                  onChange={(e) => setNewPO({ ...newPO, poNumber: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary"
                  placeholder="e.g. PO-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Client / Quote ID</label>
                <input 
                  type="text" 
                  value={newPO.clientId}
                  onChange={(e) => setNewPO({ ...newPO, clientId: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Q-98765"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Amount ($)</label>
                <input 
                  type="number" 
                  value={newPO.amount}
                  onChange={(e) => setNewPO({ ...newPO, amount: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded p-2 text-sm outline-none focus:border-primary"
                  placeholder="10000"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded text-sm font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => createPOMutation.mutate(newPO)}
                  disabled={createPOMutation.isPending || !newPO.poNumber || !newPO.amount}
                  className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  {createPOMutation.isPending ? "Creating..." : "Create PO"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-xl w-[500px] max-w-full shadow-2xl relative">
            <button 
              onClick={() => setSelectedPO(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2">Purchase Order Details</h3>
            <p className="text-sm text-on-surface-variant mb-6">{selectedPO.poNumber || selectedPO.id}</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-lg border border-outline-variant">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Client</p>
                  <p className="text-sm font-bold">{selectedPO.quote?.deal?.lead?.company || selectedPO.quote?.deal?.lead?.firstName + " " + selectedPO.quote?.deal?.lead?.lastName || "Unknown Client"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Status</p>
                  <p className="text-sm font-bold">{selectedPO.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">PO Amount</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(selectedPO.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Linked Quote</p>
                  <p className="text-sm font-bold underline cursor-pointer text-secondary">View Quote</p>
                </div>
              </div>
              
              {Number(selectedPO.amount) !== Number(selectedPO.quote?.amount || selectedPO.amount) && (
                <div className="bg-warning-container text-warning p-3 rounded flex items-center gap-2 text-sm font-bold">
                  <AlertTriangle className="w-5 h-5" />
                  Warning: PO amount does not match Quote amount ({formatCurrency(selectedPO.quote?.amount || 0)})
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90"
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
