import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";
import { 
  Send, Bot, User, Loader2, Sparkles, TrendingUp, BarChart2, 
  Target, Award, RefreshCw, Trash2, Printer, AlertTriangle, Users
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { AIReportVisualizer, AIReportPayload } from "../components/AIReportVisualizer";

interface ChatMessage {
  role: "user" | "assistant";
  content?: string;
  report?: AIReportPayload;
}

export default function AIReports() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hello ${user?.name || "there"}! I am your AI Visual Analytics Copilot. Ask any commercial question — from pipeline health, stalled deals, to rep quotas — and I'll generate synchronized Recharts visualizations and strategic summaries.`
    }
  ]);

  const quickPrompts = [
    {
      label: "Pipeline Health & Velocity",
      query: "Analyze our current pipeline health, conversion velocity, and stage distribution.",
      icon: BarChart2
    },
    {
      label: "Sales Rep Quota Leaderboard",
      query: "Show sales rep quota attainment, target pacing, and revenue closed.",
      icon: Users
    },
    {
      label: "Lead Source & Attribution",
      query: "Breakdown lead acquisition sources, conversion rates, and revenue ROI.",
      icon: Target
    },
    {
      label: "Deals at Risk of Stalling",
      query: "Identify high-value deals with no recent activity or past close dates.",
      icon: AlertTriangle
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending]);

  const triggerQuery = async (queryText: string) => {
    if (!queryText.trim() || isPending) return;

    const userMessage: ChatMessage = { role: "user", content: queryText };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsPending(true);

    try {
      const res = await apiClient("/api/v1/ai-reports/query", {
        method: "POST",
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content || m.report?.summary || ""
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
          role: "assistant",
          content: data.text,
          report: data.report
        }
      ]);
    } catch (err: any) {
      console.error(err);
      let errMsg = "Sorry, I encountered an error while analyzing the CRM database. ";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errMsg += parsed.error;
      } catch {
        errMsg += err.message;
      }
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
    } finally {
      setIsPending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    triggerQuery(input);
  };

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: `Conversation reset. Ask any commercial query to generate interactive visual reports.`
      }
    ]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/20">
              <Sparkles className="w-5 h-5" />
            </span>
            AI Analytics Studio & Report Generator
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ground dynamic visual analytics, Recharts multi-graphs, and executive summaries with live CRM data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Print or export current view"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Reset Conversation"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          Suggested:
        </span>
        {quickPrompts.map((qp, idx) => {
          const Icon = qp.icon;
          return (
            <button
              key={idx}
              disabled={isPending}
              onClick={() => triggerQuery(qp.query)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:border-primary border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              {qp.label}
            </button>
          );
        })}
      </div>

      {/* Main Chat & Report Canvas */}
      <div ref={printAreaRef} className="flex-1 overflow-y-auto pr-1 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 md:gap-4 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shadow-primary/20 shrink-0 mt-1">
                <Bot className="w-5 h-5" />
              </div>
            )}

            <div
              className={`rounded-3xl ${
                msg.role === "user"
                  ? "bg-primary text-white p-4 max-w-xl text-sm font-semibold shadow-md shadow-primary/10 rounded-tr-none"
                  : "w-full max-w-5xl"
              }`}
            >
              {msg.role === "assistant" && msg.report ? (
                <AIReportVisualizer
                  report={msg.report}
                  onFollowUpClick={(q) => triggerQuery(q)}
                />
              ) : (
                <div
                  className={`text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-5 rounded-3xl rounded-tl-none shadow-xs whitespace-pre-line"
                      : ""
                  }`}
                >
                  {msg.content}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-9 h-9 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md shrink-0 mt-1">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isPending && (
          <div className="flex gap-3 md:gap-4 items-start">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl rounded-tl-none p-5 text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-3 shadow-xs">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Grounded RAG analysis in progress... Generating synchronized multi-graphs.
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-sm shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isPending}
          placeholder="Ask a commercial analytics query (e.g. 'Show me my pipeline by stage' or 'Show deals at risk of stalling')..."
          className="flex-1 px-4 py-2.5 bg-transparent text-sm focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isPending}
          className="px-5 py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:opacity-90 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>Generate</span>
        </button>
      </form>

    </div>
  );
}
