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

            {/* STRICT 3-COLUMN CUSTOMER 360 LAYOUT */}
            <div className="grid grid-cols-12 gap-6">

              {/* COLUMN 1 (25%): Customer Details */}
              <div className="col-span-12 lg:col-span-3 space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                    Customer Details
                  </h3>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Profile Name</span>
                      <span className="font-bold text-foreground text-sm">{customerDetails.name}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Company</span>
                      <span className="font-semibold text-foreground">{customerDetails.industry || "General Industry"}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Phone & Contact</span>
                      <span className="font-semibold text-foreground">{customerDetails.phone || "N/A"}</span>
                      <span className="block text-muted-foreground text-[10px]">{customerDetails.primaryContactName}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Email</span>
                      <span className="font-semibold text-primary">{customerDetails.email || "N/A"}</span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Status & Tags</span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mt-1">
                        Active Account
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase">Owner / Manager</span>
                      <span className="font-semibold text-foreground">Admin Account Manager</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2 (50%): Activity Timeline & Record Feeds */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Customer Activity & History Timeline
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Leads Feed */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Leads ({customerDetails.leads?.length || 0})</h4>
                      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
                        {customerDetails.leads?.map((lead: any) => (
                          <div key={lead.id} className="p-3 bg-muted/20 flex justify-between items-center">
                            <div>
                              <p className="font-bold text-foreground">{lead.firstName} {lead.lastName}</p>
                              <p className="text-[10px] text-muted-foreground">Status: {lead.status} | Source: {lead.source}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deals & Quotes Feed */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Deals & Quotations ({customerDetails.quotes?.length || 0})</h4>
                      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
                        {customerDetails.quotes?.map((q: any) => (
                          <div key={q.id} className="p-3 bg-muted/20 flex justify-between items-center">
                            <div>
                              <p className="font-bold text-foreground">Quote #{q.quoteNumber || q.id.substring(0,8)}</p>
                              <p className="text-[10px] text-muted-foreground">Amount: {formatCurrency(q.totalAmount)} | Status: {q.status}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{new Date(q.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 3 (25%): Quick Actions Launcher */}
              <div className="col-span-12 lg:col-span-3 space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                    Quick Actions
                  </h3>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <button 
                      onClick={() => alert(`Calling ${customerDetails.phone || customerDetails.name}...`)}
                      className="w-full p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg font-bold text-foreground flex items-center gap-2 transition-all"
                    >
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>Log Call</span>
                    </button>

                    <button 
                      onClick={() => alert(`Opening email composer for ${customerDetails.email}...`)}
                      className="w-full p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg font-bold text-foreground flex items-center gap-2 transition-all"
                    >
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Send Email</span>
                    </button>

                    <button 
                      onClick={() => alert("Scheduling meeting...")}
                      className="w-full p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg font-bold text-foreground flex items-center gap-2 transition-all"
                    >
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <span>Schedule Meeting</span>
                    </button>

                    <button 
                      onClick={() => alert("Creating task...")}
                      className="w-full p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg font-bold text-foreground flex items-center gap-2 transition-all"
                    >
                      <Receipt className="w-4 h-4 text-purple-600" />
                      <span>Create Task</span>
                    </button>

                    <button 
                      onClick={() => alert("Uploading file to vault...")}
                      className="w-full p-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg font-bold text-foreground flex items-center gap-2 transition-all"
                    >
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Upload Document</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
