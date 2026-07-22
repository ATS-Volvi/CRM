import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, TrendingUp, DollarSign, Users, Target, Shield, AlertTriangle,
  Building2, Globe, Activity, ArrowUpRight, CheckCircle2, ChevronRight, Zap,
  Briefcase, FileText, Package, Clock, Filter
} from "lucide-react";
import { formatCurrencyCompact } from "../utils/currency";

type BiRole = "ceo" | "sales" | "operations" | "finance" | "support";

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<BiRole>("ceo");
  const [filterTerritory, setFilterTerritory] = useState("All");

  const roles = [
    { key: "ceo", label: "CEO / Executive", icon: Building2 },
    { key: "sales", label: "Sales BI", icon: TrendingUp },
    { key: "operations", label: "Operations BI", icon: Activity },
    { key: "finance", label: "Finance BI", icon: DollarSign },
    { key: "support", label: "Support BI", icon: Shield },
  ];

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Top Header & Role Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Executive Business Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500">Decision-making dashboards tailored for C-suite, Sales, Ops, Finance & Support leaders.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {roles.map(r => {
            const Icon = r.icon;
            const isActive = activeRole === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setActiveRole(r.key as BiRole)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CEO / EXECUTIVE VIEW */}
      {activeRole === "ceo" && (
        <div className="space-y-6">
          {/* Top 4 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Annual Run-Rate Revenue", val: "SAR 49.8M", change: "+18.4% YoY", color: "border-indigo-500 text-indigo-600", path: "/invoices" },
              { label: "Quarterly Target Achievement", val: "88.4%", change: "On Track for Q3", color: "border-emerald-500 text-emerald-600", path: "/kpi" },
              { label: "Active Enterprise Accounts", val: "105", change: "+12 New Accounts", color: "border-purple-500 text-purple-600", path: "/customers" },
              { label: "Weighted Pipeline Forecast", val: "SAR 34.2M", change: "78% Win Probability", color: "border-amber-500 text-amber-600", path: "/pipeline" },
            ].map(kpi => (
              <div
                key={kpi.label}
                onClick={() => navigate(kpi.path)}
                className={`bg-white p-5 rounded-2xl border-l-4 border-y border-r border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group ${kpi.color}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{kpi.val}</p>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mt-2">
                  <span>{kpi.change}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>

          {/* Regional & Industry Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Regional Revenue Map / Grid */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" /> Regional Performance & Revenue
              </h3>
              <div className="space-y-3">
                {[
                  { region: "EMEA — Nordics & UK", revenue: "SAR 18.4M", share: 37, growth: "+22%" },
                  { region: "North America — East & West", revenue: "SAR 14.2M", share: 29, growth: "+14%" },
                  { region: "EMEA — DACH & MEA", revenue: "SAR 10.8M", share: 22, growth: "+19%" },
                  { region: "APAC — Greater China & Japan", revenue: "SAR 6.4M", share: 12, growth: "+8%" },
                ].map(r => (
                  <div key={r.region} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{r.region}</span>
                      <span className="font-extrabold text-indigo-600">{r.revenue}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${r.share}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{r.share}% total share</span>
                      <span className="text-emerald-600 font-bold">{r.growth} YoY</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Industry Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" /> Key Industry Vertical Breakdown
              </h3>
              <div className="space-y-3">
                {[
                  { industry: "Manufacturing & Industrial", count: "34 Clients", revenue: "SAR 19.2M", color: "bg-indigo-600" },
                  { industry: "Pharmaceutical & Healthcare", count: "22 Clients", revenue: "SAR 12.8M", color: "bg-purple-600" },
                  { industry: "Food & Beverage / FMCG", count: "19 Clients", revenue: "SAR 9.5M", color: "bg-pink-600" },
                  { industry: "Logistics & Supply Chain", count: "16 Clients", revenue: "SAR 5.3M", color: "bg-emerald-600" },
                  { industry: "Automotive & Chemical", count: "14 Clients", revenue: "SAR 3.0M", color: "bg-amber-600" },
                ].map(ind => (
                  <div key={ind.industry} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${ind.color}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{ind.industry}</p>
                        <p className="text-[10px] text-slate-400">{ind.count}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900">{ind.revenue}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SALES BI VIEW */}
      {activeRole === "sales" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-800">Sales Intelligence & Funnel Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Average Deal Cycle</p>
              <p className="text-2xl font-black text-slate-900 mt-1">18.4 Days</p>
              <p className="text-xs text-emerald-600 font-bold mt-1">↓ 3.2 days faster</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Proposal Win Rate</p>
              <p className="text-2xl font-black text-slate-900 mt-1">68.2%</p>
              <p className="text-xs text-emerald-600 font-bold mt-1">↑ 5.4% vs team avg</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Average ACV Deal Size</p>
              <p className="text-2xl font-black text-slate-900 mt-1">SAR 285.0K</p>
              <p className="text-xs text-emerald-600 font-bold mt-1">↑ 12% YoY</p>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE BI VIEW */}
      {activeRole === "finance" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-800">Financial Ledger & Billing Intelligence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Paid Invoices (MTD)</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">SAR 3.8M</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Outstanding Collections (NET 30)</p>
              <p className="text-2xl font-black text-amber-600 mt-1">SAR 1.2M</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase">Verified Purchase Orders</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">75 POs</p>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS & SUPPORT VIEWS */}
      {(activeRole === "operations" || activeRole === "support") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center py-12 space-y-3">
          <Activity className="w-12 h-12 text-indigo-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">{activeRole.toUpperCase()} Operations Intelligence</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Tracking deployment milestones, cleanroom surveys, EHS tickets & SLA compliance.</p>
        </div>
      )}

    </div>
  );
}
