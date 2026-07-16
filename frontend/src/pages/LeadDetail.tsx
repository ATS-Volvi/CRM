import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2 
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Mode states for inline edit
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editExpectedValue, setEditExpectedValue] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Mode states for assignee reassign
  const [isReassigning, setIsReassigning] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToQuotation = async () => {
    if (!lead) return;
    setIsConverting(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/deal-for-quote`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to get or create deal.");
      }
      const deal = await res.json();
      navigate(`/quotes/new?dealId=${deal.id}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsConverting(false);
    }
  };

  // Queries
  const { data: lead, isLoading } = useQuery<any>({
    queryKey: ["lead", id],
    queryFn: async () => {
      // Find the lead from list
      const res = await fetch(`/api/v1/leads`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch leads");
      const leads = await res.json();
      const match = leads.find((l: any) => l.id === id);
      if (!match) throw new Error("Lead not found");
      return match;
    },
    enabled: !!id && !!token
  });

  const { data: pipelineStages } = useQuery<any[]>({
    queryKey: ["pipelineStages"],
    queryFn: async () => {
      const res = await fetch("/api/v1/pipeline", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch stages");
      const data = await res.json();
      return data; // returns list of stages
    },
    enabled: !!token
  });

  const { data: salespersons } = useQuery<any[]>({
    queryKey: ["salespersons"],
    queryFn: async () => {
      const res = await fetch("/api/v1/salespersons", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch representatives");
      return res.json();
    },
    enabled: !!token
  });

  const { data: reassignmentHistory = [] } = useQuery<any[]>({
    queryKey: ["reassignmentHistory", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/reassignment-history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!id && !!token
  });

  // Prefill edit state when lead loads
  useEffect(() => {
    if (lead) {
      setEditProjectName(lead.subject || "");
      setEditExpectedValue(String(lead.leadScore * 100)); // Map Expected value
      setEditNotes(lead.body || "");
    }
  }, [lead]);

  // Mutations
  const updateDetailsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          subject: editProjectName,
          leadScore: parseFloat(editExpectedValue) / 100 || 0,
          body: editNotes
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      setIsEditingDetails(false);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
    }
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/reassign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ newAssignedToId: newAssigneeId, reason: reassignReason })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["reassignmentHistory", id] });
      setIsReassigning(false);
      setReassignReason("");
    }
  });

  if (isLoading) {
    return <div className="text-center font-bold py-16 text-on-surface-variant">Loading lead details...</div>;
  }

  if (!lead) {
    return <div className="text-center font-bold py-16 text-error">Lead not found.</div>;
  }

  // Segmented progress helper
  const stages = pipelineStages?.map(s => s.stage) || ["New", "Contacted", "Qualified", "Proposal", "Won"];
  const currentStageIndex = stages.indexOf(lead.status);

  // Parse specifications
  let specifications: any[] = [];
  if (lead.categoriesData) {
    try {
      specifications = typeof lead.categoriesData === "string" ? JSON.parse(lead.categoriesData) : lead.categoriesData;
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Breadcrumb & Back */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          <Link to="/leads" className="hover:text-primary">Leads</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Details</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div>
            <h2 className="text-4xl font-bold text-on-surface flex items-center gap-3">
              {lead.leadNumber || "N/A"}
              <span className="text-xl font-medium text-on-surface-variant">
                | {lead.firstName} {lead.lastName} ({lead.company || "No Company"})
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {lead.status !== "Won" && lead.status !== "Lost" ? (
              <button 
                onClick={handleConvertToQuotation}
                disabled={isConverting}
                className="px-5 py-3 bg-primary text-white font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isConverting && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
                Convert to Quotation
              </button>
            ) : (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                Lead Processed ({lead.status})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Stages Progress Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Pipeline Stage Progress</span>
          <select 
            value={lead.status}
            onChange={(e) => updateStatusMutation.mutate(e.target.value)}
            className="bg-surface border border-outline rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-primary focus:outline-none cursor-pointer"
          >
            {stages.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
          {stages.map((st, idx) => {
            const isCompleted = idx <= currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div key={st} className="flex flex-col gap-1.5">
                <div className={`h-2.5 rounded-full transition-all ${
                  isCurrent ? "bg-primary animate-pulse" : isCompleted ? "bg-primary/75" : "bg-outline-variant/40"
                }`} />
                <span className={`text-[10px] font-bold text-center truncate ${
                  isCurrent ? "text-primary font-black" : isCompleted ? "text-on-surface" : "text-on-surface-variant opacity-60"
                }`}>
                  {st}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Lead Details (with inline pencil edit toggle) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4 relative">
          <div className="flex justify-between items-center border-b border-outline-variant pb-3">
            <h3 className="text-lg font-bold text-on-surface">Lead Details</h3>
            <button 
              onClick={() => setIsEditingDetails(!isEditingDetails)}
              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
            >
              {isEditingDetails ? <X className="w-5 h-5" /> : <Pencil className="w-4 h-4" />}
            </button>
          </div>

          {isEditingDetails ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Project / Requirement Name</label>
                <input 
                  type="text" 
                  value={editProjectName}
                  onChange={e => setEditProjectName(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Expected Value ($)</label>
                <input 
                  type="number" 
                  value={editExpectedValue}
                  onChange={e => setEditExpectedValue(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Lead Description / Notes</label>
                <textarea 
                  rows={4}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setIsEditingDetails(false)}
                  className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => updateDetailsMutation.mutate()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Name</span>
                  <span className="text-sm font-semibold text-on-surface">{lead.subject || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Expected Value</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(lead.leadScore * 100)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Lead Type</span>
                  <span className="text-sm font-semibold text-on-surface">{lead.industry || "General"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Created Date</span>
                  <span className="text-sm font-semibold text-on-surface">{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Client & Salesperson (with Reassign toggle and Reassign History) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4 relative">
          <div className="flex justify-between items-center border-b border-outline-variant pb-3">
            <h3 className="text-lg font-bold text-on-surface">Client & Salesperson</h3>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                className={`p-1.5 rounded-lg transition-all ${
                  showHistoryPanel ? "text-primary bg-primary/5" : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                }`}
                title="View Reassignment Logs"
              >
                <History className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsReassigning(!isReassigning)}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
                title="Reassign Representative"
              >
                {isReassigning ? <X className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isReassigning ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">New Assignee</label>
                <select 
                  value={newAssigneeId} 
                  onChange={e => setNewAssigneeId(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-sm focus:outline-none"
                >
                  <option value="">Select salesperson</option>
                  {salespersons?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reason for Reassignment</label>
                <textarea 
                  rows={2}
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  placeholder="e.g. Account owner changed / workload rebalancing"
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setIsReassigning(false)}
                  className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => reassignMutation.mutate()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
                >
                  Reassign Lead
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-on-surface-variant" />
                <div>
                  <p className="text-sm font-bold text-on-surface">{lead.company || "No Company"}</p>
                  <p className="text-xs text-on-surface-variant">{lead.firstName} {lead.lastName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm text-on-surface font-medium">{lead.email || "No Email"}</span>
              </div>

              <div className="flex items-center gap-3 border-t border-outline-variant pt-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {lead.assignedTo?.name ? lead.assignedTo.name.substring(0, 2).toUpperCase() : "UN"}
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Representative Assigned</span>
                  <span className="text-sm font-semibold text-on-surface">{lead.assignedTo?.name || "Unassigned Representative"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Reassignment History Table Panel */}
      {showHistoryPanel && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-md font-bold text-on-surface flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Owner Reassignment Log
          </h3>

          {reassignmentHistory.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic py-2">No manual owner changes have been logged for this lead.</p>
          ) : (
            <div className="overflow-x-auto border border-outline-variant rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant">
                    <th className="px-4 py-3">Old Assignee</th>
                    <th className="px-4 py-3">New Assignee</th>
                    <th className="px-4 py-3">Changed By</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {reassignmentHistory.map((h: any) => (
                    <tr key={h.id}>
                      <td className="px-4 py-3 font-medium text-on-surface">{h.oldAssignee?.name || "None"}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{h.newAssignee?.name || "None"}</td>
                      <td className="px-4 py-3 font-medium text-on-surface-variant">{h.changedByUser?.name || "System"}</td>
                      <td className="px-4 py-3 italic text-on-surface-variant">{h.reason || "No reason specified"}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{new Date(h.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Service Specifications Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-on-surface border-b border-outline-variant pb-3">Service Specifications</h3>
        
        {specifications.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic py-2">No categorized services have been selected for this lead.</p>
        ) : (
          <div className="space-y-6">
            {specifications.map((group) => (
              <div key={group.requirementId} className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
                <div className="p-3 bg-surface-container-low font-bold text-sm text-on-surface border-b border-outline-variant">
                  {group.categoryName}
                </div>
                <div className="p-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-bold uppercase tracking-wider">
                        <th className="py-2">Item Deliverable</th>
                        <th className="py-2">Quantity</th>
                        <th className="py-2">Unit</th>
                        <th className="py-2">Item Specifications</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {group.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-3 font-semibold text-on-surface">{item.name}</td>
                          <td className="py-3 font-bold text-on-surface">{item.quantity}</td>
                          <td className="py-3 text-on-surface-variant font-semibold">{item.unit}</td>
                          <td className="py-3 text-on-surface-variant italic">{item.description || "Default catalog specifications"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes / Detailed Requirement Description */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-3">
        <h3 className="text-lg font-bold text-on-surface border-b border-outline-variant pb-3">Lead Notes & Description</h3>
        <p className="text-sm text-on-surface whitespace-pre-line leading-relaxed font-medium">
          {lead.body || "No additional detailed notes provided."}
        </p>
      </div>

    </div>
  );
}
