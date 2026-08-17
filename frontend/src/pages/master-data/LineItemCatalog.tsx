import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import {
  Search, Plus, Upload, Edit2, Trash2, Package, CheckCircle2,
  AlertTriangle, EyeOff, ChevronDown, Loader2, X, Download
} from "lucide-react";
import { MasterDataSidebar } from "../../components/MasterDataNav";
import { CatalogItemDrawer } from "../../components/CatalogItemDrawer";
import { formatCurrency } from "../../utils/currency";

const MANAGED_ROLES = ["team_lead", "sales_manager", "sales_director", "admin", "management"];

export default function LineItemCatalog() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const userRole = (user as any)?.role || "sales_rep";
  const canSeeCost = MANAGED_ROLES.includes(userRole);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uomFilter, setUomFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");

  // Drawer
  const [drawerItem, setDrawerItem] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [pasteText, setPasteText] = useState("");

  // Fetch catalog
  const { data: catalog = [], isLoading } = useQuery<any[]>({
    queryKey: ["catalog", categoryFilter, uomFilter, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (uomFilter !== "all") params.set("uom", uomFilter);
      if (activeFilter !== "all") params.set("isActive", activeFilter);
      const res = await fetch(`/api/v1/price-book?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["catalogCategories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: uoms = [] } = useQuery<string[]>({
    queryKey: ["catalogUoms"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book/uoms", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/price-book/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
  });

  const importPreviewMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch("/api/v1/price-book/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      setImportPreview(data);
      setImportStep("preview");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch("/api/v1/price-book/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setImportStep("done");
    },
  });

  // Client-side search filter
  const filtered = catalog.filter((item: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (item.name || "").toLowerCase().includes(q)
      || (item.category || "").toLowerCase().includes(q)
      || (item.sku || "").toLowerCase().includes(q)
      || (item.description || "").toLowerCase().includes(q);
  });

  // Parse paste text into rows (TSV/CSV from Excel)
  const parsePasteText = (text: string) => {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t").map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cells = line.split("\t").map(c => c.trim());
      const obj: any = {};
      headers.forEach((h, i) => {
        // Column mapping heuristics
        if (h.includes("category") || h.includes("service type")) obj.category = cells[i];
        else if (h.includes("item") || h.includes("description") || h.includes("line item")) obj.name = cells[i];
        else if (h.includes("uom") || h.includes("unit")) obj.uom = cells[i];
        else if (h.includes("rate") || h.includes("price") || h.includes("unit price")) obj.unitPrice = parseFloat(cells[i].replace(/[^0-9.]/g, "")) || 0;
        else if (h.includes("cost") || h.includes("internal cost")) obj.internalCost = parseFloat(cells[i].replace(/[^0-9.]/g, "")) || null;
        else if (h.includes("min") && h.includes("price")) obj.minSellingPrice = parseFloat(cells[i].replace(/[^0-9.]/g, "")) || null;
        else if (h.includes("tax") || h.includes("gst")) obj.tax = parseFloat(cells[i].replace(/[^0-9.]/g, "")) || 0;
        else if (h.includes("sku") || h.includes("code")) obj.sku = cells[i];
      });
      return obj;
    }).filter(r => r.name);
  };

  const handleImportPreview = () => {
    const rows = parsePasteText(pasteText);
    setImportRows(rows);
    importPreviewMutation.mutate(rows);
  };

  const openDrawerNew = () => { setDrawerItem(null); setIsDrawerOpen(true); };
  const openDrawerEdit = (item: any) => { setDrawerItem(item); setIsDrawerOpen(true); };

  // Status dot
  const StatusPill = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
      active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Sidebar */}
      <div className="w-56 shrink-0 bg-white border-r border-slate-200 pt-8 pb-8 px-4">
        <MasterDataSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 py-8 max-w-[1200px]">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-black text-slate-900">Line Item Catalog</h1>
              </div>
              <p className="text-sm text-slate-500 font-medium ml-12">
                Controlled commercial catalog used as source of truth for all quotations.
                {!canSeeCost && <span className="ml-2 text-slate-400 text-xs">(Cost fields are managed by Team Lead / Admin.)</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
              <button
                onClick={openDrawerNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search item, SKU, category..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* UOM filter */}
          <div className="relative">
            <select
              value={uomFilter}
              onChange={e => setUomFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Units</option>
              {uoms.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Active filter */}
          <div className="relative">
            <select
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value as any)}
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Active + Inactive</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          <span className="text-xs text-slate-400 font-medium ml-auto">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Line Item</th>
                <th className="px-5 py-3.5">SKU</th>
                <th className="px-5 py-3.5">UOM</th>
                {canSeeCost && <th className="px-5 py-3.5 text-right">Internal Cost</th>}
                <th className="px-5 py-3.5 text-right">Default Price</th>
                {canSeeCost && <th className="px-5 py-3.5 text-right">Margin</th>}
                <th className="px-5 py-3.5 text-right">Tax %</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Loading catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">No items found</p>
                    <p className="text-xs text-slate-400 mt-1">Add items or adjust filters</p>
                    <button
                      onClick={openDrawerNew}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      + Add First Item
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((item: any) => {
                  const cost = parseFloat(item.internalCost) || 0;
                  const price = parseFloat(item.unitPrice) || 0;
                  const margin = cost > 0 && price > 0 ? ((price - cost) / price) * 100 : null;
                  const targetMargin = parseFloat(item.targetMarginPct) || 20;
                  const marginOk = margin === null || margin >= targetMargin;

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => openDrawerEdit(item)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {item.category || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-black text-slate-900 text-xs">{item.name}</p>
                        {item.description && (
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[200px]">{item.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {item.sku || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-600">{item.uom || "—"}</td>
                      {canSeeCost && (
                        <td className="px-5 py-3.5 text-right">
                          {item.internalCost != null ? (
                            <span className="flex items-center justify-end gap-1 text-slate-600 font-bold">
                              <EyeOff className="w-3 h-3 text-slate-300" />
                              {formatCurrency(item.internalCost)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-right font-black text-slate-900">
                        {formatCurrency(item.unitPrice)}
                        {item.minSellingPrice && (
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Floor: {formatCurrency(item.minSellingPrice)}
                          </p>
                        )}
                      </td>
                      {canSeeCost && (
                        <td className="px-5 py-3.5 text-right">
                          {margin !== null ? (
                            <span className={`text-xs font-extrabold flex items-center justify-end gap-1 ${marginOk ? "text-emerald-600" : "text-amber-600"}`}>
                              {marginOk
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <AlertTriangle className="w-3 h-3" />
                              }
                              {margin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-right text-slate-600 font-semibold">
                        {item.tax != null && item.tax > 0 ? `${item.tax}%` : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill active={item.isActive !== false} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); openDrawerEdit(item); }}
                            className="p-1.5 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`Deactivate or delete "${item.name}"?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {canSeeCost && filtered.length > 0 && (
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Internal cost — not visible to Sales Reps</span>
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Margin meets target</span>
            <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> Margin below target</span>
          </div>
        )}
      </div>

      {/* Item Drawer */}
      <CatalogItemDrawer
        item={drawerItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        userRole={userRole}
      />

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">Import Catalog Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">Paste Excel data below. Header row required with columns: Category, Line Item, UOM, Rate/Price, Cost (optional)</p>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportStep("upload"); setPasteText(""); setImportPreview(null); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {importStep === "upload" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Paste Excel Data (Ctrl+A, Ctrl+C from spreadsheet → paste here)
                    </label>
                    <textarea
                      rows={10}
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={"Category\tLine Item\tUOM\tRate\tCost\nPortable Cabins\tCabin Structure\tsq.ft\t850\t600\nPortable Cabins\tMS Base Frame\tlump\t8000\t5500"}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-400 resize-none bg-slate-50"
                    />
                  </div>
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 font-medium">
                    <p className="font-black mb-1">Column Detection</p>
                    <p>The importer auto-maps: <strong>Category, Line Item / Description, UOM / Unit, Rate / Price / Unit Price, Cost / Internal Cost, SKU / Code, Tax / GST</strong></p>
                  </div>
                </div>
              )}

              {importStep === "preview" && importPreview && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "To Import", val: importPreview.summary.imported, color: "emerald" },
                      { label: "To Update", val: importPreview.summary.updated, color: "blue" },
                      { label: "Skipped", val: importPreview.summary.skipped, color: "slate" },
                      { label: "Errors", val: importPreview.summary.errors, color: "red" },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 bg-${s.color}-50 text-center`}>
                        <p className={`text-xl font-black text-${s.color}-700`}>{s.val}</p>
                        <p className={`text-[10px] font-bold text-${s.color}-500 uppercase tracking-wide`}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Preview table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Action</th>
                          <th className="px-4 py-2.5 text-left">Category</th>
                          <th className="px-4 py-2.5 text-left">Item</th>
                          <th className="px-4 py-2.5">UOM</th>
                          <th className="px-4 py-2.5 text-right">Price</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.items.map((row: any, i: number) => (
                          <tr key={i} className={!row.isValid ? "bg-red-50" : ""}>
                            <td className="px-4 py-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                row.action === "Create" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                              }`}>{row.action}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-500 font-medium">{row.category || "—"}</td>
                            <td className="px-4 py-2 font-bold text-slate-800">{row.name}</td>
                            <td className="px-4 py-2 text-center text-slate-500">{row.uom || "—"}</td>
                            <td className="px-4 py-2 text-right font-black text-slate-900">₹{(row.unitPrice || 0).toLocaleString()}</td>
                            <td className="px-4 py-2">
                              {row.isValid
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                : <div className="text-red-500 text-[10px] font-bold">{row.errors[0]}</div>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importStep === "done" && (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-lg font-black text-slate-900 mb-2">Import Complete</p>
                  <p className="text-sm text-slate-500">Catalog has been updated successfully.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => { setShowImportModal(false); setImportStep("upload"); setPasteText(""); setImportPreview(null); }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                {importStep === "done" ? "Close" : "Cancel"}
              </button>

              {importStep === "upload" && (
                <button
                  onClick={handleImportPreview}
                  disabled={!pasteText.trim() || importPreviewMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {importPreviewMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Preview Import
                </button>
              )}

              {importStep === "preview" && importPreview?.isValid && (
                <button
                  onClick={() => importMutation.mutate(importRows)}
                  disabled={importMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {importMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Confirm Import
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
      active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
