import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Send, Mail, MessageSquare, AlertCircle, CheckCircle2, Sparkles, User, Plus, XCircle } from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";

interface SendQuoteChannelModalProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  onSent?: (result: any) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendQuoteChannelModal({
  quoteId,
  isOpen,
  onClose,
  onSent
}: SendQuoteChannelModalProps) {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [customNote, setCustomNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // CC state
  const [ccInput, setCcInput] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInputError, setCcInputError] = useState("");

  // Success confirmation state
  const [sentResult, setSentResult] = useState<{ recipient: string; cc?: string[] } | null>(null);

  // Fetch delivery preview
  const { data: preview, isLoading } = useQuery({
    queryKey: ["quote-delivery-preview", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      return await apiClient.get<any>(`/api/v1/quotes/${quoteId}/delivery-channel`);
    },
    enabled: isOpen && !!quoteId
  });

  React.useEffect(() => {
    if (preview?.recommendedChannel) {
      setSelectedChannel(preview.recommendedChannel);
    } else if (preview?.availableChannels?.whatsapp && !preview?.availableChannels?.email) {
      setSelectedChannel("WHATSAPP");
    } else {
      setSelectedChannel("EMAIL");
    }
  }, [preview]);

  // Reset when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setCcInput("");
      setCcList([]);
      setCcInputError("");
      setSentResult(null);
      setErrorMessage("");
      setCustomNote("");
    }
  }, [isOpen]);

  const addCcEntry = () => {
    const trimmed = ccInput.trim();
    if (!trimmed) return;
    if (!EMAIL_REGEX.test(trimmed)) {
      setCcInputError(`"${trimmed}" is not a valid email address.`);
      return;
    }
    if (ccList.includes(trimmed)) {
      setCcInputError(`"${trimmed}" is already in the CC list.`);
      return;
    }
    setCcList((prev) => [...prev, trimmed]);
    setCcInput("");
    setCcInputError("");
  };

  const removeCcEntry = (email: string) => setCcList((prev) => prev.filter((e) => e !== email));

  const handleCcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCcEntry();
    }
    if (e.key === "Backspace" && ccInput === "" && ccList.length > 0) {
      setCcList((prev) => prev.slice(0, -1));
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage("");
      return await apiClient.post(`/api/v1/quotes/${quoteId}/send`, {
        channel: selectedChannel,
        messageCustomization: customNote.trim() || undefined,
        cc: ccList.length > 0 ? ccList : undefined
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["quote-detail", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-bill-modal", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-detail"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities-master-list"] });
      setSentResult({
        recipient: data?.recipient || preview?.contact?.email || "Primary contact",
        cc: ccList.length > 0 ? [...ccList] : undefined
      });
      if (onSent) onSent(data);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.error || err.message || "Failed to deliver quote");
    }
  });

  if (!isOpen) return null;

  const contact = preview?.contact;
  const hasEmail = Boolean(contact?.email);
  const noChannelAvailable = !hasEmail && !Boolean(contact?.whatsappNumber || contact?.phone);

  // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
  if (sentResult) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <div>
                <h2 className="text-sm font-bold text-white">Quotation Sent</h2>
                <p className="text-[11px] text-emerald-200">Delivered successfully via Email</p>
              </div>
            </div>
            <button onClick={onClose} className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-3 text-xs">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="font-bold text-emerald-800 text-[11px] uppercase tracking-wide">Recipients who received this quote</p>
              <div className="flex items-center gap-2 text-emerald-900">
                <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold">{sentResult.recipient}</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">PRIMARY</span>
              </div>
              {sentResult.cc && sentResult.cc.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-emerald-200">
                  {sentResult.cc.map((addr) => (
                    <div key={addr} className="flex items-center gap-2 text-emerald-800">
                      <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{addr}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">CC</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white font-bold rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700 transition-colors text-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN MODAL ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Send Quotation to Client</h2>
              <p className="text-[11px] text-slate-400">
                {preview?.quoteNumber ? `Quote #${preview.quoteNumber}` : "Dispatch official quote"}
                {preview?.totalAmount ? ` • ${formatCurrency(preview.totalAmount)}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full" />
              <p>Resolving contact communication preferences...</p>
            </div>
          ) : (
            <>
              {/* Contact Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {contact?.name || "Recipient Contact"}
                  </span>
                  {contact?.preferredCommunicationChannel && contact.preferredCommunicationChannel !== "UNSPECIFIED" && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                      Prefers: {contact.preferredCommunicationChannel}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{contact?.email || <span className="text-amber-600 italic">No email address on file</span>}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{contact?.whatsappNumber || contact?.phone || <span className="text-amber-600 italic">No WhatsApp / phone on file</span>}</span>
                  </div>
                </div>
              </div>

              {/* Recommendation Callout */}
              {preview?.resolutionReason && !noChannelAvailable && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-sky-900">
                  <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[11px]">Recommended: {preview.recommendedChannel}</div>
                    <div className="text-[11px] text-sky-700 mt-0.5">{preview.resolutionReason}</div>
                  </div>
                </div>
              )}

              {/* Channel Notice */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Quotation Delivery Channel (Email-First):</label>
                <div className="p-3.5 rounded-xl border border-sky-600 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-xs text-sky-950 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>Email Delivery</span>
                        <span className="text-[10px] bg-sky-200 text-sky-800 font-bold px-1.5 py-0.5 rounded">Standard Policy</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {contact?.email ? (
                          <span className="font-semibold text-slate-800">{contact.email}</span>
                        ) : (
                          <span className="text-amber-700 italic font-medium">No customer email on file — quotation delivery blocked</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasEmail && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                </div>
              </div>

              {/* Additional Recipients (CC) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Additional Recipients (CC)
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">Optional — press Enter or comma to add</span>
                </label>

                {ccList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {ccList.map((addr) => (
                      <span
                        key={addr}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-lg text-[11px] font-medium border border-sky-200"
                      >
                        <Mail className="w-2.5 h-2.5 shrink-0" />
                        {addr}
                        <button
                          type="button"
                          onClick={() => removeCcEntry(addr)}
                          className="ml-0.5 text-sky-500 hover:text-rose-600 transition-colors"
                          aria-label={`Remove ${addr}`}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <input
                    type="email"
                    placeholder="cc@example.com"
                    value={ccInput}
                    onChange={(e) => { setCcInput(e.target.value); setCcInputError(""); }}
                    onKeyDown={handleCcKeyDown}
                    onBlur={() => { if (ccInput.trim()) addCcEntry(); }}
                    className={`flex-1 px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      ccInputError ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addCcEntry}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 transition-colors"
                    aria-label="Add CC recipient"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {ccInputError && (
                  <p className="text-rose-600 text-[11px] flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {ccInputError}
                  </p>
                )}
              </div>

              {/* Custom Message Note */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Optional Message Note:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please find the revised discounted proposal as discussed."
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Error Callout */}
              {(errorMessage || noChannelAvailable) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Delivery Blocked</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      {errorMessage || "No valid email or phone number found for this recipient. Please update contact details on the lead or account before sending."}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sendMutation.isPending || noChannelAvailable || isLoading}
            onClick={() => sendMutation.mutate()}
            className="px-4 py-2 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {sendMutation.isPending
                ? "Delivering Email..."
                : ccList.length > 0
                  ? `Send to ${1 + ccList.length} Recipients`
                  : "Send Official Quote via Email"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

