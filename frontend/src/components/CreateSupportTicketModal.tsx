import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, LifeBuoy, Building2, Package, Tag, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface CreateSupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
  defaultAssetId?: string;
  onSuccess?: (ticket: any) => void;
}

const CATEGORIES = [
  { value: "issue", label: "Incident / Issue", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "maintenance", label: "Scheduled Maintenance", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "other", label: "General Support / Other", color: "bg-slate-100 text-slate-700 border-slate-300" },
];

export function CreateSupportTicketModal({
  isOpen,
  onClose,
  defaultAccountId,
  defaultAssetId,
  onSuccess
}: CreateSupportTicketModalProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState<string>(defaultAccountId || "");
  const [assetId, setAssetId] = useState<string>(defaultAssetId || "");
  const [category, setCategory] = useState<string>("issue");
  const [description, setDescription] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync defaults
  useEffect(() => {
    if (isOpen) {
      setAccountId(defaultAccountId || "");
      setAssetId(defaultAssetId || "");
      setCategory("issue");
      setDescription("");
      setErrorMessage(null);
    }
  }, [isOpen, defaultAccountId, defaultAssetId]);

  // 1. Fetch Accounts for selector
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: isOpen
  });

  // 2. Fetch Assets for selected account
  const { data: assets = [] } = useQuery({
    queryKey: ["assets-for-account-tickets", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const res = await fetch(`/api/v1/assets?customerId=${accountId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: isOpen && !!accountId
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: {
      accountId: string;
      assetId?: string | null;
      category: string;
      description: string;
    }) => {
      const res = await fetch("/api/v1/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create support ticket");
      }
      return res.json();
    },
    onSuccess: (newTicket) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["account-support-tickets", accountId] });
      queryClient.invalidateQueries({ queryKey: ["asset-support-tickets", assetId] });
      if (onSuccess) onSuccess(newTicket);
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to create support ticket");
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!accountId) {
      setErrorMessage("Please select a customer account.");
      return;
    }
    if (!description.trim()) {
      setErrorMessage("Please enter a description for the support ticket.");
      return;
    }

    createTicketMutation.mutate({
      accountId,
      assetId: assetId || null,
      category,
      description: description.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
        
        {/* Header */}
        <div className="px-6 py-5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-sm">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Raise Support Ticket</h2>
              <p className="text-xs text-on-surface-variant">Log customer issues, maintenance requests, or service inquiries.</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Account Selector (Required) */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Customer Account <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setAssetId(""); // reset asset when account changes
                }}
                disabled={!!defaultAccountId}
                className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all disabled:opacity-75 disabled:bg-surface-container"
              >
                <option value="">-- Select Customer Account --</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.primaryContactName ? `(${acc.primaryContactName})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Asset Selector (Optional - Filtered to Account) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                Associated Asset <span className="text-on-surface-variant font-normal lowercase">(optional)</span>
              </label>
              {accountId && assets.length > 0 && (
                <span className="text-[11px] text-blue-600 font-semibold">{assets.length} asset(s) registered</span>
              )}
            </div>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={!accountId || (!!defaultAssetId)}
              className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all disabled:opacity-50"
            >
              <option value="">
                {!accountId 
                  ? "-- Select an account first --" 
                  : assets.length === 0 
                  ? "-- No assets found for this account --" 
                  : "-- Select Equipment / Asset (Optional) --"}
              </option>
              {assets.map((asset: any) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} • S/N: {asset.serialNumber || "N/A"} ({asset.status || "In Service"})
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Ticket Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all ${
                    category === cat.value
                      ? `${cat.color} ring-2 ring-primary/30 shadow-sm`
                      : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Issue / Service Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide specific details about the fault, maintenance scope, or customer inquiry..."
              className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
            />
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
              disabled={createTicketMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {createTicketMutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Ticket
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
