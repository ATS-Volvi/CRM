import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Layers, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function Requirements() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
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
      setShowModal(false);
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

  const handleEdit = (item: any, e: any) => {
    e.stopPropagation();
    setFormData(item);
    setShowModal(true);
  };

  const handleDelete = (id: string, e: any) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this requirement? All nested line items will be deleted.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/master-data/line-items?requirementId=${id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-4xl font-bold text-on-surface">Requirements</h2>
            <p className="text-base text-on-surface-variant">Manage high-level deliverables and structures (e.g. Prefab structures, portable cabins).</p>
          </div>
          <button 
            onClick={() => {
              setFormData({ name: "", category: "Prefab Structure", description: "", isActive: true });
              setShowModal(true);
            }} 
            className="flex items-center gap-2 px-6 py-4 bg-primary text-on-primary rounded-lg hover:opacity-90 font-bold transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Add Requirement</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0 border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Requirement Name</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estimated Cost</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Sell Price</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading requirements...</td>
                  </tr>
                ) : !requirements || requirements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant italic">No requirements defined. Click "Add Requirement" to create one.</td>
                  </tr>
                ) : (
                  requirements.map((item: any) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleRowClick(item.id)}
                      className="hover:bg-surface-container-high transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded text-primary">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold block text-primary hover:underline">{item.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-semibold text-on-surface-variant">{item.category}</td>
                      <td className="px-6 py-5 text-on-surface-variant max-w-xs truncate">{item.description || "—"}</td>
                      <td className="px-6 py-5 font-medium text-secondary">{formatCurrency(item.totalCost || 0)}</td>
                      <td className="px-6 py-5 font-extrabold text-primary">{formatCurrency(item.totalPrice || 0)}</td>
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
                      <td className="px-6 py-5 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={(e) => handleEdit(item, e)}
                          className="p-2 hover:bg-surface-container-lowest rounded-full transition-colors text-outline"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(item.id, e)}
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
              <h2 className="text-xl font-bold mb-4">{formData.id ? "Edit Requirement" : "Add Requirement"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Name</label>
                  <input 
                    type="text" 
                    className="w-full border rounded p-2 text-sm" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <input 
                    type="text" 
                    className="w-full border rounded p-2 text-sm" 
                    placeholder="e.g. Prefab Structure"
                    value={formData.category} 
                    onChange={e => setFormData({ ...formData, category: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Description</label>
                  <textarea 
                    className="w-full border rounded p-2 text-sm h-24 resize-none" 
                    value={formData.description} 
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
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
                    disabled={saveMutation.isPending || !formData.name}
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
