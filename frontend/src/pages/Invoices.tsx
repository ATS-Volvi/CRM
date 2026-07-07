import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FileText, Download, CheckCircle, Clock, AlertCircle } from "lucide-react";
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
    return <div className="p-8">Loading invoices...</div>;
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-on-surface-variant">Manage and track billing</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Invoice ID</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Client</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Amount</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Due Date</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {invoices?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">No invoices found. Generate one from an approved quote.</td>
                </tr>
              ) : (
                invoices?.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">INV-{invoice.id.substring(0,6).toUpperCase()}</td>
                    <td className="px-6 py-4">{invoice.quote?.deal?.lead?.company || invoice.quote?.deal?.lead?.firstName + " " + invoice.quote?.deal?.lead?.lastName}</td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                    <td className="px-6 py-4 text-sm">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      {invoice.status === 'Paid' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full"><CheckCircle className="w-3 h-3" /> Paid</span>}
                      {invoice.status === 'Sent' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full"><FileText className="w-3 h-3" /> Sent</span>}
                      {invoice.status === 'Draft' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-surface-variant text-on-surface-variant text-xs font-bold rounded-full"><Clock className="w-3 h-3" /> Draft</span>}
                      {invoice.status === 'Overdue' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full"><AlertCircle className="w-3 h-3" /> Overdue</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.status === 'Draft' && (
                          <button onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'Sent' })} className="px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90">Mark Sent</button>
                        )}
                        {invoice.status === 'Sent' && (
                          <button onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: 'Paid' })} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:opacity-90">Mark Paid</button>
                        )}
                        <Link to={`/invoices/${invoice.id}`} className="px-3 py-1 border border-outline text-xs font-bold rounded hover:bg-surface-container">View</Link>
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
