import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { ArrowLeft, Printer, Download, CreditCard, FileText } from "lucide-react";

export default function InvoiceDetail() {
  const { id } = useParams();
  const { token } = useAuth();

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

  const invoice = invoices?.find((inv: any) => inv.id === id);

  if (isLoading) {
    return <div className="p-8 max-w-[1000px] mx-auto min-h-screen">Loading invoice details...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-[1000px] mx-auto min-h-screen">
        <div className="bg-error-container text-error p-4 rounded-lg flex items-center justify-between">
          <span>Invoice not found.</span>
          <Link to="/invoices" className="underline font-bold text-sm">Back to Invoices</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-20 max-w-[1000px] mx-auto min-h-screen">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-6">
        <Link to="/invoices" className="hover:text-primary">Invoices</Link>
        <span className="opacity-50">/</span>
        <span>Invoice Details</span>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Invoice INV-{invoice.id.substring(0,6).toUpperCase()}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
              invoice.status === 'Paid' ? 'bg-green-100 text-green-700' :
              invoice.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
              invoice.status === 'Draft' ? 'bg-surface-variant text-on-surface-variant' :
              'bg-red-100 text-red-700'
            }`}>
              {invoice.status}
            </span>
            <span className="text-on-surface-variant text-sm font-semibold">
              Due Date: {new Date(invoice.dueDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-sm font-bold rounded-lg shadow-sm hover:bg-surface-container-high transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-sm font-bold rounded-lg shadow-sm hover:bg-surface-container-high transition-colors">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          {invoice.status !== 'Paid' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity shadow-primary/30">
              <CreditCard className="w-4 h-4" /> Process Payment
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-outline-variant rounded-xl shadow-lg p-10 print:shadow-none print:border-none">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-16 pb-8 border-b border-outline-variant/50">
          <div>
            <div className="flex items-center gap-2 text-primary font-extrabold text-3xl mb-4">
              <FileText className="w-8 h-8" />
              NEXUS CRM.
            </div>
            <p className="text-sm font-bold text-on-surface">Nexus Enterprises LLC</p>
            <p className="text-xs text-on-surface-variant mt-1">123 Tech Corridor, Internet City</p>
            <p className="text-xs text-on-surface-variant">Dubai, United Arab Emirates</p>
            <p className="text-xs text-on-surface-variant">TRN: 100234567890003</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-on-surface-variant/30 uppercase tracking-widest mb-4">INVOICE</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-left">
              <span className="font-bold text-on-surface-variant text-right">Invoice Date:</span>
              <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
              <span className="font-bold text-on-surface-variant text-right">Due Date:</span>
              <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
              <span className="font-bold text-on-surface-variant text-right">Reference:</span>
              <span>QT-{invoice.quoteId.substring(0,8)}</span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-12">
          <h3 className="text-xs font-bold uppercase text-on-surface-variant tracking-wider mb-3">Billed To</h3>
          <p className="text-lg font-bold text-on-surface">{invoice.quote?.deal?.lead?.company || 'Company Name'}</p>
          <p className="text-sm text-on-surface-variant mt-1">Attn: {invoice.quote?.deal?.lead?.firstName} {invoice.quote?.deal?.lead?.lastName}</p>
          <p className="text-sm text-on-surface-variant">{invoice.quote?.deal?.lead?.email}</p>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider">Item Description</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-center w-24">Qty</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-right w-32">Rate</th>
                <th className="py-3 text-xs font-bold text-primary uppercase tracking-wider text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoice.lineItems?.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-4">
                    <p className="font-bold text-sm text-on-surface">{item.product?.name || 'Custom Product'}</p>
                    <p className="text-xs text-on-surface-variant mt-1 italic">{item.product?.sku || 'SKU-MISSING'}</p>
                  </td>
                  <td className="py-4 text-center text-sm">{item.quantity}</td>
                  <td className="py-4 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-4 text-right text-sm font-bold">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-16">
          <div className="w-72 space-y-3 border-t-2 border-primary/20 pt-4">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-on-surface-variant">Subtotal</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-on-surface-variant">Tax (5%)</span>
              <span>{formatCurrency(invoice.totalAmount * 0.05)}</span>
            </div>
            <div className="flex justify-between items-end border-t border-outline-variant/50 pt-3">
              <span className="font-bold text-base uppercase text-on-surface">Total Due</span>
              <span className="text-2xl font-black text-primary">{formatCurrency(invoice.totalAmount * 1.05)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="border-t border-outline-variant/50 pt-8 mt-16 text-xs text-on-surface-variant space-y-2">
          <p className="font-bold">Payment Instructions</p>
          <p>Please make all checks payable to Nexus Enterprises LLC or initiate a wire transfer to Account: 123-456-7890 (Bank of Dubai).</p>
          <p>If you have any questions concerning this invoice, contact our billing department at billing@nexus-crm.com.</p>
          <p className="mt-4 font-bold text-primary text-center">Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}
