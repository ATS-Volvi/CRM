import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Search, X, Package, ChevronRight, Loader2 } from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface CatalogSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: any) => void;
}

export function CatalogSearchModal({ isOpen, onClose, onSelect }: CatalogSearchModalProps) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: catalog = [], isLoading } = useQuery<any[]>({
    queryKey: ["catalog", "all-active"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book?isActive=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && !!token,
  });

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 100);
      setSearch("");
      setSelectedCategory("all");
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Distinct categories from catalog
  const categories = ["all", ...Array.from(new Set(catalog.map((i: any) => i.category).filter(Boolean))).sort()];

  // Filter items
  const filtered = catalog.filter((item: any) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (item.name || "").toLowerCase().includes(q)
      || (item.category || "").toLowerCase().includes(q)
      || (item.sku || "").toLowerCase().includes(q)
      || (item.description || "").toLowerCase().includes(q);
  });

  // Group by category
  const grouped: Record<string, any[]> = {};
  for (const item of filtered) {
    const cat = item.category || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[70vh] animate-slide-down"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products or services..."
              className="flex-1 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              ESC
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-slate-100">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Loading catalog...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">No items found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search or category</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{category}</p>
                  </div>
                  {/* Items */}
                  {items.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => { onSelect(item); onClose(); }}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 group text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                        <Package className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 group-hover:text-blue-700 truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-900">{formatCurrency(item.unitPrice)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{item.uom || "—"}</p>
                      </div>
                      {item.tax > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">+{item.tax}% tax</span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 shrink-0" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 font-medium">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} · click to add to quote
            </p>
            <p className="text-[11px] text-slate-400 font-medium">Prices are default — you can edit after adding</p>
          </div>
        </div>
      </div>
    </>
  );
}
