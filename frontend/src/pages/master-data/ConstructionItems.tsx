import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Edit2, Trash2, ShieldCheck, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function ConstructionItems() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterLiId = searchParams.get("lineItemId") || "All";

  // Form toggles
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", lineItemId: "", category: "material", unit: "nos", quantityPerLineItem: 1, unitCost: 0, unitPrice: 0, isActive: true });
  
  // Track expanded row ID for expandable edit form
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any | null>(null);

  // Fetch all line items for tabs and selection dropdown
  const { data: lineItems } = useQuery<any[]>({
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
  const { data: constructionItems, isLoading } = useQuery<any[]>({
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
      setIsFormOpen(false);
      setExpandedId(null);
      setEditFormData(null);
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

  const handleToggleStatus = (item: any) => {
    saveMutation.mutate({
      ...item,
      isActive: !item.isActive
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this construction item?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTabChange = (liId: string) => {
    setSearchParams({ lineItemId: liId });
    setFormData((prev: any) => ({
      ...prev,
      lineItemId: liId === "All" ? "" : liId
    }));
  };

  const toggleExpandRow = (item: any) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setEditFormData(null);
    } else {
      setExpandedId(item.id);
      setEditFormData({ ...item });
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Construction Items</h2>
            <p className="text-xs text-on-surface-variant">Manage materials, labor, and equipment needed to build sub-components (Line Items).</p>
          </div>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => {
              setFormData({ 
                name: "", 
                lineItemId: filterLiId !== "All" ? filterLiId : (lineItems?.[0]?.id || ""), 
                category: "material", 
                unit: "nos", 
                quantityPerLineItem: 1, 
                unitCost: 0, 
                unitPrice: 0, 
                isActive: true 
              });
              setIsFormOpen(true);
            }} 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <span>+ Add Construction Item</span>
          </button>
        )}
      </div>

      {/* Line Item Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant">
        <button
          onClick={() => handleTabChange("All")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
            filterLiId === "All"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          All Items
        </button>
        {lineItems?.map(li => {
          const count = constructionItems?.filter(ci => ci.lineItemId === li.id).length || 0;
          return (
            <button
              key={li.id}
              onClick={() => handleTabChange(li.id)}
              className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                filterLiId === li.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {li.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Inline Form Card above table (only for Create) */}
      {isFormOpen && (
        <div className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">Add New Construction Item</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Item Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 12mm Plywood"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Line Item Sub-Component</label>
              <select 
                value={formData.lineItemId}
                onChange={e => setFormData({ ...formData, lineItemId: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">Select Line Item</option>
                {lineItems?.map(li => (
                  <option key={li.id} value={li.id}>{li.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="material">Material</option>
                <option value="labor">Labor</option>
                <option value="equipment">Equipment</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit</label>
              <input 
                type="text" 
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. sqm, hrs, nos"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Qty Per Line Item</label>
              <input 
                type="number" 
                value={formData.quantityPerLineItem}
                onChange={e => setFormData({ ...formData, quantityPerLineItem: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit Cost ($)</label>
              <input 
                type="number" 
                value={formData.unitCost}
                onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit Sell Price ($)</label>
              <input 
                type="number" 
                value={formData.unitPrice}
                onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant"
            >
              Cancel
            </button>
            <button 
              onClick={() => saveMutation.mutate(formData)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
            >
              Create Item
            </button>
          </div>
        </div>
      )}

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="w-8"></th>
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Unit</th>
              <th className="px-6 py-3.5">Cost & Price</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading construction items...</td>
              </tr>
            ) : constructionItems?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No items defined in this category.</td>
              </tr>
            ) : (
              constructionItems?.map((ci: any) => {
                const isExpanded = expandedId === ci.id;
                return (
                  <>
                    {/* Summary Row */}
                    <tr 
                      key={ci.id} 
                      onClick={() => toggleExpandRow(ci)}
                      className={`group hover:bg-surface-container-low/30 cursor-pointer transition-colors ${
                        isExpanded ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="pl-4 py-3">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-bold text-on-surface">{ci.name}</span>
                        <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">{ci.lineItem?.name || "No component"}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          ci.category === "material" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          ci.category === "labor" ? "bg-amber-50 text-amber-700 border-amber-100" :
                          "bg-purple-50 text-purple-700 border-purple-100"
                        }`}>
                          {ci.category}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-on-surface-variant text-xs">{ci.unit}</td>
                      <td className="px-6 py-3 font-medium text-xs text-on-surface-variant">
                        Cost: <span className="font-bold text-on-surface">{formatCurrency(ci.unitCost)}</span>
                        <span className="mx-2">|</span>
                        Price: <span className="font-bold text-primary">{formatCurrency(ci.unitPrice)}</span>
                      </td>
                      <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleToggleStatus(ci)}
                          className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                            ci.isActive 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {ci.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleExpandRow(ci)} 
                            className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(ci.id)}
                            className="p-1 hover:bg-error-container hover:text-on-error-container rounded text-error"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Inline Edit Row */}
                    {isExpanded && editFormData && (
                      <tr className="bg-primary/5">
                        <td colSpan={7} className="px-8 py-5 border-t border-b border-primary/20">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Item Name</label>
                              <input 
                                type="text"
                                value={editFormData.name}
                                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
                              <select 
                                value={editFormData.category}
                                onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              >
                                <option value="material">Material</option>
                                <option value="labor">Labor</option>
                                <option value="equipment">Equipment</option>
                                <option value="subcontractor">Subcontractor</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit</label>
                              <input 
                                type="text"
                                value={editFormData.unit}
                                onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Qty Per Component</label>
                              <input 
                                type="number"
                                value={editFormData.quantityPerLineItem}
                                onChange={e => setEditFormData({ ...editFormData, quantityPerLineItem: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit Cost ($)</label>
                              <input 
                                type="number"
                                value={editFormData.unitCost}
                                onChange={e => setEditFormData({ ...editFormData, unitCost: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit Sell Price ($)</label>
                              <input 
                                type="number"
                                value={editFormData.unitPrice}
                                onChange={e => setEditFormData({ ...editFormData, unitPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end pt-4">
                            <button 
                              onClick={() => { setExpandedId(null); setEditFormData(null); }}
                              className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => saveMutation.mutate(editFormData)}
                              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
                            >
                              Save Changes
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
