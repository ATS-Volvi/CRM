import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, DollarSign, Inbox, Target, AlertCircle,
  Plus, Settings2, RotateCcw, Check
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";
import { DashboardThemeSelector, DashboardTheme } from "../components/DashboardThemeSelector";
import {
  KPIWidget, AIBannerWidget, QuickActionsWidget, TasksWidget,
  MeetingsWidget, PipelineFunnelWidget, RevenueTrendWidget,
  FollowupsWidget, HotLeadsWidget, RecentActivityWidget,
  LatestQuotesWidget, LeaderboardWidget, RecentlyViewedWidget
} from "../components/dashboard/DashboardWidgets";

// ─── Custom Layout Item Interface ──────────────────────────────────────────────
export interface CustomLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

// ─── Helper to Validate Stored Layout ──────────────────────────────────────────
function isValidLayout(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const posMap = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.x !== "number" || typeof item.y !== "number" || !item.i) return false;
    const key = `${item.x},${item.y}`;
    const count = (posMap.get(key) || 0) + 1;
    posMap.set(key, count);
    if (count > 2) return false; // Overlap detected!
  }
  return true;
}

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

// ─── Widget Definition System with Non-Overlapping Coordinates ────────────────
interface WidgetConfig {
  id: string;
  name: string;
  category: "KPI" | "Insights" | "Actions" | "Lists" | "Analytics";
  defaultLayout: CustomLayoutItem;
}

const DEFAULT_WIDGET_DEFS: WidgetConfig[] = [
  { id: "ai-banner", name: "AI Insight Banner", category: "Insights", defaultLayout: { i: "ai-banner", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 } },
  { id: "kpi-pipeline", name: "Pipeline Value KPI", category: "KPI", defaultLayout: { i: "kpi-pipeline", x: 0, y: 2, w: 2, h: 4, minW: 2, minH: 3 } },
  { id: "kpi-revenue", name: "Revenue (MTD) KPI", category: "KPI", defaultLayout: { i: "kpi-revenue", x: 2, y: 2, w: 2, h: 4, minW: 2, minH: 3 } },
  { id: "kpi-leads", name: "New Leads KPI", category: "KPI", defaultLayout: { i: "kpi-leads", x: 4, y: 2, w: 2, h: 4, minW: 2, minH: 3 } },
  { id: "kpi-followups", name: "Follow-ups Due KPI", category: "KPI", defaultLayout: { i: "kpi-followups", x: 6, y: 2, w: 3, h: 4, minW: 2, minH: 3 } },
  { id: "kpi-winrate", name: "Win Rate KPI", category: "KPI", defaultLayout: { i: "kpi-winrate", x: 9, y: 2, w: 3, h: 4, minW: 2, minH: 3 } },
  { id: "quick-actions", name: "Quick Actions", category: "Actions", defaultLayout: { i: "quick-actions", x: 0, y: 6, w: 12, h: 3, minW: 4, minH: 2 } },
  { id: "today-tasks", name: "Today's Tasks", category: "Lists", defaultLayout: { i: "today-tasks", x: 0, y: 9, w: 4, h: 9, minW: 3, minH: 5 } },
  { id: "pipeline-funnel", name: "Pipeline Funnel", category: "Analytics", defaultLayout: { i: "pipeline-funnel", x: 4, y: 9, w: 4, h: 9, minW: 3, minH: 5 } },
  { id: "followups-due", name: "Follow-ups List", category: "Lists", defaultLayout: { i: "followups-due", x: 8, y: 9, w: 4, h: 9, minW: 3, minH: 5 } },
  { id: "today-meetings", name: "Today's Meetings", category: "Lists", defaultLayout: { i: "today-meetings", x: 0, y: 18, w: 4, h: 8, minW: 3, minH: 4 } },
  { id: "revenue-trend", name: "Revenue Trend", category: "Analytics", defaultLayout: { i: "revenue-trend", x: 4, y: 18, w: 4, h: 8, minW: 3, minH: 4 } },
  { id: "hot-leads", name: "Hot Leads List", category: "Lists", defaultLayout: { i: "hot-leads", x: 8, y: 18, w: 4, h: 8, minW: 3, minH: 4 } },
  { id: "latest-quotes", name: "Latest Quotes Table", category: "Analytics", defaultLayout: { i: "latest-quotes", x: 0, y: 26, w: 7, h: 9, minW: 4, minH: 5 } },
  { id: "leaderboard", name: "Team Leaderboard", category: "Analytics", defaultLayout: { i: "leaderboard", x: 7, y: 26, w: 5, h: 9, minW: 3, minH: 5 } },
  { id: "recently-viewed", name: "Recently Viewed Records", category: "Lists", defaultLayout: { i: "recently-viewed", x: 0, y: 35, w: 6, h: 7, minW: 4, minH: 4 } },
  { id: "recent-activity", name: "Recent Activity Feed", category: "Insights", defaultLayout: { i: "recent-activity", x: 6, y: 35, w: 6, h: 7, minW: 4, minH: 4 } },
];

