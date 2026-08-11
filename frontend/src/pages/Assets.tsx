import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, X, AlertTriangle, Clock, CheckCircle2,
  Wrench, Archive, Truck, Building2, CalendarDays, ClipboardList,
  ChevronRight, History, RefreshCw, Filter
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  status: "In Storage" | "Deployed" | "Under Maintenance" | "Retired";
  condition: "Good" | "Fair" | "Needs Repair" | "Damaged";
  customerId?: string;
  dealId?: string;
  deployedAt?: string;
  expectedReturnDate?: string;
  notes?: string;
  customer?: { id: string; name: string };
  deal?: { id: string; title?: string; name?: string };
  statusHistory?: AssetHistory[];
}

interface AssetHistory {
  id: string;
  assetId: string;
  previousStatus?: string;
  newStatus?: string;
  previousCondition?: string;
  newCondition?: string;
  changedById?: string;
  notes?: string;
  createdAt: string;
  changedBy?: { id: string; name: string; email: string };
}

// ─── Badge Helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  "In Storage":        { bg: "bg-slate-100 text-slate-600 border border-slate-200",  text: "In Storage",        icon: <Archive className="w-3 h-3" /> },
  "Deployed":          { bg: "bg-blue-100 text-blue-700 border border-blue-200",     text: "Deployed",          icon: <Truck className="w-3 h-3" /> },
  "Under Maintenance": { bg: "bg-amber-100 text-amber-700 border border-amber-200",  text: "Under Maintenance", icon: <Wrench className="w-3 h-3" /> },
  "Retired":           { bg: "bg-zinc-200 text-zinc-500 border border-zinc-300",     text: "Retired",           icon: <X className="w-3 h-3" /> },
};

const CONDITION_BADGE: Record<string, { bg: string; text: string }> = {
  "Good":         { bg: "bg-emerald-100 text-emerald-700 border border-emerald-200", text: "Good" },
  "Fair":         { bg: "bg-yellow-100 text-yellow-700 border border-yellow-200",    text: "Fair" },
  "Needs Repair": { bg: "bg-orange-100 text-orange-700 border border-orange-200",   text: "Needs Repair" },
  "Damaged":      { bg: "bg-red-100 text-red-700 border border-red-200",             text: "Damaged" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] || { bg: "bg-gray-100 text-gray-500", text: status, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg}`}>
      {cfg.icon}{cfg.text}
    </span>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const cfg = CONDITION_BADGE[condition] || { bg: "bg-gray-100 text-gray-500", text: condition };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg}`}>
      {cfg.text}
    </span>
  );
}

