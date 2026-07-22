import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Users, Target, Award,
  TrendingUp, TrendingDown, CheckSquare, Activity, PhoneCall, Video,
  FileText, DollarSign, Zap, Star, AlertTriangle, Clock, CheckCircle2,
  Circle, BarChart2, Plus, Edit2, Lock, Unlock, Save, X, Minus,
  Calendar, MessageSquare, UserPlus, Briefcase, ChevronRight,
  ArrowUpRight, Shield, RefreshCw, Send, Eye, XCircle, Flag,
  HeartPulse, Package, Globe, Hash, Layers
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface KpiTarget {
  id: string;
  kpiName: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  weightage: number;
  effectiveDate: string;
  expiryDate: string;
  notes: string;
  status: string;
  salespersonId: string;
}

interface Rep {
  id: string;
  name: string;
  email?: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  department: string;
  territory: string;
  team: string;
  totalLeads: number;
  totalDeals: number;
  successRate: number;
  purchaseOrders: any[];
  wonClients: any[];
  leadSources: { source: string; count: number }[];
  dealTypes: { stage: string; count: number }[];
  quotes: any[];
  activities: any[];
  wonLeads: any[];
  lostLeads: any[];
  sourceBreakdown: Record<string, { total: number; won: number; winRate: number }>;
  bestFitSuggestion: { source: string | null; winRate: number | null; reason?: string } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function getAchievementPct(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function roleLabel(role: string) {
  return {
    sales_rep: "Sales Executive",
    sales_manager: "Sales Manager",
    admin: "Administrator",
    director: "Director",
  }[role] ?? role;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-600",
  "from-sky-500 to-cyan-600",
];

const STAGE_COLORS: Record<string, string> = {
  New:          "bg-slate-100 text-slate-600",
  Contacted:    "bg-blue-100 text-blue-700",
  Qualified:    "bg-green-100 text-green-700",
  "Meeting/Demo": "bg-purple-100 text-purple-700",
  Proposal:     "bg-orange-100 text-orange-700",
  Negotiation:  "bg-yellow-100 text-yellow-700",
  Won:          "bg-emerald-100 text-emerald-700",
  Lost:         "bg-red-100 text-red-600",
  Draft:        "bg-slate-100 text-slate-500",
  Sent:         "bg-violet-100 text-violet-700",
  Accepted:     "bg-emerald-100 text-emerald-700",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>;
}

function StatusPill({ label }: { label: string }) {
  const cls = STAGE_COLORS[label] ?? "bg-slate-100 text-slate-500";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
}

// Circular progress ring
function ProgressRing({ pct, size = 44, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(100, Math.max(0, pct)) / 100 * circ;
  const cx = size / 2;
  const color = pct >= 90 ? "#10b981" : pct >= 60 ? "#6366f1" : pct >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="transparent" />
      <circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="transparent"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// Linear progress bar
function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const barColor = pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-indigo-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// KPI metric card (used in left panel)
function KpiCard({ kpi }: { kpi: KpiTarget }) {
  const pct = getAchievementPct(kpi.currentValue, kpi.targetValue);
  const pctColor = pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-indigo-600" : pct >= 30 ? "text-amber-600" : "text-red-500";

  const fmtVal = (v: number) => {
    if (kpi.kpiName.includes("%")) return `${v}%`;
    if (["Revenue Closed", "Payment Collection", "Outstanding Collections"].includes(kpi.kpiName))
      return formatCurrencyCompact(v);
    return v.toLocaleString();
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all">
      <div className="relative shrink-0">
        <ProgressRing pct={pct} size={40} stroke={3} />
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black ${pctColor}`}>{pct}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate">{kpi.kpiName}</p>
        <ProgressBar pct={pct} className="mt-1" />
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-extrabold text-slate-900">{fmtVal(kpi.currentValue)}</p>
        <p className="text-[9px] text-slate-400">/{fmtVal(kpi.targetValue)}</p>
      </div>
    </div>
  );
}

// Activity event row
function ActivityRow({ act }: { act: any }) {
  const iconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    call:    { icon: PhoneCall,   color: "text-emerald-600", bg: "bg-emerald-100" },
    meeting: { icon: Video,       color: "text-blue-600",    bg: "bg-blue-100" },
    email:   { icon: Mail,        color: "text-violet-600",  bg: "bg-violet-100" },
    task:    { icon: CheckSquare, color: "text-amber-600",   bg: "bg-amber-100" },
    note:    { icon: FileText,    color: "text-slate-500",   bg: "bg-slate-100" },
  };
  const cfg = iconMap[act.type?.toLowerCase()] ?? { icon: Activity, color: "text-slate-400", bg: "bg-slate-100" };
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 capitalize">{act.type} {act.leadName ? `– ${act.leadName}` : ""}</p>
        {act.outcome && <p className="text-[10px] text-slate-400 italic mt-0.5">{act.outcome}</p>}
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{relativeDate(act.createdAt)}</span>
    </div>
  );
}

// Manager Action button
function ManagerBtn({ icon: Icon, label, color = "bg-white border border-slate-200 text-slate-700", onClick }: {
  icon: React.ElementType; label: string; color?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

// Edit Target Modal (preserved from original)
function EditTargetModal({ kpi, onClose, onSaved }: { kpi: KpiTarget; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ targetValue: kpi.targetValue, frequency: kpi.frequency, weightage: kpi.weightage, notes: kpi.notes || "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const res = await apiClient(`/api/v1/kpis/target/${kpi.id}`, { method: "PUT", body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); setErr(d.error || "Save failed"); }
      else { onSaved(); onClose(); }
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Edit KPI Target</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">{kpi.kpiName}</p>
        {err && <div className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Value</label>
            <input type="number" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: parseFloat(e.target.value) || 0 })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frequency</label>
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-60">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save Target"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab types ─────────────────────────────────────────────────────────────────

type WorkspaceTab = "overview" | "pipeline" | "activities" | "customers" | "kpis";

const TABS: { key: WorkspaceTab; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Overview",    icon: BarChart2 },
  { key: "pipeline",    label: "Pipeline",    icon: Layers },
  { key: "activities",  label: "Activities",  icon: Activity },
  { key: "customers",   label: "Customers",   icon: Users },
  { key: "kpis",        label: "Targets",     icon: Target },
];

// ─── Demo data generators (realistic, seeded from rep name) ──────────────────

function getRepDemoData(rep: Rep) {
  const hash = rep.name.charCodeAt(0) + rep.name.charCodeAt(1);

  const todayTasks = [
    { id: "t1", title: `Follow-up call – ${rep.wonClients[0]?.company || "Apex Industries"}`, priority: "High", done: false, overdue: false },
    { id: "t2", title: `Send revised proposal to ${rep.wonClients[1]?.company || "GreenPack Ltd"}`, priority: "High", done: false, overdue: false },
    { id: "t3", title: "Update pipeline stage – 3 deals", priority: "Medium", done: true, overdue: false },
    { id: "t4", title: "Weekly activity report submission", priority: "Low", done: false, overdue: true },
    { id: "t5", title: `Schedule site visit – ${rep.wonClients[2]?.company || "Metro Chemicals"}`, priority: "Medium", done: false, overdue: false },
  ];

  const todayMeetings = [
    { id: "m1", time: "10:00", client: rep.wonClients[0]?.company || "Apex Industries", type: "Video Call", duration: "45 min" },
    { id: "m2", time: "13:30", client: rep.wonClients[1]?.company || "GreenPack Ltd", type: "On-site", duration: "2 hr" },
    { id: "m3", time: "16:00", client: "Internal Review", type: "Team Meeting", duration: "30 min" },
  ];

  const coachingNotes = [
    { id: "c1", tag: "Strength", text: "Excellent discovery questions – consistently identifies hidden pain points early in the process." },
    { id: "c2", tag: "Improve",  text: "Follow-up cadence slips after proposal stage. Set automated reminders for 3-day follow-up." },
    { id: "c3", tag: "Strength", text: `Strong ${rep.territory} territory knowledge – leverages local manufacturing contacts well.` },
  ];

  const aiInsights = [
    `${rep.name.split(" ")[0]} closes ${rep.territory} deals ${12 + (hash % 10)}% faster than team average.`,
    `${(rep.wonLeads?.length || 2) + 3} opportunities have had no contact in 7+ days — follow-up recommended.`,
    `Based on pipeline velocity, ${rep.name.split(" ")[0]} is on track to achieve ${Math.min(108, 85 + (hash % 25))}% of monthly target.`,
    `Best win rate from "${rep.bestFitSuggestion?.source || "Executive Referral"}" channel at ${rep.bestFitSuggestion?.winRate ?? 64}%.`,
  ];

  const activityHeatmap = [
    { day: "Mon", hours: [0,1,2,3,2,3,4,3,4,5,4,3,2,1,2,3,4,5,4,3,2,1,0,0] },
    { day: "Tue", hours: [0,0,1,2,3,4,5,4,5,4,3,4,3,2,3,4,5,5,4,3,2,1,0,0] },
    { day: "Wed", hours: [0,0,1,1,2,3,2,3,2,3,4,3,2,3,2,3,3,2,3,2,1,1,0,0] },
    { day: "Thu", hours: [0,0,0,1,2,3,4,5,4,5,4,5,4,3,4,5,4,5,4,3,2,1,0,0] },
    { day: "Fri", hours: [0,0,1,2,3,4,5,4,5,4,5,4,3,4,3,4,3,4,3,2,1,0,0,0] },
  ];

  return { todayTasks, todayMeetings, coachingNotes, aiInsights, activityHeatmap };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [editingKpi, setEditingKpi] = useState<KpiTarget | null>(null);
  const [localCap, setLocalCap] = useState(0);
  const [lockState, setLockState] = useState(false);
  const [locking, setLocking] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState<string>("All");
  const [tasksDoneState, setTasksDoneState] = useState<Record<string, boolean>>({});

  const isAdmin = authUser && ["admin", "director", "sales_manager"].includes((authUser as any).role);

  // ── Data fetching ──
  const { data: rep, isLoading, error } = useQuery<Rep>({
    queryKey: ["salespersonPerformance", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/performance`);
      if (!res.ok) throw new Error("Failed to load representative profile");
      return res.json();
    },
    enabled: !!id && !!token,
  });

  const { data: kpiTargets, isLoading: kpiLoading, refetch: refetchKpis } = useQuery<KpiTarget[]>({
    queryKey: ["salespersonKpis", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/kpis`);
      if (!res.ok) throw new Error("Failed to load KPI targets");
      return res.json();
    },
    enabled: !!id && !!token,
  });

  useEffect(() => { if (rep) setLocalCap(rep.maxOpenLeads); }, [rep]);
  useEffect(() => {
    if (kpiTargets?.length) setLockState(kpiTargets.every(t => t.status === "Locked"));
  }, [kpiTargets]);

  const updateCapMutation = useMutation({
    mutationFn: async (cap: number) => {
      const res = await apiClient(`/api/v1/salespersons/${id}/capacity`, { method: "PUT", body: JSON.stringify({ maxOpenLeads: cap }) });
      if (!res.ok) throw new Error("Failed to update capacity");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salespersonPerformance", id] }),
  });

  const handleToggleLock = async () => {
    setLocking(true);
    try {
      await apiClient("/api/v1/kpis/lock", { method: "POST", body: JSON.stringify({ salespersonId: id, status: lockState ? "Active" : "Locked" }) });
      setLockState(v => !v);
      refetchKpis();
    } finally { setLocking(false); }
  };

  // ── Derived metrics ──
  const revTarget = kpiTargets?.find(t => t.kpiName === "Revenue Closed");
  const monthlyAch = kpiTargets?.find(t => t.kpiName === "Monthly Achievement");
  const callsKpi = kpiTargets?.find(t => t.kpiName === "Calls Made");
  const meetingsKpi = kpiTargets?.find(t => t.kpiName === "Meetings Completed");
  const quotesKpi = kpiTargets?.find(t => t.kpiName === "Quotations Sent");
  const perfScore = kpiTargets?.find(t => t.kpiName === "Performance Score");

  const overallPct = useMemo(() => {
    if (!kpiTargets?.length) return 0;
    return Math.round(kpiTargets.reduce((s, t) => s + getAchievementPct(t.currentValue, t.targetValue), 0) / kpiTargets.length);
  }, [kpiTargets]);

  const revPct = revTarget ? getAchievementPct(revTarget.currentValue, revTarget.targetValue) : 0;
  const winRate = Math.round((rep?.successRate ?? 0) * 100);
  const openDeals = (rep?.dealTypes || []).filter(d => !["Won", "Lost"].includes(d.stage)).reduce((s, d) => s + d.count, 0);
  const totalRevenue = revTarget?.currentValue ?? rep?.purchaseOrders?.reduce((s: number, p: any) => s + (p.amount || 0), 0) ?? 0;

  // Pipeline grouped by stage
  const pipelineStages = useMemo(() => {
    const all = (rep?.wonLeads || []).concat(rep?.lostLeads || []);
    const stageMap: Record<string, any[]> = {};
    (rep?.dealTypes || []).forEach(dt => {
      stageMap[dt.stage] = Array.from({ length: dt.count }, (_, i) => ({
        id: `${dt.stage}-${i}`,
        name: rep?.wonClients?.[i]?.company || rep?.wonClients?.[i]?.name || `${dt.stage} Opportunity ${i + 1}`,
        value: Math.round((50000 + Math.random() * 500000) / 1000) * 1000,
        stage: dt.stage,
        probability: { Won: 100, Negotiation: 90, Proposal: 75, "Meeting/Demo": 60, Qualified: 40, Contacted: 20, New: 10, Lost: 0 }[dt.stage] ?? 50,
      }));
    });
    return stageMap;
  }, [rep]);

  const demo = rep ? getRepDemoData(rep) : null;
  const avatarGrad = rep ? AVATAR_GRADIENTS[rep.name.charCodeAt(0) % AVATAR_GRADIENTS.length] : AVATAR_GRADIENTS[0];

  // ── Loading / Error states ──
  if (isLoading) return (
    <div className="flex items-center justify-center h-[calc(100vh-64px)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
    </div>
  );

  if (error || !rep) return (
    <div className="p-8 text-center space-y-4">
      <p className="text-red-500 font-semibold">{error instanceof Error ? error.message : "Could not load representative"}</p>
      <button onClick={() => navigate("/salespersons")} className="flex items-center gap-2 px-4 py-2 border rounded-xl mx-auto hover:bg-slate-50">
        <ArrowLeft className="w-4 h-4" /> Back to Team
      </button>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)]">
      {editingKpi && <EditTargetModal kpi={editingKpi} onClose={() => setEditingKpi(null)} onSaved={() => refetchKpis()} />}

      {/* ─── HERO HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/salespersons")} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span className="cursor-pointer hover:text-indigo-600 font-medium" onClick={() => navigate("/salespersons")}>Team</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-800">{rep.name}</span>
          </div>
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shrink-0`}>
            {getInitials(rep.name)}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-extrabold text-slate-900">{rep.name}</h1>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">{roleLabel(rep.role)}</span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${rep.isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                ● {rep.isAvailable ? "Available" : "Busy"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap mb-3">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{rep.department}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{rep.territory}</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Team {rep.team}</span>
              {rep.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{rep.email}</span>}
            </div>

            {/* Monthly target progress */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-500">Monthly Target Achievement</span>
                  <span className={`text-xs font-extrabold ${revPct >= 90 ? "text-emerald-600" : revPct >= 60 ? "text-indigo-600" : "text-amber-600"}`}>{revPct}%</span>
                </div>
                <ProgressBar pct={revPct} />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{formatCurrencyCompact(totalRevenue)} achieved</span>
                  <span>Target {formatCurrencyCompact(revTarget?.targetValue ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Header KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            {[
              { label: "Revenue Closed", value: formatCurrencyCompact(totalRevenue), icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
              { label: "Open Deals", value: String(openDeals), icon: Target, color: "text-indigo-600 bg-indigo-50" },
              { label: "Win Rate", value: `${winRate}%`, icon: Award, color: "text-violet-600 bg-violet-50" },
              { label: "Leads Assigned", value: String(rep.totalLeads), icon: Users, color: "text-amber-600 bg-amber-50" },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.color}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-slate-900 leading-none">{kpi.value}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 3-COLUMN WORKSPACE ──────────────────────────────────────────────── */}
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 250px)" }}>

        {/* ── LEFT (25%): Profile + Targets ────────────────────────────────── */}
        <div className="w-64 xl:w-72 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-5 space-y-6">

            {/* Profile info */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Profile
              </h3>
              <div className="space-y-3">
                <div><SectionLabel label="Department" /><p className="text-sm font-semibold text-slate-700">{rep.department}</p></div>
                <div><SectionLabel label="Territory" /><p className="text-sm font-semibold text-slate-700">{rep.territory}</p></div>
                <div><SectionLabel label="Team" /><p className="text-sm font-semibold text-slate-700">Team {rep.team}</p></div>
                {rep.email && <div><SectionLabel label="Email" /><p className="text-xs font-mono text-indigo-600 break-all">{rep.email}</p></div>}
                <div><SectionLabel label="Lead Capacity" />
                  <div className="flex items-center gap-2">
                    <button disabled={localCap <= 0} onClick={() => setLocalCap(c => Math.max(0, c - 5))}
                      className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-slate-800">{localCap}</span>
                    <button onClick={() => setLocalCap(c => c + 5)}
                      className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <Plus className="w-3 h-3" />
                    </button>
                    {localCap !== rep.maxOpenLeads && (
                      <button onClick={() => updateCapMutation.mutate(localCap)}
                        className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded-lg font-bold">Save</button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Performance summary */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Performance
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "Revenue Closed", pct: revPct, val: formatCurrencyCompact(totalRevenue) },
                  { label: "Overall KPI Score", pct: overallPct, val: `${overallPct}%` },
                  { label: "Win Rate", pct: winRate, val: `${winRate}%` },
                  { label: "Calls Made", pct: callsKpi ? getAchievementPct(callsKpi.currentValue, callsKpi.targetValue) : 70, val: callsKpi ? `${callsKpi.currentValue}` : "—" },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs text-slate-500 font-semibold">{m.label}</span>
                      <span className="text-xs font-extrabold text-slate-800">{m.val}</span>
                    </div>
                    <ProgressBar pct={m.pct} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Pipeline stage breakdown */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Pipeline Stages
              </h3>
              <div className="space-y-1.5">
                {(rep.dealTypes || []).map(dt => (
                  <div key={dt.stage} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <StatusPill label={dt.stage} />
                    </span>
                    <span className="font-bold text-slate-700">{dt.count}</span>
                  </div>
                ))}
                {!rep.dealTypes?.length && <p className="text-xs text-slate-400 italic">No pipeline data</p>}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Customer portfolio mini */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Key Accounts
              </h3>
              <div className="space-y-2">
                {(rep.wonClients || []).slice(0, 5).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                      {(c.company || c.name || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{c.company || c.name || "Unknown"}</p>
                      <p className="text-[10px] text-slate-400">{c.status}</p>
                    </div>
                  </div>
                ))}
                {!rep.wonClients?.length && <p className="text-xs text-slate-400 italic">No clients yet</p>}
              </div>
            </div>

          </div>
        </div>

        {/* ── CENTER (50%): Tabbed Workspace ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto border-r border-slate-200">

          {/* Tab bar */}
          <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
            <div className="flex items-center overflow-x-auto no-scrollbar px-6">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0 ${activeTab === tab.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6">

            {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
            {activeTab === "overview" && demo && (
              <div className="space-y-6">

                {/* Today's Tasks */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                      Today's Tasks
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                        {demo.todayTasks.filter(t => t.overdue).length} overdue
                      </span>
                    </h3>
                    <button className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold flex items-center gap-1 hover:bg-indigo-700">
                      <Plus className="w-3 h-3" /> Add Task
                    </button>
                  </div>
                  <div className="space-y-2">
                    {demo.todayTasks.map(task => {
                      const done = tasksDoneState[task.id] ?? task.done;
                      return (
                        <div key={task.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${done ? "bg-slate-50 border-slate-100 opacity-60" : task.overdue ? "bg-red-50 border-red-100" : "bg-white border-slate-100 hover:shadow-sm"}`}>
                          <button onClick={() => setTasksDoneState(s => ({ ...s, [task.id]: !done }))}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500" : task.overdue ? "border-red-400" : "border-slate-300 hover:border-indigo-400"}`}>
                            {done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${done ? "line-through text-slate-400" : task.overdue ? "text-red-700" : "text-slate-700"}`}>{task.title}</span>
                          <div className="flex items-center gap-2">
                            {task.overdue && !done && <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><AlertTriangle className="w-3 h-3" />Overdue</span>}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${task.priority === "High" ? "bg-red-100 text-red-600" : task.priority === "Medium" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>{task.priority}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Today's Meetings */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Today's Meetings
                  </h3>
                  <div className="space-y-3">
                    {demo.todayMeetings.map(m => (
                      <div key={m.id} className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-all">
                        <div className="text-center shrink-0 w-12">
                          <p className="text-base font-extrabold text-slate-900">{m.time.split(":")[0]}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">:{m.time.split(":")[1]}</p>
                        </div>
                        <div className="w-0.5 h-10 bg-slate-200 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{m.client}</p>
                          <p className="text-xs text-slate-400">{m.type} · {m.duration}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"><Video className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"><Phone className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-violet-500" />
                    Recent Activity
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{rep.activities?.length || 0}</span>
                  </h3>
                  {(rep.activities || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">No recent activity</p>
                  ) : (
                    <div>
                      {(rep.activities || []).slice(0, 10).map((act: any) => (
                        <ActivityRow key={act.id} act={act} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Heatmap */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-emerald-500" />
                    Activity Heatmap — This Week
                  </h3>
                  <div className="space-y-2">
                    {demo.activityHeatmap.map(row => (
                      <div key={row.day} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-8 shrink-0">{row.day}</span>
                        <div className="flex gap-0.5 flex-1">
                          {row.hours.slice(8, 20).map((val, i) => (
                            <div key={i} className={`flex-1 h-4 rounded-sm transition-all ${val === 0 ? "bg-slate-100" : val <= 2 ? "bg-indigo-200" : val <= 3 ? "bg-indigo-400" : "bg-indigo-600"}`} title={`${8 + i}:00 – ${val} activities`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{row.hours.slice(8, 20).reduce((s, v) => s + v, 0)}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 pt-2 text-[10px] text-slate-400 justify-end">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-100" /> None</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-indigo-200" /> Low</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-indigo-400" /> Medium</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-indigo-600" /> High</div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── PIPELINE TAB ──────────────────────────────────────────────── */}
            {activeTab === "pipeline" && (
              <div className="space-y-5">
                {/* Filter */}
                <div className="flex gap-2 flex-wrap">
                  {["All", ...Object.keys(pipelineStages)].map(stage => (
                    <button key={stage} onClick={() => setPipelineFilter(stage)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${pipelineFilter === stage ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                      {stage}
                    </button>
                  ))}
                </div>

                {/* Stage groups */}
                {Object.entries(pipelineStages).filter(([stage]) => pipelineFilter === "All" || pipelineFilter === stage).map(([stage, deals]) => (
                  <div key={stage} className="bg-white border border-slate-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <StatusPill label={stage} />
                      <span className="text-xs font-bold text-slate-400">{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
                      <span className="text-xs font-bold text-slate-700 ml-auto">
                        {formatCurrencyCompact(deals.reduce((s, d) => s + d.value, 0))} total
                      </span>
                    </div>
                    <div className="space-y-2">
                      {deals.map((deal: any) => (
                        <div key={deal.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{deal.name}</p>
                            <p className="text-xs text-slate-400">Probability: {deal.probability}%</p>
                          </div>
                          <p className="text-sm font-extrabold text-indigo-600 shrink-0">{formatCurrencyCompact(deal.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(pipelineStages).length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No pipeline data available</p>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITIES TAB ────────────────────────────────────────────── */}
            {activeTab === "activities" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-500" />
                    All Activities ({rep.activities?.length || 0})
                  </h3>
                  <button className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold flex items-center gap-1 hover:bg-indigo-700">
                    <Plus className="w-3 h-3" /> Log Activity
                  </button>
                </div>
                {(rep.activities || []).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No activities recorded</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl p-5">
                    {(rep.activities || []).map((act: any) => (
                      <ActivityRow key={act.id} act={act} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOMERS TAB ─────────────────────────────────────────────── */}
            {activeTab === "customers" && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Customer Portfolio ({rep.wonClients?.length || 0})</h3>
                {(rep.wonClients || []).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No customers yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {(rep.wonClients || []).map((c: any, i: number) => {
                      const revenue = Math.round((200000 + Math.random() * 2000000) / 10000) * 10000;
                      return (
                        <div key={c.id || i} className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-all group cursor-pointer">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {(c.company || c.name || "?").charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{c.company || "Unknown Company"}</p>
                              <p className="text-xs text-slate-400 truncate">{c.name}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <StatusPill label={c.status || "Active"} />
                                <span className="text-xs font-bold text-indigo-600">{formatCurrencyCompact(revenue)}</span>
                              </div>
                            </div>
                            <Link to={`/customers`} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 rounded-lg hover:bg-indigo-100">
                              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Won/Lost history */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 mt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Won Deals History</h4>
                  {(rep.wonLeads || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No won deals yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {["Company", "Value", "Source", "Date"].map(h => (
                              <th key={h} className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(rep.wonLeads || []).slice(0, 10).map((l: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-700">{l.company || l.name || "—"}</td>
                              <td className="py-2.5 px-3 font-bold text-emerald-600">{formatCurrencyCompact(l.dealValue || 0)}</td>
                              <td className="py-2.5 px-3 text-slate-400 capitalize">{l.source || "—"}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-400">{l.closeDate ? new Date(l.closeDate).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── KPI TARGETS TAB ───────────────────────────────────────────── */}
            {activeTab === "kpis" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">KPI Targets</h3>
                  {isAdmin && (
                    <button onClick={handleToggleLock} disabled={locking}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${lockState ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      {lockState ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {locking ? "Working…" : lockState ? "Unlock Targets" : "Lock Targets"}
                    </button>
                  )}
                </div>

                {kpiLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (kpiTargets || []).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No KPI targets set</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(kpiTargets || []).map(kpi => (
                      <div key={kpi.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                        <div className="relative shrink-0">
                          <ProgressRing pct={getAchievementPct(kpi.currentValue, kpi.targetValue)} size={40} stroke={3} />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-slate-700">
                            {getAchievementPct(kpi.currentValue, kpi.targetValue)}%
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{kpi.kpiName}</p>
                          <ProgressBar pct={getAchievementPct(kpi.currentValue, kpi.targetValue)} className="mt-1" />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-slate-900">{kpi.currentValue.toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400">/{kpi.targetValue.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded capitalize">{kpi.frequency}</span>
                          {kpi.status === "Locked" && <Lock className="w-3 h-3 text-slate-400" />}
                          {isAdmin && kpi.status !== "Locked" && (
                            <button onClick={() => setEditingKpi(kpi)}
                              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-50 rounded-lg">
                              <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT (25%): Manager Actions + Coaching ───────────────────────── */}
        <div className="w-60 xl:w-64 shrink-0 bg-white overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Manager Actions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Manager Actions</h3>
              <div className="space-y-2">
                <ManagerBtn icon={UserPlus} label="Assign Lead" color="bg-indigo-600 text-white hover:bg-indigo-700" />
                <ManagerBtn icon={Target} label="Edit Targets" color="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setActiveTab("kpis")} />
                <ManagerBtn icon={MessageSquare} label="Send Message" color="bg-white border border-slate-200 text-slate-700" />
                <ManagerBtn icon={Calendar} label="Schedule Review" color="bg-white border border-slate-200 text-slate-700" />
                <ManagerBtn icon={Shield} label="Approve Discount" color="bg-white border border-slate-200 text-slate-700" />
                <ManagerBtn icon={RefreshCw} label="Reassign Lead" color="bg-white border border-slate-200 text-slate-700" />
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Quick Stats */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Stats</h3>
              <div className="space-y-2">
                {[
                  { label: "Total Quotes", val: rep.quotes?.length ?? 0, icon: FileText, color: "text-indigo-600 bg-indigo-50" },
                  { label: "Purchase Orders", val: rep.purchaseOrders?.length ?? 0, icon: Package, color: "text-emerald-600 bg-emerald-50" },
                  { label: "Total Deals", val: rep.totalDeals, icon: Target, color: "text-violet-600 bg-violet-50" },
                  { label: "Leads Assigned", val: rep.totalLeads, icon: Users, color: "text-amber-600 bg-amber-50" },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className={`p-1.5 rounded-lg ${stat.color}`}><stat.icon className="w-3.5 h-3.5" /></div>
                    <span className="text-xs font-semibold text-slate-600 flex-1">{stat.label}</span>
                    <span className="text-sm font-extrabold text-slate-800">{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* AI Insights */}
            {demo && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> AI Insights
                </h3>
                <div className="space-y-2">
                  {demo.aiInsights.map((insight, i) => (
                    <div key={i} className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl text-xs text-slate-700 leading-relaxed">
                      <span className="text-indigo-400 font-bold mr-1">◆</span>
                      {insight}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100" />

            {/* Coaching Notes */}
            {demo && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Coaching Notes
                </h3>
                <div className="space-y-2">
                  {demo.coachingNotes.map(note => (
                    <div key={note.id} className={`p-3 rounded-xl border text-xs leading-relaxed ${note.tag === "Strength" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-amber-50 border-amber-100 text-amber-800"}`}>
                      <span className="font-bold block mb-0.5">{note.tag === "Strength" ? "✓" : "△"} {note.tag}</span>
                      {note.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100" />

            {/* Performance Alert */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Alerts
              </h3>
              <div className="space-y-2">
                {revPct < 60 && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                    <p className="font-bold mb-0.5">⚠ Below Target</p>
                    Revenue at {revPct}% of monthly goal. Intervention needed.
                  </div>
                )}
                {revPct >= 60 && revPct < 90 && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                    <p className="font-bold mb-0.5">◔ On Track</p>
                    {revPct}% achieved. Push for the last stretch.
                  </div>
                )}
                {revPct >= 90 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                    <p className="font-bold mb-0.5">✓ Exceeding Target</p>
                    {revPct}% achieved. On track to overperform!
                  </div>
                )}
                {openDeals === 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    <p className="font-bold mb-0.5">ℹ No Open Deals</p>
                    New leads should be assigned to this rep.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>{/* end 3-col */}
    </div>
  );
}
