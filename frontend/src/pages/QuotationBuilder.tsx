import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, PlusCircle, Trash2, Lightbulb, ZoomIn, Printer, Maximize, BarChart2, Clock, MessageSquare, History } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function QuotationBuilder() {
  const { token } = useAuth();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const res = await fetch("/api/v1/quotes", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    }
  });

  const { data: deals } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/v1/pipeline", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      const pipeline = await res.json();
      return pipeline.flatMap((col: any) => col.deals);
    }
  });

  const { data: products } = useQuery({
    queryKey: ["priceBook"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const [selectedDealId, setSelectedDealId] = useState("");

  const { data: recommendations, isLoading: loadingRecs } = useQuery({
    queryKey: ["recommendations", selectedDealId],
    queryFn: async () => {
      if (!selectedDealId) return [];
      const res = await fetch(`/api/v1/quotes/recommendations?dealId=${selectedDealId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDealId
  });
  const [items, setItems] = useState<any[]>([]);

  const addItem = () => {
    setItems([...items, { productId: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'productId') {
      const prod = products?.find((p: any) => p.id === value);
      if (prod) {
        newItems[index].unitPrice = parseFloat(prod.msrp || prod.listPrice || 0);
      }
    }
    newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_: any, i: number) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          dealId: selectedDealId,
          items,
          status
        })
      });
      if (!res.ok) throw new Error("Failed to save quote");
      return res.json();
    },
    onSuccess: () => {
      alert("Quote saved!");
      window.location.href = "/quotes";
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
                  <div>
                    <h2 className="text-2xl font-bold text-on-surface">New Quotation</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-on-surface-variant">Select Deal:</span>
                      <select 
                        className="bg-surface border border-outline-variant rounded p-1 text-sm"
                        value={selectedDealId}
                        onChange={e => setSelectedDealId(e.target.value)}
                      >
                        <option value="">-- Choose Deal --</option>
                        {deals?.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.client || 'Unknown Client'})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveMutation.mutate("Draft")} disabled={saveMutation.isPending || !selectedDealId} className="px-3 py-1.5 border border-outline text-sm font-semibold rounded hover:bg-surface-container transition-colors disabled:opacity-50">Save as Draft</button>
                  <button onClick={() => saveMutation.mutate("Pending")} disabled={saveMutation.isPending || !selectedDealId} className="px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary/90 transition-colors disabled:opacity-50">Send for Approval</button>
                </div>
              </>
            )}
          </div>

          {/* Line Items Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center">
              <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Line Items</span>
              <button onClick={addItem} className="text-primary font-semibold text-sm flex items-center gap-1">
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
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">No items added. Click "Add Product" to begin.</td>
                    </tr>
                  ) : (
                    items.map((item: any, i: number) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-surface-container-low/30" : ""}>
                        <td className="px-4 py-4">
                          <select 
                            className="w-full border border-outline-variant rounded p-1 text-sm bg-transparent"
                            value={item.productId}
                            onChange={(e) => updateItem(i, 'productId', e.target.value)}
                          >
                            <option value="">Select Product...</option>
                            {products?.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4"><input className="w-full text-center border-outline-variant rounded py-1 text-base focus:ring-primary focus:border-primary" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} /></td>
                        <td className="px-4 py-4 text-sm font-medium"><input className="w-full text-center border-outline-variant rounded py-1 text-base focus:ring-primary focus:border-primary" type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                        <td className="px-4 py-4"><input className="w-full border-outline-variant rounded py-1 text-base focus:ring-primary focus:border-primary" type="number" value={item.discount || 0} onChange={(e) => updateItem(i, 'discount', parseFloat(e.target.value) || 0)} /></td>
                        <td className="px-4 py-4 text-sm">0%</td>
                        <td className="px-4 py-4 text-right font-semibold text-sm">{formatCurrency(item.total)}</td>
                        <td className="px-4 py-4 text-on-surface-variant hover:text-error cursor-pointer" onClick={() => removeItem(i)}>
                          <Trash2 className="w-5 h-5" />
                        </td>
                      </tr>
                    ))
                  )}
                  {recommendations && recommendations.length > 0 && (
                    <tr>
                      <td className="px-4 py-4" colSpan={7}>
                        <div className="flex flex-col gap-3 p-4 bg-primary-container/10 border border-primary-container rounded-lg">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-primary" />
                            <span className="font-bold text-primary">AI Price Recommendations</span> 
                          </div>
                          <div className="space-y-3">
                            {recommendations.map((rec: any, idx: number) => (
                               <div key={idx} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-outline-variant/30">
                                 <div>
                                    <p className="font-bold text-sm">{rec.name} <span className="text-[12px] font-normal text-on-surface-variant">({rec.sku})</span></p>
                                    <p className="text-[12px] text-on-surface-variant italic">{rec.reason}</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <span className="font-bold text-primary text-sm">{formatCurrency(rec.unitPrice)}</span>
                                    <button 
                                      onClick={() => {
                                        setItems([...items, { productId: rec.productId, quantity: rec.quantity, unitPrice: rec.unitPrice, discount: 10, total: rec.unitPrice }]);
                                      }}
                                      className="px-3 py-1 bg-primary text-on-primary text-[12px] font-bold rounded hover:opacity-90 transition-colors"
                                    >
                                      Apply
                                    </button>
                                 </div>
                               </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
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
                  <span>{formatCurrencyCompact(12000)} - {formatCurrencyCompact(24000)}</span>
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
                  <span>Min: {formatCurrencyCompact(12400)}</span>
                  <span>Median: {formatCurrencyCompact(18200)}</span>
                  <span>Max: {formatCurrencyCompact(23800)}</span>
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
                <p className="text-sm text-on-surface-variant">Jun 12, 2022 • {formatCurrency(8200)}</p>
                <p className="text-xs text-on-surface-variant mt-1">SaaS Starter Pack + Training</p>
              </div>
              <div className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group">
                <div className="flex justify-between mb-1">
                  <span className="text-base font-bold group-hover:text-primary">QT-2022-912</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Expired</span>
                </div>
                <p className="text-sm text-on-surface-variant">Nov 29, 2022 • {formatCurrency(14500)}</p>
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
