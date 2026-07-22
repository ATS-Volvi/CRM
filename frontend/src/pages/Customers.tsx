import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Search, Users, Phone, Mail, Building2, MapPin, Globe, Briefcase,
  ChevronRight, FileText, Receipt, Calendar, DollarSign, Star, Tag,
  CheckCircle2, Clock, AlertCircle, MessageSquare, Upload, UserPlus,
  BarChart2, Activity, ArrowUpRight, Zap, Factory, Package, Target,
  TrendingUp, HeartPulse, Shield, ChevronDown, Plus, Download,
  ExternalLink, RefreshCw, MoreHorizontal, Circle, CheckSquare,
  PhoneCall, Video, Inbox, PenLine, Layers, Hash
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CustomerDetail {
  id: string;
  name: string;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  leads: any[];
  deals: any[];
  quotes: any[];
  invoices: any[];
  purchaseOrders: any[];
  activities: any[];
  callLogs: any[];
  meetings: any[];
  tasks: any[];
  documents: any[];
  emailMessages: any[];
  lifetimeRevenue: number;
  pipelineValue: number;
  openDealsCount: number;
  wonDealsCount: number;
  createdAt?: string;
}

// ─── Timeline Event Types ───────────────────────────────────────────────────────
type EventType = "call" | "meeting" | "email" | "task" | "quote" | "invoice" | "deal" | "note" | "created";

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  date: Date;
  user?: string;
  outcome?: string;
}

// ─── Icon map for event types ───────────────────────────────────────────────────
const EVENT_CONFIG: Record<EventType, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  call:     { icon: PhoneCall,   bg: "bg-emerald-100",  text: "text-emerald-600", label: "Call" },
  meeting:  { icon: Video,       bg: "bg-blue-100",     text: "text-blue-600",    label: "Meeting" },
  email:    { icon: Mail,        bg: "bg-violet-100",   text: "text-violet-600",  label: "Email" },
  task:     { icon: CheckSquare, bg: "bg-amber-100",    text: "text-amber-600",   label: "Task" },
  quote:    { icon: FileText,    bg: "bg-indigo-100",   text: "text-indigo-600",  label: "Quote" },
  invoice:  { icon: Receipt,     bg: "bg-pink-100",     text: "text-pink-600",    label: "Invoice" },
  deal:     { icon: Target,      bg: "bg-orange-100",   text: "text-orange-600",  label: "Deal" },
  note:     { icon: PenLine,     bg: "bg-slate-100",    text: "text-slate-500",   label: "Note" },
  created:  { icon: Star,        bg: "bg-yellow-100",   text: "text-yellow-600",  label: "Created" },
};

// ─── Status pill colors ─────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Won:          "bg-emerald-100 text-emerald-700",
  Active:       "bg-blue-100 text-blue-700",
  New:          "bg-indigo-100 text-indigo-700",
  Qualified:    "bg-green-100 text-green-700",
  Lost:         "bg-red-100 text-red-600",
  Accepted:     "bg-emerald-100 text-emerald-700",
  Approved:     "bg-blue-100 text-blue-700",
  Sent:         "bg-violet-100 text-violet-700",
  Draft:        "bg-slate-100 text-slate-500",
  Pending:      "bg-amber-100 text-amber-700",
  Completed:    "bg-emerald-100 text-emerald-700",
  Overdue:      "bg-red-100 text-red-600",
  Proposal:     "bg-orange-100 text-orange-700",
  Negotiation:  "bg-yellow-100 text-yellow-700",
  "Meeting/Demo": "bg-purple-100 text-purple-700",
};

function StatusPill({ label }: { label: string }) {
  const cls = STATUS_COLORS[label] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────────
type Tab = "timeline" | "tasks" | "calls" | "meetings" | "deals" | "documents" | "quotes" | "invoices" | "analytics";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "timeline",  label: "Timeline",   icon: Activity },
  { key: "tasks",     label: "Tasks",      icon: CheckSquare },
  { key: "calls",     label: "Calls",      icon: PhoneCall },
  { key: "meetings",  label: "Meetings",   icon: Video },
  { key: "deals",     label: "Deals",      icon: Target },
  { key: "documents", label: "Documents",  icon: FileText },
  { key: "quotes",    label: "Quotes",     icon: PenLine },
  { key: "invoices",  label: "Invoices",   icon: Receipt },
  { key: "analytics", label: "Analytics",  icon: BarChart2 },
];

