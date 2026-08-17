import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { X, Save, Loader2, EyeOff, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CatalogItemDrawerProps {
  item: any | null;        // null = add new
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

const MANAGED_ROLES = ["team_lead", "sales_manager", "sales_director", "admin", "management"];

export function CatalogItemDrawer({ item, isOpen, onClose, userRole }: CatalogItemDrawerProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const canSeeCost = MANAGED_ROLES.includes(userRole);

  const defaultForm = {
    name: "",
    sku: "",
    category: "",
    uom: "nos",
    description: "",
    internalCost: "",
    unitPrice: "",
    minSellingPrice: "",
    targetMarginPct: "",
    tax: "18",
    isActive: true,
  };

  const [form, setForm] = useState<any>(defaultForm);
  const [computedMargin, setComputedMargin] = useState<number | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "",
        sku: item.sku || "",
        category: item.category || "",
        uom: item.uom || "nos",
        description: item.description || "",
        internalCost: item.internalCost != null ? String(item.internalCost) : "",
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
        minSellingPrice: item.minSellingPrice != null ? String(item.minSellingPrice) : "",
        targetMarginPct: item.targetMarginPct != null ? String(item.targetMarginPct) : "",
        tax: item.tax != null ? String(item.tax) : "18",
        isActive: item.isActive !== false,
      });
    } else {
      setForm(defaultForm);
    }
  }, [item]);

  // Live margin calculation
  useEffect(() => {
    const cost = parseFloat(form.internalCost);
    const price = parseFloat(form.unitPrice);
    if (cost > 0 && price > 0) {
      setComputedMargin(parseFloat((((price - cost) / price) * 100).toFixed(1)));
    } else {
      setComputedMargin(null);
    }
  }, [form.internalCost, form.unitPrice]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!item?.id;
      const url = isEdit ? `/api/v1/price-book/${item.id}` : "/api/v1/price-book";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["catalogCategories"] });
      queryClient.invalidateQueries({ queryKey: ["catalogUoms"] });
      onClose();
    },
  });

  const handleSave = () => {
    const payload: any = { ...form };
    // Convert empty strings to null for numeric fields
    ["internalCost", "unitPrice", "minSellingPrice", "targetMarginPct", "tax"].forEach(k => {
      payload[k] = payload[k] !== "" ? parseFloat(payload[k]) : null;
    });
    saveMutation.mutate(payload);
  };

  if (!isOpen) return null;

  const marginColor = computedMargin === null
    ? "text-slate-400"
    : computedMargin >= (parseFloat(form.targetMarginPct) || 20)
    ? "text-emerald-600"
    : "text-amber-600";

  const priceAboveMin = !form.minSellingPrice || !form.unitPrice
    || parseFloat(form.unitPrice) >= parseFloat(form.minSellingPrice);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {item ? "Edit Line Item" : "Add New Line Item"}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {item ? `SKU: ${item.sku}` : "New catalog entry"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Category + Name */}
          <div className="grid grid-cols-1 gap-4">
            <Field label="Category" required>
              <input
                type="text"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Portable Cabins"
                className={inputCls}
              />
            </Field>
            <Field label="Item Name" required>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. MS Base Frame"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU / Code">
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. CAB-001"
                  className={inputCls}
                />
              </Field>
              <Field label="Unit of Measure" required>
                <input
                  type="text"
                  value={form.uom}
                  onChange={e => setForm({ ...form, uom: e.target.value })}
                  placeholder="sq.ft, nos, lump"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional specs or notes..."
                className={`${inputCls} resize-none`}
              />
            </Field>
          </div>

          <hr className="border-slate-100" />

          {/* Pricing */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pricing</p>
            <div className="space-y-3">
              {/* Internal Cost — role-gated */}
              {canSeeCost ? (
                <Field label="Internal Cost (₹)" sublabel="Hidden from Sales Reps">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={form.internalCost}
                      onChange={e => setForm({ ...form, internalCost: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-8`}
                    />
                    <EyeOff className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Field>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Internal cost is managed by Team Lead / Admin only</span>
                </div>
              )}

              <Field label="Default Selling Price (₹)" required>
                <input
                  type="number"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={e => setForm({ ...form, unitPrice: e.target.value })}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>

              <Field label="Minimum Selling Price (₹)" sublabel="Floor price — approval required below this">
                <input
                  type="number"
                  step="0.01"
                  value={form.minSellingPrice}
                  onChange={e => setForm({ ...form, minSellingPrice: e.target.value })}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>

              {!priceAboveMin && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Default selling price is below minimum selling price.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {canSeeCost && (
                  <Field label="Target Margin %" sublabel="For Team Lead view">
                    <input
                      type="number"
                      step="0.1"
                      value={form.targetMarginPct}
                      onChange={e => setForm({ ...form, targetMarginPct: e.target.value })}
                      placeholder="25.0"
                      className={inputCls}
                    />
                  </Field>
                )}
                <Field label="Default Tax %">
                  <input
                    type="number"
                    step="0.1"
                    value={form.tax}
                    onChange={e => setForm({ ...form, tax: e.target.value })}
                    placeholder="18.0"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Margin indicator */}
              {canSeeCost && computedMargin !== null && (
                <div className={`flex items-center gap-2 text-xs font-bold rounded-xl px-3 py-2 bg-slate-50 border border-slate-100 ${marginColor}`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  Current Margin: {computedMargin}%
                  {form.targetMarginPct && computedMargin >= parseFloat(form.targetMarginPct) && (
                    <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-600" />
                  )}
                  {form.targetMarginPct && computedMargin < parseFloat(form.targetMarginPct) && (
                    <AlertTriangle className="w-3.5 h-3.5 ml-auto text-amber-600" />
                  )}
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Active Status</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Inactive items won't appear in catalog search</p>
            </div>
            <button
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.isActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.isActive ? "translate-x-5" : ""
              }`} />
            </button>
          </div>

          {/* Audit trail (edit mode) */}
          {item?.updatedAt && (
            <div className="text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
              Last updated: {new Date(item.updatedAt).toLocaleString()}
              {item.updatedById && " · by admin"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !form.name}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {item ? "Save Changes" : "Add to Catalog"}
          </button>
        </div>
      </div>
    </>
  );
}

// Helper components
const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all";

function Field({ label, sublabel, required, children }: {
  label: string;
  sublabel?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {sublabel && <span className="ml-2 normal-case font-medium text-slate-400 text-[9px]">({sublabel})</span>}
      </label>
      {children}
    </div>
  );
}
