import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, Pencil, Check, X, History, UserCheck, 
  ChevronRight, Calendar, DollarSign, Activity, ShoppingBag, FileText, ChevronDown, Loader2,
  Users, TrendingUp, MessageSquare, CheckSquare, AlertCircle, Sparkles, Send, Upload, Plus,
  FilePlus, Award, ShieldAlert, CheckCircle2, Clock, MapPin, Video, ExternalLink, Pin,
  FileEdit, Landmark, Inbox, User, Receipt, Layers, Filter, Trash2, Eye, FileCheck, ArrowRight,
  ShieldCheck, AlertTriangle, RefreshCw, Tag
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const userRole = (user?.role || "admin").toLowerCase();
  const isAdminOrManager = userRole === "admin" || userRole === "director" || userRole === "sales_manager";

  // Active contextual slide-over panel: null | 'quote' | 'approval' | 'invoice' | 'task' | 'meeting' | 'email' | 'call' | 'doc'
  const [slideOver, setSlideOver] = useState<string | null>(null);

  // Active main content tab (Unified Inbox / Stage view)
  const [activeStageTab, setActiveStageTab] = useState<string | null>(null);

  // Unified inbox filters
  const [inboxFilter, setInboxFilter] = useState<string>("all");
  const [composerChannel, setComposerChannel] = useState<"whatsapp" | "email" | "note">("whatsapp");
  const [composerText, setComposerText] = useState("");

  // Edit lead details
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editExpectedValue, setEditExpectedValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Contextual Form States for Slide-over Panels
  // Quote Builder Slide-over state
  const [quoteItems, setQuoteItems] = useState<Array<{ id: string; name: string; qty: number; unitPrice: number; discountPercent: number; total: number }>>([]);
  const [quoteTaxRate] = useState(15); // 15% VAT
  const [quoteTerms] = useState("Payment due within 30 days of invoice issuance. 1-year warranty included.");

  // Task & Meeting Slide-over states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDescription, setTaskDescription] = useState("");

  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime] = useState("10:00");
  const [meetingLocation] = useState("");
  const [meetingAgenda] = useState("");

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
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const { data: quotes = [] } = useQuery<any[]>({
    queryKey: ["leadQuotes", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/quotes`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      const allQuotes = await res.json();
      return allQuotes.filter((q: any) => q.deal?.leadId === id || q.leadId === id);
    },
    enabled: !!id && !!token
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["leadInvoices", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/invoices`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      const allInvoices = await res.json();
      return allInvoices.filter((inv: any) => inv.quote?.deal?.leadId === id || inv.leadId === id);
    },
    enabled: !!id && !!token
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["priceBook"],
    queryFn: async () => {
      const res = await fetch("/api/v1/price-book", { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token
  });

  // Prefill lead editing state
  useEffect(() => {
    if (lead) {
      setEditProjectName(lead.subject || "");
      setEditExpectedValue(String((lead.leadScore || 50) * 100));
      setEditNotes(lead.body || "");
      setEditEmail(lead.email || "");
      setEditPhone(lead.phone || lead.whatsappPhone || "");
    }
  }, [lead]);

  // Set default initial quote line items when price book loads
  useEffect(() => {
    if (products && products.length > 0 && quoteItems.length === 0) {
      setQuoteItems([
        { id: products[0].id, name: products[0].name, qty: 1, unitPrice: Number(products[0].unitPrice || 48000), discountPercent: 5, total: Number(products[0].unitPrice || 48000) * 0.95 }
      ]);
    }
  }, [products]);

  // Clear unread WhatsApp count when rep opens workspace
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
        .catch(() => {});
    }
  }, [lead?.id, lead?.unreadWhatsappCount]);

  // Calculations
  const latestQuote = useMemo(() => quotes[0] || null, [quotes]);
  const latestInvoice = useMemo(() => invoices[0] || null, [invoices]);

  const quoteSubtotal = useMemo(() => {
    return quoteItems.reduce((acc, item) => acc + (item.qty * item.unitPrice * (1 - item.discountPercent / 100)), 0);
  }, [quoteItems]);

  const quoteTaxAmount = useMemo(() => (quoteSubtotal * quoteTaxRate) / 100, [quoteSubtotal, quoteTaxRate]);
  const quoteTotal = useMemo(() => quoteSubtotal + quoteTaxAmount, [quoteSubtotal, quoteTaxAmount]);

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!composerText.trim()) return;
      if (composerChannel === "whatsapp") {
        const res = await fetch(`/api/v1/whatsapp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ leadId: id, phone: lead?.phone, text: composerText })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else if (composerChannel === "email") {
        const res = await fetch(`/api/v1/email-messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ leadId: id, toEmail: lead?.email, subject: `Update regarding ${lead?.company || 'Opportunity'}`, body: composerText })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } else {
        const res = await fetch(`/api/v1/leads/${id}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ type: "note", notes: composerText, title: "Internal Rep Note" })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setComposerText("");
    }
  });

  const createQuoteMutation = useMutation({
    mutationFn: async ({ submitForApproval }: { submitForApproval: boolean }) => {
      const dealRes = await fetch(`/api/v1/leads/${id}/deal-for-quote`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!dealRes.ok) throw new Error("Failed to resolve deal for quote");
      const deal = await dealRes.json();

      const status = submitForApproval ? "Pending Approval" : "Draft";
      const qRes = await fetch(`/api/v1/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          dealId: deal.id,
          totalAmount: quoteTotal,
          status,
          items: quoteItems,
          terms: quoteTerms,
          taxAmount: quoteTaxAmount
        })
      });
      if (!qRes.ok) throw new Error(await qRes.text());
      const newQuote = await qRes.json();

      if (submitForApproval) {
        await fetch(`/api/v1/leads/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ status: "Pending Approval" })
        });
      }
      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadQuotes", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setSlideOver(null);
    }
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, approve }: { quoteId: string; approve: boolean }) => {
      const status = approve ? "Approved" : "Rejected";
      const res = await fetch(`/api/v1/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(await res.text());

      await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: approve ? "Approved" : "Negotiation" })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadQuotes", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
    }
  });

  const sendQuoteToCustomerMutation = useMutation({
    mutationFn: async ({ quoteId, channel }: { quoteId: string; channel: "email" | "whatsapp" }) => {
      const res = await fetch(`/api/v1/quotes/${quoteId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ channel, recipientPhone: lead?.phone, recipientEmail: lead?.email })
      });
      if (!res.ok) throw new Error(await res.text());

      await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "Quote Sent" })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadQuotes", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      alert("Quote successfully dispatched to customer!");
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await fetch("/api/v1/invoices/from-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ quoteId })
      });
      if (!res.ok) throw new Error(await res.text());
      const inv = await res.json();

      await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "Invoice" })
      });
      return inv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadInvoices", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setSlideOver(null);
    }
  });

  const processPaymentMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "Paid" })
      });
      if (!res.ok) throw new Error(await res.text());

      await fetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "Closed Won" })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadInvoices", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
    }
  });

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

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ leadId: id, title: taskTitle, priority: taskPriority, dueDate: taskDueDate || null, description: taskDescription })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadTasks", id] });
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setSlideOver(null);
      setTaskTitle("");
      setTaskDescription("");
    }
  });

  const addMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ leadId: id, title: meetingTitle, date: meetingDate, time: meetingTime, location: meetingLocation, agenda: meetingAgenda })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadActivities", id] });
      setSlideOver(null);
      setMeetingTitle("");
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3 bg-surface">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-on-surface-variant">Opening Customer Workspace...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-12 text-center text-error font-bold bg-surface">
        Customer Workspace not found or has been deleted.
      </div>
    );
  }

  // 10 Apple-Inspired Enterprise Sales Journey Stages
  const journeyStages = [
    { key: "Lead Received", label: "Lead Received", icon: Inbox },
    { key: "Conversation", label: "Conversation", icon: MessageSquare },
    { key: "Quote Draft", label: "Quote Draft", icon: FileEdit },
    { key: "Pending Approval", label: "Pending Approval", icon: AlertTriangle },
    { key: "Approved", label: "Approved", icon: CheckCircle2 },
    { key: "Quote Sent", label: "Quote Sent", icon: Mail },
    { key: "Negotiation", label: "Negotiation", icon: RefreshCw },
    { key: "Invoice", label: "Invoice", icon: Receipt },
    { key: "Payment", label: "Payment", icon: DollarSign },
    { key: "Closed Won", label: "Closed Won", icon: CheckCircle2 }
  ];

  const getStageIndex = (statusStr: string) => {
    const s = (statusStr || "").toLowerCase();
    if (s.includes("closed won") || s.includes("won")) return 9;
    if (s.includes("payment")) return 8;
    if (s.includes("invoice")) return 7;
    if (s.includes("negotiat")) return 6;
    if (s.includes("sent")) return 5;
    if (s.includes("approved") && !s.includes("pending")) return 4;
    if (s.includes("pending") || s.includes("approval")) return 3;
    if (s.includes("quote") || s.includes("proposal")) return 2;
    if (s.includes("contacted") || s.includes("meeting") || s.includes("conversation")) return 1;
    return 0;
  };

  const currentStageIdx = getStageIndex(lead.status);

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans relative flex flex-col antialiased">
      
      {/* WORKSPACE HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/90">
        <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <Link 
                to="/leads-table"
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border border-slate-200"
                title="Back to Live Queue"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {lead.firstName} {lead.lastName}
                  </h1>
                  <span className="text-sm font-semibold text-slate-500">
                    ({lead.company || "Enterprise Lead"})
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    lead.status === "Closed Won" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                    lead.status === "Pending Approval" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                    "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}>
                    {lead.status || "New Lead"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {lead.industry || "Technology"}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-slate-400" /> {lead.source || "WhatsApp Inbound"}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-slate-400" /> Rep: {lead.assignedTo?.name || "Sophia Martinez"}</span>
                  <span>•</span>
                  <span className="font-bold text-slate-700">Value: {formatCurrency((lead.leadScore || 50) * 100)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSlideOver("quote")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
              >
                <Plus className="w-4 h-4" /> Generate Quote
              </button>
              {latestQuote && latestQuote.status === "Approved" && isAdminOrManager && (
                <button
                  onClick={() => createInvoiceMutation.mutate(latestQuote.id)}
                  disabled={createInvoiceMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
                >
                  <Receipt className="w-4 h-4" /> Create Invoice
                </button>
              )}
              <button
                onClick={() => setSlideOver("meeting")}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" /> Meeting
              </button>
              <button
                onClick={() => setSlideOver("task")}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Task
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-5 md:grid-cols-10 gap-1">
              {journeyStages.map((st, idx) => {
                const isPassed = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                const Icon = st.icon;

                return (
                  <button
                    key={st.key}
                    onClick={() => {
                      setActiveStageTab(st.key);
                      updateStatusMutation.mutate(st.key);
                    }}
                    className={`group py-2 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 relative ${
                      isCurrent
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/20"
                        : isPassed
                        ? "bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100/70"
                        : "bg-slate-50 text-slate-400 border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${
                      isCurrent ? "text-white" : isPassed ? "text-blue-600" : "text-slate-400"
                    }`} />
                    <span className="text-[10px] font-bold tracking-tight truncate w-full">
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-12 gap-6 items-start">
        
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {latestQuote && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Active Quote #{latestQuote.id.substring(0,8).toUpperCase()}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    latestQuote.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                    latestQuote.status === "Pending Approval" ? "bg-amber-100 text-amber-800" :
                    "bg-blue-50 text-blue-700"
                  }`}>
                    {latestQuote.status}
                  </span>
                </div>
                <span className="font-black text-lg text-slate-900">{formatCurrency(latestQuote.totalAmount)}</span>
              </div>

              {latestQuote.status === "Pending Approval" && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Approval Required (Tier 2 Discount Rule)
                    </span>
                    <span className="text-[11px] text-amber-700 font-semibold">Assigned: Regional Sales Director</span>
                  </div>
                  {isAdminOrManager ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => approveQuoteMutation.mutate({ quoteId: latestQuote.id, approve: false })}
                        disabled={approveQuoteMutation.isPending}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => approveQuoteMutation.mutate({ quoteId: latestQuote.id, approve: true })}
                        disabled={approveQuoteMutation.isPending}
                        className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-xs"
                      >
                        Approve Quote
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800 font-bold text-right italic">
                      Submitted to Manager for Review. Awaiting Manager Approval...
                    </p>
                  )}
                </div>
              )}

              {latestQuote.status === "Approved" && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-blue-900">Quote Approved & Verified</h4>
                    <p className="text-[11px] text-blue-700 font-medium">Ready to dispatch via WhatsApp or Email.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendQuoteToCustomerMutation.mutate({ quoteId: latestQuote.id, channel: "whatsapp" })}
                      disabled={sendQuoteToCustomerMutation.isPending}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Dispatch WhatsApp
                    </button>
                    <button
                      onClick={() => sendQuoteToCustomerMutation.mutate({ quoteId: latestQuote.id, channel: "email" })}
                      disabled={sendQuoteToCustomerMutation.isPending}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> Dispatch Email
                    </button>
                  </div>
                </div>
              )}

              {latestInvoice && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Invoice #{latestInvoice.id.substring(0,8).toUpperCase()}</span>
                    <span className="block text-[11px] text-slate-500">Status: {latestInvoice.status}</span>
                  </div>
                  {latestInvoice.status !== "Paid" ? (
                    <button
                      onClick={() => processPaymentMutation.mutate(latestInvoice.id)}
                      disabled={processPaymentMutation.isPending}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      Process Payment ({formatCurrency(latestInvoice.totalAmount)})
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Paid & Closed Won
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* UNIFIED INBOX */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col">
            
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h2 className="font-black text-slate-900 text-base">Unified Customer Inbox</h2>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {activities.length} messages
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {[
                  { id: "all", label: "All Channels" },
                  { id: "whatsapp", label: "💬 WhatsApp" },
                  { id: "email", label: "📧 Email" },
                  { id: "note", label: "📝 Notes" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setInboxFilter(f.id)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      inboxFilter === f.id
                        ? "bg-slate-900 text-white font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[460px] pr-2 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
              {activities.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No conversation history yet. Send a WhatsApp message or note below to start.
                </div>
              ) : (
                activities
                  .filter((act: any) => {
                    if (inboxFilter === "all") return true;
                    if (inboxFilter === "whatsapp") return act.type === "whatsapp_sms";
                    if (inboxFilter === "email") return (act.type || "").toLowerCase().includes("email");
                    if (inboxFilter === "note") return act.type === "note";
                    return true;
                  })
                  .map((act: any) => {
                    const isIncoming = act.outcome === "message received";
                    const isWa = act.type === "whatsapp_sms";
                    const isEmail = (act.type || "").toLowerCase().includes("email");

                    if (isWa) {
                      return (
                        <div key={act.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"} gap-3 items-start`}>
                          {isIncoming && (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 mt-1">
                              <MessageSquare className="w-4 h-4 text-emerald-700" />
                            </div>
                          )}
                          <div className={`max-w-[75%] space-y-1 ${isIncoming ? "items-start" : "items-end flex flex-col"}`}>
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-[11px] font-bold text-slate-600">
                                {isIncoming ? `${lead.firstName} ${lead.lastName}` : (act.createdBy?.name || "Rep")}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                              isIncoming 
                                ? "bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200" 
                                : "bg-emerald-600 text-white rounded-tr-xs"
                            }`}>
                              {act.notes || act.outcome}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={act.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            {isEmail ? <Mail className="w-3.5 h-3.5 text-blue-600" /> : <FileText className="w-3.5 h-3.5 text-slate-600" />}
                            {act.title || act.type}
                          </span>
                          <span>{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                        </div>
                        <p className="text-slate-800 font-normal leading-relaxed">{act.notes || act.outcome}</p>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setComposerChannel("whatsapp")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      composerChannel === "whatsapp" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    💬 WhatsApp Reply
                  </button>
                  <button
                    onClick={() => setComposerChannel("email")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      composerChannel === "email" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    📧 Send Email
                  </button>
                  <button
                    onClick={() => setComposerChannel("note")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      composerChannel === "note" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    📝 Note
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">To: {lead.phone || lead.email || "Customer"}</span>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:border-blue-500 focus-within:bg-white transition-all">
                <input
                  type="text"
                  placeholder={`Write a ${composerChannel} reply...`}
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  className="flex-1 bg-transparent border-none text-xs font-medium focus:outline-none px-2 text-slate-900 placeholder:text-slate-400"
                  onKeyDown={e => {
                    if (e.key === "Enter" && composerText.trim()) {
                      sendMessageMutation.mutate();
                    }
                  }}
                />
                <button
                  disabled={!composerText.trim() || sendMessageMutation.isPending}
                  onClick={() => sendMessageMutation.mutate()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            </div>

          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <History className="w-4 h-4 text-blue-600" /> Complete Sales Journey Audit Log
            </h3>
            <div className="space-y-3 text-xs pl-2">
              <div className="flex items-center gap-3 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-900">Lead Received</span> — Captured via {lead.source || "WhatsApp Inbound"} ({formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })})
              </div>
              <div className="flex items-center gap-3 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="font-bold text-slate-900">Rep Assigned</span> — Assigned to {lead.assignedTo?.name || "Sophia Martinez"}
              </div>
              {latestQuote && (
                <div className="flex items-center gap-3 text-slate-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="font-bold text-slate-900">Quote Drafted</span> — Quote #{latestQuote.id.substring(0,8).toUpperCase()} ({formatCurrency(latestQuote.totalAmount)})
                </div>
              )}
              {latestInvoice && (
                <div className="flex items-center gap-3 text-slate-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-bold text-slate-900">Invoice Issued</span> — Invoice #{latestInvoice.id.substring(0,8).toUpperCase()}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-12 lg:col-span-4 space-y-6">

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/20 pb-2.5">
              <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 text-blue-100">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" /> AI Customer Intelligence
              </span>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white">94% Confidence</span>
            </div>
            
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-blue-200 text-[11px] font-semibold block mb-0.5">Buying Intent Score</span>
                <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(98, Math.max(40, (lead.leadScore || 50) * 1.2))}%` }} />
                </div>
              </div>
              <div>
                <span className="text-blue-200 text-[11px] font-semibold block mb-0.5">Relationship Health</span>
                <span className="font-black text-white text-sm">Strong (Active Daily Response)</span>
              </div>
              <div className="pt-1">
                <span className="text-blue-200 text-[11px] font-semibold block mb-1">Next Best Action</span>
                <p className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15 text-white font-medium text-xs">
                  Issue Quote revision with 5% multi-year discount to close deal this week.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">Customer Profile</h3>
              <button 
                onClick={() => setIsEditingDetails(!isEditingDetails)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                {isEditingDetails ? "Cancel" : "Edit"}
              </button>
            </div>

            {isEditingDetails ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Requirement Subject</label>
                  <input type="text" value={editProjectName} onChange={e => setEditProjectName(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Phone</label>
                  <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2" />
                </div>
                <button onClick={() => updateDetailsMutation.mutate()} className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg">Save Profile</button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Company</span>
                  <span className="font-bold text-slate-900 text-sm">{lead.company || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Contact Person</span>
                  <span className="font-semibold text-slate-800">{lead.firstName} {lead.lastName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Email Address</span>
                  <span className="font-semibold text-blue-600">{lead.email || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone / WhatsApp</span>
                  <span className="font-semibold text-slate-800">{lead.phone || lead.whatsappPhone || "N/A"}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Industry</span>
                    <span className="font-semibold text-slate-800">{lead.industry || "General"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Lead Score</span>
                    <span className="font-bold text-emerald-600">{lead.leadScore || 50} / 100</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSlideOver("quote")} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex flex-col items-center gap-1">
                <Plus className="w-4 h-4 text-blue-600" /> New Quote
              </button>
              <button onClick={() => setSlideOver("meeting")} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex flex-col items-center gap-1">
                <Calendar className="w-4 h-4 text-amber-600" /> Schedule
              </button>
              <button onClick={() => setSlideOver("task")} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex flex-col items-center gap-1">
                <CheckSquare className="w-4 h-4 text-indigo-600" /> Add Task
              </button>
              <button onClick={() => setSlideOver("doc")} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex flex-col items-center gap-1">
                <Upload className="w-4 h-4 text-emerald-600" /> Documents
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* CONTEXTUAL SLIDE-OVER PANELS */}
      {slideOver && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          
          <div 
            onClick={() => setSlideOver(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
          />

          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl z-10 flex flex-col border-l border-slate-200 animate-slide-in-right">
            
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {slideOver === "quote" && <><FileText className="w-5 h-5 text-blue-600" /> Contextual CPQ Quote Builder</>}
                {slideOver === "task" && <><CheckSquare className="w-5 h-5 text-indigo-600" /> Create Task</>}
                {slideOver === "meeting" && <><Calendar className="w-5 h-5 text-amber-600" /> Schedule Meeting</>}
              </h2>
              <button 
                onClick={() => setSlideOver(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {slideOver === "quote" && (
                <div className="space-y-6 text-xs">
                  
                  <div className="space-y-3">
                    <h3 className="font-extrabold text-slate-900 text-sm">Select Line Items & Services</h3>
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between items-center font-bold text-slate-900">
                            <span>{item.name}</span>
                            <button onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Qty</label>
                              <input type="number" value={item.qty} onChange={e => {
                                const q = parseInt(e.target.value) || 1;
                                setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: q, total: q * it.unitPrice * (1 - it.discountPercent / 100) } : it));
                              }} className="w-full border border-slate-300 rounded p-1.5 text-xs font-bold" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Unit Price ($)</label>
                              <input type="number" value={item.unitPrice} onChange={e => {
                                const p = parseFloat(e.target.value) || 0;
                                setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: p, total: it.qty * p * (1 - it.discountPercent / 100) } : it));
                              }} className="w-full border border-slate-300 rounded p-1.5 text-xs font-bold" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500">Total ($)</label>
                              <div className="p-1.5 font-black text-slate-900">{formatCurrency(item.total)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <select 
                        onChange={(e) => {
                          const prod = products.find((p: any) => p.id === e.target.value);
                          if (prod) {
                            setQuoteItems(prev => [...prev, { id: prod.id, name: prod.name, qty: 1, unitPrice: Number(prod.unitPrice || 10000), discountPercent: 0, total: Number(prod.unitPrice || 10000) }]);
                          }
                        }}
                        className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold bg-white"
                      >
                        <option value="">+ Add Product / Module from Price Book</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.unitPrice)})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                    <div className="flex justify-between font-semibold"><span>Subtotal:</span><span>{formatCurrency(quoteSubtotal)}</span></div>
                    <div className="flex justify-between font-semibold"><span>VAT Tax ({quoteTaxRate}%):</span><span>{formatCurrency(quoteTaxAmount)}</span></div>
                    <div className="flex justify-between font-black text-base border-t border-white/20 pt-2"><span>Total Quote Value:</span><span className="text-emerald-400">{formatCurrency(quoteTotal)}</span></div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => createQuoteMutation.mutate({ submitForApproval: false })}
                      disabled={createQuoteMutation.isPending}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={() => createQuoteMutation.mutate({ submitForApproval: true })}
                      disabled={createQuoteMutation.isPending}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                    >
                      Submit for Manager Approval
                    </button>
                  </div>
                </div>
              )}

              {slideOver === "task" && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Task Title</label>
                    <input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Follow up quote..." className="w-full border border-slate-300 rounded-xl p-2.5" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                    <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Description</label>
                    <textarea rows={4} value={taskDescription} onChange={e => setTaskDescription(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5" />
                  </div>
                  <button onClick={() => addTaskMutation.mutate()} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Save Task</button>
                </div>
              )}

              {slideOver === "meeting" && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Meeting Title</label>
                    <input type="text" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="Executive Demo..." className="w-full border border-slate-300 rounded-xl p-2.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Date</label>
                      <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Time</label>
                      <input type="text" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5" />
                    </div>
                  </div>
                  <button onClick={() => addMeetingMutation.mutate()} className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl">Schedule Meeting</button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
