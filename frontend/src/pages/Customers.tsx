import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users, Phone, Mail, Building, ChevronRight, FileText, Receipt, Calendar, DollarSign, Briefcase } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function Customers() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id");

  const [searchQuery, setSearchQuery] = useState("");

  const { data: customers, isLoading } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/customers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    }
  });

  const { data: customerDetails, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: ["customerDetails", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await fetch(`/api/v1/customers/${selectedId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch customer details");
      return res.json();
    },
    enabled: !!selectedId
  });

  const filteredCustomers = customers?.filter((c: any) => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.primaryContactName || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query) ||
      (c.industry || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-surface h-[calc(100vh-64px)]">
      {/* Customers List Pane */}
      <div className="w-[380px] border-r border-outline-variant flex flex-col bg-surface-container-lowest">
        <div className="p-6 border-b border-outline-variant space-y-4">
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Customers
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers..." 
              className="w-full bg-surface border border-outline rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">Loading customers...</div>
          ) : filteredCustomers && filteredCustomers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-bold text-on-surface-variant">No customers found.</p>
              <button 
                onClick={() => window.location.href = '/leads/new'} 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90"
              >
                + Ingest Customer via Lead
              </button>
            </div>
          ) : (
            filteredCustomers?.map((customer: any) => (
              <div 
                key={customer.id}
                onClick={() => setSearchParams({ id: customer.id })}
                className={`p-4 cursor-pointer hover:bg-surface-container-low transition-colors ${
                  selectedId === customer.id ? "bg-primary/5 border-l-4 border-primary" : ""
                }`}
              >
                <h4 className="font-bold text-on-surface text-sm">{customer.name}</h4>
                <p className="text-xs text-on-surface-variant mt-1">{customer.primaryContactName || "No contact"}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant">
                  {customer.industry && (
                    <span className="bg-surface-container px-2 py-0.5 rounded font-semibold">{customer.industry}</span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Customer Detail Pane */}
      <div className="flex-1 overflow-y-auto bg-surface p-8">
        {!selectedId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Users className="w-16 h-16 text-outline mb-4" />
            <h3 className="text-lg font-bold text-on-surface">Select a Customer</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mt-1">Select a customer from the left list to see their unified CRM history across time.</p>
          </div>
        ) : isLoadingDetails ? (
          <div className="p-6 text-center text-sm text-on-surface-variant">Loading client details...</div>
        ) : customerDetails ? (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              <span className="cursor-pointer hover:text-primary" onClick={() => setSearchParams({})}>Customers</span>
              <span className="opacity-50">/</span>
              <span>{customerDetails.name}</span>
            </div>
            {/* Customer Profile Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-on-surface">{customerDetails.name}</h1>
                  {customerDetails.industry && (
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">{customerDetails.industry}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-on-surface-variant" />
                    <span className="font-semibold">Contact:</span> {customerDetails.primaryContactName || "N/A"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-on-surface-variant" />
                    <span className="font-semibold">Email:</span> {customerDetails.email || "N/A"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-on-surface-variant" />
                    <span className="font-semibold">Phone:</span> {customerDetails.phone || "N/A"}
                  </div>
                  {customerDetails.address && (
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                      <Building className="w-4 h-4 text-on-surface-variant" />
                      <span className="font-semibold">Address:</span> {customerDetails.address}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Leads Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Building className="w-5 h-5 text-secondary" />
                Leads ({customerDetails.leads?.length || 0})
              </h3>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm divide-y divide-outline-variant">
                {customerDetails.leads?.length === 0 ? (
                  <p className="p-4 text-sm text-on-surface-variant">No lead history found.</p>
                ) : (
                  customerDetails.leads?.map((lead: any) => (
                    <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                      <div>
                        <p className="font-bold text-sm text-on-surface">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Source: {lead.source} | Status: {lead.status}</p>
                      </div>
                      <span className="text-xs text-on-surface-variant">{new Date(lead.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Deals Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Deals ({customerDetails.deals?.length || 0})
              </h3>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm divide-y divide-outline-variant">
                {customerDetails.deals?.length === 0 ? (
                  <p className="p-4 text-sm text-on-surface-variant">No deal history found.</p>
                ) : (
                  customerDetails.deals?.map((deal: any) => (
                    <div key={deal.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                      <div>
                        <p className="font-bold text-sm text-on-surface">{deal.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Stage: {deal.stage?.name || 'Unknown'} | Value: {formatCurrency(deal.amount)}</p>
                      </div>
                      <span className="text-xs text-on-surface-variant">{new Date(deal.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quotes Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Quotes ({customerDetails.quotes?.length || 0})
              </h3>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm divide-y divide-outline-variant">
                {customerDetails.quotes?.length === 0 ? (
                  <p className="p-4 text-sm text-on-surface-variant">No quotation history found.</p>
                ) : (
                  customerDetails.quotes?.map((quote: any) => (
                    <div key={quote.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                      <div>
                        <p className="font-bold text-sm text-on-surface">Quote #{quote.quoteNumber || quote.id.substring(0, 8)}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Deal: {quote.deal?.name} | Status: {quote.status} | Value: {formatCurrency(quote.totalAmount)}</p>
                      </div>
                      <span className="text-xs text-on-surface-variant">{new Date(quote.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Invoices Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                Invoices ({customerDetails.invoices?.length || 0})
              </h3>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm divide-y divide-outline-variant">
                {customerDetails.invoices?.length === 0 ? (
                  <p className="p-4 text-sm text-on-surface-variant">No invoices generated yet.</p>
                ) : (
                  customerDetails.invoices?.map((invoice: any) => (
                    <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                      <div>
                        <p className="font-bold text-sm text-on-surface">Invoice #{invoice.id.substring(0, 8)}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Status: {invoice.status} | Total: {formatCurrency(invoice.totalAmount)}</p>
                      </div>
                      <span className="text-xs text-on-surface-variant">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}
