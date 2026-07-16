import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
      if (!Array.isArray(pipeline)) return [];
      return pipeline.flatMap((col: any) => col.deals || []);
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

  const { data: bundles } = useQuery({
    queryKey: ["bundles"],
    queryFn: async () => {
      const res = await fetch("/api/v1/bundle-templates", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const [searchParams] = useSearchParams();
  const dealIdParam = searchParams.get("dealId");

  const [selectedDealId, setSelectedDealId] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dealIdError, setDealIdError] = useState("");
  const [activeHistoryTab, setActiveHistoryTab] = useState<"client" | "similar">("client");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (dealIdParam && deals && deals.length > 0) {
      const match = deals.find((d: any) => d.id === dealIdParam);
      if (match) {
        setSelectedDealId(dealIdParam);
        setDealIdError("");
      } else {
        setDealIdError(`Deal ID "${dealIdParam}" provided in the URL does not exist or has been deleted.`);
      }
    }
  }, [dealIdParam, deals]);

  const selectedDeal = deals?.find((d: any) => d.id === selectedDealId);
  const leadId = selectedDeal?.leadId;

  const { data: clientHistory } = useQuery({
    queryKey: ["clientHistory", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const res = await fetch(`/api/v1/quotes/history/client/${leadId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!leadId
  });

  const { data: leadData } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!leadId
  });

  const [items, setItems] = useState<any[]>([]);
  const activeProductId = items[focusedIndex]?.productId;

  const uniqueProductIds = Array.from(new Set(items.map((i: any) => i.productId).filter(Boolean)));
  const productIdsQuery = uniqueProductIds.join(",");

  const { data: similarClientQuotes } = useQuery({
    queryKey: ["similarClientQuotes", productIdsQuery, leadId, selectedDealId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/quotes/history/similar-clients?dealId=${selectedDealId || ""}&productIds=${productIdsQuery}&leadId=${leadId || ""}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDealId
  });

  const handleUseQuote = (historicalQuote: any) => {
    const hasUnsavedItems = items.some((i: any) => i.productId || i.quantity > 1 || i.unitPrice > 0);
    if (hasUnsavedItems) {
      const confirmOverwrite = window.confirm(
        "Are you sure you want to overwrite your current unsaved quotation items with this historical quote?"
      );
      if (!confirmOverwrite) return;
    }
    
    const newItems = (historicalQuote.QuoteLineItems || []).map((li: any) => {
      const qty = Number(li.quantity || 1);
      const price = parseFloat(li.unitPrice || 0);
      return {
        productId: li.productId,
        quantity: qty,
        unitPrice: price,
        total: qty * price,
        isOptional: !!li.isOptional
      };
    });
    setItems(newItems);
  };

  const handleSendAsIs = async (historicalQuote: any) => {
    const quoteItems = historicalQuote.QuoteLineItems || [];
    if (quoteItems.length === 0) return;

    const clientName = historicalQuote.deal?.lead?.company || (historicalQuote.deal?.lead?.firstName + " " + historicalQuote.deal?.lead?.lastName) || "Unknown Client";
    const totalAmount = historicalQuote.totalAmount || 0;
    const itemCount = quoteItems.length;

    const confirmSend = window.confirm(
      `Are you sure you want to send this quote directly to the client as-is?\n\nClient: ${clientName}\nTotal Amount: ${formatCurrency(totalAmount)}\nLine Items: ${itemCount}`
    );
    if (!confirmSend) return;

    try {
      const mappedItems = quoteItems.map((li: any) => ({
        productId: li.productId,
        quantity: Number(li.quantity || 1),
        unitPrice: parseFloat(li.unitPrice || 0),
        discount: 0,
        taxRate: 15,
        isOptional: !!li.isOptional
      }));

      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          dealId: selectedDealId,
          items: mappedItems,
          status: "Pending"
        })
      });
      if (!res.ok) throw new Error("Failed to send quote");
      alert("Quote saved!");
      window.location.href = "/quotes";
    } catch (err: any) {
      alert(err.message || "An error occurred while sending the quote.");
    }
  };

  const { data: similarStats } = useQuery({
    queryKey: ["similarStats", activeProductId, leadId],
    queryFn: async () => {
      if (!activeProductId) return null;
      const res = await fetch(`/api/v1/quotes/history/similar/${activeProductId}?leadId=${leadId || ""}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeProductId
  });

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

  const addItem = () => {
    setItems([...items, { productId: "", quantity: 1, unitPrice: 0, total: 0, isOptional: false }]);
    setFocusedIndex(items.length);
  };

  const applyAllRecommendations = () => {
    if (!recommendations || recommendations.length === 0) return;
    const toAdd = recommendations
      .filter((rec: any) => rec.productId)
      .map((rec: any) => ({
        productId: rec.productId,
        quantity: rec.quantity || 1,
        unitPrice: rec.unitPrice,
        discount: 0,
        total: (rec.quantity || 1) * rec.unitPrice,
        isOptional: false
      }));
    if (toAdd.length > 0) {
      setItems([...items, ...toAdd]);
    }
  };

  const handleSelectBundle = (bundleId: string) => {
    if (!bundleId) return;
    const bundle = bundles?.find((b: any) => b.id === bundleId);
    if (!bundle) return;
    const newItems = bundle.items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.product?.msrp || item.product?.listPrice || item.product?.unitPrice || 0),
      isOptional: !!item.isOptional,
      total: (item.quantity || 1) * parseFloat(item.product?.msrp || item.product?.listPrice || item.product?.unitPrice || 0)
    }));
    setItems([...items, ...newItems]);
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
      <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-6">
        <Link to="/quotes" className="hover:text-primary">Quotes</Link>
        <span className="opacity-50">/</span>
        <span>New Quotation</span>
      </div>
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
                    {dealIdError && (
                      <div className="text-xs text-error font-semibold bg-error-container text-error border border-error/20 px-3 py-1.5 rounded-lg mt-2 max-w-md">
                        {dealIdError}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
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

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-on-surface-variant">Start from Bundle:</span>
                        <select 
                          className="bg-surface border border-outline-variant rounded p-1 text-sm"
                          defaultValue=""
                          onChange={e => {
                            handleSelectBundle(e.target.value);
                            e.target.value = "";
                          }}
                        >
                          <option value="">-- Choose Bundle --</option>
                          {bundles?.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
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
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-24 text-center">Optional</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase w-32 text-right">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-on-surface-variant">No items added. Click "Add Product" to begin.</td>
                    </tr>
                  ) : (
                    items.map((item: any, i: number) => (
                      <tr 
                        key={i} 
                        className={`hover:bg-surface-container-low transition-colors cursor-pointer ${
                          item.isOptional 
                            ? "bg-surface-container-lowest/50 border-l-4 border-dashed border-outline-variant" 
                            : (i === focusedIndex ? "bg-primary-container/20 border-l-4 border-primary" : (i % 2 === 1 ? "bg-surface-container-low/30" : ""))
                        }`} 
                        onClick={() => setFocusedIndex(i)}
                      >
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
                        <td className="px-4 py-4 text-center">
                          <input 
                            type="checkbox"
                            checked={!!item.isOptional}
                            onChange={(e) => updateItem(i, 'isOptional', e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-sm">{formatCurrency(item.total)}</td>
                        <td className="px-4 py-4 text-on-surface-variant hover:text-error cursor-pointer" onClick={(e) => { e.stopPropagation(); removeItem(i); }}>
                          <Trash2 className="w-5 h-5" />
                        </td>
                      </tr>
                    ))
                  )}
                  {recommendations && recommendations.length > 0 && (
                    <tr>
                      <td className="px-4 py-4" colSpan={7}>
                        <div className="flex flex-col gap-3 p-4 bg-primary-container/10 border border-primary-container rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-5 h-5 text-primary" />
                              <span className="font-bold text-primary">Requirements-based Recommendations</span> 
                            </div>
                            <button 
                              onClick={applyAllRecommendations}
                              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded hover:opacity-90 transition-colors"
                            >
                              Apply All to Quote
                            </button>
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
                  {items.length > 0 && (
                    <>
                      <tr className="bg-surface-container-low/50">
                        <td colSpan={6} className="px-4 py-3 text-right font-semibold text-on-surface-variant">Required Subtotal:</td>
                        <td className="px-4 py-3 text-right font-bold text-on-surface">{formatCurrency(items.filter((item: any) => !item.isOptional).reduce((acc: number, item: any) => acc + (item.total || 0), 0))}</td>
                        <td></td>
                      </tr>
                      {items.some((item: any) => item.isOptional) && (
                        <tr className="bg-surface-container-low/20">
                          <td colSpan={6} className="px-4 py-3 text-right font-semibold text-outline">Optional Items Subtotal:</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-500">{formatCurrency(items.filter((item: any) => item.isOptional).reduce((acc: number, item: any) => acc + (item.total || 0), 0))}</td>
                          <td></td>
                        </tr>
                      )}
                    </>
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
          
          {/* Requirements from Lead */}
          {leadData?.categoriesData && Array.isArray(leadData.categoriesData) && leadData.categoriesData.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-primary">
                <Lightbulb className="w-5 h-5" /> Requirements from Lead
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">
                These requirements were configured during the lead stage. Use them to construct this quotation.
              </p>
              <div className="space-y-4">
                {leadData.categoriesData.map((cat: any, idx: number) => (
                  <div key={idx} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
                    <h4 className="text-sm font-bold text-on-surface mb-2">{cat.categoryName}</h4>
                    <div className="space-y-1">
                      {cat.items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-on-surface-variant">
                          <span>• {item.name}</span>
                          <span className="font-semibold text-on-surface">{item.quantity} {item.unit || 'units'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integrated Quote Reference & History Tabs */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm flex flex-col">
            {/* Tabs Header */}
            <div className="flex border-b border-outline-variant">
              <button
                onClick={() => setActiveHistoryTab("client")}
                className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-colors ${
                  activeHistoryTab === "client"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Client History
              </button>
              <button
                onClick={() => setActiveHistoryTab("similar")}
                className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-colors ${
                  activeHistoryTab === "similar"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Similar Clients
              </button>
            </div>

            {/* Tab Body */}
            <div className="divide-y divide-outline-variant max-h-[500px] overflow-y-auto">
              
              {/* Tab 1: Client History */}
              {activeHistoryTab === "client" && (
                <>
                  {!clientHistory || clientHistory.length === 0 ? (
                    <div className="p-6 text-sm text-outline italic text-center">No previous quotations for this client/company.</div>
                  ) : (
                    clientHistory.map((hQuote: any, idx: number) => {
                      const isExpanded = !!expandedCards[hQuote.id];
                      return (
                        <div
                          key={hQuote.id || idx}
                          onClick={() => toggleCardExpand(hQuote.id)}
                          className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group flex flex-col gap-1.5"
                        >
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-bold group-hover:text-primary">{hQuote.quoteNumber || hQuote.id.substring(0, 8)}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                              hQuote.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                              hQuote.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {hQuote.status}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant font-medium">
                            {new Date(hQuote.createdAt).toLocaleDateString()} • {formatCurrency(hQuote.totalAmount)}
                          </p>

                          {isExpanded ? (
                            <div className="text-[11px] text-on-surface-variant font-medium leading-relaxed bg-surface-container-low p-2.5 rounded-lg border border-outline-variant mt-1.5 space-y-1">
                              {hQuote.QuoteLineItems?.map((li: any, lIdx: number) => (
                                <div key={lIdx} className="flex justify-between">
                                  <span>{li.product?.name || "Product"} (x{li.quantity})</span>
                                  <span className="font-semibold">{formatCurrency(li.unitPrice * li.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[10px] text-outline truncate mt-0.5">
                              Items: {hQuote.QuoteLineItems?.map((li: any) => li.product?.name || "Product").join(", ") || "None"}
                            </div>
                          )}

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUseQuote(hQuote);
                              }}
                              disabled={!hQuote.QuoteLineItems || hQuote.QuoteLineItems.length === 0}
                              className="text-[11px] font-bold text-primary hover:bg-primary/20 bg-primary/10 px-2.5 py-1.5 rounded transition-all disabled:opacity-40"
                            >
                              Edit & Use
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendAsIs(hQuote);
                              }}
                              disabled={!hQuote.QuoteLineItems || hQuote.QuoteLineItems.length === 0}
                              className="text-[11px] font-bold text-white bg-primary hover:bg-primary/95 px-2.5 py-1.5 rounded transition-all disabled:opacity-40"
                            >
                              Send As-Is
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* Tab 2: Similar Clients */}
              {activeHistoryTab === "similar" && (
                <div className="p-4 space-y-4">
                  {/* Comparable Quote Cards */}
                  <div className="space-y-3.5">
                    {!similarClientQuotes || similarClientQuotes.length === 0 ? (
                      <div className="text-xs text-outline italic text-center py-4">No matching historical quote records found.</div>
                    ) : (
                      similarClientQuotes.map((sQuote: any, idx: number) => {
                        const isExpanded = !!expandedCards[sQuote.id];
                        return (
                          <div
                            key={sQuote.id || idx}
                            onClick={() => toggleCardExpand(sQuote.id)}
                            className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant hover:border-primary transition-all flex flex-col gap-2 cursor-pointer"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-bold text-on-surface">{sQuote.deal?.lead?.company || sQuote.deal?.lead?.firstName + " " + sQuote.deal?.lead?.lastName || "N/A"}</h4>
                                <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{sQuote.quoteNumber}</p>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                sQuote.status === "Accepted" || sQuote.status === "Approved" ? "bg-green-100 text-green-700 border border-green-200" :
                                sQuote.status === "Sent" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                sQuote.status === "Viewed" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                                "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}>
                                {sQuote.status}
                              </span>
                            </div>

                            {isExpanded ? (
                              <div className="text-[11px] text-on-surface-variant font-medium leading-relaxed bg-surface-container-low p-2.5 rounded-lg border border-outline-variant mt-1.5 space-y-1">
                                {sQuote.QuoteLineItems?.map((li: any, lIdx: number) => (
                                  <div key={lIdx} className="flex justify-between">
                                    <span>{li.product?.name || "Product"} (x{li.quantity})</span>
                                    <span className="font-semibold">{formatCurrency(li.unitPrice * li.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-on-surface-variant font-medium leading-relaxed bg-surface-container-low p-2 rounded-lg border border-outline-variant/40 space-y-0.5">
                                {sQuote.QuoteLineItems?.map((li: any, lIdx: number) => (
                                  <div key={lIdx} className="truncate">
                                    {li.product?.name || "Product"} ({li.quantity}x @ {formatCurrency(li.unitPrice)})
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-on-surface-variant mt-0.5 border-t border-outline-variant/30 pt-1.5">
                              <span>{new Date(sQuote.createdAt).toLocaleDateString()}</span>
                              <span className="font-bold text-primary text-xs">{formatCurrency(sQuote.totalAmount)}</span>
                            </div>

                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUseQuote(sQuote);
                                }}
                                disabled={!sQuote.QuoteLineItems || sQuote.QuoteLineItems.length === 0}
                                className="text-[11px] font-bold text-primary hover:bg-primary/20 bg-primary/10 px-2.5 py-1.5 rounded transition-all disabled:opacity-40"
                              >
                                Edit & Use
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendAsIs(sQuote);
                                }}
                                disabled={!sQuote.QuoteLineItems || sQuote.QuoteLineItems.length === 0}
                                className="text-[11px] font-bold text-white bg-primary hover:bg-primary/95 px-2.5 py-1.5 rounded transition-all disabled:opacity-40"
                              >
                                Send As-Is
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

            </div>
            
            {activeHistoryTab === "client" && (
              <button className="w-full p-3.5 text-sm font-semibold text-secondary hover:bg-surface-container transition-colors rounded-b-xl border-t border-outline-variant">
                View Full History
              </button>
            )}
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
