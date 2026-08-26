import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, X, Send, Bot, User, ArrowRight, CheckCircle2, AlertTriangle,
  Zap, Building2, Target, Users, FileText, Loader2, ExternalLink, RefreshCw
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";
import { AIReportVisualizer, AIReportPayload } from "./AIReportVisualizer";

interface CopilotMessage {
  sender: "user" | "ai";
  text?: string;
  report?: AIReportPayload;
}

export function AiCopilotDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isPending, setIsPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      sender: "ai",
      text: `Hello ${user?.name || "there"}! I am your Nexus CRM AI Copilot. Ask me anything about deals at risk, pipeline velocity, rep performance, or marketing attribution.`
    }
  ]);

  const quickPrompts = [
    "Show deals at risk of stalling",
    "Show me the reports on Liam Carter",
    "Pipeline velocity and win rates",
    "Sales rep quota leaderboard",
    "Lead source attribution & ROI"
  ];

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isPending]);

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
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-slate-50 dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200 dark:border-slate-800" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                Nexus AI Sales Copilot
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white">
                  RAG Analytics
                </span>
              </h2>
              <p className="text-[11px] opacity-75 font-medium">Predictive Intelligence & Multi-Graph Visualizer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate("/ai-reports");
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all text-white/90"
              title="Open full page analytics"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Studio</span>
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              disabled={isPending}
              onClick={() => handleSend(p)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shadow-2xs cursor-pointer disabled:opacity-50"
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
                m.sender === "user" ? "bg-primary text-white" : "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white"
              }`}>
                {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                {m.sender === "user" ? (
                  <div className="bg-primary text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs font-semibold shadow-sm inline-block float-right max-w-[85%]">
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
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none p-4 text-xs leading-relaxed shadow-xs whitespace-pre-line">
                    {m.text}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isPending && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-4 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Querying database & synthesizing graphs...
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
            placeholder="Ask AI Copilot (e.g. 'Show deals at risk of stalling')..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-slate-900 dark:text-white"
          />
          <button 
            type="submit" 
            disabled={!query.trim() || isPending}
            className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 active:scale-95 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
