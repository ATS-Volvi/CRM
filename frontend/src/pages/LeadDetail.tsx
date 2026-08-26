import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle, Sparkles, Send, Upload, Plus,
  FilePlus, Award, ShieldAlert, CheckCircle2, Clock, MapPin, Video, ExternalLink, Pin,
  FileEdit, Landmark, Inbox, User, Receipt, AlertTriangle, Target, Lock, XCircle
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";
import { CommentThreadSection } from "../components/CommentThreadSection";
import { QualificationDrawer } from "../components/QualificationDrawer";
import { LeadConversionModal } from "../components/LeadConversionModal";
import { HandoffChatWidget } from "../components/HandoffChatWidget";
import { AiRequirementSummaryCard } from "../components/AiRequirementSummaryCard";

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
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);

  // Clean Horizontal Tab State
  const [activeTab, setActiveTab] = useState<"timeline" | "tasks" | "history" | "handoff_chat">("timeline");

  // Quick Action Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isQualifyDrawerOpen, setIsQualifyDrawerOpen] = useState(false);

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

  const handleOpenConversionModal = () => {
    setIsConversionModalOpen(true);
  };

  // Queries
  const { data: lead, isLoading } = useQuery<any>({
    queryKey: ["lead", id],
    queryFn: async () => {
      // Direct single-record PK lookup — previously fetched ALL leads and searched client-side
      const res = await fetch(`/api/v1/leads/${id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Lead not found");
      return res.json();
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
    refetchInterval: 15000, // Poll every 15s (was 3s — 5× less server load)
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

  const { data: accountHistory } = useQuery<any>({
    queryKey: ["leadAccountHistory", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/account-history`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return { relatedLeads: [], deals: [], quotes: [] };
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
    onMutate: async (newStatus: string) => {
      await queryClient.cancelQueries({ queryKey: ["lead", id] });
      const prev = queryClient.getQueryData(["lead", id]);
      queryClient.setQueryData(["lead", id], (old: any) => old ? { ...old, status: newStatus } : old);
      return { prev };
    },
    onError: (_err, _newStatus, context: any) => {
      if (context?.prev) {
        queryClient.setQueryData(["lead", id], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
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

  const { data: missingInfo } = useQuery({
    queryKey: ["leadMissingInfo", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/missing-info`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id && !!token
  });

  const [requestDetailsSuccess, setRequestDetailsSuccess] = useState<string | null>(null);
  const requestDetailsMutation = useMutation({
    mutationFn: async (channel?: string) => {
      const res = await fetch(`/api/v1/leads/${id}/request-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ channel })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      queryClient.invalidateQueries({ queryKey: ["leadMissingInfo", id] });
      setRequestDetailsSuccess(data.message || "Automated information request dispatched to customer.");
      setTimeout(() => setRequestDetailsSuccess(null), 6000);
    }
  });

  const [whatsAppText, setWhatsAppText] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [isSkippingSummary, setIsSkippingSummary] = useState(false);
  const [whatsAppTemplateError, setWhatsAppTemplateError] = useState<string | null>(null);
  const [summaryLanguage, setSummaryLanguage] = useState<"ar" | "en">("ar");

  useEffect(() => {
    if (lead?.preferredLanguage === "en" || lead?.preferredLanguage === "ar") {
      setSummaryLanguage(lead.preferredLanguage);
    }
  }, [lead?.preferredLanguage]);

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
      const hasPhone = Boolean(lead?.phone || lead?.whatsappPhone);
      if (hasPhone) {
        const lang = lead?.preferredLanguage || "ar";
        const recap = callNotes 
          ? (lang === "ar" ? `ملخص المكالمة: ${callNotes}` : `Call Summary: ${callNotes}`)
          : (lang === "ar" ? "ملخص المكالمة الهاتفية" : "Call summary recap");
        setWhatsAppText(recap);
        setWhatsAppTemplateError(null);
        setActiveModal("call-summary");
      } else {
        setActiveModal(null);
      }
      setCallNotes("");
    }
  });

  const skipCallSummaryMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          type: "note",
          outcome: `Skipped WhatsApp call summary: ${reason}`,
          notes: `Call summary WhatsApp message skipped by rep. Mandatory reason: ${reason}`
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setSkipReason("");
      setIsSkippingSummary(false);
      setWhatsAppTemplateError(null);
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

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          leadId: id,
          phone: lead?.phone || lead?.whatsappPhone,
          text: whatsAppText,
          language: summaryLanguage
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setActiveModal(null);
      setWhatsAppText("");
      setWhatsAppTemplateError(null);
    },
    onError: (err: any) => {
      let errorMsg = err.message || "Failed to send WhatsApp message";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          errorMsg = parsed.error;
          if (parsed.requiresTemplate) {
            errorMsg = `No approved WhatsApp template configured for language '${summaryLanguage.toUpperCase()}' — contact your system administrator to configure Twilio Content SID.`;
          }
        }
      } catch (e) {}
      setWhatsAppTemplateError(errorMsg);
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
    <div className="w-full px-6 md:px-8 py-6 space-y-6">
      
      {/* 1. Sleek Compact Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link to="/leads" className="hover:text-blue-600 flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> Leads
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-mono text-slate-500">{lead.leadNumber || "LEAD-360"}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {lead.status || "NEW"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {lead.firstName || lead.lastName ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim() : "Unnamed Lead"}
            </h1>
            {lead.company && (
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                • {lead.company}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {lead.status !== "CONVERTED" && lead.status !== "NOT_CONVERTED" && lead.status !== "Won" && lead.status !== "Lost" ? (
            <button 
              onClick={handleOpenConversionModal}
              className="enterprise-btn-primary text-xs shadow-xs flex items-center gap-1.5"
            >
              <Target className="w-4 h-4" />
              <span>Convert to Deal</span>
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {lead.status === "CONVERTED" || lead.status === "Won" ? "Converted" : "Not Converted"}
            </span>
          )}
        </div>
      </div>

      {/* Missing Contact Details Alert Strip (if incomplete) */}
      {missingInfo && !missingInfo.isComplete && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Incomplete Profile: Missing {missingInfo.missing?.join(", ") || "Email & Phone Number"}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Dispatch an automated request to prompt the customer to share their email address and phone number for quotation.
              </p>
            </div>
          </div>

          <button
            onClick={() => requestDetailsMutation.mutate(undefined)}
            disabled={requestDetailsMutation.isPending}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{requestDetailsMutation.isPending ? "Sending Request..." : "Request Missing Details"}</span>
          </button>
        </div>
      )}

      {/* 3. Modern Chevron Arrow & Checkpoint Milestone Stepper */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          
          {/* Linked Chevron Arrow Path */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-0 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl overflow-hidden p-1 border border-slate-200/60 dark:border-slate-700/60">
            {[
              { key: "NEW", num: "1", label: "New Enquiry", desc: "Ingested & Assigned" },
              { key: "CONTACTED", num: "2", label: "Contacted", desc: "Outreach in Progress" },
              { key: "QUALIFIED", num: "3", label: "Qualified", desc: "Needs & Budget Set" },
              { key: "CONVERTED", num: "4", label: "Converted", desc: "Deal Auto-Created" }
            ].map((stage, idx) => {
              const currentStatus = (lead.status || "NEW").toUpperCase();
              const isNotConverted = currentStatus === "NOT_CONVERTED" || currentStatus === "LOST";
              const sequentialStages = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED"];
              const currentSeqIdx = sequentialStages.indexOf(currentStatus);
              const isCurrent = currentStatus === stage.key;
              const isPast = !isNotConverted && currentSeqIdx !== -1 && idx < currentSeqIdx;

              return (
                <div key={stage.key} className="relative flex items-center flex-1">
                  <button
                    onClick={() => updateStatusMutation.mutate(stage.key)}
                    className={`w-full group relative flex items-center gap-2.5 py-2.5 px-3 rounded-lg sm:rounded-none transition-all duration-150 cursor-pointer select-none ${
                      isCurrent
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-600/30 z-20 rounded-lg sm:rounded-lg"
                        : isPast
                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 z-10"
                        : "bg-transparent hover:bg-white/60 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400"
                    }`}
                    title={`Click to set stage to ${stage.label}`}
                  >
                    {/* Checkpoint Node Circle */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-transform group-hover:scale-110 shadow-2xs ${
                        isCurrent
                          ? "bg-white text-blue-600 ring-4 ring-white/30"
                          : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isPast ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span>{stage.num}</span>
                      )}
                    </div>

                    {/* Step Label & Sub-status */}
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`text-xs font-black truncate leading-tight ${isCurrent ? "text-white" : isPast ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                        {stage.label}
                      </p>
                      <span className={`text-[10px] block truncate mt-0.5 ${isCurrent ? "text-blue-100" : isPast ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
                        {isCurrent ? "Current Step" : isPast ? "Completed" : stage.desc}
                      </span>
                    </div>
                  </button>

                  {/* Arrowhead Divider between steps on desktop */}
                  {idx < 3 && (
                    <div className="hidden sm:flex items-center absolute -right-2 z-30 pointer-events-none">
                      <ChevronRight className={`w-4 h-4 stroke-[3] ${isPast ? "text-emerald-500" : isCurrent ? "text-indigo-400" : "text-slate-300 dark:text-slate-600"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Separate Disqualified / Lost Step Action */}
          {(() => {
            const currentStatus = (lead.status || "NEW").toUpperCase();
            const isNotConverted = currentStatus === "NOT_CONVERTED" || currentStatus === "LOST";

            return (
              <button
                onClick={() => updateStatusMutation.mutate("NOT_CONVERTED")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                  isNotConverted
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-500/50"
                    : "bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700"
                }`}
                title="Mark lead as Not Converted / Lost"
              >
                <XCircle className={`w-4 h-4 ${isNotConverted ? "text-white" : "text-rose-500"}`} />
                <span>{isNotConverted ? "Not Converted (Lost)" : "Close as Lost"}</span>
              </button>
            );
          })()}

        </div>
      </div>

      {/* 4. AI Requirement Synthesis Card */}
      <AiRequirementSummaryCard
        type="lead"
        id={id!}
        onActionClick={() => {
          if (lead.status === "QUALIFIED" || lead.status === "Qualified") {
            handleOpenConversionModal();
          } else {
            setIsQualifyDrawerOpen(true);
          }
        }}
      />

      {/* 5. Clean 2-Column Workspace */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* SIDEBAR (Right/Left): AI Copilot + Customer Metadata + Tasks */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

          {/* AI Sales Copilot Card */}
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" /> AI Sales Copilot & Insights
              </h3>
              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                Real-time
              </span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Win Probability:</span>
                <span className="font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {Math.min(95, Math.max(30, Math.round((lead.leadScore || 50) * 1.3)))}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Recommended Action:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  Schedule product demo & confirm quote parameters with {lead.firstName || "customer"}.
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Risk Indicator:</span>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60">
                  No direct phone contact in 7 days. High upsell potential on standard service items.
                </p>
              </div>
            </div>
          </div>

          {/* Customer Metadata Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Details</h3>
              <button 
                onClick={() => setIsEditingDetails(!isEditingDetails)}
                className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                title="Edit Details"
              >
                {isEditingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            </div>

            {isEditingDetails ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Project Name</label>
                  <input 
                    type="text" 
                    value={editProjectName}
                    onChange={e => setEditProjectName(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Expected Value ($)</label>
                  <input 
                    type="number" 
                    value={editExpectedValue}
                    onChange={e => setEditExpectedValue(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. client@company.com"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +919876543210"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Notes</label>
                  <textarea 
                    rows={3}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button 
                    onClick={() => setIsEditingDetails(false)}
                    className="enterprise-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => updateDetailsMutation.mutate()}
                    className="enterprise-btn-primary text-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{lead.company || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{lead.firstName} {lead.lastName}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                  <span className="font-medium text-blue-600 break-all flex items-center gap-1">
                    {lead.email || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {lead.phone || lead.whatsappPhone || "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.source || "Inbound"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Value</span>
                    <span className="font-bold text-emerald-600">{formatCurrency((lead.leadScore || 50) * 1000)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Owner Assignee */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Representative</span>
                <button 
                  onClick={() => setIsReassigning(!isReassigning)} 
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  {isReassigning ? "Cancel" : "Reassign"}
                </button>
              </div>

              {isReassigning ? (
                <div className="space-y-2 text-xs">
                  <select 
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="enterprise-input w-full"
                  >
                    <option value="">Select Salesperson</option>
                    {salespersons?.map((sp: any) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => reassignMutation.mutate()}
                    className="w-full py-1.5 enterprise-btn-primary text-xs font-bold"
                  >
                    Confirm Reassign
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    {lead.assignedTo?.name ? lead.assignedTo.name.substring(0, 2).toUpperCase() : "UN"}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{lead.assignedTo?.name || "Unassigned"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tasks Widget */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-600" /> Open Tasks ({tasks.filter((t: any) => t.status !== "Completed").length})
              </h3>
              <button onClick={() => setActiveModal("task")} className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No pending tasks for this lead.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasks.map((task: any) => (
                  <div key={task.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl flex justify-between items-start text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Priority: {task.priority} | Status: {task.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* CENTER / MAIN PANEL: Organized into Clean Horizontal Tabs */}
        <div id="activity-timeline" className="col-span-12 lg:col-span-8 flex flex-col gap-4">

          {/* Prominent Inbound Inquiry / Form Summary Banner */}
          {(lead.body || lead.subject) && (
            <div className="bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Submitted Inbound Inquiry & Requirements</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">
                    {lead.source || "Inbound"}
                  </span>
                  {lead.sourceDetail && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {lead.sourceDetail}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/80 whitespace-pre-line">
                {lead.body || lead.subject}
              </p>
            </div>
          )}

          {/* Clean Horizontal Tabs Header (matching user design) */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 px-4 pt-1 rounded-t-2xl border-t border-x border-slate-200/90 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "timeline"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Activity & Notes ({activities.length})
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "tasks"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Tasks & Meetings ({tasks.length + meetings.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "history"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Audit History
            </button>
            <button
              onClick={() => setActiveTab("handoff_chat")}
              className={`px-3.5 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "handoff_chat"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Handoff Chat (Internal)
            </button>
          </div>

          {/* TAB 1: ACTIVITY & NOTES */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-b-2xl p-5 space-y-4 flex flex-col shadow-xs border-t-0">
                
                {/* Timeline Header & Filters */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-primary" /> Activity Timeline
                    </h3>
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      {activities.length}
                    </span>
                  </div>
                  
                  {/* Filter Links */}
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
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note Composer Bar */}
                {activityFilter !== "whatsapp" && (
                  <div className="flex gap-2 items-center bg-muted/40 p-1.5 rounded-xl border border-border/60">
                    <input
                      type="text"
                      placeholder="Add a quick note or comment..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="flex-1 bg-transparent px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (noteText.trim()) addNoteMutation.mutate();
                        }
                      }}
                    />
                    <button
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                      onClick={() => addNoteMutation.mutate()}
                      className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-30 transition-all flex items-center gap-1 shrink-0 px-2.5 py-1.5 bg-primary/10 rounded-lg"
                    >
                      <Send className="w-3 h-3" /> Post
                    </button>
                  </div>
                )}

                {/* WhatsApp conversation banner */}
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

                {/* Scrollable Feed Container */}
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
                        return 0;
                      })
                      .map((act: any) => {
                        if (act.type === "whatsapp_sms") {
                          const isIncoming = act.outcome === "message received";
                          const authorName = act.createdBy?.name || act.createdByUser?.name || "System Rep";
                          const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                          return (
                            <div key={act.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"} gap-2.5 items-start`}>
                              {isIncoming && (
                                <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 mt-3 shadow-2xs">
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                                </div>
                              )}
                              <div className={`max-w-[75%] flex flex-col gap-1 ${isIncoming ? "items-start" : "items-end"}`}>
                                <span className="text-[10px] font-bold text-slate-500 px-1 select-none">
                                  {isIncoming ? `${lead.firstName} ${lead.lastName}` : authorName}
                                </span>
                                <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                  isIncoming ? "bg-slate-100 border border-slate-200 text-slate-900 rounded-tl-xs" : "bg-emerald-600 text-white rounded-tr-xs"
                                }`}>
                                  {act.mediaUrl && (
                                    <p className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${isIncoming ? "text-primary" : "text-white/90"}`}>
                                      <Upload className="w-3 h-3" /> Media attachment — <a href={act.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a>
                                    </p>
                                  )}
                                  <p className="whitespace-pre-line">{act.notes}</p>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium px-1">{timeAgo}</span>
                              </div>
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

                        const isPinned = act.pinned;
                        const authorName = act.createdBy?.name || act.createdByUser?.name || "System Rep";
                        const titleText = act.title || (act.type ? act.type.replace(/_/g, ' ') : "Activity");
                        const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                        const isDupOutcome = act.outcome && act.outcome.includes("Duplicate lead capture");
                        const rawContent = act.notes || (isDupOutcome ? "Lead captured from marketing channel." : act.outcome);

                        // Parse potential JSON arrays / objects cleanly
                        let parsedText = "";
                        let parsedItems: string[] = [];

                        if (rawContent) {
                          const trimmed = String(rawContent).trim();
                          if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
                            try {
                              const parsed = JSON.parse(trimmed);
                              if (Array.isArray(parsed)) {
                                parsedItems = parsed
                                  .map((item: any) => {
                                    if (typeof item === "string") return item;
                                    if (item && typeof item === "object") {
                                      return item.description || item.text || item.label || (item.type ? item.type.replace(/_/g, " ") : "");
                                    }
                                    return "";
                                  })
                                  .filter(Boolean);
                              } else if (parsed && typeof parsed === "object") {
                                if (parsed.description) parsedText = parsed.description;
                                else if (parsed.notes) parsedText = parsed.notes;
                                else if (parsed.message) parsedText = parsed.message;
                                else parsedItems = Object.entries(parsed).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
                              }
                            } catch {
                              parsedText = trimmed;
                            }
                          } else {
                            parsedText = trimmed;
                          }
                        }

                        const isAutomated = act.outcome?.includes("[AUTOMATED]") || act.outcome?.toLowerCase().includes("automated") || act.type === "stage_change";

                        // Activity Icons & Badges based on type
                        let typeIcon = <Activity className="w-3.5 h-3.5 text-blue-600" />;
                        let typeBg = "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                        if (act.type === "note") {
                          typeIcon = <FileText className="w-3.5 h-3.5 text-indigo-600" />;
                          typeBg = "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
                        } else if (act.type === "call") {
                          typeIcon = <Phone className="w-3.5 h-3.5 text-emerald-600" />;
                          typeBg = "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                        } else if (act.type === "email") {
                          typeIcon = <Mail className="w-3.5 h-3.5 text-sky-600" />;
                          typeBg = "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
                        } else if (act.type === "stage_change") {
                          typeIcon = <TrendingUp className="w-3.5 h-3.5 text-purple-600" />;
                          typeBg = "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
                        } else if (act.type === "meeting" || act.type === "task") {
                          typeIcon = <Calendar className="w-3.5 h-3.5 text-amber-600" />;
                          typeBg = "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                        }

                        return (
                          <div 
                            key={act.id} 
                            className={`p-3.5 rounded-xl border transition-all text-xs space-y-2 ${
                              isPinned 
                                ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-2xs" 
                                : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600"
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                  {typeIcon}
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">{authorName}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${typeBg}`}>
                                  {titleText}
                                </span>
                                {isAutomated ? (
                                  <span className="text-[9px] font-extrabold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-purple-600" /> Automated
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    Manual
                                  </span>
                                )}
                                {isPinned && (
                                  <span className="text-[9px] font-bold text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                    Pinned
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 font-medium">
                                <span>{timeAgo}</span>
                                <button
                                  onClick={() => togglePinMutation.mutate(act.id)}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
                                  title={isPinned ? "Unpin note" : "Pin note to top"}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-blue-600 text-blue-600" : ""}`} />
                                </button>
                              </div>
                            </div>

                            {/* Text Content */}
                            {parsedText && (
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-line pl-8">
                                {parsedText}
                              </p>
                            )}

                            {/* Formatted Checklist Items */}
                            {parsedItems.length > 0 && (
                              <div className="pl-8 space-y-1 pt-1">
                                {parsedItems.map((item, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span className="font-semibold">{item}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Inline WhatsApp Chat Composer */}
                {activityFilter === "whatsapp" && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Quick Reply:</span>
                      {[
                        "Hi! Thanks for reaching out. How can we assist you with our Porta Cabin solutions today?",
                        "We've sent the requested catalog & specs. When would be a good time for a 5-min review call?",
                        "Would you be available for a quick site visit or video demo of our modular units?"
                      ].map((tpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setWhatsAppText(tpl)}
                          className="px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors shrink-0 max-w-[220px] truncate font-medium text-[11px]"
                          title={tpl}
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`Send WhatsApp message to ${lead.firstName}...`}
                        value={whatsAppText}
                        onChange={(e) => setWhatsAppText(e.target.value)}
                        className="flex-1 bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (whatsAppText.trim()) sendWhatsAppMutation.mutate();
                          }
                        }}
                      />
                      <button
                        disabled={!whatsAppText.trim() || sendWhatsAppMutation.isPending}
                        onClick={() => sendWhatsAppMutation.mutate()}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-30 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Best Step & Sales Playbook Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Next Best Step & Sales Playbook
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded">
                    Active Guide
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Primary Recommended Action
                    </span>
                    <p className="text-emerald-950 dark:text-emerald-200 font-medium leading-relaxed">
                      Send technical specification sheet for <strong>{lead?.body?.slice(0, 45) || lead?.subject || "Requested Items"}</strong> and schedule discovery call.
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1">
                    <span className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" /> Quote Readiness
                    </span>
                    <p className="text-indigo-950 dark:text-indigo-200 font-medium leading-relaxed">
                      Inbound request captured via {lead.source || "form"}. Review specs and prepare initial pricing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TASKS & MEETINGS */}
          {activeTab === "tasks" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-b-2xl p-5 space-y-6 shadow-xs border-t-0 text-xs">
              {/* Tasks section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-blue-600" /> Action Items & Tasks ({tasks.length})
                  </h4>
                  <button onClick={() => setActiveModal("task")} className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Task
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No pending tasks.</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task: any) => (
                      <div key={task.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Priority: {task.priority} · Status: {task.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Meetings section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" /> Scheduled Meetings ({meetings.length})
                  </h4>
                  <button onClick={() => setActiveModal("meeting")} className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Schedule
                  </button>
                </div>
                {meetings.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No meetings scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {meetings.map((m: any) => (
                      <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{m.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{m.meetingDate} at {m.meetingTime}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" /> Attached Documents ({documents.length})
                  </h4>
                  <button onClick={() => setActiveModal("document")} className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Upload
                  </button>
                </div>
                {documents.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No documents attached.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((d: any) => (
                      <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-center">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{d.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{d.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT HISTORY */}
          {activeTab === "history" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-b-2xl p-5 space-y-4 shadow-xs border-t-0 text-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lead Audit & Transition History</h3>
                <p className="text-xs text-slate-500">Chronological audit trail of ownership, stage updates, and system events</p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Current Lead Status: {lead.status || "NEW"}</span>
                      <span className="text-[11px] text-slate-400">{lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : "Recent"}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">Assigned Owner: {lead.assignedTo?.name || "System Round Robin"}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Lead Ingested & Captured</span>
                      <span className="text-[11px] text-slate-400">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "Initial"}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">Channel: {lead.source || "Inbound Form"} {lead.sourceDetail ? `(${lead.sourceDetail})` : ""}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HANDOFF CHAT & TEAM DISCUSSIONS */}
          {activeTab === "handoff_chat" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-b-2xl p-5 space-y-6 shadow-xs border-t-0">
              <CommentThreadSection leadId={id} />
              <HandoffChatWidget dealId={lead.convertedDealId || id} />
            </div>
          )}

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

      {/* Post-Call WhatsApp Summary Modal (No silent close — must send or log skip reason) */}
      {activeModal === "call-summary" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-outline-variant pb-3">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" /> Post-Call WhatsApp Summary
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Action Required
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-on-surface-variant font-medium">
                Target: <strong>{lead?.phone || lead?.whatsappPhone}</strong>
              </span>

              {/* Language Selector (Arabic / English) */}
              <div className="flex items-center gap-1 bg-surface border border-outline rounded-lg p-0.5">
                <button
                  onClick={() => setSummaryLanguage("ar")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    summaryLanguage === "ar" ? "bg-emerald-600 text-white" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  العربية (AR)
                </button>
                <button
                  onClick={() => setSummaryLanguage("en")}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    summaryLanguage === "en" ? "bg-emerald-600 text-white" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>

            {whatsAppTemplateError && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  WhatsApp Business Template Guidance
                </div>
                <p className="text-[11px] leading-relaxed opacity-95">{whatsAppTemplateError}</p>
              </div>
            )}

            {!isSkippingSummary ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-on-surface-variant mb-1">WhatsApp Message Summary</label>
                  <textarea
                    rows={4}
                    value={whatsAppText}
                    onChange={(e) => setWhatsAppText(e.target.value)}
                    className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                    placeholder="Review and edit call summary before sending..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => setIsSkippingSummary(true)}
                    className="w-full sm:w-1/2 py-2 px-3 border border-outline rounded-lg font-bold text-xs text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Skip &amp; Log Reason
                  </button>
                  <button
                    onClick={() => sendWhatsAppMutation.mutate()}
                    disabled={sendWhatsAppMutation.isPending || !whatsAppText.trim()}
                    className="w-full sm:w-1/2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    {sendWhatsAppMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Summary</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-red-700 mb-1">
                    Mandatory Reason for Skipping WhatsApp Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="e.g. Customer explicitly requested no WhatsApp / Phone number not registered..."
                    className="w-full bg-surface border border-red-300 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => setIsSkippingSummary(false)}
                    className="w-full sm:w-1/2 py-2 px-3 border border-outline rounded-lg font-bold text-xs text-on-surface-variant hover:bg-surface-container"
                  >
                    ← Back to Send
                  </button>
                  <button
                    onClick={() => skipReason.trim() && skipCallSummaryMutation.mutate(skipReason.trim())}
                    disabled={!skipReason.trim() || skipCallSummaryMutation.isPending}
                    className="w-full sm:w-1/2 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    {skipCallSummaryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Confirm &amp; Log Skip</span>
                  </button>
                </div>
              </div>
            )}
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

      {/* Qualification Drawer Modal */}
      <QualificationDrawer
        isOpen={isQualifyDrawerOpen}
        onClose={() => setIsQualifyDrawerOpen(false)}
        lead={lead}
        token={token}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["lead", id] });
          queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
        }}
      />

      {/* Structured Lead Conversion Modal */}
      {lead && (
        <LeadConversionModal
          isOpen={isConversionModalOpen}
          onClose={() => setIsConversionModalOpen(false)}
          lead={lead}
          onConverted={(res) => {
            queryClient.invalidateQueries({ queryKey: ["lead", id] });
            queryClient.invalidateQueries({ queryKey: ["pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["opportunities"] });
          }}
        />
      )}
    </div>
  );
}
