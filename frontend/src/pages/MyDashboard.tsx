import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Sparkles, MessageSquare, PhoneCall, TrendingUp, DollarSign, Inbox, Target,
  CheckSquare, Calendar, ChevronRight, User, Clock, Activity, Zap, CheckCircle2,
  FileText, UserCheck, BarChart2, Plus, Star, X, Filter, ArrowUpRight, AlertTriangle
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";
import { apiClient } from "../lib/apiClient";

interface DashboardData {
  clientsCount: number;
  poValue: number;
  leadsCount: number;
  conversionRate: number;
  invoicesTotal: number;
}

interface TodayData {
  tasks: any[];
  followUpsNeeded: any[];
}

interface ManagementData {
  totalPipelineValue: number;
  totalWon: number;
  winRate: number;
}

interface SalespersonPerf {
  id: string;
  name: string;
  role: string;
  isAvailable: boolean;
  totalLeads: number;
  totalDeals?: number;
  revenueClosed: number;
  targetAchievementPct: number;
  department?: string;
  team?: string;
  status?: string;
  insight?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 25 } },
};

export default function MyDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const today = new Date();

  // Queries
  const { data } = useQuery<DashboardData>({
    queryKey: ["homeDashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dashboard/home`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: todayData } = useQuery<TodayData>({
    queryKey: ["todayDashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/today", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: mgmtData } = useQuery<ManagementData>({
    queryKey: ["managementDashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/management", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: salespersons = [] } = useQuery<SalespersonPerf[]>({
    queryKey: ["salespersonsPerf"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/salespersons/performance");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const [dismissedRecs, setDismissedRecs] = useState<string[]>([]);
  const displayName = user?.name?.split(" ")[0] || "Swastik";

  const priorityActionCards = [
    { id: "p1", title: "Unassigned Leads", count: 12, actionText: "Assign Leads", color: "bg-[#2563EB]/10 text-[#2563EB]", path: "/rules" },
    { id: "p2", title: "Quotes Awaiting Approval", count: 5, actionText: "Review", color: "bg-[#2563EB]/10 text-[#2563EB]", path: "/quotes" },
    { id: "p3", title: "At-Risk Deals", count: 3, actionText: "Rescue Deals", color: "bg-[#EF4444] text-white", path: "/pipeline" },
    { id: "p4", title: "Overdue Tasks", count: 8, actionText: "Resolve", color: "bg-[#2563EB]/10 text-[#2563EB]", path: "/home" },
  ];

  const repProfiles = salespersons.length > 0 ? salespersons.slice(0, 2) : [
    { id: "s1", name: "Rahul Sharma", role: "sales_rep", isAvailable: true, targetAchievementPct: 85, totalLeads: 14, revenueClosed: 1240, status: "Attention Needed", insight: "Rahul hasn't replied to 5 customers in the last 4 hours." },
    { id: "s2", name: "Ashwin K.", role: "sales_rep", isAvailable: true, targetAchievementPct: 112, totalLeads: 8, revenueClosed: 4890, status: "Top Performer", insight: "Exceeded today's daily target by 120%." },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-[#F8FAFC] text-[#111827] p-8 max-w-[1600px] mx-auto space-y-8 font-sans select-none"
    >
      
      {/* ─── HEADER BAR ───────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#111827]">
            Good Morning, {displayName} 👋
          </h1>
          <p className="text-xs font-medium text-[#6B7280] mt-1">
            Here's what requires your attention in the Pulse ecosystem today.
          </p>
        </div>

        {/* AI Daily Briefing Banner (Matching Exact Mockup Gradient Blue) */}
        <div className="bg-[#2563EB] rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-blue-500/10">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/10 rounded-xl shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 block mb-1">
                AI Daily Briefing
              </span>
              <p className="text-sm font-medium leading-relaxed">
                You have <span className="font-extrabold underline underline-offset-4 decoration-white/40 cursor-pointer" onClick={() => navigate("/communications")}>14 unread conversations</span>, 6 follow-ups due today, <span className="font-extrabold">3 high-value deals at risk</span>, and Rahul has missed two scheduled follow-ups.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/ai-reports")}
            className="px-5 py-2.5 bg-white text-[#2563EB] hover:bg-blue-50 rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <span>Action Briefing</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* ─── PRIORITY ACTIONS (4 CLEAN CARDS EXACTLY LIKE MOCKUP) ───────────────── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-[#6B7280]">
          Priority Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {priorityActionCards.map(card => (
            <div
              key={card.id}
              className={`bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all ${
                card.id === "p3" ? "ring-1 ring-rose-200" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[#6B7280]">
                  {card.id === "p1" && <UserCheck className="w-5 h-5" />}
                  {card.id === "p2" && <FileText className="w-5 h-5" />}
                  {card.id === "p3" && <AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
                  {card.id === "p4" && <Clock className="w-5 h-5" />}
                </div>
                <span className="text-3xl font-black text-[#111827]">{card.count}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#6B7280]">{card.title}</p>
              </div>
              <button
                onClick={() => navigate(card.path)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all text-center ${card.color}`}
              >
                {card.actionText}
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── PERFORMANCE ANALYTICS SECTION ───────────────────────────────────── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#6B7280]">
            Performance Analytics
          </h2>
          <Link to="/ai-reports" className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1">
            View Deep Analytics <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Revenue Growth Chart Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-bold text-[#111827]">Revenue Growth</h3>
                <p className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">Last 30 Days</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#111827]">$242.5k</span>
                <span className="block text-[10px] font-bold text-[#22C55E]">↑ 12.5%</span>
              </div>
            </div>
            
            {/* Smooth Curve Graphic */}
            <div className="h-28 w-full pt-4">
              <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="blueRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M 0,60 Q 50,45 100,55 T 200,30 T 300,10 L 300,80 L 0,80 Z" fill="url(#blueRevGrad)" />
                <path d="M 0,60 Q 50,45 100,55 T 200,30 T 300,10" fill="none" stroke="#2563EB" strokeWidth="3" />
                <circle cx="200" cy="30" r="4" fill="#2563EB" />
                <circle cx="300" cy="10" r="4" fill="#2563EB" />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-[#6B7280] font-medium pt-2 border-t border-slate-100">
              <span>1st Sep</span>
              <span>10th Sep</span>
              <span>20th Sep</span>
              <span>30th Sep</span>
            </div>
          </div>

          {/* Pipeline Velocity Ring Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold text-[#111827]">Pipeline Velocity</h3>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">Days to Close</p>
            </div>
            <div className="flex flex-col items-center justify-center py-2 relative">
              <div className="w-28 h-28 rounded-full border-8 border-slate-100 border-t-[#2563EB] border-r-[#2563EB] flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#111827]">14</span>
                <span className="text-[9px] font-bold text-[#6B7280] uppercase">Avg. Days</span>
              </div>
            </div>
            <div className="text-center text-[11px] text-[#6B7280]">
              <span className="font-bold text-[#22C55E]">3.2 days faster</span> than last month
            </div>
          </div>

          {/* Deal Distribution Donut Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold text-[#111827]">Deal Distribution</h3>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">By Stage</p>
            </div>
            <div className="flex items-center justify-around">
              <div className="w-24 h-24 rounded-full border-8 border-sky-400 border-t-[#2563EB] flex flex-col items-center justify-center">
                <span className="text-lg font-black text-[#111827]">104</span>
                <span className="text-[8px] font-bold text-[#6B7280] uppercase">Deals</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  <span className="text-[#6B7280]">Qualified:</span>
                  <span className="font-bold text-[#111827]">42</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-[#6B7280]">Proposal:</span>
                  <span className="font-bold text-[#111827]">32</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-300" />
                  <span className="text-[#6B7280]">Negotiation:</span>
                  <span className="font-bold text-[#111827]">15</span>
                </div>
              </div>
            </div>
            <div className="text-right text-[11px]">
              <Link to="/pipeline" className="text-[#2563EB] font-bold hover:underline">Full Pipeline →</Link>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ─── TEAM ACTIVITY HUB SECTION ───────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-[#6B7280]">
            Team Activity Hub
          </h2>
          <span className="text-[11px] font-bold text-[#22C55E] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" /> 4 Reps Online
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {repProfiles.map(rep => (
            <div
              key={rep.id}
              onClick={() => navigate(`/salespersons/${rep.id}`)}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-[#2563EB] font-black text-sm flex items-center justify-center">
                    {rep.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#111827]">{rep.name}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      rep.status && rep.status.includes("Attention") ? "bg-rose-50 text-[#EF4444]" : "bg-emerald-50 text-[#22C55E]"
                    }`}>
                      {rep.status || "Active"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-[#6B7280] uppercase">Today</p>
                  <p className="text-xs font-extrabold text-[#111827]">${rep.revenueClosed}</p>
                </div>
              </div>

              {/* Rep Insight Box */}
              <div className={`p-3 rounded-xl text-xs font-medium border ${
                rep.status && rep.status.includes("Attention") ? "bg-rose-50/60 border-rose-100 text-[#EF4444]" : "bg-emerald-50/60 border-emerald-100 text-[#22C55E]"
              }`}>
                "{rep.insight || "On track with daily quotas"}"
              </div>

              <div className="flex justify-between items-center text-[11px] text-[#6B7280] pt-2 border-t border-slate-100">
                <span>Open Leads: <strong className="text-[#111827]">{rep.totalLeads}</strong></span>
                <span>Target: <strong className="text-[#111827]">{rep.targetAchievementPct}%</strong></span>
              </div>
            </div>
          ))}

          {/* Weekly Interaction Heatmap Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-[#111827]">Weekly Activity Heatmap</h4>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">Interaction Frequency</p>
            </div>

            {/* Grid Heatmap Visual */}
            <div className="grid grid-cols-7 gap-1.5 py-1">
              {[
                ["bg-blue-100", "bg-blue-200", "bg-blue-400", "bg-blue-600", "bg-blue-300", "bg-blue-100", "bg-slate-100"],
                ["bg-blue-200", "bg-blue-500", "bg-blue-300", "bg-blue-700", "bg-blue-400", "bg-blue-200", "bg-slate-100"],
                ["bg-blue-300", "bg-blue-600", "bg-blue-500", "bg-blue-600", "bg-[#2563EB]", "bg-blue-100", "bg-slate-100"],
              ].map((row, rIdx) => (
                <React.Fragment key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <div key={cIdx} className={`h-6 rounded-md ${cell}`} />
                  ))}
                </React.Fragment>
              ))}
            </div>

            <div className="flex justify-between text-[9px] font-bold text-[#6B7280] uppercase px-1">
              <span>W</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── RECENT ACTIVITY & CONTINUE WORKING ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Recent Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Recent Activity Feed</h3>
            <span className="text-[10px] text-[#2563EB] font-bold cursor-pointer hover:underline" onClick={() => navigate("/customers")}>View All Activity</span>
          </div>
          <div className="space-y-3">
            {[
              { title: "John Doe opened quotation for Project Neptune", subtitle: "2 minutes ago • Sent by Ashwin", action: "View", icon: FileText, color: "text-[#2563EB] bg-blue-50" },
              { title: "Emily Watson replied via Instagram", subtitle: "14 minutes ago • 'When can we start?'", action: "Reply", icon: MessageSquare, color: "text-pink-600 bg-pink-50" },
              { title: "Payment received from ABC Corp", subtitle: "1 hour ago • Invoice #8829 ($4,500)", action: "+$4,500", icon: DollarSign, color: "text-[#22C55E] bg-emerald-50" },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111827]">{item.title}</p>
                      <p className="text-[10px] text-[#6B7280]">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#2563EB]">{item.action}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Continue Working Shortcuts (1 Col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Continue Working</h3>
          <div className="space-y-2.5">
            {[
              { name: "TechFlow Solutions", sub: "$12.5k Negotiation", path: "/customers?id=c1" },
              { name: "Sarah Jenkins", sub: "Proposal Sent Yesterday", path: "/quotes" },
              { name: "Global Logistics RFP", sub: "Drafting Stage", path: "/quotes/new" },
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate(item.path)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/60 hover:border-blue-200 transition-all cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-bold text-[#111827] group-hover:text-[#2563EB]">{item.name}</p>
                  <p className="text-[10px] text-[#6B7280]">{item.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#2563EB]" />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── AI MANAGER RECOMMENDATIONS ───────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-2xl p-6 border border-blue-100 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#2563EB]">
              AI Manager Recommendations • Proactive Insights
            </h3>
          </div>

          <div className="space-y-3">
            {[
              { id: "ai1", title: "Contact ABC Industries", tag: "High close chance", desc: "Activity patterns suggest they are ready to sign this week.", btn: "Assign Now", path: "/communications" },
              { id: "ai2", title: "Rahul needs assistance with the TechFlow deal", tag: "Stale 24h+", desc: "The client asked a technical question Rahul hasn't responded to in 24h.", btn: "Intervene", path: "/salespersons" },
            ].map(rec => (
              <div key={rec.id} className="bg-white rounded-xl p-4 border border-slate-200/80 flex items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-[#2563EB] rounded-lg">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#111827]">{rec.title}</h4>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-[#22C55E] rounded-full">
                        {rec.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{rec.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(rec.path)}
                  className="px-4 py-1.5 bg-white border border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95"
                >
                  {rec.btn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}
