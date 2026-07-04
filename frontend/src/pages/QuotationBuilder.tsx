import { useQuery } from "@tanstack/react-query";
import { Search, PlusCircle, Trash2, Lightbulb, ZoomIn, Printer, Maximize, BarChart2, Clock, MessageSquare, History } from "lucide-react";

export default function QuotationBuilder() {
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const res = await fetch("/api/v1/quotes", {
        headers: { "Authorization": "Bearer dummy" }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    }
  });

  const quote = quotes?.[0]; // Show the first one for the builder

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background h-[calc(100vh-64px)]">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8 h-full">
        {/* Left: Builder Core (Line Items & Totals) */}
        <div className="col-span-8 space-y-8">
          
          {/* Client Header Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex justify-between items-center shadow-sm">
            {isLoading ? (
              <div className="animate-pulse flex items-center gap-4 w-full h-12 bg-surface-container-low rounded"></div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary-container rounded-lg flex items-center justify-center text-on-secondary-container">
                    <span className="text-2xl font-bold">{quote?.client.charAt(0)}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-on-surface">{quote?.client}</h2>
                    <p className="text-sm text-on-surface-variant">Opportunity: <span className="font-semibold text-secondary">{quote?.opportunity}</span> • Owner: {quote?.owner}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 border border-outline text-sm font-semibold rounded hover:bg-surface-container transition-colors">Edit Client Info</button>
                  <button className="px-3 py-1.5 border border-primary text-primary text-sm font-semibold rounded hover:bg-primary/5 transition-colors">Select Template</button>
                </div>
              </>
            )}
          </div>

          {/* Line Items Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center">
              <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Line Items</span>
              <button className="text-primary font-semibold text-sm flex items-center gap-1">
                <PlusCircle className="w-4 h-4" /> Add Product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase">Product / Service</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-24 text-center">Qty</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-32">Unit Price</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-24">Disc %</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-24">Tax</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-32 text-right">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant animate-pulse">Loading items...</td>
                    </tr>
                  ) : (
                    quote?.items.map((item: any, i: number) => (
                      <tr key={item.id} className={i % 2 === 1 ? "bg-surface-container-low/30" : ""}>
                        <td className="px-4 py-4">
                          <div className="text-base font-semibold">{item.name}</div>
                        </td>
                        <td className="px-4 py-4"><input className="w-full text-center border-outline-variant rounded py-1 text-base focus:ring-primary focus:border-primary" type="number" defaultValue={item.qty} /></td>
                        <td className="px-4 py-4 text-sm font-medium">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4"><input className="w-full border-outline-variant rounded py-1 text-base focus:ring-primary focus:border-primary" type="number" defaultValue={item.discount} /></td>
                        <td className="px-4 py-4 text-sm">{item.tax}%</td>
                        <td className="px-4 py-4 text-right font-semibold text-sm">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-on-surface-variant hover:text-error cursor-pointer">
                          <Trash2 className="w-5 h-5" />
                        </td>
                      </tr>
                    ))
                  )}
                  <tr>
                    <td className="px-4 py-4" colSpan={7}>
                      <div className="flex items-center gap-3 p-3 bg-primary-container/10 border border-primary-container rounded-lg">
                        <Lightbulb className="w-5 h-5 text-primary" />
                        <div className="text-sm">
                          <span className="font-bold text-primary">Price Recommendation:</span> 
                          Quoted price is in the <span className="text-primary font-bold">Top 15%</span> for similar deals. 
                          Win rate prediction: <span className="font-bold">68%</span>.
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PDF Preview Pane */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-8 relative min-h-[400px] flex flex-col items-center">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button className="bg-white/80 backdrop-blur p-2 rounded shadow-sm hover:bg-white"><ZoomIn className="w-5 h-5" /></button>
              <button className="bg-white/80 backdrop-blur p-2 rounded shadow-sm hover:bg-white"><Printer className="w-5 h-5" /></button>
              <button className="bg-white/80 backdrop-blur p-2 rounded shadow-sm hover:bg-white"><Maximize className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-white w-[595px] h-[842px] shadow-xl p-8 scale-[0.6] origin-top border border-outline-variant pointer-events-none mt-8">
              {/* Branded Template Visual */}
              <div className="flex justify-between items-start mb-16">
                <div className="text-4xl font-extrabold text-primary">CRM.</div>
                <div className="text-right">
                  <h1 className="text-3xl font-bold uppercase tracking-widest text-on-surface-variant mb-2">Quotation</h1>
                  <p className="text-sm font-semibold">{quote?.id || "QT-NEW"}</p>
                  <p className="text-xs text-on-surface-variant">Date: {quote?.date || "Today"}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-12 mb-16">
                <div>
                  <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">From:</h4>
                  <p className="text-sm font-bold">Enterprise CRM Solutions</p>
                  <p className="text-xs">123 Tech Corridor, Dubai Internet City</p>
                  <p className="text-xs">United Arab Emirates</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Prepared For:</h4>
                  <p className="text-sm font-bold">{quote?.client || "Client Name"}</p>
                  <p className="text-xs">Financial Center Rd, Downtown Dubai</p>
                  <p className="text-xs">Attn: Sarah Jenkins</p>
                </div>
              </div>
              
              <div className="border-t-2 border-primary pt-4 mb-4"></div>
              
              <div className="h-24 bg-surface-container-low mb-8 rounded flex items-center justify-center italic text-on-surface-variant">
                [ Live PDF Render Area - Line Items and Terms ]
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mt-4 -translate-y-24">Live Branded Preview (v2.1 Template)</p>
          </div>
        </div>

        {/* Right: Sidebars (Historic & Benchmarks) */}
        <div className="col-span-4 space-y-8">
          
          {/* Benchmarking Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart2 className="text-primary w-5 h-5" /> Market Benchmarks
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[12px] font-bold mb-2">
                  <span>Similar Quote Range</span>
                  <span>$12k - $24k</span>
                </div>
                <div className="relative h-6 bg-surface-container rounded-full flex items-center px-1">
                  <div className="absolute left-1/4 h-3 w-1 bg-outline rounded-full"></div>
                  <div className="absolute left-1/2 h-3 w-1 bg-outline rounded-full"></div>
                  <div className="absolute left-3/4 h-3 w-1 bg-outline rounded-full"></div>
                  <div className="h-4 bg-primary rounded-full" style={{ width: "55%", marginLeft: "15%" }}></div>
                  <div className="absolute top-[-24px] left-[65%] flex flex-col items-center">
                    <span className="text-[10px] font-bold text-primary">YOURS</span>
                    <div className="w-2 h-2 bg-primary rotate-45"></div>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                  <span>Min: $12.4k</span>
                  <span>Median: $18.2k</span>
                  <span>Max: $23.8k</span>
                </div>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-primary/20">
                <div className="text-[12px] font-bold text-primary mb-1 tracking-widest">STRATEGY INSIGHT</div>
                <p className="text-sm leading-snug">Clients in the <strong>Logistics</strong> sector usually accept quotes 12% higher when <strong>Priority Support</strong> is bundled.</p>
              </div>
            </div>
          </div>

          {/* Historic Quotes Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm">
            <div className="p-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold">Historic Quotes</h3>
            </div>
            <div className="divide-y divide-outline-variant">
              <div className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group">
                <div className="flex justify-between mb-1">
                  <span className="text-base font-bold group-hover:text-primary">QT-2022-441</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Won</span>
                </div>
                <p className="text-sm text-on-surface-variant">Jun 12, 2022 • $8,200.00</p>
                <p className="text-xs text-on-surface-variant mt-1">SaaS Starter Pack + Training</p>
              </div>
              <div className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group">
                <div className="flex justify-between mb-1">
                  <span className="text-base font-bold group-hover:text-primary">QT-2022-912</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Expired</span>
                </div>
                <p className="text-sm text-on-surface-variant">Nov 29, 2022 • $14,500.00</p>
                <p className="text-xs text-on-surface-variant mt-1">Legacy Upgrade Bundle</p>
              </div>
            </div>
            <button className="w-full p-3 text-sm font-semibold text-secondary hover:bg-surface-container transition-colors rounded-b-xl">View Full History</button>
          </div>

          {/* Quick Tools */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-outline-variant rounded-xl p-4 flex flex-col items-center gap-2 text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-all">
              <History className="w-6 h-6" />
              <span className="text-[12px] font-bold tracking-wider uppercase">Version Log</span>
            </div>
            <div className="bg-white border border-outline-variant rounded-xl p-4 flex flex-col items-center gap-2 text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-all">
              <MessageSquare className="w-6 h-6" />
              <span className="text-[12px] font-bold tracking-wider uppercase">Internal Chat</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
