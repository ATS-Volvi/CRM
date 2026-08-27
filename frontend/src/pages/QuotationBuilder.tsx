import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Search, PlusCircle, Trash2, Lightbulb, ZoomIn, Printer, Maximize, BarChart2, Clock, MessageSquare, History, CheckCircle2, AlertTriangle, Shield, Package, Plus } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import QuotationDocumentRenderer from "../components/QuotationDocumentRenderer";
import { CatalogSearchModal } from "../components/CatalogSearchModal";

export default function QuotationBuilder() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const dealIdParam = searchParams.get("dealId");
  const parentQuoteIdParam = searchParams.get("parentQuoteId");

  const [selectedDealId, setSelectedDealId] = useState(dealIdParam || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl-ftc-standard");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dealIdError, setDealIdError] = useState("");
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const logDebug = (msg: string) => {
    console.log(msg);
  };
  const [activeHistoryTab, setActiveHistoryTab] = useState<"client" | "similar">("client");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const res = await fetch("/api/v1/quotes", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    enabled: !!token
  });

  // Direct fetch of the deal if dealIdParam is in the URL
  const { data: paramDeal } = useQuery({
    queryKey: ["opportunityParamDeal", dealIdParam],
    queryFn: async () => {
      if (!dealIdParam) return null;
      const res = await fetch(`/api/v1/opportunities/${dealIdParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      const fallbackRes = await fetch(`/api/v1/deals/${dealIdParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (fallbackRes.ok) return fallbackRes.json();
      return null;
    },
    enabled: !!dealIdParam && !!token
  });

  // Fetch all opportunities for the dropdown
  const { data: allOpportunities = [] } = useQuery({
    queryKey: ["allOpportunitiesForQuotation"],
    queryFn: async () => {
      const res = await fetch("/api/v1/opportunities", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: !!token
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/v1/pipeline", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      const pipeline = await res.json();
      if (!Array.isArray(pipeline)) return [];
      return pipeline.flatMap((col: any) => col.deals || []);
    },
    enabled: !!token
  });

  const combinedDeals = [
    ...(paramDeal ? [paramDeal] : []),
    ...(Array.isArray(allOpportunities) ? allOpportunities : []),
    ...(Array.isArray(deals) ? deals : [])
  ].filter((d, idx, arr) => d && d.id && arr.findIndex((x: any) => x?.id === d?.id) === idx);

  const { data: products } = useQuery({
    queryKey: ["priceBook"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const { data: bundles } = useQuery({
    queryKey: ["bundles"],
    queryFn: async () => {
      const res = await fetch("/api/v1/bundle-templates", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  const { data: masterRequirements } = useQuery({
    queryKey: ["masterRequirements"],
    queryFn: async () => {
      const res = await fetch("/api/v1/master-data/requirements", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Failed to fetch requirements: ${res.status}`);
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnMount: true
  });

  const { data: quoteTemplates } = useQuery({
    queryKey: ["quoteTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/v1/quote-templates", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (dealIdParam) {
      setSelectedDealId(dealIdParam);
      setDealIdError("");
    }
  }, [dealIdParam]);

  // Auto-populate line items when revising a rejected quote
  const { data: parentQuote } = useQuery({
    queryKey: ["parentQuote", parentQuoteIdParam],
    queryFn: async () => {
      if (!parentQuoteIdParam) return null;
      const res = await fetch(`/api/v1/quotes/${parentQuoteIdParam}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!parentQuoteIdParam
  });

  const [parentQuoteLoaded, setParentQuoteLoaded] = useState(false);

  useEffect(() => {
    if (parentQuote && !parentQuoteLoaded) {
      // 1. Auto-select the deal from the parent quote (bypasses pipeline filter)
      const pqDealId = (parentQuote as any).dealId;
      if (pqDealId) {
        setSelectedDealId(pqDealId);
        setDealIdError("");
      }

      // 2. Pre-populate line items (wait for products if needed)
      const rawItems = (parentQuote as any).QuoteLineItems || (parentQuote as any).quoteLineItems || [];
      if (rawItems.length > 0) {
        const newItems = rawItems.map((li: any) => {
          const prod = li.product || products?.find((p: any) => p.id === li.productId);
          const name = li.name || prod?.name || "Quote Item";
          const desc = li.description || prod?.description || name;
          const qty = Number(li.quantity || 1);
          const price = parseFloat(li.unitPrice || 0);
          return {
            productId: li.productId,
            name,
            description: desc,
            unit: prod?.unit || "nos",
            uom: prod?.unit || "nos",
            quantity: qty,
            unitPrice: price,
            discount: Number(li.discount || 0),
            total: qty * price,
            isOptional: !!li.isOptional
          };
        });
        setItems(newItems);
        setFocusedIndex(0);
      }
      setParentQuoteLoaded(true);
    }
  }, [parentQuote, parentQuoteLoaded, products]);

  // Resolve selected deal info with priority: paramDeal -> parentQuote.deal -> combinedDeals match
  const selectedDeal = paramDeal
    || (parentQuote && (parentQuote as any).deal ? (parentQuote as any).deal : null)
    || combinedDeals.find((d: any) => d.id === selectedDealId);
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

  const nonOptionalItems = items.filter((item: any) => !item.isOptional);

  const calculatedSubtotal = nonOptionalItems.reduce((acc: number, item: any) => {
    const qty = Number(item.quantity || 1);
    const uPrice = Number(item.unitPrice || 0);
    return acc + (qty * uPrice);
  }, 0);

  const calculatedTotalDiscount = nonOptionalItems.reduce((acc: number, item: any) => {
    const qty = Number(item.quantity || 1);
    const uPrice = Number(item.unitPrice || 0);
    const discPct = Number(item.discount || 0);
    const lineGross = qty * uPrice;
    const lineSubtotal = item.total !== undefined && !isNaN(item.total)
      ? Number(item.total)
      : lineGross * (1 - discPct / 100);
    return acc + Math.max(0, lineGross - lineSubtotal);
  }, 0);

  const calculatedTotalTax = nonOptionalItems.reduce((acc: number, item: any) => {
    const qty = Number(item.quantity || 1);
    const uPrice = Number(item.unitPrice || 0);
    const discPct = Number(item.discount || 0);
    const taxPct = Number(item.tax !== undefined && item.tax !== null ? item.tax : 15);
    const lineGross = qty * uPrice;
    const lineSubtotal = item.total !== undefined && !isNaN(item.total)
      ? Number(item.total)
      : lineGross * (1 - discPct / 100);
    return acc + (lineSubtotal * (taxPct / 100));
  }, 0);

  const calculatedGrandTotal = calculatedSubtotal - calculatedTotalDiscount + calculatedTotalTax;

  const currentTotalAmount = calculatedGrandTotal;

  const { data: evaluation } = useQuery({
    queryKey: ["quoteEvaluation", selectedDealId, currentTotalAmount, items.length],
    queryFn: async () => {
      const res = await fetch(`/api/v1/quotes/preview/evaluate-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          totalAmount: currentTotalAmount,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, isOptional: i.isOptional })),
          salesRepId: selectedDeal?.ownerId
        })
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: items.length > 0
  });

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
    logDebug("handleUseQuote called. Historical quote: " + JSON.stringify(historicalQuote));
    const hasUnsavedItems = items.some((i: any) => i.productId || i.quantity > 1 || i.unitPrice > 0);
    if (hasUnsavedItems) {
      const confirmOverwrite = window.confirm(
        "Are you sure you want to overwrite your current unsaved quotation items with this historical quote?"
      );
      if (!confirmOverwrite) {
        logDebug("handleUseQuote canceled by user confirm prompt");
        return;
      }
    }
    
    const rawItems = historicalQuote.QuoteLineItems || [];
    logDebug("Raw QuoteLineItems count: " + rawItems.length);

    const newItems = rawItems.map((li: any) => {
      const prod = li.product || products?.find((p: any) => p.id === li.productId);
      const name = li.name || prod?.name || li.product?.name || "Quote Item";
      const desc = li.description || prod?.description || name;
      const qty = Number(li.quantity || 1);
      const price = parseFloat(li.unitPrice || 0);
      return {
        productId: li.productId,
        name: name,
        description: desc,
        unit: prod?.unit || "nos",
        uom: prod?.unit || "nos",
        quantity: qty,
        unitPrice: price,
        discount: Number(li.discount || 0),
        total: qty * price,
        isOptional: !!li.isOptional
      };
    });
    logDebug("Mapped newItems: " + JSON.stringify(newItems));
    setItems(newItems);
    setFocusedIndex(0);
  };

  const handleSendAsIs = async (historicalQuote: any) => {
    logDebug("handleSendAsIs called. Historical quote: " + JSON.stringify(historicalQuote));
    const quoteItems = historicalQuote.QuoteLineItems || [];
    if (quoteItems.length === 0) {
      logDebug("handleSendAsIs aborted: QuoteLineItems is empty");
      return;
    }

    const clientName = historicalQuote.deal?.lead?.company || (historicalQuote.deal?.lead?.firstName + " " + historicalQuote.deal?.lead?.lastName) || "Unknown Client";
    const totalAmount = historicalQuote.totalAmount || 0;
    const itemCount = quoteItems.length;

    const confirmSend = window.confirm(
      `Are you sure you want to send this quote directly to the client as-is?\n\nClient: ${clientName}\nTotal Amount: ${formatCurrency(totalAmount)}\nLine Items: ${itemCount}`
    );
    if (!confirmSend) {
      logDebug("handleSendAsIs canceled by user confirm prompt");
      return;
    }

    try {
      const mappedItems = quoteItems.map((li: any) => {
        const prod = li.product || products?.find((p: any) => p.id === li.productId);
        const name = li.name || prod?.name || li.product?.name || "Quote Item";
        const desc = li.description || prod?.description || name;
        return {
          productId: li.productId,
          name: name,
          description: desc,
          quantity: Number(li.quantity || 1),
          unitPrice: parseFloat(li.unitPrice || 0),
          discount: Number(li.discount || 0),
          taxRate: 15,
          isOptional: !!li.isOptional
        };
      });
      logDebug("handleSendAsIs posting payload: " + JSON.stringify({
        dealId: selectedDealId,
        items: mappedItems,
        status: "Pending"
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
      
      logDebug("POST /api/v1/quotes response status: " + res.status);
      const resText = await res.text();
      logDebug("POST /api/v1/quotes raw response: " + resText);

      let resData: any = {};
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        logDebug("Failed to parse response JSON: " + e);
      }

      if (!res.ok) {
        throw new Error(resData.error || "Failed to send quote");
      }
      logDebug("Quote saved successfully. Redirecting...");
      alert("Quote saved!");
      window.location.href = "/quotes";
    } catch (err: any) {
      logDebug("handleSendAsIs error: " + err.message);
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
    setItems([...items, { productId: "", name: "", description: "", unit: "nos", uom: "nos", quantity: 1, unitPrice: 0, discount: 0, total: 0, isOptional: false }]);
    setFocusedIndex(items.length);
  };

  const applyAllRecommendations = () => {
    if (!recommendations || recommendations.length === 0) return;
    const toAdd = recommendations
      .filter((rec: any) => rec.productId)
      .map((rec: any) => {
        const prod = products?.find((p: any) => p.id === rec.productId);
        const name = rec.name || rec.productName || prod?.name || "Recommended Item";
        const desc = rec.description || prod?.description || name;
        const qty = rec.quantity || 1;
        const uPrice = rec.unitPrice || prod?.unitPrice || 0;
        return {
          productId: rec.productId,
          name: name,
          description: desc,
          unit: prod?.unit || "nos",
          uom: prod?.unit || "nos",
          quantity: qty,
          unitPrice: uPrice,
          discount: 0,
          total: qty * uPrice,
          isOptional: false
        };
      });
    if (toAdd.length > 0) {
      setItems([...items, ...toAdd]);
    }
  };

  const handleSelectBundle = (bundleId: string) => {
    if (!bundleId) return;
    const bundle = bundles?.find((b: any) => b.id === bundleId);
    if (!bundle) return;
    const newItems = bundle.items.map((item: any) => {
      const prod = item.product || products?.find((p: any) => p.id === item.productId);
      const name = prod?.name || item.product?.name || item.name || "Bundle Item";
      const desc = prod?.description || item.description || name;
      const uPrice = parseFloat(prod?.unitPrice || prod?.msrp || prod?.listPrice || item.unitPrice || 0);
      const qty = item.quantity || 1;
      return {
        productId: item.productId,
        name: name,
        description: desc,
        unit: prod?.unit || "nos",
        uom: prod?.unit || "nos",
        quantity: qty,
        unitPrice: uPrice,
        discount: 0,
        isOptional: !!item.isOptional,
        total: qty * uPrice
      };
    });
    setItems([...items, ...newItems]);
  };

  const handleImportRequirement = (reqId: string) => {
    if (!reqId) return;
    const reqObj = masterRequirements?.find((r: any) => r.id === reqId);
    if (!reqObj) return;

    if (!reqObj.lineItems || reqObj.lineItems.length === 0) {
      alert(`Requirement "${reqObj.name}" has no line items configured yet. Please add line items to this requirement in the Master Data settings first.`);
      return;
    }

    const toAdd = reqObj.lineItems.map((li: any) => {
      // Try to match to a product in the price book by name
      const matchedProd = products?.find((p: any) =>
        p.name?.toLowerCase().includes(li.name?.toLowerCase()) ||
        li.name?.toLowerCase().includes(p.name?.toLowerCase())
      );
      // Use the pre-computed totalPrice from the requirement line item (sum of construction items)
      const unitPrice = li.totalPrice && li.totalPrice > 0
        ? parseFloat(li.totalPrice)
        : matchedProd
          ? parseFloat(matchedProd.unitPrice || matchedProd.msrp || 0)
          : 0;
      const qty = parseFloat(li.defaultQuantity) || 1;
      return {
        productId: matchedProd?.id || "",
        name: li.name,
        description: li.description || matchedProd?.description || li.name,
        unit: li.unit || matchedProd?.unit || "nos",
        uom: li.unit || matchedProd?.unit || "nos",
        nameOverride: li.name,
        quantity: qty,
        unitPrice: unitPrice,
        discount: 0,
        total: qty * unitPrice,
        isOptional: false
      };
    });

    setItems(prev => [...prev, ...toAdd]);
  };

  const handleCatalogItemSelect = (catItem: any) => {
    const qty = 1;
    const unitPrice = parseFloat(catItem.unitPrice || 0);
    const tax = parseFloat(catItem.tax || 0);
    const newItem = {
      productId: catItem.id,
      catalogItemId: catItem.id,
      name: catItem.name,
      description: catItem.description || catItem.name,
      nameOverride: catItem.name,
      quantity: qty,
      unitPrice: unitPrice,
      minSellingPrice: catItem.minSellingPrice ? parseFloat(catItem.minSellingPrice) : null,
      tax: tax,
      discount: 0,
      total: qty * unitPrice,
      isOptional: false,
      isCustom: false,
      uom: catItem.uom || "nos",
      unit: catItem.uom || "nos"
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'productId') {
      const prod = products?.find((p: any) => p.id === value);
      if (prod) {
        newItems[index].name = prod.name;
        newItems[index].description = prod.description || prod.name;
        newItems[index].unit = prod.unit || "nos";
        newItems[index].uom = prod.unit || "nos";
        newItems[index].unitPrice = parseFloat(prod.unitPrice || prod.msrp || prod.listPrice || 0);
      } else if (!value) {
        newItems[index].name = "";
        newItems[index].description = "";
      }
    }
    if (field === 'name') {
      newItems[index].description = value;
    }
    if (field === 'description' && !newItems[index].name) {
      newItems[index].name = value;
    }
    const qty = Number(newItems[index].quantity || 1);
    const uPrice = Number(newItems[index].unitPrice || 0);
    const discPct = Number(newItems[index].discount || 0);
    const discRatio = 1 - (discPct / 100);
    newItems[index].total = qty * uPrice * discRatio;
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
          status,
          ...(parentQuoteIdParam ? { parentQuoteId: parentQuoteIdParam } : {})
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save quote" }));
        throw new Error(err.error || "Failed to save quote");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      if (selectedDealId) {
        queryClient.invalidateQueries({ queryKey: ["opportunity-quotes", selectedDealId] });
        queryClient.invalidateQueries({ queryKey: ["opportunity-detail", selectedDealId] });
        queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", selectedDealId] });
      }
      alert("Quote saved successfully!");
      if (selectedDealId) {
        navigate(`/opportunities/${selectedDealId}`);
      } else {
        navigate("/quotes");
      }
    }
  });

  const quote = quotes?.[0]; // Show the first one for the builder

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background h-[calc(100vh-64px)]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-6">
        <Link to="/quotes" className="hover:text-primary">Quotes</Link>
        <span className="opacity-50">/</span>
        <span>{parentQuoteIdParam ? 'Revise Quote' : 'New Quotation'}</span>
      </div>
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8 h-full">
        {/* Left: Builder Core (Line Items & Totals) */}
        <div className="col-span-8 space-y-8">
          
          {/* Client Header Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
            {isLoading ? (
              <div className="animate-pulse flex items-center gap-4 w-full h-12 bg-surface-container-low rounded"></div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-on-surface tracking-tight">
                      {parentQuoteIdParam ? '+ Revise Quote' : 'New Quotation'}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">Build quotation with BOM line items &amp; discount approval</p>
                    {parentQuoteIdParam && parentQuote && (
                      <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800">
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Revising: <span className="font-bold">{(parentQuote as any).quoteNumber || parentQuoteIdParam}</span>
                        &nbsp;&mdash; pre-filled with previous line items. Adjust as needed.
                      </div>
                    )}
                    {dealIdError && (
                      <div className="text-xs text-error font-semibold bg-error-container text-error border border-error/20 px-3 py-1.5 rounded-lg mt-2 max-w-md">
                        {dealIdError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => saveMutation.mutate("Draft")}
                      disabled={saveMutation.isPending || !selectedDealId}
                      className="px-4 py-2 border border-outline text-xs font-bold rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50 whitespace-nowrap shadow-2xs"
                    >
                      Save as Draft
                    </button>
                    <button
                      onClick={() => saveMutation.mutate("Sent")}
                      disabled={saveMutation.isPending || !selectedDealId}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap shadow-xs"
                    >
                      Save & Send Quote
                    </button>
                  </div>

                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Deal:</span>
                    {parentQuoteIdParam || (dealIdParam && selectedDeal) ? (
                      // Locked deal badge when launched from Opportunity or Revision
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                        {selectedDeal?.name || (parentQuote as any)?.deal?.name || 'Loading deal…'}
                        {selectedDeal?.account?.name ? ` • ${selectedDeal.account.name}` : selectedDeal?.client ? ` • ${selectedDeal.client}` : ''}
                      </span>
                    ) : (
                      <select
                        className="bg-surface border border-outline-variant rounded-lg p-2 text-xs font-medium focus:ring-1 focus:ring-primary min-w-[220px]"
                        value={selectedDealId}
                        onChange={e => setSelectedDealId(e.target.value)}
                      >
                        <option value="">-- Choose Deal --</option>
                        {combinedDeals.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.account?.name || d.client || 'Direct Account'})</option>
                        ))}
                      </select>
                    )}
                  </div>


                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Start from Bundle:</span>
                    <select 
                      className="bg-surface border border-outline-variant rounded-lg p-2 text-xs font-medium focus:ring-1 focus:ring-primary min-w-[180px]"
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

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Master Requirement:
                    </span>
                    <select 
                      className="bg-primary/5 border border-primary/30 text-primary font-bold rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary min-w-[210px]"
                      defaultValue=""
                      onChange={e => {
                        handleImportRequirement(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">-- Import Requirement --</option>
                      {masterRequirements?.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.category})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Line Items Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-slate-50/50">
              <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Service Items</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsCatalogModalOpen(true)} 
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Package className="w-3.5 h-3.5" /> Add from Catalog
                </button>
                <button onClick={addItem} className="text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5" /> Add Blank Row
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-4 py-3 text-[12px] font-bold text-on-surface-variant uppercase">Product / Service</th>
                    <th className="px-4 py-3 text-[12px] font-bold text-blue-600 uppercase w-24 text-center">
                      <span className="flex items-center justify-center gap-1">Qty ✏️</span>
                    </th>
                    <th className="px-4 py-3 text-[12px] font-bold text-blue-600 uppercase w-36">
                      <span className="flex items-center gap-1">Unit Price ✏️</span>
                    </th>
                    <th className="px-4 py-3 text-[12px] font-bold text-orange-500 uppercase w-28">
                      <span className="flex items-center gap-1">Disc % ✏️</span>
                    </th>
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
                          <div className="space-y-1">
                            <select 
                              className="w-full border border-outline-variant rounded p-1 text-sm bg-transparent"
                              value={item.productId || ""}
                              onChange={(e) => updateItem(i, 'productId', e.target.value)}
                            >
                              <option value="">Select Product...</option>
                              {products?.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                              ))}
                            </select>
                            {(!item.productId || item.nameOverride || item.name) && (
                              <input
                                type="text"
                                placeholder="Item description / Custom name"
                                className="w-full border border-slate-200 bg-white rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-slate-300"
                                value={item.name || item.description || item.nameOverride || ""}
                                onChange={(e) => {
                                  updateItem(i, 'name', e.target.value);
                                  updateItem(i, 'description', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="w-full text-center border border-slate-300 bg-white rounded-md px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 hover:border-slate-400 transition-colors"
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center border border-slate-300 bg-white rounded-md overflow-hidden hover:border-slate-400 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-colors">
                            <span className="px-2 py-1.5 text-xs font-bold text-slate-400 bg-slate-50 border-r border-slate-200 select-none">SAR</span>
                            <input
                              className="flex-1 text-right pr-2 py-1.5 text-sm font-semibold bg-transparent focus:outline-none w-24"
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center border border-slate-300 bg-white rounded-md overflow-hidden hover:border-slate-400 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 transition-colors">
                            <input
                              className="flex-1 text-center pl-2 py-1.5 text-sm font-semibold bg-transparent focus:outline-none w-14"
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={item.discount || 0}
                              onChange={(e) => updateItem(i, 'discount', parseFloat(e.target.value) || 0)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="px-2 py-1.5 text-xs font-bold text-orange-500 bg-orange-50 border-l border-slate-200 select-none">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-400 font-medium">15%</td>

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
                                        const prod = products?.find((p: any) => p.id === rec.productId);
                                        const name = rec.name || rec.productName || prod?.name || "Recommended Item";
                                        const qty = rec.quantity || 1;
                                        const uPrice = rec.unitPrice || prod?.unitPrice || 0;
                                        setItems([...items, {
                                          productId: rec.productId,
                                          name: name,
                                          description: rec.description || prod?.description || name,
                                          unit: prod?.unit || "nos",
                                          uom: prod?.unit || "nos",
                                          quantity: qty,
                                          unitPrice: uPrice,
                                          discount: 10,
                                          total: qty * uPrice * 0.9,
                                          isOptional: false
                                        }]);
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
                  {items.length > 0 && items.some((item: any) => item.isOptional) && (
                    <tr className="bg-surface-container-low/20">
                      <td colSpan={6} className="px-4 py-3 text-right font-semibold text-outline">Optional Items Subtotal:</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-500">{formatCurrency(items.filter((item: any) => item.isOptional).reduce((acc: number, item: any) => acc + (item.total || 0), 0))}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Block */}
            {items.length > 0 && (
              <div className="p-5 bg-slate-50/80 border-t border-outline-variant flex justify-end">
                <div className="w-80 space-y-2.5 text-sm">
                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(calculatedSubtotal)}</span>
                  </div>

                  {calculatedTotalDiscount > 0 && (
                    <div className="flex justify-between items-center text-amber-700 font-medium">
                      <span>Discount:</span>
                      <span className="font-semibold text-amber-800">−{formatCurrency(calculatedTotalDiscount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span>Tax:</span>
                    <span className="font-semibold text-slate-900">+{formatCurrency(calculatedTotalTax)}</span>
                  </div>

                  <div className="border-t border-slate-300 my-2 pt-2.5 flex justify-between items-center">
                    <span className="text-base font-extrabold text-slate-900 uppercase tracking-tight">Grand Total:</span>
                    <span className="text-lg font-black text-blue-600">{formatCurrency(calculatedGrandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Salesperson Approval Hierarchy Status Banner */}
            {items.length > 0 && evaluation && (
              <div className="mt-4 p-4 rounded-xl border shadow-2xs transition-all">
                {evaluation.approvalLevel === "SALES_REP" && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-green-800 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-green-600" /> Quotation Approval Status
                      </div>
                      <div className="text-sm font-bold text-green-900 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" /> ✓ You can approve this quotation
                      </div>
                      <div className="text-xs text-green-700 font-medium mt-0.5">
                        Quote total {formatCurrency(currentTotalAmount)} is within your self-approval limit of ₹{(evaluation.repLimit || 1000000).toLocaleString()}.
                      </div>
                    </div>
                    <button
                      onClick={() => saveMutation.mutate("Approved")}
                      disabled={saveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve Quotation
                    </button>
                  </div>
                )}

                {evaluation.approvalLevel === "TEAM_LEAD" && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-600" /> Quotation Approval Status
                      </div>
                      <div className="text-sm font-bold text-amber-900 mt-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Team Lead approval required
                      </div>
                      <div className="text-xs text-amber-800 font-medium mt-0.5">
                        {evaluation.reason || `Quote exceeds your approval limit of ₹${(evaluation.repLimit || 1000000).toLocaleString()}.`}
                      </div>
                    </div>
                    <button
                      onClick={() => saveMutation.mutate("Pending Approval")}
                      disabled={saveMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" /> Submit for Team Lead Approval
                    </button>
                  </div>
                )}

                {evaluation.approvalLevel === "ADMIN" && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-red-600" /> Quotation Approval Status
                      </div>
                      <div className="text-sm font-bold text-red-900 mt-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-600" /> Admin approval required
                      </div>
                      <div className="text-xs text-red-800 font-medium mt-0.5">
                        {evaluation.reason || `This quotation exceeds the Team Lead approval threshold.`}
                      </div>
                    </div>
                    <button
                      onClick={() => saveMutation.mutate("Pending Approval")}
                      disabled={saveMutation.isPending}
                      className="bg-error hover:bg-error/95 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" /> Submit for Admin Approval
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PDF Preview Pane */}
          <div className="bg-slate-200/60 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-6 relative flex flex-col items-center overflow-x-auto w-full">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Format:</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 dark:text-white"
                >
                  {(quoteTemplates || [
                    { id: "tpl-ftc-standard", name: "FTC Saudi Arabia Standard" },
                    { id: "tpl-apex-logistics", name: "Apex Global Logistics" }
                  ]).map((t: any) => (
                    <option key={t.id || t.name} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Link to="/master-data/quote-templates" className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  + Add Custom PDF Template
                </Link>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2 rounded-lg shadow-xs hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  title="Print Document"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div id="pdf-preview-box" className="w-full flex justify-center mt-2">
              <QuotationDocumentRenderer
                template={quoteTemplates?.find((t: any) => t.id === selectedTemplateId)}
                leadData={leadData}
                items={items}
                quotationNumber={selectedDealId ? `QT-${selectedDealId.substring(0, 8).toUpperCase()}` : "QT-2026-881"}
                salesExecutive="Sophia Martinez"
              />
            </div>
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
                                console.log("[CLICK DEBUG] Edit & Use clicked for Client History quote:", hQuote);
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
                                  console.log("[CLICK DEBUG] Edit & Use clicked for Similar Clients quote:", sQuote);
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
              <Link to="/quotes" className="w-full p-3.5 text-sm font-semibold text-secondary hover:bg-surface-container transition-colors rounded-b-xl border-t border-outline-variant text-center block">
                View Full History
              </Link>
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
      {/* Catalog Search Modal */}
      <CatalogSearchModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        onSelect={handleCatalogItemSelect}
      />
    </div>
  );
}
