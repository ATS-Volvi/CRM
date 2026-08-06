import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useState, useMemo } from "react";
import {
  ArrowLeft, PhoneCall, Video, Mail, CheckSquare, Activity,
  TrendingUp, AlertTriangle, Clock, CheckCircle2,
  Calendar, MessageSquare, ChevronRight,
  Shield, Zap, UserPlus, RefreshCw, Send, Check, X,
  Briefcase, DollarSign, Target, Award, BarChart2,
  FileText, ArrowUpRight, Flame, Layers, CircleCheck, AlertCircle, Plus, Info, Eye
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ─── Interfaces & Helpers ───

interface KpiTarget {
  id: string;
  kpiName: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  weightage: number;
  status: string;
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
}

const PIPELINE_STAGES = [
  "Qualification", "Discovery", "Meeting", "Proposal", "Approval", "Negotiation", "Closing", "Won", "Lost"
];

const STAGE_BADGES: Record<string, string> = {
  Qualification: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  Discovery: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
  Meeting: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  Proposal: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  Approval: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  Negotiation: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
  Closing: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  Won: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
  Lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
};

const QUOTE_STATUS_BADGES: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  "Pending Approval": "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
  Sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
  Viewed: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300",
  "Revision Requested": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
};

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("active-deals");
  const [showInfoDrawer, setShowInfoDrawer] = useState<boolean>(false);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({
    t1: false, t2: false, t3: true, t4: false, t5: false, t6: false
  });

  // Data fetching
  const { data: rep, isLoading, error } = useQuery<Rep>({
    queryKey: ["salespersonPerformance", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/performance`);
      if (!res.ok) throw new Error("Failed to load salesperson command center data");
      return res.json();
    },
    enabled: !!id && !!token,
  });

  const { data: kpiTargets } = useQuery<KpiTarget[]>({
    queryKey: ["salespersonKpis", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/kpis`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token,
  });

  // Calculate Critical Metrics
  const revTarget = kpiTargets?.find(t => t.kpiName === "Revenue Closed")?.targetValue || 2300000;
  const closedRevenue = kpiTargets?.find(t => t.kpiName === "Revenue Closed")?.currentValue || 1800000;
  const targetAchievementPct = Math.min(100, Math.round((closedRevenue / revTarget) * 100));

  const activeDealsCount = rep?.dealTypes ? rep.dealTypes.filter(d => !["Won", "Lost"].includes(d.stage)).reduce((acc, d) => acc + d.count, 0) : 14;
  const totalPipelineValue = 5200000; // SAR 5.2M
  const pendingApprovalsCount = 3;
  const followupsTodayCount = 6;

  const currentWorkloadPct = Math.round((activeDealsCount / (rep?.maxOpenLeads || 15)) * 100);
  const isOverloaded = currentWorkloadPct >= 80 || pendingApprovalsCount > 2;

  // Active Deals Data (Work Cards)
  const activeDealsList = useMemo(() => {
    return [
      { id: "d1", customer: "ABC Industries", stage: "Negotiation", value: 1200000, lastActivity: "Meeting Tomorrow", followUp: "Today, 14:00", priority: "High", closeDate: "12 Aug 2026", isBlocked: true, blockReason: "Waiting on 12% Discount Approval" },
      { id: "d2", customer: "Metro Chemicals", stage: "Pending Approval", value: 850000, lastActivity: "Quote Waiting", followUp: "Today, 16:30", priority: "High", closeDate: "20 Aug 2026", isBlocked: true, blockReason: "Quote #QT-9921 Pending Admin Approval" },
      { id: "d3", customer: "Apex Global Logistics", stage: "Proposal", value: 1450000, lastActivity: "Revised Proposal Sent", followUp: "08 Aug, 10:00", priority: "High", closeDate: "18 Aug 2026", isBlocked: false },
      { id: "d4", customer: "Saudi Heavy Transport", stage: "Meeting", value: 680000, lastActivity: "Technical Demo Completed", followUp: "Today, 11:30", priority: "Medium", closeDate: "25 Aug 2026", isBlocked: false },
      { id: "d5", customer: "Eastern Port Logistics", stage: "Discovery", value: 450000, lastActivity: "Discovery Call Scheduled", followUp: "09 Aug, 09:00", priority: "Low", closeDate: "30 Aug 2026", isBlocked: false },
      { id: "d6", customer: "Al-Khobar Water Systems", stage: "Closing", value: 570000, lastActivity: "Contract Reviewing", followUp: "10 Aug, 15:00", priority: "High", closeDate: "14 Aug 2026", isBlocked: false }
    ];
  }, []);

  // Pending Quotations Data
  const pendingQuotationsList = useMemo(() => {
    return [
      { id: "q1", number: "QT-2026-881", customer: "ABC Industries", amount: 1200000, status: "Pending Approval", submittedDate: "05 Aug 2026", approver: "Admin User", revision: "Rev 2" },
      { id: "q2", number: "QT-2026-894", customer: "Metro Chemicals", amount: 850000, status: "Pending Approval", submittedDate: "06 Aug 2026", approver: "Admin User", revision: "Rev 1" },
      { id: "q3", number: "QT-2026-902", customer: "Saudi Heavy Transport", amount: 680000, status: "Pending Approval", submittedDate: "06 Aug 2026", approver: "Admin User", revision: "Rev 0" },
      { id: "q4", number: "QT-2026-772", customer: "Apex Global Logistics", amount: 1450000, status: "Sent", submittedDate: "03 Aug 2026", approver: "Auto-Approved", revision: "Rev 0" },
      { id: "q5", number: "QT-2026-640", customer: "Al-Khobar Water Systems", amount: 570000, status: "Viewed", submittedDate: "04 Aug 2026", approver: "Auto-Approved", revision: "Rev 1" },
      { id: "q6", number: "QT-2026-512", customer: "Eastern Port Logistics", amount: 450000, status: "Draft", submittedDate: "Today", approver: "Pending", revision: "Rev 0" }
    ];
  }, []);

  // Today's Tasks
  const todayTasksList = [
    { id: "t1", type: "Calls", title: "Follow-up call on SLA discount approval with ABC Industries", due: "14:00", priority: "High" },
    { id: "t2", type: "Proposal Revisions", title: "Submit revised Portacabin line items for Metro Chemicals", due: "15:30", priority: "High" },
    { id: "t3", type: "Meetings", title: "Technical Demo with Saudi Heavy Transport Director", due: "11:30", priority: "High" },
    { id: "t4", type: "Follow-ups", title: "Send payment link reminder to Apex Global Logistics", due: "16:45", priority: "Medium" },
    { id: "t5", type: "Pending Replies", title: "Reply to Al-Khobar Water Systems pricing inquiry email", due: "17:00", priority: "Medium" },
    { id: "t6", type: "Overdue Tasks", title: "Overdue: Log discovery call notes for Eastern Port", due: "Yesterday", priority: "High" }
  ];

  // Admin Actionable Alerts
  const adminAlerts = [
    { id: "a1", text: "2 quotations waiting over 24 hours for manager approval", type: "urgent" },
    { id: "a2", text: "3 overdue follow-up tasks requiring attention", type: "warning" },
    { id: "a3", text: "1 inactive deal with no touchpoint for 12 days (Eastern Port)", type: "warning" },
    { id: "a4", text: "1 high-value customer waiting 48 hours for quotation revision (ABC Industries)", type: "urgent" }
  ];

  const toggleTask = (taskId: string) => {
    setTaskState(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-3 bg-[#fcfcfc] dark:bg-slate-950">
      <div className="w-8 h-8 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading Command Center...</p>
    </div>
  );

  if (error || !rep) return (
    <div className="p-12 text-center max-w-md mx-auto space-y-4">
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-slate-900 text-lg">Salesperson Workspace Unavailable</h3>
      <p className="text-xs text-slate-500">Could not retrieve workload data for this sales executive.</p>
      <button onClick={() => navigate("/salespersons")} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-all">
        Back to Sales Executives
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-slate-900 selection:text-white">
      
      {/* ── TOP ACTION BAR (Breadcrumb & Employee Drawer Trigger) ── */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/salespersons")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-slate-400">Sales Executives</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-900 dark:text-white">{rep.name}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Command Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowInfoDrawer(true)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            Employee Information
          </button>
          <button onClick={() => navigate("/approvals")} className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Approvals ({pendingApprovalsCount})
          </button>
        </div>
      </div>

      <div className="max-w-[1536px] mx-auto px-8 py-8 space-y-8">

        {/* ─────────────────────────────────────────────────────────────
            HIGH PRIORITY: ADMIN ALERTS SECTION (Highest Priority Items)
           ───────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-950 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-rose-950">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Admin Action Alerts</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
              {adminAlerts.length} Critical Items Requiring Intervention
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {adminAlerts.map(alert => (
              <div key={alert.id} className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{alert.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            TOP KPI STRIP (Business-Critical Executive Cards)
           ───────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* Card 1: Active Deals */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">💼 Active Deals</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{activeDealsCount} Active Deals</p>
            <span className="text-[10px] text-slate-400 font-medium">Live Opportunities</span>
          </div>

          {/* Card 2: Pipeline Value */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">💰 Pipeline Value</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">SAR 5.2M</p>
            <span className="text-[10px] text-slate-400 font-medium">Total Open Volume</span>
          </div>

          {/* Card 3: Revenue Closed */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">📈 Revenue Closed (Month)</span>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">SAR 1.8M</p>
            <span className="text-[10px] text-emerald-600 font-medium">+12% vs last month</span>
          </div>

          {/* Card 4: Target Achievement */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">🎯 Target Progress</span>
              <span className="text-xs font-black text-slate-900 dark:text-white">{targetAchievementPct}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-slate-900 dark:bg-white h-full rounded-full transition-all duration-700" style={{ width: `${targetAchievementPct}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 block text-right">Goal: SAR 2.3M</span>
          </div>

          {/* Card 5: Pending Approvals */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">⏳ Pending Approvals</span>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">{pendingApprovalsCount} Pending</p>
            <span className="text-[10px] text-amber-600 font-medium">Requires Signoff</span>
          </div>

          {/* Card 6: Follow-ups Due Today */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">📞 Follow-ups Today</span>
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">{followupsTodayCount} Follow-ups</p>
            <span className="text-[10px] text-slate-400 font-medium">3 Meetings Scheduled</span>
          </div>

        </section>

        {/* ─────────────────────────────────────────────────────────────
            MAIN WORKSPACE LAYOUT (5 REPLACED CORE SECTIONS & SIDEBAR)
           ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT 8 COLUMNS: MAIN WORKSPACE SECTIONS */}
          <main className="lg:col-span-8 space-y-8">
            
            {/* Executive Workspace Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 text-xs font-bold">
              {[
                { id: "active-deals", label: `Active Deals (${activeDealsList.length})` },
                { id: "pending-quotes", label: `Pending Quotations (${pendingQuotationsList.length})` },
                { id: "todays-tasks", label: `Today's Tasks (${todayTasksList.length})` },
                { id: "pipeline-health", label: "Pipeline Health" },
                { id: "performance", label: "Performance Analytics" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "border-slate-900 text-slate-900 dark:border-white dark:text-white font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── SECTION 1: ACTIVE DEALS ── */}
            {activeTab === "active-deals" && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Deals Work Cards</h3>
                  <span className="text-xs text-slate-500 font-medium">Sorted by expected close date</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDealsList.map(deal => (
                    <div key={deal.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4 relative">
                      {deal.isBlocked && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{deal.blockReason}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{deal.customer}</h4>
                          <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STAGE_BADGES[deal.stage] || STAGE_BADGES["Proposal"]}`}>
                            {deal.stage}
                          </span>
                        </div>
                        <p className="font-black text-sm text-slate-900 dark:text-white">{formatCurrency(deal.value)}</p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-400">Last Activity:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{deal.lastActivity}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-400">Next Follow-up:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{deal.followUp}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-400">Expected Close:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{deal.closeDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          deal.priority === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {deal.priority} Priority
                        </span>

                        <Link to={`/leads/036e30da-298b-45bf-a3be-e08cfb8f8af4`} className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1">
                          Quick Open <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── SECTION 2: PENDING QUOTATIONS ── */}
            {activeTab === "pending-quotes" && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salesperson Quotations ({pendingQuotationsList.length})</h3>
                  <Link to="/quotes" className="text-xs font-bold text-slate-900 dark:text-white hover:underline">View All Quotes</Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-4">Customer</th>
                        <th className="p-4">Value</th>
                        <th className="p-4">Status Badge</th>
                        <th className="p-4">Submitted Date</th>
                        <th className="p-4">Approver</th>
                        <th className="p-4">Revision</th>
                        <th className="p-4 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pendingQuotationsList.map(q => (
                        <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            {q.customer}
                            <span className="block text-[10px] text-slate-400 font-normal">{q.number}</span>
                          </td>
                          <td className="p-4 font-extrabold text-slate-900 dark:text-white">{formatCurrency(q.amount)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${QUOTE_STATUS_BADGES[q.status] || QUOTE_STATUS_BADGES["Draft"]}`}>
                              {q.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-medium">{q.submittedDate}</td>
                          <td className="p-4 text-slate-500 font-medium">{q.approver}</td>
                          <td className="p-4 text-slate-500 font-medium">{q.revision}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {q.status === "Pending Approval" && (
                                <button onClick={() => navigate("/approvals")} className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-xs">
                                  Approve
                                </button>
                              )}
                              <button onClick={() => navigate("/quotes")} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold hover:bg-slate-200">
                                View
                              </button>
                              <button onClick={() => alert(`Sending reminder for ${q.number}`)} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold hover:bg-slate-200">
                                Reminder
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── SECTION 3: TODAY'S TASKS (Simple Checklist) ── */}
            {activeTab === "todays-tasks" && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Execution Checklist</h3>
                  <span className="text-xs font-bold text-slate-500">{Object.values(taskState).filter(Boolean).length} / {todayTasksList.length} Completed</span>
                </div>

                <div className="space-y-2.5">
                  {todayTasksList.map(t => {
                    const isDone = !!taskState[t.id];
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleTask(t.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          isDone
                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 line-through"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isDone ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          }`}>
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</p>
                            <span className="text-[10px] text-slate-400 font-medium">{t.type} • Due {t.due}</span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          t.priority === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── SECTION 4: PIPELINE HEALTH ── */}
            {activeTab === "pipeline-health" && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline Health & Distribution</h3>
                  <Link to="/pipeline" className="text-xs font-bold text-slate-900 dark:text-white hover:underline">Full Kanban Board</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {PIPELINE_STAGES.map(stage => {
                    const count = stage === "Proposal" ? 3 : stage === "Negotiation" ? 2 : stage === "Approval" ? 3 : stage === "Discovery" ? 2 : 1;
                    const value = count * 580000;
                    return (
                      <div key={stage} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between h-32">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">{stage}</span>
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center">
                            {count}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrencyCompact(value)}</p>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-slate-900 dark:bg-white h-full rounded-full" style={{ width: `${Math.min(100, count * 25)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── SECTION 5: PERFORMANCE ANALYTICS ── */}
            {activeTab === "performance" && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Win Rate</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">42.8%</p>
                  <p className="text-xs text-slate-500 font-medium">Based on 14 closed opportunities</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Lead Conversion Rate</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">38.4%</p>
                  <p className="text-xs text-slate-500 font-medium">Lead to Qualified Deal ratio</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Quote Conversion Rate</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">64.0%</p>
                  <p className="text-xs text-slate-500 font-medium">Sent Quotes converted to Won</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Average Deal Size</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">SAR 685K</p>
                  <p className="text-xs text-slate-500 font-medium">Average contract value</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Average Sales Cycle</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">22 Days</p>
                  <p className="text-xs text-slate-500 font-medium">Lead creation to Closed Won</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Avg First Response Time</span>
                  <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">18 mins</p>
                  <p className="text-xs text-slate-500 font-medium">Top 5% speed benchmark</p>
                </div>
              </section>
            )}

          </main>

          {/* RIGHT 4 COLUMNS: MANAGER ACTION CENTER & AI WORKLOAD ANALYSIS */}
          <aside className="lg:col-span-4 space-y-6">

            {/* Manager Action Center Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                Manager Action Center
              </h3>

              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => navigate("/rules")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 transition-all text-xs font-bold shadow-xs">
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign Lead
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => alert("Dispatching direct message...")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    Send Message
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => navigate("/approvals")} className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    Approve Discount
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => alert("Opening salesperson calendar review...")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Schedule Review & View Calendar
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => navigate("/rules")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    Reassign Lead
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Workload Analysis & Decision Card */}
            <div className="bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-5 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>AI Workload Analysis</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  Decision Engine
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Capacity</span>
                  <p className="text-base font-extrabold text-white mt-0.5">{activeDealsCount} / {rep.maxOpenLeads || 15} Deals</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Capacity</span>
                  <p className="text-base font-extrabold text-emerald-400 mt-0.5">{Math.max(0, (rep.maxOpenLeads || 15) - activeDealsCount)} Slots Open</p>
                </div>
              </div>

              {/* Lead Assignment Recommendation Card */}
              <div className={`p-4 rounded-xl border ${
                !isOverloaded 
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200" 
                  : "bg-amber-950/40 border-amber-500/50 text-amber-200"
              }`}>
                <div className="flex items-center gap-2 font-extrabold text-xs mb-1">
                  {!isOverloaded ? (
                    <>
                      <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>RECOMMENDED FOR NEW LEADS (+2 to +3 Leads)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>HOLD NEW LEAD ASSIGNMENTS</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium mt-1">
                  {!isOverloaded
                    ? `${rep.name} has 1 slot available and 18m avg first response speed. Safe to assign new enterprise leads.`
                    : `${rep.name} has 3 pending approvals and 2 high-priority blocked quotes waiting over 24h. Resolve approvals first.`
                  }
                </p>
              </div>

              {/* Stalled Opportunities & High Risk Accounts */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">High Risk & Stalled Opportunities</span>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="font-bold text-slate-200">ABC Industries</span>
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">48h Waiting</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="font-bold text-slate-200">Eastern Port Logistics</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">12 Days Inactive</span>
                  </div>
                </div>
              </div>
            </div>

          </aside>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          SLIDE-OUT DRAWER: EMPLOYEE INFORMATION (HR / PROFILE DATA)
         ───────────────────────────────────────────────────────────── */}
      {showInfoDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setShowInfoDrawer(false)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  {rep.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{rep.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">Employee Details & Profile</p>
                </div>
              </div>
              <button onClick={() => setShowInfoDrawer(false)} className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role & Designation</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">Sales Executive (Level 2)</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{rep.email || `${rep.name.toLowerCase().replace(" ", "")}@nexus.com`}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{rep.department || "Enterprise Commercial Sales"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Territory</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{rep.territory || "Middle East (Saudi Arabia & UAE)"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lead Capacity Controls</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">Maximum Open Deals: {rep.maxOpenLeads || 15}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowInfoDrawer(false)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
