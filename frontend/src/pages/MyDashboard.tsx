import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  Users, DollarSign, Inbox, TrendingUp, FileText,
  Calendar, ChevronDown, ArrowUp, ArrowDown,
  Building2, Tag, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HomeDashboardData {
  clientsCount: number;
  poValue: number;
  leadsCount: number;
  conversionRate: number;
  invoicesTotal: number;
  clients: { id: string; name: string; company: string; status: string; email: string }[];
  leads: { id: string; name: string; company: string; amount: number; status: string; source: string }[];
  quotes: { id: string; quoteNumber: string; dealName: string; amount: number; status: string; createdAt: string }[];
  purchaseOrders: { id: string; poNumber: string; amount: number; status: string; createdAt: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toLocalISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const LEAD_STATUS_PILL: Record<string, string> = {
  New:       "bg-blue-500/10 text-blue-600",
  Contacted: "bg-indigo-500/10 text-indigo-600",
  Qualified: "bg-green-500/10 text-green-600",
  Lost:      "bg-red-500/10 text-red-600",
};

const QUOTE_STATUS_PILL: Record<string, string> = {
  Draft:              "bg-surface-container-high text-on-surface-variant",
  "Pending Approval": "bg-amber-500/10 text-amber-600",
  Approved:           "bg-blue-500/10 text-blue-600",
  Rejected:           "bg-red-500/10 text-red-600",
  Sent:               "bg-indigo-500/10 text-indigo-600",
  Viewed:             "bg-purple-500/10 text-purple-600",
  Accepted:           "bg-green-500/10 text-green-600",
  Expired:            "bg-slate-500/10 text-slate-500",
  Superseded:         "bg-slate-500/10 text-slate-400",
};

const PO_STATUS_PILL: Record<string, string> = {
  Pending:  "bg-amber-500/10 text-amber-600",
  Approved: "bg-green-500/10 text-green-600",
  Verified: "bg-blue-500/10 text-blue-600",
  Rejected: "bg-red-500/10 text-red-600",
};

function StatusPill({ label, map }: { label: string; map: Record<string, string> }) {
  const cls = map[label] ?? "bg-surface-container text-on-surface-variant";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, color, trend
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: { up: boolean; text: string };
}) {
  return (
    <div className="bg-white/90 backdrop-blur border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value}</p>
      {trend && (
        <div className={`flex items-center gap-1 text-[12px] font-semibold ${trend.up ? "text-emerald-500" : "text-red-500"}`}>
          {trend.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {trend.text}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type TabKey = "leads" | "quotes" | "pos";

export default function MyDashboard() {
  const { user, token } = useAuth();

  // Controls
  const [range, setRange] = useState<"day" | "week">("week");
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 7);
  const [startDate, setStartDate] = useState(toLocalISODate(defaultStart));
  const [endDate,   setEndDate]   = useState(toLocalISODate(today));
  const [activeTab, setActiveTab] = useState<TabKey>("leads");

  // Data fetch
  const { data, isLoading, error } = useQuery<HomeDashboardData>({
    queryKey: ["homeDashboard", range, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ range, startDate, endDate });
      const res = await fetch(`/api/v1/dashboard/home?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    enabled: !!token
  });

  const handleRangeToggle = (r: "day" | "week") => {
    setRange(r);
    const now = new Date();
    const s = new Date(now);
    if (r === "day") {
      s.setHours(0, 0, 0, 0);
    } else {
      s.setDate(now.getDate() - 7);
    }
    setStartDate(toLocalISODate(s));
    setEndDate(toLocalISODate(now));
  };

  const kpiCards = [
    {
      label: "Clients",
      value: String(data?.clientsCount ?? 0),
      icon: Users,
      color: "bg-primary/10 text-primary",
      trend: { up: true, text: "Won accounts" }
    },
    {
      label: "PO Value",
      value: formatCurrencyCompact(data?.poValue ?? 0),
      icon: DollarSign,
      color: "bg-secondary/10 text-secondary",
      trend: { up: true, text: "All-time POs" }
    },
    {
      label: "Leads",
      value: String(data?.leadsCount ?? 0),
      icon: Inbox,
      color: "bg-tertiary/10 text-tertiary",
      trend: { up: (data?.leadsCount ?? 0) > 0, text: `This ${range}` }
    },
    {
      label: "Conversion %",
      value: `${Math.round(data?.conversionRate ?? 0)}%`,
      icon: TrendingUp,
      color: "bg-emerald-500/10 text-emerald-600",
      trend: { up: (data?.conversionRate ?? 0) >= 50, text: "Win / close rate" }
    },
    {
      label: "Invoices",
      value: formatCurrencyCompact(data?.invoicesTotal ?? 0),
      icon: FileText,
      color: "bg-amber-500/10 text-amber-600",
      trend: { up: true, text: `This ${range}` }
    }
  ];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "leads",  label: "Leads",  count: data?.leads.length  ?? 0 },
    { key: "quotes", label: "Quotes", count: data?.quotes.length ?? 0 },
    { key: "pos",    label: "POs",    count: data?.purchaseOrders.length ?? 0 }
  ];

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const userRole = user?.role === "sales_rep" ? "representative" : user?.role || "user";

  return (
    <div className="p-8 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold tracking-wider text-primary uppercase mb-1">
            Personal Dashboard
          </p>
          <h1 className="text-4xl font-bold text-on-surface">
            {greeting}, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{userRole}</span> 👋
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">Here's a snapshot of your pipeline for the selected period.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Day / Week toggle */}
          <div className="flex rounded-lg border border-outline-variant overflow-hidden bg-surface-container-lowest">
            {(["day", "week"] as const).map(r => (
              <button
                key={r}
                onClick={() => handleRangeToggle(r)}
                className={`px-4 py-2 text-sm font-semibold transition-colors capitalize ${
                  range === r
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-semibold text-on-surface">
            <Calendar className="w-4 h-4 text-on-surface-variant" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent outline-none text-sm text-on-surface w-32"
            />
            <span className="text-on-surface-variant">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent outline-none text-sm text-on-surface w-32"
            />
          </div>
        </div>
      </div>

      {/* ── Loading / Error ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="text-error bg-error-container p-4 rounded-xl text-sm">
          {(error as Error).message}
        </div>
      ) : (
        <>
          {/* ── KPI Cards ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {kpiCards.map(c => (
              <KpiCard key={c.label} {...c} />
            ))}
          </div>

          {/* ── Body: Client list + Tabbed table + Conversion Widget ─────────── */}
          <div className="grid grid-cols-12 gap-6">

            {/* My Clients list — 3 cols */}
            <div className="col-span-12 md:col-span-3 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-sm flex flex-col">
              <div className="px-6 py-5 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-base text-on-surface">My Clients</h2>
                  <span className="ml-auto bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {data?.clients.length ?? 0}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/50" style={{ maxHeight: 420 }}>
                {(data?.clients.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant gap-2">
                    <Users className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No clients yet</p>
                  </div>
                ) : data!.clients.map(c => (
                  <div key={c.id} className="px-6 py-4 hover:bg-surface-container-high transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-on-surface truncate">{c.name}</p>
                        <div className="flex items-center gap-1 text-on-surface-variant mt-0.5">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <p className="text-xs truncate">{c.company}</p>
                        </div>
                        <StatusPill label={c.status} map={LEAD_STATUS_PILL} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabbed table — 6 cols */}
            <div className="col-span-12 md:col-span-6 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-sm flex flex-col">
              {/* Tab bar */}
              <div className="flex border-b border-outline-variant px-2">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-5 py-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === t.key
                        ? "border-primary text-primary"
                        : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {t.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === t.key ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"
                    }`}>{t.count}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 380 }}>
                {/* Leads tab */}
                {activeTab === "leads" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Name</th>
                        <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Company</th>
                        <th className="text-right py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Deal Value</th>
                        <th className="text-center py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {(data?.leads.length ?? 0) === 0 ? (
                        <tr><td colSpan={4} className="py-12 text-center text-on-surface-variant text-sm">No leads in this period</td></tr>
                      ) : data!.leads.map(l => (
                        <tr key={l.id} className="hover:bg-surface-container-high transition-colors">
                          <td className="py-3 px-4 font-semibold text-on-surface">{l.name}</td>
                          <td className="py-3 px-4 text-on-surface-variant">{l.company}</td>
                          <td className="py-3 px-4 text-right font-bold">
                            {l.amount > 0 ? formatCurrencyCompact(l.amount) : <span className="text-on-surface-variant text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusPill label={l.status} map={LEAD_STATUS_PILL} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Quotes tab */}
                {activeTab === "quotes" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Quote #</th>
                        <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Deal</th>
                        <th className="text-right py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Amount</th>
                        <th className="text-center py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {(data?.quotes.length ?? 0) === 0 ? (
                        <tr><td colSpan={4} className="py-12 text-center text-on-surface-variant text-sm">No quotes in this period</td></tr>
                      ) : data!.quotes.map(q => (
                        <tr key={q.id} className="hover:bg-surface-container-high transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-primary text-xs">{q.quoteNumber}</td>
                          <td className="py-3 px-4 text-on-surface-variant truncate max-w-[140px]">{q.dealName}</td>
                          <td className="py-3 px-4 text-right font-bold">{formatCurrencyCompact(q.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusPill label={q.status} map={QUOTE_STATUS_PILL} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* POs tab */}
                {activeTab === "pos" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">PO Number</th>
                        <th className="text-right py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Amount</th>
                        <th className="text-center py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                        <th className="text-right py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {(data?.purchaseOrders.length ?? 0) === 0 ? (
                        <tr><td colSpan={4} className="py-12 text-center text-on-surface-variant text-sm">No POs in this period</td></tr>
                      ) : data!.purchaseOrders.map(po => (
                        <tr key={po.id} className="hover:bg-surface-container-high transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-primary text-xs">{po.poNumber}</td>
                          <td className="py-3 px-4 text-right font-bold">{formatCurrencyCompact(po.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusPill label={po.status} map={PO_STATUS_PILL} />
                          </td>
                          <td className="py-3 px-4 text-right text-on-surface-variant text-xs">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Lead Conversion widget — 3 cols */}
            <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
              {/* Conversion card */}
              <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-sm p-6 flex-1">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-base text-on-surface">Lead Conversion</h2>
                </div>

                {/* Big percentage ring */}
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-surface-container" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-primary"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min((data?.conversionRate ?? 0) / 100, 1))}`}
                        style={{ transition: "stroke-dashoffset 0.8s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-on-surface">{Math.round(data?.conversionRate ?? 0)}%</span>
                      <span className="text-[10px] text-on-surface-variant font-semibold uppercase">Win Rate</span>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface-variant text-center">
                    Ratio of won deals to all closed deals (won + lost)
                  </p>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-surface-container rounded-lg p-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-on-surface-variant">Won</p>
                    <p className="font-bold text-sm text-on-surface">
                      {data?.clients.length ?? 0}
                    </p>
                  </div>
                  <div className="bg-surface-container rounded-lg p-2">
                    <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-on-surface-variant">Active</p>
                    <p className="font-bold text-sm text-on-surface">
                      {data?.leads.filter(l => l.status === "Qualified").length ?? 0}
                    </p>
                  </div>
                  <div className="bg-surface-container rounded-lg p-2">
                    <Inbox className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-on-surface-variant">New</p>
                    <p className="font-bold text-sm text-on-surface">
                      {data?.leads.filter(l => l.status === "New").length ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick-glance source breakdown */}
              <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-4 h-4 text-secondary" />
                  <h3 className="font-bold text-sm text-on-surface">Lead Sources</h3>
                </div>
                {(data?.leads.length ?? 0) === 0 ? (
                  <p className="text-sm text-on-surface-variant italic">No leads in this period</p>
                ) : (() => {
                  const srcMap: Record<string, number> = {};
                  data!.leads.forEach(l => { srcMap[l.source || "Unknown"] = (srcMap[l.source || "Unknown"] || 0) + 1; });
                  const total = data!.leads.length;
                  return Object.entries(srcMap).slice(0, 4).map(([src, count]) => (
                    <div key={src} className="mb-3">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-on-surface">{src}</span>
                        <span className="text-on-surface-variant">{count}</span>
                      </div>
                      <div className="w-full bg-surface-container rounded-full h-1.5">
                        <div
                          className="bg-secondary h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
