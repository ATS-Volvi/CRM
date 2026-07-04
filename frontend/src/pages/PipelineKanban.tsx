import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2 } from "lucide-react";

export default function PipelineKanban() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data: pipelineColumns, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/v1/pipeline", {
        headers: { "Authorization": "Bearer dummy" }
      });
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      return res.json();
    }
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* PIPELINE UTILITY BAR */}
      <section className="bg-surface px-8 py-4 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-8">
          <div>
            <h2 className="text-2xl font-semibold">Global Pipeline</h2>
            <p className="text-sm text-on-surface-variant mt-1">Total Opportunity Value: <span className="font-bold text-primary">$4,820,000.00</span></p>
          </div>
          
          <div className="flex items-center bg-surface-container border border-outline-variant rounded-lg p-1">
            <button 
              onClick={() => setViewMode("kanban")}
              className={`px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "kanban" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <View className="w-4 h-4" /> Kanban
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "list" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              <List className="w-4 h-4" /> List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-4">
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMvsbUdHzPc68XYDJJ99ReON1N-i4XebZxklXStKLhC28lVkQuD41QSfYgzrbGIiQzMYDq7RhJrL0Ut2WhyZjcESYYKi6UhddvcRQEOrdTpVORu28cZgzL1tp5SIO5twMJ6eKZDND23Nuqg3Ng9o-2fhKoDYc7ohwobNF3aB5xPVbEABzTwwt4UyjMv2mbtK4fMre1wfkNJixV5ddEJ0vUQz37e-BDIQ6AZva220_ZlyJfw5WjE2miFwW9y8SM-M_WpZar_DorbqtG" alt="rep" />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyvj-mY9fPXOykhTV53eLGv26B64soQCJxqp5NXTeH3v0zfP8xW5P-7bkRg9DOSCkW2pT2WcZPWCYOkybYDX7CtbDFqSsn-CWpzPdQWGHdYA8xTuorjJVY8KjU8dQRcsUEazjiL7He8xeZMr0-zJy9Um95NSvxw6D804dxDDhwDKTUNWaypNvVmt9ih-Ql3Ba-38qSLm9oTDO5oueuoVtxSwM7S9Zn0xIP5GWnXEPDVqaXDYi7g5vQlAeOfqHxyXDwWlo9QHMS_Be_" alt="rep" />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-[10px] font-bold text-on-primary">+8</div>
          </div>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded transition-all">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* KANBAN CANVAS */}
      <section className="flex-1 overflow-x-auto overflow-y-hidden bg-surface-container-low flex p-8 gap-6 items-start">
        {isLoading ? (
          <div className="w-full h-full flex justify-center items-center text-on-surface-variant animate-pulse">Loading Pipeline...</div>
        ) : pipelineColumns?.map((col: any) => (
          <div key={col.stage} className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">{col.stage}</h3>
                <p className="font-bold text-lg">${(col.totalValue / 1000).toFixed(0)}k <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· {col.deals.length} deals</span></p>
              </div>
              <button className="text-on-surface-variant hover:text-primary"><Plus className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {col.deals.map((deal: any) => (
                <div key={deal.id} className={`bg-surface-container-lowest p-4 rounded-lg border ${deal.isUrgent ? 'border-error/50' : 'border-outline-variant'} hover:shadow-md transition-all cursor-pointer`} style={deal.isUrgent ? { borderLeft: "4px solid #ba1a1a" } : {}}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-on-surface leading-tight">{deal.name}</span>
                    {deal.isUrgent ? <span className="text-error"><CheckCircle2 className="w-4 h-4" /></span> : <MoreVertical className="text-tertiary w-4 h-4" />}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-primary font-bold">${deal.value.toLocaleString()}</p>
                      <p className={`text-[11px] ${deal.isUrgent ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{deal.lastActivity}</p>
                    </div>
                    {deal.tag && (
                      <div className={`px-2 py-0.5 ${deal.isUrgent ? 'bg-error-container/20 text-error' : 'bg-secondary-container/20 text-secondary'} font-semibold text-[10px] rounded`}>
                        {deal.tag}
                      </div>
                    )}
                  </div>
                  {deal.progress !== undefined && (
                    <div className="mt-3">
                       <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${deal.progress}%` }}></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-medium">{deal.progress}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Empty Proposal Stage (Mock) */}
        {!isLoading && (
          <div className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl opacity-60">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">Proposal</h3>
                <p className="font-bold text-lg">$940k</p>
              </div>
            </div>
            <div className="flex-1 bg-surface-container-low/50 m-4 border border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
              <p className="text-[12px]">Drag deals here to move to Proposal stage</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
