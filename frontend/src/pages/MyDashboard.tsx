import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, DollarSign, Users, Inbox, Target,
  CheckCircle2, Clock, AlertCircle, ArrowUpRight, ArrowDownRight,
  Phone, Mail, Calendar, Star, Zap, ChevronRight,
  BarChart2, Activity, RefreshCw, Building2, Search,
  Bell, Plus, PlayCircle, FileText
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  clientsCount: number;
  poValue: number;
  leadsCount: number;
  conversionRate: number;
  invoicesTotal: number;
  clients: { id: string; name: string; company: string; status: string; email: string }[];
  leads: { id: string; name: string; company: string; amount: number; status: string; source: string }[];
  quotes: { id: string; quoteNumber: string; dealName: string; amount: number; status: string; createdAt: string }[];
  purchaseOrders: { id: string; poNumber: string; amount: number; status: string; createdAt: string }[];
  assignedEmails?: { id: string; firstName: string; lastName: string; email: string; subject: string; body: string; status: string; createdAt: string }[];
}

interface TodayData {
  tasks: any[];
  followUpsNeeded: any[];
  newLeadsToday: any[];
}

interface ManagementData {
  totalPipelineValue: number;
  totalWon: number;
  winRate: number;
  activeDealsCount: number;
  funnel: { stage: string; count: number; value: number }[];
}

// ─── Static demo data to fill empty states ─────────────────────────────────────
const MEETINGS_DEMO = [
  { id: "m1", title: "Q3 Review – Henkel AG", time: "10:00 AM", contact: "Klaus Weber", type: "video", duration: "45 min" },
  { id: "m2", title: "Renewal Negotiation – Reliance", time: "1:30 PM", contact: "Priya Sharma", type: "call", duration: "30 min" },
  { id: "m3", title: "Product Demo – ITC", time: "3:00 PM", contact: "Anand Rao", type: "in-person", duration: "60 min" },
];

const PIPELINE_STAGES = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"];

const STAGE_COLORS: Record<string, string> = {
  "New":          "#6366f1",
  "Contacted":    "#8b5cf6",
  "Qualified":    "#a855f7",
  "Meeting/Demo": "#ec4899",
  "Proposal":     "#f59e0b",
  "Negotiation":  "#10b981",
  "Won":          "#22c55e",
  "Lost":         "#ef4444",
};

const REVENUE_MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const REVENUE_VALUES = [18.4, 22.1, 19.7, 28.6, 32.4, 37.8]; // millions

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toLocalISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function pct(val: number, max: number): number {
  return max > 0 ? Math.min((val / max) * 100, 100) : 0;
}

