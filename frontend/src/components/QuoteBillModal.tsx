import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  X,
  Download,
  Send,
  CheckCircle2,
  Printer,
  FileText,
  AlertCircle,
  Clock,
  Building2,
  User,
  Calendar,
  Check,
  XCircle,
  Plus
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { downloadAuthenticatedFile } from "../utils/download";
import { useAuth } from "../context/AuthContext";
import QuotationDocumentRenderer from "./QuotationDocumentRenderer";

interface QuoteBillModalProps {
  quoteId: string | null;
  onClose: () => void;
}

export function QuoteBillModal({ quoteId, onClose }: QuoteBillModalProps) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("Price too high / Commercial terms");
  const [rejectNotes, setRejectNotes] = useState("");

  // Fetch Full Quote details including line items, deal, and lead
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote-bill-modal", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const res = await apiClient.get<any>(`/api/v1/quotes/${quoteId}`);
      return res;
    },
    enabled: !!quoteId
  });

  // Accept Final Quote Mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      return await apiClient.post(`/api/v1/quotes/${quoteId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-bill-modal", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  // Reject / Decline Quote Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      return await apiClient.post(`/api/v1/quotes/${quoteId}/reject`, {
        reason: rejectReason,
        notes: rejectNotes
      });
    },
    onSuccess: () => {
      setShowRejectModal(false);
      setRejectNotes("");
      queryClient.invalidateQueries({ queryKey: ["quote-bill-modal", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
    }
  });

  // Send Quote Mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      return await apiClient.post(`/api/v1/quotes/${quoteId}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-bill-modal", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes"] });
    }
  });

  const handleDownloadPdf = async () => {
    if (!quoteId || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadAuthenticatedFile(
        `/api/v1/quotes/${quoteId}/pdf`,
        `${quote?.quoteNumber || "Quote"}.pdf`,
        token
      );
    } catch (err: any) {
      alert("Failed to download PDF: " + (err.message || err));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!quoteId) return null;

  const rawItems: any[] = Array.isArray(quote?.QuoteLineItems) ? quote.QuoteLineItems : [];
  const items = rawItems.map((item, idx) => {
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    const total = Number(item.totalPrice || item.total || qty * unitPrice * (1 - discount / 100));

    return {
      id: item.id || idx,
      lineNumber: String(idx + 1).padStart(2, "0"),
      name: item.product?.name || item.description || `Item #${idx + 1}`,
      description: item.product?.description || item.description || item.product?.name || "",
      uom: item.product?.uom || "Unit",
      qty: qty,
      quantity: qty,
      unitPrice: unitPrice,
      discount: discount,
      total: total,
      totalPrice: total
    };
  });

  const leadData = {
    companyName: quote?.deal?.account?.name || quote?.deal?.lead?.company || quote?.deal?.name || "Client Account",
    contactName:
      quote?.deal?.primaryContact?.firstName
        ? `${quote?.deal?.primaryContact?.firstName} ${quote?.deal?.primaryContact?.lastName || ""}`
        : quote?.deal?.lead?.firstName
        ? `${quote?.deal?.lead?.firstName} ${quote?.deal?.lead?.lastName || ""}`
        : quote?.deal?.account?.primaryContactName || "Authorized Representative",
    email: quote?.deal?.primaryContact?.email || quote?.deal?.lead?.email || quote?.deal?.account?.email || "",
    phone: quote?.deal?.primaryContact?.phone || quote?.deal?.lead?.phone || quote?.deal?.account?.phone || "",
    address: quote?.deal?.account?.billingAddress || quote?.deal?.lead?.address || ""
  };

  const isAccepted = quote?.status === "Accepted";
  const isSuperseded = quote?.status === "Superseded";
  const isRejected = quote?.status === "Rejected" || quote?.status === "Declined";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
        {/* ── TOP MODAL HEADER BAR ── */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {quote?.quoteNumber || `QT-${quoteId.slice(0, 6)}`}
                </h3>
                {quote && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    v{quote.version || 1}
                  </span>
                )}
                {quote?.status && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase border ${
                      isAccepted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isRejected
                        ? "bg-rose-50 text-rose-700 border-rose-200 font-extrabold"
                        : quote.status === "Sent"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : isSuperseded
                        ? "bg-slate-100 text-slate-400 border-slate-200 line-through"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {isRejected ? "REJECTED" : quote.status}
                  </span>
                )}
                {quote?.isFinalAgreed && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Check className="w-2.5 h-2.5 stroke-[3]" /> Final Agreed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-md">
                {leadData.companyName} • {formatCurrency(quote?.totalAmount || 0)}
              </p>
            </div>
          </div>

          {/* Actions on Top */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || isLoading}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Download authenticated PDF"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">{downloadingPdf ? "Exporting..." : "PDF"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              title="Print Quote"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Accept Final Quote */}
            {!isAccepted && !isSuperseded && !isRejected && quote && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{acceptMutation.isPending ? "Accepting..." : "Accept Final"}</span>
              </button>
            )}

            {/* Manual Reject / Decline Option */}
            {!isRejected && quote && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Mark this quote as declined/rejected by the customer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Mark Rejected</span>
              </button>
            )}

            {/* If Rejected, offer quick Create Revision button */}
            {isRejected && quote?.dealId && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/quotes/new?parentQuoteId=${quote.id}&dealId=${quote.dealId}`);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Revision</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer ml-1"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── REJECTION ALERT BANNER (IF QUOTE IS REJECTED) ── */}
        {isRejected && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Quotation Declined / Rejected:</strong> This commercial revision was marked as rejected by the customer.
              </span>
            </div>
            {quote?.dealId && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/quotes/new?parentQuoteId=${quote.id}&dealId=${quote.dealId}`);
                }}
                className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
              >
                Generate Revised Terms →
              </button>
            )}
          </div>
        )}

        {/* ── MODAL BODY: INVOICE / BILL DOCUMENT ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
          {isLoading ? (
            <div className="p-12 text-center my-auto">
              <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-400 font-medium mt-2">Loading official quote document...</p>
            </div>
          ) : error || !quote ? (
            <div className="p-12 text-center my-auto space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Quotation details not found</p>
            </div>
          ) : (
            <div className="w-full max-w-[780px] bg-white rounded-xl shadow-md border border-slate-200/80 p-6 sm:p-8">
              <QuotationDocumentRenderer
                quotationNumber={quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`}
                quotationDate={new Date(quote.createdAt).toLocaleDateString("en-GB")}
                salesExecutive={quote.salesRep?.name || quote.deal?.owner?.name || "Sales Executive"}
                leadData={leadData}
                items={items}
                template={{
                  companyName: "NEXUS SALES ENTERPRISE",
                  companyTagline: "Commercial Systems & Engineering Solutions",
                  companyAddress: "King Fahd Road, Riyadh, Kingdom of Saudi Arabia",
                  primaryColor: "#0f172a",
                  currency: "SAR",
                  taxRate: 0.15,
                  validUntil: quote.expirationDate ? new Date(quote.expirationDate).toLocaleDateString("en-GB") : "30 Days from Issue"
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── CONFIRM REJECT MODAL PROMPT ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3.5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" /> Mark Quote as Rejected
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Mark quotation <strong className="text-slate-900">{quote?.quoteNumber || quoteId}</strong> as declined / rejected by the customer.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Rejection Reason *
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-800 bg-white"
                >
                  <option value="Price too high / Commercial terms">Price too high / Commercial terms</option>
                  <option value="Competitor proposal selected">Competitor proposal selected</option>
                  <option value="Scope mismatch / Spec change required">Scope mismatch / Spec change required</option>
                  <option value="Project postponed / Cancelled">Project postponed / Cancelled</option>
                  <option value="Payment terms rejected">Payment terms rejected</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Feedback / Notes
                </label>
                <textarea
                  rows={2}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Optional customer feedback or revision requests..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {rejectMutation.isPending ? "Updating..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
