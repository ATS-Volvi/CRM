import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  Target, Users, User, TrendingUp, AlertTriangle, CheckCircle2, 
  Clock, ArrowUpRight, ArrowDownRight, Search, Filter, ShieldAlert,
  BarChart3, Award, Sparkles
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface Rep {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  territory?: string | null;
  team?: string | null;
  managerId?: string | null;
}

interface KpiTarget {
  id: string;
  salespersonId: string;
  kpiMasterId?: string | null;
  kpiName: string;
  category: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  weightage: number;
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  status: "Active" | "Locked" | string;
}

function formatKpiValue(val: number, kpiName: string): string {
  const nameLower = kpiName.toLowerCase();
  const isCurrency = nameLower.includes("revenue") || 
                     nameLower.includes("collection") || 
                     nameLower.includes("payment") || 
                     nameLower.includes("outstanding") || 
                     nameLower.includes("amount") ||
                     nameLower.includes("cost") ||
                     nameLower.includes("price");
  if (isCurrency) {
    return formatCurrency(val);
  }
  if (kpiName.includes("%")) {
    return `${val}%`;
  }
  return Number(val).toLocaleString();
}

function computeGap(targetValue: number, currentValue: number, kpiName: string) {
  const gap = targetValue - currentValue;
  const attainment = targetValue > 0 ? (currentValue / targetValue) * 100 : (currentValue > 0 ? 100 : 0);

  if (gap <= 0) {
    const formattedDiff = formatKpiValue(Math.abs(gap), kpiName);
    return {
      gap,
      formattedText: `Exceeded by ${formattedDiff}`,
      tier: "exceeded" as const,
      colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
    };
  }

  const formattedGap = formatKpiValue(gap, kpiName);
  if (attainment < 40) {
    return {
      gap,
      formattedText: `${formattedGap} to go`,
      tier: "critical" as const,
      colorClass: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
    };
  }

  return {
    gap,
    formattedText: `${formattedGap} to go`,
    tier: "behind" as const,
    colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
  };
}

