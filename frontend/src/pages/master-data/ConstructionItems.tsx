import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Edit2, Trash2, ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function ConstructionItems() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterLiId = searchParams.get("lineItemId") || "All";

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", lineItemId: "", category: "material", unit: "nos", quantityPerLineItem: 1, unitCost: 0, unitPrice: 0, isActive: true });

  // Fetch all line items for selection dropdown
  const { data: lineItemsDropdown } = useQuery({
    queryKey: ["lineItemsDropdown"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/line-items", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    }
  });

  // Fetch construction items based on filter
  const { data: constructionItems, isLoading } = useQuery({
    queryKey: ["constructionItems", filterLiId],
    queryFn: async () => {
      const url = filterLiId === "All" ? "/api/v1/master-data/construction-items" : `/api/v1/master-data/construction-items?lineItemId=${filterLiId}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch construction items");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/master-data/construction-items/${data.id}` : "/api/v1/master-data/construction-items", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["constructionItems"] });
      setShowModal(false);
      setFormData({ name: "", lineItemId: filterLiId !== "All" ? filterLiId : "", category: "material", unit: "nos", quantityPerLineItem: 1, unitCost: 0, unitPrice: 0, isActive: true });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/construction-items/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["constructionItems"] });
    }
  });

  const handleEdit = (item: any) => {
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this construction item?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-4xl font-bold text-on-surface">Construction Items</h2>
            <p className="text-base text-on-surface-variant">Manage materials, labor, and equipment needed to build sub-components (Line Items).</p>
          </div>
          <button 
            onClick={() => {
              setFormData({ name: "", lineItemId: filterLiId !== "All" ? filterLiId : (lineItemsDropdown?.[0]?.id || ""), category: "material", unit: "nos", quantityPerLineItem: 1, unitCost: 0, unitPrice: 0, isActive: true });
              setShowModal(true);
            }} 
            className="flex items-center gap-2 px-6 py-4 bg-primary text-on-primary rounded-lg hover:opacity-90 font-bold transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Add Construction Item</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center gap-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Filter by Line Item:</span>
            <select 
              value={filterLiId} 
              onChange={e => setSearchParams({ lineItemId: e.target.value })}
              className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
            >
              <option value="All">All Line Items</option>
              {lineItemsDropdown?.map((li: any) => (
                <option key={li.id} value={li.id}>{li.requirement?.name} &rarr; {li.name}</option>
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
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Parent Component</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-center">Qty / Line Item</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Unit Cost</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading construction items...</td>
                  </tr>
                ) : !constructionItems || constructionItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-on-surface-variant italic">No construction items found. Choose another component or click "Add Construction Item" to create one.</td>
                  </tr>
                ) : (
                  constructionItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded text-primary">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold block">{item.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 capitalize font-semibold text-on-surface-variant">{item.category}</td>
                      <td className="px-6 py-5 font-medium text-on-surface-variant">{item.lineItem?.requirement?.name} &rarr; {item.lineItem?.name}</td>
                      <td className="px-6 py-5 text-on-surface-variant font-medium uppercase">{item.unit}</td>
                      <td className="px-6 py-5 text-center font-bold">{item.quantityPerLineItem}</td>
                      <td className="px-6 py-5 font-semibold text-secondary">{formatCurrency(item.unitCost)}</td>
                      <td className="px-6 py-5 font-extrabold text-primary">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          item.isActive 
                            ? "bg-green-100 text-green-700" 
                            : "bg-surface-variant text-on-surface-variant"
                        }`}>
                          {item.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
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
              <h2 className="text-xl font-bold mb-4">{formData.id ? "Edit Construction Item" : "Add Construction Item"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Parent Line Item</label>
                  <select 
                    className="w-full border rounded p-2 text-sm" 
                    value={formData.lineItemId}
                    onChange={e => setFormData({ ...formData, lineItemId: e.target.value })}
                  >
                    <option value="" disabled>Select Line Item</option>
                    {lineItemsDropdown?.map((li: any) => (
                      <option key={li.id} value={li.id}>{li.requirement?.name} &rarr; {li.name}</option>
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
                    <label className="block text-sm font-semibold mb-1">Category</label>
                    <select 
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.category} 
                      onChange={e => setFormData({ ...formData, category: e.target.value })} 
                    >
                      <option value="material">Material</option>
                      <option value="labor">Labor</option>
                      <option value="equipment">Equipment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Unit</label>
                    <input 
                      type="text" 
                      className="w-full border rounded p-2 text-sm" 
                      placeholder="e.g. nos, sqft, hr"
                      value={formData.unit} 
                      onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-[11px] uppercase">Qty / Line Item</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.quantityPerLineItem} 
                      onChange={e => setFormData({ ...formData, quantityPerLineItem: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-[11px] uppercase">Unit Cost</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.unitCost} 
                      onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-[11px] uppercase">Unit Price</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border rounded p-2 text-sm" 
                      value={formData.unitPrice} 
                      onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })} 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.isActive} 
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })} 
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold cursor-pointer">Active</label>
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
                    disabled={saveMutation.isPending || !formData.name || !formData.lineItemId}
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
