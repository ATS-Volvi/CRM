import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, FileText, Download, CheckCircle, Clock, AlertTriangle, Plus, Search, Filter, Calendar, MoreVertical, TrendingUp, Timer, Bolt } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

export default function QuoteHistory() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [valueBand, setValueBand] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: quotes, isLoading, refetch } = useQuery({
    queryKey: ["quotes", search, status, valueBand, category, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (status && status !== "All Statuses") params.append("status", status);
      if (valueBand) params.append("valueBand", valueBand);
      if (category) params.append("category", category);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/v1/quotes?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    }
  });

  const invoiceMutation = useMutation({
    queryKey: ["invoiceFromQuote"],
    mutationFn: async (quoteId: string) => {
      const res = await fetch("/api/v1/invoices/from-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ quoteId })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      window.location.href = `/invoices`;
    }
  } as any);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status && status !== "All Statuses") params.append("status", status);
    if (valueBand) params.append("valueBand", valueBand);
    if (category) params.append("category", category);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    try {
      const res = await fetch(`/api/v1/exports/quotes?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export quotes");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quotes_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background h-[calc(100vh-64px)] relative">
      <div className="max-w-[1440px] mx-auto p-8">
        
        {/* Dashboard Stats Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-semibold tracking-wider text-outline uppercase">Total Quotations</span>
              <div className="text-primary bg-primary-container/10 p-1.5 rounded-lg"><Filter className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-bold text-on-surface">{quotes?.length || 0}</div>
            <div className="text-sm font-medium text-primary flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Active list count
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-semibold tracking-wider text-outline uppercase">Total Value</span>
              <div className="text-secondary bg-secondary-container/10 p-1.5 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-bold text-on-surface">
              {formatCurrencyCompact(quotes?.reduce((acc: number, q: any) => acc + Number(q.totalAmount || 0), 0) || 0)}
            </div>
            <div className="text-sm font-medium text-secondary flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Combined value of filtered quotes
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-semibold tracking-wider text-outline uppercase">Pending Approvals</span>
              <div className="text-tertiary bg-tertiary-container/10 p-1.5 rounded-lg"><Filter className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-bold text-on-surface">
              {quotes?.filter((q: any) => q.status === "Pending Approval" || q.status === "Pending").length || 0}
            </div>
            <div className="text-sm font-medium text-tertiary flex items-center gap-1">
              <Timer className="w-4 h-4" />
              Requires action
            </div>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] font-semibold tracking-wider text-outline uppercase">Accepted (Won)</span>
              <div className="text-on-primary-container bg-primary-container p-1.5 rounded-lg"><Filter className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-bold text-on-surface">
              {quotes?.filter((q: any) => q.status === "Accepted").length || 0}
            </div>
            <div className="text-sm font-medium text-primary flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              DocuSigned quotes
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 pr-4 border-r border-outline-variant">
            <Filter className="w-5 h-5 text-outline" />
            <span className="text-[12px] font-semibold tracking-wider text-on-surface uppercase">Filter By</span>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center flex-1">
            <input 
              type="text"
              placeholder="Search Ref / Client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none w-48"
            />
            
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
            >
              <option>All Statuses</option>
              <option>Draft</option>
              <option>Pending Approval</option>
              <option>Approved</option>
              <option>Rejected</option>
              <option>Expired</option>
              <option>Accepted</option>
            </select>
            
            <select 
              value={valueBand}
              onChange={(e) => setValueBand(e.target.value)}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">All Value Bands</option>
              <option value="low">Low (≤ $10k)</option>
              <option value="medium">Medium ($10k - $50k)</option>
              <option value="high">High (&gt; $50k)</option>
            </select>

            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">All Categories</option>
              <option value="Standard Tier">Standard Tier</option>
              <option value="Enterprise VIP">Enterprise VIP</option>
              <option value="Premium Modular">Premium Modular</option>
              <option value="Eco Prefab">Eco Prefab</option>
            </select>

            <div className="flex items-center gap-1 bg-surface border border-outline-variant rounded-lg px-2 py-1">
              <span className="text-xs text-outline">From</span>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
              <span className="text-xs text-outline">To</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleExport}
              className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button 
              onClick={() => window.location.href = '/quotes/new'}
              className="bg-primary text-on-primary px-6 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Quote
            </button>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Ref ID</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Customer / Lead</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Value</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider">Expires In</th>
                  <th className="px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant animate-pulse">Loading quote history...</td>
                  </tr>
                ) : !quotes || quotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center space-y-3">
                      <p className="font-bold text-on-surface-variant">No quotes built yet — start pitching your proposals!</p>
                      <button onClick={() => window.location.href = '/quotes/new'} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90">
                        + Create First Quote
                      </button>
                    </td>
                  </tr>
                ) : (
                  quotes?.map((quote: any, idx: number) => {
                    const clientName = quote.deal?.lead?.company || quote.deal?.lead?.firstName + " " + quote.deal?.lead?.lastName || "Unknown Client";
                    const ownerName = quote.deal?.owner?.name || "Unassigned";
                    const formattedDate = new Date(quote.createdAt).toLocaleDateString();

                    return (
                    <tr key={quote.id || idx} className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer" onClick={() => window.location.href=`/quotes/${quote.id}`}>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-primary">{quote.id.substring(0,8)}</span>
                        <p className="text-[10px] text-outline mt-1">Created: {formattedDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                            {clientName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-on-surface">{clientName}</div>
                            <div className="text-[12px] text-outline">{ownerName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-on-surface">
                          {formatCurrency(quote.totalAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-32 h-1.5 bg-surface-variant rounded-full overflow-hidden flex">
                          <div className="h-full bg-primary w-2/3"></div>
                        </div>
                        <p className="text-[10px] text-outline mt-1 uppercase">{quote.deal?.stage?.name || 'In Progress'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          quote.status === 'Approved' ? 'bg-primary/10 text-primary border border-primary/20' :
                          quote.status === 'Pending' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim' :
                          quote.status === 'Draft' ? 'bg-outline-variant/30 text-outline border border-outline/20' :
                          'bg-error-container text-error border border-error/20'
                        }`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">{quote.expirationDate ? new Date(quote.expirationDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/api/v1/quotes/${quote.id}/pdf`, "_blank");
                            }}
                            className="px-3 py-1 bg-surface-container border border-outline-variant text-on-surface text-[10px] font-bold uppercase rounded hover:bg-surface-container-high transition-all flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                          {quote.status !== 'Accepted' && quote.status !== 'Superseded' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm("Simulate client signing this quote via DocuSign?")) {
                                  const res = await fetch(`/api/v1/public/quotes/${quote.id}/sign`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ signedBy: quote.deal?.lead ? `${quote.deal.lead.firstName} ${quote.deal.lead.lastName}` : "Ahmed Al-Farsi" })
                                  });
                                  if (res.ok) {
                                    alert("Quote signed successfully!");
                                    window.location.reload();
                                  } else {
                                    alert("Failed to sign quote");
                                  }
                                }
                              }}
                              className="px-3 py-1 bg-primary text-on-primary text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all"
                            >
                              DocuSign
                            </button>
                          )}
                          {quote.status === 'Approved' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); invoiceMutation.mutate(quote.id); }}
                              disabled={invoiceMutation.isPending}
                              className="px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase rounded hover:opacity-90 transition-all shadow-sm whitespace-nowrap"
                            >
                              Generate Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="bg-surface-container-low px-6 py-3 flex items-center justify-between border-t border-outline-variant">
            <span className="text-sm text-outline">Showing 1 to {quotes?.length || 0} of 1,284 results</span>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded bg-primary text-on-primary text-sm font-bold flex items-center justify-center">1</button>
              <button className="w-8 h-8 rounded hover:bg-surface-variant text-sm flex items-center justify-center transition-colors">2</button>
              <span className="text-outline mx-1">...</span>
            </div>
          </div>
        </div>

        {/* Recent Activity Floating Card (UX Detail) */}
        <div className="fixed bottom-8 right-8 w-80 bg-surface-container-lowest border border-outline-variant shadow-xl rounded-xl overflow-hidden z-40 transition-transform hover:-translate-y-1">
          <div className="bg-primary text-on-primary px-4 py-3 flex items-center justify-between">
            <span className="text-[12px] font-bold tracking-wider uppercase">Sync Feed</span>
            <Bolt className="w-4 h-4" />
          </div>
          <div className="p-4 max-h-60 overflow-y-auto space-y-4">
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-primary animate-pulse shrink-0"></div>
              <div>
                <p className="text-sm font-semibold text-on-surface">QT-8821 was Approved</p>
                <p className="text-[10px] text-outline">Just now by Manager</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-outline shrink-0"></div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Price Book updated</p>
                <p className="text-[10px] text-outline">15 minutes ago</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-tertiary shrink-0"></div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Lead: Tata Steel assigned</p>
                <p className="text-[10px] text-outline">45 minutes ago</p>
              </div>
            </div>
          </div>
          <button className="w-full py-2 text-center text-[12px] font-bold tracking-wider uppercase text-primary border-t border-outline-variant hover:bg-primary-container/10 transition-colors">
            View Full Audit Trail
          </button>
        </div>

      </div>
    </div>
  );
}
