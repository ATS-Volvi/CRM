import React, { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  ArrowRight,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  Truck,
  PlusCircle,
  UserCheck,
  Settings,
  UserPlus,
  Layers,
  Send,
  X,
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import { getStatusStyle, getInspectionRag, SiteInspectionRecord, APPROVER_ROLES } from "../lib/siteInspection";
import { useAuth } from "../context/AuthContext";
import { SiteInspectionSettingsModal } from "../components/SiteInspectionSettingsModal";

type TabType = "todo" | "awaiting_approval" | "approved" | "unassigned" | "all";

export default function SiteInspections() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSiteManager = user?.role === "site_manager";
  const isApprover = Boolean(user?.role && APPROVER_ROLES.includes(user.role.toLowerCase()));

  const [activeTab, setActiveTab] = useState<TabType>("todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Manual Reassignment Modal State
  const [reassignModalInspection, setReassignModalInspection] = useState<SiteInspectionRecord | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [inspectorsList, setInspectorsList] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // Bulk Assign State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const { data: inspections = [], isLoading, error } = useQuery({
    queryKey: ["site-inspections", isSiteManager],
    queryFn: () => siteInspectionApi.listInspections({ mine: isSiteManager }),
  });

  const now = new Date();

  // Metrics counts
  const overdueCount = useMemo(() => {
    return inspections.filter((ins) => {
      if (ins.status === "APPROVED" || ins.status === "CANCELLED") return false;
      if (!ins.dueAt) return false;
      return new Date(ins.dueAt) < now;
    }).length;
  }, [inspections, now]);

  const unassignedCount = useMemo(() => {
    return inspections.filter((ins) => {
      if (ins.status === "APPROVED" || ins.status === "CANCELLED") return false;
      return !ins.assignedToId || ins.assignmentState === "UNASSIGNED" || ins.assignmentState === "NEEDS_AREA" || ins.assignmentState === "PENDING_CONFIRMATION";
    }).length;
  }, [inspections]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((ins) => {
      // Tab filter
      if (activeTab === "todo") {
        if (!["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(ins.status)) return false;
        if (!ins.assignedToId || ins.assignmentState === "UNASSIGNED") return false;
      } else if (activeTab === "awaiting_approval") {
        if (ins.status !== "SUBMITTED") return false;
      } else if (activeTab === "approved") {
        if (ins.status !== "APPROVED") return false;
      } else if (activeTab === "unassigned") {
        if (ins.status === "APPROVED" || ins.status === "CANCELLED") return false;
        if (ins.assignedToId && ins.assignmentState !== "UNASSIGNED" && ins.assignmentState !== "NEEDS_AREA" && ins.assignmentState !== "PENDING_CONFIRMATION") {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (ins.inspectionNumber || "").toLowerCase();
        const client = (ins.clientOrganization || "").toLowerCase();
        const site = (ins.siteName || "").toLowerCase();
        const rfq = (ins.rfqNumber || "").toLowerCase();
        const leadCo = (ins.lead?.company || "").toLowerCase();
        const area = (ins.siteAreaName || "").toLowerCase();
        if (!num.includes(q) && !client.includes(q) && !site.includes(q) && !rfq.includes(q) && !leadCo.includes(q) && !area.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [inspections, activeTab, searchQuery]);

  // Open Reassign Modal
  const openReassignModal = async (ins: SiteInspectionRecord) => {
    setReassignModalInspection(ins);
    setReassignTargetId(ins.assignedToId || "");
    setReassignReason("");
    setReassignError(null);
    if (inspectorsList.length === 0) {
      try {
        const mgrs = await siteInspectionApi.getSiteManagers();
        setInspectorsList(mgrs || []);
      } catch {}
    }
  };

  const handleExecuteReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalInspection || !reassignTargetId) return;
    if (!reassignReason.trim()) {
      setReassignError("A justification reason is required for manual reassignment.");
      return;
    }

    setIsReassigning(true);
    setReassignError(null);
    try {
      await siteInspectionApi.reassignInspection(
        reassignModalInspection.id,
        reassignTargetId,
        reassignReason.trim()
      );
      setReassignModalInspection(null);
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
    } catch (err: any) {
      setReassignError(err?.message || "Failed to reassign inspection.");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkReason.trim()) {
      alert("Please provide a reason for bulk assignment.");
      return;
    }

    setIsBulkAssigning(true);
    try {
      await siteInspectionApi.bulkAssign({
        inspectionIds: selectedIds,
        targetAssigneeId: bulkAssigneeId || null,
        reason: bulkReason.trim(),
      });
      setSelectedIds([]);
      setBulkReason("");
      queryClient.invalidateQueries({ queryKey: ["site-inspections"] });
    } catch (err: any) {
      alert(err?.message || "Bulk assign failed");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-face-line dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-face-green text-white flex items-center justify-center shadow-md shadow-face-green/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold uppercase tracking-tight text-face-ink dark:text-white">
                {isSiteManager ? "My Site Inspections" : "Site Inspections & Audits"}
              </h1>
              <p className="text-sm text-face-muted font-medium">
                Mandatory qualification gate & environmental waste haulage assessments
              </p>
            </div>
          </div>
        </div>

        {/* Stats counter chips & Actions */}
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-face-red-light dark:bg-rose-950/40 border border-face-red/30 dark:border-rose-800 text-face-red dark:text-rose-300 text-sm font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-face-red dark:text-rose-400" />
              <span>{overdueCount} Overdue SLA</span>
            </div>
          )}

          {unassignedCount > 0 && isApprover && (
            <button
              onClick={() => setActiveTab("unassigned")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm font-bold hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>{unassignedCount} Unassigned</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-face-field dark:bg-slate-800 text-face-ink dark:text-slate-300 text-sm font-bold border border-face-line dark:border-slate-700">
            Total: {inspections.length}
          </div>

          {/* Engine Settings button for approvers / ops managers */}
          {isApprover && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Engine Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center p-1 bg-face-field dark:bg-slate-800/80 rounded-xl border border-face-line dark:border-slate-700/80">
          {[
            { key: "todo", label: "To do" },
            { key: "awaiting_approval", label: "Awaiting Approval" },
            { key: "approved", label: "Approved" },
            ...(isApprover
              ? [{ key: "unassigned", label: `Unassigned (${unassignedCount})` }]
              : []),
            { key: "all", label: "All" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-900 text-face-green dark:text-face-green-mint shadow-xs"
                  : "text-face-muted hover:text-face-ink dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-face-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SI#, client, site, area..."
            className="w-full pl-9 pr-3 py-2 bg-face-field dark:bg-slate-900 border border-face-line dark:border-slate-800 rounded-xl text-sm font-medium placeholder-face-muted text-face-ink dark:text-white focus:outline-hidden focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
          />
        </div>
      </div>

      {/* Unassigned Bulk Actions Bar (if in unassigned tab) */}
      {activeTab === "unassigned" && isApprover && filteredInspections.length > 0 && (
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  selectedIds.length > 0 &&
                  selectedIds.length === filteredInspections.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(filteredInspections.map((i) => i.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
                className="rounded accent-amber-600"
              />
              <span>Select All ({selectedIds.length} selected)</span>
            </label>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Reason for bulk assign..."
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-sm text-face-ink dark:text-white"
              />
              <button
                onClick={handleBulkAssign}
                disabled={isBulkAssigning}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 text-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isBulkAssigning ? "Assigning..." : "Auto-Assign Selected"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inspection Cards / Table */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-face-muted">Loading site inspections...</div>
      ) : filteredInspections.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-face-line dark:border-slate-800 p-8 space-y-3 shadow-[0_2px_16px_rgba(40,50,120,0.06)]">
          <div className="w-12 h-12 rounded-2xl bg-face-field dark:bg-slate-800 text-face-muted flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-face-ink dark:text-white">
            No inspections match your filter
          </h3>
          <p className="text-sm text-face-muted max-w-sm mx-auto">
            Site inspections are created when leads enter the Contacted stage or when requested directly from the Lead detail view.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInspections.map((ins) => {
            const statusInfo = getStatusStyle(ins.status);
            const isOverdue =
              ins.status !== "APPROVED" &&
              ins.status !== "CANCELLED" &&
              ins.dueAt &&
              new Date(ins.dueAt) < now;

            const activeScopes = (ins.services || []).filter((s) => s.isActive);
            const isSelected = selectedIds.includes(ins.id);

            return (
              <div
                key={ins.id}
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-[0_2px_16px_rgba(40,50,120,0.06)] hover:shadow-[0_4px_20px_rgba(40,50,120,0.1)] transition-all flex flex-col justify-between space-y-4 group relative ${
                  isSelected
                    ? "border-amber-500 ring-2 ring-amber-500/20"
                    : "border-face-line dark:border-slate-800"
                }`}
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeTab === "unassigned" && isApprover && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, ins.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== ins.id));
                            }
                          }}
                          className="rounded accent-amber-600"
                        />
                      )}
                      <span className="font-mono text-sm font-black text-face-green dark:text-face-green-mint">
                        {ins.inspectionNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Priority Tag */}
                      {ins.priority && ins.priority !== "NORMAL" && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                            ins.priority === "URGENT"
                              ? "bg-face-red-light text-face-red dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-face-field text-face-muted dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {ins.priority}
                        </span>
                      )}

                      {/* State Badge */}
                      {ins.assignmentState && ins.assignmentState !== "ASSIGNED" && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {ins.assignmentState.replace(/_/g, " ")}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.badgeBg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-face-ink dark:text-white group-hover:text-face-green transition-colors line-clamp-1">
                      {ins.clientOrganization || ins.lead?.company || "Unnamed Client"}
                    </h3>
                    <p className="text-sm text-face-muted font-medium line-clamp-1 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-face-muted shrink-0" />
                      <span>{ins.siteAreaName || ins.siteName || "Location not set"}</span>
                    </p>
                  </div>

                  {/* Disqualification / Assignment Reason if unassigned */}
                  {ins.assignmentReason && (!ins.assignedToId || ins.assignmentState === "UNASSIGNED") && (
                    <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold">Queue Note: </span>
                      <span>{ins.assignmentReason}</span>
                    </div>
                  )}

                  {/* Stage B SLA RAG Countdown */}
                  {(() => {
                    const rag = getInspectionRag(ins);
                    return (
                      <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border ${rag.badgeBg} text-xs font-bold`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${rag.dotColor}`} />
                          <span>{rag.label}</span>
                        </div>
                        <span className="font-mono text-[11px] font-black">{rag.countdown}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-face-field dark:bg-slate-800/50 p-2.5 rounded-2xl border border-face-line dark:border-slate-800">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-face-muted block tracking-wider">
                      Base / Distance
                    </span>
                    <span className="font-extrabold text-face-ink dark:text-white block mt-0.5 text-sm">
                      {ins.baseToSiteStraightKm != null ? `${ins.baseToSiteStraightKm} km` : "Pending GPS"}
                    </span>
                    <span className="text-[11px] text-face-muted truncate block">
                      {ins.baseName || "No base"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] uppercase font-bold text-face-muted block tracking-wider">
                      Roundtrip Cycle
                    </span>
                    <span className="font-extrabold text-face-ink dark:text-white block mt-0.5 text-sm">
                      {ins.totalCycleKm != null ? `${ins.totalCycleKm} km` : "0 km"}
                    </span>
                    <span className="text-[11px] text-face-muted block">
                      {ins.estFuelLitres != null ? `~${ins.estFuelLitres}L Diesel` : "0L"}
                    </span>
                  </div>
                </div>

                {/* Active Services */}
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeScopes.length > 0 ? (
                      activeScopes.map((svc) => (
                        <span
                          key={svc.serviceType}
                          className="px-2 py-0.5 bg-face-green-light dark:bg-face-green-dark/40 text-face-green-dark dark:text-face-green-mint border border-face-green/30 dark:border-face-green-dark text-[11px] font-bold rounded-md"
                        >
                          {svc.serviceType}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-face-muted italic">No scope active</span>
                    )}
                  </div>
                </div>

                {/* Footer Info & CTA */}
                <div className="pt-3 border-t border-face-line dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-face-muted space-y-0.5 min-w-0">
                    <p className="truncate">
                      {ins.assignedTo ? `Assigned: ${ins.assignedTo.name}` : "Unassigned"}
                    </p>
                    {ins.dueAt && (
                      <p className={`flex items-center gap-1 font-semibold ${isOverdue ? "text-face-red dark:text-rose-400 font-bold" : "text-face-muted"}`}>
                        <Clock className="w-3 h-3" />
                        <span>Due: {new Date(ins.dueAt).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Reassign button for approver */}
                    {isApprover && (
                      <button
                        onClick={() => openReassignModal(ins)}
                        className="px-2.5 py-1.5 bg-face-field hover:bg-face-line dark:bg-slate-800 dark:hover:bg-slate-700 text-face-ink dark:text-slate-200 text-sm font-bold rounded-xl transition-all cursor-pointer"
                        title="Reassign or Assign Inspector"
                      >
                        Reassign
                      </button>
                    )}

                    <Link
                      to={`/site-inspections/${ins.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-face-green hover:bg-face-green-dark text-white text-sm font-bold rounded-xl transition-all shadow-xs shrink-0"
                    >
                      <span>{ins.status === "SUBMITTED" ? "Review" : "View"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings Modal */}
      <SiteInspectionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["site-inspections"] })}
      />

      {/* Reassign Modal */}
      {reassignModalInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-face-line dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-face-line dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-face-ink dark:text-white">
                Reassign Site Inspection: {reassignModalInspection.inspectionNumber}
              </h3>
              <button
                onClick={() => setReassignModalInspection(null)}
                className="text-face-muted hover:text-face-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reassignError && (
              <div className="p-3 bg-face-red-light dark:bg-rose-950/40 border border-face-red/30 dark:border-rose-800 rounded-xl text-face-red dark:text-rose-300">
                {reassignError}
              </div>
            )}

            <form onSubmit={handleExecuteReassign} className="space-y-3">
              <div>
                <label className="font-bold text-face-ink dark:text-slate-300 block mb-1">
                  Select Inspector
                </label>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                  required
                >
                  <option value="">Select Site Manager...</option>
                  {inspectorsList.map((insp) => (
                    <option key={insp.id} value={insp.id}>
                      {insp.name} ({insp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-face-ink dark:text-slate-300 block mb-1">
                  Reassignment Reason (Mandatory for Audit Trail)
                </label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Previous inspector on leave; reassigning to Ras Tanura team."
                  className="w-full px-3 py-2 bg-face-field dark:bg-slate-800/60 border border-face-line dark:border-slate-700 rounded-xl text-sm text-face-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-face-green/20 focus:border-face-green"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalInspection(null)}
                  className="px-4 py-2 text-face-muted hover:text-face-ink font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning}
                  className="px-4 py-2 bg-face-green hover:bg-face-green-dark text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isReassigning ? "Saving..." : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
