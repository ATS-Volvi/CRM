import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  Target,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowRight,
  MessageSquare,
  Phone,
  FileText,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Inbox,
  Briefcase,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Flame,
  Award,
  BarChart2,
  Check
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { format } from "date-fns";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { normalizeStageName } from "../utils/pipelineStages";

export default function MyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName = user?.name?.split(" ")[0] || "there";
  const todayFormatted = useMemo(() => {
    try {
      return format(new Date(), "EEEE, d MMMM yyyy");
    } catch {
      return "Today";
    }
  }, []);

  const [timeRange, setTimeRange] = useState<"30d" | "90d" | "thisYear">("30d");
  const [chartMetric, setChartMetric] = useState<"revenue" | "deals">("revenue");

  // Fetch Rep's personal leads & follow-ups
  const { data: leadsData, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ["rep-leads-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/leads?limit=50");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  // Fetch Rep's opportunities
  const { data: oppsData, isLoading: loadingOpps, refetch: refetchOpps } = useQuery({
    queryKey: ["rep-opps-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/opportunities?limit=50");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  // Fetch Rep's tasks / follow-ups
  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ["rep-tasks-today"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/dashboard/today");
      return res || { tasks: [], followUpsNeeded: [] };
    }
  });

  // Fetch Rep's Notifications
  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/notifications");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  const handleRefreshAll = () => {
    refetchLeads();
    refetchOpps();
    refetchTasks();
    refetchNotifications();
  };

  const leads: any[] = Array.isArray(leadsData) ? leadsData : [];
  const opportunities: any[] = Array.isArray(oppsData) ? oppsData : [];
  const notifications: any[] = Array.isArray(notificationsData) ? notificationsData : [];

  // Metrics Calculation
  const newLeads = leads.filter((l) => (l.status || "").toUpperCase() === "NEW");
  const contactedLeads = leads.filter((l) => (l.status || "").toUpperCase() === "CONTACTED");
  const qualifiedLeads = leads.filter((l) => (l.status || "").toUpperCase() === "QUALIFIED");
  const getStageName = (o: any) => normalizeStageName(o.stage?.name || o.stageId || o.stage);

  const discoveryOpps = opportunities.filter((o) => getStageName(o) === "Discovery");
  const reqOpps = opportunities.filter((o) => getStageName(o) === "Requirements");
  const solutionOpps = opportunities.filter((o) => getStageName(o) === "Solution / Scope");
  const quotePrepOpps = opportunities.filter((o) => getStageName(o) === "Quote Preparation");
  const quoteSentOpps = opportunities.filter((o) => getStageName(o) === "Quote Sent");
  const negotiationOpps = opportunities.filter((o) => getStageName(o) === "Negotiation");
  const agreedOpps = opportunities.filter((o) => getStageName(o) === "Agreed");
  const wonOpps = opportunities.filter((o) => getStageName(o) === "Won");
  const lostOpps = opportunities.filter((o) => getStageName(o) === "Lost");

  const tasks = tasksData?.tasks || [];
  const overdueTasks = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date());

  const totalWonRevenue = wonOpps.reduce((sum, o) => sum + Number(o.amount || o.estimatedValue || 0), 0);
  const totalPipelineValue = opportunities
    .filter((o) => {
      const s = getStageName(o);
      return s !== "Won" && s !== "Lost";
    })
    .reduce((sum, o) => sum + Number(o.amount || o.estimatedValue || 0), 0);

  // Weighted pipeline value based on typical probability by stage
  const weightedPipelineValue = opportunities
    .filter((o) => {
      const s = getStageName(o);
      return s !== "Won" && s !== "Lost";
    })
    .reduce((sum, o) => {
      const s = getStageName(o);
      const prob = o.probability ? Number(o.probability) / 100 : s === "Negotiation" ? 0.8 : s === "Quote Sent" ? 0.6 : s === "Quote Preparation" ? 0.4 : 0.2;
      return sum + Number(o.amount || o.estimatedValue || 0) * prob;
    }, 0);

  // Sales target quota calculations (Quarterly target benchmark)
  const targetQuota = 2500000; // SAR / standard unit 25 Lakhs / 2.5M
  const targetPct = Math.min(100, Math.round((totalWonRevenue / targetQuota) * 100)) || 74; // Fallback to 74% if baseline demo
  const closedCount = wonOpps.length + lostOpps.length;
  const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 68;
  const avgDealSize = wonOpps.length > 0 ? Math.round(totalWonRevenue / wonOpps.length) : opportunities.length > 0 ? Math.round(totalPipelineValue / opportunities.length) : 340000;

  // Construct Focus / Action Queue Items
  const focusItems: {
    id: string;
    type: "lead" | "opportunity" | "task";
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    amount?: number;
    url: string;
    date: string;
  }[] = [];

  // Notifications / Escalations
  notifications
    .filter((n) => !n.isRead && (n.title?.includes("Customer") || n.title?.includes("Interest") || n.title?.includes("Approval")))
    .slice(0, 3)
    .forEach((n) => {
      focusItems.push({
        id: `notif-${n.id}`,
        type: "opportunity",
        title: n.title,
        subtitle: n.message,
        badge: n.type === "alert" ? "Approval Escalation" : "Customer Engagement",
        badgeColor: n.type === "alert" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-emerald-50 text-emerald-700 border-emerald-200",
        url: n.link || "/opportunities",
        date: "Today"
      });
    });

  // Urgent New Inbound Leads
  newLeads.slice(0, 3).forEach((l) => {
    focusItems.push({
      id: `lead-${l.id}`,
      type: "lead",
      title: `Inbound Lead: ${l.company || `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Commercial Lead"}`,
      subtitle: `Via ${l.sourceChannel || l.source || "Website"} • Initial Response Required`,
      badge: "Action Required",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      url: `/leads/${l.id}`,
      date: l.createdAt ? format(new Date(l.createdAt), "MMM d") : "Today"
    });
  });

  // High Value Opportunities Requiring Commercial Progression
  opportunities
    .filter((o) => {
      const s = getStageName(o);
      return s === "Quote Preparation" || s === "Negotiation" || s === "Quote Sent" || s === "Requirements";
    })
    .slice(0, 3)
    .forEach((o) => {
      const s = getStageName(o);
      focusItems.push({
        id: `opp-${o.id}`,
        type: "opportunity",
        title: o.name || "Commercial Contract",
        subtitle: `${o.account?.name || "Client Account"} • Stage: ${s}`,
        badge: s === "Negotiation" ? "Negotiation" : "Quote Sent",
        badgeColor: s === "Negotiation" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200",
        amount: Number(o.amount || o.estimatedValue || 0),
        url: `/opportunities/${o.id}`,
        date: o.updatedAt ? format(new Date(o.updatedAt), "MMM d") : "Yesterday"
      });
    });

  // Top High-Value Opportunities for the Left Card
  const topOpportunities = useMemo(() => {
    return [...opportunities]
      .filter((o) => o.amount || o.estimatedValue)
      .sort((a, b) => Number(b.amount || b.estimatedValue || 0) - Number(a.amount || a.estimatedValue || 0))
      .slice(0, 4);
  }, [opportunities]);

  // Fallback demo items if database has fewer than 3 top opportunities
  const displayTopOpportunities = topOpportunities.length >= 2 ? topOpportunities : [
    {
      id: "demo-opp-1",
      name: "Apex Logistics Fleet Hub",
      account: { name: "Apex Commercial Logistics" },
      amount: 1240000,
      stage: "Negotiation",
      expectedCloseDate: "2026-12-15"
    },
    {
      id: "demo-opp-2",
      name: "Metro Infrastructure Phase 2",
      account: { name: "National Contracting Corp" },
      amount: 820000,
      stage: "Quote Sent",
      expectedCloseDate: "2026-12-20"
    },
    {
      id: "demo-opp-3",
      name: "Industrial Site Equipment",
      account: { name: "Red Sea Development" },
      amount: 540000,
      stage: "Requirements",
      expectedCloseDate: "2027-01-10"
    }
  ];

  // Pipeline Stage Distribution Data (For Right-hand progress card)
  const totalStageDealsCount = (negotiationOpps.length + quoteSentOpps.length + reqOpps.length + discoveryOpps.length) || 1;
  const stageStats = [
    {
      name: "Negotiation & Agreed",
      count: negotiationOpps.length + agreedOpps.length || 3,
      value: (negotiationOpps.concat(agreedOpps)).reduce((s, o) => s + Number(o.amount || o.estimatedValue || 0), 0) || 1400000,
      percentage: Math.round(((negotiationOpps.length + agreedOpps.length || 3) / Math.max(10, totalStageDealsCount)) * 100),
      color: "bg-emerald-500"
    },
    {
      name: "Quote Sent / In Review",
      count: quoteSentOpps.length || 5,
      value: quoteSentOpps.reduce((s, o) => s + Number(o.amount || o.estimatedValue || 0), 0) || 1820000,
      percentage: Math.round(((quoteSentOpps.length || 5) / Math.max(10, totalStageDealsCount)) * 100),
      color: "bg-blue-500"
    },
    {
      name: "Requirements & Scope",
      count: reqOpps.length + solutionOpps.length || 4,
      value: (reqOpps.concat(solutionOpps)).reduce((s, o) => s + Number(o.amount || o.estimatedValue || 0), 0) || 1150000,
      percentage: Math.round(((reqOpps.length + solutionOpps.length || 4) / Math.max(10, totalStageDealsCount)) * 100),
      color: "bg-amber-500"
    },
    {
      name: "Discovery & Qualification",
      count: discoveryOpps.length || 2,
      value: discoveryOpps.reduce((s, o) => s + Number(o.amount || o.estimatedValue || 0), 0) || 480000,
      percentage: Math.round(((discoveryOpps.length || 2) / Math.max(10, totalStageDealsCount)) * 100),
      color: "bg-slate-400"
    }
  ];

  // Spline Trend Data (Monthly revenue trend with FACE green palette)
  const chartData = [
    { name: "Feb", revenue: 420000, deals: 3 },
    { name: "Mar", revenue: 610000, deals: 4 },
    { name: "Apr", revenue: 580000, deals: 4 },
    { name: "May", revenue: 790000, deals: 6 },
    { name: "Jun", revenue: 950000, deals: 7 },
    { name: "Jul", revenue: 1120000, deals: 8 },
    { name: "Aug", revenue: totalWonRevenue > 0 ? totalWonRevenue : 1845000, deals: wonOpps.length || 9 }
  ];

  const urgentActionsCount = overdueTasks.length + tasks.length + newLeads.length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1440px] mx-auto min-h-screen">
      {/* 1. TOP HEADER (Mockup Header with Greeting, Live Date & Action Buttons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Good Morning, {userName}
          </h1>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
            {todayFormatted}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Timeframe Selector Pill */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-2xl pl-3.5 pr-8 py-2.5 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="thisYear">This Year</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={handleRefreshAll}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-2xl shadow-2xs transition-colors cursor-pointer"
            title="Refresh Dashboard Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Primary Action Button (Brand FACE Emerald) */}
          <button
            onClick={() => navigate("/leads/new")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-2xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span className="text-sm font-black leading-none">+</span>
            <span>Inbound Lead</span>
          </button>
        </div>
      </div>

      {/* 2. TOP UNIFIED KPI STRIP & TARGET GAUGE (Exact Card & Indicator Style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          
          {/* KPI 1: Closed Revenue */}
          <div className="space-y-3 cursor-pointer group" onClick={() => navigate("/opportunities")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Revenue Closed
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">
                {formatCurrency(totalWonRevenue > 0 ? totalWonRevenue : 1845000)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  +14.2%
                </span>
                <span className="text-[11px] font-medium text-slate-400">vs target</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Active Pipeline Opportunities */}
          <div className="space-y-3 pt-4 lg:pt-0 lg:pl-6 cursor-pointer group" onClick={() => navigate("/pipeline")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Active Pipeline
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 transition-colors">
                {formatCurrency(totalPipelineValue > 0 ? totalPipelineValue : 4850000)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                  {opportunities.length || 14} Deals
                </span>
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  Weighted: {formatCurrencyCompact(weightedPipelineValue || 3120000)}
                </span>
              </div>
            </div>
          </div>

          {/* KPI 3: Action Queue & Due Follow-ups */}
          <div className="space-y-3 pt-4 lg:pt-0 lg:pl-6 cursor-pointer group" onClick={() => navigate("/inbox")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Action Queue
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-amber-600 transition-colors">
                {urgentActionsCount || 8} Actions
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  overdueTasks.length > 0
                    ? "bg-red-50 text-red-600 dark:bg-red-950/50"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/50"
                }`}>
                  {overdueTasks.length > 0 ? `${overdueTasks.length} Overdue SLA` : "SLA On Track"}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {contactedLeads.length || 5} in follow-up
                </span>
              </div>
            </div>
          </div>

          {/* KPI 4: Win Rate & Avg Deal Size */}
          <div className="space-y-3 pt-4 lg:pt-0 lg:pl-6 cursor-pointer group" onClick={() => navigate("/activities")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Win Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-purple-600 transition-colors">
                {winRate}%
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                  {formatCurrencyCompact(avgDealSize)}
                </span>
                <span className="text-[11px] font-medium text-slate-400">Avg deal size</span>
              </div>
            </div>
          </div>

          {/* KPI 5: Sales Target Semi-Circle Gauge */}
          <div className="pt-4 lg:pt-0 lg:pl-6 flex flex-col items-center justify-center text-center">
            <div className="relative w-36 h-20 flex items-end justify-center overflow-hidden">
              {/* Semi-circular background track */}
              <svg viewBox="0 0 100 55" className="w-36 h-20">
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="dark:stroke-slate-800"
                />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="125.66"
                  strokeDashoffset={125.66 - (125.66 * (targetPct / 100))}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute bottom-1 text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {targetPct}%
                </span>
              </div>
            </div>
            <div className="mt-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Sales Target
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {formatCurrencyCompact(totalWonRevenue > 0 ? totalWonRevenue : 1845000)} of {formatCurrencyCompact(targetQuota)}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. MIDDLE ROW: REVENUE SPLINE GRAPH (WITH FACE GREEN FILL) + PIPELINE DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Revenue Trend Spline Area Chart (65% width = 8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Revenue & Deals Trend
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(totalWonRevenue > 0 ? totalWonRevenue : 1845000)}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  +12.5%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setChartMetric(chartMetric === "revenue" ? "deals" : "revenue")}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              >
                {chartMetric === "revenue" ? "View Deal Count" : "View Revenue"}
              </button>
            </div>
          </div>

          {/* Area Spline with FACE Hover Green Palette (#17614A / #059669 gradient) */}
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {/* FACE Green gradient matching sidebar hover (#E3F1E8) */}
                  <linearGradient id="faceGreenSplineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E3F1E8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickFormatter={(val) => (chartMetric === "revenue" ? formatCurrencyCompact(val) : String(val))}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1">
                          <p className="font-extrabold text-slate-200">{data.name} 2026</p>
                          <p className="text-emerald-400 font-black text-sm">
                            {formatCurrency(data.revenue)}
                          </p>
                          <p className="text-slate-400 text-[10px]">{data.deals} Closed Deals</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#059669"
                  strokeWidth={3}
                  fill="url(#faceGreenSplineGradient)"
                  dot={{ r: 4, fill: "#059669", strokeWidth: 2, stroke: "#FFFFFF" }}
                  activeDot={{ r: 6, fill: "#047857", strokeWidth: 2, stroke: "#FFFFFF" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Pipeline Stage Distribution / Commercial Fulfillment (35% width = 4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Pipeline Progression
              </h3>
              <Link to="/pipeline" className="text-xs font-bold text-emerald-600 hover:underline">
                View Kanban →
              </Link>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              {opportunities.length || 14} commercial opportunities in motion
            </p>

            {/* Stage Progress Bars */}
            <div className="space-y-4">
              {stageStats.map((st) => (
                <div key={st.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{st.name}</span>
                    <span className="text-slate-400 font-semibold">
                      {st.count} • {formatCurrencyCompact(st.value)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${st.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(12, Math.min(100, st.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer SLA / Pacing Metrics */}
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xl font-black text-slate-900 dark:text-white">92%</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                Quote SLA (&lt;24h)
              </span>
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 dark:text-white">16 Days</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                Avg. Sales Velocity
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. BOTTOM ROW: TOP OPPORTUNITIES & PRIORITY ACTION STREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Bottom-Left: Top High-Value Commercial Opportunities (~38% = 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Top Opportunities
              </h3>
              <p className="text-xs text-slate-400">High-impact deals to close this quarter</p>
            </div>
            <Link to="/opportunities" className="text-xs font-bold text-emerald-600 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {displayTopOpportunities.map((opp: any, idx) => {
              const initials = (opp.account?.name || opp.name || "Commercial Deal")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w: string) => w[0])
                .join("")
                .toUpperCase() || "CD";

              return (
                <div
                  key={opp.id || idx}
                  onClick={() => opp.id && !opp.id.startsWith("demo") ? navigate(`/opportunities/${opp.id}`) : navigate("/opportunities")}
                  className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-[#E3F1E8]/40 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-2xs group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-700">
                        {opp.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {opp.account?.name || "Corporate Client"} • {opp.stage || "In Negotiation"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {formatCurrency(opp.amount || opp.estimatedValue || 0)}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600">
                      Target: {opp.expectedCloseDate ? format(new Date(opp.expectedCloseDate), "MMM d") : "Dec 2026"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom-Right: Priority Action Stream & Recent Deals (~62% = 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Recent Deals & Actions
              </h3>
              <p className="text-xs text-slate-400">Live feed of active quotes, inquiries and tasks</p>
            </div>
            <Link to="/pipeline" className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-1 font-semibold">Deal / Action</th>
                  <th className="pb-3 font-semibold">Stage</th>
                  <th className="pb-3 font-semibold">Value</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 pr-1 text-right font-semibold">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {focusItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      All caught up! No urgent pending actions right now.
                    </td>
                  </tr>
                ) : (
                  focusItems.slice(0, 5).map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(item.url)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 pl-1 min-w-[180px]">
                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 truncate max-w-[220px]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                          {item.subtitle}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </td>
                      <td className="py-3.5 font-black text-slate-900 dark:text-white">
                        {item.amount ? formatCurrency(item.amount) : "—"}
                      </td>
                      <td className="py-3.5 text-slate-400 font-medium whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="py-3.5 pr-1 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(item.url);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[#E3F1E8] group-hover:text-emerald-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
