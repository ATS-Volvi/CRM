import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Users, TrendingUp, Target, DollarSign, Shield,
  BarChart2, ChevronRight, ArrowUpRight,
  CheckCircle2, Clock, User, Building2, Sparkles,
  MapPin, AlertTriangle, Inbox, PieChart, XCircle,
  ChevronDown, Activity, Eye, FileText, UserCheck
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { LossReasonAnalyticsSection } from "../components/LossReasonAnalyticsSection";

export default function ManagerPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "approvals" | "pipeline" | "revenue" | "leads" | "losses">("overview");

  const managerName = user?.name || "Manager";

  // ── Real data queries ──

  const { data: mgmtKpi } = useQuery<any>({
    queryKey: ["managementKpi"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/management");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: homeKpi } = useQuery<any>({
    queryKey: ["homeDashboard"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/home");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: teamReps = [] } = useQuery<any[]>({
    queryKey: ["salespersonsPerformance"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/salespersons/performance");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ["pendingApprovals"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/approvals/pending");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/leads");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: deals = [] } = useQuery<any[]>({
    queryKey: ["allDeals"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/pipeline/deals");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.flat?.() || data : [];
    },
  });

  const { data: staleDeals = [] } = useQuery<any[]>({
    queryKey: ["staleDeals"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/stale-deals");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch Direct Reports Team via /api/v1/manager/team
  const { data: directTeamData, isLoading: isLoadingDirectTeam } = useQuery<{ success: boolean; team: any[] }>({
    queryKey: ["managerDirectTeam"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/manager/team");
      if (!res.ok) return { success: false, team: [] };
      return res.json();
    }
  });

  const directTeam = directTeamData?.team || [];

  // ── Derived metrics ──

  const totalReps = teamReps.length;
  const availableReps = teamReps.filter((r: any) => r.isAvailable).length;
  const avgQuota = totalReps > 0 ? Math.round(teamReps.reduce((a: number, r: any) => a + (r.targetAchievementPct || 0), 0) / totalReps) : 0;
  const teamRevenue = teamReps.reduce((a: number, r: any) => a + (r.revenueClosed || 0), 0);

  const pipelineValue = mgmtKpi?.totalPipelineValue || 0;
  const totalWon = mgmtKpi?.totalWon || 0;
  const winRate = mgmtKpi?.winRate || 0;

  const newLeads = leads.filter((l: any) => l.status === "New").length;
  const unassignedLeads = leads.filter((l: any) => !l.assignedToId).length;
  const slaRiskLeads = leads.filter((l: any) => !l.assignedToId && l.status === "New").length;

  // Pipeline stage breakdown
  const allDeals = Array.isArray(deals) ? deals.flat() : [];
  const stageMap: Record<string, { count: number; value: number }> = {};
  allDeals.forEach((d: any) => {
    const stageName = d.stage?.name || d.stageName || "Unknown";
    if (!stageMap[stageName]) stageMap[stageName] = { count: 0, value: 0 };
    stageMap[stageName].count++;
    stageMap[stageName].value += d.value || 0;
  });
  const stageBreakdown = Object.entries(stageMap).sort(([, a], [, b]) => b.value - a.value);

  const tabs = [
    { key: "overview", label: "Team Overview", icon: Users, badge: totalReps },
    { key: "approvals", label: "Approvals", icon: Shield, badge: pendingApprovals.length },
    { key: "pipeline", label: "Pipeline Health", icon: BarChart2 },
    { key: "revenue", label: "Revenue & Targets", icon: DollarSign },
    { key: "leads", label: "Lead Intake", icon: Inbox, badge: newLeads },
    { key: "losses", label: "Loss Analytics", icon: PieChart },
  ];

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center font-black text-xl text-amber-300 shadow-inner">
            {(managerName || "M").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{managerName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-400 text-slate-950 uppercase tracking-wider">
                Dashboard
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-1">{user?.role === "admin" ? "Administrator" : "Sales Manager"} · {(user as any)?.department || "Operations"}</p>
          </div>
        </div>

        {/* Key KPI Strip */}
        <div className="flex items-center gap-6 bg-white/10 backdrop-blur p-4 rounded-xl border border-white/10">
          <div className="text-center">
            <p className="text-[9px] font-bold text-indigo-300 uppercase">Team Revenue</p>
            <p className="text-lg font-black text-amber-300">{formatCurrencyCompact(teamRevenue)}</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-[9px] font-bold text-indigo-300 uppercase">Pipeline</p>
            <p className="text-lg font-black text-white">{formatCurrencyCompact(pipelineValue)}</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-[9px] font-bold text-indigo-300 uppercase">Win Rate</p>
            <p className="text-lg font-black text-emerald-300">{winRate}%</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-[9px] font-bold text-indigo-300 uppercase">Avg Quota</p>
            <p className="text-lg font-black text-white">{avgQuota}%</p>
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-primary text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 1: TEAM OVERVIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Active Reps</span>
              <p className="text-2xl font-black text-slate-900">{totalReps}</p>
              <span className="text-[11px] text-emerald-600 font-bold">{availableReps} available for routing</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Team Revenue</span>
              <p className="text-2xl font-black text-emerald-600">{formatCurrencyCompact(teamRevenue)}</p>
              <span className="text-[11px] text-slate-500 font-semibold">Combined closed value</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Avg Quota Attainment</span>
              <p className={`text-2xl font-black ${avgQuota >= 80 ? "text-emerald-600" : avgQuota >= 50 ? "text-amber-600" : "text-rose-600"}`}>{avgQuota}%</p>
              <span className="text-[11px] text-slate-500 font-semibold">Target achievement</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pending Approvals</span>
              <p className="text-2xl font-black text-purple-600">{pendingApprovals.length}</p>
              <Link to="/approvals" className="text-[11px] text-primary font-bold hover:underline">View queue →</Link>
            </div>
          </div>

          {/* My Direct Reports & Capacity */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> My Direct Reports &amp; Open Deal Workload ({directTeam.length})
                </h3>
                <p className="text-[11px] text-slate-400">Direct reports managed by you (configured for commission splits &amp; routing)</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Team
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Representative</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Active Deals</th>
                    <th className="p-3.5">Deal Cutoff</th>
                    <th className="p-3.5">Capacity Cap</th>
                    <th className="p-3.5">Availability</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoadingDirectTeam ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">Loading team data...</td>
                    </tr>
                  ) : directTeam.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                        No direct reports assigned to your manager profile.
                      </td>
                    </tr>
                  ) : (
                    directTeam.map((member: any) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{member.name}</p>
                              <p className="text-[10px] text-slate-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {member.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900">{member.currentOpenDeals}</span>
                          <span className="text-[10px] text-slate-400 ml-1">open deals</span>
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {member.dealValueCutoff ? formatCurrency(member.dealValueCutoff) : "Uncapped"}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {member.maxOpenDeals ? `${member.maxOpenDeals} deals` : "Uncapped"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              member.isAvailable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${member.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {member.isAvailable ? "Available" : "OOO"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => navigate(`/salespersons/${member.id}`)}
                            className="text-primary font-bold hover:underline text-xs cursor-pointer"
                          >
                            View Performance →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rep performance list */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Overall Sales Rep Performance
              </h3>
              <Link to="/salespersons" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                Open Team Hub <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Rep</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Territory</th>
                    <th className="p-3.5">Leads</th>
                    <th className="p-3.5">Deals</th>
                    <th className="p-3.5">Revenue</th>
                    <th className="p-3.5">Quota %</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {teamReps.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400 italic">No team data available</td></tr>
                  ) : (
                    teamReps.slice(0, 10).map((rep: any, idx: number) => {
                      const pct = rep.targetAchievementPct || 0;
                      const pctColor = pct >= 90 ? "text-emerald-600 bg-emerald-50" : pct >= 60 ? "text-indigo-600 bg-indigo-50" : pct >= 30 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";

                      return (
                        <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                                {(rep.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{rep.name}</p>
                                <p className="text-[10px] text-slate-400">{rep.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600">{rep.department || "Sales"}</td>
                          <td className="p-3.5 text-slate-600">{rep.territory || "—"}</td>
                          <td className="p-3.5 font-bold text-slate-800">{rep.totalLeads || 0}</td>
                          <td className="p-3.5 font-bold text-slate-800">{rep.totalDeals || 0}</td>
                          <td className="p-3.5 font-bold text-slate-900">{formatCurrencyCompact(rep.revenueClosed || 0)}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${pctColor}`}>
                              {pct}%
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className={`w-2 h-2 rounded-full ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                          </td>
                          <td className="p-3.5">
                            <button onClick={() => navigate(`/salespersons/${rep.id}`)} className="text-primary font-bold hover:underline text-[10px]">
                              View
                            </button>
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
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 2: APPROVALS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "approvals" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Pending Approvals ({pendingApprovals.length})
            </h3>
            <Link to="/approvals" className="text-xs font-bold text-purple-600 hover:underline">Open Full Approval Queue →</Link>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">All caught up!</p>
              <p className="text-xs mt-1">No pending approvals at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((app: any) => (
                <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">
                        {app.type || "Quote Approval"}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{app.entityName || app.quoteNumber || `Approval #${app.id?.slice(0, 8)}`}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Requested by: <span className="font-bold text-slate-700">{app.requestedByName || "Sales Rep"}</span>
                      {app.reason && ` · ${app.reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-slate-900">{formatCurrencyCompact(app.amount || app.totalAmount || 0)}</span>
                    <button onClick={() => navigate("/approvals")} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 3: PIPELINE HEALTH */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "pipeline" && (
        <div className="space-y-6">
          {/* Pipeline KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Pipeline Value</span>
              <p className="text-2xl font-black text-indigo-600">{formatCurrencyCompact(pipelineValue)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Won</span>
              <p className="text-2xl font-black text-emerald-600">{formatCurrencyCompact(totalWon)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Win Rate</span>
              <p className="text-2xl font-black text-blue-600">{winRate}%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Stale Deals</span>
              <p className="text-2xl font-black text-amber-600">{staleDeals.length}</p>
              <span className="text-[11px] text-slate-500 font-semibold">No activity &gt;7 days</span>
            </div>
          </div>

          {/* Stage Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" /> Pipeline by Stage
              </h3>
              <Link to="/pipeline" className="text-xs font-bold text-primary hover:underline">Open Kanban →</Link>
            </div>

            {stageBreakdown.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No pipeline data available yet.</p>
            ) : (
              <div className="space-y-3">
                {stageBreakdown.map(([stage, data]) => {
                  const maxVal = Math.max(...stageBreakdown.map(([, d]) => d.value), 1);
                  const pct = Math.round((data.value / maxVal) * 100);
                  return (
                    <div key={stage} className="flex items-center gap-4">
                      <span className="w-36 text-xs font-bold text-slate-700 truncate">{stage}</span>
                      <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800 w-20 text-right">{formatCurrencyCompact(data.value)}</span>
                      <span className="text-[10px] text-slate-400 font-bold w-12 text-right">{data.count} deals</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stale Deals */}
          {staleDeals.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Stale Deals Requiring Attention ({staleDeals.length})
              </h3>
              <div className="space-y-2">
                {staleDeals.slice(0, 5).map((deal: any) => (
                  <div key={deal.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{deal.name || deal.title}</p>
                      <p className="text-[10px] text-slate-500">Owner: {deal.ownerName || "Unassigned"} · Stage: {deal.stageName || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-slate-900">{formatCurrencyCompact(deal.value || 0)}</p>
                      <p className="text-[10px] text-amber-600 font-bold">{deal.daysSinceUpdate || "7+"} days idle</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 4: REVENUE & TARGETS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div className="space-y-6">
          {/* Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Revenue (Closed)</span>
              <p className="text-2xl font-black text-emerald-600">{formatCurrencyCompact(totalWon)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pipeline Value</span>
              <p className="text-2xl font-black text-indigo-600">{formatCurrencyCompact(pipelineValue)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Team Avg Quota</span>
              <p className={`text-2xl font-black ${avgQuota >= 80 ? "text-emerald-600" : avgQuota >= 50 ? "text-amber-600" : "text-rose-600"}`}>{avgQuota}%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Conversion Rate</span>
              <p className="text-2xl font-black text-blue-600">{homeKpi?.conversionRate || 0}%</p>
            </div>
          </div>

          {/* Per-Rep Revenue Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Revenue by Representative
            </h3>

            {teamReps.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No revenue data available.</p>
            ) : (
              <div className="space-y-3">
                {[...teamReps]
                  .sort((a: any, b: any) => (b.revenueClosed || 0) - (a.revenueClosed || 0))
                  .slice(0, 10)
                  .map((rep: any) => {
                    const maxRev = Math.max(...teamReps.map((r: any) => r.revenueClosed || 0), 1);
                    const barPct = Math.round(((rep.revenueClosed || 0) / maxRev) * 100);
                    const pct = rep.targetAchievementPct || 0;

                    return (
                      <div key={rep.id} className="flex items-center gap-4">
                        <div className="w-28 flex items-center gap-2 shrink-0">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-[8px] flex items-center justify-center">
                            {(rep.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-xs font-bold text-slate-700 truncate">{rep.name}</span>
                        </div>
                        <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-indigo-500" : "bg-amber-500"}`} style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-xs font-extrabold text-slate-800 w-20 text-right">{formatCurrencyCompact(rep.revenueClosed || 0)}</span>
                        <span className={`text-[10px] font-extrabold w-10 text-right ${pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-indigo-600" : "text-amber-600"}`}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 5: LEAD INTAKE SUMMARY */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "leads" && (
        <div className="space-y-6">
          {/* Lead KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Leads</span>
              <p className="text-2xl font-black text-slate-900">{leads.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">New Inbound</span>
              <p className="text-2xl font-black text-emerald-600">{newLeads}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Unassigned</span>
              <p className="text-2xl font-black text-rose-600">{unassignedLeads}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">SLA Risk</span>
              <p className="text-2xl font-black text-amber-600">{slaRiskLeads}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">Contacted</span>
              <p className="text-2xl font-black text-blue-600">{leads.filter((l: any) => l.status === "Contacted").length}</p>
            </div>
          </div>

          {/* Channel Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-primary" /> Lead Source Breakdown
              </h3>
              <Link to="/leads" className="text-xs font-bold text-primary hover:underline">Open Lead Queue →</Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {["WhatsApp", "Website", "Email", "Instagram", "LinkedIn", "Manual"].map(source => {
                const count = leads.filter((l: any) => (l.source || "").toLowerCase().includes(source.toLowerCase())).length;
                return (
                  <div key={source} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <p className="text-xl font-black text-slate-900">{count}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{source}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Lead Status Distribution</h3>
            <div className="space-y-2">
              {["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"].map(status => {
                const count = leads.filter((l: any) => l.status === status).length;
                const maxCount = Math.max(...["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"].map(s => leads.filter((l: any) => l.status === s).length), 1);
                const barPct = Math.round((count / maxCount) * 100);
                const barColor = status === "Won" ? "bg-emerald-500" : status === "Lost" ? "bg-rose-500" : "bg-indigo-500";

                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-bold text-slate-600">{status}</span>
                    <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 w-10 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB 6: LOSS ANALYTICS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === "losses" && (
        <LossReasonAnalyticsSection />
      )}

    </div>
  );
}
