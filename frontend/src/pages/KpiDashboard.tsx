import { Calendar, Send, CheckCircle2, Video, MapPin, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

export default function KpiDashboard() {
  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen">
      {/* Welcome Header */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold text-on-surface mb-1">My Today</h1>
          <p className="text-on-surface-variant">Focus for Tuesday, Oct 24, 2023</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-lg font-bold text-on-surface hover:shadow-md transition-all">
            <Calendar className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-wider uppercase">Plan Week</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-md">
            <Send className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-wider uppercase">Daily Report</span>
          </button>
        </div>
      </header>

      {/* Top Section: Quick-Action Widgets */}
      <section className="grid grid-cols-12 gap-6 mb-8">
        {/* Tasks Due Today */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" /> Tasks Due Today
            </h3>
            <span className="bg-primary-container text-on-primary-container px-2 py-1 rounded text-[10px] font-bold">5 REMAINING</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-2">
              <div className="flex items-start gap-4 p-2 hover:bg-surface-bright rounded-lg group">
                <input type="checkbox" className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 border-outline" />
                <div className="flex-1">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">Contract review for Al-Maktoum Group</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 font-bold">URGENT • 11:00 AM</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-2 hover:bg-surface-bright rounded-lg group">
                <input type="checkbox" className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 border-outline" />
                <div className="flex-1">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">Send pitch deck to Tech-Frontier UAE</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 font-bold">ROUTINE • 02:30 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-2 hover:bg-surface-bright rounded-lg group">
                <input type="checkbox" className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 border-outline" />
                <div className="flex-1">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">Follow up on invoice #8892</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 font-bold">FINANCE • 04:00 PM</p>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-primary hover:bg-primary hover:text-white transition-all uppercase">View All Tasks</button>
        </div>

        {/* Meetings Today */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" /> Meetings Today
            </h3>
            <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-[10px] font-bold">3 SCHEDULED</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-4">
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">10:30</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">AM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-primary">
                  <p className="text-sm font-bold">Discovery Call: Riyadh Logistics</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    Omar Al-Qahtani
                  </p>
                </div>
              </div>
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">13:00</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">PM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-secondary">
                  <p className="text-sm font-bold">Product Demo: Cloud-Sovereign Solutions</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <Video className="w-3 h-3" /> Zoom Call
                  </p>
                </div>
              </div>
              <div className="flex items-stretch gap-4">
                <div className="flex flex-col items-center justify-center w-12 border-r border-outline-variant pr-4">
                  <span className="text-sm font-bold text-on-surface">15:45</span>
                  <span className="text-[10px] text-on-surface-variant uppercase">PM</span>
                </div>
                <div className="flex-1 p-3 bg-surface-container-lowest rounded-lg border-l-4 border-tertiary-container">
                  <p className="text-sm font-bold">Contract Review: Zenith Corp</p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> Main Office, Floor 12
                  </p>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-secondary hover:bg-secondary hover:text-white transition-all uppercase">Go to Calendar</button>
        </div>

        {/* Urgent Leads */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-error-container/20">
            <h3 className="font-semibold flex items-center gap-2 text-error">
              <AlertCircle className="w-5 h-5" /> Urgent Follow-ups
            </h3>
            <span className="bg-error text-on-error px-2 py-1 rounded text-[10px] font-bold">4 CRITICAL</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border-l-4 border-error">
                <div className="w-10 h-10 rounded-full bg-slate-300"></div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Zahra Farooq</p>
                  <p className="text-xs text-on-surface-variant">Deal: Enterprise Migration ($120k)</p>
                </div>
                <span className="text-[10px] text-error font-bold bg-error-container px-2 py-1 rounded">2d Late</span>
              </div>
              <div className="flex items-center gap-3 p-3 hover:bg-surface-bright rounded-lg border-l-4 border-outline">
                <div className="w-10 h-10 rounded-full bg-slate-300"></div>
                <div className="flex-1">
                  <p className="text-sm font-bold">David Chen</p>
                  <p className="text-xs text-on-surface-variant">Pending Signature: Pilot Program</p>
                </div>
                <span className="text-[10px] text-on-surface-variant font-bold bg-surface-container px-2 py-1 rounded">4h Left</span>
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-error hover:bg-error hover:text-white transition-all uppercase">Clear Urgent List</button>
        </div>
      </section>

      {/* Middle Section: 'My Performance' KPI Table */}
      <section className="bg-white rounded-xl border border-outline-variant shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-on-surface">My Performance</h2>
            <p className="text-sm text-on-surface-variant mt-1">Real-time KPI tracking vs. target quotas</p>
          </div>
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            <button className="px-4 py-1.5 bg-white rounded shadow-sm text-[10px] font-bold text-primary uppercase">MTD</button>
            <button className="px-4 py-1.5 rounded text-[10px] font-bold text-on-surface-variant uppercase">Q3</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest text-left border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Metric</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Current Month</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Last Month</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Trend</th>
                <th className="px-6 py-4 text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              <tr className="hover:bg-surface-bright transition-colors">
                <td className="px-6 py-4 text-sm font-bold">Quota Attainment</td>
                <td className="px-6 py-4 text-[13px] font-medium">82% ($1.2M / $1.5M)</td>
                <td className="px-6 py-4 text-[13px] font-medium">74%</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1 text-primary font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" /> +8%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[11px] font-bold">
                    ON TRACK
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-surface-bright transition-colors">
                <td className="px-6 py-4 text-sm font-bold">Close Rate</td>
                <td className="px-6 py-4 text-[13px] font-medium">28.4%</td>
                <td className="px-6 py-4 text-[13px] font-medium">31.2%</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1 text-tertiary font-bold text-xs">
                    <ArrowDownRight className="w-4 h-4" /> -2.8%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant px-2 py-1 rounded text-[11px] font-bold">
                    NEEDS FOCUS
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
