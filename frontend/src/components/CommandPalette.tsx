import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  Search, Command, X, Users, Inbox, Trello, FileText, Receipt,
  CheckSquare, BarChart, Settings, Key, Plus, PhoneCall, Video,
  Clock, ArrowRight, Star, Sparkles, Building2, UserPlus, Eye,
  Shield, Filter, Layers, CheckCircle2, ChevronRight
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";

interface CommandItem {
  id: string;
  category: "Actions" | "Navigation" | "Customers" | "Leads" | "Deals" | "Quotes" | "Tasks" | "Team";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  previewData?: any;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [hoveredPreview, setHoveredPreview] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
      setHoveredPreview(null);
    }
  }, [isOpen]);

  // Fetch real search results
  const { data: searchResults, isLoading } = useQuery<any>({
    queryKey: ["commandSearch", query],
    queryFn: async () => {
      if (!token || !query || query.trim().length < 2) return null;
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token && query.trim().length >= 2
  });

  // Built-in commands & actions
  const navCommands = useMemo<CommandItem[]>(() => [
    { id: "nav-home", category: "Navigation", title: "Go to My Dashboard", subtitle: "Daily Operations Center", icon: Command, action: () => { navigate("/home"); onClose(); } },
    { id: "nav-leads", category: "Navigation", title: "Go to Lead Inbox", subtitle: "Manage lead pipeline", icon: Inbox, action: () => { navigate("/leads"); onClose(); } },
    { id: "nav-pipeline", category: "Navigation", title: "Go to Pipeline Kanban", subtitle: "Visual deal board", icon: Trello, action: () => { navigate("/pipeline"); onClose(); } },
    { id: "nav-quotes", category: "Navigation", title: "Go to Quotation Center", subtitle: "Quotes & approvals", icon: FileText, action: () => { navigate("/quotes"); onClose(); } },
    { id: "nav-customers", category: "Navigation", title: "Go to Customer 360", subtitle: "Customer workspace", icon: Users, action: () => { navigate("/customers"); onClose(); } },
    { id: "nav-invoices", category: "Navigation", title: "Go to Invoices & Billing", subtitle: "Financial records", icon: Receipt, action: () => { navigate("/invoices"); onClose(); } },
    { id: "nav-team", category: "Navigation", title: "Go to Sales Team", subtitle: "Manager performance workspace", icon: Users, action: () => { navigate("/salespersons"); onClose(); } },
    { id: "nav-settings", category: "Navigation", title: "Go to Settings", subtitle: "System settings", icon: Settings, action: () => { navigate("/settings"); onClose(); } },
    { id: "act-new-lead", category: "Actions", title: "Create New Lead", subtitle: "Ingest a new prospect", icon: Plus, action: () => { navigate("/leads/new"); onClose(); } },
    { id: "act-new-quote", category: "Actions", title: "Generate New Quote", subtitle: "Create custom proposal", icon: Plus, action: () => { navigate("/quotes/new"); onClose(); } },
    { id: "act-ai-reports", category: "Actions", title: "Open AI Intelligence Reports", subtitle: "Ask AI sales questions", icon: Sparkles, action: () => { navigate("/ai-reports"); onClose(); } },
  ], [navigate, onClose]);

  // Transform backend search results to command items
  const recordItems = useMemo<CommandItem[]>(() => {
    if (!searchResults) return [];
    const items: CommandItem[] = [];

    (searchResults.customers || []).forEach((c: any) => {
      items.push({
        id: `c-${c.id}`,
        category: "Customers",
        title: c.name,
        subtitle: c.primaryContactName ? `Contact: ${c.primaryContactName} · ${c.industry || "General"}` : c.industry || "Customer",
        icon: Building2,
        action: () => {
          localStorage.setItem("recent_searches", JSON.stringify(Array.from(new Set([c.name, ...(JSON.parse(localStorage.getItem("recent_searches") || "[]"))])).slice(0, 5)));
          navigate(`/customers?id=${c.id}`);
          onClose();
        },
        previewData: { type: "Customer", title: c.name, contact: c.primaryContactName, email: c.email, phone: c.phone, industry: c.industry }
      });
    });

    (searchResults.leads || []).forEach((l: any) => {
      const name = `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.company || "Lead";
      items.push({
        id: `l-${l.id}`,
        category: "Leads",
        title: name,
        subtitle: `${l.company ? `${l.company} · ` : ""}${l.status || "New"}`,
        icon: Inbox,
        action: () => {
          navigate(`/leads/${l.id}`);
          onClose();
        },
        previewData: { type: "Lead", title: name, company: l.company, email: l.email, status: l.status }
      });
    });

    (searchResults.deals || []).forEach((d: any) => {
      items.push({
        id: `d-${d.id}`,
        category: "Deals",
        title: d.name || "Deal",
        subtitle: `Amount: ${formatCurrencyCompact(parseFloat(d.amount) || 0)}`,
        icon: Trello,
        action: () => {
          navigate(`/pipeline`);
          onClose();
        },
        previewData: { type: "Deal", title: d.name, amount: d.amount }
      });
    });

    (searchResults.quotes || []).forEach((q: any) => {
      items.push({
        id: `q-${q.id}`,
        category: "Quotes",
        title: `Quote #${q.quoteNumber || q.id.substring(0, 8)}`,
        subtitle: `Status: ${q.status} · Amount: ${formatCurrencyCompact(parseFloat(q.totalAmount) || 0)}`,
        icon: FileText,
        action: () => {
          navigate(`/quotes`);
          onClose();
        },
        previewData: { type: "Quote", number: q.quoteNumber, amount: q.totalAmount, status: q.status }
      });
    });

    (searchResults.tasks || []).forEach((t: any) => {
      items.push({
        id: `t-${t.id}`,
        category: "Tasks",
        title: t.title,
        subtitle: `Priority: ${t.priority || "Normal"}`,
        icon: CheckSquare,
        action: () => {
          navigate(`/home`);
          onClose();
        }
      });
    });

    (searchResults.salespersons || []).forEach((s: any) => {
      items.push({
        id: `s-${s.id}`,
        category: "Team",
        title: s.name,
        subtitle: `${s.role?.replace("_", " ")} · ${s.department || "Sales"} (${s.territory || "EMEA"})`,
        icon: Users,
        action: () => {
          navigate(`/salespersons/${s.id}`);
          onClose();
        },
        previewData: { type: "Sales Rep", name: s.name, email: s.email, role: s.role, department: s.department, territory: s.territory }
      });
    });

    return items;
  }, [searchResults, navigate, onClose]);

  // Combine and filter results
  const allFilteredItems = useMemo(() => {
    let list: CommandItem[] = [];

    if (!query.trim()) {
      list = navCommands;
    } else {
      const qLower = query.toLowerCase();
      const filteredNav = navCommands.filter(c => c.title.toLowerCase().includes(qLower) || c.subtitle?.toLowerCase().includes(qLower));
      list = [...recordItems, ...filteredNav];
    }

    if (selectedCategory !== "All") {
      list = list.filter(item => item.category === selectedCategory);
    }

    return list;
  }, [query, navCommands, recordItems, selectedCategory]);

  // Recent searches stored in localStorage
  const recentSearches: string[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("recent_searches") || "[]");
    } catch {
      return [];
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, allFilteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + allFilteredItems.length) % Math.max(1, allFilteredItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allFilteredItems[selectedIndex]) {
          allFilteredItems[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allFilteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  const categories = ["All", "Actions", "Navigation", "Customers", "Leads", "Deals", "Quotes", "Tasks", "Team"];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search leads, customers, deals, commands... (Press ESC to close)"
            className="w-full text-base font-medium text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter pills */}
        <div className="px-4 py-2 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/50">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setSelectedIndex(0); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto flex divide-x divide-slate-100">
          {/* Main List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                Searching CRM records...
              </div>
            ) : allFilteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No matching results found for "{query}"
              </div>
            ) : (
              allFilteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => {
                      setSelectedIndex(index);
                      if (item.previewData) setHoveredPreview(item.previewData);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all ${
                      isSelected ? "bg-indigo-50 text-indigo-900 font-medium" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{item.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-500 uppercase">{item.category}</span>
                      </div>
                      {item.subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isSelected ? "translate-x-1 text-indigo-600" : ""}`} />
                  </div>
                );
              })
            )}

            {!query && recentSearches.length > 0 && (
              <div className="pt-3 border-t border-slate-100 mt-2 px-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Searches</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Preview Panel on Hover (Right Side) */}
          {hoveredPreview && (
            <div className="w-64 p-4 bg-slate-50 shrink-0 hidden md:block space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Preview</p>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase">{hoveredPreview.type}</span>
                <p className="text-sm font-bold text-slate-800">{hoveredPreview.title || hoveredPreview.name}</p>
                {hoveredPreview.email && <p className="text-xs text-slate-500 truncate">✉ {hoveredPreview.email}</p>}
                {hoveredPreview.phone && <p className="text-xs text-slate-500 truncate">📞 {hoveredPreview.phone}</p>}
                {hoveredPreview.amount && <p className="text-xs font-bold text-emerald-600">Amount: {formatCurrencyCompact(parseFloat(hoveredPreview.amount) || 0)}</p>}
                {hoveredPreview.status && <p className="text-xs font-semibold text-indigo-600">Status: {hoveredPreview.status}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-2xs font-mono text-[10px]">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-2xs font-mono text-[10px]">↵</kbd> Select</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-2xs font-mono text-[10px]">ESC</kbd> Close</span>
          </div>
          <span className="font-semibold text-indigo-600">Nexus Command Center</span>
        </div>
      </div>
    </div>
  );
}
