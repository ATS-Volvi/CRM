import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, User as UserIcon, Calendar, CheckSquare, RefreshCw, Eye } from "lucide-react";
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
  const [selectedEmail, setSelectedEmail] = useState<EmailQueryLead | null>(null);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (selectedEmail) {
        // Update modal state if open
        const updated = (leads || []).find(l => l.id === selectedEmail.id);
        if (updated) setSelectedEmail(updated);
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
    return matchesStatus && matchesSalesperson;
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

      {/* Filters Bar */}
      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-outline-variant/60 flex flex-wrap items-center justify-between gap-6 bg-slate-50/50">
          <div className="flex items-center gap-6 flex-wrap">
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

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-outline-variant/60">
                <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">From</th>
                <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Subject & Preview</th>
                <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Received Date</th>
                <th className="px-6 py-4 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">Assigned Representative</th>
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
                  <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant italic font-medium">
                    No email queries found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => {
                  const initials = `${email.firstName?.charAt(0) || ""}${email.lastName?.charAt(0) || ""}`.toUpperCase();
                  
                  return (
                    <tr 
                      key={email.id} 
                      onClick={() => setSelectedEmail(email)}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {initials || <UserIcon className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{email.firstName} {email.lastName}</p>
                            <p className="text-[12px] text-on-surface-variant font-medium">{email.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <p className="text-sm font-bold text-on-surface truncate">{email.subject || "(No Subject)"}</p>
                        <p className="text-[12px] text-on-surface-variant font-medium truncate mt-0.5">{email.body || "No preview text available."}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">
                        {new Date(email.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={e => e.stopPropagation()}>
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

      {/* Query Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setSelectedEmail(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] border border-outline-variant/50 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shadow-inner">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">{selectedEmail.subject || "(No Subject)"}</h3>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    From: <span className="font-bold text-primary">{selectedEmail.firstName} {selectedEmail.lastName}</span> ({selectedEmail.email})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-on-surface-variant hover:bg-slate-100 p-2 rounded-xl transition-all font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2">
              <div className="bg-slate-50 rounded-2xl p-5 border border-outline-variant/50 text-sm leading-relaxed whitespace-pre-wrap text-on-surface font-medium shadow-inner">
                {selectedEmail.body || "No message body provided."}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/60 pt-4">
              <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-3">
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
        </div>
      )}
    </div>
  );
}
