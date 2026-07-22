import { useState } from "react";
import {
  Sparkles, X, Send, Bot, User, ArrowRight, CheckCircle2, AlertTriangle,
  Zap, Building2, Target, Users, FileText
} from "lucide-react";

export function AiCopilotDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; actionData?: any }>>([
    {
      sender: "ai",
      text: "Hello! I am your Nexus Enterprise AI Sales Copilot. Ask me anything about accounts, deal risks, target predictions, or customer follow-ups."
    }
  ]);

  const quickPrompts = [
    "Summarize Aegis Systems account",
    "Show deals at risk of stalling",
    "Who is likely to hit monthly target?",
    "Which manufacturing clients need follow-up?"
  ];

  const handleSend = (text: string) => {
    const q = text || query;
    if (!q.trim()) return;

    const userMsg = { sender: "user" as const, text: q };
    let aiResponseText = "";
    let actionData: any = null;

    const lower = q.toLowerCase();
    if (lower.includes("aegis")) {
      aiResponseText = "Here is the AI Account Summary for Aegis Systems Group:\n\n• Health Score: 85% (Healthy)\n• Lifetime Revenue: SAR 642.5K\n• Open Deals: 1 (Factory Safety Audit — SAR 268.5K)\n• Risk Level: Low\n• Next Best Action: Schedule site survey confirmation with Linda Martinez.";
      actionData = { type: "account", name: "Aegis Systems Group", revenue: "SAR 642.5K", status: "Healthy" };
    } else if (lower.includes("risk") || lower.includes("stall")) {
      aiResponseText = "AI Identified 3 Deals Currently at Risk (>7 Days Inactive):\n\n1. Starlight Energy Renewal (SAR 520K) — No activity for 9 days\n2. Matrix Pharma Cleanroom (SAR 195K) — Quote pending approval\n3. Metro Foods Supply Chain (SAR 890K) — Incident follow-up needed";
    } else if (lower.includes("target")) {
      aiResponseText = "Target Predictor Analysis for Q3:\n\n• Henry Cavill (Nordics) — 108% Likelihood\n• Sophia Chen (Greater China) — 96% Likelihood\n• Liam Carter (NA East) — 84% Likelihood";
    } else {
      aiResponseText = `Analysis complete for "${q}": Found 4 related accounts in Manufacturing and 2 open quotations awaiting client signature. Recommend sending automated follow-up reminders.`;
    }

    setMessages(prev => [...prev, userMsg, { sender: "ai", text: aiResponseText, actionData }]);
    setQuery("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold">Nexus AI Sales Copilot</h2>
              <p className="text-xs opacity-75">Predictive Intelligence & Account Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80"><X className="w-5 h-5" /></button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="p-3 border-b border-slate-100 bg-indigo-50/50 flex gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              className="px-2.5 py-1 bg-white border border-indigo-100 hover:border-indigo-300 text-indigo-700 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors shadow-2xs"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.sender === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                m.sender === "user" ? "bg-indigo-600 text-white" : "bg-purple-100 text-purple-700"
              }`}>
                {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[80%] space-y-2 ${
                m.sender === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 border border-slate-200 text-slate-800"
              }`}>
                <p className="whitespace-pre-line">{m.text}</p>
                
                {m.actionData && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 space-y-1 shadow-2xs">
                    <p className="font-bold text-indigo-600">{m.actionData.name}</p>
                    <p className="text-[11px] text-slate-500">Revenue: {m.actionData.revenue} · Health: {m.actionData.status}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Query Input */}
        <form onSubmit={e => { e.preventDefault(); handleSend(query); }} className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask AI Copilot (e.g. 'Summarize Aegis account')..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button type="submit" className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