// ─── Health Score calculation ────────────────────────────────────────────────────
function calcHealthScore(c: CustomerDetail): number {
  let score = 60;
  if ((c.lifetimeRevenue || 0) > 1000000) score += 10;
  if ((c.openDealsCount || 0) > 0) score += 5;
  if ((c.activities?.length || 0) > 5) score += 10;
  if ((c.wonDealsCount || 0) > 0) score += 10;
  if ((c.callLogs?.length || 0) > 2) score += 5;
  return Math.min(score, 99);
}

// ─── Section label ──────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
  );
}

function InfoRow({ label, value, icon: Icon, mono }: { label: string; value: string | null; icon?: React.ElementType; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel label={label} />
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        <span className={`text-sm text-slate-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      </div>
    </div>
  );
}

// ─── Timeline Item ──────────────────────────────────────────────────────────────
function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;
  const relDate = getRelativeDate(event.date);

  return (
    <div className="flex gap-3">
      {/* Connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} border-2 border-white shadow-sm shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-100 mt-1" />}
      </div>

      {/* Content */}
      <div className={`pb-5 flex-1 min-w-0 ${isLast ? "" : ""}`}>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
              {event.status && <StatusPill label={event.status} />}
            </div>
            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{relDate}</span>
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">{event.title}</p>
          {event.subtitle && <p className="text-xs text-slate-500 mt-0.5">{event.subtitle}</p>}
          {event.amount && event.amount > 0 && (
            <p className="text-sm font-bold text-indigo-600 mt-1">{formatCurrency(event.amount)}</p>
          )}
          {event.outcome && (
            <p className="text-xs mt-1 text-slate-500 italic">Outcome: {event.outcome}</p>
          )}
          {event.user && (
            <div className="flex items-center gap-1 mt-2">
              <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                {event.user.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-slate-400">{event.user}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getRelativeDate(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function groupByDate(events: TimelineEvent[]): { label: string; events: TimelineEvent[] }[] {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const label = getRelativeDate(e.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }
  return Object.entries(groups).map(([label, events]) => ({ label, events }));
}

// ─── Quick Action Button ─────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType; label: string; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${color}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

// ─── Mini Stat Card ──────────────────────────────────────────────────────────────
function MiniStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color} bg-opacity-10`}>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Customer List Item ──────────────────────────────────────────────────────────
function CustomerListItem({ c, selected, onClick }: { c: any; selected: boolean; onClick: () => void }) {
  const initial = (c.name || "?").charAt(0).toUpperCase();
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-sky-500"];
  const colorCls = colors[c.name.charCodeAt(0) % colors.length];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all hover:bg-slate-50 ${selected ? "bg-indigo-50 border-l-[3px] border-indigo-500" : "border-l-[3px] border-transparent"}`}
    >
      <div className={`w-9 h-9 rounded-full ${colorCls} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${selected ? "text-indigo-700" : "text-slate-800"}`}>{c.name}</p>
        <p className="text-xs text-slate-400 truncate">{c.primaryContactName || c.industry || "—"}</p>
      </div>
      {c.industry && (
        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold shrink-0 hidden lg:block">
          {c.industry.split(" ")[0]}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────
export default function Customers() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);

  // ── Fetch customer list ──
  const { data: customers, isLoading: listLoading } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/customers", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  // ── Fetch selected customer 360 data ──
  const { data: c, isLoading: detailLoading } = useQuery<CustomerDetail>({
    queryKey: ["customer360", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/customers/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch customer");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const filtered = useMemo(() =>
    (customers || []).filter(cu => {
      const q = searchQuery.toLowerCase();
      return !q || cu.name?.toLowerCase().includes(q) ||
        (cu.primaryContactName || "").toLowerCase().includes(q) ||
        (cu.industry || "").toLowerCase().includes(q) ||
        (cu.email || "").toLowerCase().includes(q);
    }),
    [customers, searchQuery]
  );

  // ── Build unified timeline from all event sources ──
  const timeline: TimelineEvent[] = useMemo(() => {
    if (!c) return [];
    const events: TimelineEvent[] = [];

    // Customer created event
    if (c.createdAt) {
      events.push({ id: "created", type: "created", title: `${c.name} added to CRM`, date: new Date(c.createdAt) });
    }

    // Activities (calls, meetings, notes, tasks from leads)
    (c.activities || []).forEach((a: any) => {
      const type: EventType = a.type === "call" ? "call" : a.type === "meeting" ? "meeting" : a.type === "note" ? "note" : a.type === "email" ? "email" : "task";
      events.push({
        id: a.id, type, title: a.subject || a.title || `${a.type} logged`,
        subtitle: a.description || a.body || undefined,
        date: new Date(a.createdAt),
        user: a.userName || undefined,
        outcome: a.outcome || undefined,
      });
    });

    // Call logs
    (c.callLogs || []).forEach((cl: any) => {
      events.push({
        id: `cl-${cl.id}`, type: "call",
        title: cl.subject || `Call – ${cl.duration ? `${cl.duration} min` : ""}`,
        subtitle: cl.notes || cl.outcome || undefined,
        date: new Date(cl.createdAt),
        user: cl.userName || undefined,
        outcome: cl.outcome || undefined,
      });
    });

    // Meetings
    (c.meetings || []).forEach((m: any) => {
      events.push({
        id: `m-${m.id}`, type: "meeting",
        title: m.title || m.subject || "Meeting",
        subtitle: m.description || m.agenda || undefined,
        date: new Date(m.scheduledAt || m.createdAt),
        user: m.userName || undefined,
      });
    });

    // Email messages
    (c.emailMessages || []).forEach((em: any) => {
      events.push({
        id: `em-${em.id}`, type: "email",
        title: em.subject || "Email",
        subtitle: em.preview || em.body?.substring(0, 80) || undefined,
        date: new Date(em.createdAt),
      });
    });

    // Quotes
    (c.quotes || []).forEach((q: any) => {
      events.push({
        id: `q-${q.id}`, type: "quote",
        title: `Quote ${q.quoteNumber || q.id?.substring(0, 8)} – ${q.deal?.name || c.name}`,
        amount: parseFloat(q.totalAmount) || 0,
        status: q.status,
        date: new Date(q.createdAt),
      });
    });

    // Invoices
    (c.invoices || []).forEach((inv: any) => {
      events.push({
        id: `inv-${inv.id}`, type: "invoice",
        title: `Invoice ${inv.invoiceNumber || inv.id?.substring(0, 8)}`,
        amount: parseFloat(inv.totalAmount || inv.amount) || 0,
        status: inv.status,
        date: new Date(inv.createdAt),
      });
    });

    // Deals
    (c.deals || []).forEach((d: any) => {
      events.push({
        id: `d-${d.id}`, type: "deal",
        title: d.name || `Deal`,
        subtitle: d.stage?.name ? `Stage: ${d.stage.name}` : undefined,
        amount: parseFloat(d.amount) || 0,
        status: d.stage?.name,
        date: new Date(d.createdAt),
      });
    });

    // Sort newest first
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [c]);

  const healthScore = c ? calcHealthScore(c) : 0;
  const healthLabel = healthScore >= 85 ? "Excellent" : healthScore >= 70 ? "Good" : healthScore >= 50 ? "Fair" : "At Risk";
  const healthColor = healthScore >= 85 ? "text-emerald-600" : healthScore >= 70 ? "text-blue-600" : healthScore >= 50 ? "text-amber-600" : "text-red-600";
  const healthBg = healthScore >= 85 ? "bg-emerald-500" : healthScore >= 70 ? "bg-blue-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500";

  // Initial for avatar
  const initial = c ? c.name.charAt(0).toUpperCase() : "?";
  const avatarColors = ["from-indigo-500 to-purple-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-pink-500 to-rose-600"];
  const avatarGradient = c ? avatarColors[c.name.charCodeAt(0) % avatarColors.length] : avatarColors[0];

  // Tab badge counts
  const tabCounts: Partial<Record<Tab, number>> = {
    tasks: c?.tasks?.length || 0,
    calls: (c?.callLogs?.length || 0) + (c?.activities?.filter((a: any) => a.type === "call")?.length || 0),
    meetings: c?.meetings?.length || 0,
    deals: c?.deals?.length || 0,
    documents: c?.documents?.length || 0,
    quotes: c?.quotes?.length || 0,
    invoices: c?.invoices?.length || 0,
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">

      {/* ─── LEFT SIDEBAR: Customer List ─────────────────────────────────── */}
      <div className="w-72 xl:w-80 border-r border-slate-200 flex flex-col bg-white shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Customers
              {customers && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{customers.length}</span>}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {listLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No customers found</div>
          ) : (
            filtered.map(cu => (
              <CustomerListItem
                key={cu.id}
                c={cu}
                selected={selectedId === cu.id}
                onClick={() => { setSearchParams({ id: cu.id }); setActiveTab("timeline"); }}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── MAIN AREA: Customer 360 ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Users className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Select a Customer</h3>
            <p className="text-sm text-slate-400 max-w-xs">Click any customer on the left to open their full 360° workspace — timeline, deals, analytics and more.</p>
          </div>
        ) : detailLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-40 bg-white rounded-2xl animate-pulse border border-slate-100" />
            <div className="h-12 bg-white rounded-2xl animate-pulse border border-slate-100" />
            <div className="h-64 bg-white rounded-2xl animate-pulse border border-slate-100" />
          </div>
        ) : c ? (
          <div>
            {/* ─── HERO HEADER ────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
              <div className="flex items-start gap-6 flex-wrap">
                {/* Avatar */}
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shrink-0`}>
                  {initial}
                </div>

                {/* Core Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{c.name}</h1>
                    {c.industry && (
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">{c.industry}</span>
                    )}
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> VIP Account
                    </span>
                  </div>
                  {c.primaryContactName && (
                    <p className="text-sm text-slate-500 mb-2">Primary Contact: <span className="font-semibold text-slate-700">{c.primaryContactName}</span></p>
                  )}

                  {/* KPI Pills row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span className="font-extrabold text-emerald-700">{formatCurrencyCompact(c.lifetimeRevenue || 0)}</span>
                      <span className="text-slate-400 text-xs">Lifetime Revenue</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-sm">
                      <Target className="w-4 h-4 text-indigo-500" />
                      <span className="font-extrabold text-slate-800">{c.openDealsCount || 0}</span>
                      <span className="text-slate-400 text-xs">Open Deals</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-extrabold text-slate-800">{c.wonDealsCount || 0}</span>
                      <span className="text-slate-400 text-xs">Won Deals</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-sm">
                      <HeartPulse className="w-4 h-4 text-pink-500" />
                      <span className={`font-extrabold ${healthColor}`}>{healthScore}%</span>
                      <span className="text-slate-400 text-xs">Health Score</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-sm">
                      <Activity className="w-4 h-4 text-violet-500" />
                      <span className="font-extrabold text-slate-800">{timeline.length}</span>
                      <span className="text-slate-400 text-xs">Interactions</span>
                    </div>
                  </div>
                </div>

                {/* Quick action buttons (header row) */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {[
                    { icon: PhoneCall, label: "Call",    bg: "bg-emerald-600 hover:bg-emerald-700 text-white" },
                    { icon: Mail,      label: "Email",   bg: "bg-indigo-600 hover:bg-indigo-700 text-white" },
                    { icon: Calendar,  label: "Meeting", bg: "bg-violet-600 hover:bg-violet-700 text-white" },
                    { icon: FileText,  label: "Quote",   bg: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm" },
                  ].map(btn => (
                    <button key={btn.label} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 ${btn.bg}`}>
                      <btn.icon className="w-3.5 h-3.5" />
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── MAIN 3-COLUMN WORKSPACE ──────────────────────────────── */}
            <div className="flex gap-0 min-h-0">

              {/* ── LEFT (25%): Profile Panel ────────────────────────────── */}
              <div className="w-64 xl:w-72 shrink-0 border-r border-slate-200 bg-white overflow-y-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
                <div className="p-5 space-y-6">

                  {/* Contact Info */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Contact Info
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Phone" value={c.phone} icon={Phone} mono />
                      <InfoRow label="Email" value={c.email} icon={Mail} mono />
                      <InfoRow label="Address" value={c.address} icon={MapPin} />
                      <InfoRow label="Industry" value={c.industry} icon={Briefcase} />
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Business Info (Manufacturing focus) */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5" /> Account Overview
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <SectionLabel label="Customer Since" />
                        <span className="text-sm font-medium text-slate-800">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Jan 2024"}
                        </span>
                      </div>
                      <div>
                        <SectionLabel label="Annual Contract Value" />
                        <span className="text-sm font-bold text-indigo-600">{formatCurrencyCompact(c.pipelineValue || c.lifetimeRevenue || 0)}</span>
                      </div>
                      <div>
                        <SectionLabel label="Open Opportunities" />
                        <span className="text-sm font-bold text-slate-800">{c.openDealsCount || 0}</span>
                      </div>
                      <div>
                        <SectionLabel label="Products Purchased" />
                        <span className="text-sm font-medium text-slate-800">{c.invoices?.length || 0} invoices raised</span>
                      </div>
                      <div>
                        <SectionLabel label="Last Contact" />
                        <span className="text-sm font-medium text-slate-800">
                          {timeline[0] ? getRelativeDate(timeline[0].date) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Related Contacts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Related Contacts
                    </h3>
                    <div className="space-y-2">
                      {(c.leads?.slice(0, 3) || []).map((lead: any) => (
                        <div key={lead.id} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                            {(lead.firstName || "?").charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{lead.firstName} {lead.lastName}</p>
                            <p className="text-[10px] text-slate-400">{lead.status}</p>
                          </div>
                        </div>
                      ))}
                      {!c.leads?.length && (
                        <p className="text-xs text-slate-400 italic">No contacts linked</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Customer Health Card */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5" /> Customer Health
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-3xl font-extrabold ${healthColor}`}>{healthScore}%</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${healthScore >= 85 ? "bg-emerald-100 text-emerald-700" : healthScore >= 70 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {healthLabel}
                      </span>
                    </div>
                    {/* Health bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-700 ${healthBg}`} style={{ width: `${healthScore}%` }} />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { label: "Last Contact", val: timeline[0] ? getRelativeDate(timeline[0].date) : "—" },
                        { label: "Engagement",   val: `${Math.min((timeline.length || 0) * 5, 99)}%` },
                        { label: "Renewal Risk", val: c.openDealsCount > 0 ? "Low" : "Medium" },
                        { label: "Response Rate", val: "97%" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between">
                          <span className="text-slate-400 font-medium">{r.label}</span>
                          <span className="font-bold text-slate-700">{r.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <SectionLabel label="Tags" />
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["Enterprise", c.industry || "B2B", "Active", "High Value"].map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-semibold border border-indigo-100">{tag}</span>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ── CENTER (50%): Tabs + Content ─────────────────────────── */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
                {/* Tab Bar */}
                <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
                  <div className="flex items-center overflow-x-auto no-scrollbar px-6">
                    {TABS.map(tab => {
                      const count = tabCounts[tab.key];
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                            activeTab === tab.key
                              ? "border-indigo-500 text-indigo-600"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {tab.label}
                          {count !== undefined && count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">

                  {/* ── TIMELINE TAB ─────────────────────────────────────── */}
                  {activeTab === "timeline" && (
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-500" />
                          Activity Timeline
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{timeline.length}</span>
                        </h3>
                        <div className="flex gap-2">
                          <button className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            Filter
                          </button>
                          <button className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Log Activity
                          </button>
                        </div>
                      </div>

                      {timeline.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-semibold">No activity yet</p>
                        </div>
                      ) : (
                        <div>
                          {timeline.map((event, idx) => (
                            <TimelineItem key={event.id} event={event} isLast={idx === timeline.length - 1} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TASKS TAB ──────────────────────────────────────────── */}
                  {activeTab === "tasks" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tasks</h3>
                        <button onClick={() => setShowNewTask(!showNewTask)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> New Task
                        </button>
                      </div>

                      {showNewTask && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            placeholder="Task title..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Add</button>
                        </div>
                      )}

                      {(c.tasks?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No tasks for this customer</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {c.tasks.map((task: any) => {
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.isCompleted;
                            return (
                              <div key={task.id} className="flex items-start gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                                <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${task.isCompleted ? "bg-emerald-500 border-emerald-500" : isOverdue ? "border-red-400" : "border-slate-300"}`}>
                                  {task.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold ${task.isCompleted ? "line-through text-slate-400" : "text-slate-800"}`}>{task.title}</p>
                                  {task.dueDate && <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}>{isOverdue ? "Overdue – " : "Due "}{new Date(task.dueDate).toLocaleDateString()}</p>}
                                </div>
                                {task.priority && <StatusPill label={task.priority} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CALLS TAB ─────────────────────────────────────────── */}
                  {activeTab === "calls" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Call History</h3>
                        <button className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                          <PhoneCall className="w-3 h-3" /> Log Call
                        </button>
                      </div>
                      {(c.callLogs?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <PhoneCall className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No call logs yet</p>
                        </div>
                      ) : c.callLogs.map((cl: any) => (
                        <div key={cl.id} className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                                <PhoneCall className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{cl.subject || "Call"}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{cl.duration ? `${cl.duration} min` : ""} {cl.outcome || ""}</p>
                                {cl.notes && <p className="text-xs text-slate-500 mt-1 italic">{cl.notes}</p>}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(cl.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── MEETINGS TAB ──────────────────────────────────────── */}
                  {activeTab === "meetings" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Meetings</h3>
                        <button className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Schedule
                        </button>
                      </div>
                      {(c.meetings?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No meetings scheduled</p>
                        </div>
                      ) : c.meetings.map((m: any) => (
                        <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                              <Video className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800">{m.title || "Meeting"}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "—"}</p>
                              {m.description && <p className="text-xs text-slate-500 mt-1">{m.description}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── DEALS TAB ─────────────────────────────────────────── */}
                  {activeTab === "deals" && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Deal Pipeline</h3>
                      {(c.deals?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No deals found</p>
                        </div>
                      ) : c.deals.map((d: any) => (
                        <div key={d.id} className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{d.name || "Deal"}</p>
                              {d.stage && <StatusPill label={d.stage.name} />}
                            </div>
                            <p className="text-lg font-extrabold text-indigo-600 shrink-0">{formatCurrencyCompact(parseFloat(d.amount) || 0)}</p>
                          </div>
                          {d.stage && (
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${d.stage.probability || 0}%` }}
                              />
                            </div>
                          )}
                          <div className="flex justify-between mt-2 text-xs text-slate-400">
                            <span>Probability: {d.stage?.probability || 0}%</span>
                            <span>{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── DOCUMENTS TAB ─────────────────────────────────────── */}
                  {activeTab === "documents" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Documents</h3>
                        <button className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                          <Upload className="w-3 h-3" /> Upload
                        </button>
                      </div>
                      {(c.documents?.length || 0) === 0 ? (
                        <div>
                          <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-400 hover:border-indigo-300 transition-colors cursor-pointer">
                            <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-semibold">Drop files here or click to upload</p>
                            <p className="text-xs mt-1">PDF, DOCX, XLSX up to 20MB</p>
                          </div>
                          {/* Demo documents */}
                          <div className="mt-4 space-y-2">
                            {[
                              { name: "Safety_Audit_Q3_2025.pdf", size: "2.4 MB", date: "Jul 10, 2025", type: "PDF" },
                              { name: "Factory_Layout_Map.dwg",   size: "8.1 MB", date: "Jun 22, 2025", type: "DWG" },
                              { name: "NDA_Signed_2024.pdf",       size: "0.8 MB", date: "Jan 15, 2024", type: "PDF" },
                              { name: "Product_Spec_Sheet.xlsx",   size: "1.2 MB", date: "May 30, 2025", type: "XLS" },
                            ].map(doc => (
                              <div key={doc.name} className="flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${
                                  doc.type === "PDF" ? "bg-red-100 text-red-600" : doc.type === "XLS" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                                }`}>{doc.type}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{doc.name}</p>
                                  <p className="text-xs text-slate-400">{doc.size} · {doc.date}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><Download className="w-3.5 h-3.5 text-slate-500" /></button>
                                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ExternalLink className="w-3.5 h-3.5 text-slate-500" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        c.documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all">
                            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{doc.fileName || doc.title || "Document"}</p>
                              <p className="text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ── QUOTES TAB ────────────────────────────────────────── */}
                  {activeTab === "quotes" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quotations</h3>
                        <Link to="/quotes/new" className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> New Quote
                        </Link>
                      </div>
                      {(c.quotes?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <PenLine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No quotes yet</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100">
                                {["Quote #", "Deal", "Amount", "Status", "Date"].map(h => (
                                  <th key={h} className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {c.quotes.map((q: any) => (
                                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-3 font-mono font-bold text-indigo-600 text-xs">{q.quoteNumber || q.id?.substring(0, 8)}</td>
                                  <td className="py-3 px-3 text-slate-700">{q.deal?.name || "—"}</td>
                                  <td className="py-3 px-3 font-bold text-slate-900">{formatCurrencyCompact(parseFloat(q.totalAmount) || 0)}</td>
                                  <td className="py-3 px-3"><StatusPill label={q.status} /></td>
                                  <td className="py-3 px-3 text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── INVOICES TAB ──────────────────────────────────────── */}
                  {activeTab === "invoices" && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Invoices</h3>
                      {(c.invoices?.length || 0) === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No invoices yet</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100">
                                {["Invoice #", "Amount", "Status", "Date"].map(h => (
                                  <th key={h} className="text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {c.invoices.map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-3 font-mono text-xs font-bold text-indigo-600">{inv.invoiceNumber || inv.id?.substring(0, 8)}</td>
                                  <td className="py-3 px-3 font-bold text-slate-900">{formatCurrencyCompact(parseFloat(inv.totalAmount || inv.amount) || 0)}</td>
                                  <td className="py-3 px-3"><StatusPill label={inv.status || "Issued"} /></td>
                                  <td className="py-3 px-3 text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ANALYTICS TAB ─────────────────────────────────────── */}
                  {activeTab === "analytics" && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Account Analytics</h3>

                      {/* Key metrics grid */}
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        <MiniStat label="Lifetime Revenue" value={formatCurrencyCompact(c.lifetimeRevenue || 0)} color="bg-emerald-500" />
                        <MiniStat label="Pipeline Value" value={formatCurrencyCompact(c.pipelineValue || 0)} color="bg-indigo-500" />
                        <MiniStat label="Total Interactions" value={String(timeline.length)} sub="calls, meetings, emails" color="bg-violet-500" />
                        <MiniStat label="Win Rate" value={c.wonDealsCount > 0 ? `${Math.round((c.wonDealsCount / Math.max(c.deals?.length, 1)) * 100)}%` : "—"} color="bg-amber-500" />
                      </div>

                      {/* Revenue breakdown */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Deal Stage Breakdown</h4>
                        <div className="space-y-2">
                          {["Won", "Proposal", "Negotiation", "Qualified", "Lost"].map(stage => {
                            const stageDeals = (c.deals || []).filter((d: any) => d.stage?.name === stage);
                            const stageValue = stageDeals.reduce((s: number, d: any) => s + (parseFloat(d.amount) || 0), 0);
                            const maxValue = Math.max(...["Won", "Proposal", "Negotiation", "Qualified", "Lost"].map(s =>
                              (c.deals || []).filter((d: any) => d.stage?.name === s).reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0)
                            ), 1);
                            if (stageDeals.length === 0) return null;
                            return (
                              <div key={stage} className="flex items-center gap-3">
                                <span className="w-20 text-xs text-slate-500 font-semibold text-right">{stage}</span>
                                <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-md flex items-center px-2 transition-all duration-700"
                                    style={{ width: `${Math.max((stageValue / maxValue) * 100, 5)}%` }}>
                                    <span className="text-[10px] font-bold text-white">{stageDeals.length}</span>
                                  </div>
                                </div>
                                <span className="w-24 text-xs text-slate-400 shrink-0">{formatCurrencyCompact(stageValue)}</span>
                              </div>
                            );
                          }).filter(Boolean)}
                          {c.deals?.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No deal data available</p>}
                        </div>
                      </div>

                      {/* Communication stats */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Communication Breakdown</h4>
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                          {[
                            { label: "Calls",    count: (c.callLogs?.length || 0) + (c.activities?.filter((a: any) => a.type === "call")?.length || 0), icon: PhoneCall, color: "text-emerald-600 bg-emerald-100" },
                            { label: "Meetings", count: c.meetings?.length || 0, icon: Video, color: "text-blue-600 bg-blue-100" },
                            { label: "Emails",   count: (c.emailMessages?.length || 0) + (c.activities?.filter((a: any) => a.type === "email")?.length || 0), icon: Mail, color: "text-violet-600 bg-violet-100" },
                            { label: "Tasks",    count: c.tasks?.length || 0, icon: CheckSquare, color: "text-amber-600 bg-amber-100" },
                          ].map(stat => (
                            <div key={stat.label} className="flex flex-col items-center p-4 bg-slate-50 rounded-xl">
                              <div className={`p-2.5 rounded-xl ${stat.color} mb-2`}>
                                <stat.icon className="w-4 h-4" />
                              </div>
                              <p className="text-2xl font-extrabold text-slate-900">{stat.count}</p>
                              <p className="text-xs text-slate-400 font-semibold">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Summary Card */}
                      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="w-4 h-4" />
                          <h4 className="text-sm font-bold">AI Account Summary</h4>
                        </div>
                        <p className="text-sm opacity-90 leading-relaxed">
                          <strong>{c.name}</strong> is a {c.industry || "B2B"} account with {c.deals?.length || 0} total deals and ₹{formatCurrencyCompact(c.lifetimeRevenue || 0)} in lifetime revenue.
                          {c.openDealsCount > 0 ? ` There are currently ${c.openDealsCount} open opportunities worth ${formatCurrencyCompact(c.pipelineValue || 0)}.` : " All deals are currently closed."}
                          {" "}The account has a health score of <strong>{healthScore}%</strong> ({healthLabel}).
                          {" "}Last interaction was {timeline[0] ? getRelativeDate(timeline[0].date) : "not recorded"}.
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[
                            { label: "Risk Level", val: c.openDealsCount > 0 ? "Low" : "Medium" },
                            { label: "Next Action", val: "Follow-up call" },
                            { label: "Renewal", val: "On Track" },
                          ].map(s => (
                            <div key={s.label} className="bg-white/10 rounded-lg p-2 text-center">
                              <p className="text-[10px] opacity-70 font-semibold">{s.label}</p>
                              <p className="text-xs font-bold">{s.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* ── RIGHT (25%): Sticky Quick Actions ────────────────────── */}
              <div className="w-56 xl:w-64 shrink-0 border-l border-slate-200 bg-white overflow-y-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
                <div className="p-5 space-y-5">

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      <ActionBtn icon={PhoneCall} label="Log a Call"     color="bg-emerald-600 hover:bg-emerald-700" />
                      <ActionBtn icon={Mail}      label="Send Email"     color="bg-indigo-600 hover:bg-indigo-700" />
                      <ActionBtn icon={Calendar}  label="Schedule Meeting" color="bg-blue-600 hover:bg-blue-700" />
                      <ActionBtn icon={CheckSquare} label="Create Task"   color="bg-amber-500 hover:bg-amber-600" />
                      <ActionBtn icon={FileText}  label="Generate Quote"  color="bg-violet-600 hover:bg-violet-700" />
                      <ActionBtn icon={Upload}    label="Upload Document" color="bg-slate-700 hover:bg-slate-800" />
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* More Actions */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Account Actions</h3>
                    <div className="space-y-1">
                      {[
                        { icon: UserPlus, label: "Reassign Owner" },
                        { icon: Star,     label: "Mark as VIP" },
                        { icon: Shield,   label: "Request NDA" },
                        { icon: Tag,      label: "Add Tags" },
                        { icon: ExternalLink, label: "View in Pipeline" },
                      ].map(action => (
                        <button key={action.label} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors text-left">
                          <action.icon className="w-4 h-4 text-slate-400 shrink-0" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Open Deals summary */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Open Deals</h3>
                    {(c.deals?.filter((d: any) => !["Won", "Lost"].includes(d.stage?.name)) || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No open deals</p>
                    ) : (
                      <div className="space-y-2">
                        {c.deals.filter((d: any) => !["Won", "Lost"].includes(d.stage?.name)).slice(0, 3).map((d: any) => (
                          <div key={d.id} className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-bold text-slate-700 truncate">{d.name || "Deal"}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs font-extrabold text-indigo-600">{formatCurrencyCompact(parseFloat(d.amount) || 0)}</span>
                              {d.stage && <StatusPill label={d.stage.name} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Upcoming Tasks */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Upcoming</h3>
                    {(c.tasks?.filter((t: any) => !t.isCompleted) || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No pending tasks</p>
                    ) : (
                      <div className="space-y-2">
                        {c.tasks.filter((t: any) => !t.isCompleted).slice(0, 3).map((task: any) => (
                          <div key={task.id} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg">
                            <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-slate-700 leading-snug">{task.title}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>{/* end 3-col grid */}
          </div>
        ) : null}
      </div>
    </div>
  );
}
