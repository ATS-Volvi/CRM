import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FileText, Download, CheckCircle, Clock, AlertCircle, Eye, Receipt } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function Invoices() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch("/api/v1/invoices", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/v1/invoices/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-medium">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>Operations & Finance</span>
          </div>
          <h1 className="text-4xl font-bold text-on-surface">Invoices</h1>
          <p className="text-sm text-on-surface-variant mt-1">Manage billing, track accounts receivable, and update payment status.</p>
        </div>
      </div>

      {/* Invoice list container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Invoice ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {!invoices || invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center space-y-3">
                    <p className="font-bold text-on-surface-variant">No invoices found. Invoices are generated from approved quotes.</p>
                    <Link to="/quotes" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm hover:opacity-90">
                      View Approved Quotes
                    </Link>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary text-xs">
                      INV-{invoice.id.substring(0,6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-on-surface text-sm">
                      {invoice.quote?.deal?.lead?.company || `${invoice.quote?.deal?.lead?.firstName || ""} ${invoice.quote?.deal?.lead?.lastName || ""}`}
                    </td>
                    <td className="px-6 py-4 font-bold text-on-surface text-sm">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {invoice.status === 'Paid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase rounded-full border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      )}
                      {invoice.status === 'Sent' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full border border-primary/20">
                          <FileText className="w-3 h-3" /> Sent
                        </span>
                      )}
                      {invoice.status === 'Draft' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-outline-variant/30 text-on-surface-variant text-[10px] font-bold uppercase rounded-full border border-outline/25">
                          <Clock className="w-3 h-3" /> Draft
                        </span>
                      )}
                      {invoice.status === 'Overdue' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-error-container text-error text-[10px] font-bold uppercase rounded-full border border-error/20">
                          <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.status === 'Draft' && (
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'Sent' })} 
                            className="px-3 py-1 bg-primary text-on-primary text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all"
                          >
                            Mark Sent
                          </button>
                        )}
                        {invoice.status === 'Sent' && (
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'Paid' })} 
                            className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all"
                          >
                            Mark Paid
                          </button>
                        )}
                        <Link 
                          to={`/invoices/${invoice.id}`} 
                          className="px-3 py-1 bg-surface-container border border-outline-variant text-[10px] font-bold uppercase rounded hover:bg-surface-container-high transition-all flex items-center gap-1 text-on-surface"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
