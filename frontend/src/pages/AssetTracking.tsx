import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Package, Plus, Search, Filter, RefreshCw, Calendar, Clock,
  CheckCircle2, AlertTriangle, Truck, ShieldAlert, FileText, User,
  Building2, Edit, Trash2, ChevronRight, X, ArrowUpRight, Wrench, ShieldCheck
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

export default function AssetTracking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modal & History state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState<any>(null);

  // Form State
  const [formState, setFormState] = useState({
    name: "",
    type: "Control Panel",
    serialNumber: "",
    status: "In Storage",
    condition: "Good",
    customerId: "",
    dealId: "",
    deployedAt: "",
    expectedReturnDate: "",
    notes: "",
    statusChangeNotes: ""
  });

  // 1. Fetch Assets Query
  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: ["assets", searchQuery, statusFilter, typeFilter],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (searchQuery) query.append("search", searchQuery);
      if (statusFilter !== "all") query.append("status", statusFilter);
      if (typeFilter !== "all") query.append("type", typeFilter);

      const res = await apiClient(`/api/v1/assets?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      const result = await res.json();
      return Array.isArray(result) ? result : (result.data || []);
    }
  });

  // 2. Fetch Customer Accounts Query for dropdown
  const { data: accounts = [] } = useQuery({
    queryKey: ["accountsList"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/accounts");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // 3. Fetch Deals Query for dropdown
  const { data: deals = [] } = useQuery({
    queryKey: ["dealsList"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/pipeline/deals");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.flat() : [];
    }
  });

  // 4. Create / Update Asset Mutation
  const saveAssetMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingAsset?.id) {
        const res = await apiClient(`/api/v1/assets/${editingAsset.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to update asset");
        return res.json();
      } else {
        const res = await apiClient("/api/v1/assets", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to create asset");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      closeModal();
    }
  });

  // 5. Delete Asset Mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient(`/api/v1/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    }
  });

  // 6. Fetch Single Asset History
  const fetchAssetHistory = async (assetId: string) => {
    try {
      const res = await apiClient(`/api/v1/assets/${assetId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAssetHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch asset history", err);
    }
  };

  const openAddModal = () => {
    setEditingAsset(null);
    setFormState({
      name: "",
      type: "Control Panel",
      serialNumber: `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      status: "In Storage",
      condition: "Good",
      customerId: "",
      dealId: "",
      deployedAt: "",
      expectedReturnDate: "",
      notes: "",
      statusChangeNotes: ""
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (asset: any) => {
    setEditingAsset(asset);
    setFormState({
      name: asset.name || "",
      type: asset.type || "Control Panel",
      serialNumber: asset.serialNumber || "",
      status: asset.status || "In Storage",
      condition: asset.condition || "Good",
      customerId: asset.customerId || "",
      dealId: asset.dealId || "",
      deployedAt: asset.deployedAt ? new Date(asset.deployedAt).toISOString().split("T")[0] : "",
      expectedReturnDate: asset.expectedReturnDate ? new Date(asset.expectedReturnDate).toISOString().split("T")[0] : "",
      notes: asset.notes || "",
      statusChangeNotes: ""
    });
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingAsset(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAssetMutation.mutate(formState);
  };

  // Metrics computation
  const totalAssetsCount = assets.length;
  const deployedCount = assets.filter((a: any) => a.status === "Deployed").length;
  const inStorageCount = assets.filter((a: any) => a.status === "In Storage").length;
  const maintenanceCount = assets.filter((a: any) => a.status === "Under Maintenance" || a.condition === "Needs Service").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Deployed":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Deployed</span>;
      case "In Transit":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><Truck className="w-3 h-3" /> In Transit</span>;
      case "Under Maintenance":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1"><Wrench className="w-3 h-3" /> Maintenance</span>;
      case "Decommissioned":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-200 text-slate-700 border border-slate-300">Decommissioned</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">In Storage</span>;
    }
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto min-h-screen space-y-6 bg-slate-50/50 animate-fade-in">
      
      {/* ─── HEADER & ACTIONS ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Asset & Equipment Tracking</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Monitor deployed hardware, control panels, sensors, and maintenance schedules linked to customers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Refresh asset inventory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Asset</span>
          </button>
        </div>
      </div>

      {/* ─── KPI SUMMARY METRICS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Assets</span>
          <p className="text-2xl font-black text-slate-900">{totalAssetsCount}</p>
          <span className="text-[11px] text-slate-500 font-semibold">Active equipment inventory</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deployed On-Site</span>
          <p className="text-2xl font-black text-emerald-600">{deployedCount}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">Operating at customer facilities</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In Storage / Demos</span>
          <p className="text-2xl font-black text-indigo-600">{inStorageCount}</p>
          <span className="text-[11px] text-slate-500 font-semibold">Available for assignment</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Under Maintenance</span>
          <p className="text-2xl font-black text-rose-600">{maintenanceCount}</p>
          <span className="text-[11px] text-rose-600 font-semibold">Calibration or service required</span>
        </div>
      </div>

      {/* ─── SEARCH & FILTERS TOOLBAR ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search asset name, serial number, type..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Deployed">Deployed</option>
              <option value="In Storage">In Storage</option>
              <option value="In Transit">In Transit</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Decommissioned">Decommissioned</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Equipment Types</option>
              <option value="Control Panel">Control Panel</option>
              <option value="Industrial Sensor">Industrial Sensor</option>
              <option value="PLC Unit">PLC Unit</option>
              <option value="Generator">Generator</option>
              <option value="Demo Kit">Demo Kit</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── ASSETS TABLE ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-500 animate-pulse">
            Loading equipment & asset inventory...
          </div>
        ) : assets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No assets found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No equipment matching your criteria. Register new hardware or clear filters to view inventory.
            </p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer"
            >
              Register Asset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left divide-y divide-slate-100 text-xs">
              <thead>
                <tr className="bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Equipment Name</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">Deployed Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {assets.map((asset: any) => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{asset.name}</div>
                      <span className="text-[10px] font-extrabold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded border border-indigo-100 mt-1 inline-block">
                        {asset.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 font-bold">{asset.serialNumber || "—"}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(asset.status)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold ${asset.condition === "Needs Service" ? "text-rose-600" : "text-slate-700"}`}>
                        {asset.condition || "Good"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {asset.customer ? (
                        <button
                          onClick={() => navigate(`/accounts`)}
                          className="font-bold text-indigo-600 hover:underline text-left flex items-center gap-1"
                        >
                          <Building2 className="w-3 h-3" />
                          <span>{asset.customer.name}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 font-normal">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-semibold">
                      {asset.deployedAt ? new Date(asset.deployedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => fetchAssetHistory(asset.id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="View status history log"
                        >
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        </button>

                        <button
                          onClick={() => openEditModal(asset)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Edit asset details"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600" />
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete asset ${asset.name}?`)) {
                              deleteAssetMutation.mutate(asset.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Delete asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD / EDIT ASSET MODAL ─────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                {editingAsset ? "Edit Equipment Asset" : "Register New Equipment Asset"}
              </h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Equipment Name *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. NexControl CP-5000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Equipment Type *</label>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Control Panel">Control Panel</option>
                    <option value="Industrial Sensor">Industrial Sensor</option>
                    <option value="PLC Unit">PLC Unit</option>
                    <option value="Generator">Generator</option>
                    <option value="Demo Kit">Demo Kit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formState.serialNumber}
                    onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="In Storage">In Storage</option>
                    <option value="Deployed">Deployed</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Decommissioned">Decommissioned</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Condition</label>
                  <select
                    value={formState.condition}
                    onChange={(e) => setFormState({ ...formState, condition: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Needs Service">Needs Service</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Account</label>
                  <select
                    value={formState.customerId}
                    onChange={(e) => setFormState({ ...formState, customerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- None / In Storage --</option>
                    {accounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Linked Opportunity Deal</label>
                  <select
                    value={formState.dealId}
                    onChange={(e) => setFormState({ ...formState, dealId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- None --</option>
                    {deals.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deployed Date</label>
                  <input
                    type="date"
                    value={formState.deployedAt}
                    onChange={(e) => setFormState({ ...formState, deployedAt: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={formState.expectedReturnDate}
                    onChange={(e) => setFormState({ ...formState, expectedReturnDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Equipment & Deployment Notes</label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Location details, technician notes, configuration parameters..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveAssetMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-2xs cursor-pointer"
                >
                  {saveAssetMutation.isPending ? "Saving..." : editingAsset ? "Update Asset" : "Register Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── STATUS HISTORY AUDIT DRAWER ───────────────────────────────────── */}
      {selectedAssetHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white border-l border-slate-200 w-full max-w-md h-full p-6 shadow-2xl space-y-4 overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{selectedAssetHistory.name}</h3>
                <p className="text-[11px] text-slate-500 font-mono">Serial: {selectedAssetHistory.serialNumber}</p>
              </div>
              <button onClick={() => setSelectedAssetHistory(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" /> Status Change Audit Log
              </h4>

              {selectedAssetHistory.statusHistory && selectedAssetHistory.statusHistory.length > 0 ? (
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 pl-4 pt-1">
                  {selectedAssetHistory.statusHistory.map((hist: any) => (
                    <div key={hist.id} className="relative text-xs space-y-1">
                      <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {hist.previousStatus ? `${hist.previousStatus} ➔ ${hist.newStatus}` : `Registered as ${hist.newStatus}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(hist.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">{hist.notes || "Status updated"}</p>
                      {hist.changedBy && (
                        <p className="text-[10px] text-indigo-600 font-bold">Updated by {hist.changedBy.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No status history recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
