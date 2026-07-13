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
  const [newLead, setNewLead] = useState({ firstName: "", lastName: "", email: "", company: "", source: "email" });
  
  const [quickLogLeadId, setQuickLogLeadId] = useState<string | null>(null);
  const [quickCallOutcome, setQuickCallOutcome] = useState("Spoke with client");
  const [quickCallNote, setQuickCallNote] = useState("");

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
    }
  });

  const { data: duplicateGroups } = useQuery({
    queryKey: ["duplicateGroups"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads/duplicates", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch duplicates");
      return res.json();
    }
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

  const displayLeads = leads || [];

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen">
      {/* Integration Strip */}
      <section className="mb-8 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm transition-all hover:border-primary">
            <Mail className="text-primary w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Email</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">12 New</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm transition-all hover:border-primary">
            <Facebook className="text-[#1877F2] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Facebook</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">4 New</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm transition-all hover:border-primary">
            <Instagram className="text-[#E1306C] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">Instagram</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">7 New</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm transition-all hover:border-primary">
            <Linkedin className="text-[#0A66C2] w-8 h-8" />
            <div>
              <p className="text-[12px] font-semibold tracking-wider text-on-surface-variant">LinkedIn</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-sm font-bold">Connected</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm transition-all hover:border-primary">
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
              <select className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none">
                <option>All Sources</option>
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
              <select className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-sm focus:ring-primary focus:outline-none">
                <option>New Leads</option>
                <option>In Progress</option>
                <option>Qualified</option>
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
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Source</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Lead Name</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Company</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant text-center">Score</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Assigned To</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant">Wait Time</th>
                <th className="px-6 py-4 text-[12px] font-semibold tracking-wider text-on-surface-variant text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">Loading leads...</td></tr>
              ) : (
                displayLeads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-surface-container transition-colors group">
                    <td className="px-6 py-4">
                      {lead.source === 'email' && <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary" title="Email"><Mail className="w-5 h-5" /></div>}
                      {lead.source === 'facebook' && <div className="w-8 h-8 rounded bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]" title="Facebook"><Facebook className="w-5 h-5" /></div>}
                      {lead.source === 'linkedin' && <div className="w-8 h-8 rounded bg-[#0A66C2]/10 flex items-center justify-center text-[#0A66C2]" title="LinkedIn"><Linkedin className="w-5 h-5" /></div>}
                      {lead.source === 'instagram' && <div className="w-8 h-8 rounded bg-[#E1306C]/10 flex items-center justify-center text-[#E1306C]" title="Instagram"><Instagram className="w-5 h-5" /></div>}
                      {lead.source === 'cold_call' && <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center text-secondary" title="Cold Call"><Phone className="w-5 h-5" /></div>}
                      {(!['email', 'facebook', 'linkedin', 'instagram', 'cold_call'].includes(lead.source)) && <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center text-on-surface-variant" title={lead.source}><Globe className="w-5 h-5" /></div>}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/leads/${lead.id}`} className="hover:underline">
                        <p className="text-sm font-bold text-primary">{lead.firstName} {lead.lastName}</p>
                        <p className="text-[12px] text-on-surface-variant">{lead.email}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm">{lead.company}</td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-full font-bold text-[12px] ${lead.leadScore > 80 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                        {lead.leadScore}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {lead.status === 'New Lead' ? (
                           <>
                             <div className="w-6 h-6 rounded-full bg-surface-variant text-primary flex items-center justify-center font-bold text-[10px]">ZM</div>
                             <span className="text-sm">Zaid Malik</span>
                           </>
                        ) : (
                           <>
                             <span className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-[10px] text-on-surface-variant font-bold border border-outline-variant">UA</span>
                             <span className="text-sm italic text-on-surface-variant">Unassigned</span>
                           </>
                        )}
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
    </div>
  );
}
