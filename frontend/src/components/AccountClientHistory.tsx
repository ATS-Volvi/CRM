import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  DollarSign,
  Package,
  Clock,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

interface AccountClientHistoryProps {
  accountId: string;
  accountName?: string;
  leads?: any[];
  quotes?: any[];
  deals?: any[];
  orders?: any[];
  activities?: any[];
}

export function AccountClientHistory({
  accountId,
  accountName = "Client",
  leads = [],
  quotes = [],
  deals = [],
  orders = [],
  activities = []
}: AccountClientHistoryProps) {
  const [activeTab, setActiveTab] = useState<"all" | "leads" | "quotes" | "orders" | "activities">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Normalize and combine timeline items
  const combinedHistory = useMemo(() => {
    const items: any[] = [];

    // 1. Leads
    leads.forEach((lead) => {
      items.push({
        id: `lead-${lead.id}`,
        type: "lead",
        title: lead.subject || lead.body?.substring(0, 50) || `Inquiry #${lead.leadNumber || lead.id.substring(0, 6)}`,
        subtitle: lead.sourceDetail || lead.source || "Inbound Web Inquiry",
        snippet: lead.body || lead.notes || "Customer submitted initial inquiry and scope requirements.",
        status: lead.status || "NEW",
        amount: lead.expectedRevenue || (lead.leadScore ? lead.leadScore * 1000 : null),
        date: new Date(lead.createdAt || Date.now()),
        link: `/leads/${lead.id}`,
        raw: lead
      });
    });

    // 2. Quotes
    quotes.forEach((quote) => {
      items.push({
        id: `quote-${quote.id}`,
        type: "quote",
        title: `Commercial Quote #${quote.quoteNumber || quote.id.substring(0, 8)}`,
        subtitle: quote.deal?.name || "Official Pricing Proposal",
        snippet: quote.notes || `Formal quotation generated with total value of ${formatCurrency(quote.total || quote.grandTotal || 0)}`,
        status: quote.status || "SENT",
        amount: quote.total || quote.grandTotal || 0,
        date: new Date(quote.createdAt || Date.now()),
        link: `/quotes/${quote.id}`,
        raw: quote
      });
    });

    // 3. Deals / Opportunities
    deals.forEach((deal) => {
      items.push({
        id: `deal-${deal.id}`,
        type: "deal",
        title: deal.name || "Enterprise Opportunity",
        subtitle: deal.stage?.name || deal.stage || "Pipeline Deal",
        snippet: `Opportunity tracked in pipeline with expected close date ${deal.expectedCloseDate || "N/A"}`,
        status: deal.status || "OPEN",
        amount: deal.amount || deal.value || 0,
        date: new Date(deal.createdAt || Date.now()),
        link: `/opportunities/${deal.id}`,
        raw: deal
      });
    });

    // 4. Orders
    orders.forEach((order) => {
      items.push({
        id: `order-${order.id}`,
        type: "order",
        title: `Purchase Order #${order.orderNumber || order.poNumber || order.id.substring(0, 8)}`,
        subtitle: "Confirmed Order & Contract",
        snippet: order.notes || "Fulfilment order approved and active in delivery schedule.",
        status: order.status || "CONFIRMED",
        amount: order.totalAmount || order.total || 0,
        date: new Date(order.createdAt || Date.now()),
        link: `/invoices`,
        raw: order
      });
    });

    // 5. Activities
    activities.forEach((act) => {
      items.push({
        id: `act-${act.id}`,
        type: "activity",
        subType: act.type || "note",
        title: act.title || (act.type ? `${act.type.toUpperCase()} Log` : "Activity Record"),
        subtitle: act.createdBy?.name || act.createdByUser?.name || "Sales Rep",
        snippet: act.notes || act.outcome || "Interaction recorded with customer stakeholder.",
        status: act.isCompleted ? "COMPLETED" : "RECORDED",
        amount: null,
        date: new Date(act.createdAt || Date.now()),
        raw: act
      });
    });

    // Sort descending
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [leads, quotes, deals, orders, activities]);

  // Filter items based on tab & search
  const filteredHistory = useMemo(() => {
    return combinedHistory.filter((item) => {
      // Tab filter
      if (activeTab === "leads" && item.type !== "lead") return false;
      if (activeTab === "quotes" && item.type !== "quote") return false;
      if (activeTab === "orders" && item.type !== "order") return false;
      if (activeTab === "activities" && item.type !== "activity") return false;

      // Query search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${item.title} ${item.subtitle} ${item.snippet} ${item.status}`.toLowerCase();
        return text.includes(q);
      }

      return true;
    });
  }, [combinedHistory, activeTab, searchQuery]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Client History & Commercial Record
            </h3>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {combinedHistory.length} records
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete historical track record of pre-sales inquiries, quotes, orders, and touchpoints for {accountName}.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search client history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 w-full sm:w-56 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "all"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full opacity-80 bg-black/20 dark:bg-white/20">
            {combinedHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "leads"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Inquiries & Leads</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {leads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("quotes")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "quotes"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Quotations</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
            {quotes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "orders"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Orders</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("activities")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "activities"
              ? "bg-amber-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Activities & Touchpoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
            {activities.length}
          </span>
        </button>
      </div>

      {/* List Feed */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No records found for this view
            </p>
            <p className="text-[11px] text-slate-400">
              {searchQuery ? "Try refining your search terms." : "History will automatically populate as quotes, leads, and orders are registered."}
            </p>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isLead = item.type === "lead";
            const isQuote = item.type === "quote";
            const isDeal = item.type === "deal";
            const isOrder = item.type === "order";
            const isActivity = item.type === "activity";

            let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
            if (isLead) badgeColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
            if (isQuote) badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
            if (isDeal) badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800";
            if (isOrder) badgeColor = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
            if (isActivity) badgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";

            return (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Left: Icon & Details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Icon Box */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${badgeColor}`}>
                    {isLead && <MessageSquare className="w-4 h-4" />}
                    {isQuote && <FileText className="w-4 h-4" />}
                    {isDeal && <TrendingUp className="w-4 h-4" />}
                    {isOrder && <Package className="w-4 h-4" />}
                    {isActivity && (
                      item.subType === "call" ? <Phone className="w-4 h-4" /> :
                      item.subType === "email" ? <Mail className="w-4 h-4" /> :
                      item.subType === "meeting" ? <Calendar className="w-4 h-4" /> :
                      <Clock className="w-4 h-4" />
                    )}
                  </div>

                  {/* Text Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                        {item.title}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                      <span>{item.subtitle}</span>
                      <span>•</span>
                      <span>{item.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(item.date, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Value & Action Link */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
                  {item.amount !== null && item.amount !== undefined && (
                    <div className="text-right">
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {isQuote ? "Quote Value" : isOrder ? "Order Value" : "Value"}
                      </span>
                    </div>
                  )}

                  {item.link ? (
                    <Link
                      to={item.link}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
                    >
                      <span>View</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
