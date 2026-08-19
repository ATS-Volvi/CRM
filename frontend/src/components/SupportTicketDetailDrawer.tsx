import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  X, LifeBuoy, Building2, Package, Tag, Clock, CheckCircle2, 
  AlertCircle, User, Calendar, ExternalLink, ShieldAlert, Wrench, Edit3 
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface SupportTicketDetailDrawerProps {
  ticket: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function SupportTicketDetailDrawer({
  ticket,
  isOpen,
  onClose,
  onUpdated
}: SupportTicketDetailDrawerProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (ticket) {
      setDescriptionDraft(ticket.description || "");
      setIsEditingDescription(false);
      setToastMessage(null);
    }
  }, [ticket]);

  const updateTicketMutation = useMutation({
    mutationFn: async (payload: { status?: string; category?: string; description?: string }) => {
      const res = await fetch(`/api/v1/support-tickets/${ticket.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["account-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-support-tickets"] });
      setIsEditingDescription(false);
      setToastMessage("Ticket updated successfully.");
      if (onUpdated) onUpdated();
    }
  });

  if (!isOpen || !ticket) return null;

  const currentStatus = ticket.status || "open";
  const currentCategory = ticket.category || "issue";

  const getStatusColor = (s: string) => {
    switch (s) {
      case "open": return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_progress": return "bg-amber-50 text-amber-700 border-amber-200";
      case "resolved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "closed": return "bg-slate-100 text-slate-700 border-slate-300";
      default: return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const getCategoryColor = (c: string) => {
    switch (c) {
      case "issue": return "bg-rose-50 text-rose-700 border-rose-200";
      case "maintenance": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "other": return "bg-slate-100 text-slate-700 border-slate-300";
      default: return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="bg-surface-container-lowest border-l border-outline-variant w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col justify-between">
        
        {/* Drawer Header */}
        <div>
          <div className="p-6 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-sm">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-on-surface font-mono">
                    TICK-{ticket.id.substring(0, 6).toUpperCase()}
                  </h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(currentStatus)}`}>
                    {currentStatus.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Logged on {new Date(ticket.createdAt).toLocaleDateString()}
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

          {toastMessage && (
            <div className="m-6 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {/* Body Content */}
          <div className="p-6 space-y-6">

            {/* Quick Status Transition Bar */}
            <div className="p-4 bg-surface-container-low/60 rounded-2xl border border-outline-variant/60 space-y-2.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Update Ticket Status</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "open", label: "Open" },
                  { key: "in_progress", label: "In Progress" },
                  { key: "resolved", label: "Resolved" },
                  { key: "closed", label: "Closed" }
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => updateTicketMutation.mutate({ status: st.key })}
                    disabled={updateTicketMutation.isPending || currentStatus === st.key}
                    className={`py-1.5 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      currentStatus === st.key
                        ? `${getStatusColor(st.key)} ring-2 ring-primary/20 shadow-sm`
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border-outline-variant/60"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Account & Asset Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Account Card */}
              <div className="p-4 bg-surface-container-low/40 rounded-2xl border border-outline-variant/60 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Customer Account</span>
                </div>
                {ticket.account ? (
                  <div>
                    <Link
                      to={`/accounts/${ticket.account.id}`}
                      className="text-sm font-bold text-on-surface hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {ticket.account.name}
                      <ExternalLink className="w-3 h-3 text-on-surface-variant" />
                    </Link>
                    <p className="text-xs text-on-surface-variant mt-0.5">{ticket.account.email || ticket.account.phone || "No contact info"}</p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">Unassigned Account</p>
                )}
              </div>

              {/* Asset Card */}
              <div className="p-4 bg-surface-container-low/40 rounded-2xl border border-outline-variant/60 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Associated Equipment</span>
                </div>
                {ticket.asset ? (
                  <div>
                    <Link
                      to="/assets"
                      className="text-sm font-bold text-on-surface hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {ticket.asset.name}
                      <ExternalLink className="w-3 h-3 text-on-surface-variant" />
                    </Link>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      S/N: {ticket.asset.serialNumber || "N/A"} • Status: {ticket.asset.status || "In Service"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">General Ticket (No Asset Linked)</p>
                )}
              </div>
            </div>

            {/* Category & Resolution Metadata */}
            <div className="p-4 bg-surface-container-low/30 rounded-2xl border border-outline-variant/60 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface-variant">Ticket Category:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${getCategoryColor(currentCategory)}`}>
                  {currentCategory}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-outline-variant/40 pt-2.5">
                <span className="font-semibold text-on-surface-variant">Raised By:</span>
                <span className="font-medium text-on-surface">
                  {ticket.raisedByUser?.name || ticket.raisedByUser?.email || "Staff Member"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-outline-variant/40 pt-2.5">
                <span className="font-semibold text-on-surface-variant">Resolved Date:</span>
                <span className="font-medium text-on-surface">
                  {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : "Pending Resolution"}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Issue Description & Notes
                </label>
                {!isEditingDescription ? (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="text-[11px] font-bold text-on-surface-variant hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => updateTicketMutation.mutate({ description: descriptionDraft })}
                      disabled={updateTicketMutation.isPending}
                      className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                    >
                      Save Description
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-surface-container-low/50 border border-outline-variant/60 rounded-2xl text-xs text-on-surface whitespace-pre-wrap leading-relaxed">
                  {ticket.description || "No description provided."}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-6 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
          <span className="text-xs text-on-surface-variant font-mono">UUID: {ticket.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
