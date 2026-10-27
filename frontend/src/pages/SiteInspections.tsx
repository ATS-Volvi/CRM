import React, { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { siteInspectionApi } from "../api/siteInspection";
import { getStatusStyle, SiteInspectionRecord } from "../lib/siteInspection";
import { useAuth } from "../context/AuthContext";

type TabType = "todo" | "awaiting_approval" | "approved" | "all";

export default function SiteInspections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSiteManager = user?.role === "site_manager";

  const [activeTab, setActiveTab] = useState<TabType>("todo");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredInspections = useMemo(() => {
    return inspections.filter((ins) => {
      // Tab filter
      if (activeTab === "todo") {
        if (!["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(ins.status)) return false;
      } else if (activeTab === "awaiting_approval") {
        if (ins.status !== "SUBMITTED") return false;
      } else if (activeTab === "approved") {
        if (ins.status !== "APPROVED") return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (ins.inspectionNumber || "").toLowerCase();
        const client = (ins.clientOrganization || "").toLowerCase();
        const site = (ins.siteName || "").toLowerCase();
        const rfq = (ins.rfqNumber || "").toLowerCase();
        const leadCo = (ins.lead?.company || "").toLowerCase();
        if (!num.includes(q) && !client.includes(q) && !site.includes(q) && !rfq.includes(q) && !leadCo.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [inspections, activeTab, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isSiteManager ? "My Site Inspections" : "Site Inspections & Audits"}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Mandatory qualification gate & environmental waste haulage assessments
              </p>
            </div>
          </div>
        </div>

        {/* Stats counter chips */}
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{overdueCount} Overdue SLA</span>
            </div>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
            Total: {inspections.length}
          </div>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          {[
            { key: "todo", label: "To do" },
            { key: "awaiting_approval", label: "Awaiting Approval" },
            { key: "approved", label: "Approved" },
            { key: "all", label: "All" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SI#, client, site, RFQ..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Inspection Cards / Table */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading site inspections...</div>
      ) : filteredInspections.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No inspections match your filter
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
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

            return (
              <div
                key={ins.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {ins.inspectionNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badgeBg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {ins.clientOrganization || ins.lead?.company || "Unnamed Client"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-1 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{ins.siteName || "Site coordinates not set"}</span>
                    </p>
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Base / Distance
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white block mt-0.5">
                      {ins.baseToSiteStraightKm != null ? `${ins.baseToSiteStraightKm} km` : "Pending GPS"}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate block">
                      {ins.baseName || "No base"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Roundtrip Cycle
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white block mt-0.5">
                      {ins.totalCycleKm != null ? `${ins.totalCycleKm} km` : "0 km"}
                    </span>
                    <span className="text-[9px] text-slate-400 block">
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
                          className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold rounded-md"
                        >
                          {svc.serviceType}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No scope active</span>
                    )}
                  </div>
                </div>

                {/* Footer Info & CTA */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400 space-y-0.5 min-w-0">
                    <p className="truncate">
                      {ins.assignedTo ? `Assigned: ${ins.assignedTo.name}` : "Unassigned"}
                    </p>
                    {ins.dueAt && (
                      <p className={`flex items-center gap-1 font-semibold ${isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-400"}`}>
                        <Clock className="w-3 h-3" />
                        <span>Due: {new Date(ins.dueAt).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>

                  <Link
                    to={`/site-inspections/${ins.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-all shadow-xs shrink-0"
                  >
                    <span>{ins.status === "SUBMITTED" ? "Review" : "View"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
