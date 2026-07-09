import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  TrendingUp, Calendar, Download, ChevronDown, DollarSign, Activity, Star, Zap 
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ManagementDashboard() {
  const { token } = useAuth();
  const [dateRange, setDateRange] = useState("Last 30 Days");

  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ["managementKpi", dateRange],
    queryFn: async () => {
      const res = await fetch("/api/v1/dashboard/management", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    }
  });

  const { data: funnelData } = useQuery({
    queryKey: ["funnelKpi", dateRange],
    queryFn: async () => {
      const res = await fetch("/api/v1/kpi/funnel", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch funnel data");
      return res.json();
    }
  });

  const revenueTrendData = [
    { month: 'Jan', revenue: 4000, target: 4500 },
    { month: 'Feb', revenue: 3000, target: 4500 },
    { month: 'Mar', revenue: 5000, target: 4500 },
    { month: 'Apr', revenue: 4500, target: 4500 },
    { month: 'May', revenue: 6000, target: 5000 },
    { month: 'Jun', revenue: 7000, target: 5500 },
  ];

  const forecastData = [
    { period: '30 Days', worst: 4000, expected: 5000, best: 6000 },
    { period: '60 Days', worst: 8000, expected: 10500, best: 13000 },
    { period: '90 Days', worst: 12000, expected: 16000, best: 20000 },
  ];

  const leadSources = [
    { name: 'Organic Search', value: 400 },
    { name: 'Referral', value: 300 },
    { name: 'Paid Ads', value: 300 },
    { name: 'Cold Call', value: 200 },
  ];

  const velocityData = [
    { stage: 'Prospecting', days: 5 },
    { stage: 'Qualification', days: 3 },
    { stage: 'Proposal', days: 7 },
    { stage: 'Negotiation', days: 4 },
  ];

  const heatmapData = [
    { person: 'Sarah J.', M: 5, T: 8, W: 4, Th: 7, F: 9 },
    { person: 'David C.', M: 2, T: 4, W: 9, Th: 3, F: 5 },
    { person: 'Omar A.', M: 6, T: 6, W: 6, Th: 6, F: 6 },
  ];

  const mockFunnel = funnelData || [
    { name: 'Leads', value: 1000 },
    { name: 'Qualified', value: 800 },
    { name: 'Proposals', value: 500 },
    { name: 'Negotiation', value: 300 },
    { name: 'Won', value: 150 },
  ];

  const handleDrillDown = (metric: string) => {
    alert(`Drilling down into ${metric} records...`);
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto min-h-screen space-y-8 bg-surface">
      {/* Header Actions */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[12px] font-semibold tracking-wider text-primary uppercase mb-1">Executive Overview</p>
          <h3 className="text-4xl font-bold text-on-surface">Global Performance</h3>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none flex items-center gap-2 px-6 py-4 pl-12 pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold hover:bg-surface-container transition-colors shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-primary text-on-surface"
            >
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>This Year</option>
              <option>All Time</option>
            </select>
            <Calendar className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface" />
            <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface" />
          </div>
          <button className="flex items-center gap-2 px-6 py-4 rounded-lg bg-secondary text-on-secondary text-sm font-semibold hover:bg-opacity-90 transition-all shadow-md">
            <Download className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-on-surface-variant animate-pulse">Loading dashboard data...</div>
      ) : error ? (
        <div className="text-error bg-error-container p-4 rounded-xl">Error loading KPIs: {(error as Error).message}</div>
      ) : (
        <>
          {/* Top Stats Bento */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div onClick={() => handleDrillDown("Pipeline")} className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Total Pipeline</p>
                <div className="text-primary bg-primary-container/50 p-2 rounded-lg"><DollarSign className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-black text-on-surface">
                {formatCurrencyCompact(kpi?.totalPipelineValue || 2500000)}
              </h4>
            </div>

            <div onClick={() => handleDrillDown("Active Deals")} className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Active Deals</p>
                <div className="text-secondary bg-secondary-container/50 p-2 rounded-lg"><Activity className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-black text-on-surface">{kpi?.activeDealsCount || 145}</h4>
            </div>

            <div onClick={() => handleDrillDown("Win Rate")} className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Avg Win Rate</p>
                <div className="text-primary bg-primary-container/50 p-2 rounded-lg"><Star className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-black text-on-surface">{Math.round(kpi?.winRate || 32)}%</h4>
            </div>

            <div onClick={() => handleDrillDown("Velocity")} className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl shadow-sm cursor-pointer hover:border-primary transition-colors">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Sales Velocity</p>
                <div className="text-secondary bg-secondary-container/50 p-2 rounded-lg"><Zap className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-black text-on-surface">{kpi?.salesVelocityDays || 24} Days</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend (Area Chart with Target) */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-[400px]">
              <h3 className="font-bold mb-6 text-on-surface">Revenue Trend & Target</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                  <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" fill="#8884d8" stroke="#8884d8" fillOpacity={0.2} name="Actual Revenue" />
                  <Line type="monotone" dataKey="target" stroke="#ff7300" strokeDasharray="5 5" name="Target" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Pipeline Funnel & Conversion (Bar Chart acting as Funnel) */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-[400px]">
              <h3 className="font-bold mb-6 text-on-surface">Pipeline Funnel & Conversions</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockFunnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#0088FE" radius={[0, 4, 4, 0]}>
                    {mockFunnel.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Forecast (Bar Chart 3 Scenarios) */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-[350px]">
              <h3 className="font-bold mb-6 text-on-surface">Revenue Forecast</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                  <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="worst" fill="#ef4444" name="Worst Case" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expected" fill="#3b82f6" name="Expected" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="best" fill="#10b981" name="Best Case" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pipeline Velocity (Bar Chart) */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-[350px]">
              <h3 className="font-bold mb-6 text-on-surface">Avg Days in Stage</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="stage" type="category" width={90} fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(value) => `${value} Days`} />
                  <Bar dataKey="days" fill="#FFBB28" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lead Source Pie Chart */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm h-[350px]">
              <h3 className="font-bold mb-6 text-on-surface">Lead Sources</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {leadSources.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Heatmap Grid */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
            <h3 className="font-bold mb-6 text-on-surface">Team Activity Heatmap (Last Week)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr className="text-xs uppercase text-on-surface-variant font-bold border-b border-outline-variant">
                    <th className="p-3 text-left">Rep</th>
                    <th className="p-3">Mon</th>
                    <th className="p-3">Tue</th>
                    <th className="p-3">Wed</th>
                    <th className="p-3">Thu</th>
                    <th className="p-3">Fri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {heatmapData.map((row, i) => (
                    <tr key={i}>
                      <td className="p-3 text-left font-bold text-sm">{row.person}</td>
                      <td className="p-3"><div className={`mx-auto w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${row.M > 6 ? 'bg-primary text-white' : row.M > 3 ? 'bg-primary/50 text-white' : 'bg-primary/20 text-primary'}`}>{row.M}</div></td>
                      <td className="p-3"><div className={`mx-auto w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${row.T > 6 ? 'bg-primary text-white' : row.T > 3 ? 'bg-primary/50 text-white' : 'bg-primary/20 text-primary'}`}>{row.T}</div></td>
                      <td className="p-3"><div className={`mx-auto w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${row.W > 6 ? 'bg-primary text-white' : row.W > 3 ? 'bg-primary/50 text-white' : 'bg-primary/20 text-primary'}`}>{row.W}</div></td>
                      <td className="p-3"><div className={`mx-auto w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${row.Th > 6 ? 'bg-primary text-white' : row.Th > 3 ? 'bg-primary/50 text-white' : 'bg-primary/20 text-primary'}`}>{row.Th}</div></td>
                      <td className="p-3"><div className={`mx-auto w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${row.F > 6 ? 'bg-primary text-white' : row.F > 3 ? 'bg-primary/50 text-white' : 'bg-primary/20 text-primary'}`}>{row.F}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
