import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { downloadAuthenticatedFile } from "../utils/download";
import { 
  Printer, Download, CreditCard, FileText, CheckCircle2, 
  Clock, AlertCircle, Calendar, User, ShieldCheck, ArrowLeft 
} from "lucide-react";
import { RecordPaymentModal } from "../components/RecordPaymentModal";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const userRole = (user?.role || "").toLowerCase();
  const canRecordPayment = ["admin", "manager", "senior_ae", "director"].includes(userRole);

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch invoice details");
      return res.json();
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="p-12 max-w-[1100px] mx-auto min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-medium">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-[1100px] mx-auto min-h-screen">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">Invoice not found.</span>
          </div>
          <Link to="/invoices" className="underline font-bold text-xs">Back to Invoices</Link>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.totalAmount || 0);
  const tax = subtotal * 0.05;
  const totalDue = subtotal * 1.05;
  const amountPaid = Number(invoice.amountPaid || 0);
  const remainingBalance = Math.max(0, totalDue - amountPaid);
  const percentPaid = totalDue > 0 ? Math.min(100, Math.round((amountPaid / totalDue) * 100)) : 0;
  const paymentStatus = (invoice.paymentStatus || "unpaid").toLowerCase();
  const paymentsList = invoice.payments || [];

  return (
    <div className="p-6 md:p-10 pb-24 max-w-[1150px] mx-auto min-h-screen space-y-8 animate-fade-in">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 text-xs font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <Link to="/invoices" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Invoices
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-primary font-mono">INV-{invoice.id.substring(0, 6).toUpperCase()}</span>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface-container border border-outline-variant text-on-surface text-xs font-bold rounded-xl shadow-sm hover:bg-surface-container-high transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button 
            onClick={() => downloadAuthenticatedFile(`/api/v1/invoices/${invoice.id}/pdf`, `Invoice_${invoice.id.substring(0,8)}.pdf`, token)}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface-container border border-outline-variant text-on-surface text-xs font-bold rounded-xl shadow-sm hover:bg-surface-container-high transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
          
          {/* Real Record Payment Button */}
          {canRecordPayment ? (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={paymentStatus === "paid" && remainingBalance <= 0}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all ${
                paymentStatus === "paid" && remainingBalance <= 0
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300 opacity-60 cursor-not-allowed"
                  : "bg-primary text-on-primary hover:opacity-90 shadow-primary/20"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {paymentStatus === "paid" && remainingBalance <= 0 ? "Fully Paid" : "Record Payment"}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low border border-outline-variant text-on-surface-variant text-[11px] font-semibold rounded-xl" title="Payment processing restricted to Senior AEs and Managers">
              <CreditCard className="w-3.5 h-3.5 opacity-50" />
              <span>Payments (Restricted)</span>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Overview Hero Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-on-surface font-mono">
              INV-{invoice.id.substring(0, 6).toUpperCase()}
            </h1>
            
            {/* Real Payment Status Badge */}
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              paymentStatus === "paid"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : paymentStatus === "partial"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : paymentStatus === "overdue"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}>
              {paymentStatus === "paid" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {paymentStatus === "partial" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
              {paymentStatus === "overdue" && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
              Payment: {paymentStatus}
            </span>

            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant text-on-surface-variant">
              Status: {invoice.status || "Draft"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-on-surface-variant">
            <span>Issue Date: <strong className="text-on-surface">{new Date(invoice.createdAt).toLocaleDateString()}</strong></span>
            <span>•</span>
            <span>Due Date: <strong className="text-on-surface">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Net 30"}</strong></span>
            <span>•</span>
            <span>Quote Ref: <strong className="text-primary font-mono">QT-{invoice.quoteId ? invoice.quoteId.substring(0, 8) : "N/A"}</strong></span>
          </div>
        </div>

        {/* Financial Progress Box */}
        <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 min-w-[280px] space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-on-surface-variant uppercase tracking-wider">Amount Paid</span>
            <span className="font-bold text-on-surface">{formatCurrency(amountPaid)} / {formatCurrency(totalDue)}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                paymentStatus === "paid" 
                  ? "bg-emerald-500" 
                  : paymentStatus === "partial" 
                  ? "bg-amber-500" 
                  : "bg-slate-300"
              }`} 
              style={{ width: `${percentPaid}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs pt-1 border-t border-outline-variant/40">
            <span className="text-on-surface-variant font-medium">Remaining Due:</span>
            <span className={`font-black text-sm ${remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {formatCurrency(remainingBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Document Layout */}
      <div className="bg-white border border-outline-variant rounded-2xl shadow-lg p-8 md:p-12 print:shadow-none print:border-none print:p-0">
        
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b border-outline-variant/60 gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary font-extrabold text-2xl mb-2">
              <FileText className="w-7 h-7" />
              NEXUS CRM
            </div>
            <p className="text-sm font-bold text-slate-900">Nexus Enterprises LLC</p>
            <p className="text-xs text-slate-500 mt-0.5">123 Tech Corridor, Internet City</p>
            <p className="text-xs text-slate-500">Dubai, United Arab Emirates</p>
            <p className="text-xs text-slate-500">TRN: 100234567890003</p>
          </div>

          <div className="sm:text-right">
            <h2 className="text-3xl font-black text-slate-300 uppercase tracking-widest mb-3">INVOICE</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-left">
              <span className="font-bold text-slate-500 sm:text-right">Invoice Ref:</span>
              <span className="font-mono font-bold text-slate-900">INV-{invoice.id.substring(0, 6).toUpperCase()}</span>
              <span className="font-bold text-slate-500 sm:text-right">Invoice Date:</span>
              <span className="text-slate-800">{new Date(invoice.createdAt).toLocaleDateString()}</span>
              <span className="font-bold text-slate-500 sm:text-right">Due Date:</span>
              <span className="text-slate-800">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Net 30"}</span>
              <span className="font-bold text-slate-500 sm:text-right">Quote Ref:</span>
              <span className="font-mono text-primary font-semibold">QT-{invoice.quoteId ? invoice.quoteId.substring(0, 8) : "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="py-8 border-b border-outline-variant/60">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Billed To</h3>
          <p className="text-base font-bold text-slate-900">
            {invoice.quote?.deal?.lead?.company || "Valued Customer"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Attn: {invoice.quote?.deal?.lead?.firstName} {invoice.quote?.deal?.lead?.lastName}
          </p>
          <p className="text-xs text-slate-600">{invoice.quote?.deal?.lead?.email || "billing@client.com"}</p>
        </div>

        {/* Line Items Table */}
        <div className="py-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider">Item & Description</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-center w-24">Qty</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-right w-32">Unit Price</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lineItems?.length > 0 ? (
                invoice.lineItems.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <p className="font-bold text-sm text-slate-900">{item.product?.name || "Service / Equipment"}</p>
                      <p className="text-xs text-slate-400 mt-0.5 italic">{item.product?.sku || item.product?.category || "Standard Item"}</p>
                    </td>
                    <td className="py-4 text-center text-sm text-slate-700">{item.quantity}</td>
                    <td className="py-4 text-right text-sm text-slate-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-xs italic">
                    Standard quote deliverables as per agreement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end pb-8 border-b border-outline-variant/60">
          <div className="w-80 space-y-2.5 pt-4">
            <div className="flex justify-between text-xs text-slate-600">
              <span className="font-semibold">Subtotal</span>
              <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span className="font-semibold">VAT / Tax (5%)</span>
              <span className="font-medium text-slate-900">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-baseline border-t border-slate-200 pt-3">
              <span className="font-bold text-sm uppercase text-slate-900">Total Invoice Amount</span>
              <span className="text-xl font-black text-primary">{formatCurrency(totalDue)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-700 bg-emerald-50/60 p-2 rounded-lg border border-emerald-200/60">
              <span className="font-semibold">Total Paid</span>
              <span className="font-bold">{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-xs text-amber-800 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60">
              <span className="font-semibold">Balance Due</span>
              <span className="font-bold text-sm">{formatCurrency(remainingBalance)}</span>
            </div>
          </div>
        </div>

        {/* Payment History Section */}
        <div className="pt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Payment Transaction History</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {paymentsList.length} transaction{paymentsList.length === 1 ? "" : "s"} logged
            </span>
          </div>

          {paymentsList.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <p className="text-xs text-slate-500 font-medium">No payments have been recorded for this invoice yet.</p>
              {canRecordPayment && (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Record First Payment
                </button>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Reference</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Recorded By</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsList.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                          {p.method ? p.method.replace("_", " ") : "Bank Transfer"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {p.reference || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {p.recordedByUser?.name || p.recordedByUser?.email || "System"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Notes */}
        <div className="border-t border-slate-200 pt-8 mt-12 text-xs text-slate-500 space-y-1.5">
          <p className="font-bold text-slate-700">Payment Instructions</p>
          <p>Please make wire transfers payable to <strong>Nexus Enterprises LLC</strong> (Account: 123-456-7890, Bank of Dubai).</p>
          <p>For billing assistance, please contact <strong>billing@nexus-crm.com</strong>.</p>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={invoice}
        onSuccess={() => {
          setSuccessToast("Payment successfully recorded! Invoice balances and status have been updated.");
          refetch();
        }}
      />
    </div>
  );
}
