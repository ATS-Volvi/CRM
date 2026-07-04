import { useState } from "react";
import { Search, Plus, Filter, MoreVertical, View, List, CheckCircle2 } from "lucide-react";

export default function PipelineKanban() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

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
        {/* Column 1: New Leads */}
        <div className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">New Leads</h3>
              <p className="font-bold text-lg">$125k <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· 4 deals</span></p>
            </div>
            <button className="text-on-surface-variant hover:text-primary"><Plus className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-on-surface leading-tight">Global Logistics Inc.</span>
                <MoreVertical className="text-tertiary w-4 h-4" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-primary font-bold">$45,000</p>
                  <p className="text-[11px] text-on-surface-variant">Last activity: 2 days ago</p>
                </div>
                <div className="px-2 py-0.5 bg-secondary-container/20 text-secondary font-semibold text-[10px] rounded">SME Tier</div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-error/50 hover:shadow-md transition-all cursor-pointer" style={{ borderLeft: "4px solid #ba1a1a" }}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-on-surface leading-tight">Nova Dynamics Ltd.</span>
                <span className="text-error" title="Stale Deal (>5 days)"><CheckCircle2 className="w-4 h-4" /></span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-primary font-bold">$12,500</p>
                  <p className="text-[11px] text-error font-medium">Stale: 8 days inactive</p>
                </div>
                <div className="px-2 py-0.5 bg-error-container/20 text-error font-semibold text-[10px] rounded">URGENT</div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Contacted */}
        <div className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">Contacted</h3>
              <p className="font-bold text-lg">$450k <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· 6 deals</span></p>
            </div>
            <button className="text-on-surface-variant hover:text-primary"><Plus className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant hover:shadow-md transition-all cursor-pointer">
              <p className="text-sm font-bold text-on-surface mb-2">Helix Healthcare</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="w-[40%] h-full bg-primary"></div>
                </div>
                <span className="text-[10px] text-on-surface-variant font-medium">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-primary font-bold">$120,000</p>
                <span className="text-[11px] text-on-surface-variant">3 days in stage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Qualified */}
        <div className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">Qualified</h3>
              <p className="font-bold text-lg">$820k <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· 3 deals</span></p>
            </div>
            <button className="text-on-surface-variant hover:text-primary"><Plus className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant hover:shadow-md transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-on-surface leading-tight">Apex Retail Systems</span>
                <MoreVertical className="text-on-surface-variant w-4 h-4" />
              </div>
              <p className="text-sm text-primary font-bold mb-3">$245,000</p>
              <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-on-surface-variant">Active</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-[10px] flex items-center justify-center font-bold">JD</div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 4: Meeting/Demo */}
        <div className="min-w-[300px] max-w-[300px] flex flex-col h-full bg-surface-container border border-outline-variant/30 rounded-xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-widest">Meeting/Demo</h3>
              <p className="font-bold text-lg">$1.2M <span className="text-sm font-normal text-on-surface-variant/60 ml-1">· 8 deals</span></p>
            </div>
            <button className="text-on-surface-variant hover:text-primary"><Plus className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant hover:shadow-md transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-on-surface leading-tight">Z-Tech Corp</span>
                <CheckCircle2 className="text-primary w-4 h-4" />
              </div>
              <p className="text-sm text-primary font-bold mb-3">$450,000</p>
              <div className="px-2 py-1 bg-primary-container/10 border border-primary/20 rounded mb-3">
                <p className="text-[10px] text-primary-container font-bold uppercase">Demo Scheduled</p>
                <p className="text-[11px] text-on-surface-variant">Today @ 2:30 PM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Column 5: Proposal */}
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
      </section>
    </div>
  );
}
