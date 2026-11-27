import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Plus, Edit2, Trash2, Search, Check, X, Shield,
  Navigation, Clock, ExternalLink, Sparkles, Filter, ChevronRight
} from "lucide-react";
import { MasterDataSidebar } from "../../components/MasterDataNav";

export interface ProjectLocationItem {
  id: string;
  name: string;
  code?: string | null;
  region: string;
  zoneType: string;
  zoneLabel?: string | null;
  baseDistanceKm: number;
  travelTimeHours?: number | null;
  gateAccessProtocol?: string | null;
  securityRequirements?: string | null;
  mapLinkOrCoordinates?: string | null;
  isQuickChip: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const ZONE_OPTIONS = [
  { value: "sabic_rcjy", label: "SABIC / Royal Commission (RCJY)", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "aramco_restricted", label: "Saudi Aramco Restricted Facility", badgeColor: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "modon_industrial", label: "MODON Industrial City", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "neom_remote", label: "NEOM / Red Sea Remote Site", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "commercial_open", label: "Commercial / Municipal Infrastructure", badgeColor: "bg-slate-100 text-slate-800 border-slate-200" }
];

const REGION_OPTIONS = [
  "Eastern Province",
  "Western Province",
  "Central Province",
  "Northern Borders",
  "Southern Province"
];

export default function ProjectSiteLocations() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [quickChipOnly, setQuickChipOnly] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectLocationItem | null>(null);

  const initialFormData = {
    name: "",
    code: "",
    region: "Eastern Province",
    zoneType: "sabic_rcjy",
    zoneLabel: "SABIC / Royal Commission (RCJY)",
    baseDistanceKm: 20,
    travelTimeHours: 1,
    gateAccessProtocol: "",
    securityRequirements: "",
    mapLinkOrCoordinates: "",
    isQuickChip: true,
    sortOrder: 0,
    isActive: true
  };

