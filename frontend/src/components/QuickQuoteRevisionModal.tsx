import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  X,
  Plus,
  Trash2,
  Sparkles,
  Percent,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";

interface QuickQuoteRevisionModalProps {
  quoteId: string;
  opportunityId: string;
  opportunityName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickQuoteRevisionModal({
  quoteId,
  opportunityId,
  opportunityName,
  onClose,
  onSuccess
}: QuickQuoteRevisionModalProps) {
  const queryClient = useQueryClient();

  const [revisionNotes, setRevisionNotes] = useState<string>("");
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(0);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch full parent quote including line items
  const { data: quoteData, isLoading } = useQuery({
    queryKey: ["quote-details-for-revision", quoteId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/v1/quotes/${quoteId}`);
      return res;
    },
    enabled: !!quoteId
  });

  const parentQuote = quoteData;

  useEffect(() => {
    if (parentQuote && parentQuote.QuoteLineItems) {
      const items = parentQuote.QuoteLineItems.map((li: any) => ({
        productId: li.productId,
        name: li.product?.name || li.description || "Product / Service",
        sku: li.product?.sku || "SKU",
        quantity: Number(li.quantity || 1),
        unitPrice: Number(li.unitPrice || 0),
        discount: Number(li.discount || 0),
        tax: Number(li.tax || 0),
        description: li.description || "",
        isOptional: li.isOptional || false
      }));
      setLineItems(items);
      setRevisionNotes(`Revision based on customer commercial negotiations.`);
    }
  }, [parentQuote]);

  const updateItem = (index: number, field: string, value: any) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const applyGlobalDiscount = (pct: number) => {
    setGlobalDiscountPct(pct);
    setLineItems((prev) =>
      prev.map((item) => {
        const base = Number(item.unitPrice || 0);
        return {
          ...item,
          discount: pct
        };
      })
    );
  };

  const calculateSubtotal = () => {
    return lineItems
      .filter((i) => !i.isOptional)
      .reduce((sum, i) => {
        const base = Number(i.quantity || 1) * Number(i.unitPrice || 0);
        const disc = base * (Number(i.discount || 0) / 100);
        return sum + (base - disc);
      }, 0);
  };

  const subtotal = calculateSubtotal();
  const parentTotal = Number(parentQuote?.totalAmount || 0);
  const nextVersion = Number(parentQuote?.version || 1) + 1;

  const revisionMutation = useMutation({
    mutationFn: async () => {
      if (lineItems.length === 0) {
        throw new Error("Revision must contain at least one line item.");
      }

      const payload = {
        items: lineItems.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount || 0),
          tax: Number(i.tax || 0),
          description: i.description,
          isOptional: i.isOptional
        })),
        notes: revisionNotes,
        discountOverride: globalDiscountPct > 0 ? globalDiscountPct : undefined
      };

      return apiClient.post(`/api/v1/quotes/${quoteId}/create-revision`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onSuccess();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to create quote revision.");
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-5 animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Create Quote Revision</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  v{nextVersion} Draft
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pre-filled from {parentQuote?.quoteNumber || `Quote #${quoteId.slice(0, 8)}`} (v{parentQuote?.version || 1}) · <span className="font-semibold text-slate-700">{opportunityName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading parent quote items...</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Quick Discount Presets */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Quick Commercial Concession:
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 5, 7.5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyGlobalDiscount(pct)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      globalDiscountPct === pct
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {pct === 0 ? "Standard" : `-${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Item / Service</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2 w-28 text-right">Unit Price (₹)</th>
                    <th className="py-2.5 px-2 w-20 text-center">Disc %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, index) => {
                    const itemBase = Number(item.quantity || 1) * Number(item.unitPrice || 0);
                    const itemDisc = itemBase * (Number(item.discount || 0) / 100);
                    const itemTotal = itemBase - itemDisc;

                    return (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900 line-clamp-1">{item.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 text-center px-1.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-24 text-right px-1.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.discount}
                            onChange={(e) => updateItem(index, "discount", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="w-14 text-center px-1.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold text-amber-700"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(itemTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Revision Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Revision Context & Concession Rationale</label>
              <textarea
                rows={2}
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="e.g. Offered 7.5% commercial discount following procurement price pushback..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Commercial Comparison Box */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Parent (v{parentQuote?.version || 1}):</span>{" "}
                <span className="font-bold text-slate-700">{formatCurrency(parentTotal)}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-amber-900 font-bold">New Revision (v{nextVersion}):</span>{" "}
                <span className="text-base font-extrabold text-amber-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                Delta: <span className={subtotal < parentTotal ? "text-emerald-700 font-bold" : "text-slate-700"}>
                  {subtotal < parentTotal ? `-${formatCurrency(parentTotal - subtotal)} (${(((parentTotal - subtotal) / (parentTotal || 1)) * 100).toFixed(1)}%)` : "No reduction"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0">
          <p className="text-[11px] text-slate-400">
            Previous quote (v{parentQuote?.version || 1}) will automatically become <span className="font-semibold text-slate-600">Superseded</span>.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => revisionMutation.mutate()}
              disabled={revisionMutation.isPending || isLoading || lineItems.length === 0}
              type="button"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              {revisionMutation.isPending ? "Creating Revision..." : `Publish Revision v${nextVersion}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
