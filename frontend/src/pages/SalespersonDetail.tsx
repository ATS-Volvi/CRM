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
  FileText, ArrowUpRight, Flame, Layers, CircleCheck, AlertCircle, Plus
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

const STAGES = ["Qualification", "Meeting", "Proposal", "Approval", "Negotiation", "Won", "Lost"];

const STAGE_BADGES: Record<string, string> = {
  Qualification: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  Meeting: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  Proposal: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  Approval: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  Negotiation: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  Lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
};

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("active-deals");
  const [taskState, setTaskState] = useState<Record<string, boolean>>({
    t1: false, t2: false, t3: true, t4: false, t5: false
  });
  const [capacity, setCapacity] = useState<number>(15);

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

  // Calculate Metrics for Hero Section & Workload AI
  const revTarget = kpiTargets?.find(t => t.kpiName === "Revenue Closed")?.targetValue || 250000;
  const closedRevenue = kpiTargets?.find(t => t.kpiName === "Revenue Closed")?.currentValue || (rep?.wonLeads?.length ? rep.wonLeads.length * 85000 : 185000);
  const targetPct = Math.min(100, Math.round((closedRevenue / revTarget) * 100));

  const totalDeals = rep?.totalDeals || 12;
  const activeDealsCount = rep?.dealTypes ? rep.dealTypes.filter(d => !["Won", "Lost"].includes(d.stage)).reduce((acc, d) => acc + d.count, 0) : 8;
  const totalPipelineValue = activeDealsCount * 64000;
  
  const pendingQuotesCount = rep?.quotes ? rep.quotes.filter(q => ["Draft", "Sent", "Pending Approval"].includes(q.status)).length : 4;
  const approvalsWaitingCount = rep?.quotes ? rep.quotes.filter(q => q.status === "Pending Approval").length : 2;
  
  const followupsToday = 6;
  const meetingsToday = 3;
  const currentWorkloadPct = Math.round((activeDealsCount / (rep?.maxOpenLeads || 15)) * 100);
  const canReceiveMoreLeads = currentWorkloadPct < 80 && rep?.isAvailable !== false;

  // Active Deals Data
  const activeDealsList = useMemo(() => {
    if (!rep) return [];
    return [
      { id: "d1", customer: "Apex Global Logistics", stage: "Negotiation", value: 145000, nextAction: "Finalize SLA Terms & Discount Approval", followUp: "Today, 14:00", priority: "High", isBlocked: true, blockReason: "Waiting on 12% Discount Admin Approval" },
      { id: "d2", customer: "GreenPack Industrial Co.", stage: "Proposal", value: 92000, nextAction: "Send Revised Equipment Line Items Quote", followUp: "Today, 16:30", priority: "High", isBlocked: false },
      { id: "d3", customer: "Metro Chemical Refineries", stage: "Approval", value: 210000, nextAction: "Admin Approval for Enterprise Payment Terms", followUp: "Tomorrow, 10:00", priority: "High", isBlocked: true, blockReason: "Quote #QT-9921 Pending Admin Signoff" },
      { id: "d4", customer: "Saudi Heavy Transport", stage: "Meeting", value: 68000, nextAction: "Technical BOM Demo with Fleet Director", followUp: "Today, 11:30", priority: "Medium", isBlocked: false },
      { id: "d5", customer: "Eastern Port Logistics", stage: "Qualification", value: 45000, nextAction: "Discovery call on warehouse capacity", followUp: "08 Aug, 09:00", priority: "Low", isBlocked: false },
      { id: "d6", customer: "Al-Khobar Water Systems", stage: "Proposal", value: 115000, nextAction: "Submit Portacabin Specs & Delivery Timeline", followUp: "09 Aug, 15:00", priority: "Medium", isBlocked: false }
    ];
  }, [rep]);

  // Pending Quotations Data
  const pendingQuotationsList = useMemo(() => {
    return [
      { id: "q1", number: "QT-2026-881", customer: "Apex Global Logistics", amount: 145000, status: "Pending Approval", submittedDate: "05 Aug 2026", approver: "Admin User", revision: "Rev 2", hasDiscount: true },
      { id: "q2", number: "QT-2026-894", customer: "Metro Chemical Refineries", amount: 210000, status: "Pending Approval", submittedDate: "06 Aug 2026", approver: "Admin User", revision: "Rev 1", hasDiscount: false },
      { id: "q3", number: "QT-2026-772", customer: "GreenPack Industrial Co.", amount: 92000, status: "Sent to Client", submittedDate: "03 Aug 2026", approver: "Auto-Approved", revision: "Rev 0", hasDiscount: false },
      { id: "q4", number: "QT-2026-640", customer: "Al-Khobar Water Systems", amount: 115000, status: "Draft", submittedDate: "Today", approver: "Pending", revision: "Rev 0", hasDiscount: true }
    ];
  }, []);

  // Today's Tasks
  const todayChecklist = [
    { id: "t1", title: "Follow-up call on SLA discount approval with Apex Global", category: "Call", due: "14:00", priority: "High" },
    { id: "t2", title: "Submit revised Portacabin line items for Al-Khobar Water", category: "Quote Revision", due: "15:30", priority: "High" },
    { id: "t3", title: "Technical Demo with Saudi Heavy Transport Director", category: "Meeting", due: "11:30", priority: "High" },
    { id: "t4", title: "Send payment link reminder to GreenPack Industrial", category: "Follow-up", due: "16:45", priority: "Medium" },
    { id: "t5", title: "Review monthly target progress with Admin", category: "Reminder", due: "17:30", priority: "Low" }
  ];

  const toggleTask = (taskId: string) => {
    setTaskState(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-3 bg-slate-50 dark:bg-slate-950">
      <div className="w-8 h-8 border-3 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading Executive Command Center...</p>
    </div>
  );

  if (error || !rep) return (
    <div className="p-12 text-center max-w-md mx-auto space-y-4">
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-slate-900 text-lg">Salesperson Workspace Unavailable</h3>
      <p className="text-xs text-slate-500">Could not retrieve workload data for this sales executive.</p>
      <button onClick={() => navigate("/salespersons")} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 transition-all">
        Back to Sales Executives
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-slate-900 selection:text-white">
      
      {/* ── TOP NAVIGATION BREADCRUMB HEADER ── */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/salespersons")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-slate-400">Sales Executives</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-900 dark:text-white">{rep.name}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Command Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => alert("Sending direct dispatch message to salesperson...")} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            Message Rep
          </button>
          <button onClick={() => navigate(`/approvals`)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Approval Center ({approvalsWaitingCount})
          </button>
        </div>
      </div>

      <div className="max-w-[1536px] mx-auto px-8 py-8 space-y-8">

        {/* ─────────────────────────────────────────────────────────────
            HERO SECTION: Salesperson Performance & Workload Banner
           ───────────────────────────────────────────────────────────── */}
        <header className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Identity & Status */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 text-white flex items-center justify-center font-black text-xl shadow-md shadow-purple-500/20 shrink-0">
                {rep.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{rep.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                    rep.isAvailable !== false
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${rep.isAvailable !== false ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    {rep.isAvailable !== false ? "Available for Assignment" : "At Max Capacity"}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Sales Executive</span>
                  <span>•</span>
                  <span>{rep.territory || "Middle East Territory"}</span>
                  <span>•</span>
                  <span>{rep.email || `${rep.name.toLowerCase().replace(" ", "")}@nexus.com`}</span>
                </div>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3.5 min-w-[280px]">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Target Progress</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{targetPct}% ({formatCurrencyCompact(closedRevenue)})</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${targetPct}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-1">Goal: {formatCurrencyCompact(revTarget)}</p>
            </div>
          </div>

          {/* Metric Strip (Clean Desktop Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 pt-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pipeline Value</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{formatCurrencyCompact(totalPipelineValue)}</p>
              <span className="text-[10px] text-slate-400 font-medium">Active Deals Total</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Revenue Closed</span>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{formatCurrencyCompact(closedRevenue)}</p>
              <span className="text-[10px] text-emerald-600 font-medium">+12% vs last month</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Deals</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{activeDealsCount}</p>
              <span className="text-[10px] text-slate-400 font-medium">Live Opportunities</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Quotes</span>
              <p className="text-lg font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">{pendingQuotesCount}</p>
              <span className="text-[10px] text-slate-400 font-medium">Awaiting Action</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approvals Waiting</span>
              <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">{approvalsWaitingCount}</p>
              <span className="text-[10px] text-amber-600 font-medium">Requires Admin Review</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Follow-ups Today</span>
              <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">{followupsToday}</p>
              <span className="text-[10px] text-slate-400 font-medium">{meetingsToday} Client Meetings</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Workload Cap</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{activeDealsCount} / {rep.maxOpenLeads || 15}</p>
              <span className="text-[10px] text-slate-400 font-medium">{currentWorkloadPct}% Capacity</span>
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            MAIN WORKSPACE LAYOUT (5 CORE SECTIONS & RIGHT SIDEBAR)
           ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT 8 COLUMNS: MAIN WORKSPACE SECTIONS */}
          <main className="lg:col-span-8 space-y-8">
            
            {/* Section Tab Bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-bold">
              {[
                { id: "active-deals", label: `Active Deals (${activeDealsList.length})` },
                { id: "pending-quotes", label: `Pending Quotations (${pendingQuotationsList.length})` },
                { id: "todays-tasks", label: `Today's Tasks (${todayChecklist.length})` },
                { id: "pipeline-snapshot", label: "Pipeline Snapshot" },
                { id: "performance", label: "Performance Analytics" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 border-b-2 transition-all cursor-pointer ${
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
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Opportunities ({activeDealsList.length})</h3>
                  <span className="text-xs text-slate-500 font-medium">Sorted by Priority & Follow-up</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDealsList.map(deal => (
                    <div key={deal.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4 relative group">
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
                          <span className="font-medium text-slate-400">Next Action:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[180px]">{deal.nextAction}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-400">Follow-up:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{deal.followUp}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          deal.priority === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {deal.priority} Priority
                        </span>

                        <Link to={`/leads/036e30da-298b-45bf-a3be-e08cfb8f8af4`} className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1">
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
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quotations Awaiting Action ({pendingQuotationsList.length})</h3>
                  <Link to="/quotes" className="text-xs font-bold text-purple-600 hover:underline">View All Quotes</Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-4">Quote #</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Revision</th>
                        <th className="p-4">Approver</th>
                        <th className="p-4 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pendingQuotationsList.map(q => (
                        <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">{q.number}</td>
                          <td className="p-4 font-bold">{q.customer}</td>
                          <td className="p-4 font-extrabold text-slate-900 dark:text-white">{formatCurrency(q.amount)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              q.status === "Pending Approval" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {q.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-medium">{q.revision}</td>
                          <td className="p-4 text-slate-500 font-medium">{q.approver}</td>
                          <td className="p-4 text-right">
                            {q.status === "Pending Approval" ? (
                              <button onClick={() => navigate("/approvals")} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-xs">
                                Approve Quote
                              </button>
                            ) : (
                              <button onClick={() => navigate("/quotes")} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold hover:bg-slate-200">
                                Review
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── SECTION 3: TODAY'S TASKS ── */}
            {activeTab === "todays-tasks" && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Executive Checklist ({todayChecklist.length})</h3>
                  <span className="text-xs font-bold text-slate-500">{Object.values(taskState).filter(Boolean).length} / {todayChecklist.length} Completed</span>
                </div>

                <div className="space-y-2.5">
                  {todayChecklist.map(t => {
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
                            isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          }`}>
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</p>
                            <span className="text-[10px] text-slate-400 font-medium">{t.category} • Due {t.due}</span>
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

            {/* ── SECTION 4: PIPELINE SNAPSHOT (COMPACT KANBAN) ── */}
            {activeTab === "pipeline-snapshot" && (
              <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline Stage Distribution</h3>
                  <Link to="/pipeline" className="text-xs font-bold text-purple-600 hover:underline">Full Kanban Board</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto pb-2">
                  {STAGES.map(stage => {
                    const count = stage === "Proposal" ? 3 : stage === "Negotiation" ? 2 : stage === "Approval" ? 2 : 1;
                    return (
                      <div key={stage} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between h-36">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">{stage}</span>
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center">
                            {count}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrencyCompact(count * 55000)}</p>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(100, count * 30)}%` }} />
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
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Win Rate</span>
                  <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">42.8%</p>
                  <p className="text-xs text-slate-500 font-medium">+4.2% above team benchmark</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Deal Size</span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">$68,500</p>
                  <p className="text-xs text-slate-500 font-medium">Based on 14 closed won deals</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg First Response Time</span>
                  <p className="text-3xl font-extrabold text-purple-600 tracking-tight">18 mins</p>
                  <p className="text-xs text-emerald-600 font-medium">⚡ Top 5% speed in Middle East</p>
                </div>
              </section>
            )}

          </main>

          {/* RIGHT 4 COLUMNS: EXECUTIVE ACTIONS & AI WORKLOAD SUMMARY */}
          <aside className="lg:col-span-4 space-y-6">

            {/* Quick Actions Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                Executive Management Actions
              </h3>

              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => navigate("/rules")} className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 hover:bg-purple-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign New Lead
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => alert("Dispatching direct message...")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    Message Salesperson
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => navigate("/approvals")} className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    Approve Discount / Quote
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => alert("Opening salesperson calendar review...")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    View Calendar & Schedule Review
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button onClick={() => navigate("/rules")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    Reassign Lead Opportunities
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Workload Summary & Recommendation Engine */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950 text-white rounded-2xl p-6 shadow-md space-y-5 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-400">
                  <Zap className="w-4 h-4 text-purple-400 fill-purple-400" />
                  <span>AI Workload Recommendation</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Live Engine
                </span>
              </div>

              {/* Lead Assignment Recommendation Card */}
              <div className={`p-4 rounded-xl border ${
                canReceiveMoreLeads 
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200" 
                  : "bg-amber-950/40 border-amber-500/50 text-amber-200"
              }`}>
                <div className="flex items-center gap-2 font-extrabold text-sm mb-1">
                  {canReceiveMoreLeads ? (
                    <>
                      <CircleCheck className="w-4 h-4 text-emerald-400" />
                      <span>RECOMMENDED FOR NEW LEADS</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>HOLD NEW LEAD ASSIGNMENTS</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {canReceiveMoreLeads
                    ? `${rep.name} is currently operating at ${currentWorkloadPct}% capacity with an avg response speed of 18m. Safe to assign 3-4 new enterprise leads.`
                    : `${rep.name} has 2 deals blocked on discount approval and 6 follow-ups due today. Resolve blocked deals before routing new leads.`
                  }
                </p>
              </div>

              {/* Risk & Blocked Deals Summary */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Risk Alerts & Blocked Deals</span>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="font-bold text-slate-200">Apex Global Logistics</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">Discount Blocked</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="font-bold text-slate-200">Metro Chemical Refineries</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">Approval Required</span>
                  </div>
                </div>
              </div>
            </div>

          </aside>

        </div>

      </div>

    </div>
  );
}