  const [formData, setFormData] = useState(initialFormData);

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery<ProjectLocationItem[]>({
    queryKey: ["projectSiteLocations", regionFilter, zoneFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (regionFilter !== "all") params.set("region", regionFilter);
      if (zoneFilter !== "all") params.set("zoneType", zoneFilter);
      const res = await fetch(`/api/v1/master-data/locations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch project locations");
      return res.json();
    },
    enabled: !!token
  });

  // Save Mutation (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!editingItem?.id;
      const url = isEdit ? `/api/v1/master-data/locations/${editingItem.id}` : "/api/v1/master-data/locations";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save location");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectSiteLocations"] });
      closeModal();
    },
    onError: (err: any) => {
      alert("Error: " + err.message);
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/master-data/locations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectSiteLocations"] });
    }
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      ...initialFormData,
      sortOrder: locations.length + 1
    });
    setIsModalOpen(true);
  };

  const openEditModal = (loc: ProjectLocationItem) => {
    setEditingItem(loc);
    setFormData({
      name: loc.name,
      code: loc.code || "",
      region: loc.region,
      zoneType: loc.zoneType,
      zoneLabel: loc.zoneLabel || "",
      baseDistanceKm: loc.baseDistanceKm,
      travelTimeHours: loc.travelTimeHours || 1,
      gateAccessProtocol: loc.gateAccessProtocol || "",
      securityRequirements: loc.securityRequirements || "",
      mapLinkOrCoordinates: loc.mapLinkOrCoordinates || "",
      isQuickChip: loc.isQuickChip,
      sortOrder: loc.sortOrder,
      isActive: loc.isActive
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter a location name.");
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredLocations = locations.filter((loc) => {
    if (quickChipOnly && !loc.isQuickChip) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      (loc.code && loc.code.toLowerCase().includes(q)) ||
      loc.region.toLowerCase().includes(q) ||
      (loc.gateAccessProtocol && loc.gateAccessProtocol.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Settings Navigation Sidebar */}
      <div className="w-56 shrink-0 bg-white border-r border-slate-200 pt-6 px-3">
        <MasterDataSidebar />
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <MapPin className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  Project Site Location Master
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                    {locations.length} Sites Configured
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Manage Saudi industrial cities, Aramco restricted fields &amp; Royal Commission zones. Feeds Playbook Hub, Quotation Mob/Demob &amp; Site Inspections.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project Site</span>
            </button>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search sites, codes, regions, security protocols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Regions</option>
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Zone Filter */}
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Zone Classifications</option>
              {ZONE_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>

            {/* Quick Chip Toggle */}
            <button
              onClick={() => setQuickChipOnly(!quickChipOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                quickChipOnly
                  ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>1-Click Quick Chips</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Site Name &amp; Code</th>
                  <th className="py-3 px-4">Region &amp; Zone Type</th>
                  <th className="py-3 px-4">Base Distance &amp; Transit</th>
                  <th className="py-3 px-4">Gate Security Protocol</th>
                  <th className="py-3 px-4 text-center">Playbook Chip</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading project site locations...
                    </td>
                  </tr>
                ) : filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No project site locations found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map((loc, idx) => {
                    const zoneMeta = ZONE_OPTIONS.find((z) => z.value === loc.zoneType);
                    return (
                      <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-400">
                          {loc.sortOrder || idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{loc.name}</span>
                            {loc.code && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-medium">
                                {loc.code}
                              </span>
                            )}
                          </div>
                          {loc.mapLinkOrCoordinates && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                              <Navigation className="w-2.5 h-2.5 text-slate-400" />
                              <span>{loc.mapLinkOrCoordinates}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-medium block">
                              {loc.region}
                            </span>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${zoneMeta?.badgeColor || "bg-slate-100 text-slate-700"}`}>
                              {zoneMeta?.label || loc.zoneLabel || loc.zoneType}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-xs">
                              {loc.baseDistanceKm} km
                            </span>
                            {loc.travelTimeHours ? (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {loc.travelTimeHours} hrs
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[9px] text-slate-400 block">from Operations Yard</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {loc.gateAccessProtocol ? (
                            <div className="text-[11px] text-slate-700 font-medium leading-tight line-clamp-2">
                              {loc.gateAccessProtocol}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Standard Gate</span>
                          )}
                          {loc.securityRequirements && (
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">
                              req: {loc.securityRequirements}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {loc.isQuickChip ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5" /> Active Chip
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Dropdown Only</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {loc.isActive ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Active" />
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="Inactive" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(loc)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Location"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${loc.name}?`)) {
                                  deleteMutation.mutate(loc.id);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Location"
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
        </div>
      </div>

      {/* Add / Edit Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingItem ? "Edit Project Site Location" : "Add New Project Site Location"}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Site Location Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Jafurah Gas Basin Gate #2"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Site Code (RFQ)</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. JAF-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Region / Province</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                  >
                    {REGION_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Zone Classification</label>
                  <select
                    value={formData.zoneType}
                    onChange={(e) => {
                      const selected = ZONE_OPTIONS.find((z) => z.value === e.target.value);
                      setFormData({
                        ...formData,
                        zoneType: e.target.value,
                        zoneLabel: selected?.label || e.target.value
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                  >
                    {ZONE_OPTIONS.map((z) => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Base Distance (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.baseDistanceKm}
                    onChange={(e) => setFormData({ ...formData, baseDistanceKm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono font-medium"
                  />
                  <p className="text-[10px] text-slate-400">Used for mob/demob pricing calculation</p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estimated Transit Time (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={formData.travelTimeHours}
                    onChange={(e) => setFormData({ ...formData, travelTimeHours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono font-medium"
                  />
                  <p className="text-[10px] text-slate-400">Inspector dispatch transit benchmark</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Gate Access &amp; Permit Protocol (PTW)</label>
                <input
                  type="text"
                  value={formData.gateAccessProtocol}
                  onChange={(e) => setFormData({ ...formData, gateAccessProtocol: e.target.value })}
                  placeholder="e.g. Aramco 48h Advance Gate Pass & Aramco PTW"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Security &amp; EHS Requirements</label>
                <textarea
                  rows={2}
                  value={formData.securityRequirements}
                  onChange={(e) => setFormData({ ...formData, securityRequirements: e.target.value })}
                  placeholder="e.g. Aramco plant sticker, valid H2S certificate, Aramco ID/Passport, 4x4 desert roll-over cage"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Google Maps Link or GPS Coordinates</label>
                <input
                  type="text"
                  value={formData.mapLinkOrCoordinates}
                  onChange={(e) => setFormData({ ...formData, mapLinkOrCoordinates: e.target.value })}
                  placeholder="e.g. 27.0145, 49.6583 OR https://maps.google.com/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isQuickChip}
                    onChange={(e) => setFormData({ ...formData, isQuickChip: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <span className="font-bold text-slate-700">Show as 1-Click Quick Chip in Playbook</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <span className="font-bold text-slate-700">Active</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {saveMutation.isPending ? "Saving..." : editingItem ? "Update Location" : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
