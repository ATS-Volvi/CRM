import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Users, FileText, ChevronRight, AlertCircle, Phone, Calendar as CalendarIcon } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function MyToday() {
  const { token } = useAuth();
  
  const { data: todayData, isLoading } = useQuery({
    queryKey: ["mytoday"],
    queryFn: async () => {
      // Endpoint from Dev A
      const res = await fetch("/api/v1/sales/mytoday", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch today data");
      return res.json();
    }
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface relative">
      <div className="max-w-[1440px] mx-auto p-8 space-y-8">
        
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">My Today</h1>
            <p className="text-on-surface-variant mt-2">Here's what needs your attention today.</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tasks & Overdue */}
          <section className="col-span-1 lg:col-span-2 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Tasks & Meetings
                <span className="text-xs bg-error-container text-error px-2 py-0.5 rounded-full ml-auto">
                  {todayData?.overdueTasks?.length || 0} Overdue
                </span>
              </h2>
              <div className="space-y-3">
                {isLoading ? <p className="animate-pulse">Loading...</p> : (
                  <>
                    {todayData?.tasks?.map((task: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/30">
                        <input type="checkbox" className="mt-1 accent-primary w-4 h-4" />
                        <div>
                          <p className={`text-sm font-bold ${task.isOverdue ? 'text-error' : 'text-on-surface'}`}>{task.title}</p>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                            {task.type === 'meeting' ? <CalendarIcon className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                            {task.time} • {task.relatedTo}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!todayData?.tasks || todayData.tasks.length === 0) && (
                      <p className="text-sm text-on-surface-variant">No tasks scheduled for today.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* New Leads */}
          <section className="col-span-1 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-secondary" />
                New Leads to Follow Up
              </h2>
              <div className="space-y-3">
                {isLoading ? <p className="animate-pulse">Loading...</p> : (
                  <>
                    {todayData?.leads?.map((lead: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer group">
                        <div>
                          <p className="text-sm font-bold group-hover:text-primary transition-colors">{lead.name}</p>
                          <p className="text-xs text-on-surface-variant">{lead.company}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary" />
                      </div>
                    ))}
                    {(!todayData?.leads || todayData.leads.length === 0) && (
                      <p className="text-sm text-on-surface-variant">No new leads assigned.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Quotes */}
          <section className="col-span-1 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-tertiary" />
                Quote Follow-ups
              </h2>
              <div className="space-y-3">
                {isLoading ? <p className="animate-pulse">Loading...</p> : (
                  <>
                    {todayData?.quotes?.map((quote: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer group">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold group-hover:text-primary transition-colors">{quote.client}</p>
                          <span className="text-xs font-bold text-on-surface-variant">{formatCurrency(quote.amount)}</span>
                        </div>
                        <p className="text-xs text-error flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Expires in {quote.expiresInDays} days
                        </p>
                      </div>
                    ))}
                    {(!todayData?.quotes || todayData.quotes.length === 0) && (
                      <p className="text-sm text-on-surface-variant">No pending quotes expiring soon.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
