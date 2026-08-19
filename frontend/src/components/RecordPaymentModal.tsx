import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, DollarSign, Calendar, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer / Wire" },
  { value: "card", label: "Credit / Debit Card" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export function RecordPaymentModal({
  isOpen,
  onClose,
  invoice,
  onSuccess
}: RecordPaymentModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const totalDue = Number(invoice?.totalAmount || 0) * 1.05;
  const currentPaid = Number(invoice?.amountPaid || 0);
  const remainingBalance = Math.max(0, totalDue - currentPaid);

  const [amount, setAmount] = useState<string>(remainingBalance.toFixed(2));
  const [method, setMethod] = useState<string>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default amount when remaining balance changes
  React.useEffect(() => {
    if (isOpen) {
      setAmount(remainingBalance.toFixed(2));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setReference("");
      setErrorMessage(null);
    }
  }, [isOpen, remainingBalance]);

  const paymentMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      method: string;
      paymentDate: string;
      reference: string;
    }) => {
      const res = await fetch(`/api/v1/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to record payment");
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than 0.");
      return;
    }

    paymentMutation.mutate({
      amount: numAmount,
      method,
      paymentDate: paymentDate || new Date().toISOString(),
      reference: reference.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
        
        {/* Header */}
        <div className="px-6 py-5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Record Payment</h2>
              <p className="text-xs text-on-surface-variant">
                Invoice INV-{invoice.id.substring(0, 6).toUpperCase()} • Balance: {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/60">
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Total Due</span>
              <p className="text-base font-bold text-on-surface mt-0.5">{formatCurrency(totalDue)}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Remaining Balance</span>
              <p className={`text-base font-bold mt-0.5 ${remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Payment Amount ($) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          {/* Reference / Transaction ID */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Reference / Transaction ID <span className="text-on-surface-variant font-normal lowercase">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Wire Ref #892301, Cheque #004312"
                className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {paymentMutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Payment
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
