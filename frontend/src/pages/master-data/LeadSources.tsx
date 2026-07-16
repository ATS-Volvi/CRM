import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Plus, Edit2, Trash2, Check, X, ShieldAlert } from "lucide-react";

export default function LeadSources() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding
  useEffect(() => {
    if (isAdding) {
      addInputRef.current?.focus();
    }
  }, [isAdding]);

  // Focus input when editing
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["leadSources"],
    queryFn: async () => {
      const res = await fetch("/api/v1/lead-sources", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch lead sources");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const res = await fetch(isEdit ? `/api/v1/lead-sources/${data.id}` : "/api/v1/lead-sources", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadSources"] });
      setIsAdding(false);
      setAddName("");
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/lead-sources/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadSources"] });
    }
  });

  const handleToggleStatus = (source: any) => {
    saveMutation.mutate({
      id: source.id,
      name: source.name,
      isActive: !source.isActive
    });
  };

  const handleAddSubmit = () => {
    if (!addName.trim()) return;
    saveMutation.mutate({ name: addName, isActive: true });
  };

  const handleEditSubmit = (id: string, isActive: boolean) => {
    if (!editName.trim()) return;
    saveMutation.mutate({ id, name: editName, isActive });
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Lead Sources</h2>
            <p className="text-xs text-on-surface-variant">Manage external source channels (e.g. Website, LinkedIn, Trade Shows).</p>
          </div>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
          >
            <span>+ Add Lead Source</span>
          </button>
        )}
      </div>

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">Source Name</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            
            {/* Inline Add Row at the top */}
            {isAdding && (
              <tr className="bg-primary/5">
                <td className="px-6 py-3">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubmit();
                      if (e.key === "Escape") setIsAdding(false);
                    }}
                    placeholder="Enter source name..."
                    className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                  />
                </td>
                <td className="px-6 py-3 text-xs font-bold text-on-surface-variant">Active (Default)</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={handleAddSubmit} className="p-1 hover:bg-primary/10 rounded text-primary">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsAdding(false)} className="p-1 hover:bg-error-container hover:text-on-error-container rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading lead sources...</td>
              </tr>
            ) : sources?.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No lead sources defined.</td>
              </tr>
            ) : (
              sources?.map((source: any) => {
                const isEditingThis = editingId === source.id;
                return (
                  <tr key={source.id} className="group hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-3">
                      {isEditingThis ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSubmit(source.id, source.isActive);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="bg-surface border border-outline rounded px-2 py-1 text-xs font-semibold focus:outline-none"
                        />
                      ) : (
                        <span className="font-bold text-on-surface">{source.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <button 
                        onClick={() => handleToggleStatus(source)}
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                          source.isActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {source.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {isEditingThis ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleEditSubmit(source.id, source.isActive)} className="p-1 text-primary">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-on-surface-variant">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingId(source.id);
                              setEditName(source.name);
                            }} 
                            className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm("Are you sure?")) deleteMutation.mutate(source.id);
                            }}
                            className="p-1 hover:bg-error-container hover:text-on-error-container rounded text-error"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

    </div>
  );
}
