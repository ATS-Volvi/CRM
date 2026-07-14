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
      const res = await fetch("/api/v1/salespersons/performance", {
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
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen">
      {/* Header section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Email Query Pool</h1>
          <p className="text-on-surface-variant text-sm">
            Manage incoming email inquiries, assign queries to representative dashboards, and track statuses.
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className="p-2 border border-outline-variant rounded hover:bg-surface-container-low transition-all text-on-surface-variant flex items-center gap-2 font-bold text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Pool
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mb-8">
        <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-6 bg-surface-bright">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Status:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="New Lead">New / Unresolved</option>
                <option value="In Progress">In Progress</option>
                <option value="Qualified">Qualified</option>
                <option value="Lost">Closed / Lost</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Assigned Rep:</span>
              <select 
                value={salespersonFilter}
                onChange={(e) => setSalespersonFilter(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
              >
                <option value="all">All Representatives</option>
                <option value="unassigned">Unassigned</option>
                {salespersons?.map(rep => (
                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">From</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Subject & Preview</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Received Date</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Assigned Representative</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase">Status</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant animate-pulse">
                    Loading query pool...
                  </td>
                </tr>
              ) : filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant italic">
                    No email queries found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => {
                  const assignedRep = salespersons?.find(r => r.id === email.assignedToId);
                  
                  return (
                    <tr 
                      key={email.id} 
                      onClick={() => setSelectedEmail(email)}
                      className="hover:bg-surface-container transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-primary">{email.firstName} {email.lastName}</p>
                        <p className="text-[12px] text-on-surface-variant">{email.email}</p>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <p className="text-sm font-semibold truncate text-on-surface">{email.subject || "(No Subject)"}</p>
                        <p className="text-[12px] text-on-surface-variant truncate">{email.body || "No preview text available."}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {new Date(email.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm" onClick={e => e.stopPropagation()}>
                        <select 
                          value={email.assignedToId || ""}
                          onChange={(e) => handleAssign(email.id, e.target.value)}
                          className="bg-surface border border-outline-variant rounded px-2.5 py-1 text-xs focus:ring-primary focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {salespersons?.map(rep => (
                            <option key={rep.id} value={rep.id}>{rep.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          email.status === "Qualified" ? "bg-green-100 text-green-700" :
                          email.status === "In Progress" ? "bg-indigo-100 text-indigo-700" :
                          "bg-surface-variant text-on-surface-variant"
                        }`}>
                          {email.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setSelectedEmail(email)}
                          className="p-1.5 hover:bg-surface-container-low rounded-full transition-colors text-primary"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!email.assignedToId && (
                          <button 
                            onClick={() => handleClaim(email.id)}
                            className="bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded hover:opacity-90 transition-all shadow-sm"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-surface rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedEmail.subject || "(No Subject)"}</h3>
                  <p className="text-xs text-on-surface-variant">From: <span className="font-medium">{selectedEmail.firstName} {selectedEmail.lastName}</span> ({selectedEmail.email})</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-all"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2">
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant text-sm leading-relaxed whitespace-pre-wrap text-on-surface">
                {selectedEmail.body || "No message body provided."}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                  <Calendar className="w-4 h-4" /> Received: {new Date(selectedEmail.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-on-surface-variant">Status:</span>
                  <select 
                    value={selectedEmail.status}
                    onChange={(e) => handleStatusChange(selectedEmail.id, e.target.value)}
                    className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="New Lead">New Lead</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedEmail.assignedToId || ""}
                  onChange={(e) => handleAssign(selectedEmail.id, e.target.value)}
                  className="bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {salespersons?.map(rep => (
                    <option key={rep.id} value={rep.id}>Assign to: {rep.name}</option>
                  ))}
                </select>
                {!selectedEmail.assignedToId && (
                  <button 
                    onClick={() => { handleClaim(selectedEmail.id); }}
                    className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded hover:opacity-90 transition-all shadow-md"
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
