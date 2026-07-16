import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Edit2, Trash2, Sliders, Check, X } from "lucide-react";

export default function LineItems() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterReqId = searchParams.get("requirementId") || "All";

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", requirementId: "", unit: "nos", description: "", defaultQuantity: 1 });

  // Fetch all requirements for tabs and selection dropdown
  const { data: requirements } = useQuery<any[]>({
    queryKey: ["requirementsDropdown"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      return res.json();
    }
  });

  // Fetch all line items (we filter client-side or fetch via query)
  const { data: allLineItems, isLoading } = useQuery<any[]>({
    queryKey: ["lineItemsAll"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/line-items", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    }
  });

  // Filter line items based on selected tab requirementId
  const filteredLineItems = allLineItems?.filter((item: any) => {
    return filterReqId === "All" || item.requirementId === filterReqId;
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
      queryClient.invalidateQueries({ queryKey: ["lineItemsAll"] });
      setIsFormOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["lineItemsAll"] });
    }
  });

  const handleEdit = (item: any) => {
    setFormData(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this line item? All nested construction items will be deleted.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTabChange = (reqId: string) => {
    setSearchParams({ requirementId: reqId });
    setFormData((prev: any) => ({
      ...prev,
      requirementId: reqId === "All" ? "" : reqId
    }));
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Sliders className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Line Items</h2>
            <p className="text-xs text-on-surface-variant">Manage sub-components that form a Requirement (e.g. Doors, Windows, Exhaust fans).</p>
          </div>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => {
              setFormData({ 
                name: "", 
                requirementId: filterReqId !== "All" ? filterReqId : (requirements?.[0]?.id || ""), 
                unit: "nos", 
                description: "", 
                defaultQuantity: 1 
              });
              setIsFormOpen(true);
            }} 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <span>+ Add Line Item</span>
          </button>
        )}
      </div>

      {/* Requirement tabs navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant">
        <button
          onClick={() => handleTabChange("All")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            filterReqId === "All"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          All Items ({allLineItems?.length || 0})
        </button>
        {requirements?.map(req => {
          const count = allLineItems?.filter(li => li.requirementId === req.id).length || 0;
          return (
            <button
              key={req.id}
              onClick={() => handleTabChange(req.id)}
              className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                filterReqId === req.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {req.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Inline Form Card above table */}
      {isFormOpen && (
        <div className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">{formData.id ? "Edit Line Item" : "Add New Line Item"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Line Item Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Single Leaf Flush Door"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Deliverable (Requirement Category)</label>
              <select 
                value={formData.requirementId}
                onChange={e => setFormData({ ...formData, requirementId: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">Select Requirement</option>
                {requirements?.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit</label>
              <input 
                type="text" 
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. nos, sqm, set"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Default Quantity</label>
              <input 
                type="number" 
                value={formData.defaultQuantity}
                onChange={e => setFormData({ ...formData, defaultQuantity: parseInt(e.target.value) || 1 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description</label>
              <textarea 
                rows={2}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Spec details (dimensions, material specifications)..."
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
              {formData.id ? "Save Changes" : "Create Line Item"}
            </button>
          </div>
        </div>
      )}

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Unit</th>
              <th className="px-6 py-3.5 text-center">Default Qty</th>
              <th className="px-6 py-3.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading line items...</td>
              </tr>
            ) : filteredLineItems?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No line items defined in this category.</td>
              </tr>
            ) : (
              filteredLineItems?.map((li: any) => (
                <tr 
                  key={li.id} 
                  className="group hover:bg-surface-container-low/30 transition-colors"
                >
                  <td className="px-6 py-3">
                    <Link to={`/master-data/construction-items?lineItemId=${li.id}`} className="font-bold text-primary hover:underline">
                      {li.name}
                    </Link>
                    {li.description && (
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5">{li.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 font-semibold text-on-surface-variant text-xs">{li.requirement?.name || "—"}</td>
                  <td className="px-6 py-3 text-on-surface-variant text-xs font-medium">{li.unit}</td>
                  <td className="px-6 py-3 text-center text-on-surface font-semibold">{li.defaultQuantity}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(li)} 
                        className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(li.id)}
                        className="p-1 hover:bg-error-container hover:text-on-error-container rounded text-error"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
