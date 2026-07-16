import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Save, Edit3, DollarSign, Check, X } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function Pricing() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterReqId, setFilterReqId] = useState("All");
  
  // Track currently active inline edit cell
  const [editCell, setEditCell] = useState<{ id: string; field: "unitCost" | "unitPrice"; value: string } | null>(null);

  // Fetch requirements for filter tabs
  const { data: requirements } = useQuery<any[]>({
    queryKey: ["requirementsDropdownPricing"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      return res.json();
    }
  });

  // Fetch flat pricing grid list
  const { data: pricingGrid, isLoading } = useQuery<any[]>({
    queryKey: ["pricingGrid", search, filterReqId],
    queryFn: async () => {
      let url = `/api/v1/master-data/pricing?search=${search}`;
      if (filterReqId !== "All") {
        url += `&requirementId=${filterReqId}`;
      }
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch pricing grid");
      return res.json();
    }
  });

  // Patch mutation to update pricing
  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, unitCost, unitPrice }: { id: string; unitCost?: number; unitPrice?: number }) => {
      const res = await fetch(`/api/v1/master-data/pricing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ unitCost, unitPrice })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricingGrid"] });
    }
  });

  const handleBlur = (id: string, field: "unitCost" | "unitPrice") => {
    if (!editCell) return;
    const val = parseFloat(editCell.value);
    if (!isNaN(val)) {
      updatePricingMutation.mutate({
        id,
        [field]: val
      });
    }
    setEditCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: "unitCost" | "unitPrice") => {
    if (e.key === "Enter") {
      handleBlur(id, field);
    } else if (e.key === "Escape") {
      setEditCell(null);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Pricing Grid</h2>
            <p className="text-xs text-on-surface-variant">Review procurement costs, set sell prices, and optimize margins across all structures.</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search construction items..."
            className="w-full bg-surface border border-outline rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant">
        <button
          onClick={() => setFilterReqId("All")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            filterReqId === "All"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          All Categories
        </button>
        {requirements?.map(req => (
          <button
            key={req.id}
            onClick={() => setFilterReqId(req.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              filterReqId === req.id
                ? "bg-primary text-white shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {req.name}
          </button>
        ))}
      </div>

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">Component / Item</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Unit</th>
              <th className="px-6 py-3.5 text-right">Procurement Cost</th>
              <th className="px-6 py-3.5 text-right">Target Sell Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading pricing data...</td>
              </tr>
            ) : pricingGrid?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No pricing records matched search filters.</td>
              </tr>
            ) : (
              pricingGrid?.map((item: any) => (
                <tr key={item.id} className="group hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-3">
                    <span className="font-bold text-on-surface">{item.name}</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">{item.lineItem?.name || "Global Catalogue"}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-outline-variant bg-surface-container-low text-on-surface-variant">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-on-surface-variant font-medium">{item.unit}</td>
                  
                  {/* Cost Cell (Inline input on click) */}
                  <td className="px-6 py-3 text-right">
                    {editCell && editCell.id === item.id && editCell.field === "unitCost" ? (
                      <input 
                        type="number"
                        step="any"
                        value={editCell.value}
                        onChange={e => setEditCell({ id: editCell.id, field: editCell.field, value: e.target.value })}
                        onBlur={() => handleBlur(item.id, "unitCost")}
                        onKeyDown={e => handleKeyDown(e, item.id, "unitCost")}
                        className="w-20 bg-surface border border-primary rounded p-1 text-right text-xs font-bold"
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={() => setEditCell({ id: item.id, field: "unitCost", value: String(item.unitCost) })}
                        className="cursor-pointer hover:bg-surface-container hover:text-primary px-2 py-1 rounded font-bold text-on-surface"
                      >
                        {formatCurrency(item.unitCost)}
                      </span>
                    )}
                  </td>

                  {/* Price Cell (Inline input on click) */}
                  <td className="px-6 py-3 text-right">
                    {editCell && editCell.id === item.id && editCell.field === "unitPrice" ? (
                      <input 
                        type="number"
                        step="any"
                        value={editCell.value}
                        onChange={e => setEditCell({ id: editCell.id, field: editCell.field, value: e.target.value })}
                        onBlur={() => handleBlur(item.id, "unitPrice")}
                        onKeyDown={e => handleKeyDown(e, item.id, "unitPrice")}
                        className="w-20 bg-surface border border-primary rounded p-1 text-right text-xs font-bold"
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={() => setEditCell({ id: item.id, field: "unitPrice", value: String(item.unitPrice) })}
                        className="cursor-pointer hover:bg-surface-container hover:text-primary px-2 py-1 rounded font-bold text-primary"
                      >
                        {formatCurrency(item.unitPrice)}
                      </span>
                    )}
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
