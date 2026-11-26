import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle, Sparkles, Send, Upload, Plus,
  FilePlus, Award, ShieldAlert, CheckCircle2, Clock, MapPin, Video, ExternalLink, Pin,
  FileEdit, Landmark, Inbox, User, Receipt, AlertTriangle, Target, Lock, XCircle,
  Copy, Search, RefreshCw, Briefcase, PhoneCall, CheckCheck
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";
import { CommentThreadSection } from "../components/CommentThreadSection";
import { QualificationDrawer } from "../components/QualificationDrawer";
import { LeadConversionModal } from "../components/LeadConversionModal";
import { HandoffChatWidget } from "../components/HandoffChatWidget";
import { AiRequirementSummaryCard } from "../components/AiRequirementSummaryCard";
import { LeadIntelligenceHub, IntelligenceTab } from "../components/LeadIntelligenceHub";
import { LeadAttributionCard } from "../components/LeadAttributionCard";
import { DossierSmartStack } from "../components/DossierSmartStack";
import { LeadCampaignBadge } from "../components/LeadCampaignBadge";
import { SiteInspectionCard, useLeadSiteInspection } from "../components/SiteInspectionCard";
import { getStatusStyle } from "../lib/siteInspection";
import { ContactCustomerModal } from "../components/ContactCustomerModal";
import { SiteInspectionAuditGateModal } from "../components/SiteInspectionAuditGateModal";
import { LeadRequirementModal } from "../components/LeadRequirementModal";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
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
  const [gateBlockedBanner, setGateBlockedBanner] = useState<string | null>(null);
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(() => searchParams.get("contact") === "true" || searchParams.get("openCallGuide") === "true");
  const [isGateModalOpen, setIsGateModalOpen] = useState(false);
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "ok" | "info" | "err"; msg: string } | null>(null);
  const { gate, inspection, requestInspection } = useLeadSiteInspection(id);

  const handleContactConfirm = async (options: {
    notes: string;
    requiresSiteInspection: boolean;
    siteAddress?: string;
    locationInput?: string;
    siteAreaName?: string;
    siteLatitudeHint?: number | null;
    siteLongitudeHint?: number | null;
    gateAccessNotes?: string;
  }) => {
    setIsSubmittingContact(true);
    try {
      // 1. Update lead status to CONTACTED and set requiresSiteInspection
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          status: "CONTACTED",
          requiresSiteInspection: options.requiresSiteInspection,
          city: options.siteAreaName || options.siteAddress || lead?.city
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update lead status");
      }

      // 2. If requiresSiteInspection is true and no inspection exists yet, request site inspection
      if (options.requiresSiteInspection && (!inspection || !inspection.id)) {
        try {
          if (requestInspection) {
            await requestInspection({
              notes: options.notes,
              siteAddress: options.siteAddress || options.locationInput || lead?.city || "Client Site",
              locationInput: options.locationInput,
              siteAreaName: options.siteAreaName,
              siteLatitudeHint: options.siteLatitudeHint,
              siteLongitudeHint: options.siteLongitudeHint,
              requestNote: options.gateAccessNotes
                ? `${options.notes} | Gate Access: ${options.gateAccessNotes}`
                : options.notes
            });
          }
        } catch (inspErr) {
          console.warn("[LeadDetail] Auto request inspection error:", inspErr);
        }
      }

      // 3. Log Call Activity in timeline
      try {
        await fetch(`/api/v1/leads/${id}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            type: "call",
            direction: "outbound",
            outcome: `Client contacted via phone (${lead?.phone || "CX"}). Site inspection: ${options.requiresSiteInspection ? "YES (Required)" : "NO (Standard)"}.`,
            notes: options.notes
          })
        });
      } catch (actErr) {
        console.warn("[LeadDetail] Log call activity error:", actErr);
      }

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      queryClient.invalidateQueries({ queryKey: ["lead-site-inspection", id] });
      setIsContactModalOpen(false);
    } catch (err: any) {
      alert("Error updating lead outreach: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Activity Timeline Filter & Note States
  const [activityFilter, setActivityFilter] = useState<string>("whatsapp");
  const [noteText, setNoteText] = useState("");

  // Quick Action Form States
  const [callDirection, setCallDirection] = useState("Outbound");
  const [callDuration, setCallDuration] = useState("120");
  const [callOutcome, setCallOutcome] = useState("Connected");
  const [callNotes, setCallNotes] = useState("");

  // Consultative Discovery Call Guide State (Tailored for FACE Services)
  const [showDiscoveryGuide, setShowDiscoveryGuide] = useState(false);
  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceTab>("scope");
  const [discoveryService, setDiscoveryService] = useState<string>("industrial_hydrojetting");
  const [discoveryFacility, setDiscoveryFacility] = useState<string>("aramco_restricted");
  const [discoveryUrgency, setDiscoveryUrgency] = useState<string>("emergency_shutdown");
  const [discoverySowCheck, setDiscoverySowCheck] = useState(false);
  const [discoveryUtilitiesCheck, setDiscoveryUtilitiesCheck] = useState(false);
  const [discoveryLocation, setDiscoveryLocation] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openCallGuide") === "true") {
      setShowDiscoveryGuide(true);
    }
  }, [location.search]);

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

  // WhatsApp manual consent recording state
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentSource, setConsentSource] = useState<"verbal" | "written" | "form" | "other">("verbal");

  const handleOpenConversionModal = () => {
    if (gate && !gate.allowed) {
      setGateBlockedBanner(gate.message);
      return;
    }
    setIsConversionModalOpen(true);
  };

  const handleOpenQualifyDrawer = () => {
    if (gate && !gate.allowed) {
      setGateBlockedBanner(gate.message);
      return;
    }
    setIsQualifyDrawerOpen(true);
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

  useEffect(() => {
    if (lead?.city || lead?.territory) {
      setDiscoveryLocation((prev) => prev || lead.city || lead.territory || "");
    }
  }, [lead?.city, lead?.territory]);

  const requiresSiteInspection = lead?.requiresSiteInspection === true;
  // Site inspection stage is only active after the contact step if selected or if inspection already exists
  const showSiteInspectionStage =
    lead?.status !== "NEW" &&
    (requiresSiteInspection || Boolean(inspection?.id));

  useEffect(() => {
    if (!lead) return;
    const text = `${lead.body || ""} ${lead.message || ""} ${lead.sourceDetail || ""}`.toLowerCase();
    if (text.includes("waste") || text.includes("sewage") || text.includes("sludge") || text.includes("wms") || text.includes("vacuum")) {
      setDiscoveryService("wms_waste_management");
    } else if (text.includes("toilet") || text.includes("cabin") || text.includes("modular") || text.includes("tcf") || text.includes("porta")) {
      setDiscoveryService("tcf_modular_camp");
    } else if (text.includes("chemical") || text.includes("decon") || text.includes("flush") || text.includes("steam")) {
      setDiscoveryService("industrial_chem_tank");
    } else if (text.includes("crane") || text.includes("equipment") || text.includes("spmt") || text.includes("lift")) {
      setDiscoveryService("heavy_equipment");
    } else if (text.includes("hydrojet") || text.includes("jetting") || text.includes("psi")) {
      setDiscoveryService("industrial_hydrojetting");
    }

    if (text.includes("sabic") || text.includes("royal commission") || text.includes("rcjy")) {
      setDiscoveryFacility("sabic_rcjy");
    } else if (text.includes("neom") || text.includes("red sea") || text.includes("desert")) {
      setDiscoveryFacility("neom_remote");
    } else if (text.includes("modon")) {
      setDiscoveryFacility("modon_industrial");
    } else if (text.includes("aramco")) {
      setDiscoveryFacility("aramco_restricted");
    }
  }, [lead]);

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
    refetchInterval: 60000, // Poll every 60s
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

  const toggleSiteInspectionMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ requiresSiteInspection: value })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update lead status");
      }
      return res.json();
    },
    onMutate: async (newStatus: string) => {
      await queryClient.cancelQueries({ queryKey: ["lead", id] });
      const prev = queryClient.getQueryData(["lead", id]);
      queryClient.setQueryData(["lead", id], (old: any) => old ? { ...old, status: newStatus } : old);
      return { prev };
    },
    onError: (err: any, _newStatus, context: any) => {
      if (context?.prev) {
        queryClient.setQueryData(["lead", id], context.prev);
      }
      setStatusErrorMessage(err.message || "Failed to update status");
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

  // Re-enrich mutation — hoisted here to satisfy React rules-of-hooks (used in Company Intelligence card)
  const reEnrichMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/enrich`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      // Poll twice — enrichment takes ~1-3s after the 202 is returned
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["lead", id] }), 2500);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["lead", id] }), 5000);
    }
  });

  // On-demand Domain Contact Discovery (Hunter.io Domain Search)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyEmailToClipboard = (email: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email);
    }
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const { data: discoveredContactsData, isLoading: isLoadingDiscoveredContacts } = useQuery({
    queryKey: ["leadDiscoveredContacts", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/discovered-contacts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.discovery || null;
    },
    enabled: !!id && !!token
  });

  const findContactsMutation = useMutation({
    mutationFn: async (refresh: boolean = false) => {
      const res = await fetch(`/api/v1/leads/${id}/find-contacts${refresh ? "?refresh=true" : ""}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to discover contacts");
      return data;
    },
    onSuccess: (data) => {
      if (data?.discovery) {
        queryClient.setQueryData(["leadDiscoveredContacts", id], data.discovery);
      }
      queryClient.invalidateQueries({ queryKey: ["leadDiscoveredContacts", id] });
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
    onMutate: () => {
      // Optimistic instant close: user never has to wait on the modal
      setActiveModal(null);
      setToastMessage({ type: "info", msg: `Sending email to ${emailTo}...` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setEmailSubject("");
      setEmailBody("");
      setToastMessage({ type: "ok", msg: `Email dispatched to ${emailTo}!` });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.msg.includes(emailTo) ? null : prev));
      }, 4000);
    },
    onError: (error: any) => {
      let msg = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) msg = parsed.error + (parsed.details ? `: ${parsed.details}` : "");
      } catch (e) {}
      setToastMessage({ type: "err", msg: `Failed to dispatch email: ${msg}` });
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

  const logManualTextMessage = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          type: "whatsapp_sms",
          notes: whatsAppText,
          outcome: "sent (manual)",
          direction: "outbound"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setWhatsAppText("");
    }
  });

  const recordConsentMutation = useMutation({
    mutationFn: async (source: string) => {
      const res = await fetch(`/api/v1/leads/${id}/whatsapp-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ source })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setIsRecordingConsent(false);
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

  // ─── Filter out system robot clutter from human customer interactions ─────────
  const isSystemAuditLog = (act: any) => {
    if (act.type === "stage_change") return true;
    const content = `${act.notes || ""} ${act.outcome || ""}`.trim();
    if (content.toLowerCase().includes("possible duplicate of lead") || content.toLowerCase().includes("duplicate lead")) return true;
    if (content.includes("Customer business requirements documented")) return true;
    if (content.includes("Outbound email sent to customer")) return true;
    if (content.toLowerCase().includes("intake complete") || content.toLowerCase().includes("customer completed intake details")) return true;
    if (content.includes("[AUTOMATED]") || content.toLowerCase().includes("[automated]")) return true;
    if (act.type === "note" && (content.startsWith("Inbound Inquiry Captured via") || content.startsWith("Lead captured from"))) return true;
    return false;
  };

  const cleanHtmlEntities = (str: string) => {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ");
  };

  const humanActivities = activities.filter((act: any) => !isSystemAuditLog(act));
  const systemAuditActivities = activities.filter((act: any) => isSystemAuditLog(act));
  const whatsAppActivities = activities.filter((act: any) => act.type === "whatsapp_sms");

  // Initial inbound inquiry activity from RFQ capture (if present)
  const inboundInquiryAct = activities.find((act: any) => {
    const text = `${act.outcome || ""} ${act.notes || ""}`;
    return text.includes("Inbound Inquiry Captured via");
  });

  const customerInquirySnippet = inboundInquiryAct
    ? cleanHtmlEntities(inboundInquiryAct.outcome || inboundInquiryAct.notes || "")
    : "";

  // ─── Contact Activities & Risk Computation ───────────────────────────
  const contactActivities = activities.filter((a: any) => {
    const t = (a.type || "").toLowerCase();
    return (
      t.includes("call") ||
      t.includes("whatsapp") ||
      t.includes("email") ||
      t.includes("meeting") ||
      t.includes("sms")
    );
  });

  const lastContactActivity = contactActivities.length > 0
    ? contactActivities.reduce((latest: any, curr: any) => {
        const tCurr = new Date(curr.createdAt || curr.date || 0).getTime();
        const tLatest = new Date(latest.createdAt || latest.date || 0).getTime();
        return tCurr > tLatest ? curr : latest;
      }, contactActivities[0])
    : null;

  const lastContactDate = lastContactActivity
    ? new Date(lastContactActivity.createdAt || lastContactActivity.date)
    : null;

  const daysSinceLastContact =
    lastContactDate && !isNaN(lastContactDate.getTime())
      ? Math.floor((Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const hasActivities = activities.length > 0;

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
            <LeadCampaignBadge attribution={lead.campaignAttribution} />
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

      {/* Status Rejection Error Banner */}
      {statusErrorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{statusErrorMessage}</span>
          </div>
          <button onClick={() => setStatusErrorMessage(null)} className="text-rose-500 hover:text-rose-700 text-sm font-bold">×</button>
        </div>
      )}

      {/* Site Inspection Gate Blocked Banner */}
      {gateBlockedBanner && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start justify-between text-xs text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Lead Qualification Gate Locked</p>
              <p className="text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">{gateBlockedBanner}</p>
              {inspection?.id ? (
                <Link
                  to={`/site-inspections/${inspection.id}`}
                  className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 mt-1 hover:underline"
                >
                  <span>Open Site Inspection & Assessment Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : null}
            </div>
          </div>
          <button onClick={() => setGateBlockedBanner(null)} className="text-amber-600 hover:text-amber-800 font-bold text-sm">×</button>
        </div>
      )}

      {/* 3. Modern Segmented Milestone Stepper (FACE Signature Theme) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          
          {/* Linked Stage Nodes */}
          {(() => {
            const workflowStages = showSiteInspectionStage
              ? [
                  { key: "NEW",             num: "1", label: "New Enquiry",     desc: "Ingested & Assigned" },
                  { key: "CONTACTED",       num: "2", label: "Contacted",       desc: "Client Outreach & CX Call" },
                  { 
                    key: "SITE_INSPECTION", 
                    num: "3", 
                    label: "Site Inspection", 
                    desc: inspection?.status === "APPROVED" 
                      ? "Approved by TL" 
                      : inspection?.status === "SUBMITTED"
                      ? "Awaiting TL Approval"
                      : inspection?.status
                      ? getStatusStyle(inspection.status).label
                      : "Audit Required"
                  },
                  { key: "QUALIFIED",       num: "4", label: "Qualified",       desc: "Needs & Budget Set" },
                  { key: "CONVERTED",       num: "5", label: "Converted",       desc: "Deal Auto-Created" },
                ]
              : [
                  { key: "NEW",       num: "1", label: "New Enquiry", desc: "Ingested & Assigned" },
                  { key: "CONTACTED", num: "2", label: "Contacted",   desc: "Client Outreach & CX Call" },
                  { key: "QUALIFIED", num: "3", label: "Qualified",   desc: "Needs & Budget Set" },
                  { key: "CONVERTED", num: "4", label: "Converted",   desc: "Deal Auto-Created" },
                ];
            const totalStages = workflowStages.length;
            const gridCols = totalStages === 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4";
            return (
          <div className={`flex-1 grid ${gridCols} gap-1.5 bg-slate-50/90 dark:bg-slate-950/50 rounded-xl p-1.5 border border-slate-200/70 dark:border-slate-800`}>
            {workflowStages.map((stage) => {
              const currentStatus = (lead.status || "NEW").toUpperCase();
              const isNotConverted = currentStatus === "NOT_CONVERTED" || currentStatus === "LOST";
              const isApproved = inspection?.status === "APPROVED";

              let isCurrent = false;
              let isPast = false;

              if (stage.key === "NEW") {
                isCurrent = currentStatus === "NEW";
                isPast = currentStatus !== "NEW" && !isNotConverted;
              } else if (stage.key === "CONTACTED") {
                if (showSiteInspectionStage) {
                  isCurrent = currentStatus === "CONTACTED" && !inspection?.id && !isApproved;
                  isPast = currentStatus !== "NEW" && !isNotConverted && (Boolean(inspection?.id) || isApproved || ["QUALIFIED", "CONVERTED"].includes(currentStatus));
                } else {
                  isCurrent = currentStatus === "CONTACTED";
                  isPast = ["QUALIFIED", "CONVERTED"].includes(currentStatus);
                }
              } else if (stage.key === "SITE_INSPECTION") {
                isCurrent = currentStatus === "CONTACTED" && !isApproved;
                isPast = isApproved || ["QUALIFIED", "CONVERTED"].includes(currentStatus);
              } else if (stage.key === "QUALIFIED") {
                isCurrent = currentStatus === "QUALIFIED";
                isPast = currentStatus === "CONVERTED";
              } else if (stage.key === "CONVERTED") {
                isCurrent = currentStatus === "CONVERTED";
                isPast = false;
              }

              const handleStageClick = () => {
                if (stage.key === "CONTACTED") {
                  setIsContactModalOpen(true);
                  return;
                }
                if (stage.key === "SITE_INSPECTION") {
                  if (inspection?.id) {
                    navigate(`/site-inspections/${inspection.id}`);
                  } else {
                    setIsGateModalOpen(true);
                  }
                  return;
                }
                if (stage.key === "QUALIFIED") {
                  if (showSiteInspectionStage && (!inspection || inspection.status !== "APPROVED")) {
                    setIsGateModalOpen(true);
                    return;
                  }
                  if (gate && !gate.allowed && showSiteInspectionStage) {
                    setGateBlockedBanner(gate.message);
                    setIsGateModalOpen(true);
                    return;
                  }
                  // Mandatory: Pre-sales rep fills in requirements in pop-up to qualify
                  setIsRequirementModalOpen(true);
                  return;
                }
                if (stage.key === "CONVERTED") {
                  setIsConversionModalOpen(true);
                  return;
                }
                setStatusErrorMessage(null);
                updateStatusMutation.mutate(stage.key);
              };

              return (
                <button
                  key={stage.key}
                  onClick={handleStageClick}
                  className={`group relative flex items-center gap-2.5 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer select-none text-left border ${
                    isCurrent
                      ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white font-bold shadow-sm shadow-emerald-600/20 ring-1 ring-white/30 border-transparent z-10"
                      : isPast
                      ? "bg-emerald-50/80 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-slate-800 dark:text-slate-100 border-emerald-200/60 dark:border-emerald-800/60"
                      : "bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/70"
                  }`}
                  title={`Click to set stage to ${stage.label}`}
                >
                  {/* Checkpoint Node Circle */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${
                      isCurrent
                        ? "bg-white text-[#059669] ring-2 ring-white/40 shadow-xs"
                        : isPast
                        ? "bg-[#059669] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {isPast ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <span>{stage.num}</span>
                    )}
                  </div>

                  {/* Step Label & Sub-status */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black truncate leading-tight ${isCurrent ? "text-white" : isPast ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                      {stage.label}
                    </p>
                    <span className={`text-[10px] flex items-center gap-1 truncate mt-0.5 ${
                      isCurrent 
                        ? "text-emerald-100 font-bold" 
                        : isPast 
                        ? "text-[#059669] dark:text-emerald-400 font-semibold" 
                        : "text-slate-400 dark:text-slate-500 font-medium"
                    }`}>
                      {isCurrent ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                          <span>Current Step</span>
                        </>
                      ) : isPast ? (
                        "Completed"
                      ) : (
                        stage.desc
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
            );
          })()}

          {/* 5-Min Discovery Call Hub Switcher Button */}
          <button
            type="button"
            onClick={() => setIntelligenceTab(intelligenceTab === "discovery" ? "scope" : "discovery")}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 border active:scale-95 cursor-pointer ${
              intelligenceTab === "discovery"
                ? "bg-gradient-to-r from-[#1D4ED8] via-[#0D9488] to-[#10B981] text-white border-transparent shadow-sm shadow-emerald-500/20"
                : "bg-emerald-50/80 hover:bg-emerald-100 text-[#059669] dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800"
            }`}
            title="Open 5-Minute Technical Discovery Call Checklist in Hub"
          >
            <Phone className={`w-3.5 h-3.5 ${intelligenceTab === "discovery" ? "text-white" : "text-[#059669]"}`} />
            <span>5-Min Discovery Call {intelligenceTab === "discovery" ? "▲" : "▼"}</span>
          </button>

          {/* Separate Disqualified / Lost Step Action */}
          {(() => {
            const currentStatus = (lead.status || "NEW").toUpperCase();
            const isNotConverted = currentStatus === "NOT_CONVERTED" || currentStatus === "LOST";

            return (
              <button
                onClick={() => updateStatusMutation.mutate("NOT_CONVERTED")}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer border ${
                  isNotConverted
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-500/50 border-rose-600"
                    : "bg-white hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border-slate-200 dark:border-slate-700"
                }`}
                title="Mark lead as Not Converted / Lost"
              >
                <XCircle className={`w-3.5 h-3.5 ${isNotConverted ? "text-white" : "text-rose-500"}`} />
                <span>{isNotConverted ? "Not Converted (Lost)" : "Close as Lost"}</span>
              </button>
            );
          })()}

        </div>
      </div>

      {/* 4. Unified Lead Intelligence & Playbook Hub (Option 1) */}
      <LeadIntelligenceHub
        leadId={id!}
        lead={lead}
        user={user}
        winProbability={hasActivities ? Math.min(95, Math.max(30, Math.round((lead.leadScore || 50) * 1.3))) : null}
        riskIndicator={
          !hasActivities || !lastContactDate
            ? { label: "No direct contact logged yet" }
            : daysSinceLastContact !== null && daysSinceLastContact > 7
            ? { label: `No direct contact in ${daysSinceLastContact} days. Follow up required.` }
            : null
        }
        activeTab={intelligenceTab}
        onTabChange={setIntelligenceTab}
        discoveryService={discoveryService}
        setDiscoveryService={setDiscoveryService}
        discoveryFacility={discoveryFacility}
        setDiscoveryFacility={setDiscoveryFacility}
        discoveryUrgency={discoveryUrgency}
        setDiscoveryUrgency={setDiscoveryUrgency}
        discoverySowCheck={discoverySowCheck}
        setDiscoverySowCheck={setDiscoverySowCheck}
        discoveryUtilitiesCheck={discoveryUtilitiesCheck}
        setDiscoveryUtilitiesCheck={setDiscoveryUtilitiesCheck}
        discoveryLocation={discoveryLocation}
        setDiscoveryLocation={setDiscoveryLocation}
        onLogCallClick={() => setActiveModal("call")}
        onActionClick={() => {
          if (lead.status === "QUALIFIED" || lead.status === "Qualified") {
            handleOpenConversionModal();
          } else {
            handleOpenQualifyDrawer();
          }
        }}
      />

      {/* 5. Clean 2-Column Workspace */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* SIDEBAR (Right/Left): AI Copilot + Customer Metadata + Tasks */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          {/* Site Inspection Card - only displayed once site inspection is determined/requested */}
          {(showSiteInspectionStage || Boolean(inspection?.id)) && (
            <SiteInspectionCard
              leadId={id!}
              leadStatus={lead?.status}
              suggestedLocation={(() => {
                if (!lead) return "";
                try {
                  const raw = typeof lead.rawPayload === "string" ? JSON.parse(lead.rawPayload) : lead.rawPayload;
                  if (raw?.operationalBase || raw?.stationLocation || raw?.territory) {
                    return raw.operationalBase || raw.stationLocation || raw.territory;
                  }
                } catch {}
                const body = lead.body || lead.message || "";
                const baseMatch =
                  body.match(/Target (?:Operational Base|Station\/Base|Station Location|Station|Base):\s*([^\n\r]+)/i) ||
                  body.match(/Target Operational Base:\s*([^\n\r]+)/i) ||
                  body.match(/Station Location:\s*([^\n\r]+)/i) ||
                  body.match(/Location:\s*([^\n\r]+)/i);
                if (baseMatch && baseMatch[1]) {
                  return baseMatch[1].trim();
                }
                if (lead.territory) return lead.territory;
                return "";
              })()}
            />
          )}

          {/* ── BUNDLED DOSSIER SMART STACK (Swipeable Card Bundle) ── */}
          {/* Bundles Customer Details, Campaign Attribution, and Company Intelligence into an expandable, swipeable stack */}
          <DossierSmartStack
            title="Dossier & Company Intel"
            defaultTab="customer"
            items={[
              {
                id: "customer",
                label: "Customer Details",
                shortLabel: "Customer",
                icon: <User className="w-3.5 h-3.5" />,
                badge: lead.source || "Inbound",
                content: (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Contact & Account Information
                      </h4>
                      <button
                        onClick={() => setIsEditingDetails(!isEditingDetails)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
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
                        {/* Site Inspection Required Toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Site Inspection Required</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Enable for Waste Management / Disposal services. Disable for Equipment Rental, Procurement, etc.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              toggleSiteInspectionMutation.mutate(!lead.requiresSiteInspection)
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              lead.requiresSiteInspection
                                ? "bg-blue-600"
                                : "bg-slate-300 dark:bg-slate-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                lead.requiresSiteInspection ? "translate-x-4" : "translate-x-1"
                              }`}
                            />
                          </button>
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {lead.phone || lead.whatsappPhone || "N/A"}
                            </span>
                            {lead.optedOutWhatsapp && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-red-600" /> WhatsApp Opted Out
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Consent</span>
                            {(() => {
                              const status = (lead.whatsappConsentStatus || "UNSPECIFIED").toUpperCase();
                              if (status === "OPTED_IN" && !lead.optedOutWhatsapp) {
                                return (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                    Opted in {lead.whatsappConsentSource ? `(${lead.whatsappConsentSource})` : ""}
                                  </span>
                                );
                              }
                              if (status === "OPTED_OUT" || lead.optedOutWhatsapp) {
                                return (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300">
                                    Opted out
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300">
                                  Not specified
                                </span>
                              );
                            })()}
                          </div>

                          {!isRecordingConsent ? (
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-[11px] text-slate-500">
                                {lead.whatsappConsentStatus === "OPTED_IN" && lead.whatsappOptInAt
                                  ? `Recorded ${formatDistanceToNow(new Date(lead.whatsappOptInAt), { addSuffix: true })}`
                                  : "No verified consent on record"}
                              </span>
                              <button
                                onClick={() => setIsRecordingConsent(true)}
                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                              >
                                Record consent
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-900 dark:text-emerald-200 text-[11px]">Record WhatsApp Consent</span>
                                <button
                                  onClick={() => setIsRecordingConsent(false)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Consent Source <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={consentSource}
                                  onChange={(e: any) => setConsentSource(e.target.value)}
                                  className="w-full text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg p-1.5 focus:outline-none"
                                >
                                  <option value="verbal">Verbal (Call / In-Person)</option>
                                  <option value="written">Written (Email / Chat / Letter)</option>
                                  <option value="form">Form (Online / Offline Form)</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => setIsRecordingConsent(false)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={recordConsentMutation.isPending}
                                  onClick={() => recordConsentMutation.mutate(consentSource)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  {recordConsentMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Save Consent
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{lead.source || "Inbound"}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Value</span>
                            {(() => {
                              const realVal =
                                lead.estimatedValue ??
                                lead.expectedValue ??
                                lead.opportunity?.amount ??
                                lead.deal?.amount;
                              if (
                                realVal !== undefined &&
                                realVal !== null &&
                                realVal !== "" &&
                                !isNaN(Number(realVal)) &&
                                Number(realVal) > 0
                              ) {
                                return (
                                  <span className="font-bold text-emerald-600">
                                    {formatCurrency(Number(realVal))}
                                  </span>
                                );
                              }
                              if (lead.budgetRange) {
                                return (
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {lead.budgetRange}
                                  </span>
                                );
                              }
                              return (
                                <span className="text-slate-400 dark:text-slate-500 font-medium">
                                  Not estimated
                                </span>
                              );
                            })()}
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
                          className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
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
                          {(() => {
                            const repName = lead.assignedTo?.name || salespersons?.find((s: any) => s.id === (lead.assignedToId || lead.assignedTo))?.name || (typeof lead.assignedTo === "string" ? lead.assignedTo : null);
                            return (
                              <>
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                                  {repName ? repName.substring(0, 2).toUpperCase() : "UN"}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{repName || "Unassigned"}</span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )
              },
              {
                id: "tasks",
                label: "Action Tasks",
                shortLabel: "Tasks",
                icon: <CheckSquare className="w-3.5 h-3.5" />,
                badge: tasks.filter((t: any) => t.status !== "Completed").length,
                badgeColor: "bg-emerald-100 text-[#059669] dark:bg-emerald-950 dark:text-emerald-300",
                content: (
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Open Tasks ({tasks.filter((t: any) => t.status !== "Completed").length})
                      </span>
                      <button
                        onClick={() => setActiveModal("task")}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/70 dark:border-emerald-800 flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Task
                      </button>
                    </div>
                    {tasks.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center justify-center space-y-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-dashed border-slate-200/80 dark:border-slate-700/80 my-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60 shadow-2xs">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No pending tasks for this lead.</p>
                        <button
                          onClick={() => setActiveModal("task")}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 inline-flex items-center gap-1 pt-0.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add First Task
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                        {tasks.map((task: any) => (
                          <div key={task.id} className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl flex justify-between items-start text-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-2xs">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Priority: {task.priority} | Status: {task.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              },
              {
                id: "attribution",
                label: "Campaign Attribution",
                shortLabel: "Attribution",
                icon: <Target className="w-3.5 h-3.5" />,
                badge: "Touchpoints",
                badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
                content: (
                  <LeadAttributionCard leadId={id!} embedded={true} />
                )
              },
              {
                id: "intelligence",
                label: "Company Intelligence",
                shortLabel: "Company Intel",
                icon: <Building2 className="w-3.5 h-3.5" />,
                badge: (lead.enrichmentStatus === "enriched" ? "Enriched" : lead.enrichmentStatus === "pending" ? "Fetching" : null),
                badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                content: (() => {
                  const status = lead.enrichmentStatus as string;

                  if (status === "pending") {
                    return (
                      <div className="space-y-3 py-2">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Enriching via Hunter.io…</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">Live</span>
                        </div>
                        <div className="space-y-2.5 animate-pulse pt-1">
                          {[85, 60, 75, 50, 90].map((w, i) => (
                            <div key={i} className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full" style={{ width: `${w}%` }} />
                          ))}
                          <p className="text-[10px] text-slate-400 text-center pt-2">Fetching company data from Hunter.io…</p>
                        </div>
                      </div>
                    );
                  }

                  const enriched = lead.enrichmentData ? (() => { try { return JSON.parse(lead.enrichmentData); } catch { return null; } })() : null;
                  const hasMeaningfulData = Boolean(
                    enriched &&
                    (enriched.industry || enriched.sector || enriched.sizeRange || enriched.employeeCount || enriched.foundedYear || enriched.country || enriched.city || enriched.companyType || enriched.description || enriched.linkedinHandle)
                  );

                  if (!hasMeaningfulData || status !== "enriched") {
                    return (
                      <div className="py-6 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No enriched data available</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Enrich domain with Hunter.io intelligence</p>
                        </div>
                        <button
                          id="btn-reenrich-lead-empty"
                          onClick={() => reEnrichMutation.mutate()}
                          disabled={reEnrichMutation.isPending}
                          className="px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${reEnrichMutation.isPending ? "animate-spin" : ""}`} />
                          <span>{reEnrichMutation.isPending ? "Enriching…" : "Enrich Company"}</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 text-xs pt-1">
                      {enriched.industry && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">Industry</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{enriched.industry}</span>
                        </div>
                      )}
                      {enriched.sector && enriched.sector !== enriched.industry && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">Sector</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{enriched.sector}</span>
                        </div>
                      )}
                      {(enriched.sizeRange || enriched.employeeCount) && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">Headcount</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                            {enriched.employeeCount ? enriched.employeeCount.toLocaleString() : enriched.sizeRange}
                            {enriched.sizeRange && enriched.employeeCount && <span className="text-slate-400 ml-1">({enriched.sizeRange})</span>}
                          </span>
                        </div>
                      )}
                      {enriched.foundedYear && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">Founded</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{enriched.foundedYear}</span>
                        </div>
                      )}
                      {enriched.country && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">HQ</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                            {[enriched.city, enriched.country].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {enriched.companyType && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-400 font-medium shrink-0">Type</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize text-right">{enriched.companyType}</span>
                        </div>
                      )}
                      {enriched.linkedinHandle && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400 font-medium shrink-0">LinkedIn</span>
                          <a
                            href={`https://linkedin.com/${enriched.linkedinHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 text-right"
                          >
                            View profile <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {enriched.description && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">{enriched.description}</p>
                        </div>
                      )}
                      {enriched.tags && enriched.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {enriched.tags.slice(0, 5).map((tag: string) => (
                            <span key={tag} className="text-[10px] bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Re-enrich button */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {lead.enrichedAt ? `Updated ${new Date(lead.enrichedAt).toLocaleDateString()}` : "via Hunter.io"}
                        </span>
                        <button
                          id="btn-reenrich-lead"
                          onClick={() => reEnrichMutation.mutate()}
                          disabled={reEnrichMutation.isPending}
                          className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${reEnrichMutation.isPending ? "animate-spin" : ""}`} />
                          <span>{reEnrichMutation.isPending ? "Enriching…" : "Re-enrich"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()
              }
            ]}
          />

        </div>

        {/* CENTER / MAIN PANEL: Organized into Clean Horizontal Tabs */}
        <div id="activity-timeline" className="col-span-12 lg:col-span-8 flex flex-col gap-4">

          {/* Clean Horizontal Tabs Header: 2 Core Workspace Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 px-4 pt-1 rounded-t-2xl border-t border-x border-slate-200/90 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-4 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "timeline"
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Messages & Notes</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-extrabold">
                {humanActivities.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("handoff_chat")}
              className={`px-4 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "handoff_chat"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Internal Team Chat</span>
            </button>
          </div>

          {/* TAB 1: CUSTOMER CONVERSATION & HUMAN NOTES */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-b-2xl p-5 space-y-4 flex flex-col shadow-xs border-t-0">
                
                {/* Segmented Filter Pills */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { key: "whatsapp", label: "Customer Chat (WhatsApp / SMS)", count: whatsAppActivities.length, icon: MessageSquare, color: "emerald" },
                      { key: "note", label: "Internal Notes", count: humanActivities.filter(a => a.type === "note").length, icon: FileText, color: "indigo" },
                      { key: "call", label: "Calls", count: humanActivities.filter(a => a.type === "call").length, icon: Phone, color: "emerald" },
                      { key: "email", label: "Emails", count: humanActivities.filter(a => (a.type || "").toLowerCase().includes("email")).length, icon: Mail, color: "sky", show: isEmailRelevant },
                      { key: "all", label: "All Activity", count: humanActivities.length, icon: Activity, color: "slate" },
                    ].filter(f => f.show !== false).map(f => {
                      const isActive = activityFilter === f.key;
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setActivityFilter(f.key)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isActive
                              ? f.key === "whatsapp"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs"
                              : "bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{f.label}</span>
                          {f.count > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            }`}>
                              {f.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    {activityFilter === "call" && (
                      <button
                        onClick={() => setActiveModal("call")}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log Call
                      </button>
                    )}

                    {activityFilter === "email" && (
                      <button
                        onClick={() => {
                          setEmailTo(lead.email || "");
                          setEmailSubject(`Inquiry: ${lead.projectName || lead.company || "Project Follow-up"}`);
                          setActiveModal("email");
                        }}
                        className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Compose Email
                      </button>
                    )}
                  </div>
                </div>

                {/* Internal Note Composer (when on Note or All tab) */}
                {(activityFilter === "note" || activityFilter === "all") && (
                  <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Add an internal note or sales comment..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="flex-1 bg-transparent px-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
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
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-lg cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3 h-3" /> Post Note
                    </button>
                  </div>
                )}

                {/* WhatsApp & SMS Conversation Cockpit */}
                {activityFilter === "whatsapp" && (
                  <div className="space-y-3">
                    {/* Customer Contact Bar */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800 rounded-xl text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shrink-0">
                          {lead.firstName?.[0] || "C"}{lead.lastName?.[0] || ""}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-emerald-950 dark:text-emerald-200 truncate">
                            {lead.firstName} {lead.lastName} {lead.company ? `(${lead.company})` : ""}
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                            {lead.whatsappPhone || lead.phone || "No direct phone"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(lead.whatsappPhone || lead.phone) && (
                          <a
                            href={`https://wa.me/${(lead.whatsappPhone || lead.phone || "").replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800"
                          >
                            <ExternalLink className="w-3 h-3" /> Open Web
                          </a>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                          {lead.optedOutWhatsapp ? "Opted Out" : "Direct Texts"}
                        </span>
                      </div>
                    </div>

                    {lead.optedOutWhatsapp && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-800 dark:text-red-300 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Recipient has opted out of WhatsApp messaging (replied STOP). Outbound WhatsApp messages cannot be sent.</span>
                      </div>
                    )}

                    {/* Customer Original Inbound Inquiry Highlight (Decoded & Clean) */}
                    {customerInquirySnippet && whatsAppActivities.length === 0 && (
                      <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-900 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-amber-900 dark:text-amber-200 font-bold text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Original Inbound Request from Customer
                          </span>
                          <button
                            onClick={() => setWhatsAppText(`Hi ${lead.firstName}, regarding your inquiry: `)}
                            className="text-amber-700 hover:underline text-[10px] font-extrabold cursor-pointer"
                          >
                            Reply to RFQ ↵
                          </button>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line text-[11px] leading-relaxed">
                          {customerInquirySnippet}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Scrollable Feed Container */}
                <div className={`overflow-y-auto pr-2 max-h-[460px] scrollbar-thin scrollbar-thumb-slate-200 ${activityFilter === "whatsapp" ? "space-y-3.5 pt-2 pb-2" : "space-y-3 pt-1"}`}>
                  {/* Empty States */}
                  {activityFilter === "whatsapp" && whatsAppActivities.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                      <MessageSquare className="w-8 h-8 text-emerald-500/80 mx-auto" />
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">No direct text messages logged yet</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Send a message directly via WhatsApp, or click <strong className="text-slate-700 dark:text-slate-200">Log Sent Text / SMS</strong> after texting the customer from your phone.
                      </p>
                    </div>
                  ) : activityFilter === "email" && humanActivities.filter((a: any) => (a.type || "").toLowerCase().includes("email")).length === 0 ? (
                    <div className="text-center py-10 px-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                      <Mail className="w-8 h-8 text-sky-500/80 mx-auto" />
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">No email correspondence logged yet</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Send an official quote, service brochure, or technical confirmation to <strong className="text-slate-700 dark:text-slate-200">{lead.email || "this customer"}</strong>.
                      </p>
                      {lead.email && (
                        <button
                          onClick={() => {
                            setEmailTo(lead.email || "");
                            setEmailSubject(`Inquiry: ${lead.projectName || lead.company || "Project Follow-up"}`);
                            setActiveModal("email");
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Compose Email
                        </button>
                      )}
                    </div>
                  ) : humanActivities.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
                      <p className="font-semibold text-foreground/80">No interaction activity yet</p>
                      <p className="text-[11px] text-muted-foreground">Log calls, notes, or messages to populate this feed.</p>
                    </div>
                  ) : (
                    (activityFilter === "whatsapp" ? whatsAppActivities : humanActivities)
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
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      })
                      .map((act: any) => {
                        // Two-Sided WhatsApp & SMS Text Chat Bubble
                        if (act.type === "whatsapp_sms") {
                          const isIncoming = act.direction === "inbound" || act.outcome === "message received";
                          const authorName = act.createdBy?.name || act.createdByUser?.name || "Sales Rep";
                          const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                          return (
                            <div key={act.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"} gap-2 items-end`}>
                              {isIncoming && (
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 font-bold text-[10px] mb-1">
                                  {lead.firstName?.[0] || "C"}
                                </div>
                              )}
                              <div className={`max-w-[80%] flex flex-col gap-1 ${isIncoming ? "items-start" : "items-end"}`}>
                                <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                                  isIncoming 
                                    ? "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-xs" 
                                    : "bg-emerald-600 text-white rounded-tr-xs"
                                }`}>
                                  {act.mediaUrl && (
                                    <p className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${isIncoming ? "text-primary" : "text-white/90"}`}>
                                      <Upload className="w-3 h-3" /> Attachment — <a href={act.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a>
                                    </p>
                                  )}
                                  <p className="whitespace-pre-line text-xs font-medium">{cleanHtmlEntities(act.notes || act.outcome || "")}</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-1">
                                  <span>{isIncoming ? ([lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.firstName || "Customer") : authorName}</span>
                                  <span>·</span>
                                  <span>{timeAgo}</span>
                                  {!isIncoming && (
                                    <span className="flex items-center text-emerald-600 dark:text-emerald-400" title="Delivered to customer">
                                      <CheckCheck className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Standard Human Activity Cards (Notes, Calls, Emails)
                        const isPinned = act.pinned;
                        const isIncoming =
                          act.direction === "inbound" ||
                          Boolean(
                            act.outcome &&
                              (act.outcome.toLowerCase().includes("email attached") ||
                                act.outcome.toLowerCase().includes("gmail sync email attached") ||
                                act.outcome.toLowerCase().includes("message received"))
                          );
                        const customerName =
                          [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                          lead.company ||
                          lead.email ||
                          "Customer";
                        const repName = act.createdBy?.name || act.createdByUser?.name || "Sales Rep";
                        const authorName = isIncoming ? customerName : repName;
                        const titleText = act.title || (act.type ? act.type.replace(/_/g, ' ') : "Activity");
                        const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                        const rawContent = act.notes || act.outcome || "";
                        const parsedText = cleanHtmlEntities(String(rawContent).trim());

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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                  {typeIcon}
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">{authorName}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${typeBg}`}>
                                  {titleText}
                                </span>
                                {act.direction && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                    isIncoming
                                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800"
                                      : "text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800"
                                  }`}>
                                    {act.direction}
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

                            {parsedText && (
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-line pl-8">
                                {parsedText}
                              </p>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Inline WhatsApp & SMS Text Composer */}
                {activityFilter === "whatsapp" && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {/* Quick Reply Suggestions */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Quick Reply:</span>
                      {[
                        `Hi ${lead.firstName}, this is ${user?.name || "Salaan Rep"} regarding your service inquiry.`,
                        "Could you share your site location or Google Maps pin for our inspection team?",
                        "Are you available for a brief 5-minute technical review call today?",
                        "We have reviewed your request and prepared the technical scope & quotation."
                      ].map((tpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setWhatsAppText(tpl)}
                          className="px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors shrink-0 max-w-[240px] truncate font-medium text-[11px] cursor-pointer"
                          title={tpl}
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>

                    {/* Composer Input & Action Buttons */}
                    <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                      <input
                        type="text"
                        placeholder={`Type text or WhatsApp message to ${lead.firstName}...`}
                        value={whatsAppText}
                        onChange={(e) => setWhatsAppText(e.target.value)}
                        className="flex-1 min-w-[220px] bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (whatsAppText.trim() && !lead.optedOutWhatsapp) {
                              sendWhatsAppMutation.mutate();
                            }
                          }
                        }}
                      />
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Send via WhatsApp API */}
                        <button
                          disabled={!whatsAppText.trim() || sendWhatsAppMutation.isPending || lead.optedOutWhatsapp}
                          onClick={() => sendWhatsAppMutation.mutate()}
                          className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Send message directly via WhatsApp Cloud API"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send WhatsApp</span>
                        </button>

                        {/* Log Text / SMS sent directly from phone */}
                        <button
                          disabled={!whatsAppText.trim() || logManualTextMessage.isPending}
                          onClick={() => logManualTextMessage.mutate()}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Log SMS or phone text outreach to conversation history"
                        >
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>+ Log Text</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsible System Audit Trail for Admins / Compliance */}
                {systemAuditActivities.length > 0 && (
                  <details className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs group">
                    <summary className="list-none flex items-center justify-between text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer py-1 px-1 rounded transition-colors select-none text-[11px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-slate-400 group-open:text-blue-600" />
                        <span>System Audit Trail & Stage Logs ({systemAuditActivities.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {systemAuditActivities.map((act: any) => {
                        const isDup = (act.outcome || "").toLowerCase().includes("duplicate") || (act.notes || "").toLowerCase().includes("duplicate");
                        const timeAgo = formatDistanceToNow(new Date(act.createdAt), { addSuffix: true });
                        const dateStr = act.createdAt ? new Date(act.createdAt).toLocaleString() : "";
                        const content = cleanHtmlEntities(act.notes || act.outcome || "");
                        const author = act.createdBy?.name || act.createdByUser?.name || "System Automation";

                        let badgeColor = "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200";
                        let badgeText = "STAGE CHANGE";
                        let dotColor = "bg-purple-500";

                        if (isDup) {
                          badgeColor = "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200";
                          badgeText = "DUPLICATION CHECK";
                          dotColor = "bg-amber-500";
                        } else if (content.includes("Inbound Inquiry")) {
                          badgeColor = "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200";
                          badgeText = "RFQ INGESTION";
                          dotColor = "bg-sky-500";
                        } else if (content.includes("Outbound email sent") || content.includes("[AUTOMATED]")) {
                          badgeColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200";
                          badgeText = "AUTOMATED RECEIPT";
                          dotColor = "bg-slate-400";
                        }

                        return (
                          <div key={act.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start gap-2.5 text-xs">
                            <div className={`w-2 h-2 rounded-full ${dotColor} mt-1 shrink-0`} />
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${badgeColor}`}>
                                    {badgeText}
                                  </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{author}</span>
                                </div>
                                <span className="text-[10px] text-slate-400" title={dateStr}>{timeAgo}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 font-medium text-[11px] leading-relaxed whitespace-pre-line">
                                {content}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HANDOFF CHAT & TEAM DISCUSSIONS */}
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

            {lead?.optedOutWhatsapp && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-950">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  WhatsApp Messaging Disabled
                </div>
                <p className="text-[11px] leading-relaxed opacity-95">
                  Recipient has opted out of WhatsApp communications (STOP received). Outbound WhatsApp summaries cannot be sent. Please use "Skip &amp; Log Reason" to complete logging this call.
                </p>
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
                    disabled={sendWhatsAppMutation.isPending || !whatsAppText.trim() || lead?.optedOutWhatsapp}
                    className="w-full sm:w-1/2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-600" /> Compose Email to Customer
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Subject & Body:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                {[
                  {
                    label: "Quotation & Specs",
                    subj: `Quotation & Technical Specifications — ${lead.projectName || lead.company || "Your Inquiry"}`,
                    body: `Dear ${lead.firstName || "Customer"},\n\nThank you for reaching out to us. We have reviewed your project requirements and prepared the official commercial quotation along with complete technical specifications.\n\nPlease find the details outlined above. Feel free to reply directly to this email or call us if you have any questions.\n\nBest regards,\n${user?.name || "Salaan Technical Sales Team"}`
                  },
                  {
                    label: "5-Min Discovery Call",
                    subj: `Follow-up: 5-Minute Technical Review — ${lead.company || ""}`,
                    body: `Hi ${lead.firstName || "there"},\n\nI hope this email finds you well. I'm following up on your recent service inquiry. Would you have 5 minutes today or tomorrow for a brief scoping call to confirm site access details?\n\nBest regards,\n${user?.name || "Salaan Technical Sales Team"}`
                  },
                  {
                    label: "Site Inspection Confirmation",
                    subj: `Site Inspection Scheduled — ${lead.projectName || lead.company || ""}`,
                    body: `Dear ${lead.firstName || "Customer"},\n\nThis is to confirm that our Site Inspection team has been dispatched to coordinate field verification. Our inspector will be in contact with your site gate representative.\n\nBest regards,\n${user?.name || "Salaan Operations"}`
                  }
                ].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setEmailSubject(tpl.subj);
                      setEmailBody(tpl.body);
                    }}
                    className="px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 transition-colors shrink-0 text-[11px] font-semibold cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Project Proposal / Follow-up..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Message Body</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Dear Customer..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 leading-relaxed font-sans"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                  onClick={() => sendEmailMutation.mutate()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-30 transition-all shadow-2xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </button>
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

      {/* Client Outreach & Technical Scoping Modal */}
      {lead && (
        <ContactCustomerModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          lead={lead}
          initialLocation={discoveryLocation || lead?.city || lead?.territory || ""}
          onConfirm={handleContactConfirm}
          isSubmitting={isSubmittingContact}
        />
      )}

      {/* Site Inspection Audit Gate Blocked Modal */}
      {lead && (
        <SiteInspectionAuditGateModal
          isOpen={isGateModalOpen}
          onClose={() => setIsGateModalOpen(false)}
          lead={lead}
          inspection={inspection}
          gateMessage={gateBlockedBanner || gate?.message}
          onAuditApproved={() => {
            queryClient.invalidateQueries({ queryKey: ["lead", id] });
            queryClient.invalidateQueries({ queryKey: ["lead-site-inspection", id] });
            setGateBlockedBanner(null);
          }}
        />
      )}

      {/* Mandatory Customer Requirements Documentation Modal to Qualify */}
      {lead && (
        <LeadRequirementModal
          isOpen={isRequirementModalOpen}
          onClose={() => setIsRequirementModalOpen(false)}
          lead={lead}
          token={token}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["lead", id] });
            queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-fade-in ${
            toastMessage.type === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
              : toastMessage.type === "info"
              ? "bg-sky-50 dark:bg-sky-950/90 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800"
              : "bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800"
          }`}
        >
          {toastMessage.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toastMessage.type === "info" ? (
            <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.msg}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
