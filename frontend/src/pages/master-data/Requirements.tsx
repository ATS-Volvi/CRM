import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Layers, Check, X } from "lucide-react";

export default function Requirements() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Requirements</h2>
            <p className="text-xs text-on-surface-variant">Manage high-level deliverables and structures (e.g. Prefab structures, portable cabins).</p>
          </div>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => {
              setFormData({ name: "", category: "Prefab Structure", description: "", isActive: true });
              setIsFormOpen(true);
            }} 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <span>+ Add Requirement</span>
          </button>
        )}
      </div>

      {/* Inline Form Card above table */}
      {isFormOpen && (
        <div className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">{formData.id ? "Edit Requirement" : "Add New Requirement"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Requirement Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Executive Portable Office"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="Prefab Structure">Prefab Structure</option>
                <option value="Portable Cabin">Portable Cabin</option>
                <option value="Modular Unit">Modular Unit</option>
                <option value="Restroom Unit">Restroom Unit</option>
                <option value="Custom Cabin">Custom Cabin</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description</label>
              <textarea 
                rows={2}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary of configuration and standards..."
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
              {formData.id ? "Save Changes" : "Create Requirement"}
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
              <th className="px-6 py-3.5">Description</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading requirements...</td>
              </tr>
            ) : requirements?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No requirements defined.</td>
              </tr>
            ) : (
              requirements?.map((req: any) => (
                <tr 
                  key={req.id} 
                  onClick={() => handleRowClick(req.id)}
                  className="group hover:bg-surface-container-low/30 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3 font-bold text-primary hover:underline">{req.name}</td>
                  <td className="px-6 py-3 font-semibold text-on-surface-variant text-xs">{req.category}</td>
                  <td className="px-6 py-3 text-on-surface-variant max-w-xs truncate text-xs" title={req.description}>
                    {req.description || "—"}
                  </td>
                  <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
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
                  <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(req)} 
                        className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(req.id)}
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
