import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Target, TrendingUp, TrendingDown, Minus, Search, Filter } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiRow {
  id: string;
  kpiName: string;
  category: string;
  currentValue: number;
  targetValue: number;
  weightage: number;
  frequency: string;
  status: "Active" | "Locked";
  /** Only present in team-aggregate mode */
  repName?: string;
  repId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function attainmentPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(999, Math.round((current / target) * 100));
}

function gap(current: number, target: number): number {
  return Math.max(0, target - current);
}

function statusLabel(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 100) return { label: "Achieved", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40" };
  if (pct >= 80)  return { label: "On Track",  color: "text-blue-700 dark:text-blue-300",    bg: "bg-blue-100 dark:bg-blue-900/40"    };
  if (pct >= 50)  return { label: "At Risk",   color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-100 dark:bg-amber-900/40"  };
  return              { label: "Behind",    color: "text-rose-700 dark:text-rose-300",    bg: "bg-rose-100 dark:bg-rose-900/40"    };
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct >= 100) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (pct >= 50)  return <Minus className="w-3.5 h-3.5 text-amber-500" />;
  return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
}

function AttainmentBar({ pct }: { pct: number }) {
  const capped = Math.min(100, pct);
  const color =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 80  ? "bg-blue-500"    :
    pct >= 50  ? "bg-amber-500"   : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className="text-[11px] font-bold w-9 text-right text-slate-600 dark:text-slate-400 shrink-0">
        {pct}%
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Pass a salesperson UUID for single-rep mode (Performance Analytics tab).
   * Pass "all" for company-wide mode (Business Users → Sales Performance tab).
   */
  salespersonId?: string | "all";
  /** Pass a team ID/name to fetch only that team's KPIs */
  teamId?: string;
  /** Optional: compact layout for embedding inside a detail page */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KpiAttainmentTable({ salespersonId, teamId, compact = false }: Props) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const isTeamMode = Boolean(teamId) || salespersonId === "all";
  const isSingleRepMode = !teamId && salespersonId && salespersonId !== "all";

  // ── Single rep mode ─────────────────────────────────────────────────────────
  const { data: repKpis, isLoading: repLoading } = useQuery<KpiRow[]>({
    queryKey: ["kpi-attainment-single", salespersonId],
    enabled: Boolean(isSingleRepMode),
    queryFn: async () => {
      const res = await fetch(`/api/v1/salespersons/${salespersonId}/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      const raw = await res.json();
      return (raw as any[]).map((t) => ({
        id: t.id,
        kpiName: t.kpiName,
        category: t.category || t.kpiMaster?.category || "General",
        currentValue: Number(t.currentValue ?? 0),
        targetValue: Number(t.targetValue ?? 0),
        weightage: Number(t.weightage ?? 0),
        frequency: t.frequency || "monthly",
        status: t.status || "Active",
      }));
    },
  });

  // ── Team / Batch mode (single batch endpoint) ──────────────────────────────
  const { data: teamKpis, isLoading: teamLoading } = useQuery<KpiRow[]>({
    queryKey: ["kpi-attainment-batch", teamId || "all"],
    enabled: isTeamMode,
    queryFn: async () => {
      const url = teamId
        ? `/api/v1/salespersons/kpis?teamId=${encodeURIComponent(teamId)}`
        : `/api/v1/salespersons/kpis`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch team KPIs");
      return res.json();
    },
  });

  const rows: KpiRow[] = isTeamMode ? (teamKpis ?? []) : (repKpis ?? []);
  const isLoading = isTeamMode ? teamLoading : repLoading;
  const showRepCol = isTeamMode;

  const categories = ["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()];

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.kpiName.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      (r.repName && r.repName.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === "All" || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // ── Summary stats ────────────────────────────────────────────────────────────
  const achieved  = filtered.filter((r) => attainmentPct(r.currentValue, r.targetValue) >= 100).length;
  const onTrack   = filtered.filter((r) => { const p = attainmentPct(r.currentValue, r.targetValue); return p >= 80 && p < 100; }).length;
  const atRisk    = filtered.filter((r) => { const p = attainmentPct(r.currentValue, r.targetValue); return p >= 50 && p < 80; }).length;
  const behind    = filtered.filter((r) => attainmentPct(r.currentValue, r.targetValue) < 50).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
        Loading KPI data…
      </div>
    );
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
        <Target className="w-8 h-8 opacity-30 text-primary" />
        <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
          No KPI targets assigned {teamId ? "for this team" : "yet"}.
        </p>
        <p className="text-[11px] text-slate-500">Go to Master Data → KPI Assignments to create targets.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "mt-2"}`}>
      {/* ── Summary pills ───────────────────────────────────────────────────── */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Achieved",  count: achieved, color: "from-emerald-500 to-emerald-600" },
            { label: "On Track",  count: onTrack,  color: "from-blue-500 to-blue-600"    },
            { label: "At Risk",   count: atRisk,   color: "from-amber-500 to-amber-600"  },
            { label: "Behind",    count: behind,   color: "from-rose-500 to-rose-600"    },
          ].map((s) => (
            <div
              key={s.label}
              className={`bg-gradient-to-br ${s.color} text-white rounded-xl px-4 py-3 shadow-sm`}
            >
              <p className="text-2xl font-extrabold">{s.count}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={showRepCol ? "Search KPI or rep name…" : "Search KPI name…"}
            className="flex-1 bg-transparent text-xs outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent text-xs outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
        {filtered.length !== rows.length && (
          <span className="text-[11px] text-slate-500 font-medium">
            Showing {filtered.length} of {rows.length}
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-left">
                {showRepCol && (
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Rep
                  </th>
                )}
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  KPI
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Category
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">
                  Current
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">
                  Target
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap min-w-[130px]">
                  Attainment
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">
                  Gap
                </th>
                <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={showRepCol ? 8 : 7}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No results match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const pct = attainmentPct(row.currentValue, row.targetValue);
                  const gapVal = gap(row.currentValue, row.targetValue);
                  const { label, color, bg } = statusLabel(pct);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {showRepCol && (
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.repName || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <TrendIcon pct={pct} />
                          {row.kpiName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {row.currentValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {row.targetValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <AttainmentBar pct={pct} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {gapVal > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            -{gapVal.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${bg} ${color}`}>
                          {label}
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

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <p className="text-[10px] text-slate-400 text-right">
        Showing {filtered.length} KPI target{filtered.length !== 1 ? "s" : ""}
        {salespersonId === "all" ? " across all reps" : " for this rep"}.
        Manage targets in Settings → KPI Assignments.
      </p>
    </div>
  );
}
