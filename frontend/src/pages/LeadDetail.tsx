import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle, Sparkles, Send, Upload, Plus,
  FilePlus, Award, ShieldAlert, CheckCircle2, Clock, MapPin, Video, ExternalLink, Pin,
  FileEdit, Landmark, Inbox, User, Receipt, AlertTriangle
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";
import { CommentThreadSection } from "../components/CommentThreadSection";

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
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Mode states for assignee reassign
  const [isReassigning, setIsReassigning] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Quick Action Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Activity Timeline Filter & Note States
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [noteText, setNoteText] = useState("");

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
    enabled: !!id && !!token,
    refetchInterval: 3000, // Poll every 3s so live WhatsApp replies pop up in real-time
    refetchOnWindowFocus: true,
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
      setEditEmail(lead.email || "");
      setEditPhone(lead.phone || lead.whatsappPhone || "");
      setEmailTo(lead.email || "");
    }
  }, [lead]);

  // Clear unread WhatsApp count when rep opens a WhatsApp lead
  useEffect(() => {
    if (
      lead &&
      token &&
      ((lead.communicationChannel || "").toLowerCase() === "whatsapp" ||
        (lead.source || "").toLowerCase() === "whatsapp") &&
      (lead.unreadWhatsappCount || 0) > 0
    ) {
      fetch(`/api/v1/leads/${lead.id}/clear-unread`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["leads"] }))
        .catch(() => {}); // Silent fail — non-critical
    }
  }, [lead?.id, lead?.unreadWhatsappCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const updateDetailsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          subject: editProjectName,
          leadScore: parseFloat(editExpectedValue) / 100 || 0,
          body: editNotes,
          email: editEmail,
          phone: editPhone
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
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
      alert("Email sent successfully!");
    },
    onError: (error: any) => {
      let msg = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) msg = parsed.error + (parsed.details ? `: ${parsed.details}` : "");
      } catch (e) {}
      alert(`Failed to send email:\n${msg}`);
    }
  });

  const [whatsAppText, setWhatsAppText] = useState("");

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          phone: lead?.phone,
          text: whatsAppText
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setWhatsAppText("");
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

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          type: "note",
          notes: noteText,
          title: "Internal Note"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setNoteText("");
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: async (actId: string) => {
      const res = await fetch(`/api/v1/activities/${actId}/pin`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
    }
  });

  if (isLoading) {
    return <div className="text-center font-bold py-16 text-on-surface-variant">Loading Customer 360 Workspace...</div>;
  }

  if (!lead) {
    return <div className="text-center font-bold py-16 text-error">Lead workspace not found.</div>;
  }

  // ─── Channel Relevance Calculations ──────────────────────────────────────────
  const hasWhatsAppActivity = activities.some((a: any) => a.type === "whatsapp_sms");
  const isWhatsAppRelevant =
    (lead.communicationChannel || "").toLowerCase() === "whatsapp" ||
    (lead.source || "").toLowerCase() === "whatsapp" ||
    !!lead.whatsappPhone ||
    hasWhatsAppActivity;

  const hasEmailActivity = activities.some((a: any) => (a.type || "").toLowerCase().includes("email"));
  const isSyntheticEmail = !!(lead.email && lead.email.endsWith("@whatsapp.local"));
  const hasRealEmail = !!(lead.email && !isSyntheticEmail);
  const isEmailRelevant = hasRealEmail || hasEmailActivity;

  const stages = pipelineStages?.map(s => s.stage) || [];
  const currentStageIndex = stages.indexOf(lead.status);

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6 animate-fade-in">
      
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
            <Link to="/leads-table" className="hover:text-primary flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> Live Queue (Inbox)
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary font-bold">Customer 360 Workspace</span>
          </div>
          <h2 className="text-3xl font-black text-on-surface flex items-center gap-3">
            {lead.leadNumber || "LEAD-360"}
            <span className="text-xl font-medium text-on-surface-variant">
              | {lead.firstName} {lead.lastName} ({lead.company || "Independent Prospect"})
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {isWhatsAppRelevant && (
            <button 
              onClick={() => {
                setActivityFilter("whatsapp");
                const el = document.getElementById("activity-timeline");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Thread
            </button>
          )}
          {isEmailRelevant && (
            <button 
              onClick={() => setActiveModal("email")}
              className="px-4 py-2 bg-surface-container text-on-surface border border-outline-variant font-bold text-xs rounded-lg hover:bg-surface-container-high transition-all flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4 text-primary" /> Send Email
            </button>
          )}
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

      {/* 13-Stage Enterprise OS Flow Progression Ribbon */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Lifecycle Progression
          </span>
          <select 
            value={lead.status}
            onChange={(e) => updateStatusMutation.mutate(e.target.value)}
            className="bg-surface border border-outline rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-primary cursor-pointer"
          >
            {[
              "Lead Queue", "Customer Workspace", "Generate Quote", "Quote Draft", "Send for Approval",
              "Approval Center", "Approved", "Send to Customer", "Waiting Customer", "Negotiation",
              "Accepted", "Invoice", "Payment", "Closed Won"
            ].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-14 gap-1.5 pt-1">
          {[
            { name: "Lead Queue", icon: Inbox, path: "/leads-table" },
            { name: "Customer Workspace", icon: User, path: `/leads/${lead.id}` },
            { name: "Generate Quote", icon: Plus, action: handleConvertToQuotation },
            { name: "Quote Draft", icon: FileEdit, path: `/quotes/new?leadId=${lead.id}` },
            { name: "Send for Approval", icon: AlertTriangle, path: "/approvals" },
            { name: "Approval Center", icon: Landmark, path: "/approvals" },
            { name: "Approved", icon: CheckCircle2, path: "/quotes" },
            { name: "Send to Customer", icon: Mail, path: "/quotes" },
            { name: "Waiting Customer", icon: Clock, path: "/quotes" },
            { name: "Negotiation", icon: MessageSquare, path: "/quotes" },
            { name: "Accepted", icon: CheckCircle2, path: "/quotes" },
            { name: "Invoice", icon: Receipt, path: "/invoices" },
            { name: "Payment", icon: DollarSign, path: "/invoices" },
            { name: "Closed Won", icon: CheckCircle2, path: "/pipeline" },
          ].map((stepObj, idx) => {
            const isCurrent = (lead.status || "").toLowerCase().includes(stepObj.name.toLowerCase());
            const Icon = stepObj.icon;
            return (
              <div 
                key={stepObj.name}
                onClick={() => {
                  if (stepObj.action) stepObj.action();
                  else if (stepObj.path) navigate(stepObj.path);
                }}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isCurrent 
                    ? "bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20 scale-105" 
                    : "bg-surface-container-low/50 hover:bg-surface-container-high text-on-surface border-outline-variant/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mb-1 ${isCurrent ? "text-white" : "text-primary"}`} />
                <span className="text-[10px] font-bold leading-tight line-clamp-2">{stepObj.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* THREE-COLUMN / DYNAMIC CUSTOMER 360 LAYOUT */}
      <div className="grid grid-cols-12 gap-6 items-start">

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
                  <label className="block font-bold text-on-surface-variant mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. client@company.com"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-surface border border-outline rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +919876543210"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
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

                {/* AI-Extracted Requirement Highlight Section */}
                <div className="border-t border-outline-variant/60 pt-3 bg-primary-container/20 p-3 rounded-xl space-y-1.5 border border-primary/20">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>AI-Extracted Requirement</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Extracted Requirement</span>
                    <span className="font-semibold text-on-surface text-xs block">{lead.subject || "General Inquiry"}</span>
                  </div>
                  {lead.budgetRange && lead.budgetRange !== "N/A" && (
                    <div>
                      <span className="block text-[10px] font-bold text-on-surface-variant uppercase">Budget / Scope</span>
                      <span className="font-bold text-emerald-700 text-xs">{lead.budgetRange}</span>
                    </div>
                  )}
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

          {/* COMPACT AUTOMATION CARD (Requirement 7 & 13) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Intake Automation
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                ● Active
              </span>
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lead Received
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Verified</span>
              </div>

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Source Identified
                </span>
                <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                  {lead.source || "Website"}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Owner Assigned
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {lead.assignedTo?.name || "Unassigned"}
                </span>
              </div>

              {/* First Response status */}
              {activities.some((a: any) => a.outcome && a.outcome.includes("Automation Failed")) ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Automated Response Failed
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium">Delivery error encountered</p>
                  <div className="flex gap-1.5 pt-1">
                    <button onClick={() => setActiveModal("email")} className="px-2 py-1 bg-amber-600 text-white font-bold text-[10px] rounded hover:bg-amber-700">
                      Retry Response
                    </button>
                    <button onClick={() => setActiveModal("call")} className="px-2 py-1 bg-white border border-amber-300 text-amber-900 font-bold text-[10px] rounded hover:bg-amber-100">
                      Contact Manually
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> First Response
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {lead.source === "Cold Call" || lead.source === "Manual Entry" ? "Task Generated" : "Response Sent"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Follow-up Task Created
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">Active</span>
              </div>
            </div>

            {/* NEXT ACTION */}
            <div className="bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">Next Action</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {tasks.find((t: any) => t.status !== "Completed")?.title || `Follow up with ${lead.firstName} ${lead.lastName}`}
              </p>
              <p className="text-[10px] text-indigo-700 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" /> SLA SLA Target: Active Follow-Up
              </p>
            </div>

            {/* Quick Action Buttons (Req 13) */}
            <div className="pt-1 border-t border-outline-variant/60 flex flex-wrap gap-1.5">
              <button onClick={() => setActiveModal("email")} className="flex-1 py-1.5 bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                <Mail className="w-3 h-3 text-primary" /> Email
              </button>
              <button onClick={() => { setActivityFilter("whatsapp"); const el = document.getElementById("activity-timeline"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="flex-1 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
              </button>
              <button onClick={() => setActiveModal("call")} className="flex-1 py-1.5 bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                <Phone className="w-3 h-3 text-blue-600" /> Call
              </button>
              <button onClick={() => setActiveModal("task")} className="flex-1 py-1.5 bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                <CheckSquare className="w-3 h-3 text-purple-600" /> Task
              </button>
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
        <div id="activity-timeline" className="col-span-12 lg:col-span-6 flex flex-col gap-6">

          {/* Minimal Interactive Timeline Feed */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 flex flex-col">
            
            {/* Minimal Timeline Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-primary" /> Activity Timeline
                </h3>
                <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                  {activities.length}
                </span>
              </div>
              
              {/* Quiet Text Filter Links */}
              <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                {[
                  { key: "all", label: "All", show: true },
                  { key: "note", label: "Notes", show: true },
                  { key: "call", label: "Calls", show: true },
                  { key: "email", label: "Emails", show: isEmailRelevant },
                  { key: "task", label: "Tasks", show: true },
                  { key: "whatsapp", label: "WhatsApp", show: isWhatsAppRelevant },
                ].filter(f => f.show).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setActivityFilter(f.key)}
                    className={`transition-colors ${
                      activityFilter === f.key
                        ? f.key === "whatsapp"
                          ? "text-emerald-600 font-black underline underline-offset-4"
                          : "text-primary font-bold underline underline-offset-4"
                        : "hover:text-foreground"
                    }`}
                  >
                    {f.key === "whatsapp" ? "💬 WhatsApp" : f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimal Inline Note Box (Non-WhatsApp filter views) */}
            {activityFilter !== "whatsapp" && (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-xl border border-border focus-within:border-primary/40 focus-within:bg-card transition-all">
                <input
                  type="text"
                  placeholder="Add a quick note or comment..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="flex-1 bg-transparent py-1 text-xs font-medium focus:outline-none text-foreground placeholder:text-muted-foreground/70"
                  onKeyDown={e => {
                    if (e.key === "Enter" && noteText.trim()) {
                      addNoteMutation.mutate();
                    }
                  }}
                />
                <button
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate()}
                  className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-30 transition-all flex items-center gap-1 shrink-0 px-2 py-1"
                >
                  <Send className="w-3 h-3" /> Post
                </button>
              </div>
            )}

            {/* WhatsApp conversation banner — shown when WhatsApp filter active */}
            {activityFilter === "whatsapp" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                WhatsApp conversation with{" "}
                <span className="font-black">{lead.firstName} {lead.lastName}</span>
                {lead.whatsappPhone || lead.phone ? (
                  <span className="text-emerald-600 font-mono ml-auto">{lead.whatsappPhone || lead.phone}</span>
                ) : null}
              </div>
            )}

            {/* Scrollable Feed Container with explicit max-height */}
            <div className={`overflow-y-auto pr-2 max-h-[420px] scrollbar-thin scrollbar-thumb-slate-200 ${activityFilter === "whatsapp" ? "space-y-4 pt-2 pb-2" : "space-y-3 pt-1"}`}>
              {activities.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
                  <p className="font-semibold text-foreground/80">No activity yet</p>
                  <p className="text-[11px] text-muted-foreground">Log calls, emails, or notes to populate this timeline.</p>
                </div>
              ) : (
                activities
                  .filter((act: any) => {
                    if (activityFilter === "all") return true;
                    if (activityFilter === "whatsapp") return act.type === "whatsapp_sms";
                    return (act.type || "").toLowerCase().includes(activityFilter);
                  })
                  .slice()
                  .sort((a: any, b: any) => {
                    if (activityFilter === "whatsapp") {
                      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    }
                    return 0; // maintain default pin/newest order for standard feed
                  })
                  .map((act: any) => {
                    const isPinned = act.pinned;
                    const authorName = act.createdBy?.name || act.createdByUser?.name || "System Rep";
                    const titleText = act.title || (act.type ? act.type.replace('_', ' ') : "activity");
                    const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                    const isDupOutcome = act.outcome && act.outcome.includes("Duplicate lead capture");
                    const bodyContent = act.notes || (isDupOutcome ? "Lead captured from marketing channel." : act.outcome);

                    // ── WhatsApp Chat Bubble ─────────────────────────────────
                    if (act.type === "whatsapp_sms") {
                      const isIncoming = act.outcome === "message received";
                      return (
                        <div
                          key={act.id}
                          className={`flex ${isIncoming ? "justify-start" : "justify-end"} gap-2.5 items-start`}
                        >
                          {/* Avatar — only for incoming */}
                          {isIncoming && (
                            <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 mt-3 shadow-2xs">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                            </div>
                          )}

                          <div className={`max-w-[75%] flex flex-col gap-1 ${isIncoming ? "items-start" : "items-end"}`}>
                            {/* Sender Label */}
                            <span className="text-[10px] font-bold text-slate-500 px-1 select-none">
                              {isIncoming ? `${lead.firstName} ${lead.lastName}` : authorName}
                            </span>
                            {/* Bubble */}
                            <div
                              className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                isIncoming
                                  ? "bg-slate-100 border border-slate-200 text-slate-900 rounded-tl-xs"
                                  : "bg-emerald-600 text-white rounded-tr-xs"
                              }`}
                            >
                              {act.mediaUrl && (
                                <p className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${isIncoming ? "text-primary" : "text-white/90"}`}>
                                  <Upload className="w-3 h-3" /> Media attachment —{" "}
                                  <a href={act.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a>
                                </p>
                              )}
                              <p className="whitespace-pre-line">{act.notes}</p>
                            </div>

                            {/* Timestamp + label */}
                            <span className="text-[10px] text-slate-400 font-medium px-1">{timeAgo}</span>
                          </div>

                          {/* Avatar — only for outgoing */}
                          {!isIncoming && (
                            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 mt-3 shadow-2xs">
                              <span className="text-[9px] font-black text-white">
                                {authorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ── Standard Timeline Entry ──────────────────────────────
                    return (
                      <div key={act.id} className="relative pl-4 border-l border-border/70 pb-2.5 last:border-0 last:pb-0 space-y-0.5 text-xs">
                        {/* Small quiet node */}
                        <div className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full border border-card ${
                          isPinned ? "bg-primary" : "bg-muted-foreground/30"
                        }`} />

                        {/* Streamlined Single-Row Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="font-bold text-foreground">{authorName}</span>
                            <span className="text-muted-foreground font-normal text-[11px] capitalize">· {titleText}</span>
                            {(act.outcome?.includes("[AUTOMATED]") || act.outcome?.toLowerCase().includes("automated") || act.type === "stage_change") ? (
                              <span className="text-[9px] font-extrabold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" /> Automated
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                Manual
                              </span>
                            )}
                            {isPinned && (
                              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.2 rounded border border-primary/20">Pinned</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground/80">
                            <span>{timeAgo}</span>
                            <button
                              onClick={() => togglePinMutation.mutate(act.id)}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                              title={isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin className={`w-3 h-3 ${isPinned ? "fill-primary text-primary" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Note / Action Body */}
                        {bodyContent && (
                          <p className="text-xs text-foreground/90 font-normal leading-snug whitespace-pre-line">
                            {bodyContent}
                          </p>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Inline WhatsApp Chat Composer — anchored directly under WhatsApp conversation */}
            {activityFilter === "whatsapp" && (
              <div className="space-y-2 pt-1">
                {/* 1-Click Quick Template Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0 mr-0.5 select-none">Quick Reply:</span>
                  {[
                    "Hi! Thanks for reaching out. How can we help you today?",
                    "We've sent the requested catalog to your email. Please review!",
                    "Would you be available for a quick 10-min demo call tomorrow?",
                    "Your quotation is ready! Let us know if you need any adjustments."
                  ].map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => setWhatsAppText(template)}
                      className="px-2.5 py-1 bg-emerald-100/70 hover:bg-emerald-200/80 text-emerald-900 border border-emerald-300/80 rounded-full font-semibold transition-all shrink-0 active:scale-95 shadow-2xs"
                    >
                      {template.length > 32 ? template.slice(0, 32) + "…" : template}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 bg-emerald-50/80 p-2 rounded-2xl border border-emerald-200 focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-2xs">
                  <input
                    type="text"
                    placeholder={`Send WhatsApp message to ${lead.firstName}...`}
                    value={whatsAppText}
                    onChange={e => setWhatsAppText(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-1.5 text-xs font-semibold focus:outline-none text-emerald-950 placeholder:text-emerald-700/60"
                    onKeyDown={e => {
                      if (e.key === "Enter" && whatsAppText.trim() && !sendWhatsAppMutation.isPending) {
                        sendWhatsAppMutation.mutate();
                      }
                    }}
                  />
                  <button
                    disabled={!whatsAppText.trim() || sendWhatsAppMutation.isPending}
                    onClick={() => sendWhatsAppMutation.mutate()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Next Best Step & Deals Summary Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Next Best Step & Sales Playbook
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                Active Guide
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Primary Recommended Action
                </span>
                <p className="text-emerald-950 font-medium leading-relaxed">
                  Send technical specification sheet for <strong>{lead?.subject || "Porta Cabins"}</strong> and schedule 15-min discovery call.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1">
                <span className="font-bold text-indigo-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> Quote Readiness
                </span>
                <p className="text-indigo-950 font-medium leading-relaxed">
                  Requirements extracted from WhatsApp. Pre-fill quote with 4x units at standard list price.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-on-surface-variant font-medium">
                Last activity logged: {activities.length > 0 ? "Recently" : "None yet"}
              </span>
              <button
                onClick={handleConvertToQuotation}
                className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl shadow-2xs hover:opacity-90 transition-all flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Create Quotation Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Quick Actions, Documents & Meetings */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">

          {/* Quick Actions Panel */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant pb-2">
              Quick Actions
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button 
                onClick={async () => {
                  try {
                    const statusRes = await fetch("/api/v1/telephony/status", { headers: { "Authorization": `Bearer ${token}` } });
                    const statusData = await statusRes.json();
                    if (!statusData.configured) {
                      alert("Telephony not configured: " + statusData.message);
                      return;
                    }
                    const callRes = await fetch("/api/v1/telephony/call", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                      body: JSON.stringify({ leadId: id, phoneNumber: lead.phone || "+12025550123" })
                    });
                    const callData = await callRes.json();
                    alert(callData.message || "Twilio call initiated!");
                  } catch (e: any) {
                    alert("Telephony action: " + e.message);
                  }
                }}
                className="p-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl font-bold text-emerald-800 flex flex-col items-center gap-1.5 transition-all group"
                title="Twilio Click-to-Call with Recording"
              >
                <Phone className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Twilio Call</span>
              </button>

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

          {/* Team Comments & @Mentions Section */}
          <CommentThreadSection leadId={id} />

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
                <button onClick={() => createTaskMutation.mutate()} className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded font-bold text-xs">Save Task</button>
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
                <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Technical Specifications PDF..." className="w-full bg-surface border border-outline rounded p-2 text-xs" />
              </div>
              <div>
                <label className="block font-bold text-on-surface-variant mb-1">FileType</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full bg-surface border border-outline rounded p-2 text-xs">
                  <option value="PDF">PDF</option>
                  <option value="DOCX">DOCX</option>
                  <option value="XLSX">XLSX</option>
                  <option value="CAD/BOM">CAD / BOM</option>
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
