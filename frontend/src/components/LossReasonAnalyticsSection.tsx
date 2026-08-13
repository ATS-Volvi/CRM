import { useState, useEffect } from "react";
import { TrendingDown, AlertTriangle, User, Filter, Calendar, BarChart2, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";

export function LossReasonAnalyticsSection() {
  const { token } = useAuth();
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchLossAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dashboard/loss-analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch loss analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLossAnalytics();
  }, [period, token]);

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  const categoryTotals: any[] = data?.categoryTotals || [];
  const repBreakdown: any[] = data?.repBreakdown || [];
  const totalCount = data?.totalLostDeals || 0;
  const totalAmount = data?.totalLostAmount || 0;

  const categories = ["Price", "Competitor", "Timing", "No Budget", "Product Fit", "Other"];
  const categoryColors: Record<string, string> = {
    Price: "bg-rose-500 text-rose-500",
    Competitor: "bg-amber-500 text-amber-500",
    Timing: "bg-blue-500 text-blue-500",
    "No Budget": "bg-purple-500 text-purple-500",
    "Product Fit": "bg-indigo-500 text-indigo-500",
    Other: "bg-slate-400 text-slate-400"
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
      {/* SECTION HEADER & PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Loss Reason Intelligence & Coaching Analytics
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Categorized analysis of closed-lost deals to uncover systemic sales objections & rep coaching signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary transition-all cursor-pointer"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider mb-1">Total Lost Deals</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</span>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider mb-1">Total Revenue Impact</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider mb-1">Top Loss Factor</span>
          <span className="text-lg font-black text-slate-900 dark:text-white truncate block">
            {categoryTotals.length > 0
              ? [...categoryTotals].sort((a, b) => b.count - a.count)[0]?.category || "None"
              : "N/A"}
          </span>
        </div>
      </div>

      {/* CATEGORY DISTRIBUTION BARS */}
      <div className="space-y-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Loss Reasons by Category
        </h4>
        <div className="space-y-3">
          {categoryTotals.map((item) => {
            const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
            const barBg = categoryColors[item.category]?.split(" ")[0] || "bg-slate-400";

            return (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${barBg}`} />
                    {item.category}
                  </span>
                  <span className="text-slate-500">
                    {item.count} deals ({pct}%) — <span className="font-extrabold text-slate-700 dark:text-slate-300">{formatCurrency(item.totalAmount)}</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barBg} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REP COACHING SIGNALS TABLE */}
      <div className="pt-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
          <User className="w-4 h-4 text-primary" /> Salesperson Coaching Signals
        </h4>
        {repBreakdown.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No rep breakdown data available for this timeframe.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Salesperson</th>
                  {categories.map((cat) => (
                    <th key={cat} className="p-3 text-center">{cat}</th>
                  ))}
                  <th className="p-3 text-right">Total Lost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {repBreakdown.map((rep) => (
                  <tr key={rep.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{rep.name}</td>
                    {categories.map((cat) => (
                      <td key={cat} className="p-3 text-center font-bold">
                        {rep.categories[cat] > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                            cat === "Price" ? "bg-rose-500/10 text-rose-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}>
                            {rep.categories[cat]}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                    ))}
                    <td className="p-3 text-right font-black text-rose-600">{rep.totalLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
