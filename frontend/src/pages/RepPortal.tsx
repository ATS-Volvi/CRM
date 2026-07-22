import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, Target, Award, DollarSign, Users, Inbox, Trello, FileText,
  Calendar, PhoneCall, Video, MapPin, CheckSquare, Sparkles, Trophy, Plus,
  ChevronRight, ArrowUpRight, Zap, Shield, User, MessageSquare, Clock, AlertCircle
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrencyCompact } from "../utils/currency";

export default function RepPortal() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "customers" | "opportunities" | "leaderboard" | "coaching">("overview");

  const repName = user?.name || "Liam Carter";
  const repRole = "Enterprise Sales Executive";
  const territory = user?.territory || "North America — East";

  // Data metrics
  const monthlyTarget = 150000;
  const monthlyAchieved = 124500;
  const targetPct = Math.round((monthlyAchieved / monthlyTarget) * 100);
  const estCommission = Math.round(monthlyAchieved * 0.08); // 8% commission rate
  const targetBonus = 12000;

  const assignedLeads = [
    { id: "l1", name: "Linda Martinez", company: "Aegis Systems Group", score: 94, status: "Qualified", val: "$268.5k", lastContact: "Today, 10:42 AM" },
    { id: "l2", name: "Christopher Lee", company: "Apex Pharmaceuticals", score: 88, status: "Contacted", val: "$195.0k", lastContact: "Today, 09:15 AM" },
    { id: "l3", name: "Sarah Flores", company: "Starlight Energy Inc.", score: 82, status: "New", val: "$520.0k", lastContact: "Jul 20" },
  ];

  const assignedCustomers = [
    { id: "c1", name: "Aegis Systems Group", industry: "Manufacturing", health: 92, revenue: "$642.5k", openDeals: 1, lastMeeting: "Today" },
    { id: "c2", name: "Apex Pharmaceuticals", industry: "Pharmaceutical", health: 85, revenue: "$380.0k", openDeals: 2, lastMeeting: "Yesterday" },
    { id: "c3", name: "Matrix Pharmaceuticals", industry: "Healthcare", health: 78, revenue: "$195.0k", openDeals: 1, lastMeeting: "Jul 18" },
  ];

  const leaderboardReps = [
    { rank: 1, name: `${repName} (You)`, dealsWon: 14, revenue: "$580.5K", pct: 108, badge: "🥇 Top Performer" },
    { rank: 2, name: "Henry Cavill", dealsWon: 12, revenue: "$490.0K", pct: 98, badge: "🥈 Deal Closer" },
    { rank: 3, name: "Sophia Martinez", dealsWon: 11, revenue: "$420.0K", pct: 92, badge: "🥉 Pipeline Ace" },
    { rank: 4, name: "Ava Sterling", dealsWon: 9, revenue: "$360.0K", pct: 84, badge: "⭐ Rising Star" },
  ];

  const coachingNotes = [
    { id: "n1", date: "Jul 21", manager: "Marcus Vance", text: `Excellent job closing the Aegis Systems account extension, ${repName}! Focus on securing client signature for Apex Pharma quote by Friday.`, tag: "Praise" },
    { id: "n2", date: "Jul 18", manager: "Marcus Vance", text: "Make sure to update probability fields on deals in Negotiation stage for accurate forecast.", tag: "Action Item" },
  ];

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center font-black text-xl text-amber-300 shadow-inner">
            {repName.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{repName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider">
                Sales Rep Portal
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-1">{repRole} · Territory: {territory}</p>
          </div>
        </div>

        {/* Quick Target Progress Ring & Commission Card */}
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur p-4 rounded-xl border border-white/10">
          <div className="text-right">
            <p className="text-[10px] font-bold text-indigo-200 uppercase">Monthly Target Progress</p>
            <p className="text-lg font-black text-amber-300">{formatCurrencyCompact(monthlyAchieved)} / {formatCurrencyCompact(monthlyTarget)}</p>
            <p className="text-xs font-semibold text-emerald-300">Estimated Commission: ${estCommission.toLocaleString()}</p>
          </div>

          <div className="w-14 h-14 rounded-full border-4 border-amber-400 flex items-center justify-center font-black text-sm text-white">
            {targetPct}%
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { key: "overview", label: "My Dashboard", icon: Zap },
          { key: "leads", label: "My Assigned Leads", icon: Inbox, badge: assignedLeads.length },
          { key: "customers", label: "My Account Portfolio", icon: Users, badge: assignedCustomers.length },
          { key: "opportunities", label: "My Pipeline Kanban", icon: Trello },
          { key: "leaderboard", label: "Leaderboard & Rewards", icon: Trophy },
          { key: "coaching", label: "Manager Coaching & AI", icon: Sparkles },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* Quick Action Launcher Strip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quick Actions:</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate("/leads/new")} className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors">
                + Create Lead
              </button>
              <button onClick={() => navigate("/activities")} className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors">
                📞 Log Call
              </button>
              <button onClick={() => navigate("/activities")} className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors">
                📅 Schedule Meeting
              </button>
              <button onClick={() => navigate("/quotes/new")} className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors">
                📄 Generate Quote
              </button>
            </div>
          </div>

          {/* 4 Performance Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revenue Closed (MTD)</p>
              <p className="text-2xl font-black text-slate-900">$124,500</p>
              <p className="text-xs font-bold text-emerald-600">83% of monthly quota</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Win Rate</p>
              <p className="text-2xl font-black text-slate-900">42.8%</p>
              <p className="text-xs font-bold text-emerald-600">vs 34% team average</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Pipeline Value</p>
              <p className="text-2xl font-black text-slate-900">$1,450,000</p>
              <p className="text-xs font-bold text-indigo-600">8 open opportunities</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incentive Commission</p>
              <p className="text-2xl font-black text-amber-600">${estCommission.toLocaleString()}</p>
              <p className="text-xs font-bold text-amber-700">+$12K target bonus pending</p>
            </div>
          </div>

          {/* Assigned Leads & Today's Workspace Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* My Assigned Leads */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-indigo-600" /> My Assigned Leads ({assignedLeads.length})
                </h3>
                <Link to="/leads" className="text-xs font-bold text-indigo-600 hover:underline">View All →</Link>
              </div>

              <div className="space-y-3">
                {assignedLeads.map(l => (
                  <div key={l.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{l.name} — {l.company}</p>
                      <p className="text-[11px] text-slate-500">Status: {l.status} · Score: {l.score}/100</p>
                      <p className="text-[10px] text-slate-400">Last contact: {l.lastContact}</p>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600">{l.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* My Customer Portfolio */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" /> My Customer Portfolio ({assignedCustomers.length})
                </h3>
                <Link to="/customers" className="text-xs font-bold text-purple-600 hover:underline">View Portfolio →</Link>
              </div>

              <div className="space-y-3">
                {assignedCustomers.map(c => (
                  <div key={c.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.industry} · Health: {c.health}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-indigo-600">{c.revenue}</p>
                      <p className="text-[10px] text-slate-400">{c.openDeals} open deal</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* LEADERBOARD TAB */}
      {activeTab === "leaderboard" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Sales Leaderboard & Gamification Rewards
            </h3>
            <span className="text-xs font-bold text-slate-400">Updated Daily</span>
          </div>

          <div className="space-y-3">
            {leaderboardReps.map(r => (
              <div key={r.rank} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                r.rank === 1 ? "bg-amber-50/60 border-amber-200 shadow-xs" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-white border border-slate-200 font-extrabold text-sm flex items-center justify-center text-slate-700 shadow-2xs">
                    #{r.rank}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">{r.badge}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-extrabold text-indigo-600">{r.revenue}</p>
                  <p className="text-xs font-semibold text-emerald-600">{r.pct}% Quota Hit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COACHING & AI TAB */}
      {activeTab === "coaching" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" /> Manager Coaching Notes & Weekly Reviews
            </h3>

            <div className="space-y-3">
              {coachingNotes.map(n => (
                <div key={n.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">{n.manager}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{n.tag}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.text}</p>
                  <p className="text-[10px] text-slate-400 pt-1">{n.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LEADS */}
      {activeTab === "leads" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-600" /> My Assigned Leads ({assignedLeads.length})
            </h3>
            <button onClick={() => navigate("/leads/new")} className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
              + Create Lead
            </button>
          </div>

          <div className="space-y-3">
            {assignedLeads.map(l => (
              <div key={l.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{l.name} — <span className="text-indigo-600">{l.company}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">Status: <span className="font-semibold text-slate-700">{l.status}</span> · Lead Score: <span className="font-bold text-emerald-600">{l.score}/100</span> · Last Contact: {l.lastContact}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900">{l.val}</span>
                  <button onClick={() => navigate("/leads")} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold">
                    View Lead →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: CUSTOMERS */}
      {activeTab === "customers" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> My Account Portfolio ({assignedCustomers.length})
            </h3>
            <button onClick={() => navigate("/customers")} className="text-xs font-bold text-purple-600 hover:underline">
              Open Customer 360 Hub →
            </button>
          </div>

          <div className="space-y-3">
            {assignedCustomers.map(c => (
              <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.industry} · Health Score: <span className="font-bold text-emerald-600">{c.health}%</span> · Last Meeting: {c.lastMeeting}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-indigo-600">{c.revenue}</p>
                    <p className="text-[10px] text-slate-400">{c.openDeals} open deal</p>
                  </div>
                  <button onClick={() => navigate("/customers")} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">
                    Open 360 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: OPPORTUNITIES / KANBAN */}
      {activeTab === "opportunities" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Trello className="w-5 h-5 text-indigo-600" /> My Opportunities Kanban & Pipeline
            </h3>
            <button onClick={() => navigate("/pipeline")} className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
              Open Full Kanban →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-indigo-600">Qualified Stage</span>
              <p className="text-sm font-bold text-slate-900 mt-1">Aegis Systems Extension</p>
              <p className="text-xs font-extrabold text-indigo-700 mt-0.5">$268,500 · 60% Prob</p>
            </div>
            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-purple-600">Proposal Stage</span>
              <p className="text-sm font-bold text-slate-900 mt-1">Apex Pharma Cleanroom</p>
              <p className="text-xs font-extrabold text-purple-700 mt-0.5">$195,000 · 75% Prob</p>
            </div>
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-600">Negotiation Stage</span>
              <p className="text-sm font-bold text-slate-900 mt-1">Starlight Energy Renewal</p>
              <p className="text-xs font-extrabold text-emerald-700 mt-0.5">$520,000 · 90% Prob</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
