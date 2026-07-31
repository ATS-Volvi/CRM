import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, DollarSign, Inbox, Target, AlertCircle
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";
import { DashboardThemeSelector, DashboardTheme } from "../components/DashboardThemeSelector";
import {
  KPIWidget, AIBannerWidget, QuickActionsWidget, TasksWidget,
  MeetingsWidget, PipelineFunnelWidget, RevenueTrendWidget,
  FollowupsWidget, HotLeadsWidget, RecentActivityWidget,
  LatestQuotesWidget, RecentlyViewedWidget
} from "../components/dashboard/DashboardWidgets";

// ─── Data Types ────────────────────────────────────────────────────────────────
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

// ─── Static Demo Data ──────────────────────────────────────────────────────────
const MEETINGS_DEMO = [
  { id: "m1", title: "Q3 Review – Henkel AG", time: "10:00 AM", contact: "Klaus Weber", type: "video", duration: "45 min" },
  { id: "m2", title: "Renewal Negotiation – Reliance", time: "1:30 PM", contact: "Priya Sharma", type: "call", duration: "30 min" },
  { id: "m3", title: "Product Demo – ITC", time: "3:00 PM", contact: "Anand Rao", type: "in-person", duration: "60 min" },
];

const PIPELINE_STAGES = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"];
const REVENUE_MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const REVENUE_VALUES = [18.4, 22.1, 19.7, 28.6, 32.4, 37.8];

const AI_NUDGES = [
  "🚀 3 deals in Proposal stage haven't been updated in 5+ days. Follow up to keep them moving.",
  "🔥 Your win rate this month is 34% — above the 28% team average. Keep it up!",
  "⚡ Manoj Singh's quote expires tomorrow. Consider sending a reminder today.",
  "📈 Reliance Industries has viewed their quote 4 times — hot lead, strike now!",
  "💡 5 leads from Manufacturing sector haven't been contacted in 7+ days.",
];

function toLocalISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function MyDashboard() {
  const { user, token } = useAuth();
  const [nudgeIdx] = useState(() => Math.floor(Math.random() * AI_NUDGES.length));
  const [theme, setTheme] = useState<DashboardTheme>(() => {
    return (localStorage.getItem("dashboard_theme") as DashboardTheme) || "pastel";
  });

  const handleThemeChange = (newTheme: DashboardTheme) => {
    setTheme(newTheme);
    localStorage.setItem("dashboard_theme", newTheme);
  };

  // ── Data Queries ─────────────────────────────────────────────────────────────
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 30);

  const { data } = useQuery<DashboardData>({
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

  const funnelData: ManagementData["funnel"] = useMemo(() => {
    if (mgmtData?.funnel && mgmtData.funnel.length > 0) return mgmtData.funnel;
    return PIPELINE_STAGES.map(stage => ({
      stage,
      count: stage === "New" ? newLeads : Math.floor(Math.random() * 15),
      value: Math.floor(Math.random() * 5000000),
    }));
  }, [mgmtData, newLeads]);

  return (
    <div className={`min-h-screen p-6 max-w-[1600px] mx-auto transition-colors duration-300 ${
      theme === "minimalist" ? "bg-slate-100/60" : theme === "bento" ? "bg-slate-900/5 text-slate-900" : "bg-slate-50"
    }`}>
      {/* ─── THEME SWITCHER BAR ─────────────────────────────────────────────── */}
      <DashboardThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />

      {/* ─── TOP BAR: Welcome Summary ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-0.5">{dateStr}</p>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {greeting}, {displayName} 👋
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Personalized operational workspace • Live Overview
            </p>
          </div>
        </div>

        {/* Daily Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">📞</span>
            <span>{followUps.length || 8} follow-ups due</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">📅</span>
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
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">⚠️</span>
            <span>3 deals need attention</span>
          </div>
        </div>
      </div>

      {/* ─── STATIC CLEAN FLEX & GRID DASHBOARD LAYOUT ──────────────────────── */}
      <div className="space-y-6">

        {/* 1. AI Insight Banner */}
        <AIBannerWidget nudgeText={AI_NUDGES[nudgeIdx]} />

        {/* 2. Top Metric Cards (5 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPIWidget
            title="Pipeline Value"
            value={formatCurrencyCompact(pipelineValue)}
            icon={Target}
            themeName="indigo"
            spark={[12.1, 14.3, 11.8, 17.2, 19.5, 18.7, 22.1]}
            trend={{ up: true, val: "+14.2%" }}
          />
          <KPIWidget
            title="Revenue (MTD)"
            value={formatCurrencyCompact(data?.invoicesTotal || 3780000)}
            icon={DollarSign}
            themeName="mint"
            spark={[8.2, 9.1, 10.4, 11.2, 12.0, 13.5, 14.8]}
            trend={{ up: true, val: "+8.6%" }}
          />
          <KPIWidget
            title="New Leads"
            value={String(newLeads || 47)}
            icon={Inbox}
            themeName="sky"
            spark={[5, 8, 6, 12, 9, 14, 11]}
            trend={{ up: true, val: "+23 this week" }}
          />
          <KPIWidget
            title="Follow-ups Due"
            value={String(followUps.length || 12)}
            icon={AlertCircle}
            themeName="peach"
            spark={[3, 7, 5, 9, 11, 8, 12]}
            trend={{ up: false, val: `${followUps.length || 12} action` }}
          />
          <KPIWidget
            title="Win Rate"
            value={`${Math.round(data?.conversionRate || mgmtData?.winRate || 34)}%`}
            icon={TrendingUp}
            themeName="rose"
            spark={[28, 31, 30, 34, 33, 36, 34]}
            trend={{ up: true, val: "vs 28% avg" }}
          />
        </div>

        {/* 3. Quick Actions Toolbar */}
        <QuickActionsWidget />

        {/* 4. Operational Lists Grid (Tasks, Pipeline Funnel, Follow-ups) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[340px]">
          <TasksWidget tasks={tasks} />
          <PipelineFunnelWidget funnel={funnelData} />
          <FollowupsWidget followUps={followUps} />
        </div>

        {/* 5. Secondary Analytics Grid (Meetings, Revenue Trend, Hot Leads) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px]">
          <MeetingsWidget meetings={MEETINGS_DEMO} />
          <RevenueTrendWidget months={REVENUE_MONTHS} values={REVENUE_VALUES} />
          <HotLeadsWidget leads={data?.leads || []} />
        </div>

        {/* 6. Bottom Table & Feed Row (Latest Quotes, Recently Viewed, Recent Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[320px]">
          <LatestQuotesWidget quotes={data?.quotes || []} />
          <RecentlyViewedWidget />
          <RecentActivityWidget />
        </div>

      </div>
    </div>
  );
}
