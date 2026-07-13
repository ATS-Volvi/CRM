import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Save, Edit3 } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function Pricing() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterReqId, setFilterReqId] = useState("All");
  
  // Track currently active inline edit cell
  const [editCell, setEditCell] = useState<{ id: string; field: "unitCost" | "unitPrice"; value: string } | null>(null);

  // Fetch requirements for filter dropdown
  const { data: requirements } = useQuery({
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
  const { data: pricingGrid, isLoading } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      queryClient.invalidateQueries({ queryKey: ["lineItems"] });
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
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        {/* Page Header */}
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-on-surface">Pricing Grid</h2>
          <p className="text-base text-on-surface-variant">Review procurement costs, set sell prices, and optimize margins across all structures.</p>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
            <input 
              type="text"
              placeholder="Search construction items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-on-surface"
            />
          </div>

          {/* Requirement Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant whitespace-nowrap">Filter by Requirement:</span>
            <select 
              value={filterReqId} 
              onChange={e => setFilterReqId(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm focus:ring-primary focus:outline-none text-on-surface"
            >
              <option value="All">All Requirements</option>
              {requirements?.map((req: any) => (
                <option key={req.id} value={req.id}>{req.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing Grid Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0 border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">BOM Breadcrumb</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-center">Unit Cost (SAR)</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-center">Unit Price (SAR)</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading pricing data...</td>
                  </tr>
                ) : !pricingGrid || pricingGrid.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant italic">No pricing entries found matching search/filter.</td>
                  </tr>
                ) : (
                  pricingGrid.map((item: any) => {
                    const cost = parseFloat(item.unitCost) || 0;
                    const price = parseFloat(item.unitPrice) || 0;
                    const margin = item.margin;

                    // Determine margin color-code class
                    let marginBadge = "bg-green-100 text-green-700";
                    if (margin < 10) {
                      marginBadge = "bg-red-100 text-red-700";
                    } else if (margin < 20) {
                      marginBadge = "bg-amber-100 text-amber-700";
                    }

                    return (
                      <tr key={item.id} className="hover:bg-surface-container-high transition-colors group">
                        <td className="px-6 py-5">
                          <span className="font-bold text-on-surface block">{item.name}</span>
                          <span className="text-xs text-on-surface-variant capitalize">{item.category}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-surface-variant text-on-surface-variant border border-outline-variant capitalize">{item.category}</span>
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant text-[12px]">
                          <span className="font-semibold text-primary">{item.lineItem?.requirement?.name}</span>
                          <span className="mx-1.5 text-outline">&rarr;</span>
                          <span className="font-medium">{item.lineItem?.name}</span>
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant uppercase font-medium">{item.unit}</td>
                        
                        {/* Unit Cost Editable Cell */}
                        <td className="px-6 py-5 text-center font-semibold">
                          {editCell && editCell.id === item.id && editCell.field === "unitCost" ? (
                            <input 
                              type="number"
                              step="0.01"
                              autoFocus
                              value={editCell.value}
                              onChange={e => setEditCell({ ...editCell, value: e.target.value })}
                              onBlur={() => handleBlur(item.id, "unitCost")}
                              onKeyDown={e => handleKeyDown(e, item.id, "unitCost")}
                              className="w-24 px-2 py-1 border rounded text-sm text-center outline-none focus:ring-1 focus:ring-primary bg-surface text-on-surface"
                            />
                          ) : (
                            <div 
                              onClick={() => setEditCell({ id: item.id, field: "unitCost", value: String(cost) })}
                              className="cursor-pointer hover:bg-surface-container px-2 py-1 rounded inline-flex items-center gap-1.5 group-hover:text-secondary"
                            >
                              <span>{formatCurrency(cost)}</span>
                              <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-outline" />
                            </div>
                          )}
                        </td>

                        {/* Unit Price Editable Cell */}
                        <td className="px-6 py-5 text-center font-extrabold">
                          {editCell && editCell.id === item.id && editCell.field === "unitPrice" ? (
                            <input 
                              type="number"
                              step="0.01"
                              autoFocus
                              value={editCell.value}
                              onChange={e => setEditCell({ ...editCell, value: e.target.value })}
                              onBlur={() => handleBlur(item.id, "unitPrice")}
                              onKeyDown={e => handleKeyDown(e, item.id, "unitPrice")}
                              className="w-24 px-2 py-1 border rounded text-sm text-center outline-none focus:ring-1 focus:ring-primary bg-surface text-on-surface"
                            />
                          ) : (
                            <div 
                              onClick={() => setEditCell({ id: item.id, field: "unitPrice", value: String(price) })}
                              className="cursor-pointer hover:bg-surface-container px-2 py-1 rounded inline-flex items-center gap-1.5 group-hover:text-primary"
                            >
                              <span>{formatCurrency(price)}</span>
                              <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-outline" />
                            </div>
                          )}
                        </td>

                        {/* Margin % Cell */}
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${marginBadge}`}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
