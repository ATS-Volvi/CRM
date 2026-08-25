import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Download,
  Send,
  CheckCircle2,
  Plus,
  Building2,
  User,
  Calendar,
  AlertCircle,
  XCircle,
  ExternalLink,
  Check,
  Printer,
  Shield,
  Clock
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { downloadAuthenticatedFile } from "../utils/download";
import { useAuth } from "../context/AuthContext";
import QuotationDocumentRenderer from "../components/QuotationDocumentRenderer";
import { SendQuoteChannelModal } from "../components/SendQuoteChannelModal";
import { QuoteDeliveryTimeline } from "../components/QuoteDeliveryTimeline";

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  // Fetch Quote Detail
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote-detail", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/quotes/${id}`);
      return res;
    },
    enabled: !!id
  });

  // Fetch Approval Request for this quote
  const { data: approvalData } = useQuery({
    queryKey: ["quote-approval", id],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/api/v1/approvals`);
      const all = Array.isArray(res) ? res : res?.data || [];
      return all.find((a: any) => a.targetId === id) || null;
    },
    enabled: !!id
  });

  // Submit for Approval Mutation
  const submitApprovalMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/api/v1/quotes/${id}/submit-approval`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["quote-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quote-approval", id] });
      alert(data?.message || "Quote submitted for manager approval!");
    },
    onError: (err: any) => {
      alert("Failed to submit for approval: " + (err?.message || "Error submitting quote"));
    }
  });

  // Accept Quote Mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/api/v1/quotes/${id}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quote-approval", id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
    }
  });

  // Reject Quote Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/api/v1/quotes/${id}/reject`, {
        reason: "Price too high / Commercial terms"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-detail", id] });
    }
  });

  // Send Quote Mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/api/v1/quotes/${id}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-detail", id] });
    }
  });

  const handleDownloadPdf = async () => {
    if (!id || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadAuthenticatedFile(
        `/api/v1/quotes/${id}/pdf`,
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

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-5xl mx-auto space-y-2">
        <div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400 font-medium">Loading quotation details...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-3">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Quotation Not Found</h2>
        <p className="text-xs text-slate-500">This quote document may have been deleted or archived.</p>
        <button
          onClick={() => navigate("/quotes")}
          className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Back to Quotes
        </button>
      </div>
    );
  }

  const isAccepted = quote.status === "Accepted";
  const isSuperseded = quote.status === "Superseded";
  const isSent = quote.status === "Sent";
  const isRejected = quote.status === "Rejected";

  const rawItems: any[] = Array.isArray(quote.QuoteLineItems) ? quote.QuoteLineItems : [];
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
    companyName: quote.deal?.account?.name || quote.deal?.lead?.company || quote.deal?.name || "Client Account",
    contactName:
      quote.deal?.primaryContact?.firstName
        ? `${quote.deal?.primaryContact?.firstName} ${quote.deal?.primaryContact?.lastName || ""}`
        : quote.deal?.lead?.firstName
        ? `${quote.deal?.lead?.firstName} ${quote.deal?.lead?.lastName || ""}`
        : quote.deal?.account?.primaryContactName || "Authorized Representative",
    email: quote.deal?.primaryContact?.email || quote.deal?.lead?.email || quote.deal?.account?.email || "",
    phone: quote.deal?.primaryContact?.phone || quote.deal?.lead?.phone || quote.deal?.account?.phone || "",
    address: quote.deal?.account?.billingAddress || quote.deal?.lead?.address || ""
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* ── TOP BREADCRUMB & ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Link
            to={quote.dealId ? `/opportunities/${quote.dealId}` : "/quotes"}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{quote.dealId ? "Back to Opportunity" : "Back to Quotes"}</span>
          </Link>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-slate-900">{quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
            v{quote.version || 1}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase border ${
              isAccepted
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isSent
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : isSuperseded
                ? "bg-slate-100 text-slate-400 border-slate-200 line-through"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {quote.status}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{downloadingPdf ? "Exporting..." : "Download PDF"}</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white rounded-lg transition-colors cursor-pointer"
            title="Print Quotation"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Customer Portal Link */}
          {quote.publicAccessToken && (
            <a
              href={`/q/${quote.publicAccessToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              title="Open Customer Review Portal"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer View</span>
            </a>
          )}

          {/* Send Quote to Client */}
          {!isSuperseded && !isRejected && (
            <button
              onClick={() => setIsSendModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{quote.status === "Sent" ? "Re-send Quote" : "Send to Client"}</span>
            </button>
          )}

          {/* 1. Waiting for Approval state */}
          {quote.status === "Pending Approval" || quote.status === "Pending" || approvalData?.status === "Pending" ? (
            <span className="px-3.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Waiting for Approval</span>
            </span>
          ) : (
            <>
              {/* 2. Accept Final Quote */}
              {!isAccepted && !isSuperseded && !isRejected && (
                <button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{acceptMutation.isPending ? "Accepting..." : "Accept Final"}</span>
                </button>
              )}

              {/* 3. If Quote is Accepted: allow sending for Manager/Admin Approval */}
              {isAccepted && !approvalData && (
                <button
                  onClick={() => submitApprovalMutation.mutate()}
                  disabled={submitApprovalMutation.isPending}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{submitApprovalMutation.isPending ? "Submitting..." : "Send for Approval"}</span>
                </button>
              )}

              {/* 4. If Approved */}
              {approvalData?.status === "Approved" && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved</span>
                </span>
              )}
            </>
          )}

          {/* Mark Rejected */}
          {!isRejected && (
            <button
              onClick={() => {
                if (confirm("Mark this quotation as declined/rejected by customer?")) {
                  rejectMutation.mutate();
                }
              }}
              disabled={rejectMutation.isPending}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Mark Rejected</span>
            </button>
          )}

          {/* Create Revision */}
          <button
            onClick={() =>
              navigate(
                `/quotes/new?parentQuoteId=${quote.id}${quote.dealId ? `&dealId=${quote.dealId}` : ""}`
              )
            }
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Revision</span>
          </button>
        </div>
      </div>

      {/* ── BILL DOCUMENT VIEW (MATCHING CREATE QUOTE) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 sm:p-10">
        <QuotationDocumentRenderer
          quotationNumber={quote.quoteNumber || `QT-${quote.id.slice(0, 6)}`}
          quotationDate={new Date(quote.createdAt).toLocaleDateString("en-GB")}
          salesExecutive={quote.salesRep?.name || quote.deal?.owner?.name || "Sales Executive"}
          leadData={quote.deal?.lead || null}
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

      {/* ── REAL DELIVERY HISTORY TIMELINE ── */}
      {id && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6">
          <QuoteDeliveryTimeline quoteId={id} initialDeliveries={quote.deliveries} />
        </div>
      )}

      {/* Send Quote Modal */}
      {id && (
        <SendQuoteChannelModal
          quoteId={id}
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
        />
      )}
    </div>
  );
}

