import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, User as UserIcon, Calendar, CheckSquare, RefreshCw, Eye, Search, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface EmailQueryLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  source: string;
  subject?: string;
  body?: string;
  assignedToId: string | null;
  createdAt: string;
}

export default function EmailPool() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State variables for filter inputs
  const [statusFilter, setStatusFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailQueryLead | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch all leads from the API
  const { data: leads, isLoading, refetch } = useQuery<EmailQueryLead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    }
  });

  // Fetch salespersons to populate assignment dropdowns and filters
  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch salespersons");
      return res.json();
    }
  });

  // Mutation to update lead assignment or status
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      triggerToast(data.assignedToId ? `Assigned to representative successfully!` : `Status updated successfully!`);
      if (selectedEmail) {
        // Update selected state if open
        setSelectedEmail(data);
      }
    }
  });

  const handleClaim = (leadId: string) => {
    if (!user) return;
    updateLeadMutation.mutate({
      id: leadId,
      data: { assignedToId: user.id, status: "In Progress" }
    });
  };

  const handleAssign = (leadId: string, assignedToId: string) => {
    const repName = salespersons?.find(r => r.id === assignedToId)?.name || "Unassigned";
    updateLeadMutation.mutate({
      id: leadId,
      data: { assignedToId: assignedToId || null, status: assignedToId ? "In Progress" : "New Lead" }
    });
  };

  const handleStatusChange = (leadId: string, status: string) => {
    updateLeadMutation.mutate({
      id: leadId,
      data: { status }
    });
  };

  // Filter leads to only show email queries (source === 'email')
  const emailLeads = (leads || []).filter((lead) => lead.source?.toLowerCase() === "email");

  // Apply search/filter inputs on emails
  const filteredEmails = emailLeads.filter((email) => {
    const matchesStatus = statusFilter === "all" || email.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSalesperson = salespersonFilter === "all" || 
      (salespersonFilter === "unassigned" && !email.assignedToId) ||
      (email.assignedToId === salespersonFilter);
      
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      `${email.firstName} ${email.lastName}`.toLowerCase().includes(searchLower) ||
      email.email.toLowerCase().includes(searchLower) ||
      (email.subject || "").toLowerCase().includes(searchLower) ||
      (email.body || "").toLowerCase().includes(searchLower);

    return matchesStatus && matchesSalesperson && matchesSearch;
  });

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold tracking-wider text-primary uppercase mb-1">
            Communication Center
          </p>
          <h1 className="text-4xl font-bold text-on-surface">Email Query Pool</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Manage incoming email inquiries, assign queries to representative dashboards, and track statuses.
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className="px-4 py-2 bg-surface-container-lowest border border-outline-variant hover:border-outline rounded-xl hover:bg-surface-container-low transition-all text-on-surface-variant flex items-center gap-2 font-bold text-sm shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-primary" /> Refresh Pool
        </button>
      </div>

      {/* Toast Alert overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl animate-scale-up font-bold text-sm">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-outline-variant/60 flex flex-wrap items-center justify-between gap-6 bg-slate-50/50">
          <div className="flex items-center gap-6 flex-wrap w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-on-surface-variant" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sender, email or body..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Status:</span>
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white border border-outline-variant rounded-xl pl-3 pr-8 py-2 text-sm font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="New Lead">New / Unresolved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Lost">Closed / Lost</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-on-surface-variant">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Assigned Rep:</span>
              <div className="relative">
                <select 
                  value={salespersonFilter}
                  onChange={(e) => setSalespersonFilter(e.target.value)}
                  className="appearance-none bg-white border border-outline-variant rounded-xl pl-3 pr-8 py-2 text-sm font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <option value="all">All Representatives</option>
                  <option value="unassigned">Unassigned</option>
                  {salespersons?.map(rep => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-on-surface-variant">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Split pane container */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left panel: Table (full width if no email selected, 7/12 if selected) */}
          <div className={`w-full transition-all duration-300 ${selectedEmail ? "lg:w-7/12" : "w-full"}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-outline-variant/60">
                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">From</th>
                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Subject & Preview</th>
                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase hidden md:table-cell">Received</th>
                    <th className={`px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase ${selectedEmail ? "hidden xl:table-cell" : ""}`}>Assigned Rep</th>
                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant animate-pulse font-medium">
                        Loading query pool...
                      </td>
                    </tr>
                  ) : filteredEmails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16">
                        <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                            <Mail className="w-8 h-8 text-on-surface-variant/45" />
                          </div>
                          <div>
                            <h3 className="font-bold text-on-surface text-base">No email queries found</h3>
                            <p className="text-sm text-on-surface-variant max-w-sm mt-1">
                              We couldn't find any email leads matching your current active filters or search term.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmails.map((email) => {
                      const initials = `${email.firstName?.charAt(0) || ""}${email.lastName?.charAt(0) || ""}`.toUpperCase();
                      const isSelected = selectedEmail?.id === email.id;
                      
                      return (
                        <tr 
                          key={email.id} 
                          onClick={() => setSelectedEmail(email)}
                          className={`hover:bg-slate-50/60 transition-colors group cursor-pointer ${
                            isSelected ? "bg-primary/5 hover:bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                                isSelected ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"
                              }`}>
                                {initials || <UserIcon className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">{email.firstName} {email.lastName}</p>
                                <p className="text-[12px] text-on-surface-variant font-medium truncate">{email.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[180px] md:max-w-xs">
                            <p className="text-sm font-bold text-on-surface truncate">{email.subject || "(No Subject)"}</p>
                            <p className="text-[12px] text-on-surface-variant font-medium truncate mt-0.5">{email.body || "No preview text available."}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant font-medium hidden md:table-cell">
                            {new Date(email.createdAt).toLocaleDateString()}
                          </td>
                          <td className={`px-6 py-4 text-sm ${selectedEmail ? "hidden xl:table-cell" : ""}`} onClick={e => e.stopPropagation()}>
                            <div className="relative inline-block">
                              <select 
                                value={email.assignedToId || ""}
                                onChange={(e) => handleAssign(email.id, e.target.value)}
                                className="appearance-none bg-white border border-outline-variant rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer shadow-sm"
                              >
                                <option value="">Unassigned</option>
                                {salespersons?.map(rep => (
                                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-on-surface-variant">
                                <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${
                              email.status === "Qualified" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" :
                              email.status === "In Progress" ? "bg-indigo-50 text-indigo-700 ring-indigo-700/10" :
                              email.status === "Lost" ? "bg-rose-50 text-rose-700 ring-rose-700/10" :
                              "bg-amber-50 text-amber-700 ring-amber-700/10"
                            }`}>
                              {email.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right flex items-center justify-end gap-2.5" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => setSelectedEmail(email)}
                              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-primary flex items-center justify-center"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {!email.assignedToId && (
                              <button 
                                onClick={() => handleClaim(email.id)}
                                className="bg-primary text-on-primary text-xs font-bold px-3.5 py-1.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                              >
                                Claim
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel: Active Email Details View (only visible when selectedEmail is set) */}
          {selectedEmail && (
            <div className="w-full lg:w-5/12 bg-slate-50/50 border border-outline-variant/60 rounded-2xl p-6 space-y-6 animate-scale-up lg:sticky lg:top-24">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shadow-inner">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-on-surface truncate">{selectedEmail.subject || "(No Subject)"}</h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-0.5 truncate">
                      From: <span className="font-bold text-primary">{selectedEmail.firstName} {selectedEmail.lastName}</span> ({selectedEmail.email})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="text-on-surface-variant hover:bg-slate-200 p-2 rounded-xl transition-all font-bold text-base"
                >
                  Close View
                </button>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-outline-variant/50 text-sm leading-relaxed whitespace-pre-wrap text-on-surface font-medium shadow-sm max-h-[350px] overflow-y-auto">
                {selectedEmail.body || "No message body provided."}
              </div>

              <div className="flex flex-col gap-4 border-t border-outline-variant/60 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
                    <Calendar className="w-4 h-4 text-primary" /> Received: {new Date(selectedEmail.createdAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-on-surface-variant">Status:</span>
                    <div className="relative inline-block">
                      <select 
                        value={selectedEmail.status}
                        onChange={(e) => handleStatusChange(selectedEmail.id, e.target.value)}
                        className="appearance-none bg-white border border-outline-variant rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer shadow-sm"
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Lost">Lost</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-on-surface-variant">
                        <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <div className="relative inline-block">
                    <select 
                      value={selectedEmail.assignedToId || ""}
                      onChange={(e) => handleAssign(selectedEmail.id, e.target.value)}
                      className="appearance-none bg-white border border-outline-variant rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer shadow-sm"
                    >
                      <option value="">Unassigned</option>
                      {salespersons?.map(rep => (
                        <option key={rep.id} value={rep.id}>Assign: {rep.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-on-surface-variant">
                      <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  {!selectedEmail.assignedToId && (
                    <button 
                      onClick={() => { handleClaim(selectedEmail.id); }}
                      className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
                    >
                      Claim Query
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
