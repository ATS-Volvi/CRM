import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Target, DollarSign, Inbox, AlertCircle, TrendingUp, Zap, Plus,
  FileText, Phone, Calendar, BarChart2, Activity, CheckCircle2,
  Users, Star, Mail, Building2, ChevronRight, PlayCircle, GripVertical, X,
  Clock, MessageSquare, Award, PieChart as PieIcon, Flame, Gift, StickyNote,
  Send, ShieldAlert, Sparkles, UserCheck
} from "lucide-react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { formatCurrencyCompact } from "../../utils/currency";

// ─── Pastel Accent Theme Mapping ──────────────────────────────────────────────
export type PastelTheme = "lavender" | "mint" | "sky" | "peach" | "rose" | "indigo" | "teal" | "slate";

export const PASTEL_THEMES: Record<PastelTheme, {
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  borderAccent: string;
  pillBg: string;
  pillText: string;
}> = {
  lavender: {
    headerBg: "bg-purple-50/80 border-b border-purple-100",
    badgeBg: "bg-purple-100/90",
    badgeText: "text-purple-700",
    iconBg: "bg-purple-100/80 border border-purple-200/60",
    iconColor: "text-purple-700",
    borderAccent: "border-t-2 border-t-purple-400/70",
    pillBg: "bg-purple-50 border-purple-200/60",
    pillText: "text-purple-700",
  },
  mint: {
    headerBg: "bg-emerald-50/80 border-b border-emerald-100",
    badgeBg: "bg-emerald-100/90",
    badgeText: "text-emerald-700",
    iconBg: "bg-emerald-100/80 border border-emerald-200/60",
    iconColor: "text-emerald-700",
    borderAccent: "border-t-2 border-t-emerald-400/70",
    pillBg: "bg-emerald-50 border-emerald-200/60",
    pillText: "text-emerald-700",
  },
  sky: {
    headerBg: "bg-sky-50/80 border-b border-sky-100",
    badgeBg: "bg-sky-100/90",
    badgeText: "text-sky-700",
    iconBg: "bg-sky-100/80 border border-sky-200/60",
    iconColor: "text-sky-700",
    borderAccent: "border-t-2 border-t-sky-400/70",
    pillBg: "bg-sky-50 border-sky-200/60",
    pillText: "text-sky-700",
  },
  peach: {
    headerBg: "bg-amber-50/80 border-b border-amber-100",
    badgeBg: "bg-amber-100/90",
    badgeText: "text-amber-700",
    iconBg: "bg-amber-100/80 border border-amber-200/60",
    iconColor: "text-amber-700",
    borderAccent: "border-t-2 border-t-amber-400/70",
    pillBg: "bg-amber-50 border-amber-200/60",
    pillText: "text-amber-700",
  },
  rose: {
    headerBg: "bg-rose-50/80 border-b border-rose-100",
    badgeBg: "bg-rose-100/90",
    badgeText: "text-rose-700",
    iconBg: "bg-rose-100/80 border border-rose-200/60",
    iconColor: "text-rose-700",
    borderAccent: "border-t-2 border-t-rose-400/70",
    pillBg: "bg-rose-50 border-rose-200/60",
    pillText: "text-rose-700",
  },
  indigo: {
    headerBg: "bg-indigo-50/80 border-b border-indigo-100",
    badgeBg: "bg-indigo-100/90",
    badgeText: "text-indigo-700",
    iconBg: "bg-indigo-100/80 border border-indigo-200/60",
    iconColor: "text-indigo-700",
    borderAccent: "border-t-2 border-t-indigo-400/70",
    pillBg: "bg-indigo-50 border-indigo-200/60",
    pillText: "text-indigo-700",
  },
  teal: {
    headerBg: "bg-teal-50/80 border-b border-teal-100",
    badgeBg: "bg-teal-100/90",
    badgeText: "text-teal-700",
    iconBg: "bg-teal-100/80 border border-teal-200/60",
    iconColor: "text-teal-700",
    borderAccent: "border-t-2 border-t-teal-400/70",
    pillBg: "bg-teal-50 border-teal-200/60",
    pillText: "text-teal-700",
  },
  slate: {
    headerBg: "bg-slate-50/80 border-b border-slate-100",
    badgeBg: "bg-slate-100/90",
    badgeText: "text-slate-700",
    iconBg: "bg-slate-100/80 border border-slate-200/60",
    iconColor: "text-slate-700",
    borderAccent: "border-t-2 border-t-slate-400/70",
    pillBg: "bg-slate-50 border-slate-200/60",
    pillText: "text-slate-700",
  },
};