export default function TeamKpiPerformance() {
  const { user, token } = useAuth();
  const callerRole = (user?.role || "").toLowerCase();
  const callerId = user?.id || "";

  // Manager/director/admin roles can choose any salesperson
  const isManagerRole = ["admin", "director", "manager", "sales_manager"].includes(callerRole);

  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ── 1. Fetch salespersons list if manager role ──────────────────────────────
  const { data: reps = [], isLoading: repsLoading } = useQuery<Rep[]>({
    queryKey: ["salespersonsListTeamKpi", callerId, callerRole],
    enabled: isManagerRole,
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch salespersons");
      const data: Rep[] = await res.json();
      return data.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  // Auto-select initial salesperson
  useEffect(() => {
    if (isManagerRole) {
      if (reps.length > 0 && (!selectedRepId || !reps.some(r => r.id === selectedRepId))) {
        setSelectedRepId(reps[0].id);
      }
    } else if (callerId) {
      setSelectedRepId(callerId);
    }
  }, [isManagerRole, reps, callerId, selectedRepId]);

interface ActiveRep {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  territory?: string | null;
  team?: string | null;
}

  // Active salesperson object
  const activeRep = useMemo<ActiveRep | null>(() => {
    if (isManagerRole) {
      return reps.find(r => r.id === selectedRepId) || null;
    }
    const anyUser = user as any;
    return {
      id: callerId,
      name: user?.name || "My Performance",
      email: user?.email || "",
      role: callerRole,
      department: anyUser?.department ?? null,
      territory: user?.territory ?? null,
      team: anyUser?.team ?? null
    };
  }, [isManagerRole, reps, selectedRepId, callerId, user, callerRole]);

  // ── 2. Fetch KPI targets for selected salesperson ───────────────────────────
  const { data: rawKpis = [], isLoading: kpisLoading } = useQuery<KpiTarget[]>({
    queryKey: ["salespersonKpis", selectedRepId],
    enabled: !!selectedRepId,
    queryFn: async () => {
      const res = await fetch(`/api/v1/salespersons/${selectedRepId}/kpis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch salesperson KPIs");
      return res.json();
    }
  });

  // Extract unique categories for filter tabs
  const categories = useMemo(() => {
    const set = new Set<string>();
    rawKpis.forEach(k => {
      if (k.category) set.add(k.category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [rawKpis]);

  // ── 3. Process, calculate, and default-sort KPIs ─────────────────────────────
  // Worst attainment first (furthest from target), exceeded at the bottom
  const processedKpis = useMemo(() => {
    const list = rawKpis.map(kpi => {
      const current = Number(kpi.currentValue) || 0;
      const target = Number(kpi.targetValue) || 0;
      const attainmentPct = target > 0 ? (current / target) * 100 : (current > 0 ? 100 : 0);
      const progressCapped = Math.min(100, Math.max(0, Math.round(attainmentPct)));

      let statusBadge: "Exceeded" | "On Track" | "Behind";
      if (current >= target && target > 0) {
        statusBadge = "Exceeded";
      } else if (attainmentPct >= 70) {
        statusBadge = "On Track";
      } else {
        statusBadge = "Behind";
      }

      const gapInfo = computeGap(target, current, kpi.kpiName);

      return {
        ...kpi,
        current,
        target,
        attainmentPct,
        progressCapped,
        statusBadge,
        gapInfo
      };
    });

    // Default sorting:
    // 1. Not-exceeded KPIs sorted ascending by attainment percentage (worst attainment first)
    // 2. Exceeded KPIs sorted after, descending by attainment
    return list.sort((a, b) => {
      const aExceeded = a.statusBadge === "Exceeded";
      const bExceeded = b.statusBadge === "Exceeded";

      if (!aExceeded && bExceeded) return -1;
      if (aExceeded && !bExceeded) return 1;
      if (!aExceeded && !bExceeded) {
        return a.attainmentPct - b.attainmentPct; // lower attainment at the top
      }
      return b.attainmentPct - a.attainmentPct; // higher overage first among exceeded
    });
  }, [rawKpis]);

  // Filtered list
  const filteredKpis = useMemo(() => {
    return processedKpis.filter(kpi => {
      if (categoryFilter !== "All" && kpi.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "All" && kpi.statusBadge !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = kpi.kpiName.toLowerCase().includes(query);
        const matchesCat = (kpi.category || "").toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }
      return true;
    });
  }, [processedKpis, categoryFilter, statusFilter, searchQuery]);

  // Overall metric stats for summary cards
  const stats = useMemo(() => {
    const total = processedKpis.length;
    const behind = processedKpis.filter(k => k.statusBadge === "Behind").length;
    const onTrack = processedKpis.filter(k => k.statusBadge === "On Track").length;
    const exceeded = processedKpis.filter(k => k.statusBadge === "Exceeded").length;

    const avgAttainment = total > 0 
      ? Math.round(processedKpis.reduce((sum, k) => sum + k.attainmentPct, 0) / total) 
      : 0;

    return { total, behind, onTrack, exceeded, avgAttainment };
  }, [processedKpis]);

  const isViewingSelf = !isManagerRole || selectedRepId === callerId;

  return (
    <div className="w-full px-6 md:px-8 py-6 space-y-6 animate-fade-in text-on-surface">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-on-surface">
              {isViewingSelf ? "My KPI Performance" : "Team KPI Performance"}
            </h1>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {isViewingSelf
                ? "Track your target achievement, real-time metrics, and gap remaining."
                : "Monitor salesperson performance, identify gap-to-target bottlenecks, and track goals."}
            </p>
          </div>
        </div>

        {/* Salesperson Picker (Manager/Director/Admin only) */}
        {isManagerRole && (
          <div className="flex items-center gap-2.5 bg-surface-container-low border border-outline-variant rounded-2xl p-1.5 shadow-sm">
            <div className="flex items-center gap-2 pl-3 text-xs font-bold text-on-surface-variant">
              <Users className="w-4 h-4 text-primary" />
              <span>Salesperson:</span>
            </div>
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              disabled={repsLoading}
              className="bg-surface border border-outline rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-inner min-w-[200px]"
            >
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name} {rep.team ? `(${rep.team})` : `(${rep.role})`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Active Salesperson Context Pill ──────────────────────────────────── */}
      {activeRep && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-5 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20">
              {activeRep.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-on-surface">{activeRep.name}</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                  {activeRep.role}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                {activeRep.email} {activeRep.department ? `· ${activeRep.department}` : ""} {activeRep.territory ? `· ${activeRep.territory}` : ""}
              </p>
            </div>
          </div>
          {activeRep.team && (
            <div className="px-3 py-1 bg-primary/5 border border-primary/15 rounded-lg text-xs font-semibold text-primary">
              Team: <span className="font-bold">{activeRep.team}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Summary Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total KPIs</span>
            <BarChart3 className="w-4 h-4 text-on-surface-variant/70" />
          </div>
          <div className="text-2xl font-bold text-on-surface">{stats.total}</div>
          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Assigned targets</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Behind</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.behind}</div>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5">&lt; 70% attainment</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">On Track</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">{stats.onTrack}</div>
          <p className="text-[10px] text-primary/80 font-medium mt-0.5">70% – 99% attainment</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Exceeded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.exceeded}</div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">100%+ target hit</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Attainment</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-on-surface">{stats.avgAttainment}%</div>
          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Across all goals</p>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-on-surface-variant/70 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter KPIs..."
              className="pl-8 pr-3 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-bold bg-surface-container-lowest border border-outline-variant rounded-xl px-2.5 py-1.5 text-on-surface-variant focus:outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Behind">Behind (&lt; 70%)</option>
            <option value="On Track">On Track (70-99%)</option>
            <option value="Exceeded">Exceeded (100%+)</option>
          </select>
        </div>
      </div>

      {/* ── Table Container ──────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="px-6 py-3.5">KPI & Category</th>
                <th className="px-6 py-3.5 text-right">Current</th>
                <th className="px-6 py-3.5 text-right">Target</th>
                <th className="px-6 py-3.5 text-left">Gap Remaining</th>
                <th className="px-6 py-3.5 text-left min-w-[170px]">Attainment Progress</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-xs">
              {kpisLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold text-on-surface-variant italic">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading KPI performance data...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredKpis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-on-surface-variant">
                    <div className="flex flex-col items-center gap-2">
                      <Target className="w-8 h-8 text-on-surface-variant/40" />
                      <p className="font-bold">No KPI targets match the current filters.</p>
                      <p className="text-[11px]">Try switching the category tab or clearing the search query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKpis.map((kpi) => {
                  const currentFormatted = formatKpiValue(kpi.current, kpi.kpiName);
                  const targetFormatted = formatKpiValue(kpi.target, kpi.kpiName);
                  const isBehind = kpi.statusBadge === "Behind";
                  const isExceeded = kpi.statusBadge === "Exceeded";

                  return (
                    <tr 
                      key={kpi.id} 
                      className={`group transition-colors ${
                        isBehind 
                          ? "hover:bg-rose-500/5 bg-rose-500/[0.02]" 
                          : "hover:bg-surface-container-low/40"
                      }`}
                    >
                      {/* KPI Name & Category */}
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface text-xs">
                              {kpi.kpiName}
                            </span>
                            {kpi.weightage > 0 && (
                              <span className="text-[9px] font-bold text-on-surface-variant/70 px-1.5 py-0.2 bg-surface-container rounded">
                                {kpi.weightage}% wt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
                            <span className="px-1.5 py-0.2 rounded bg-surface-container font-semibold text-on-surface-variant">
                              {kpi.category || "General"}
                            </span>
                            <span>·</span>
                            <span className="capitalize">{kpi.frequency}</span>
                          </div>
                        </div>
                      </td>

                      {/* Current Value */}
                      <td className="px-6 py-3.5 text-right font-bold text-on-surface">
                        {currentFormatted}
                      </td>

                      {/* Target Value */}
                      <td className="px-6 py-3.5 text-right font-semibold text-on-surface-variant">
                        {targetFormatted}
                      </td>

                      {/* Gap Remaining (The core requirement) */}
                      <td className="px-6 py-3.5 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${kpi.gapInfo.colorClass}`}
                            title={`Target: ${targetFormatted} | Current: ${currentFormatted}`}
                          >
                            {isExceeded ? (
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{kpi.gapInfo.formattedText}</span>
                          </span>
                        </div>
                      </td>

                      {/* Progress Bar & % */}
                      <td className="px-6 py-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className={
                              isExceeded 
                                ? "text-emerald-600 dark:text-emerald-400" 
                                : isBehind 
                                  ? "text-rose-600 dark:text-rose-400" 
                                  : "text-primary"
                            }>
                              {kpi.attainmentPct}%
                            </span>
                            <span className="text-on-surface-variant/70">
                              {kpi.progressCapped}% capped
                            </span>
                          </div>
                          <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isExceeded
                                  ? "bg-emerald-500"
                                  : isBehind
                                    ? "bg-rose-500"
                                    : "bg-primary"
                              }`}
                              style={{ width: `${kpi.progressCapped}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                            isExceeded
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40"
                              : isBehind
                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/40"
                                : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300/40"
                          }`}
                        >
                          {isExceeded && <CheckCircle2 className="w-3 h-3" />}
                          {isBehind && <AlertTriangle className="w-3 h-3" />}
                          {!isExceeded && !isBehind && <Clock className="w-3 h-3" />}
                          {kpi.statusBadge}
                        </span>
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
  );
}
