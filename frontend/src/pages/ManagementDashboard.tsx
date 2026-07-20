import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { 
  TrendingUp, TrendingDown, Info, Calendar, Download, 
  ChevronDown, DollarSign, Activity, Star, Zap, Mail, Users, Globe, Share2 
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { apiClient } from "../lib/apiClient";

export default function ManagementDashboard() {
  const queryClient = useQueryClient();

  const { data: kpi, isLoading, error, refetch } = useQuery({
    queryKey: ["managementKpi"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/management");
      if (!res.ok) throw new Error(`Failed to fetch KPIs (${res.status})`);
      return res.json();
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: true,
  });

  const { data: actReports } = useQuery({
    queryKey: ["managementActivitiesReports"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/activities-reports");
      if (!res.ok) throw new Error(`Failed to fetch activity reports (${res.status})`);
      return res.json();
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: true,
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
          <div className="relative">
            <select className="appearance-none flex items-center gap-2 px-6 py-4 pl-12 pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold hover:bg-surface-container transition-colors shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-primary text-on-surface">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>This Year</option>
              <option>All Time</option>
            </select>
            <Calendar className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface" />
            <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface" />
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-4 rounded-lg bg-secondary text-on-secondary text-sm font-semibold hover:bg-opacity-90 transition-all shadow-md"
          >
            <Download className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-medium">Loading dashboard data...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="bg-error-container border border-error/20 rounded-xl p-6 max-w-md w-full text-center">
            <p className="text-error font-semibold mb-1">Failed to load dashboard</p>
            <p className="text-on-surface-variant text-sm mb-4">{(error as Error).message}</p>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["managementKpi"] });
                queryClient.invalidateQueries({ queryKey: ["managementActivitiesReports"] });
                refetch();
              }}
              className="px-6 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
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
                {formatCurrencyCompact(kpi?.totalPipelineValue || 0)}
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
              <h4 className="text-3xl font-bold text-on-surface">{kpi?.activeDealsCount || 0}</h4>
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
              <h4 className="text-3xl font-bold text-on-surface">{Math.round(kpi?.winRate || 0)}%</h4>
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
                <Link to="/salespersons" className="text-primary font-semibold text-xs hover:underline">View All</Link>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-lg">
                    {(kpi?.topPerformer || "Sarah Jenkins").charAt(0)}
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-sm text-on-surface">{kpi?.topPerformer || "Sarah Jenkins"}</p>
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
                      <td className="py-4 px-4 font-medium text-sm">{formatCurrency(12.4)}</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Users className="w-4 h-4 text-secondary" /> LinkedIn</td>
                      <td className="py-4 px-4 font-medium text-sm">2.8%</td>
                      <td className="py-4 px-4 font-medium text-sm">{formatCurrency(45.1)}</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Web</td>
                      <td className="py-4 px-4 font-medium text-sm">5.1%</td>
                      <td className="py-4 px-4 font-medium text-sm">{formatCurrency(8.9)}</td>
                    </tr>
                    <tr className="hover:bg-surface-container-high transition-colors">
                      <td className="py-4 px-4 text-sm flex items-center gap-2"><Share2 className="w-4 h-4 text-secondary" /> Referral</td>
                      <td className="py-4 px-4 font-medium text-sm">18.4%</td>
                      <td className="py-4 px-4 font-medium text-sm">{formatCurrency(0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Feature 11: Activities Reports */}
          {actReports && (
            <div className="mt-8 bg-white/90 backdrop-blur border border-slate-200 p-8 rounded-xl shadow-sm">
              <h4 className="text-xl font-bold mb-6 text-on-surface">Activity Analytics & Compliance</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <p className="text-[12px] font-semibold text-on-surface-variant uppercase">SLA Compliance</p>
                  <p className="text-2xl font-bold mt-2 text-primary">
                    {Math.round((actReports.slaCompliance.met / (actReports.slaCompliance.met + actReports.slaCompliance.breached || 1)) * 100)}%
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Met: {actReports.slaCompliance.met} | Breached: {actReports.slaCompliance.breached}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <p className="text-[12px] font-semibold text-on-surface-variant uppercase">Meeting Conversion</p>
                  <p className="text-2xl font-bold mt-2 text-secondary">{actReports.meetingConversionRate}%</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Meetings leading to qualification/deal</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <p className="text-[12px] font-semibold text-on-surface-variant uppercase">Leads with No Activity</p>
                  <p className="text-2xl font-bold mt-2 text-error">{actReports.noActivityLeadsCount}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Requires immediate follow-up</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <p className="text-[12px] font-semibold text-on-surface-variant uppercase">Total Logged Activities</p>
                  <p className="text-2xl font-bold mt-2 text-on-surface">
                    {String(Object.values(actReports.activityVolume).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Calls, Emails, Meetings, Notes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h5 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-4">Volume by Activity Type</h5>
                  <div className="space-y-3">
                    {Object.entries(actReports.activityVolume).map(([type, count]: any) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{type}s</span>
                        <div className="flex items-center gap-3 w-2/3">
                          <div className="bg-primary/20 h-2 rounded-full flex-grow">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (Number(count) / ((Object.values(actReports.activityVolume).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number) || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-bold">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-4">Call Outcome Distribution</h5>
                  <div className="space-y-3">
                    {Object.entries(actReports.callOutcomeDistribution).map(([outcome, count]: any) => (
                      <div key={outcome} className="flex items-center justify-between text-sm">
                        <span>{outcome}</span>
                        <div className="flex items-center gap-3 w-1/2">
                          <div className="bg-secondary/20 h-2 rounded-full flex-grow">
                            <div 
                              className="bg-secondary h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (Number(count) / ((Object.values(actReports.callOutcomeDistribution).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number) || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-bold">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
