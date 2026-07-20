import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

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
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

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

  const { data: pipelineStages, isLoading: isLoadingStages, isError: isErrorStages } = useQuery<any[]>({
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

  const { data: quotes = [] } = useQuery<any[]>({
    queryKey: ["leadQuotes", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/quotes`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((q: any) => q.Deal?.leadId === id || q.leadId === id);
    },
    enabled: !!id && !!token
  });

  const { data: activities = [] } = useQuery<any[]>({
    queryKey: ["leadActivities", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/activities`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
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
  const stages = pipelineStages?.map(s => s.stage) || [];
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

      {/* Dynamic Workflow "What's Next" Action Banner */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="bg-primary/25 text-primary text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded">Next Recommended Action</span>
          <h4 className="text-lg font-bold text-on-surface">
            {lead.status === "New" && "Step 1: Contact client and log engagement notes"}
            {["Contacted", "Meeting/Demo", "Qualified"].includes(lead.status) && "Step 2: Generate commercial quotation from requirement details"}
            {["Proposal", "Negotiation"].includes(lead.status) && "Step 3: Monitor quote status and negotiate purchase order"}
            {lead.status === "Won" && "Workflow Complete: Manage client's purchase orders and invoices"}
            {!["New", "Contacted", "Meeting/Demo", "Qualified", "Proposal", "Negotiation", "Won"].includes(lead.status) && "Review lead details or update current status"}
          </h4>
          <p className="text-xs text-on-surface-variant max-w-xl">
            {lead.status === "New" && "Reach out to the lead via phone or email to qualify requirements. Once done, mark as Contacted to proceed."}
            {["Contacted", "Meeting/Demo", "Qualified"].includes(lead.status) && "Lead has been contacted and qualified. Convert the specifications into a professional quotation proposal now."}
            {["Proposal", "Negotiation"].includes(lead.status) && "The quote proposal has been delivered to the client. Follow up to obtain purchase order (PO) signature."}
            {lead.status === "Won" && "Opportunity successfully closed! Visit the Purchase Orders register to verify customer PO and generate the invoice."}
            {!["New", "Contacted", "Meeting/Demo", "Qualified", "Proposal", "Negotiation", "Won"].includes(lead.status) && "Update lead info or change reassignment rules to route the deal to other agents."}
          </p>
        </div>

        <div className="flex-shrink-0">
          {lead.status === "New" && (
            <button
              onClick={() => {
                updateStatusMutation.mutate("Contacted");
                // Focus on note section
                const noteInput = document.getElementById("new-note-textarea");
                if (noteInput) noteInput.focus();
              }}
              className="px-6 py-3 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:opacity-95 transition-all"
            >
              Contact Now & Log Call
            </button>
          )}
          {["Contacted", "Meeting/Demo", "Qualified"].includes(lead.status) && (
            <button
              onClick={handleConvertToQuotation}
              disabled={isConverting}
              className="px-6 py-3 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:opacity-95 transition-all flex items-center gap-2"
            >
              {isConverting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Quotation
            </button>
          )}
          {["Proposal", "Negotiation"].includes(lead.status) && (
            <Link
              to="/quotes"
              className="px-6 py-3 bg-secondary text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:opacity-95 transition-all block text-center"
            >
              Track Sent Quotes
            </Link>
          )}
          {lead.status === "Won" && (
            <Link
              to="/purchase-orders"
              className="px-6 py-3 bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:opacity-95 transition-all block text-center"
            >
              Manage Orders & Invoices
            </Link>
          )}
          {!["New", "Contacted", "Meeting/Demo", "Qualified", "Proposal", "Negotiation", "Won"].includes(lead.status) && (
            <button
              onClick={() => updateStatusMutation.mutate("Contacted")}
              className="px-6 py-3 bg-surface-container text-on-surface font-bold text-xs uppercase tracking-wider rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              Reset to Contacted
            </button>
          )}
        </div>
      </div>

      {/* Segmented Stages Progress Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
        {isLoadingStages ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading pipeline stages...</span>
          </div>
        ) : isErrorStages || !stages.length ? (
          <div className="flex items-center gap-2 py-4 text-xs font-semibold text-error">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load pipeline stages. Cannot display progress bar.</span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Detail Cards Grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left Column: Detail + Client Cards */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

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
        {/* End Left Column */}
        </div>

        {/* Right Column: Stacked Activity Timeline & Quotation Summary */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Quotation Summary Preview Card */}
          <div 
            onClick={() => setShowQuotationModal(true)}
            className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-[380px] flex flex-col cursor-pointer hover:border-primary transition-all group overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-on-surface group-hover:text-primary flex items-center gap-2">
                Quotation Summary
                <span className="text-xs font-normal text-on-surface-variant group-hover:text-primary opacity-70">(Tap to pop out)</span>
              </h3>
              {quotes && quotes.length > 0 && (
                <span className="text-xs font-bold text-primary group-hover:underline">View Details</span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {isLoading ? (
                <div className="flex-1 flex justify-center items-center text-on-surface-variant animate-pulse">Loading Quote...</div>
              ) : quotes && quotes.length > 0 ? (
                <div className="space-y-4">
                  {/* Active Quote details */}
                  <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/60 relative">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-on-surface">{quotes[0].quoteNumber}</h4>
                        <p className="text-[10px] text-on-surface-variant font-medium">Version {quotes[0].version}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        quotes[0].status === "Accepted" || quotes[0].status === "Approved" ? "bg-green-100 text-green-700 border border-green-200" :
                        quotes[0].status === "Sent" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                        quotes[0].status === "Viewed" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                        quotes[0].status === "Rejected" ? "bg-red-100 text-red-700 border border-red-200" :
                        "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {quotes[0].status}
                      </span>
                    </div>

                    <div className="mb-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant opacity-75">Total Value</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(quotes[0].totalAmount)}</p>
                    </div>

                    {/* Dates milestones */}
                    <div className="space-y-1 border-t border-outline-variant/40 pt-2 text-[10px] text-on-surface-variant">
                      {quotes[0].sentAt && (
                        <div className="flex justify-between">
                          <span>Date Sent:</span>
                          <span className="font-semibold">{new Date(quotes[0].sentAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {quotes[0].acceptedAt && (
                        <div className="flex justify-between">
                          <span>Date Signed:</span>
                          <span className="font-semibold">{new Date(quotes[0].acceptedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {quotes[0].expirationDate && (
                        <div className="flex justify-between">
                          <span>Expires On:</span>
                          <span className="font-semibold">{new Date(quotes[0].expirationDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Revisions preview count */}
                  {quotes.length > 1 && (
                    <p className="text-[10px] text-on-surface-variant font-medium italic">
                      + {quotes.length - 1} previous quote versions available in pop out.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center p-4 text-center border border-dashed border-outline-variant/50 rounded-xl bg-surface-container-low/60">
                  <FileText className="w-6 h-6 text-on-surface-variant opacity-60 mb-2" />
                  <p className="text-xs font-semibold text-on-surface">No quotation created yet</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Click to generate a quotation proposal.</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline Preview Card */}
          <div 
            onClick={() => setShowActivityModal(true)}
            className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-[380px] flex flex-col cursor-pointer hover:border-primary transition-all group overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-on-surface group-hover:text-primary flex items-center gap-2">
                Activity Timeline 
                <span className="text-xs font-normal text-on-surface-variant group-hover:text-primary opacity-70">(Tap to pop out)</span>
              </h3>
              <span className="text-xs font-bold text-primary group-hover:underline">View All ({activities.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activities.length === 0 ? (
                <div className="text-on-surface-variant italic text-sm py-8 text-center">
                  No activities recorded yet.
                </div>
              ) : (
                activities.slice(0, 3).map((act: any) => (
                  <div key={act.id} className="relative pl-10 border-l-2 border-outline-variant/65 pb-2 last:border-0 last:pb-0">
                    <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center ${
                      act.type === 'call' ? 'bg-error-container text-error' :
                      act.type === 'email' ? 'bg-tertiary-container text-tertiary' :
                      act.type === 'meeting' ? 'bg-secondary-container text-secondary' :
                      act.type === 'stage_change' ? 'bg-primary-container text-primary' :
                      'bg-surface-container-high text-on-surface'
                    }`}>
                      {act.type === 'call' && <Phone className="w-3.5 h-3.5" />}
                      {act.type === 'email' && <Mail className="w-3.5 h-3.5" />}
                      {act.type === 'meeting' && <Users className="w-3.5 h-3.5" />}
                      {act.type === 'stage_change' && <TrendingUp className="w-3.5 h-3.5" />}
                      {act.type === 'note' && <MessageSquare className="w-3.5 h-3.5" />}
                      {act.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                      {act.type === 'whatsapp_sms' && <MessageSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex justify-between items-start text-xs mb-1">
                      <p className="font-bold text-on-surface uppercase tracking-wider text-[10px]">{act.type.replace('_', ' ')}</p>
                      <span className="text-[10px] text-on-surface-variant">{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                    </div>
                    {act.outcome && <p className="text-xs text-on-surface truncate font-medium">{act.outcome}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

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
