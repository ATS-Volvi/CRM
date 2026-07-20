import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, MoreVertical, Plus, Filter, Search } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function PurchaseOrders() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [valueBand, setValueBand] = useState("");

  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders", search, valueBand],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (valueBand) params.append("valueBand", valueBand);
      
      const res = await fetch(`/api/v1/purchase-orders?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      return res.json();
    }
  });

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (valueBand) params.append("valueBand", valueBand);

    try {
      const res = await fetch(`/api/v1/exports/purchase-orders?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export POs");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "purchase_orders_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Purchase Orders Register</h1>
          <p className="text-on-surface-variant">Manage and track POs from clients</p>
        </div>
        <Link to="/quotes" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 shadow-sm text-sm">
          <Plus className="w-5 h-5" /> New PO
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-outline-variant">
          <Filter className="w-5 h-5 text-outline" />
          <span className="text-[12px] font-semibold tracking-wider text-on-surface uppercase font-bold">Filter By</span>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <input 
            type="text"
            placeholder="Search PO # or Client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none w-64"
          />
          
          <select 
            value={valueBand}
            onChange={(e) => setValueBand(e.target.value)}
            className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">All Value Bands</option>
            <option value="low">Low (≤ $10k)</option>
            <option value="medium">Medium ($10k - $50k)</option>
            <option value="high">High (&gt; $50k)</option>
          </select>
        </div>

        <button 
          onClick={handleExport}
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
          <h2 className="text-lg font-semibold">Recent Purchase Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">PO Number</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Client</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Amount</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading purchase orders...</td>
                </tr>
              ) : (
                pos?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center space-y-3">
                      <p className="font-bold text-on-surface-variant">No purchase orders registered yet — upload or verify client PO documents.</p>
                      <Link to="/quotes" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90">
                        View Approved Quotes
                      </Link>
                    </td>
                  </tr>
                ) : (
                pos?.map((po: any) => {
                  const clientName = po.quote?.deal?.lead?.company || po.quote?.deal?.lead?.firstName + " " + po.quote?.deal?.lead?.lastName || "Unknown Client";
                  return (
                  <tr key={po.id} className="hover:bg-surface-container transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{po.poNumber || po.id.substring(0,8)}</td>
                    <td className="px-6 py-4">{clientName}</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(po.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${po.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          if (po.quoteId) window.open(`/api/v1/quotes/${po.quoteId}/pdf`, "_blank");
                          else alert("No associated quote document found.");
                        }}
                        className="p-2 text-on-surface-variant hover:text-primary"
                        title="Download Associated Quote PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => alert(`PO Detail - Number: ${po.poNumber || po.id.substring(0,8)}\nStatus: ${po.status}\nAmount: $${po.amount}`)}
                        className="p-2 text-on-surface-variant hover:text-primary"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