export default function MyDashboard() {
  const { user, token } = useAuth();
  const userId = user?.id || "guest";
  const { width, containerRef } = useContainerWidth();

  const [nudgeIdx] = useState(() => Math.floor(Math.random() * AI_NUDGES.length));
  const [theme, setTheme] = useState<DashboardTheme>(() => {
    return (localStorage.getItem("dashboard_theme") as DashboardTheme) || "pastel";
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const layoutStorageKey = `dashboard_grid_layout_v5_${userId}`;
  const hiddenStorageKey = `dashboard_hidden_widgets_v5_${userId}`;

  const [layout, setLayout] = useState<CustomLayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem(layoutStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidLayout(parsed)) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_WIDGET_DEFS.map(w => w.defaultLayout);
  });

  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(hiddenStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const handleThemeChange = (newTheme: DashboardTheme) => {
    setTheme(newTheme);
    localStorage.setItem("dashboard_theme", newTheme);
  };

  // ── Data Queries (Zero New Fetches) ─────────────────────────────────────────
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

  const handleLayoutChange = (currentLayout: readonly any[]) => {
    if (!Array.isArray(currentLayout) || currentLayout.length === 0) return;
    const sanitized = currentLayout.map((item: any) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }));
    if (isValidLayout(sanitized)) {
      setLayout(sanitized);
      try {
        localStorage.setItem(layoutStorageKey, JSON.stringify(sanitized));
      } catch (e) {
        // ignore
      }
    }
  };

  const handleRemoveWidget = (widgetId: string) => {
    const updatedHidden = [...hiddenWidgetIds, widgetId];
    setHiddenWidgetIds(updatedHidden);
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(updatedHidden));
    } catch (e) {
      // ignore
    }
  };

  const handleAddWidget = (widgetId: string) => {
    const updatedHidden = hiddenWidgetIds.filter(id => id !== widgetId);
    setHiddenWidgetIds(updatedHidden);
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(updatedHidden));
    } catch (e) {
      // ignore
    }

    if (!layout.some(l => l.i === widgetId)) {
      const def = DEFAULT_WIDGET_DEFS.find(d => d.id === widgetId);
      if (def) {
        const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const newLayoutItem = { ...def.defaultLayout, y: maxY };
        const nextLayout = [...layout, newLayoutItem];
        setLayout(nextLayout);
        localStorage.setItem(layoutStorageKey, JSON.stringify(nextLayout));
      }
    }
    setShowAddPicker(false);
  };

  const handleResetLayout = () => {
    const defaultLayouts = DEFAULT_WIDGET_DEFS.map(w => w.defaultLayout);
    setLayout(defaultLayouts);
    setHiddenWidgetIds([]);
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(defaultLayouts));
      localStorage.setItem(hiddenStorageKey, JSON.stringify([]));
    } catch (e) {
      // ignore
    }
  };

  const visibleWidgetDefs = DEFAULT_WIDGET_DEFS.filter(w => !hiddenWidgetIds.includes(w.id));
  const removedWidgetDefs = DEFAULT_WIDGET_DEFS.filter(w => hiddenWidgetIds.includes(w.id));
  const activeLayouts = layout.filter(l => !hiddenWidgetIds.includes(l.i));

  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case "ai-banner":
        return (
          <AIBannerWidget
            nudgeText={AI_NUDGES[nudgeIdx]}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("ai-banner")}
          />
        );
      case "kpi-pipeline":
        return (
          <KPIWidget
            title="Pipeline Value"
            value={formatCurrencyCompact(pipelineValue)}
            icon={Target}
            themeName="indigo"
            spark={[12.1, 14.3, 11.8, 17.2, 19.5, 18.7, 22.1]}
            trend={{ up: true, val: "+14.2%" }}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("kpi-pipeline")}
          />
        );
      case "kpi-revenue":
        return (
          <KPIWidget
            title="Revenue (MTD)"
            value={formatCurrencyCompact(data?.invoicesTotal || 3780000)}
            icon={DollarSign}
            themeName="mint"
            spark={[8.2, 9.1, 10.4, 11.2, 12.0, 13.5, 14.8]}
            trend={{ up: true, val: "+8.6%" }}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("kpi-revenue")}
          />
        );
      case "kpi-leads":
        return (
          <KPIWidget
            title="New Leads"
            value={String(newLeads || 47)}
            icon={Inbox}
            themeName="sky"
            spark={[5, 8, 6, 12, 9, 14, 11]}
            trend={{ up: true, val: "+23 this week" }}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("kpi-leads")}
          />
        );
      case "kpi-followups":
        return (
          <KPIWidget
            title="Follow-ups Due"
            value={String(followUps.length || 12)}
            icon={AlertCircle}
            themeName="peach"
            spark={[3, 7, 5, 9, 11, 8, 12]}
            trend={{ up: false, val: `${followUps.length || 12} action` }}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("kpi-followups")}
          />
        );
      case "kpi-winrate":
        return (
          <KPIWidget
            title="Win Rate"
            value={`${Math.round(data?.conversionRate || mgmtData?.winRate || 34)}%`}
            icon={TrendingUp}
            themeName="rose"
            spark={[28, 31, 30, 34, 33, 36, 34]}
            trend={{ up: true, val: "vs 28% avg" }}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("kpi-winrate")}
          />
        );
      case "quick-actions":
        return (
          <QuickActionsWidget
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("quick-actions")}
          />
        );
      case "today-tasks":
        return (
          <TasksWidget
            tasks={tasks}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("today-tasks")}
          />
        );
      case "today-meetings":
        return (
          <MeetingsWidget
            meetings={MEETINGS_DEMO}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("today-meetings")}
          />
        );
      case "pipeline-funnel":
        return (
          <PipelineFunnelWidget
            funnel={funnelData}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("pipeline-funnel")}
          />
        );
      case "revenue-trend":
        return (
          <RevenueTrendWidget
            months={REVENUE_MONTHS}
            values={REVENUE_VALUES}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("revenue-trend")}
          />
        );
      case "followups-due":
        return (
          <FollowupsWidget
            followUps={followUps}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("followups-due")}
          />
        );
      case "hot-leads":
        return (
          <HotLeadsWidget
            leads={data?.leads || []}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("hot-leads")}
          />
        );
      case "recent-activity":
        return (
          <RecentActivityWidget
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("recent-activity")}
          />
        );
      case "latest-quotes":
        return (
          <LatestQuotesWidget
            quotes={data?.quotes || []}
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("latest-quotes")}
          />
        );
      case "leaderboard":
        return (
          <LeaderboardWidget
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("leaderboard")}
          />
        );
      case "recently-viewed":
        return (
          <RecentlyViewedWidget
            isCustomizing={isCustomizing}
            onRemove={() => handleRemoveWidget("recently-viewed")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen p-6 max-w-[1600px] mx-auto transition-colors duration-300 ${
      theme === "minimalist" ? "bg-slate-100/60" : theme === "bento" ? "bg-slate-900/5 text-slate-900" : "bg-slate-50"
    }`}>
      {/* ─── THEME SWITCHER BAR ─────────────────────────────────────────────── */}
      <DashboardThemeSelector currentTheme={theme} onThemeChange={handleThemeChange} />

      {/* ─── TOP BAR: Welcome Summary & Customization Toolbar ────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-0.5">{dateStr}</p>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {greeting}, {displayName} 👋
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Personalized operational workspace • {isCustomizing ? "Customize Mode Active" : "Locked View"}
            </p>
          </div>

          {/* Customization Controls Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs ${
                isCustomizing
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {isCustomizing ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4 text-indigo-600" />}
              {isCustomizing ? "Done Customizing" : "Customize Dashboard"}
            </button>

            {isCustomizing && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAddPicker(!showAddPicker)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Widget {removedWidgetDefs.length > 0 && `(${removedWidgetDefs.length})`}
                </button>

                {/* Removed Widgets Dropdown Picker */}
                {showAddPicker && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-scale-up">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 border-b border-slate-100 mb-1">
                      Hidden Widgets
                    </p>
                    {removedWidgetDefs.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {removedWidgetDefs.map(w => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => handleAddWidget(w.id)}
                            className="w-full text-left flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors"
                          >
                            <span>{w.name}</span>
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 p-3 text-center">All widgets are active!</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {isCustomizing && (
              <button
                type="button"
                onClick={handleResetLayout}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                title="Reset layout to default"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
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

      {/* ─── DYNAMIC REACT GRID LAYOUT ────────────────────────────────────────── */}
      <div ref={containerRef} className="w-full">
        <GridLayout
          width={width || 1400}
          className="layout"
          gridConfig={{ cols: 12, rowHeight: 34, margin: [16, 16] }}
          dragConfig={{ enabled: isCustomizing, handle: ".drag-handle" }}
          resizeConfig={{ enabled: isCustomizing }}
          layout={activeLayouts as any}
          onLayoutChange={handleLayoutChange}
        >
          {visibleWidgetDefs.map(w => (
            <div key={w.id} className="h-full">
              {renderWidgetContent(w.id)}
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}