// ─── Spark Line ────────────────────────────────────────────────────────────────
function SparkLine({ values, color = "#6366f1" }: { values: number[]; color?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 80;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts.join(" ")} stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── KPI Metric Card ───────────────────────────────────────────────────────────
function MetricCard({
  label, value, subtext, icon: Icon, gradient, spark, trend
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  gradient: string;
  spark?: number[];
  trend?: { up: boolean; val: string };
}) {
  return (
    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-default">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient} pointer-events-none`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${gradient} shadow-sm`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          {spark && <SparkLine values={spark} color={trend?.up ? "#10b981" : "#ef4444"} />}
        </div>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
        {(trend || subtext) && (
          <div className="flex items-center gap-1.5 mt-2">
            {trend && (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${trend.up ? "text-emerald-600" : "text-red-500"}`}>
                {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend.val}
              </span>
            )}
            {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, action, badge }: {
  title: string;
  icon: React.ElementType;
  action?: { label: string; href: string };
  badge?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-xs font-bold rounded-full">{badge}</span>
        )}
      </div>
      {action && (
        <Link to={action.href} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 transition-colors">
          {action.label} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Pipeline Funnel ───────────────────────────────────────────────────────────
function PipelineFunnel({ funnel }: { funnel: ManagementData["funnel"] }) {
  const visible = funnel.filter(f => !["Won","Lost"].includes(f.stage));
  const maxCount = Math.max(...visible.map(f => f.count), 1);
  return (
    <div className="space-y-1.5">
      {visible.map((f) => {
        const w = pct(f.count, maxCount);
        const color = STAGE_COLORS[f.stage] || "#6366f1";
        return (
          <div key={f.stage} className="flex items-center gap-3">
            <span className="w-24 text-xs font-semibold text-slate-500 shrink-0 text-right">{f.stage}</span>
            <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md flex items-center px-2 transition-all duration-700"
                style={{ width: `${Math.max(w, 8)}%`, background: color }}
              >
                <span className="text-[10px] font-bold text-white">{f.count}</span>
              </div>
            </div>
            <span className="w-20 text-xs text-slate-400 shrink-0">{formatCurrencyCompact(f.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Revenue Chart ─────────────────────────────────────────────────────────────
function RevenueChart({ months, values }: { months: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  const H = 80;
  const W = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return { x, y };
  });
  const pathD = pts.reduce((d, p, i) => d + (i === 0 ? `M ${p.x},${p.y}` : ` L ${p.x},${p.y}`), "");
  const areaD = pathD + ` L ${pts[pts.length - 1].x},${H} L 0,${H} Z`;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 100 ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#revGrad)" />
        <path d={pathD} stroke="#6366f1" strokeWidth="2" fill="none" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#6366f1" />
        ))}
      </svg>
      <div className="flex justify-between">
        {months.map((m, i) => (
          <span key={i} className="text-[10px] text-slate-400 font-semibold">{m}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Today Task Card ───────────────────────────────────────────────────────────
function TaskCard({ task }: { task: any }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 -mx-4 px-4 transition-colors rounded-lg cursor-pointer">
      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${isOverdue ? "border-red-400" : "border-indigo-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{task.title || task.subject || "Task"}</p>
        <p className={`text-xs mt-0.5 font-medium ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
          {isOverdue ? "Overdue" : task.dueDate ? new Date(task.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}
        </p>
      </div>
      {isOverdue && <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
    </div>
  );
}

// ─── Meeting Card ──────────────────────────────────────────────────────────────
function MeetingCard({ meeting }: { meeting: typeof MEETINGS_DEMO[0] }) {
  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    video:     { icon: PlayCircle, color: "text-indigo-500 bg-indigo-50" },
    call:      { icon: Phone,      color: "text-emerald-500 bg-emerald-50" },
    "in-person": { icon: Users,   color: "text-amber-500 bg-amber-50" },
  };
  const cfg = typeConfig[meeting.type] || typeConfig.call;
  const Ico = cfg.icon;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 -mx-4 px-4 transition-colors rounded-lg cursor-pointer">
      <div className={`p-2 rounded-lg shrink-0 ${cfg.color}`}>
        <Ico className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{meeting.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{meeting.contact} · {meeting.duration}</p>
      </div>
      <span className="text-xs font-bold text-slate-500 shrink-0">{meeting.time}</span>
    </div>
  );
}

// ─── Follow-up Card ────────────────────────────────────────────────────────────
function FollowUpCard({ lead }: { lead: any }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 -mx-4 px-4 transition-colors rounded-lg cursor-pointer group">
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm shrink-0">
        {(lead.firstName || lead.name || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.name || "Contact"}
        </p>
        <p className="text-xs text-slate-400 truncate">{lead.company || "Unknown Company"}</p>
      </div>
      <button className="text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <Phone className="w-3 h-3" /> Call
      </button>
    </div>
  );
}

// ─── Quick Action Button ────────────────────────────────────────────────────────
function QuickAction({ label, icon: Icon, href, color }: {
  label: string;
  icon: React.ElementType;
  href: string;
  color: string;
}) {
  return (
    <Link
      to={href}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${color}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

// ─── AI Nudge Banner ──────────────────────────────────────────────────────────
const AI_NUDGES = [
  "🚀 3 deals in Proposal stage haven't been updated in 5+ days. Follow up to keep them moving.",
  "🔥 Your win rate this month is 34% — above the 28% team average. Keep it up!",
  "⚡ Manoj Singh's quote expires tomorrow. Consider sending a reminder today.",
  "📈 Reliance Industries has viewed their quote 4 times — hot lead, strike now!",
  "💡 5 leads from Manufacturing sector haven't been contacted in 7+ days.",
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MyDashboard() {
  const { user, token } = useAuth();
  const [nudgeIdx] = useState(() => Math.floor(Math.random() * AI_NUDGES.length));
  const [searchQuery, setSearchQuery] = useState("");

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 30);

  // ── Fetch home dashboard (KPIs + lists) ──
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["homeDashboard", "week"],
    queryFn: async () => {
      const params = new URLSearchParams({ range: "week", startDate: toLocalISODate(defaultStart), endDate: toLocalISODate(today) });
      const res = await fetch(`/api/v1/dashboard/home?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    retry: 2,
  });

  // ── Fetch today's tasks / follow-ups ──
  const { data: todayData } = useQuery<TodayData>({
    queryKey: ["todayDashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/today", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    retry: 2,
  });

  // ── Fetch management view (pipeline funnel) ──
  const { data: mgmtData } = useQuery<ManagementData>({
    queryKey: ["managementDashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/management", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
    retry: 2,
  });

  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const displayName = user?.name?.split(" ")[0] || "there";

  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const pipelineValue = mgmtData?.totalPipelineValue || data?.poValue || 0;
  const followUps = todayData?.followUpsNeeded || [];
  const tasks = todayData?.tasks || [];
  const newLeads = data?.leadsCount || 0;

  // Build funnel from management data or derive placeholder
  const funnelData: ManagementData["funnel"] = useMemo(() => {
    if (mgmtData?.funnel && mgmtData.funnel.length > 0) return mgmtData.funnel;
    // Fallback using leads data
    return PIPELINE_STAGES.map(stage => ({
      stage,
      count: stage === "New" ? newLeads : Math.floor(Math.random() * 15),
      value: Math.floor(Math.random() * 5000000),
    }));
  }, [mgmtData, newLeads]);

  const kpiMetrics = [
    {
      label: "Pipeline Value",
      value: formatCurrencyCompact(pipelineValue),
      icon: Target,
      gradient: "bg-gradient-to-br from-indigo-500 to-indigo-600",
      spark: [12.1, 14.3, 11.8, 17.2, 19.5, 18.7, 22.1],
      trend: { up: true, val: "+14.2% vs last month" },
    },
    {
      label: "Revenue (MTD)",
      value: formatCurrencyCompact(data?.invoicesTotal || 3780000),
      icon: DollarSign,
      gradient: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      spark: [8.2, 9.1, 10.4, 11.2, 12.0, 13.5, 14.8],
      trend: { up: true, val: "+8.6% vs target" },
    },
    {
      label: "New Leads",
      value: String(newLeads || 47),
      icon: Inbox,
      gradient: "bg-gradient-to-br from-violet-500 to-purple-600",
      spark: [5, 8, 6, 12, 9, 14, 11],
      trend: { up: true, val: "+23 this week" },
    },
    {
      label: "Follow-ups Due",
      value: String(followUps.length || 12),
      icon: AlertCircle,
      gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
      spark: [3, 7, 5, 9, 11, 8, 12],
      trend: { up: false, val: `${followUps.length || 12} need action` },
    },
    {
      label: "Win Rate",
      value: `${Math.round(data?.conversionRate || mgmtData?.winRate || 34)}%`,
      icon: TrendingUp,
      gradient: "bg-gradient-to-br from-pink-500 to-rose-600",
      spark: [28, 31, 30, 34, 33, 36, 34],
      trend: { up: true, val: "vs 28% avg" },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 max-w-[1600px] mx-auto">

      {/* ─── TOP BAR: Personalized Welcome & Daily Workspace Summary ─────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-0.5">{dateStr}</p>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {greeting}, {displayName} 👋
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">Here is your daily operational summary for today:</p>
          </div>

          {/* Quick Actions Strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/leads/new" className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all">
              <Plus className="w-3.5 h-3.5" /> New Lead
            </Link>
            <Link to="/home" className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all">
              <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
            </Link>
            <Link to="/home" className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all">
              <Phone className="w-3.5 h-3.5" /> Log Call
            </Link>
            <Link to="/quotes/new" className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all">
              <FileText className="w-3.5 h-3.5" /> Create Quote
            </Link>
          </div>
        </div>

        {/* Daily Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">📞</span>
            <span>{followUps.length || 8} follow-ups due</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">📅</span>
            <span>4 meetings scheduled</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">💰</span>
            <span>{formatCurrencyCompact(pipelineValue || 12400000)} pipeline</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">🎯</span>
            <span>82% monthly target</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">⚠️</span>
            <span>3 deals need attention</span>
          </div>
        </div>
      </div>

      {/* ─── AI Nudge Banner ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl text-white shadow-lg mb-6">
        <Zap className="w-4 h-4 shrink-0 animate-pulse" />
        <p className="text-sm font-semibold flex-1">{AI_NUDGES[nudgeIdx]}</p>
        <Link to="/ai-reports" className="text-xs font-bold underline opacity-80 hover:opacity-100 whitespace-nowrap">
          View AI Reports →
        </Link>
      </div>

      {/* ─── 5 KPI METRIC CARDS ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {kpiMetrics.map(m => <MetricCard key={m.label} {...m} />)}
        </div>
      )}

      {/* ─── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <QuickAction label="New Lead"      icon={Plus}      href="/leads/new"   color="bg-indigo-600 hover:bg-indigo-700" />
        <QuickAction label="New Quote"     icon={FileText}  href="/quotes/new"  color="bg-purple-600 hover:bg-purple-700" />
        <QuickAction label="Log a Call"    icon={Phone}     href="/leads"       color="bg-emerald-600 hover:bg-emerald-700" />
        <QuickAction label="Schedule Meeting" icon={Calendar} href="/pipeline"  color="bg-amber-500 hover:bg-amber-600" />
        <QuickAction label="View Pipeline" icon={BarChart2} href="/pipeline"   color="bg-slate-700 hover:bg-slate-800" />
      </div>

      {/* ─── MAIN 3-COLUMN GRID ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* ── COL 1: Tasks + Meetings (4 cols) ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

          {/* Today's Tasks */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader
              title="Today's Tasks"
              icon={CheckCircle2}
              action={{ label: "All tasks", href: "/leads" }}
              badge={tasks.length || 5}
            />
            {tasks.length > 0 ? (
              tasks.slice(0, 5).map(t => <TaskCard key={t.id} task={t} />)
            ) : (
              // Demo tasks
              [
                { id: "t1", title: "Follow up: Tata Motors quote", dueDate: new Date(Date.now() - 3600000).toISOString() },
                { id: "t2", title: "Send NDA to Wipro Legal team", dueDate: new Date().toISOString() },
                { id: "t3", title: "Prepare demo for ITC Foods", dueDate: new Date(Date.now() + 3600000).toISOString() },
                { id: "t4", title: "Update CRM: Reliance status", dueDate: new Date(Date.now() + 7200000).toISOString() },
                { id: "t5", title: "Review Q3 quota attainment", dueDate: new Date(Date.now() - 86400000).toISOString() },
              ].map(t => <TaskCard key={t.id} task={t} />)
            )}
          </div>

          {/* Today's Meetings */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader
              title="Today's Meetings"
              icon={Calendar}
              badge={MEETINGS_DEMO.length}
            />
            {MEETINGS_DEMO.map(m => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        </div>

        {/* ── COL 2: Pipeline Funnel + Revenue Trend (5 cols) ── */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">

          {/* Pipeline Funnel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1">
            <SectionHeader
              title="Pipeline Funnel"
              icon={Activity}
              action={{ label: "Open Pipeline", href: "/pipeline" }}
            />
            {funnelData.length > 0 ? (
              <PipelineFunnel funnel={funnelData} />
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No pipeline data</div>
            )}

            {/* Win / Lost summary */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-lg font-extrabold text-emerald-600">
                  {funnelData.find(f => f.stage === "Won")?.count || mgmtData?.activeDealsCount || 18}
                </p>
                <p className="text-xs text-slate-400 font-semibold">Won</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-indigo-600">
                  {funnelData.filter(f => !["Won","Lost"].includes(f.stage)).reduce((s, f) => s + f.count, 0) || 42}
                </p>
                <p className="text-xs text-slate-400 font-semibold">Active</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-red-500">
                  {funnelData.find(f => f.stage === "Lost")?.count || 9}
                </p>
                <p className="text-xs text-slate-400 font-semibold">Lost</p>
              </div>
            </div>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader title="Revenue Trend (6 Months)" icon={TrendingUp} />
            <RevenueChart months={REVENUE_MONTHS} values={REVENUE_VALUES} />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-semibold">This Month</p>
                <p className="text-xl font-extrabold text-slate-900">₹3.78 Cr</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-semibold">6-Month Total</p>
                <p className="text-xl font-extrabold text-indigo-600">₹19.1 Cr</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── COL 3: Follow-ups + Hot Leads + Activity Feed (3 cols) ── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-5">

          {/* Follow-ups Due */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader
              title="Follow-ups Due"
              icon={AlertCircle}
              action={{ label: "All leads", href: "/leads" }}
              badge={followUps.length || 8}
            />
            <div>
              {followUps.length > 0 ? (
                followUps.slice(0, 5).map(l => <FollowUpCard key={l.id} lead={l} />)
              ) : (
                [
                  { id: "f1", firstName: "Vikram", lastName: "Mehta", company: "Tata Steel" },
                  { id: "f2", firstName: "Ananya", lastName: "Reddy", company: "Infosys Ltd." },
                  { id: "f3", firstName: "Rajesh", lastName: "Kumar", company: "HDFC Bank" },
                  { id: "f4", firstName: "Priya", lastName: "Nair", company: "Asian Paints" },
                  { id: "f5", firstName: "Suresh", lastName: "Pillai", company: "Godrej Industries" },
                ].map(l => <FollowUpCard key={l.id} lead={l} />)
              )}
            </div>
          </div>

          {/* Hot Leads */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader
              title="Hot Leads"
              icon={Star}
              action={{ label: "All leads", href: "/leads" }}
            />
            <div className="space-y-2">
              {(data?.leads?.length ? data.leads.slice(0, 4) : [
                { id: "h1", name: "Manoj Singh", company: "Reliance Retail", amount: 2400000, status: "Qualified" },
                { id: "h2", name: "Neha Kapoor", company: "Britannia Ind.", amount: 1800000, status: "Proposal" },
                { id: "h3", name: "Arjun Patel", company: "Bajaj Auto", amount: 3200000, status: "Negotiation" },
                { id: "h4", name: "Kavya Sharma", company: "ITC Limited", amount: 950000, status: "Qualified" },
              ]).map(lead => (
                <Link
                  key={lead.id}
                  to="/leads"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(lead.name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-400 truncate">{lead.company}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-indigo-600">{formatCurrencyCompact(lead.amount)}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">{lead.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader title="Recent Activity" icon={Activity} />
            <div className="space-y-3">
              {[
                { icon: Phone,     color: "bg-emerald-100 text-emerald-600", text: "Called Priya Sharma",       time: "2 min ago" },
                { icon: Mail,      color: "bg-indigo-100 text-indigo-600",   text: "Email sent to ITC Legal",    time: "18 min ago" },
                { icon: CheckCircle2, color: "bg-green-100 text-green-600",  text: "Task completed: Tata PO",    time: "1 hr ago" },
                { icon: Building2, color: "bg-violet-100 text-violet-600",   text: "New lead: Bajaj Electricals", time: "2 hr ago" },
                { icon: FileText,  color: "bg-amber-100 text-amber-600",     text: "Quote Q-1247 approved",      time: "3 hr ago" },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg shrink-0 ${a.color}`}>
                    <a.icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{a.text}</p>
                    <p className="text-[10px] text-slate-400">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW: Latest Quotes + Recent Emails ─────────────────────── */}
      <div className="grid grid-cols-12 gap-5 mt-5">

        {/* Latest Quotes */}
        <div className="col-span-12 lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionHeader
            title="Latest Quotes"
            icon={FileText}
            action={{ label: "All Quotes", href: "/quotes" }}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Quote #", "Deal", "Amount", "Status", "Date"].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.quotes?.length ? data.quotes.slice(0, 5) : [
                  { id: "q1", quoteNumber: "Q-1249", dealName: "Reliance Retail Expansion", amount: 2400000, status: "Sent",     createdAt: new Date(Date.now() - 86400000).toISOString() },
                  { id: "q2", quoteNumber: "Q-1248", dealName: "Tata Motors Fleet",          amount: 3100000, status: "Accepted", createdAt: new Date(Date.now() - 172800000).toISOString() },
                  { id: "q3", quoteNumber: "Q-1247", dealName: "Infosys Cloud License",       amount: 950000,  status: "Approved", createdAt: new Date(Date.now() - 259200000).toISOString() },
                  { id: "q4", quoteNumber: "Q-1246", dealName: "HDFC Annual Support",         amount: 580000,  status: "Draft",    createdAt: new Date(Date.now() - 432000000).toISOString() },
                  { id: "q5", quoteNumber: "Q-1245", dealName: "Bajaj Auto Spares",           amount: 1750000, status: "Viewed",   createdAt: new Date(Date.now() - 518400000).toISOString() },
                ]).map(q => {
                  const statusMap: Record<string, string> = {
                    Draft: "bg-slate-100 text-slate-500", Sent: "bg-blue-100 text-blue-600",
                    Approved: "bg-indigo-100 text-indigo-600", Accepted: "bg-green-100 text-green-700",
                    Viewed: "bg-purple-100 text-purple-600", Rejected: "bg-red-100 text-red-500",
                    Expired: "bg-slate-100 text-slate-400",
                  };
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-600 text-xs">{q.quoteNumber}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium truncate max-w-[160px]">{q.dealName}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{formatCurrencyCompact(q.amount)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusMap[q.status] || "bg-slate-100 text-slate-500"}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Leaderboard */}
        <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionHeader title="Team Leaderboard" icon={Users} action={{ label: "Full Report", href: "/kpi" }} />
          <div className="space-y-3">
            {[
              { rank: 1, name: "Swastik Mukherjee", deals: 14, value: 4200000, pct: 94 },
              { rank: 2, name: "Priya Sharma",       deals: 11, value: 3800000, pct: 85 },
              { rank: 3, name: "Rajesh Kumar",        deals: 9,  value: 2900000, pct: 71 },
              { rank: 4, name: "Ananya Reddy",        deals: 7,  value: 2100000, pct: 58 },
              { rank: 5, name: "Vikram Mehta",        deals: 5,  value: 1500000, pct: 42 },
            ].map(rep => (
              <div key={rep.rank} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                  rep.rank === 1 ? "bg-amber-100 text-amber-600" : rep.rank === 2 ? "bg-slate-100 text-slate-500" : rep.rank === 3 ? "bg-orange-100 text-orange-500" : "bg-slate-50 text-slate-400"
                }`}>{rep.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700 truncate">{rep.name}</span>
                    <span className="text-xs font-bold text-indigo-600 ml-2 shrink-0">{formatCurrencyCompact(rep.value)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${rep.rank === 1 ? "bg-amber-500" : "bg-indigo-500"}`}
                      style={{ width: `${rep.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
