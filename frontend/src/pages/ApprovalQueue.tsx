import { useQuery } from "@tanstack/react-query";
import { 
  Filter, PendingActions, Warning, AccountBalance, 
  Gavel, HistoryEdu, Check, X, Info, History
} from "lucide-react";

export default function ApprovalQueue() {
  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approvals", {
        headers: { "Authorization": "Bearer dummy" }
      });
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    }
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8 flex gap-8 h-full">
        
        {/* Approval Queue List */}
        <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden h-full">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PendingActions className="w-5 h-5 text-primary" />
              Approval Queue
              <span className="bg-secondary text-on-secondary text-[12px] px-2 py-0.5 rounded-full">12 Pending</span>
            </h2>
            <div className="flex gap-2">
              <button className="flex items-center gap-1 px-3 py-1.5 border border-outline text-sm rounded hover:bg-surface-container transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container-high z-10">
                <tr className="text-[12px] font-bold tracking-wider text-on-surface-variant uppercase">
                  <th className="p-4 border-b border-outline-variant">Trigger Reason</th>
                  <th className="p-4 border-b border-outline-variant">Requestor</th>
                  <th className="p-4 border-b border-outline-variant">Quote Summary</th>
                  <th className="p-4 border-b border-outline-variant">Value</th>
                  <th className="p-4 border-b border-outline-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-on-surface-variant animate-pulse">Loading approvals...</td>
                  </tr>
                ) : (
                  approvals?.map((item: any, i: number) => (
                    <tr key={item.id || i} className={`hover:bg-surface-container-low transition-colors group ${item.isCritical ? 'bg-error-container/10' : ''}`}>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{item.reason}</span>
                          <span className={`text-[11px] flex items-center gap-1 ${item.isCritical ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                            {item.isCritical ? <Gavel className="w-3 h-3" /> : (i % 2 === 0 ? <Warning className="w-3 h-3" /> : <AccountBalance className="w-3 h-3" />)}
                            {item.subReason}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] ${i % 3 === 0 ? 'bg-primary-container text-on-primary-container' : i % 3 === 1 ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                            {item.requestor.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold">{item.requestor}</span>
                            <span className="text-[11px] text-on-surface-variant">{item.region}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{item.quoteName}</span>
                          <span className="text-[12px] text-on-surface-variant truncate w-48 italic">"{item.notes}"</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">${item.value?.toLocaleString()}</span>
                          <span className="text-[11px] text-on-surface-variant">{item.date}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 text-primary hover:bg-primary-container/20 rounded-lg" title="Request Revision">
                            <HistoryEdu className="w-5 h-5" />
                          </button>
                          <button className="p-1 text-error hover:bg-error-container rounded-lg" title="Reject">
                            <X className="w-5 h-5" />
                          </button>
                          <button className="p-1 text-on-primary bg-primary rounded-lg shadow-sm hover:scale-105 active:scale-95" title="Approve">
                            <Check className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sidebar: Approval Tiers & Audit Trail */}
        <aside className="w-80 flex flex-col gap-8 h-full">
          
          {/* Approval Tiers Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-primary border-b border-outline-variant pb-2 mb-4 flex items-center justify-between">
              Approval Tiers
              <Info className="w-4 h-4" />
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">01</div>
                  <div className="w-[2px] h-full bg-outline-variant mt-1"></div>
                </div>
                <div className="pb-2">
                  <p className="text-sm font-bold">Direct Manager</p>
                  <p className="text-[11px] text-on-surface-variant">Standard Quotes &lt; $50k</p>
                  <div className="mt-1 bg-surface-container-low px-2 py-1 rounded border border-outline-variant text-[10px] text-on-surface-variant">
                    Auto-approves if within +/- 5% margin
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold">02</div>
                  <div className="w-[2px] h-full bg-outline-variant mt-1"></div>
                </div>
                <div className="pb-2">
                  <p className="text-sm font-bold">Regional Director</p>
                  <p className="text-[11px] text-on-surface-variant">Discounts &gt; 10% or &gt; $100k</p>
                  <div className="mt-1 bg-primary-container/10 border-l-2 border-primary px-2 py-1 rounded text-[10px] text-primary font-bold">
                    Current Active Tier
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-outline-variant text-on-surface-variant flex items-center justify-center text-[10px] font-bold">03</div>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface-variant">Chief Revenue Officer</p>
                  <p className="text-[11px] text-on-surface-variant">Strategic Deals &gt; $1M</p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Trail Card */}
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-on-surface-variant border-b border-outline-variant pb-2 mb-4 flex items-center justify-between">
              Recent Decisions
              <History className="w-4 h-4" />
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-green-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase">Approved</span>
                  <span className="text-[10px] text-on-surface-variant">10m ago</span>
                </div>
                <p className="text-sm font-bold">Al Futtaim Digital Quote</p>
                <p className="text-[11px] text-on-surface-variant">Approved by Sarah J. (CRO)</p>
              </div>

              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-primary">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-primary bg-primary-container/20 px-1.5 py-0.5 rounded uppercase">Revision</span>
                  <span className="text-[10px] text-on-surface-variant">2h ago</span>
                </div>
                <p className="text-sm font-bold">Mobily Network Extension</p>
                <p className="text-[11px] text-on-surface-variant">"Please adjust hardware tax rates for SA."</p>
              </div>

              <div className="p-2 rounded hover:bg-surface-container-low transition-colors border-l-2 border-error">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-bold text-error bg-error-container px-1.5 py-0.5 rounded uppercase">Rejected</span>
                  <span className="text-[10px] text-on-surface-variant">5h ago</span>
                </div>
                <p className="text-sm font-bold">Standard Chartered Q3</p>
                <p className="text-[11px] text-on-surface-variant">"Discount exceeds regional limit."</p>
              </div>

            </div>
            <button className="w-full mt-4 text-primary font-bold text-[12px] py-2 hover:bg-surface-container transition-colors rounded">
              View Full History
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}
