import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Edit2, Trash2, Sliders, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function LineItems() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterReqId = searchParams.get("requirementId") || "All";

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", requirementId: "", unit: "nos", description: "", defaultQuantity: 1 });

  // Fetch all requirements for selection dropdown and filtering
  const { data: requirements } = useQuery({
    queryKey: ["requirementsDropdown"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      return res.json();
    }
  });

  // Fetch line items based on filter
  const { data: lineItems, isLoading } = useQuery({
    queryKey: ["lineItems", filterReqId],
    queryFn: async () => {
      const url = filterReqId === "All" ? "/api/v1/master-data/line-items" : `/api/v1/master-data/line-items?requirementId=${filterReqId}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/master-data/line-items/${data.id}` : "/api/v1/master-data/line-items", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItems"] });
      setShowModal(false);
      setFormData({ name: "", requirementId: filterReqId !== "All" ? filterReqId : "", unit: "nos", description: "", defaultQuantity: 1 });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/line-items/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItems"] });
    }
  });

  const handleEdit = (item: any) => {
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this line item? All nested construction items will be deleted.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-4xl font-bold text-on-surface">Line Items</h2>
            <p className="text-base text-on-surface-variant">Manage sub-components that form a Requirement (e.g. Doors, Windows, Exhaust fans).</p>
          </div>
          <button 
            onClick={() => {
              setFormData({ name: "", requirementId: filterReqId !== "All" ? filterReqId : (requirements?.[0]?.id || ""), unit: "nos", description: "", defaultQuantity: 1 });
              setShowModal(true);
            }} 
            className="flex items-center gap-2 px-6 py-4 bg-primary text-on-primary rounded-lg hover:opacity-90 font-bold transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Add Line Item</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center gap-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Filter by Requirement:</span>
            <select 
              value={filterReqId} 
              onChange={e => setSearchParams({ requirementId: e.target.value })}
              className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
            >
              <option value="All">All Requirements</option>
              {requirements?.map((req: any) => (
                <option key={req.id} value={req.id}>{req.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0 border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Line Item Name</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Parent Requirement</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-center">Default Qty</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Est. Cost</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Sell Price</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading line items...</td>
                  </tr>
                ) : !lineItems || lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant italic">No line items found. Choose another requirement or click "Add Line Item" to create one.</td>
                  </tr>
                ) : (
                  lineItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary/10 flex items-center justify-center rounded text-secondary">
                            <Sliders className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold block">{item.name}</span>
                            <span className="text-xs text-on-surface-variant">{item.description || "No description"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-semibold text-on-surface-variant">{item.requirement?.name || "—"}</td>
                      <td className="px-6 py-5 text-on-surface-variant uppercase font-medium">{item.unit}</td>
                      <td className="px-6 py-5 text-center font-bold">{item.defaultQuantity}</td>
                      <td className="px-6 py-5 font-medium text-secondary">{formatCurrency(item.totalCost || 0)}</td>
                      <td className="px-6 py-5 font-extrabold text-primary">{formatCurrency(item.totalPrice || 0)}</td>
                      <td className="px-6 py-5 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 hover:bg-surface-container-lowest rounded-full transition-colors text-outline"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-error-container rounded-full transition-colors text-error"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Form */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold mb-4">{formData.id ? "Edit Line Item" : "Add Line Item"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Parent Requirement</label>
                  <select 
                    className="w-full border rounded p-2 text-sm" 
                    value={formData.requirementId}
                    onChange={e => setFormData({ ...formData, requirementId: e.target.value })}
                  >
                    <option value="" disabled>Select Requirement</option>
                    {requirements?.map((req: any) => (
                      <option key={req.id} value={req.id}>{req.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Name</label>
                  <input 
                    type="text" 
                    className="w-full border rounded p-2 text-sm" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Unit</label>
                    <input 
                      type="text" 
                      className="w-full border rounded p-2 text-sm" 
                      placeholder="e.g. nos, sqft, set"
                      value={formData.unit} 
                      onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Default Quantity</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.defaultQuantity} 
                      onChange={e => setFormData({ ...formData, defaultQuantity: parseFloat(e.target.value) || 1 })} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Description</label>
                  <textarea 
                    className="w-full border rounded p-2 text-sm h-24 resize-none" 
                    value={formData.description} 
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="px-4 py-2 font-bold text-on-surface-variant"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => saveMutation.mutate(formData)}
                    disabled={saveMutation.isPending || !formData.name || !formData.requirementId}
                    className="px-6 py-2 bg-primary text-on-primary rounded font-bold shadow-md hover:opacity-90 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
