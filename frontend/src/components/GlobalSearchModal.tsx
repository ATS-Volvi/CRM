import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  User,
  Building2,
  Phone,
  Target,
  FileText,
  ShoppingBag,
  Package,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    leads: any[];
    accounts: any[];
    contacts: any[];
    opportunities: any[];
    quotes: any[];
    orders: any[];
    assets: any[];
  }>({
    leads: [],
    accounts: [],
    contacts: [],
    opportunities: [],
    quotes: [],
    orders: [],
    assets: []
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({
        leads: [],
        accounts: [],
        contacts: [],
        opportunities: [],
        quotes: [],
        orders: [],
        assets: []
      });
    }
  }, [isOpen]);

  // Handle global shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults({
        leads: [],
        accounts: [],
        contacts: [],
        opportunities: [],
        quotes: [],
        orders: [],
        assets: []
      });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
        setResults({
          leads: res.leads || [],
          accounts: res.accounts || [],
          contacts: res.contacts || [],
          opportunities: res.opportunities || res.deals || [],
          quotes: res.quotes || [],
          orders: res.orders || [],
          assets: res.assets || []
        });
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    results.leads.length +
    results.accounts.length +
    results.contacts.length +
    results.opportunities.length +
    results.quotes.length +
    results.orders.length +
    results.assets.length;

  const handleSelect = (url: string) => {
    navigate(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search leads, accounts, contacts, opportunities, quotes, orders, assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-3 space-y-4 flex-1">
          {loading && (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Searching across CRM database...
            </div>
          )}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No results found for &ldquo;<span className="font-semibold text-slate-700">{query}</span>&rdquo;
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-6 text-center text-xs text-slate-400">
              Type at least 2 characters to search across CRM entities
            </div>
          )}

          {/* Group: Leads */}
          {results.leads.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Leads ({results.leads.length})
              </div>
              <div className="space-y-1">
                {results.leads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleSelect(`/leads/${l.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                        {l.firstName} {l.lastName} {l.company ? `— ${l.company}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {l.email || l.phone || "No contact info"} • Status: {l.status}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group: Accounts */}
          {results.accounts.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                Accounts ({results.accounts.length})
              </div>
              <div className="space-y-1">
                {results.accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelect(`/accounts/${a.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600">
                        {a.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {a.industry || "General Industry"} • {a.primaryContactName || a.email || "No contact"}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group: Opportunities */}
          {results.opportunities.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                Opportunities ({results.opportunities.length})
              </div>
              <div className="space-y-1">
                {results.opportunities.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleSelect(`/opportunities/${o.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-600">
                        {o.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Value: ₹{Number(o.amount || 0).toLocaleString()} • Stage: {o.stageId || "Active"}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group: Quotes */}
          {results.quotes.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Quotes ({results.quotes.length})
              </div>
              <div className="space-y-1">
                {results.quotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handleSelect(q.dealId ? `/opportunities/${q.dealId}` : `/quotes`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-amber-600">
                        Quote #{q.quoteNumber} (v{q.version || 1})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Total: ₹{Number(q.totalAmount || 0).toLocaleString()} • Status: {q.status}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group: Orders */}
          {results.orders.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-purple-500" />
                Orders ({results.orders.length})
              </div>
              <div className="space-y-1">
                {results.orders.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => handleSelect(`/orders/${ord.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-purple-600">
                        Order #{ord.poNumber || ord.orderNumber || ord.id.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Amount: ₹{Number(ord.amount || ord.grandTotal || 0).toLocaleString()} • Status: {ord.status}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group: Assets */}
          {results.assets.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-teal-500" />
                Assets ({results.assets.length})
              </div>
              <div className="space-y-1">
                {results.assets.map((ast) => (
                  <button
                    key={ast.id}
                    onClick={() => handleSelect(`/assets`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-600">
                        {ast.name} ({ast.assetNumber})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Serial: {ast.serialNumber || "N/A"} • Status: {ast.status}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with mouse or keyboard</span>
          <span className="flex items-center gap-1 text-slate-500">
            <Sparkles className="w-3 h-3 text-blue-500" /> Universal CRM Search
          </span>
        </div>
      </div>
    </div>
  );
};
