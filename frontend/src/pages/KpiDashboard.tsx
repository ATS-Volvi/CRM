import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, Download, FileText, Calendar, 
  TrendingUp, TrendingDown, Target, Settings, ChevronDown, Award
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function KpiDashboard() {
  const { token } = useAuth();
  const [dateRange, setDateRange] = useState("This Month");
  const [comparePeriod, setComparePeriod] = useState("Last Month");
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetValues, setTargetValues] = useState({ revenue: "1000000", leads: "500", winRate: "30" });

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-kpi", dateRange],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/kpi", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    }
  });

  const exportPDF = () => alert("Exporting to PDF...");
  const exportExcel = () => alert("Exporting to Excel...");

  const kpis = dashboardData?.kpis || [
    { label: "Total Revenue", value: 850000, trend: 12, target: parseInt(targetValues.revenue) },
    { label: "New Leads", value: 420, trend: -5, target: parseInt(targetValues.leads) },
    { label: "Win Rate", value: 28, trend: 2, target: parseInt(targetValues.winRate), isPercentage: true }
  ];

  const leaderboard = dashboardData?.leaderboard || [
    { id: 1, name: "Sarah Jenkins", score: 95, revenue: 320000, rank: 1 },
    { id: 2, name: "David Chen", score: 88, revenue: 210000, rank: 2 },
    { id: 3, name: "Omar Al-Qahtani", score: 82, revenue: 180000, rank: 3 },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-8">
      {/* Header and Controls */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">KPI Dashboard</h1>
          <p className="text-on-surface-variant mt-2">Track performance against targets.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-surface-container rounded-lg p-2 border border-outline-variant">
            <Calendar className="w-4 h-4 text-on-surface-variant" />
            <select className="bg-transparent text-sm font-semibold outline-none" value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option>This Week</option>
              <option>This Month</option>
              <option>This Quarter</option>
              <option>This Year</option>
            </select>
            <span className="text-on-surface-variant mx-1">vs</span>
            <select className="bg-transparent text-sm font-semibold outline-none" value={comparePeriod} onChange={e => setComparePeriod(e.target.value)}>
              <option>Last Month</option>
              <option>Last Year</option>
            </select>
          </div>
          
          <button onClick={() => setShowTargetModal(true)} className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-lg text-sm font-bold hover:bg-surface-container-highest transition-colors border border-outline-variant">
            <Target className="w-4 h-4 text-primary" /> Set Targets
          </button>

          <div className="flex items-center gap-2 bg-surface-container-high rounded-lg border border-outline-variant p-1">
            <button onClick={exportPDF} className="p-1.5 text-on-surface-variant hover:text-primary transition-colors tooltip-trigger" title="Export PDF">
              <FileText className="w-5 h-5" />
            </button>
            <button onClick={exportExcel} className="p-1.5 text-on-surface-variant hover:text-primary transition-colors tooltip-trigger" title="Export Excel">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi: any, idx: number) => {
          const isPositive = kpi.trend > 0;
          const progress = Math.min((kpi.value / kpi.target) * 100, 100);
          return (
            <div key={idx} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">{kpi.label}</h3>
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${isPositive ? 'bg-success/10 text-success' : 'bg-error-container text-error'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(kpi.trend)}%
                </span>
              </div>
              <div className="flex items-end gap-2 mb-4">
                <h2 className="text-4xl font-black text-on-surface">
                  {kpi.isPercentage ? `${kpi.value}%` : formatCurrencyCompact(kpi.value)}
                </h2>
              </div>
              
              {/* Target Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Progress to Target</span>
                  <span>{kpi.isPercentage ? `${kpi.target}%` : formatCurrencyCompact(kpi.target)}</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${progress >= 100 ? 'bg-success' : progress >= 75 ? 'bg-primary' : 'bg-warning'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard View */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Sales Leaderboard
          </h2>
          <div className="flex gap-2">
            <select className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm font-semibold outline-none">
              <option>Rank by Revenue</option>
              <option>Rank by Win Rate</option>
              <option>Rank by Meetings</option>
            </select>
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[600px]">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Salesperson</th>
                <th className="px-6 py-4">Performance Score</th>
                <th className="px-6 py-4 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr><td colSpan={4} className="p-6 text-center animate-pulse">Loading...</td></tr>
              ) : leaderboard.map((rep: any) => (
                <tr key={rep.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rep.rank === 1 ? 'bg-amber-100 text-amber-700' : rep.rank === 2 ? 'bg-slate-200 text-slate-700' : rep.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-surface-container text-on-surface-variant'}`}>
                      #{rep.rank}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-sm">{rep.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-surface-container rounded-full max-w-[150px]">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${rep.score}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-on-surface-variant">{rep.score}/100</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-primary">
                    {formatCurrency(rep.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Target Setting Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-xl w-[450px] shadow-2xl relative">
            <button onClick={() => setShowTargetModal(false)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <ChevronDown className="w-6 h-6 rotate-180" />
            </button>
            <h2 className="text-xl font-bold mb-2">Set KPI Targets</h2>
            <p className="text-sm text-on-surface-variant mb-6">These targets will reflect globally for the selected period.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Revenue Target ($)</label>
                <input 
                  type="number" 
                  value={targetValues.revenue} 
                  onChange={e => setTargetValues({...targetValues, revenue: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">New Leads Target</label>
                <input 
                  type="number" 
                  value={targetValues.leads} 
                  onChange={e => setTargetValues({...targetValues, leads: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Win Rate Target (%)</label>
                <input 
                  type="number" 
                  value={targetValues.winRate} 
                  onChange={e => setTargetValues({...targetValues, winRate: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 font-bold"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setShowTargetModal(false)} className="px-4 py-2 font-bold text-on-surface-variant">Cancel</button>
              <button onClick={() => setShowTargetModal(false)} className="px-4 py-2 font-bold bg-primary text-on-primary rounded-lg shadow hover:bg-primary-container hover:text-on-primary-container transition-colors">
                Save Targets
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
