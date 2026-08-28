import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Building,
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  RefreshCw,
  MessageSquareQuote,
  Download,
  AlertCircle
} from "lucide-react";

interface QuoteLineItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: {
    name: string;
    description: string;
    sku: string;
  };
}

interface QuoteData {
  id: string;
  quoteNumber: string;
  version: number;
  status: string;
  totalAmount: number;
  expirationDate: string | null;
  publicAccessToken: string;
  publicAccessExpiresAt: string | null;
  createdAt: string;
  QuoteLineItems?: QuoteLineItem[];
  deal?: {
    id: string;
    name: string;
    lead?: {
      firstName: string;
      lastName: string;
      company: string;
      email: string;
      phone: string;
    };
    account?: {
      name: string;
      email?: string;
      phone?: string;
    };
    owner?: {
      name: string;
      email: string;
      phone?: string;
    };
  };
}

export default function PublicQuoteReview() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Accept Modal State
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptedByName, setAcceptedByName] = useState("");
  const [acceptedByEmail, setAcceptedByEmail] = useState("");
  const [acceptConfirmed, setAcceptConfirmed] = useState(false);
  const [submittingAccept, setSubmittingAccept] = useState(false);

  // Request Changes Modal State
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [submittingChanges, setSubmittingChanges] = useState(false);

  // Success Feedback
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchQuote();
  }, [token]);

  const fetchQuote = async () => {
    if (!token) {
      setErrorStatus(404);
      setErrorMessage("Missing quotation access token.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);
      const res = await fetch(`/api/v1/public/quotes/by-token/${token}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const status = res.status;
        setErrorStatus(status);
        setErrorMessage(
          errData.error ||
          (status === 410
            ? "This quotation link has expired. Please contact your sales representative for a revised proposal."
            : "Unable to find the requested quotation. Please verify the URL.")
        );
        return;
      }
      const data = await res.json();
      setQuote(data);

      // Pre-fill acceptance fields if contact details exist
      const clientName = data.deal?.lead
        ? `${data.deal.lead.firstName || ""} ${data.deal.lead.lastName || ""}`.trim()
        : "";
      const clientEmail = data.deal?.lead?.email || "";
      if (clientName) setAcceptedByName(clientName);
      if (clientEmail) setAcceptedByEmail(clientEmail);
    } catch (err: any) {
      setErrorStatus(500);
      setErrorMessage("Unable to find the requested quotation. Please verify the URL.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !acceptedByName.trim() || !acceptedByEmail.trim() || !acceptConfirmed) return;

    try {
      setSubmittingAccept(true);
      const res = await fetch(`/api/v1/public/quotes/by-token/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedByName: acceptedByName.trim(),
          acceptedByEmail: acceptedByEmail.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit quote acceptance. Please try again.");
      }

      setQuote((prev) => (prev ? { ...prev, status: "Accepted" } : null));
      setShowAcceptModal(false);
      setActionSuccessMessage(
        `Thank you, ${acceptedByName}! This quotation has been officially accepted. Our team is preparing the next steps.`
      );
    } catch (err: any) {
      alert(err.message || "Failed to submit quote acceptance. Please try again.");
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleChangesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setSubmittingChanges(true);
      const res = await fetch(`/api/v1/public/quotes/by-token/${token}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: changeMessage.trim(),
          customerName: acceptedByName,
          customerEmail: acceptedByEmail
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit revision request. Please try again.");
      }

      setQuote((prev) => (prev ? { ...prev, status: "Revision Requested" } : null));
      setShowChangesModal(false);
      setActionSuccessMessage(
        "Your revision request has been forwarded to your sales representative. We will follow up shortly."
      );
    } catch (err: any) {
      alert(err.message || "Failed to submit revision request. Please try again.");
    } finally {
      setSubmittingChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium tracking-wide">Loading official quotation...</p>
        </div>
      </div>
    );
  }

  // ── ERROR / EXPIRED STATE ──────────────────────────────────────────────────
  if (errorStatus || !quote) {
    const isExpired = errorStatus === 410;
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
            isExpired ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
          }`}>
            {isExpired ? <Clock className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isExpired ? "Quotation Link Expired" : "Quotation Not Found"}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              {errorMessage || "This quotation link is no longer active or may have been revoked."}
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 text-left text-xs space-y-2 text-slate-300">
            <p className="font-semibold text-slate-200">Need an updated quotation?</p>
            <p className="text-slate-400">
              Please contact your dedicated sales representative or reach our support team directly to request a refreshed proposal link.
            </p>
          </div>

          <p className="text-xs text-slate-500">Nexus Sales Enterprise Commercial Portal</p>
        </div>
      </div>
    );
  }

  // ── DATA PREPARATION ────────────────────────────────────────────────────────
  const quoteNumber = quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`;
  const totalAmount = Number(quote.totalAmount || 0);
  const subtotal = totalAmount / 1.15;
  const vatAmount = totalAmount - subtotal;
  const isAccepted = quote.status === "Accepted";
  const isRevisionRequested = quote.status === "Revision Requested";

  const clientName = quote.deal?.lead
    ? `${quote.deal.lead.firstName || ""} ${quote.deal.lead.lastName || ""}`.trim()
    : quote.deal?.account?.name || "Valued Client";
  const companyName = quote.deal?.account?.name || quote.deal?.lead?.company || "Commercial Client";
  const clientEmail = quote.deal?.lead?.email || quote.deal?.account?.email || "—";
  const clientPhone = quote.deal?.lead?.phone || quote.deal?.account?.phone || "—";

  const repName = quote.deal?.owner?.name || "Commercial Sales Team";
  const repEmail = quote.deal?.owner?.email || "sales@nexus-crm.com";
  const repPhone = quote.deal?.owner?.phone || "+966 11 000 0000";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Enterprise Brand Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">NEXUS SALES ENTERPRISE</h1>
              <p className="text-xs text-slate-400">Official Commercial Proposal Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                isAccepted
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : isRevisionRequested
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
              }`}
            >
              {isAccepted ? "Accepted" : isRevisionRequested ? "Revision Requested" : quote.status || "Active Quotation"}
            </span>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              v{quote.version || 1}
            </span>
          </div>
        </header>

        {/* Success Action Alert */}
        {actionSuccessMessage && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-start gap-3 text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{actionSuccessMessage}</p>
          </div>
        )}

        {/* Quotation Header Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Commercial Proposal</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
                Quotation #{quoteNumber}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Investment</span>
              <span className="text-2xl sm:text-3xl font-black text-indigo-400">
                SAR {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800/80 text-sm">
            {/* Client Details */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Prepared For
              </h3>
              <div className="space-y-1">
                <p className="text-base font-bold text-white">{clientName}</p>
                <p className="text-slate-300 text-xs">{companyName}</p>
                <p className="text-slate-400 text-xs flex items-center gap-1.5 pt-1">
                  <Mail className="w-3 h-3" /> {clientEmail}
                </p>
                <p className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {clientPhone}
                </p>
              </div>
            </div>

            {/* Sales Rep / Account Owner */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Commercial Representative
              </h3>
              <div className="space-y-1">
                <p className="text-base font-bold text-white">{repName}</p>
                <p className="text-slate-300 text-xs">Nexus Enterprise Accounts</p>
                <p className="text-slate-400 text-xs flex items-center gap-1.5 pt-1">
                  <Mail className="w-3 h-3" /> {repEmail}
                </p>
                <p className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {repPhone}
                </p>
              </div>
            </div>
          </div>

          {quote.expirationDate && (
            <div className="flex items-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 px-3.5 py-2 rounded-lg border border-amber-500/20 w-fit">
              <Clock className="w-4 h-4" />
              <span>
                Proposal valid until: <strong>{new Date(quote.expirationDate).toLocaleDateString()}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" /> Scope of Supply & Services
            </h3>
            <span className="text-xs text-slate-400">Currency: SAR (Saudi Riyal)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Item & Description</th>
                  <th className="px-6 py-3 font-semibold text-center">Qty</th>
                  <th className="px-6 py-3 font-semibold text-right">Unit Price (SAR)</th>
                  <th className="px-6 py-3 font-semibold text-right">Total (SAR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {quote.QuoteLineItems && quote.QuoteLineItems.length > 0 ? (
                  quote.QuoteLineItems.map((item, idx) => {
                    const itemName = item.product?.name || `Item #${idx + 1}`;
                    const itemDesc = item.product?.description || item.product?.sku || "Standard supply specification";
                    const unitPrice = Number(item.unitPrice || 0);
                    const lineTotal = Number(item.lineTotal || unitPrice * (item.quantity || 1));
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-white">{itemName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{itemDesc}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-200">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-300">
                          {unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white">
                          {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{quote.deal?.name || "Enterprise Commercial Package"}</p>
                      <p className="text-xs text-slate-400">Complete service deliverables as agreed</p>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-200">1</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-300">
                      {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="bg-slate-950/70 p-6 border-t border-slate-800 flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (excl. VAT)</span>
                <span>SAR {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT (15%)</span>
                <span>SAR {vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span>Grand Total</span>
                <span className="text-indigo-400">
                  SAR {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        {!isAccepted && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-lg font-bold text-white">Ready to proceed?</h4>
              <p className="text-xs text-slate-400">
                You can approve this quotation online or submit revision requests directly to your sales representative.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <button
                onClick={() => setShowChangesModal(true)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2"
              >
                <MessageSquareQuote className="w-4 h-4 text-amber-400" /> Request Changes
              </button>

              <button
                onClick={() => setShowAcceptModal(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Accept Quotation
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 pt-6 border-t border-slate-900 space-y-1">
          <p>© {new Date().getFullYear()} Nexus Sales Enterprise. All commercial rights reserved.</p>
          <p className="text-slate-600">This document is legally binding upon digital acceptance or internal confirmation.</p>
        </footer>
      </div>

      {/* ── ACCEPT QUOTE MODAL ────────────────────────────────────────────────── */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Confirm Quotation Acceptance
              </h3>
              <button
                onClick={() => setShowAcceptModal(false)}
                className="text-slate-400 hover:text-white text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAcceptSubmit} className="space-y-4 text-sm">
              <p className="text-xs text-slate-300 leading-relaxed">
                By completing this form, you authorize Nexus Sales Enterprise to initiate order fulfillment for Quotation{" "}
                <strong>#{quoteNumber}</strong> for the total sum of{" "}
                <strong className="text-indigo-400">SAR {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Authorized Signatory Name *</label>
                <input
                  type="text"
                  required
                  value={acceptedByName}
                  onChange={(e) => setAcceptedByName(e.target.value)}
                  placeholder="e.g. Tariq Al-Harbi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Official Contact Email *</label>
                <input
                  type="email"
                  required
                  value={acceptedByEmail}
                  onChange={(e) => setAcceptedByEmail(e.target.value)}
                  placeholder="e.g. tariq@client.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    required
                    checked={acceptConfirmed}
                    onChange={(e) => setAcceptConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I confirm that I am authorized to accept this proposal on behalf of <strong>{companyName}</strong>.
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccept || !acceptConfirmed}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2"
                >
                  {submittingAccept ? "Accepting..." : "Confirm & Sign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REQUEST CHANGES MODAL ─────────────────────────────────────────────── */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-amber-400" /> Request Quotation Revisions
              </h3>
              <button
                onClick={() => setShowChangesModal(false)}
                className="text-slate-400 hover:text-white text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangesSubmit} className="space-y-4 text-sm">
              <p className="text-xs text-slate-300">
                Please specify any scope adjustments, line item updates, or commercial terms you would like our team to revise.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Revision Notes / Feedback</label>
                <textarea
                  rows={4}
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  placeholder="e.g. Please adjust quantity of item 2 or apply agreed partner discount..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChanges}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-amber-900/40 transition-all flex items-center gap-2"
                >
                  {submittingChanges ? "Submitting..." : "Submit Revision Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
