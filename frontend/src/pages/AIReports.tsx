import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, HelpCircle, Loader2 } from "lucide-react";

export default function AIReports() {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      content: `Hello ${user?.name || "there"}! I am your Nexus CRM AI Assistant. 

Ask me anything about your sales numbers, pipeline stages, or revenue. For example:
- "How is my sales performance and win rate looking?"
- "Can you give me a breakdown of the pipeline stages?"
- "What is our revenue split by period?"`
    }
  ]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsPending(true);

    try {
      const res = await fetch("/api/v1/ai-reports/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err: any) {
      console.error(err);
      let errMsg = "Sorry, I encountered an error while processing your request. ";
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

  return (
    <div className="flex-1 flex flex-col bg-surface h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-primary" />
            AI Reports & Analytics
          </h2>
          <p className="text-sm text-on-surface-variant">Query pipeline metrics and KPI summaries in real time with conversational analytics.</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                msg.role === "user" ? "bg-primary text-white" : "bg-white border border-outline-variant text-primary"
              }`}>
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              
              <div className={`max-w-[75%] rounded-2xl p-5 shadow-sm whitespace-pre-line text-sm ${
                msg.role === "user" 
                  ? "bg-primary text-white rounded-tr-none" 
                  : "bg-white border border-outline-variant text-on-surface rounded-tl-none leading-relaxed"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isPending && (
            <div className="flex gap-4 flex-row">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-outline-variant text-primary shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white border border-outline-variant rounded-2xl rounded-tl-none p-5 text-sm text-on-surface-variant flex items-center gap-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Thinking and querying the database...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Form */}
      <div className="p-6 bg-surface-container-lowest border-t border-outline-variant">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-4">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isPending}
            placeholder="Type your Q&A analytics query here..."
            className="flex-1 bg-surface border border-outline rounded-xl px-5 py-4 text-sm focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isPending}
            className="px-6 bg-primary text-white font-bold rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-md flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
