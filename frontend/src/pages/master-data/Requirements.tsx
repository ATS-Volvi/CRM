import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Layers, Check, X, Search, DollarSign, Package } from "lucide-react";
import { MasterDataNav } from "../../components/MasterDataNav";
import { formatCurrency } from "../../utils/currency";

export default function Requirements() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: "", category: "Prefab Structure", description: "", isActive: true });

  const { data: requirements, isLoading } = useQuery({
    queryKey: ["requirements"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/master-data/requirements/${data.id}` : "/api/v1/master-data/requirements", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      setIsFormOpen(false);
      setFormData({ name: "", category: "Prefab Structure", description: "", isActive: true });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/requirements/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
    }
  });

  const handleToggleStatus = (req: any) => {
    saveMutation.mutate({
      ...req,
      isActive: !req.isActive
    });
  };

  const handleEdit = (item: any) => {
    setFormData(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this requirement? All nested line items will be deleted.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/master-data/line-items?requirementId=${id}`);
  };

  const categories = useMemo(() => {
    if (!requirements) return [];
    const set = new Set<string>();
    requirements.forEach((r: any) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [requirements]);

  const filteredRequirements = useMemo(() => {
    if (!requirements) return [];
    return requirements.filter((r: any) => {
      const matchSearch = !search || 
        r.name?.toLowerCase().includes(search.toLowerCase()) || 
        r.category?.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === "All" || r.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [requirements, search, selectedCategory]);

  return (
    <div className="w-full px-6 md:px-8 py-6 space-y-6 animate-fade-in">
      <MasterDataNav />
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Service Types</h2>
            <p className="text-xs text-on-surface-variant">Manage master service types, service packages, and deliverable categories.</p>
          </div>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => {
              setFormData({ name: "", category: categories[0] || "Prefab Structure", description: "", isActive: true });
              setIsFormOpen(true);
            }} 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service Type</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant p-3 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-on-surface-variant/60" />
          <input 
            type="text" 
            placeholder="Search service types, categories, specs..."
            className="w-full bg-transparent text-xs font-semibold focus:outline-none placeholder:text-on-surface-variant/40"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Category:</span>
            <select 
              className="bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories ({requirements?.length || 0})</option>
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Inline Form Card above table */}
      {isFormOpen && (
        <div className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">{formData.id ? "Edit Service Type" : "Add New Service Type"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Service Type Name *</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Modular Kitchen Unit, Site Office Cabin"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category *</label>
              <input 
                type="text" 
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Modular Kitchen, Portable Cabins, HVAC Systems"
                list="category-suggestions"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
              <datalist id="category-suggestions">
                {categories.map((c: string) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description / Specifications</label>
              <textarea 
                rows={2}
                value={formData.description || ""}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary of configuration and standard components..."
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
              onClick={() => {
                if (!formData.name) {
                  alert("Please enter a service type name.");
                  return;
                }
                saveMutation.mutate(formData);
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
            >
              {formData.id ? "Save Changes" : "Create Service Type"}
            </button>
          </div>
        </div>
      )}

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">Service Type</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5 text-center">Service Items</th>
              <th className="px-6 py-3.5 text-right">Est. Rollup Rate</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading service types...</td>
              </tr>
            ) : filteredRequirements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">
                  {search || selectedCategory !== "All" ? "No service types matching filters." : "No service types defined."}
                </td>
              </tr>
            ) : (
              filteredRequirements.map((req: any) => {
                const itemCount = req.lineItems?.length || 0;
                return (
                  <tr 
                    key={req.id} 
                    onClick={() => handleRowClick(req.id)}
                    className="group hover:bg-surface-container-low/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <div>
                        <span className="font-bold text-primary hover:underline">{req.name}</span>
                        {req.description && (
                          <p className="text-[11px] text-on-surface-variant/70 line-clamp-1 max-w-sm">{req.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-xs font-semibold text-on-surface-variant">
                        {req.category || "General"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        itemCount > 0 
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        <Package className="w-3 h-3" />
                        {itemCount} {itemCount === 1 ? "service item" : "service items"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-on-surface text-xs">
                      {req.totalPrice > 0 ? formatCurrency(req.totalPrice) : "—"}
                    </td>
                    <td className="px-6 py-3.5" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleStatus(req)}
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                          req.isActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {req.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(req)} 
                          className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                          title="Edit Requirement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(req.id)}
                          className="p-1 hover:bg-error-container hover:text-on-error-container rounded text-error"
                          title="Delete Requirement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

