import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  FileText, Download, CheckCircle2, Clock, AlertCircle, 
  Eye, Receipt, CreditCard, DollarSign, Search, Filter 
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function Invoices() {
  const { token, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch("/api/v1/invoices", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    }
  });

  const filteredInvoices = (invoices || []).filter((inv: any) => {
    const company = inv.quote?.deal?.lead?.company || "";
    const contact = `${inv.quote?.deal?.lead?.firstName || ""} ${inv.quote?.deal?.lead?.lastName || ""}`;
    const invNumber = `INV-${inv.id.substring(0, 6)}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = invNumber.includes(query) || company.toLowerCase().includes(query) || contact.toLowerCase().includes(query);
    const pStatus = (inv.paymentStatus || "unpaid").toLowerCase();
    const matchesStatus = statusFilter === "all" || pStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate high level metrics
  const totalInvoiced = (invoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount || 0) * 1.05), 0);
  const totalCollected = (invoices || []).reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalCollected);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-medium">Loading invoices & accounts receivable...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4" />
            <span>Operations & Finance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface">Invoices & Receivables</h1>
          <p className="text-sm text-on-surface-variant mt-1">Track billing, invoice line items, real-time payment status, and collected balances.</p>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Invoiced</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-on-surface mt-2">{formatCurrency(totalInvoiced)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{(invoices || []).length} total invoices issued</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Collected Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(totalCollected)}</p>
          <p className="text-xs text-emerald-700 mt-1">
            {totalInvoiced > 0 ? `${Math.round((totalCollected / totalInvoiced) * 100)}% collection rate` : "0% collected"}
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Outstanding AR</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{formatCurrency(outstandingBalance)}</p>
          <p className="text-xs text-amber-700 mt-1">Pending customer settlement</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice ID or client..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-on-surface-variant" />
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payment:</span>
          <div className="flex flex-wrap gap-1">
            {["all", "unpaid", "partial", "paid", "overdue"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  statusFilter === status
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Table Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Invoice ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Client / Account</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total (inc. VAT)</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Payment Progress</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Payment Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center space-y-3">
                    <p className="font-bold text-on-surface-variant text-sm">No invoices match your filter criteria.</p>
                    <Link to="/quotes" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity">
                      View Quotes to Generate Invoices
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice: any) => {
                  const invSubtotal = Number(invoice.totalAmount || 0);
                  const invTotal = invSubtotal * 1.05;
                  const invPaid = Number(invoice.amountPaid || 0);
                  const pStatus = (invoice.paymentStatus || "unpaid").toLowerCase();
                  const pct = invTotal > 0 ? Math.min(100, Math.round((invPaid / invTotal) * 100)) : 0;

                  return (
                    <tr key={invoice.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/invoices/${invoice.id}`} className="font-mono font-bold text-primary text-xs hover:underline flex items-center gap-1">
                          INV-{invoice.id.substring(0, 6).toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-surface text-sm">
                          {invoice.quote?.deal?.lead?.company || "Valued Client"}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {invoice.quote?.deal?.lead?.firstName} {invoice.quote?.deal?.lead?.lastName}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-bold text-on-surface text-sm font-mono">
                        {formatCurrency(invTotal)}
                      </td>
                      <td className="px-6 py-4 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant">
                            <span>{formatCurrency(invPaid)}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pStatus === "paid" ? "bg-emerald-500" : pStatus === "partial" ? "bg-amber-500" : "bg-slate-300"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                          pStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : pStatus === "partial"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : pStatus === "overdue"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                          {pStatus === "paid" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {pStatus === "partial" && <Clock className="w-3 h-3 text-amber-600" />}
                          {pStatus === "overdue" && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {pStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">
                        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Net 30"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" /> View & Pay
                        </Link>
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
  );
}