function isOverdue(asset: Asset) {
  return (
    asset.status === "Deployed" &&
    asset.expectedReturnDate &&
    new Date(asset.expectedReturnDate) < new Date()
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Assets() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedId = searchParams.get("id");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Status update panel state
  const [statusUpdatePanel, setStatusUpdatePanel] = useState<{
    newStatus: string;
    newCondition: string;
    expectedReturnDate: string;
    notes: string;
    customerId: string;
  }>({ newStatus: "", newCondition: "", expectedReturnDate: "", notes: "", customerId: "" });

  // Add Asset form state
  const [addForm, setAddForm] = useState({
    name: "", type: "", serialNumber: "", status: "In Storage",
    condition: "Good", customerId: "", dealId: "", expectedReturnDate: "", notes: ""
  });

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: assets = [], isLoading, isError, refetch } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await fetch("/api/v1/assets", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text() || "Failed to fetch assets");
      return res.json();
    },
    enabled: !!token,
    retry: 1,
    retryDelay: 1000,
  });

  const activeAssetId = selectedId || null;

  const { data: selectedAsset, isLoading: loadingSelected } = useQuery<Asset>({
    queryKey: ["asset", activeAssetId],
    queryFn: async () => {
      if (!activeAssetId) return null as any;
      const res = await fetch(`/api/v1/assets/${activeAssetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch asset");
      return res.json();
    },
    enabled: !!activeAssetId && !!token
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/customers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  // ─── Filtered Assets ───────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || a.name.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        (a.serialNumber || "").toLowerCase().includes(q) ||
        (a.customer?.name || "").toLowerCase().includes(q);
      const matchesStatus = !filterStatus || a.status === filterStatus;
      const matchesCondition = !filterCondition || a.condition === filterCondition;
      return matchesSearch && matchesStatus && matchesCondition;
    });
  }, [assets, searchQuery, filterStatus, filterCondition]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/v1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setShowAddModal(false);
      setAddForm({ name: "", type: "", serialNumber: "", status: "In Storage", condition: "Good", customerId: "", dealId: "", expectedReturnDate: "", notes: "" });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/v1/assets/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", activeAssetId] });
      setStatusUpdatePanel({ newStatus: "", newCondition: "", expectedReturnDate: "", notes: "", customerId: "" });
    }
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectAsset = (id: string) => {
    setSearchParams({ id });
    if (selectedAsset) {
      setStatusUpdatePanel({
        newStatus: selectedAsset.status,
        newCondition: selectedAsset.condition,
        expectedReturnDate: selectedAsset.expectedReturnDate ? selectedAsset.expectedReturnDate.split("T")[0] : "",
        notes: "",
        customerId: selectedAsset.customerId || ""
      });
    }
  };

  const handleStatusUpdate = () => {
    if (!activeAssetId) return;
    const payload: any = {
      newStatus: statusUpdatePanel.newStatus || undefined,
      newCondition: statusUpdatePanel.newCondition || undefined,
      notes: statusUpdatePanel.notes || undefined,
    };
    if (statusUpdatePanel.newStatus === "Deployed") {
      payload.expectedReturnDate = statusUpdatePanel.expectedReturnDate || undefined;
      payload.customerId = statusUpdatePanel.customerId || undefined;
    }
    updateStatusMutation.mutate({ id: activeAssetId, data: payload });
  };

  // Initialize status update panel when an asset is selected
  React.useEffect(() => {
    if (selectedAsset) {
      setStatusUpdatePanel({
        newStatus: selectedAsset.status,
        newCondition: selectedAsset.condition,
        expectedReturnDate: selectedAsset.expectedReturnDate ? selectedAsset.expectedReturnDate.split("T")[0] : "",
        notes: "",
        customerId: selectedAsset.customerId || ""
      });
    }
  }, [selectedAsset?.id]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-64px)] bg-[#FAF8FF] text-[#191B23] flex font-sans overflow-hidden select-none">

      {/* ─── ASSET LIST SIDEBAR ─────────────────────────────────────────────── */}
      <div className="w-72 border-r border-[#C3C6D7]/60 flex flex-col bg-white shrink-0">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[#191B23]">Equipment Registry</h2>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#2563EB] rounded-full">
                {filteredAssets.length}
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-6 h-6 flex items-center justify-center bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg transition-all"
                title="Add Asset"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="In Storage">In Storage</option>
              <option value="Deployed">Deployed</option>
              <option value="Under Maintenance">Maintenance</option>
              <option value="Retired">Retired</option>
            </select>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="flex-1 py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium focus:outline-none"
            >
              <option value="">All Condition</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Needs Repair">Needs Repair</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-6 text-center space-y-2">
              <RefreshCw className="w-5 h-5 text-slate-300 mx-auto animate-spin" />
              <p className="text-xs text-slate-400">Loading equipment...</p>
            </div>
          ) : isError ? (
            <div className="p-6 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-red-300 mx-auto" />
              <p className="text-xs text-red-500 font-semibold">Failed to load assets</p>
              <p className="text-[10px] text-slate-400">Check that the backend server is running</p>
              <button
                onClick={() => refetch()}
                className="text-[10px] text-[#2563EB] font-bold hover:underline flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Package className="w-8 h-8 text-slate-200 mx-auto" />
              <p className="text-xs text-slate-400">No equipment found</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-[10px] text-[#2563EB] font-bold hover:underline"
              >
                + Add first asset
              </button>
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const overdue = isOverdue(asset);
              const isSelected = activeAssetId === asset.id;
              return (
                <div
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset.id)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-50/80 border-l-4 border-l-[#2563EB]"
                      : overdue
                      ? "bg-red-50/50 border-l-4 border-l-red-400 hover:bg-red-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-[#191B23] truncate">{asset.name}</h3>
                      <p className="text-[10px] text-[#6B7280] truncate">{asset.type}</p>
                    </div>
                    {overdue && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200">
                        <AlertTriangle className="w-2.5 h-2.5" />OVERDUE
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <StatusBadge status={asset.status} />
                    <ConditionBadge condition={asset.condition} />
                  </div>
                  {asset.customer && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5" />{asset.customer.name}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── DETAIL PANEL ───────────────────────────────────────────────────── */}
      {activeAssetId && selectedAsset ? (
        <div className="flex-1 flex overflow-hidden">

          {/* Left: Asset Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[300px] border-r border-[#C3C6D7]/60 bg-white p-5 flex flex-col gap-5 overflow-y-auto shrink-0"
          >
            {/* Asset Identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#191B23] leading-tight">{selectedAsset.name}</h2>
                  <p className="text-xs text-slate-500">{selectedAsset.type}</p>
                </div>
              </div>

              {isOverdue(selectedAsset) && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-red-700">Return date overdue</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={selectedAsset.status} />
                <ConditionBadge condition={selectedAsset.condition} />
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                {selectedAsset.serialNumber && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <ClipboardList className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                    <span className="font-mono text-[10px]">{selectedAsset.serialNumber}</span>
                  </div>
                )}
                {selectedAsset.customer && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                    <span className="font-semibold">{selectedAsset.customer.name}</span>
                  </div>
                )}
                {selectedAsset.deployedAt && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Truck className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                    <span>Deployed {new Date(selectedAsset.deployedAt).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAsset.expectedReturnDate && (
                  <div className={`flex items-center gap-2 ${isOverdue(selectedAsset) ? "text-red-600 font-bold" : "text-slate-600"}`}>
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Return: {new Date(selectedAsset.expectedReturnDate).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAsset.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-[10px] text-slate-600 border border-slate-100 mt-2">
                    {selectedAsset.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Status Update Form */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Update Status / Condition
              </h4>

              <select
                value={statusUpdatePanel.newStatus}
                onChange={(e) => setStatusUpdatePanel(p => ({ ...p, newStatus: e.target.value }))}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="">-- Keep Status --</option>
                <option value="In Storage">In Storage</option>
                <option value="Deployed">Deployed</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Retired">Retired</option>
              </select>

              <select
                value={statusUpdatePanel.newCondition}
                onChange={(e) => setStatusUpdatePanel(p => ({ ...p, newCondition: e.target.value }))}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="">-- Keep Condition --</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Needs Repair">Needs Repair</option>
                <option value="Damaged">Damaged</option>
              </select>

              {statusUpdatePanel.newStatus === "Deployed" && (
                <>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Expected Return Date</label>
                    <input
                      type="date"
                      value={statusUpdatePanel.expectedReturnDate}
                      onChange={(e) => setStatusUpdatePanel(p => ({ ...p, expectedReturnDate: e.target.value }))}
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Assign to Customer</label>
                    <select
                      value={statusUpdatePanel.customerId}
                      onChange={(e) => setStatusUpdatePanel(p => ({ ...p, customerId: e.target.value }))}
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300"
                    >
                      <option value="">-- No Customer --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <textarea
                placeholder="Add notes about this update..."
                value={statusUpdatePanel.notes}
                onChange={(e) => setStatusUpdatePanel(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
              />

              <button
                onClick={handleStatusUpdate}
                disabled={updateStatusMutation.isPending}
                className="w-full py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? "Updating..." : "Apply Update"}
              </button>
            </div>
          </motion.div>

          {/* Right: Status History */}
          <div className="flex-1 bg-white p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-5">
              <History className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-sm font-black text-[#191B23]">Status & Condition History</h3>
            </div>

            {!selectedAsset.statusHistory || selectedAsset.statusHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No history recorded yet</p>
              </div>
            ) : (
              <div className="relative pl-5 space-y-4">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-100" />
                {selectedAsset.statusHistory.map((h, idx) => (
                  <div key={h.id} className="relative">
                    <div className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-[#2563EB] border-2 border-white shadow-sm" />
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(h.createdAt).toLocaleString()}
                          {h.changedBy && ` · ${h.changedBy.name}`}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] font-black text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded-full">LATEST</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {h.previousStatus && h.newStatus && h.previousStatus !== h.newStatus && (
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={h.previousStatus} />
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                            <StatusBadge status={h.newStatus} />
                          </div>
                        )}
                        {h.previousCondition && h.newCondition && h.previousCondition !== h.newCondition && (
                          <div className="flex items-center gap-1.5">
                            <ConditionBadge condition={h.previousCondition} />
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                            <ConditionBadge condition={h.newCondition} />
                          </div>
                        )}
                        {!h.previousStatus && h.newStatus && (
                          <span className="text-[10px] text-slate-500">Registered as <StatusBadge status={h.newStatus} /></span>
                        )}
                      </div>

                      {h.notes && (
                        <p className="text-[10px] text-slate-600 italic">"{h.notes}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state when no asset selected */
        <div className="flex-1 flex items-center justify-center bg-white/50">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto border border-blue-100">
              <Package className="w-10 h-10 text-[#2563EB]/40" />
            </div>
            <h3 className="text-sm font-black text-[#191B23]">Equipment & Asset Tracking</h3>
            <p className="text-xs text-slate-500 max-w-xs">
              Select an asset from the list to view details, update its status, and view its full history.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" /> Add Equipment
            </button>
          </div>
        </div>
      )}

      {/* ─── ADD ASSET MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[480px] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#2563EB]" />
                  <h3 className="text-sm font-black text-[#191B23]">Register New Equipment</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Name *</label>
                    <input
                      value={addForm.name}
                      onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Camp Unit A-14"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Type *</label>
                    <input
                      value={addForm.type}
                      onChange={(e) => setAddForm(f => ({ ...f, type: e.target.value }))}
                      placeholder="e.g. Camp Block"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Serial Number</label>
                  <input
                    value={addForm.serialNumber}
                    onChange={(e) => setAddForm(f => ({ ...f, serialNumber: e.target.value }))}
                    placeholder="Optional unique identifier"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Status</label>
                    <select
                      value={addForm.status}
                      onChange={(e) => setAddForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                    >
                      <option>In Storage</option>
                      <option>Deployed</option>
                      <option>Under Maintenance</option>
                      <option>Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Condition</label>
                    <select
                      value={addForm.condition}
                      onChange={(e) => setAddForm(f => ({ ...f, condition: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                    >
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Needs Repair</option>
                      <option>Damaged</option>
                    </select>
                  </div>
                </div>

                {addForm.status === "Deployed" && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Assign to Customer</label>
                      <select
                        value={addForm.customerId}
                        onChange={(e) => setAddForm(f => ({ ...f, customerId: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                      >
                        <option value="">-- No Customer --</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Expected Return Date</label>
                      <input
                        type="date"
                        value={addForm.expectedReturnDate}
                        onChange={(e) => setAddForm(f => ({ ...f, expectedReturnDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Notes</label>
                  <textarea
                    value={addForm.notes}
                    onChange={(e) => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes about this equipment..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createAssetMutation.mutate(addForm)}
                    disabled={!addForm.name || !addForm.type || createAssetMutation.isPending}
                    className="flex-1 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {createAssetMutation.isPending ? "Registering..." : "Register Equipment"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
