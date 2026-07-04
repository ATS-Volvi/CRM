import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, TrendingDown, Info, Calendar, Download, 
  ChevronDown, DollarSign, Activity, Star, Zap, Mail, Users, Globe, Share2 
} from "lucide-react";

export default function ManagementDashboard() {
  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ["managementKpi"],
    queryFn: async () => {
      const res = await fetch("http://localhost:5505/api/v1/kpis/management", {
        headers: {
          // Placeholder for auth token
          "Authorization": "Bearer dummy" 
        }
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    }
  });

  return (
    <div className="p-8 max-w-[1440px] mx-auto min-h-screen">
      {/* Header Actions */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[12px] font-semibold tracking-wider text-primary uppercase mb-1">Executive Overview</p>
          <h3 className="text-4xl font-bold text-on-surface">Global Performance</h3>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-6 py-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold hover:bg-surface-container transition-colors shadow-sm">
            <Calendar className="w-5 h-5" />
            Last 30 Days
            <ChevronDown className="w-4 h-4" />
          </button>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-semibold text-on-surface-variant">Total Pipeline</p>
                <div className="text-primary bg-primary/10 p-2 rounded-lg"><DollarSign className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-bold text-on-surface">
                ${(kpi?.totalRevenue / 1000000).toFixed(1)}M
              </h4>
              <div className="flex items-center gap-1 mt-2 text-emerald-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[12px] font-semibold">+12% vs LY</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-semibold text-on-surface-variant">Active Deals</p>
                <div className="text-secondary bg-secondary/10 p-2 rounded-lg"><Activity className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-bold text-on-surface">{kpi?.activeDeals}</h4>
              <div className="flex items-center gap-1 mt-2 text-tertiary">
                <Info className="w-4 h-4" />
                <span className="text-[12px] font-semibold">92% Confidence</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-semibold text-on-surface-variant">Avg Win Rate</p>
                <div className="text-primary bg-primary/10 p-2 rounded-lg"><Star className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-bold text-on-surface">24%</h4>
              <div className="flex items-center gap-1 mt-2 text-emerald-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[12px] font-semibold">+2% MoM</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[12px] font-semibold text-on-surface-variant">Sales Velocity</p>
                <div className="text-secondary bg-secondary/10 p-2 rounded-lg"><Zap className="w-5 h-5" /></div>
              </div>
              <h4 className="text-3xl font-bold text-on-surface">18 Days</h4>
              <div className="flex items-center gap-1 mt-2 text-emerald-500">
                <TrendingDown className="w-4 h-4" />
                <span className="text-[12px] font-semibold">-3 days faster</span>
              </div>
            </div>
          </div>

          {/* Lower Section */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* Funnel Chart Card */}
            <div className="col-span-12 lg:col-span-4 bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <h5 className="text-lg font-semibold mb-8">Conversion Funnel</h5>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[12px] font-semibold mb-1">
                    <span>1,240 Total Leads</span>
                    <span className="text-primary">100%</span>
                  </div>
                  <div className="h-10 bg-primary-container rounded-lg w-full flex items-center px-4 text-on-primary-container font-bold text-sm">Lead Generation</div>
                </div>
                <div className="flex flex-col gap-1 pl-8 border-l-2 border-outline-variant">
                  <div className="flex justify-between items-center text-[12px] font-semibold mb-1">
                    <span>842 Qualified</span>
                    <span className="text-primary">68%</span>
                  </div>
                  <div className="h-10 bg-primary-container/80 rounded-lg w-[85%] flex items-center px-4 text-on-primary-container font-bold text-sm">MQL/SQL</div>
                </div>
                <div className="flex flex-col gap-1 pl-16 border-l-2 border-outline-variant">
                  <div className="flex justify-between items-center text-[12px] font-semibold mb-1">
                    <span>310 Proposal</span>
                    <span className="text-primary">25%</span>
                  </div>
                  <div className="h-10 bg-primary-container/60 rounded-lg w-[65%] flex items-center px-4 text-on-primary-container font-bold text-sm">Negotiation</div>
                </div>
                <div className="flex flex-col gap-1 pl-24 border-l-2 border-outline-variant">
                  <div className="flex justify-between items-center text-[12px] font-semibold mb-1">
                    <span>74 Won</span>
                    <span className="text-primary">6%</span>
                  </div>
                  <div className="h-10 bg-primary-container/40 rounded-lg w-[40%] flex items-center px-4 text-on-primary font-bold text-sm">Closed Won</div>
                </div>
              </div>
            </div>

            {/* Team Leaderboard */}
            <div className="col-span-12 lg:col-span-4 bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h5 className="text-lg font-semibold">Top Performers</h5>
                <button className="text-primary font-semibold text-xs hover:underline">View All</button>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-lg">
                    {kpi?.topPerformer.charAt(0)}
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-sm text-on-surface">{kpi?.topPerformer}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Enterprise Accounts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">124%</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">Quota Att.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lead Source ROI Table */}
            <div className="col-span-12 lg:col-span-4 bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl flex flex-col shadow-sm">
              <h5 className="text-lg font-semibold mb-8">Lead Source ROI</h5>
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="py-4 px-4 text-[12px] font-semibold text-on-surface-variant">Source</th>
                      <th className="py-4 px-4 text-[12px] font-semibold text-on-surface-variant">Conv %</th>
                      <th className="py-4 px-4 text-[12px] font-semibold text-on-surface-variant">CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email</td>
                      <td className="py-4 px-4 font-medium text-sm">4.2%</td>
                      <td className="py-4 px-4 font-medium text-sm">$12.40</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Users className="w-4 h-4 text-secondary" /> LinkedIn</td>
                      <td className="py-4 px-4 font-medium text-sm">2.8%</td>
                      <td className="py-4 px-4 font-medium text-sm">$45.10</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Web</td>
                      <td className="py-4 px-4 font-medium text-sm">5.1%</td>
                      <td className="py-4 px-4 font-medium text-sm">$08.90</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Share2 className="w-4 h-4 text-secondary" /> Referral</td>
                      <td className="py-4 px-4 font-medium text-sm">18.4%</td>
                      <td className="py-4 px-4 font-medium text-sm">$0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
