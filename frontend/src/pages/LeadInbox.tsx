import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Mail, Facebook, Instagram, Linkedin, Globe, X, 
  Download, MoreVertical, ExternalLink, Phone 
} from "lucide-react";

export default function LeadInbox() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [newLead, setNewLead] = useState({ firstName: "", lastName: "", email: "", company: "", source: "email", budgetRange: "" });
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCompanyLead, setSelectedCompanyLead] = useState<any | null>(null);
  
  const [quickLogLeadId, setQuickLogLeadId] = useState<string | null>(null);
  const [quickCallOutcome, setQuickCallOutcome] = useState("Spoke with client");
  const [quickCallNote, setQuickCallNote] = useState("");

  // Fetch salespersons to populate assignment dropdowns
  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch salespersons");
      return res.json();
    },
    enabled: !!token
  });

  // Query to fetch quotation details for the selected company detail lookup modal
  const { data: companyQuotes, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ["companyQuotes", selectedCompanyLead?.id],
    queryFn: async () => {
      if (!selectedCompanyLead?.id) return [];
      const res = await fetch(`/api/v1/quotes/history/client/${selectedCompanyLead.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    enabled: !!selectedCompanyLead?.id && !!token
  });

  const logCallMutation = useMutation({
    mutationFn: async ({ leadId, type, outcome }: { leadId: string; type: string; outcome: string }) => {
      const res = await fetch(`/api/v1/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ type, outcome, isCompleted: true })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setQuickLogLeadId(null);
      setQuickCallNote("");
    }
  });

  const createLeadMutation = useMutation({
    mutationFn: async (lead: any) => {
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(lead),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowAddLeadModal(false);
      setNewLead({ firstName: "", lastName: "", email: "", company: "", source: "email" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token
  });

  const { data: duplicateGroups } = useQuery({
    queryKey: ["duplicateGroups"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads/duplicates", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch duplicates");
      return res.json();
    },
    enabled: !!token
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ masterId, duplicateIds }: { masterId: string, duplicateIds: string[] }) => {
      const res = await fetch("/api/v1/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ masterId, duplicateIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["duplicateGroups"] });
      setShowMergeModal(false);
    }
  });

  const displayLeads = (leads || []).filter((lead: any) => {
    const matchesSource = sourceFilter === "all" || lead.source?.toLowerCase() === sourceFilter.toLowerCase();
    const matchesStatus = statusFilter === "all" || lead.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSource && matchesStatus;
  });

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen">
      {/* Integration Strip */}
      <section className="mb-8 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          <div 
            onClick={() => { setSourceFilter(sourceFilter === "email" ? "all" : "email"); setStatusFilter("all"); }}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
              sourceFilter === "email" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "bg-surface-container-lowest border-outline-variant hover:border-primary"
            }`}
          >
            <Mail className="text-primary w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Email</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">12 New</span>
              </div>
            </div>
          </div>
          <div 
            onClick={() => { setSourceFilter(sourceFilter === "facebook" ? "all" : "facebook"); setStatusFilter("all"); }}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
              sourceFilter === "facebook" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "bg-surface-container-lowest border-outline-variant hover:border-primary"
            }`}
          >
            <Facebook className="text-[#1877F2] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Facebook</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">4 New</span>
              </div>
            </div>
          </div>
          <div 
            onClick={() => { setSourceFilter(sourceFilter === "instagram" ? "all" : "instagram"); setStatusFilter("all"); }}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
              sourceFilter === "instagram" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "bg-surface-container-lowest border-outline-variant hover:border-primary"
            }`}
          >
            <Instagram className="text-[#E1306C] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Instagram</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">7 New</span>
              </div>
            </div>
          </div>
          <div 
            onClick={() => { setSourceFilter(sourceFilter === "linkedin" ? "all" : "linkedin"); setStatusFilter("all"); }}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
              sourceFilter === "linkedin" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "bg-surface-container-lowest border-outline-variant hover:border-primary"
            }`}
          >
            <Linkedin className="text-[#0A66C2] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">LinkedIn</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">Connected</span>
              </div>
            </div>
          </div>
          <div 
            onClick={() => { setSourceFilter(sourceFilter === "website" ? "all" : "website"); setStatusFilter("all"); }}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
              sourceFilter === "website" 
                ? "border-primary bg-primary/5 ring-1 ring-primary" 
                : "bg-surface-container-lowest border-outline-variant hover:border-primary"
            }`}
          >
            <Globe className="text-primary w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Website</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">Online</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Duplicate Alert Banner */}
      {duplicateGroups && duplicateGroups.length > 0 && (
        <div className="mb-8 bg-tertiary-container text-on-tertiary-container px-6 py-3 rounded-lg flex items-center justify-between border-l-4 border-tertiary shadow-sm">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium">We found <span className="font-bold">{duplicateGroups.length} potential duplicate groups</span> in your pipeline. Merge them to maintain data integrity.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowMergeModal(true)} className="text-[12px] font-bold tracking-wider underline hover:opacity-80">Review All</button>
          </div>
        </div>
      )}

      {/* Main Data Table Container */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        {/* Filters Bar */}
        <div className="p-6 border-b border-outline-variant flex flex-wrap items-center justify-between gap-6 bg-surface-bright">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4 pr-6 border-r border-outline-variant">
              <h2 className="text-lg font-semibold">Unified Inbox</h2>
              <button 
                onClick={() => setShowAddLeadModal(true)}
                className="bg-primary text-on-primary px-3 py-1.5 rounded text-sm font-bold shadow-sm hover:opacity-90 transition-all"
              >
                + Add Lead
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Source:</span>
              <select 
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
              >
                <option value="all">All Sources</option>
                <option value="email">Email</option>
                <option value="instagram">Instagram</option>
                <option value="cold_call">Cold Call</option>
                <option value="website">Website</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Status:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="New Lead">New Leads</option>
                <option value="In Progress">In Progress</option>
                <option value="Qualified">Qualified</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Date:</span>
              <select className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none">
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
                <option>Custom Range</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-low"><Download className="w-5 h-5" /></button>
            <button className="p-2 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-low"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Company</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Account Manager</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Budget Range</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant text-center">Score</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Assigned To</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Wait Time</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Loading leads...</td></tr>
              ) : displayLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant font-medium">
                    No leads found matching the active filters.
                  </td>
                </tr>
              ) : (
                displayLeads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-surface-container transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {lead.source === 'email' && <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0" title="Email"><Mail className="w-5 h-5" /></div>}
                        {lead.source === 'facebook' && <div className="w-8 h-8 rounded bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] shrink-0" title="Facebook"><Facebook className="w-5 h-5" /></div>}
                        {lead.source === 'linkedin' && <div className="w-8 h-8 rounded bg-[#0A66C2]/10 flex items-center justify-center text-[#0A66C2] shrink-0" title="LinkedIn"><Linkedin className="w-5 h-5" /></div>}
                        {lead.source === 'instagram' && <div className="w-8 h-8 rounded bg-[#E1306C]/10 flex items-center justify-center text-[#E1306C] shrink-0" title="Instagram"><Instagram className="w-5 h-5" /></div>}
                        {lead.source === 'cold_call' && <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center text-secondary shrink-0" title="Cold Call"><Phone className="w-5 h-5" /></div>}
                        {(!['email', 'facebook', 'linkedin', 'instagram', 'cold_call'].includes(lead.source)) && <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0" title={lead.source}><Globe className="w-5 h-5" /></div>}
                        {lead.company ? (
                          <button 
                            onClick={() => setSelectedCompanyLead(lead)}
                            className="hover:underline font-bold text-primary text-sm text-left truncate max-w-[150px]"
                          >
                            {lead.company}
                          </button>
                        ) : (
                          <span className="text-on-surface-variant font-medium text-sm">
                            N/A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/leads/${lead.id}`} className="hover:underline">
                        <p className="text-sm font-bold text-on-surface">{lead.firstName} {lead.lastName}</p>
                        <p className="text-[12px] text-on-surface-variant">{lead.email}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-semibold">
                      {lead.budgetRange || "Not specified"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-full font-bold text-[12px] ${lead.leadScore > 80 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                        {lead.leadScore}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block">
                        <select 
                          value={lead.assignedToId || ""}
                          onChange={(e) => updateLeadMutation.mutate({ id: lead.id, data: { assignedToId: e.target.value || null } })}
                          className="appearance-none bg-surface border border-outline-variant rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer shadow-sm"
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
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{lead.waitTime || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      {lead.status === 'New Lead' || lead.status === 'New' ? (
                        <div className="flex items-center gap-2 justify-end">
                          <button 
                            onClick={() => setQuickLogLeadId(lead.id)}
                            className="p-1.5 text-secondary hover:bg-secondary/10 rounded transition-colors"
                            title="Quick Log Call"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => updateLeadMutation.mutate({ id: lead.id, data: { status: 'Contacted' } })}
                            disabled={updateLeadMutation.isPending}
                            className="px-4 py-1.5 bg-primary text-on-primary rounded text-[12px] font-bold hover:bg-primary-container transition-all"
                          >
                            Claim
                          </button>
                          <button 
                            onClick={() => { if(confirm("Are you sure?")) deleteLeadMutation.mutate(lead.id); }}
                            className="p-1.5 text-error hover:bg-error-container rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <button 
                            onClick={() => setQuickLogLeadId(lead.id)}
                            className="p-1.5 text-secondary hover:bg-secondary/10 rounded transition-colors"
                            title="Quick Log Call"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-primary hover:bg-surface-container-high rounded transition-colors"><ExternalLink className="w-5 h-5" /></button>
                          <button 
                            onClick={() => { if(confirm("Are you sure?")) deleteLeadMutation.mutate(lead.id); }}
                            className="p-1.5 text-error hover:bg-error-container rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Add New Lead</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">First Name</label>
                  <input type="text" className="w-full border rounded p-2 text-sm" value={newLead.firstName} onChange={e => setNewLead({...newLead, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Last Name</label>
                  <input type="text" className="w-full border rounded p-2 text-sm" value={newLead.lastName} onChange={e => setNewLead({...newLead, lastName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input type="email" className="w-full border rounded p-2 text-sm" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Company</label>
                <input type="text" className="w-full border rounded p-2 text-sm" value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Budget Range</label>
                <input type="text" placeholder="e.g. $10k–$50k" className="w-full border rounded p-2 text-sm" value={newLead.budgetRange} onChange={e => setNewLead({...newLead, budgetRange: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Source</label>
                <select className="w-full border rounded p-2 text-sm" value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})}>
                  <option value="email">Email</option>
                  <option value="instagram">Instagram</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="website">Website</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setShowAddLeadModal(false)} className="px-4 py-2 font-bold text-on-surface-variant">Cancel</button>
                <button 
                  onClick={() => createLeadMutation.mutate(newLead)}
                  disabled={createLeadMutation.isPending || !newLead.email}
                  className="px-4 py-2 bg-primary text-white font-bold rounded disabled:opacity-50"
                >
                  Save Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showMergeModal && duplicateGroups && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Merge Duplicate Leads</h2>
            {duplicateGroups.length === 0 ? (
               <p className="text-sm text-on-surface-variant">No duplicates found.</p>
            ) : (
               <div className="space-y-6">
                 {duplicateGroups.map((group: any[], index: number) => (
                   <div key={index} className="border border-outline rounded-lg p-4 bg-surface-container-lowest">
                     <h3 className="font-bold text-sm mb-3">Group {index + 1}: {group[0].email || group[0].company}</h3>
                     <div className="space-y-2">
                       {group.map((lead: any) => (
                         <div key={lead.id} className="flex items-center justify-between bg-surface-container-low p-2 rounded text-sm">
                           <div>
                             <p className="font-bold">{lead.firstName} {lead.lastName}</p>
                             <p className="text-[12px] text-on-surface-variant">{lead.email} | {lead.company}</p>
                           </div>
                           <button 
                             onClick={() => mergeMutation.mutate({ masterId: lead.id, duplicateIds: group.map(l => l.id).filter(id => id !== lead.id) })}
                             disabled={mergeMutation.isPending}
                             className="px-3 py-1 bg-primary text-on-primary rounded font-bold text-[12px] hover:opacity-90"
                           >
                             Keep as Master
                           </button>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            )}
            <div className="flex justify-end pt-6 mt-4 border-t border-outline-variant">
              <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 font-bold text-on-surface-variant hover:bg-surface-container rounded transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      {quickLogLeadId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Quick Log Call</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Outcome</label>
                <select 
                  value={quickCallOutcome}
                  onChange={(e) => setQuickCallOutcome(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded p-2 text-sm focus:ring-primary focus:outline-none"
                >
                  <option value="Spoke with client">Spoke with client</option>
                  <option value="Left voicemail">Left voicemail</option>
                  <option value="No response">No response</option>
                  <option value="Busy">Busy</option>
                  <option value="Invalid number">Invalid number</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Brief Note</label>
                <textarea 
                  value={quickCallNote}
                  onChange={(e) => setQuickCallNote(e.target.value)}
                  placeholder="e.g. Discussed pricing options, will follow up next Tuesday."
                  rows={3}
                  className="w-full bg-surface border border-outline-variant rounded p-2 text-sm focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setQuickLogLeadId(null)} className="px-4 py-2 font-bold text-on-surface-variant hover:bg-surface-container rounded transition-colors">Cancel</button>
                <button 
                  onClick={() => logCallMutation.mutate({ 
                    leadId: quickLogLeadId, 
                    type: "call", 
                    outcome: `${quickCallOutcome}${quickCallNote ? ' - ' + quickCallNote : ''}` 
                  })}
                  disabled={logCallMutation.isPending}
                  className="px-4 py-2 bg-primary text-white font-bold rounded disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  Log Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedCompanyLead && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCompanyLead(null)}>
          <div 
            className="bg-surface border border-outline-variant rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedCompanyLead(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-primary mb-1">{selectedCompanyLead.company || "N/A"}</h2>
            <p className="text-sm text-on-surface-variant mb-6">Company quotation requests and lead details</p>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Account Manager</p>
                <p className="text-sm font-bold text-on-surface">{selectedCompanyLead.firstName} {selectedCompanyLead.lastName}</p>
                <p className="text-[12px] text-on-surface-variant">{selectedCompanyLead.email}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Budget Range</p>
                <p className="text-sm font-bold text-primary">{selectedCompanyLead.budgetRange || "Not specified"}</p>
              </div>
            </div>

            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-3">Quotation Details</h3>
            {isLoadingQuotes ? (
              <div className="py-8 text-center text-on-surface-variant text-sm">Loading quotation history...</div>
            ) : (!companyQuotes || companyQuotes.length === 0) ? (
              <div className="py-8 text-center text-on-surface-variant bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl text-sm">
                No quotation details submitted yet
              </div>
            ) : (
              <div className="space-y-4">
                {companyQuotes.map((quote: any) => (
                  <div key={quote.id} className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest">
                    <div className="flex items-center justify-between border-b border-outline-variant pb-2.5 mb-3">
                      <div>
                        <p className="text-sm font-bold text-on-surface">Quote #{quote.quoteNumber || "Draft"}</p>
                        <p className="text-[11px] text-on-surface-variant">Submitted on: {new Date(quote.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        quote.status === "Approved" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                      }`}>{quote.status}</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">Scope of Work & Quantities</p>
                      {quote.QuoteLineItems && quote.QuoteLineItems.length > 0 ? (
                        <div className="divide-y divide-outline-variant/60">
                          {quote.QuoteLineItems.map((item: any) => (
                            <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-on-surface">{item.product?.name || "Product Name"}</p>
                                <p className="text-[10px] text-on-surface-variant font-medium">{item.product?.description || "No description provided."}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-on-surface">Qty: {item.quantity}</p>
                                <p className="text-[10px] text-on-surface-variant">SAR {parseFloat(item.totalAmount).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-on-surface-variant">No items specified on this quote.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
