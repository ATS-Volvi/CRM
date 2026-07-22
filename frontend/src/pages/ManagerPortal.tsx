import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Users, TrendingUp, Target, Award, DollarSign, CheckSquare, Shield,
  BarChart2, Zap, AlertTriangle, Plus, ChevronRight, ArrowUpRight,
  CheckCircle2, Clock, Filter, User, Building2, Trello, Sparkles, MessageSquare,
  RefreshCw, MapPin
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrencyCompact } from "../utils/currency";

export default function ManagerPortal() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"team" | "approvals" | "forecast" | "distribution" | "coaching" | "ai">("team");
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  // Form for coaching note
  const [coachingText, setCoachingText] = useState("");
  const [selectedCoachingRep, setSelectedCoachingRep] = useState("Henry Cavill");

  const managerName = user?.name || "Marcus Vance";
  const managerRole = "Regional Sales Director";
  const territory = "EMEA & APAC Operations";

  // Team performance metrics
  const teamMetrics = {
    totalRevenue: 3840000,
    targetQuota: 4500000,
    pipelineValue: 14200000,
    forecastedRevenue: 4120000,
    teamWinRate: 38.5,
    pendingApprovals: 4,
    repsAtRisk: 2
  };

  const teamReps = [
    { id: "s1", name: "Sophia Martinez", territory: "EMEA — Nordics & UK", target: "$150K", revenue: "$124.5K", pct: 83, dealsWon: 14, pipeline: "$1.45M", winRate: "42.8%", status: "On Track", avatar: "SM" },
    { id: "s2", name: "Henry Cavill", territory: "EMEA — Nordics", target: "$140K", revenue: "$151.2K", pct: 108, dealsWon: 12, pipeline: "$1.20M", winRate: "39.5%", status: "Exceeding", avatar: "HC" },
    { id: "s3", name: "Liam Carter", territory: "North America — East", target: "$160K", revenue: "$112.0K", pct: 70, dealsWon: 11, pipeline: "$980.0K", winRate: "34.0%", status: "Needs Support", avatar: "LC" },
    { id: "s4", name: "Ava Sterling", territory: "EMEA — DACH Region", target: "$130K", revenue: "$109.2K", pct: 84, dealsWon: 9, pipeline: "$850.0K", winRate: "36.2%", status: "On Track", avatar: "AS" },
    { id: "s5", name: "Noah Bennett", territory: "EMEA — UK & Ireland", target: "$145K", revenue: "$87.0K", pct: 60, dealsWon: 7, pipeline: "$720.0K", winRate: "29.4%", status: "At Risk", avatar: "NB" },
  ];

  const pendingApprovals = [
    { id: "a1", type: "Quote Discount Approval", client: "Aegis Systems Group", rep: "Sophia Martinez", amount: "$268,500", discount: "12% Enterprise Bundle", status: "Pending" },
    { id: "a2", type: "Special Pricing Request", client: "Apex Pharmaceuticals", rep: "Henry Cavill", amount: "$380,000", discount: "15% Multi-Year SLA", status: "Pending" },
    { id: "a3", type: "Purchase Order Verification", client: "Starlight Energy Inc.", rep: "Liam Carter", amount: "$520,000", discount: "Verified PO #9412", status: "Pending" },
  ];

  const coachingFeed = [
    { id: "c1", rep: "Henry Cavill", manager: "Marcus Vance", text: "Outstanding performance hitting 108% of quota in Nordics! Share your cleanroom proposal playbook with Noah Bennett.", date: "Today" },
    { id: "c2", rep: "Liam Carter", manager: "Marcus Vance", text: "Focus on accelerating proposal delivery for North America East leads to hit Q3 forecast.", date: "Yesterday" },
  ];

  const handleAddCoachingNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachingText.trim()) return;
    setCoachingText("");
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center font-black text-xl text-amber-300 shadow-inner">
            MV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{managerName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-400 text-slate-950 uppercase tracking-wider">
                Sales Manager Portal
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-1">{managerRole} · Region: {territory}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur p-4 rounded-xl border border-white/10">
          <div className="text-right">
            <p className="text-[10px] font-bold text-indigo-200 uppercase">Team Quota Achievement</p>
            <p className="text-lg font-black text-amber-300">{formatCurrencyCompact(teamMetrics.totalRevenue)} / {formatCurrencyCompact(teamMetrics.targetQuota)}</p>
            <p className="text-xs font-semibold text-emerald-300">Pipeline Coverage: 3.8x Quota</p>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-emerald-400 flex items-center justify-center font-black text-sm text-white">
            85%
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { key: "team", label: "Team Performance & Reps", icon: Users, badge: teamReps.length },
          { key: "approvals", label: "Approval Center", icon: Shield, badge: pendingApprovals.length },
          { key: "forecast", label: "Revenue Forecasting", icon: TrendingUp },
          { key: "distribution", label: "Lead Distribution", icon: Target },
          { key: "coaching", label: "Coaching Center", icon: User },
          { key: "ai", label: "AI Manager Assistant", icon: Sparkles },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
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

      {/* TEAM PERFORMANCE TAB */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Manager Action Strip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Manager Quick Tools:</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate("/rules")} className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors">
                ⚙ Assignment Rules
              </button>
              <button onClick={() => navigate("/approvals")} className="px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors">
                🛡 Approval Queues ({pendingApprovals.length})
              </button>
              <button onClick={() => navigate("/executive-bi")} className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors">
                📊 Executive BI Analytics
              </button>
            </div>
          </div>

          {/* Rep Performance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamReps.map(rep => (
              <div
                key={rep.id}
                onClick={() => navigate(`/salespersons/${rep.id}`)}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer space-y-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center">
                      {rep.avatar}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">{rep.name}</h3>
                      <p className="text-[11px] text-slate-500">{rep.territory}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    rep.status === "Exceeding" ? "bg-emerald-100 text-emerald-700" :
                    rep.status === "On Track" ? "bg-indigo-100 text-indigo-700" : "bg-red-100 text-red-700"
                  }`}>
                    {rep.status}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Monthly Target</span>
                    <span className="font-bold text-slate-800">{rep.revenue} / {rep.target}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rep.pct >= 90 ? "bg-emerald-500" : rep.pct >= 70 ? "bg-indigo-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, rep.pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>{rep.pct}% Achieved</span>
                    <span>Win Rate: {rep.winRate}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Deals Won</p>
                    <p className="font-extrabold text-slate-800">{rep.dealsWon}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Pipeline</p>
                    <p className="font-extrabold text-indigo-600">{rep.pipeline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* APPROVALS TAB */}
      {activeTab === "approvals" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Pending Manager Approval Queue ({pendingApprovals.length})
            </h3>
            <Link to="/approvals" className="text-xs font-bold text-purple-600 hover:underline">Open Full Approval Queue →</Link>
          </div>

          <div className="space-y-3">
            {pendingApprovals.map(app => (
              <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">{app.type}</span>
                    <h4 className="text-sm font-bold text-slate-900">{app.client}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Requested by: <span className="font-bold text-slate-700">{app.rep}</span> · Details: {app.discount}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900">{app.amount}</span>
                  <button onClick={() => navigate("/approvals")} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Approve</button>
                  <button onClick={() => navigate("/approvals")} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORECAST TAB */}
      {activeTab === "forecast" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Q3 Weighted Revenue Forecast
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Committed (Won Deals)</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">$3,840,000</p>
              <p className="text-xs text-slate-500 mt-1">100% Probability</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Best Case Projection</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">$4,850,000</p>
              <p className="text-xs text-slate-500 mt-1">Proposal & Negotiation Deals</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Weighted Forecast</p>
              <p className="text-2xl font-black text-purple-600 mt-1">$4,120,000</p>
              <p className="text-xs text-emerald-600 font-bold mt-1">91.5% of Q3 Target</p>
            </div>
          </div>
        </div>
      )}

      {/* COACHING TAB */}
      {activeTab === "coaching" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-800">Add Manager Coaching Note</h3>

            <form onSubmit={handleAddCoachingNote} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Sales Representative</label>
                  <select value={selectedCoachingRep} onChange={e => setSelectedCoachingRep(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold">
                    {teamReps.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Coaching Feedback / Action Item</label>
                <textarea value={coachingText} onChange={e => setCoachingText(e.target.value)} rows={3} placeholder="Provide specific feedback or deal action items..." className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold resize-none" />
              </div>

              <button type="submit" className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700">
                Save Coaching Note
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-800">Recent Coaching Feed</h4>
            {coachingFeed.map(c => (
              <div key={c.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="text-xs font-bold text-slate-800">Rep: {c.rep}</p>
                <p className="text-xs text-slate-600">{c.text}</p>
                <p className="text-[10px] text-slate-400 text-right">{c.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI ASSISTANT & DISTRIBUTION TABS */}
      {(activeTab === "distribution" || activeTab === "ai") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center py-12 space-y-3">
          <Sparkles className="w-12 h-12 text-purple-500 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-slate-800">AI Manager Assistant & Lead Redistribution</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">AI recommends rebalancing leads from Noah Bennett to Henry Cavill based on active capacity and win rate.</p>
        </div>
      )}

    </div>
  );
}
