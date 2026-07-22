import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle, Sparkles, Send, Upload, Plus,
  FilePlus, Award, ShieldAlert, CheckCircle2, Clock, MapPin, Video, ExternalLink
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
  const [isConverting, setIsConverting] = useState(false);

  // Quick Action Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Quick Action Form States
  const [callDirection, setCallDirection] = useState("Outbound");
  const [callDuration, setCallDuration] = useState("120");
  const [callOutcome, setCallOutcome] = useState("Connected");
  const [callNotes, setCallNotes] = useState("");

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDescription, setTaskDescription] = useState("");

  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAgenda, setMeetingAgenda] = useState("");

  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("PDF");

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
      return res.json();
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

  const { data: activities = [] } = useQuery<any[]>({
    queryKey: ["leadActivities", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["leadTasks", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tasks?leadId=${id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["leadDocuments", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/documents?leadId=${id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ["leadMeetings", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/meetings?leadId=${id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && !!token
  });

  // Prefill state
  useEffect(() => {
    if (lead) {
      setEditProjectName(lead.subject || "");
      setEditExpectedValue(String((lead.leadScore || 50) * 100));
      setEditNotes(lead.body || "");
      setEmailTo(lead.email || "");
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
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
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
      setIsReassigning(false);
      setReassignReason("");
    }
  });

  const logCallMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/call-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          direction: callDirection,
          durationSeconds: parseInt(callDuration, 10),
          outcome: callOutcome,
          notes: callNotes
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setCallNotes("");
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/email-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          toEmail: emailTo,
          subject: emailSubject,
          body: emailBody
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setEmailSubject("");
      setEmailBody("");
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          title: taskTitle,
          priority: taskPriority,
          dueDate: taskDueDate || null,
          description: taskDescription
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadTasks", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setTaskTitle("");
      setTaskDescription("");
    }
  });

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          title: meetingTitle,
          date: meetingDate,
          time: meetingTime,
          location: meetingLocation,
          agenda: meetingAgenda
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadMeetings", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setMeetingTitle("");
      setMeetingAgenda("");
    }
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          name: docName,
          fileType: docType,
          fileSize: 204800,
          fileUrl: `/uploads/${docName}`
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadDocuments", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setDocName("");
    }
  });

  if (isLoading) {
    return <div className="text-center font-bold py-16 text-on-surface-variant">Loading Customer 360 Workspace...</div>;
  }

  if (!lead) {
    return <div className="text-center font-bold py-16 text-error">Lead workspace not found.</div>;
  }

  const stages = pipelineStages?.map(s => s.stage) || [];
  const currentStageIndex = stages.indexOf(lead.status);

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6 animate-fade-in">
      
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
            <Link to="/leads" className="hover:text-primary">Leads</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Customer 360 Workspace</span>
          </div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
            {lead.leadNumber || "LEAD-360"}
            <span className="text-xl font-medium text-on-surface-variant">
              | {lead.firstName} {lead.lastName} ({lead.company || "Independent Prospect"})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveModal("email")}
            className="px-4 py-2 bg-surface-container text-on-surface border border-outline-variant font-bold text-xs rounded-lg hover:bg-surface-container-high transition-all flex items-center gap-1.5"
          >
            <Mail className="w-4 h-4 text-primary" /> Send Email
          </button>
          <button 
            onClick={() => setActiveModal("call")}
            className="px-4 py-2 bg-surface-container text-on-surface border border-outline-variant font-bold text-xs rounded-lg hover:bg-surface-container-high transition-all flex items-center gap-1.5"
          >
            <Phone className="w-4 h-4 text-emerald-600" /> Log Call
          </button>
          {lead.status !== "Won" && lead.status !== "Lost" ? (
            <button 
              onClick={handleConvertToQuotation}
              disabled={isConverting}
              className="px-5 py-2.5 bg-primary text-white font-bold text-xs rounded-lg shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isConverting && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Proposal / Quote
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Closed ({lead.status})
            </span>
          )}
        </div>
      </div>

      {/* Stage Progress Ribbon */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Pipeline Progression
          </span>
          <select 
            value={lead.status}
            onChange={(e) => updateStatusMutation.mutate(e.target.value)}
            className="bg-surface border border-outline rounded-lg px-3 py-1 text-xs font-bold focus:ring-primary cursor-pointer"
          >
            {stages.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {stages.map((st, idx) => {
            const isCompleted = idx <= currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div key={st} className="flex flex-col gap-1">
                <div className={`h-2 rounded-full transition-all ${
                  isCurrent ? "bg-primary animate-pulse" : isCompleted ? "bg-primary/80" : "bg-outline-variant/40"
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

      {/* THREE-COLUMN CUSTOMER 360 LAYOUT */}
      <div className="grid grid-cols-12 gap-6">

        {/* LEFT PANEL: Customer 360 Details */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">

          {/* AI Sales Copilot Card */}
          <div className="bg-gradient-to-br from-primary/10 via-surface-container-lowest to-secondary/10 border border-primary/20 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-primary/20 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary animate-spin" /> AI Sales Copilot
              </h3>
              <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">Real-time</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-medium">Win Probability:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {Math.min(95, Math.max(30, Math.round((lead.leadScore || 50) * 1.3)))}%
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant font-medium block mb-1">Recommended Action:</span>
                <p className="font-bold text-on-surface bg-surface/80 p-2 rounded border border-outline-variant/60">
                  Schedule product demo & confirm quote parameters with {lead.firstName}.
                </p>
              </div>
              <div>
                <span className="text-on-surface-variant font-medium block mb-1">Risk Indicator:</span>
                <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2 rounded border border-amber-200">
                  No direct phone contact in 7 days. High upsell potential on services.
                </p>
              </div>
            </div>
          </div>

          {/* Customer Metadata Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-sm font-bold text-on-surface">Customer Details</h3>
              <button 
                onClick={() => setIsEditingDetails(!isEditingDetails)}
                className="p-1 text-on-surface-variant hover:text-primary rounded"
              >
                {isEditingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            </div>

            {isEditingDetails ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Project Name</label>
                  <input 
                    type="text" 
                    value={editProjectName}
                    onChange={e => setEditProjectName(e.target.value)}
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Expected Value ($)</label>
                  <input 
                    type="number" 
                    value={editExpectedValue}
                    onChange={e => setEditExpectedValue(e.target.value)}
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Notes</label>
                  <textarea 
                    rows={3}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button 
                    onClick={() => setIsEditingDetails(false)}
                    className="px-3 py-1.5 border border-outline rounded text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => updateDetailsMutation.mutate()}
                    className="px-3 py-1.5 bg-primary text-white rounded text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Company</span>
                  <span className="font-bold text-on-surface text-sm">{lead.company || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Contact Person</span>
                  <span className="font-semibold text-on-surface">{lead.firstName} {lead.lastName}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Email</span>
                  <span className="font-medium text-primary break-all">{lead.email || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Phone</span>
                  <span className="font-medium text-on-surface">{lead.phone || "N/A"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-outline-variant/60 pt-3">
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Industry</span>
                    <span className="font-semibold text-on-surface">{lead.industry || "General"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Lead Score</span>
                    <span className="font-bold text-primary">{lead.leadScore || 50} / 100</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Source</span>
                    <span className="font-semibold text-on-surface">{lead.source || "Inbound"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Expected Value</span>
                    <span className="font-bold text-emerald-600">{formatCurrency((lead.leadScore || 50) * 100)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rep Assignment Section */}
            <div className="border-t border-outline-variant pt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-on-surface-variant">Assigned Rep</span>
                <button 
                  onClick={() => setIsReassigning(!isReassigning)}
                  className="text-primary font-bold hover:underline"
                >
                  {isReassigning ? "Cancel" : "Reassign"}
                </button>
              </div>

              {isReassigning ? (
                <div className="space-y-2">
                  <select 
                    value={newAssigneeId} 
                    onChange={e => setNewAssigneeId(e.target.value)}
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  >
                    <option value="">Select Representative</option>
                    {salespersons?.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                  <input 
                    type="text"
                    value={reassignReason}
                    onChange={e => setReassignReason(e.target.value)}
                    placeholder="Reason..."
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  />
                  <button 
                    onClick={() => reassignMutation.mutate()}
                    className="w-full py-1.5 bg-primary text-white font-bold rounded text-xs"
                  >
                    Confirm Reassign
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-surface p-2 rounded border border-outline-variant/60">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {lead.assignedTo?.name ? lead.assignedTo.name.substring(0, 2).toUpperCase() : "UN"}
                  </div>
                  <span className="font-semibold text-on-surface">{lead.assignedTo?.name || "Unassigned"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tasks Widget */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-primary" /> Open Tasks ({tasks.filter((t: any) => t.status !== "Completed").length})
              </h3>
              <button onClick={() => setActiveModal("task")} className="text-primary font-bold text-xs hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No pending tasks for this lead.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasks.map((task: any) => (
                  <div key={task.id} className="p-2 bg-surface border border-outline-variant/60 rounded flex justify-between items-start text-xs">
                    <div>
                      <p className="font-bold text-on-surface">{task.title}</p>
                      <p className="text-[10px] text-on-surface-variant">Priority: {task.priority} | Status: {task.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* CENTER PANEL: Activity Timeline & Interaction Feed */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">

          {/* Interactive Timeline Feed */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center border-b border-outline-variant pb-4">
              <div>
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Customer Activity Timeline
                </h3>
                <p className="text-xs text-on-surface-variant">Complete chronological history of calls, emails, notes, tasks & quotes.</p>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {activities.length} Interactions
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2">
              {activities.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant italic text-sm">
                  No activity history recorded. Use the Quick Actions panel on the right to log calls, send emails, or schedule meetings.
                </div>
              ) : (
                activities.map((act: any) => (
                  <div key={act.id} className="relative pl-8 border-l-2 border-outline-variant/60 pb-4 last:border-0 last:pb-0">
                    <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center ${
                      act.type === 'call' ? 'bg-emerald-100 text-emerald-700' :
                      act.type === 'email' ? 'bg-blue-100 text-blue-700' :
                      act.type === 'meeting' ? 'bg-purple-100 text-purple-700' :
                      act.type === 'stage_change' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {act.type === 'call' && <Phone className="w-3.5 h-3.5" />}
                      {act.type === 'email' && <Mail className="w-3.5 h-3.5" />}
                      {act.type === 'meeting' && <Users className="w-3.5 h-3.5" />}
                      {act.type === 'stage_change' && <TrendingUp className="w-3.5 h-3.5" />}
                      {act.type === 'note' && <MessageSquare className="w-3.5 h-3.5" />}
                      {act.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                    </div>

                    <div className="bg-surface p-3.5 rounded-xl border border-outline-variant/60 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-on-surface uppercase tracking-wider text-[10px]">
                          {act.title || act.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {act.notes && (
                        <p className="text-xs text-on-surface font-medium whitespace-pre-line leading-relaxed">
                          {act.notes}
                        </p>
                      )}
                      {act.createdByUser && (
                        <p className="text-[10px] text-on-surface-variant italic border-t border-outline-variant/30 pt-1">
                          By {act.createdByUser.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: Quick Action Launcher & Vault */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">

          {/* Quick Actions Panel */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant pb-2">
              Quick Actions
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={() => setActiveModal("call")}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <Phone className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Log Call</span>
              </button>

              <button 
                onClick={() => setActiveModal("email")}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <Mail className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>Send Email</span>
              </button>

              <button 
                onClick={() => setActiveModal("task")}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <CheckSquare className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                <span>Create Task</span>
              </button>

              <button 
                onClick={() => setActiveModal("meeting")}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <Calendar className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
                <span>Schedule</span>
              </button>

              <button 
                onClick={() => setActiveModal("doc")}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <Upload className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span>Upload File</span>
              </button>

              <button 
                onClick={handleConvertToQuotation}
                className="p-3 bg-surface hover:bg-surface-container border border-outline-variant rounded-xl font-bold text-on-surface flex flex-col items-center gap-1.5 transition-all group"
              >
                <FileText className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>Quote</span>
              </button>
            </div>
          </div>

          {/* Document Vault */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Document Vault ({documents.length})
              </h3>
              <button onClick={() => setActiveModal("doc")} className="text-primary font-bold text-xs hover:underline flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No documents attached.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="p-2 bg-surface border border-outline-variant/60 rounded flex justify-between items-center">
                    <div>
                      <p className="font-bold text-on-surface truncate max-w-[140px]">{doc.name}</p>
                      <p className="text-[10px] text-on-surface-variant">v{doc.version} | {doc.fileType}</p>
                    </div>
                    <a href={doc.fileUrl} download className="text-primary font-bold hover:underline">Download</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Meetings Widget */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" /> Meetings ({meetings.length})
              </h3>
              <button onClick={() => setActiveModal("meeting")} className="text-primary font-bold text-xs hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {meetings.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No upcoming meetings.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {meetings.map((m: any) => (
                  <div key={m.id} className="p-2 bg-surface border border-outline-variant/60 rounded space-y-1">
                    <p className="font-bold text-on-surface">{m.title}</p>
                    <p className="text-[10px] text-on-surface-variant">{m.date} at {m.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* QUICK ACTION MODALS */}

      {/* Call Log Modal */}
      {activeModal === "call" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-600" /> Log Call Interaction
              </h3>
              <button onClick={() => setActiveModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Direction</label>
                <select value={callDirection} onChange={e => setCallDirection(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs">
                  <option value="Outbound">Outbound</option>
                  <option value="Inbound">Inbound</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Duration (Seconds)</label>
                <input type="number" value={callDuration} onChange={e => setCallDuration(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Outcome</label>
                <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs">
                  <option value="Connected">Connected</option>
                  <option value="Left Voice Mail">Left Voice Mail</option>
                  <option value="Busy">Busy</option>
                  <option value="No Answer">No Answer</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Call Notes</label>
                <textarea rows={3} value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="Summary of discussion..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setActiveModal(null)} className="px-4 py-2 border border-outline rounded font-bold text-xs">Cancel</button>
                <button onClick={() => logCallMutation.mutate()} className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-xs">Save Call Log</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {activeModal === "email" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" /> Compose Email
              </h3>
              <button onClick={() => setActiveModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Recipient</label>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Project Proposal / Follow-up..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Message Body</label>
                <textarea rows={5} value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Dear Customer..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setActiveModal(null)} className="px-4 py-2 border border-outline rounded font-bold text-xs">Cancel</button>
                <button onClick={() => sendEmailMutation.mutate()} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-xs">Send Email</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {activeModal === "task" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-purple-600" /> Create Task
              </h3>
              <button onClick={() => setActiveModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Task Title</label>
                <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Follow up call..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Priority</label>
                <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Due Date</label>
                <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Description</label>
                <textarea rows={3} value={taskDescription} onChange={e => setTaskDescription(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setActiveModal(null)} className="px-4 py-2 border border-outline rounded font-bold text-xs">Cancel</button>
                <button onClick={() => createTaskMutation.mutate()} className="px-4 py-2 bg-purple-600 text-white rounded font-bold text-xs">Save Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {activeModal === "meeting" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" /> Schedule Meeting
              </h3>
              <button onClick={() => setActiveModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Meeting Title</label>
                <input type="text" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="Demo Presentation..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Date</label>
                  <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Time</label>
                  <input type="text" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Location / Video Link</label>
                <input type="text" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} placeholder="Google Meet / HQ Room 2" className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Agenda</label>
                <textarea rows={3} value={meetingAgenda} onChange={e => setMeetingAgenda(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setActiveModal(null)} className="px-4 py-2 border border-outline rounded font-bold text-xs">Cancel</button>
                <button onClick={() => createMeetingMutation.mutate()} className="px-4 py-2 bg-amber-600 text-white rounded font-bold text-xs">Schedule Meeting</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {activeModal === "doc" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Upload Customer Document
              </h3>
              <button onClick={() => setActiveModal(null)}><X className="w-5 h-5 text-on-surface-variant" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">Document Name</label>
                <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Contract_v1.pdf" className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">File Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs">
                  <option value="PDF">PDF</option>
                  <option value="Word">Word</option>
                  <option value="Excel">Excel</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setActiveModal(null)} className="px-4 py-2 border border-outline rounded font-bold text-xs">Cancel</button>
                <button onClick={() => uploadDocMutation.mutate()} className="px-4 py-2 bg-primary text-white rounded font-bold text-xs">Upload Document</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
