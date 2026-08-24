import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Download,
  MoreVertical,
  Plus,
  Filter,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Check,
  X
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { downloadAuthenticatedFile } from "../utils/download";
import { apiClient } from "../lib/apiClient";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [valueBand, setValueBand] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Resolution modals state
  const [confirmModalPO, setConfirmModalPO] = useState<any | null>(null);
  const [rejectModalPO, setRejectModalPO] = useState<any | null>(null);
  const [confirmRationale, setConfirmRationale] = useState("");
  const [rejectLossReason, setRejectLossReason] = useState("Commercial Variance / Scope Reduced");
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const invoiceMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await fetch("/api/v1/invoices/from-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quoteId })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      alert("Invoice created successfully!");
      window.location.href = `/invoices`;
    },
    onError: (err: any) => {
      alert("Error creating invoice: " + err.message);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ poId, payload }: { poId: string; payload: any }) => {
      return apiClient.post(`/api/v1/purchase-orders/${poId}/resolve`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      setConfirmModalPO(null);
      setRejectModalPO(null);
      setConfirmRationale("");
      setRejectNotes("");
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to resolve purchase order.");
    }
  });

  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders", search, valueBand, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (valueBand) params.append("valueBand", valueBand);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/purchase-orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      return res.json();
    }
  });

  const flaggedCount = Array.isArray(pos) ? pos.filter((p: any) => p.status === "Flagged/Mismatch").length : 0;

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (valueBand) params.append("valueBand", valueBand);
    if (statusFilter) params.append("status", statusFilter);

    try {
      const res = await fetch(`/api/v1/exports/purchase-orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
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
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)] space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Orders Register</h1>
          <p className="text-slate-500 text-sm">Manage, reconcile, and resolve client PO documents</p>
        </div>
        <Link
          to="/quotes"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xs text-sm transition-colors"
        >
          <Plus className="w-5 h-5" /> New PO
        </Link>
      </div>

      {/* Flagged Alert Banner */}
      {flaggedCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="font-bold">
                {flaggedCount} Purchase Order{flaggedCount > 1 ? "s" : ""} Flagged for Amount Mismatch
              </p>
              <p className="text-amber-800/80">
                Received PO amount differs from accepted quote. Linked deals are held open pending manager review and explicit resolution.
              </p>
            </div>
          </div>
          {statusFilter !== "Flagged/Mismatch" && (
            <button
              onClick={() => setStatusFilter("Flagged/Mismatch")}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-xs"
            >
              Filter Flagged POs
            </button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">Filter By</span>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search PO # or Client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none w-60"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="Flagged/Mismatch">⚠️ Flagged/Mismatch</option>
            <option value="Accepted">Accepted</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Value Band Filter */}
          <select
            value={valueBand}
            onChange={(e) => setValueBand(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-slate-700"
          >
            <option value="">All Value Bands</option>
            <option value="low">Low (≤ $10k)</option>
            <option value="medium">Medium ($10k - $50k)</option>
            <option value="high">High (&gt; $50k)</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          className="text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Main PO Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800">Purchase Orders</h2>
          <span className="text-xs text-slate-500 font-medium">
            {pos?.length || 0} order{pos?.length === 1 ? "" : "s"} registered
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Client & Deal</th>
                <th className="px-5 py-3">PO Amount (Received)</th>
                <th className="px-5 py-3">Quoted Amount</th>
                <th className="px-5 py-3">Reconciliation Status</th>
                <th className="px-5 py-3 text-right">Actions & Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : pos?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center space-y-3">
                    <p className="font-semibold text-slate-600">No purchase orders found matching the filter.</p>
                    <Link
                      to="/quotes"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-blue-700"
                    >
                      View Approved Quotes
                    </Link>
                  </td>
                </tr>
              ) : (
                pos?.map((po: any) => {
                  const clientName =
                    po.quote?.deal?.lead?.company ||
                    `${po.quote?.deal?.lead?.firstName || ""} ${po.quote?.deal?.lead?.lastName || ""}`.trim() ||
                    "Unknown Client";
                  const dealName = po.quote?.deal?.name || "Linked Deal";
                  const quotedAmount = Number(po.quote?.totalAmount || 0);
                  const receivedAmount = Number(po.amount || 0);
                  const isFlagged = po.status === "Flagged/Mismatch";
                  const isAccepted = po.status === "Accepted" || po.status === "Verified";
                  const isRejected = po.status === "Rejected";

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* PO Number */}
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{po.poNumber || po.id.substring(0, 8)}</span>
                        </div>
                      </td>

                      {/* Client & Deal */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 line-clamp-1">{clientName}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{dealName}</div>
                      </td>

                      {/* Received Amount */}
                      <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(receivedAmount)}
                      </td>

                      {/* Quoted Amount */}
                      <td className="px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap">
                        {quotedAmount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span>{formatCurrency(quotedAmount)}</span>
                            {isFlagged && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                Δ {formatCurrency(Math.abs(receivedAmount - quotedAmount))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Flagged/Mismatch
                          </span>
                        ) : isAccepted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            {po.status}
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            {po.status || "Pending"}
                          </span>
                        )}
                      </td>

                      {/* Actions & Resolution */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* If Flagged: Surface Real Resolution Actions */}
                          {isFlagged && (
                            <>
                              <button
                                onClick={() => setConfirmModalPO(po)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                title="Confirm PO and move deal to Won despite amount mismatch"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                Confirm (Won)
                              </button>
                              <button
                                onClick={() => setRejectModalPO(po)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                title="Reject PO and mark deal as Lost"
                              >
                                <X className="w-3 h-3 stroke-[3]" />
                                Reject (Lost)
                              </button>
                            </>
                          )}

                          {isAccepted && po.quoteId && (
                            <button
                              onClick={() => invoiceMutation.mutate(po.quoteId)}
                              disabled={invoiceMutation.isPending}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase rounded-lg transition-all shadow-2xs"
                              title="Generate Invoice from associated Quote"
                            >
                              Create Invoice
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (po.quoteId)
                                downloadAuthenticatedFile(
                                  `/api/v1/quotes/${po.quoteId}/pdf`,
                                  `Quote_${po.quoteId.substring(0, 8)}.pdf`,
                                  token
                                );
                              else alert("No associated quote document found.");
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors"
                            title="Download Associated Quote PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CONFIRM MISMATCHED PO (DEAL -> WON) ── */}
      {confirmModalPO && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirm PO Despite Mismatch
              </h3>
              <button onClick={() => setConfirmModalPO(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-lg border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
              <div className="flex justify-between">
                <span>Quoted Value:</span>
                <span className="font-bold">{formatCurrency(confirmModalPO.quote?.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>PO Value Received:</span>
                <span className="font-extrabold text-emerald-800">{formatCurrency(confirmModalPO.amount || 0)}</span>
              </div>
              <div className="text-[11px] text-emerald-800/80 pt-1 border-t border-emerald-200/60">
                Confirming will set PO status to <span className="font-bold">Accepted</span> and move linked deal{" "}
                <span className="font-bold">"{confirmModalPO.quote?.deal?.name}"</span> to <span className="font-bold">Won</span>.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Approval Rationale / Commercial Variance Notes
              </label>
              <textarea
                rows={2}
                value={confirmRationale}
                onChange={(e) => setConfirmRationale(e.target.value)}
                placeholder="e.g. Approved acceptable 5% variance per enterprise customer agreement..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmModalPO(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    poId: confirmModalPO.id,
                    payload: {
                      action: "CONFIRM_ANYWAY",
                      resolutionNotes: confirmRationale
                    }
                  })
                }
                disabled={resolveMutation.isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                {resolveMutation.isPending ? "Confirming..." : "Confirm & Mark Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REJECT MISMATCHED PO (DEAL -> LOST) ── */}
      {rejectModalPO && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Reject PO & Close Deal as Lost
              </h3>
              <button onClick={() => setRejectModalPO(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-lg border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-950">
              <div className="flex justify-between">
                <span>Quoted Value:</span>
                <span className="font-bold">{formatCurrency(rejectModalPO.quote?.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>PO Value Received:</span>
                <span className="font-extrabold text-rose-800">{formatCurrency(rejectModalPO.amount || 0)}</span>
              </div>
              <div className="text-[11px] text-rose-800/80 pt-1 border-t border-rose-200/60">
                Rejecting will set PO status to <span className="font-bold">Rejected</span> and close linked deal{" "}
                <span className="font-bold">"{rejectModalPO.quote?.deal?.name}"</span> as <span className="font-bold">Lost</span>.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loss Reason Category *</label>
              <select
                value={rejectLossReason}
                onChange={(e) => setRejectLossReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none font-semibold text-slate-800 bg-white"
              >
                <option value="Commercial Variance / Scope Reduced">Commercial Variance / Scope Reduced</option>
                <option value="Pricing / Budget Pushback">Pricing / Budget Pushback</option>
                <option value="Customer Cancelled Project">Customer Cancelled Project</option>
                <option value="Lost to Competitor">Lost to Competitor</option>
                <option value="Procurement Terms Rejected">Procurement Terms Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Explanation / Loss Notes</label>
              <textarea
                rows={2}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Customer issued partial PO for 40% value without authorization. Commercial terms rejected..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectModalPO(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    poId: rejectModalPO.id,
                    payload: {
                      action: "REJECT_LOST",
                      lossReason: rejectLossReason,
                      lossNotes: rejectNotes
                    }
                  })
                }
                disabled={resolveMutation.isPending || !rejectLossReason}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                {resolveMutation.isPending ? "Rejecting..." : "Reject & Mark Lost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
