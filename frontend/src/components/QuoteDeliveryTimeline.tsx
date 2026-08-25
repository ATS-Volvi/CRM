import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, CheckCircle2, Eye, AlertTriangle, XCircle, Clock, Mail, MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";
import { apiClient } from "../lib/apiClient";

export interface QuoteDeliveryEvent {
  id: string;
  quoteId: string;
  channel: string;
  recipient: string;
  status: "SENT" | "DELIVERED" | "BOUNCED" | "VIEWED" | "FAILED" | string;
  providerMessageId?: string | null;
  occurredAt: string | Date;
  notes?: string | null;
  createdAt?: string | Date;
}

interface QuoteDeliveryTimelineProps {
  quoteId: string;
  initialDeliveries?: QuoteDeliveryEvent[];
  className?: string;
}

export function QuoteDeliveryTimeline({
  quoteId,
  initialDeliveries,
  className = ""
}: QuoteDeliveryTimelineProps) {
  const { data: deliveries = initialDeliveries || [], isLoading } = useQuery<QuoteDeliveryEvent[]>({
    queryKey: ["quote-deliveries", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      return await apiClient.get<QuoteDeliveryEvent[]>(`/api/v1/quotes/${quoteId}/deliveries`);
    },
    enabled: !!quoteId,
    initialData: initialDeliveries
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SENT":
        return {
          label: "Sent to Client",
          icon: <Send className="w-3.5 h-3.5 text-sky-600" />,
          bgColor: "bg-sky-50",
          borderColor: "border-sky-200",
          textColor: "text-sky-800"
        };
      case "DELIVERED":
        return {
          label: "Delivered",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          bgColor: "bg-emerald-50",
          borderColor: "border-emerald-200",
          textColor: "text-emerald-800"
        };
      case "VIEWED":
        return {
          label: "Viewed by Client",
          icon: <Eye className="w-3.5 h-3.5 text-purple-600" />,
          bgColor: "bg-purple-50",
          borderColor: "border-purple-200",
          textColor: "text-purple-800"
        };
      case "BOUNCED":
        return {
          label: "Bounced",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          textColor: "text-amber-800"
        };
      case "FAILED":
        return {
          label: "Delivery Failed",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
          bgColor: "bg-rose-50",
          borderColor: "border-rose-200",
          textColor: "text-rose-800"
        };
      default:
        return {
          label: status || "Event",
          icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
          bgColor: "bg-slate-50",
          borderColor: "border-slate-200",
          textColor: "text-slate-700"
        };
    }
  };

  const formatEventDate = (dateVal: string | Date) => {
    try {
      const d = new Date(dateVal);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return String(dateVal);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Delivery History & Status
        </h4>
        <span className="text-[10px] text-slate-400 font-medium">
          {deliveries.length} {deliveries.length === 1 ? "event" : "events"}
        </span>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-xs text-slate-400">Loading delivery timeline...</div>
      ) : deliveries.length === 0 ? (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
          No delivery events recorded yet. Click <strong>Send Quote</strong> to deliver this proposal.
        </div>
      ) : (
        <div className="relative pl-5 border-l-2 border-slate-200 space-y-4 py-1">
          {deliveries.map((item, idx) => {
            const badge = getStatusBadge(item.status);
            const isEmail = item.channel?.toUpperCase() === "EMAIL";
            const isWhatsApp = item.channel?.toUpperCase() === "WHATSAPP";

            return (
              <div key={item.id || idx} className="relative group">
                {/* Bullet Icon */}
                <div className={`absolute -left-[27px] top-1 w-5 h-5 rounded-full border-2 ${badge.borderColor} ${badge.bgColor} flex items-center justify-center shadow-2xs`}>
                  {badge.icon}
                </div>

                {/* Event Card */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        {isEmail ? <Mail className="w-3 h-3 text-sky-500" /> : isWhatsApp ? <MessageSquare className="w-3 h-3 text-emerald-500" /> : <ExternalLink className="w-3 h-3 text-purple-500" />}
                        {item.channel}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatEventDate(item.occurredAt || item.createdAt || new Date())}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2">
                    <span className="truncate">
                      Recipient: <strong className="text-slate-800 font-medium">{item.recipient}</strong>
                    </span>
                    {item.providerMessageId && (
                      <span className="text-[9px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded shrink-0" title={`Provider Message ID: ${item.providerMessageId}`}>
                        ID: {item.providerMessageId.slice(0, 10)}...
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 italic">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