// ─── Sparkline Helper ──────────────────────────────────────────────────────────
export function SparkLine({ values, color = "#6366f1" }: { values: number[]; color?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 72;
  const h = 24;
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

// ─── Common Widget Base Card Container ──────────────────────────────────────────
export function WidgetCard({
  title,
  icon: Icon,
  themeName = "slate",
  badge,
  action,
  isCustomizing,
  onRemove,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ElementType;
  themeName?: PastelTheme;
  badge?: number | string;
  action?: { label: string; href: string };
  isCustomizing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const theme = PASTEL_THEMES[themeName];

  return (
    <div
      className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden transition-all duration-200 group ${theme.borderAccent} ${className}`}
    >
      {/* Widget Header Strip */}
      {title && (
        <div className={`px-4 py-2.5 flex items-center justify-between shrink-0 select-none ${theme.headerBg}`}>
          <div className="flex items-center gap-2 min-w-0">
            {isCustomizing && (
              <div className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-700 rounded transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}
            {Icon && (
              <div className={`p-1.5 rounded-lg shrink-0 ${theme.iconBg}`}>
                <Icon className={`w-3.5 h-3.5 ${theme.iconColor}`} />
              </div>
            )}
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">{title}</h3>
            {badge !== undefined && (
              <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {action && !isCustomizing && (
              <Link
                to={action.href}
                className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 transition-colors"
              >
                {action.label} <ChevronRight className="w-3 h-3" />
              </Link>
            )}
            {isCustomizing && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Remove Widget"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Widget Body Content */}
      <div className="p-4 flex-1 overflow-auto min-h-0 relative">
        {children}
      </div>
    </div>
  );
}

// ─── Individual Widget 1: KPI Metric Card Wrapper ──────────────────────────────
export function KPIWidget({
  title,
  value,
  subtext,
  icon: Icon,
  themeName,
  spark,
  trend,
  isCustomizing,
  onRemove,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  themeName: PastelTheme;
  spark?: number[];
  trend?: { up: boolean; val: string };
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const theme = PASTEL_THEMES[themeName];

  return (
    <WidgetCard themeName={themeName} isCustomizing={isCustomizing} onRemove={onRemove}>
      <div className="h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isCustomizing && (
              <div className="drag-handle cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`p-2 rounded-xl ${theme.iconBg}`}>
              <Icon className={`w-4 h-4 ${theme.iconColor}`} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
            </div>
          </div>
          {spark && <SparkLine values={spark} color={trend?.up ? "#10b981" : "#f59e0b"} />}
          {isCustomizing && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
              title="Remove Widget"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2">
          <p className="text-2xl font-black tracking-tight text-slate-900">{value}</p>
          {(trend || subtext) && (
            <div className="flex items-center gap-1.5 mt-1">
              {trend && (
                <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  trend.up ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "bg-amber-50 text-amber-700 border border-amber-200/50"
                }`}>
                  {trend.up ? "↑ " : "↓ "}{trend.val}
                </span>
              )}
              {subtext && <span className="text-[11px] text-slate-500 font-medium">{subtext}</span>}
            </div>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 2: AI Hot Lead Banner Widget ─────────────────────────────
export function AIBannerWidget({
  nudgeText,
  isCustomizing,
  onRemove,
}: {
  nudgeText: string;
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/90 to-sky-50/90 border border-indigo-100 rounded-2xl shadow-2xs relative">
      <div className="flex items-center gap-3 min-w-0">
        {isCustomizing && (
          <div className="drag-handle cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="p-2 bg-amber-100 text-amber-700 border border-amber-200/60 rounded-xl shrink-0">
          <Zap className="w-4 h-4 animate-pulse" />
        </div>
        <p className="text-xs font-semibold text-slate-800 truncate">{nudgeText}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link to="/ai-reports" className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline whitespace-nowrap">
          AI Reports →
        </Link>
        {isCustomizing && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
            title="Remove Widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Individual Widget 3: Quick Actions Widget ──────────────────────────────────
export function QuickActionsWidget({
  isCustomizing,
  onRemove,
}: {
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  return (
    <WidgetCard title="Quick Actions" icon={Zap} themeName="slate" isCustomizing={isCustomizing} onRemove={onRemove}>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/leads/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/60 text-xs font-bold rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> New Lead
        </Link>
        <Link
          to="/quotes/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/60 text-xs font-bold rounded-xl transition-all"
        >
          <FileText className="w-3.5 h-3.5" /> Create Quote
        </Link>
        <Link
          to="/leads"
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100/80 text-sky-700 border border-sky-200/60 text-xs font-bold rounded-xl transition-all"
        >
          <Phone className="w-3.5 h-3.5" /> Log Call
        </Link>
        <Link
          to="/pipeline"
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 text-xs font-bold rounded-xl transition-all"
        >
          <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
        </Link>
        <Link
          to="/pipeline"
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100/80 text-amber-700 border border-amber-200/60 text-xs font-bold rounded-xl transition-all"
        >
          <BarChart2 className="w-3.5 h-3.5" /> Pipeline View
        </Link>
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 4: Today's Tasks Widget ──────────────────────────────────
export function TasksWidget({
  tasks,
  isCustomizing,
  onRemove,
}: {
  tasks: any[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const displayTasks = tasks.length > 0 ? tasks.slice(0, 5) : [
    { id: "t1", title: "Follow up: Tata Motors quote", dueDate: new Date(Date.now() - 3600000).toISOString() },
    { id: "t2", title: "Send NDA to Wipro Legal team", dueDate: new Date().toISOString() },
    { id: "t3", title: "Prepare demo for ITC Foods", dueDate: new Date(Date.now() + 3600000).toISOString() },
    { id: "t4", title: "Update CRM: Reliance status", dueDate: new Date(Date.now() + 7200000).toISOString() },
    { id: "t5", title: "Review Q3 quota attainment", dueDate: new Date(Date.now() - 86400000).toISOString() },
  ];

  return (
    <WidgetCard
      title="Today's Tasks"
      icon={CheckCircle2}
      themeName="mint"
      badge={displayTasks.length}
      action={{ label: "All tasks", href: "/leads" }}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-1">
        {displayTasks.map(t => {
          const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 py-2 px-2.5 rounded-xl hover:bg-emerald-50/50 transition-colors border border-transparent hover:border-emerald-100 group/task"
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${isOverdue ? "border-rose-400 bg-rose-50" : "border-emerald-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{t.title || t.subject || "Task"}</p>
                <p className={`text-[10px] font-medium ${isOverdue ? "text-rose-600 font-semibold" : "text-slate-400"}`}>
                  {isOverdue ? "Overdue" : t.dueDate ? new Date(t.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}
                </p>
              </div>

              {/* 1-Click Action Launcher */}
              <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover/task:opacity-100">
                <Link
                  to="/communications"
                  className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                  title="1-Click Reply / Message"
                >
                  <Send className="w-2.5 h-2.5" /> Reply
                </Link>
                <Link
                  to="/quotes/new"
                  className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-bold rounded-lg transition-all hidden sm:flex items-center gap-1 shadow-2xs"
                  title="1-Click Quote"
                >
                  <FileText className="w-2.5 h-2.5" /> Quote
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 5: Today's Meetings Widget ───────────────────────────────
export function MeetingsWidget({
  meetings,
  isCustomizing,
  onRemove,
}: {
  meetings: any[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  return (
    <WidgetCard
      title="Today's Meetings"
      icon={Calendar}
      themeName="sky"
      badge={meetings.length}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-1.5">
        {meetings.map(m => {
          const isCall = m.type === "call";
          return (
            <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-sky-50/50 hover:border-sky-100 transition-colors">
              <div className={`p-1.5 rounded-lg shrink-0 ${isCall ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700"}`}>
                {isCall ? <Phone className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{m.title}</p>
                <p className="text-[10px] text-slate-400">{m.contact} · {m.duration}</p>
              </div>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                {m.time}
              </span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 6: Pipeline Funnel Widget ────────────────────────────────
export function PipelineFunnelWidget({
  funnel,
  isCustomizing,
  onRemove,
}: {
  funnel: { stage: string; count: number; value: number }[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const visible = funnel.filter(f => !["Won", "Lost"].includes(f.stage));
  const maxCount = Math.max(...visible.map(f => f.count), 1);

  const PASTEL_SHADES = [
    "bg-indigo-200 text-indigo-900",
    "bg-purple-200 text-purple-900",
    "bg-sky-200 text-sky-900",
    "bg-amber-200 text-amber-900",
    "bg-emerald-200 text-emerald-900",
  ];

  return (
    <WidgetCard
      title="Pipeline Funnel"
      icon={Activity}
      themeName="indigo"
      action={{ label: "Pipeline", href: "/pipeline" }}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-2">
        {visible.map((f, idx) => {
          const w = Math.min((f.count / maxCount) * 100, 100);
          const shadeClass = PASTEL_SHADES[idx % PASTEL_SHADES.length];
          return (
            <div key={f.stage} className="flex items-center gap-2">
              <span className="w-20 text-[11px] font-semibold text-slate-600 truncate text-right">{f.stage}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden border border-slate-200/40">
                <div
                  className={`h-full rounded-md flex items-center px-1.5 text-[9px] font-bold transition-all duration-500 ${shadeClass}`}
                  style={{ width: `${Math.max(w, 10)}%` }}
                >
                  {f.count}
                </div>
              </div>
              <span className="w-16 text-[10px] font-bold text-slate-500 text-right">{formatCurrencyCompact(f.value)}</span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 7: Revenue Trend Widget ──────────────────────────────────
export function RevenueTrendWidget({
  months,
  values,
  isCustomizing,
  onRemove,
}: {
  months: string[];
  values: number[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const max = Math.max(...values, 1);
  const H = 60;
  const W = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return { x, y };
  });
  const pathD = pts.reduce((d, p, i) => d + (i === 0 ? `M ${p.x},${p.y}` : ` L ${p.x},${p.y}`), "");
  const areaD = pathD + ` L ${pts[pts.length - 1].x},${H} L 0,${H} Z`;

  return (
    <WidgetCard title="Revenue Trend" icon={TrendingUp} themeName="teal" isCustomizing={isCustomizing} onRemove={onRemove}>
      <div className="h-full flex flex-col justify-between">
        <svg viewBox={`0 0 100 ${H}`} className="w-full h-16" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pastelRevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#pastelRevGrad)" />
          <path d={pathD} stroke="#0d9488" strokeWidth="2" fill="none" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#0d9488" />
          ))}
        </svg>
        <div className="flex justify-between pt-1 border-t border-slate-100">
          {months.map((m, i) => (
            <span key={i} className="text-[9px] font-bold text-slate-400">{m}</span>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 8: Follow-ups Due List Widget ───────────────────────────
export function FollowupsWidget({
  followUps,
  isCustomizing,
  onRemove,
}: {
  followUps: any[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const displayLeads = followUps.length > 0 ? followUps.slice(0, 5) : [
    { id: "f1", firstName: "Vikram", lastName: "Mehta", company: "Tata Steel" },
    { id: "f2", firstName: "Ananya", lastName: "Reddy", company: "Infosys Ltd." },
    { id: "f3", firstName: "Rajesh", lastName: "Kumar", company: "HDFC Bank" },
    { id: "f4", firstName: "Priya", lastName: "Nair", company: "Asian Paints" },
  ];

  return (
    <WidgetCard
      title="Follow-ups Due"
      icon={AlertCircle}
      themeName="peach"
      badge={displayLeads.length}
      action={{ label: "All leads", href: "/leads" }}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-1.5">
        {displayLeads.map(l => (
          <div key={l.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/40 border border-amber-100/60 hover:bg-amber-100/50 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
              {(l.firstName || l.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {l.firstName ? `${l.firstName} ${l.lastName}` : l.name || "Contact"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{l.company || "Unknown"}</p>
            </div>
            <button type="button" className="p-1 text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md text-[10px] font-bold flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" /> Call
            </button>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 9: Hot Leads Widget ──────────────────────────────────────
export function HotLeadsWidget({
  leads,
  isCustomizing,
  onRemove,
}: {
  leads: any[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const displayLeads = leads.length > 0 ? leads.slice(0, 4) : [
    { id: "h1", name: "Manoj Singh", company: "Reliance Retail", amount: 2400000, status: "Qualified" },
    { id: "h2", name: "Neha Kapoor", company: "Britannia Ind.", amount: 1800000, status: "Proposal" },
    { id: "h3", name: "Arjun Patel", company: "Bajaj Auto", amount: 3200000, status: "Negotiation" },
    { id: "h4", name: "Kavya Sharma", company: "ITC Limited", amount: 950000, status: "Qualified" },
  ];

  return (
    <WidgetCard
      title="Hot Leads"
      icon={Star}
      themeName="rose"
      action={{ label: "All leads", href: "/leads" }}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-1.5">
        {displayLeads.map(lead => (
          <Link
            key={lead.id}
            to="/leads"
            className="flex items-center gap-2.5 p-2 rounded-xl bg-rose-50/40 border border-rose-100/60 hover:bg-rose-100/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-200/80 text-rose-800 flex items-center justify-center text-xs font-bold shrink-0">
              {(lead.name || "?").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{lead.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{lead.company}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-rose-800">{formatCurrencyCompact(lead.amount)}</p>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 font-bold">{lead.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 10: Recent Activity Widget ───────────────────────────────
export function RecentActivityWidget({
  isCustomizing,
  onRemove,
}: {
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const activities = [
    { icon: Phone, color: "bg-emerald-100 text-emerald-700", text: "Called Priya Sharma", time: "2 min ago" },
    { icon: Mail, color: "bg-indigo-100 text-indigo-700", text: "Email sent to ITC Legal", time: "18 min ago" },
    { icon: CheckCircle2, color: "bg-teal-100 text-teal-700", text: "Task completed: Tata PO", time: "1 hr ago" },
    { icon: Building2, color: "bg-purple-100 text-purple-700", text: "New lead: Bajaj Electricals", time: "2 hr ago" },
    { icon: FileText, color: "bg-amber-100 text-amber-700", text: "Quote Q-1247 approved", time: "3 hr ago" },
  ];

  return (
    <WidgetCard title="Recent Activity" icon={Activity} themeName="lavender" isCustomizing={isCustomizing} onRemove={onRemove}>
      <div className="space-y-2">
        {activities.map((a, i) => (
          <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-purple-50/50 transition-colors">
            <div className={`p-1.5 rounded-lg shrink-0 ${a.color}`}>
              <a.icon className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{a.text}</p>
              <p className="text-[10px] text-slate-400">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ─── Individual Widget 11: Latest Quotes Widget ─────────────────────────────────
export function LatestQuotesWidget({
  quotes,
  isCustomizing,
  onRemove,
}: {
  quotes: any[];
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const displayQuotes = quotes.length > 0 ? quotes.slice(0, 5) : [
    { id: "q1", quoteNumber: "Q-1249", dealName: "Reliance Retail Expansion", amount: 2400000, status: "Sent", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "q2", quoteNumber: "Q-1248", dealName: "Tata Motors Fleet", amount: 3100000, status: "Accepted", createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: "q3", quoteNumber: "Q-1247", dealName: "Infosys Cloud License", amount: 950000, status: "Approved", createdAt: new Date(Date.now() - 259200000).toISOString() },
    { id: "q4", quoteNumber: "Q-1246", dealName: "HDFC Annual Support", amount: 580000, status: "Draft", createdAt: new Date(Date.now() - 432000000).toISOString() },
  ];

  return (
    <WidgetCard
      title="Latest Quotes"
      icon={FileText}
      themeName="indigo"
      action={{ label: "All Quotes", href: "/quotes" }}
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-1.5 px-2 font-bold text-slate-400 uppercase">Quote #</th>
              <th className="text-left py-1.5 px-2 font-bold text-slate-400 uppercase">Deal</th>
              <th className="text-left py-1.5 px-2 font-bold text-slate-400 uppercase">Amount</th>
              <th className="text-left py-1.5 px-2 font-bold text-slate-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayQuotes.map(q => (
              <tr key={q.id} className="hover:bg-indigo-50/40 transition-colors">
                <td className="py-2 px-2 font-mono font-bold text-indigo-700">{q.quoteNumber}</td>
                <td className="py-2 px-2 text-slate-700 font-medium truncate max-w-[140px]">{q.dealName}</td>
                <td className="py-2 px-2 font-bold text-slate-900">{formatCurrencyCompact(q.amount)}</td>
                <td className="py-2 px-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100/80 text-indigo-800">
                    {q.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}



// ─── Individual Widget 13: Recently Viewed Widget ─────────────────────────────
export function RecentlyViewedWidget({
  isCustomizing,
  onRemove,
}: {
  isCustomizing?: boolean;
  onRemove?: () => void;
}) {
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);

  useEffect(() => {
    try {
      const items = JSON.parse(localStorage.getItem("recently_viewed_records") || "[]");
      setRecentlyViewed(items);
    } catch {
      setRecentlyViewed([]);
    }
  }, []);

  return (
    <WidgetCard
      title="Recently Viewed"
      icon={Clock}
      themeName="indigo"
      isCustomizing={isCustomizing}
      onRemove={onRemove}
    >
      <div className="space-y-2">
        {recentlyViewed.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">No recent records opened yet. Use search or open leads to populate.</p>
        ) : (
          recentlyViewed.map((item: any, idx: number) => (
            <Link
              key={item.id || idx}
              to={item.path || "#"}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-100 transition-all group"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
                  {item.type || "Record"}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">
                  {item.title}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))
        )}
      </div>
    </WidgetCard>
  );
}

