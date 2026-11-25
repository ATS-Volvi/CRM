import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, X, Send, Bot, User, ArrowRight, CheckCircle2, AlertTriangle,
  Zap, Building2, Target, Users, FileText, Loader2, ExternalLink, RefreshCw,
  Bell, Check, Search, ShieldAlert, Filter, Layers2, Clock, CheckCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVolviAssist, VolviTab } from "../context/VolviAssistContext";
import { apiClient } from "../lib/apiClient";
import { AIReportVisualizer, AIReportPayload } from "./AIReportVisualizer";

interface CopilotMessage {
  sender: "user" | "ai";
  text?: string;
  report?: AIReportPayload;
}

interface NotificationItem {
  id: string;
  role?: string;
  type: string;
  severity?: "INFO" | "ACTION_REQUIRED" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  groupKey?: string | null;
  groupCount?: number;
}

export function AiCopilotDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const { currentPrompt, setCurrentPrompt, activeAssistTab, setActiveAssistTab, setUnreadCount } = useVolviAssist();

  // Copilot Chat State
  const [query, setQuery] = useState("");
  const [isPending, setIsPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Notification Center State
  const [notifFilter, setNotifFilter] = useState<"all" | "unread" | "action">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      sender: "ai",
      text: `Hello ${user?.name || "Sophia"}! I am **Volvi Copilot**, your industrial power rental intelligence copilot and notification center. Grounded in SEC grid standards, motor inrush math, ZATCA tax rules, and live KSA fleet availability. Ask me technical calculations or inspect your active operational alerts.`
    }
  ]);

  const quickPrompts = [
    "Recommend generator for 260 kW with 3x DOL motor inrush",
    "Calculate voltage drop for 70m copper cable run at 400V",
    "Explain 20x monthly rental rate card multiplier & margin floor",
    "Verify ZATCA 15% VAT & Wathq CR compliance rules",
    "Show live available fleet in Riyadh & Jubail yards"
  ];

  // Fetch Live Notifications
  const { data: notifications = [], isLoading: isNotifsLoading } = useQuery<NotificationItem[]>({
    queryKey: ["volviNotifications", categoryFilter],
    queryFn: async () => {
      if (!token) return [];
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("entityType", categoryFilter);
      const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const unreadNotifs = useMemo(() => notifications.filter(n => !n.isRead), [notifications]);

  useEffect(() => {
    setUnreadCount(unreadNotifs.length);
  }, [unreadNotifs.length, setUnreadCount]);

  // Mark Single Notification as Read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volviNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  // Mark All Notifications as Read
  const readAllMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volviNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  // Filtered Notifications
  const filteredNotifs = useMemo(() => {
    return notifications.filter(n => {
      if (notifFilter === "unread" && n.isRead) return false;
      if (notifFilter === "action" && n.severity !== "ACTION_REQUIRED" && n.severity !== "CRITICAL") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, notifFilter, search]);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    const targetUrl = item.actionUrl || item.link;
    if (targetUrl) {
      navigate(targetUrl);
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen && currentPrompt) {
      handleSend(currentPrompt);
      setCurrentPrompt("");
    }
  }, [isOpen, currentPrompt]);

  useEffect(() => {
    if (isOpen && activeAssistTab === "copilot") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isPending, activeAssistTab]);

  const handleSend = async (text: string) => {
    const q = text || query;
    if (!q.trim() || isPending) return;

    const userMsg: CopilotMessage = { sender: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setIsPending(true);

    try {
      const res = await apiClient("/api/v1/ai-reports/query", {
        method: "POST",
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text || m.report?.summary || ""
          }))
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: data.text,
          report: data.report
        }
      ]);
    } catch (err: any) {
      console.error(err);
      let errMsg = "Sorry, I encountered an error while processing your request. ";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errMsg += parsed.error;
      } catch {
        errMsg += err.message;
      }
      setMessages(prev => [...prev, { sender: "ai", text: errMsg }]);
    } finally {
      setIsPending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[#FAF6F8] dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-left border-l border-[#E5D4DE] dark:border-slate-800" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Luxury Sky Blue Header */}
        <div className="p-4 border-b border-sky-300/40 flex items-center justify-between bg-gradient-to-r from-[#7BBDE8] via-[#65AEE4] to-[#519DDA] text-sky-950 shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/40 rounded-xl backdrop-blur-xs ring-1 ring-white/60 shadow-xs text-sky-950">
              <Bot className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                Volvi Copilot
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-200 border border-rose-400/30">
                  Industrial Power RAG & Alerts
                </span>
              </h2>
              <p className="text-[11px] opacity-75 font-medium">Domain Sizing Specs • SEC Standards • Real-Time Notifications</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate("/ai-reports");
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all text-white/90 cursor-pointer"
              title="Open full page analytics studio"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Studio</span>
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified Tab Switcher: Copilot vs Alerts */}
        <div className="flex items-center border-b border-[#E5D4DE] dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 pt-2.5 gap-3 shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveAssistTab("copilot")}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeAssistTab === "copilot"
                ? "border-[#45142B] text-[#45142B] dark:border-rose-400 dark:text-rose-300 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bot className="w-4 h-4 text-amber-500" />
            <span>Industrial Copilot</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAssistTab("alerts")}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
              activeAssistTab === "alerts"
                ? "border-[#45142B] text-[#45142B] dark:border-rose-400 dark:text-rose-300 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bell className="w-4 h-4 text-[#ED1A53]" />
            <span>Notifications & Alerts</span>
            {unreadNotifs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#ED1A53] text-white text-[9px] font-black shadow-xs ring-1 ring-white/20 animate-pulse">
                {unreadNotifs.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: COPILOT & RAG CHAT */}
        {activeAssistTab === "copilot" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Quick Prompts Bar */}
            <div className="p-2.5 border-b border-[#E5D4DE] dark:border-slate-800 bg-[#FAF6F8] dark:bg-slate-900/80 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  disabled={isPending}
                  onClick={() => handleSend(p)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#45142B] hover:text-white border border-[#E5D4DE] dark:border-slate-700 text-[#45142B] dark:text-slate-300 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Chat Feed & Visualizations */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-3 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-sm ${
                    m.sender === "user" ? "bg-[#45142B] text-white" : "bg-gradient-to-tr from-[#ED1A53] to-[#8F0D30] text-white ring-1 ring-white/20"
                  }`}>
                    {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-300" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {m.sender === "user" ? (
                      <div className="bg-[#45142B] text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs font-semibold shadow-sm inline-block float-right max-w-[85%]">
                        {m.text}
                      </div>
                    ) : m.report ? (
                      <div className="bg-transparent space-y-3">
                        <AIReportVisualizer
                          report={m.report}
                          onFollowUpClick={(q) => handleSend(q)}
                        />
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 border border-[#E5D4DE] dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed shadow-xs whitespace-pre-line">
                        {m.text}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isPending && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ED1A53] to-[#8F0D30] text-white flex items-center justify-center shadow-sm shrink-0">
                    <Bot className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-4 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-[#ED1A53]" />
                    Volvi Copilot is querying engineering specs & synthesizing calculations...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Query Input */}
            <form onSubmit={e => { e.preventDefault(); handleSend(query); }} className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={isPending}
                placeholder="Ask Volvi Copilot (e.g. 'Recommend generator for 260 kW with 3x DOL motor inrush')..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#ED1A53] disabled:opacity-50 text-slate-900 dark:text-white"
              />
              <button 
                type="submit" 
                disabled={!query.trim() || isPending}
                className="p-2.5 bg-gradient-to-r from-[#ED1A53] to-[#F14473] hover:from-[#d81548] hover:to-[#e03a67] active:scale-95 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-[#ED1A53]/20"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: ALERTS & NOTIFICATIONS HUB */}
        {activeAssistTab === "alerts" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* AI Executive Notification Digest */}
            <div className="p-4 border-b border-[#E5D4DE] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-[#45142B]/10 via-[#ED1A53]/10 to-transparent border border-[#ED1A53]/25 flex items-start gap-2.5">
                <Bot className="w-5 h-5 text-[#ED1A53] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                  <strong className="block font-black text-[#45142B] dark:text-rose-300">
                    Volvi Copilot Live Briefing • {user?.name || "Sophia Martinez"}
                  </strong>
                  You have <strong className="text-[#ED1A53]">{notifications.length} total notifications</strong> ({unreadNotifs.length} unread). {unreadNotifs.length > 0 ? "Items require your commercial or operational sign-off." : "All workflow gates are up to date."}
                </div>
              </div>

              {/* Filter Buttons & Read All */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setNotifFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      notifFilter === "all" ? "bg-[#45142B] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter("unread")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      notifFilter === "unread" ? "bg-[#ED1A53] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Unread ({unreadNotifs.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter("action")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      notifFilter === "action" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Action Required
                  </button>
                </div>

                {unreadNotifs.length > 0 && (
                  <button
                    onClick={() => readAllMutation.mutate()}
                    className="text-xs text-[#ED1A53] hover:text-[#C71042] font-black flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter alerts by client, quote, generator or contract..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-[#E5D4DE] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED1A53] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Scrollable Notifications Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isNotifsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#ED1A53]" />
                  Loading notifications...
                </div>
              ) : filteredNotifs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 opacity-60" />
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">You're all caught up!</p>
                  <p className="text-xs text-slate-500">No active notifications matching the current filter.</p>
                </div>
              ) : (
                filteredNotifs.map(n => {
                  const severity = n.severity || "INFO";
                  const isAction = severity === "ACTION_REQUIRED" || severity === "CRITICAL";

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3 shadow-2xs hover:shadow-md ${
                        !n.isRead
                          ? "bg-white dark:bg-slate-800 border-[#ED1A53]/35 ring-1 ring-[#ED1A53]/20"
                          : "bg-white/80 dark:bg-slate-800/80 border-[#E5D4DE] dark:border-slate-700 opacity-90"
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 self-start ${
                        severity === "CRITICAL" ? "bg-rose-100 text-rose-700" :
                        severity === "ACTION_REQUIRED" ? "bg-amber-100 text-amber-700" :
                        "bg-[#45142B]/10 text-[#45142B]"
                      }`}>
                        {severity === "CRITICAL" ? (
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                        ) : severity === "ACTION_REQUIRED" ? (
                          <Zap className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Bot className="w-4 h-4 text-[#45142B]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            severity === "CRITICAL" ? "bg-rose-100 text-rose-800" :
                            severity === "ACTION_REQUIRED" ? "bg-amber-100 text-amber-800" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {severity.replace("_", " ")}
                          </span>

                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">{n.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{n.message}</p>

                        <div className="pt-1.5 flex items-center justify-between">
                          {n.actionUrl || n.link ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#ED1A53] hover:underline">
                              <span>Open Workflow Step</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          ) : <span />}

                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markReadMutation.mutate(n.id);
                              }}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
