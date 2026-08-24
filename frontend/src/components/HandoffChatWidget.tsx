import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  User,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Clock,
  UserCheck,
  AlertCircle,
  RefreshCw,
  AtSign
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";

interface HandoffChatWidgetProps {
  dealId?: string;
  leadId?: string;
  recordTitle?: string;
  dealAmount?: number;
  participantsData?: any;
}

export function HandoffChatWidget({
  dealId,
  leadId,
  recordTitle = "Opportunity",
  dealAmount,
  participantsData
}: HandoffChatWidgetProps) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any>(participantsData || null);
  const [content, setContent] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchChat = async () => {
    if (!token || (!dealId && !leadId)) return;
    setFetching(true);
    setError(null);

    try {
      const param = dealId ? `dealId=${dealId}` : `leadId=${leadId}`;
      const res = await fetch(`/api/v1/handoff-messages?${param}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load handoff messages");
      }

      const data = await res.json();
      setMessages(data.data || []);
      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch (err: any) {
      console.error("[HandoffChatWidget] Fetch error:", err);
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchChat();
  }, [dealId, leadId, token]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || loading || !token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/handoff-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dealId: dealId || null,
          leadId: leadId || null,
          message: content.trim(),
          recipientId: selectedRecipientId || null
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to send message");
      }

      const newMsg = await res.json();
      setMessages(prev => [...prev, newMsg]);
      setContent("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickChatTarget = (targetUser: any) => {
    if (!targetUser) return;
    setSelectedRecipientId(targetUser.id);
    const prefix = `@${targetUser.name} `;
    if (!content.startsWith(prefix)) {
      setContent(prefix + content);
    }
  };

  const firstRep = participants?.firstQualifyingRep;
  const prevOwner = participants?.previousOwner;
  const currentOwner = participants?.currentOwner;
  const allReps: any[] = participants?.allParticipants || [];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                Handoff Communication Channel
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Internal Team Chat
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Direct context-aware chat between original rep, current owner &amp; team participants.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchChat}
          disabled={fetching}
          className="self-start sm:self-auto p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
          title="Refresh Messages"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Participant Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {firstRep && (
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
            <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Lead Qualified By (Salesman 1)
            </div>
            <div className="text-xs font-bold text-slate-900">{firstRep.name}</div>
            <div className="text-[10px] text-slate-500">{firstRep.email}</div>
            {user?.id !== firstRep.id && (
              <button
                type="button"
                onClick={() => handleQuickChatTarget(firstRep)}
                className="mt-1 text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <AtSign className="w-3 h-3" /> Mention {firstRep.name.split(" ")[0]}
              </button>
            )}
          </div>
        )}

        {prevOwner && prevOwner.id !== firstRep?.id && (
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
            <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
              Immediate Predecessor
            </div>
            <div className="text-xs font-bold text-slate-900">{prevOwner.name}</div>
            <div className="text-[10px] text-slate-500">{prevOwner.email}</div>
            {user?.id !== prevOwner.id && (
              <button
                type="button"
                onClick={() => handleQuickChatTarget(prevOwner)}
                className="mt-1 text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1"
              >
                <AtSign className="w-3 h-3" /> Mention {prevOwner.name.split(" ")[0]}
              </button>
            )}
          </div>
        )}

        {currentOwner && (
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
            <div className="text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Current Owner (Salesman 2)
            </div>
            <div className="text-xs font-bold text-slate-900">{currentOwner.name}</div>
            <div className="text-[10px] text-slate-500">{currentOwner.email}</div>
            {user?.id !== currentOwner.id && (
              <button
                type="button"
                onClick={() => handleQuickChatTarget(currentOwner)}
                className="mt-1 text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
              >
                <AtSign className="w-3 h-3" /> Mention {currentOwner.name.split(" ")[0]}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Room Access Error Notice */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages Thread Feed */}
      <div className="bg-surface rounded-xl border border-outline-variant p-4 max-h-[360px] overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-outline mx-auto" />
            <p className="text-xs text-on-surface-variant font-medium">
              No internal handoff messages yet for this record.
            </p>
            <p className="text-[11px] text-slate-400">
              Start the conversation below to coordinate on requirements or client handover details.
            </p>
          </div>
        ) : (
          messages.map((m: any) => {
            const isMe = m.senderId === user?.id;
            const senderName = m.sender?.name || "Teammate";
            const senderRole = m.sender?.role || "sales_rep";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}
              >
                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant px-1">
                  <span className="font-bold text-on-surface">{senderName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-slate-600 font-semibold uppercase">
                    {senderRole.replace("_", " ")}
                  </span>
                  <span>•</span>
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                    isMe
                      ? "bg-primary text-white rounded-tr-none shadow-sm"
                      : "bg-surface-container-high text-on-surface border border-outline-variant rounded-tl-none"
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSendMessage} className="space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Message handoff team regarding ${recordTitle}...`}
            disabled={loading}
            className="w-full bg-surface border border-outline rounded-xl py-3 pl-4 pr-12 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="absolute right-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1 font-bold text-xs shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
