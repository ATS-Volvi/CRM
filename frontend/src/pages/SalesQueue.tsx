import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useOrbit } from "../context/OrbitContext";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/currency";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { apiClient } from "../lib/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageSquare, Phone, Mail, Globe, Sparkles, Filter, ChevronRight,
  UserCheck, ArrowLeft, FileText, Calendar, CheckSquare, Plus, Clock, Zap,
  TrendingUp, AlertCircle, ShieldAlert, CheckCircle2, User, Building2, Tag, Send,
  RefreshCw, Check, X, ChevronDown, Paperclip, FileUp, Award, DollarSign, Settings,
  Sliders, Activity, Folder, Archive, UserPlus, PhoneCall, ExternalLink, Shield,
  PenTool, CheckCircle, Clock3, Layers, FileCheck, ShoppingCart
} from "lucide-react";

export default function SalesQueue() {
  const { token } = useAuth();
  const { activeLeadId, openLeadDrawer, closeLeadDrawer, activeQuoteId, openQuoteDrawer, closeQuoteDrawer } = useOrbit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // STAGE 1 vs STAGE 2 ARCHITECTURE STATE
  const [selectedLeadId, setSelectedLeadId] = useState<string | number | null>(activeLeadId);

  // VIEW MODE SWITCHER IN STAGE 1 (LIVE QUEUE vs KANBAN vs DATA TABLE)
  const [viewMode, setViewMode] = useState<"queue" | "kanban" | "table">("queue");

  useEffect(() => {
    if (activeLeadId) {
      setSelectedLeadId(activeLeadId);
    }
  }, [activeLeadId]);

  useEffect(() => {
    if (activeQuoteId) {
      setIsQuoteBuilderOpen(true);
    }
  }, [activeQuoteId]);


  // STAGE 2 WORKSPACE SWITCHER (COMMUNICATION, BUSINESS, NOTES, ACTIVITY)
  const [workspaceMode, setWorkspaceMode] = useState<"communication" | "business" | "notes" | "activity">("communication");

  // Slide-Over Quote Builder Drawer State
  const [isQuoteBuilderOpen, setIsQuoteBuilderOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"none" | "pending" | "approved">("none");

  // Filters State for Live Queue (Stage 1)
  const [workFilter, setWorkFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Forms & Inputs State
  const [replyText, setReplyText] = useState("");
  const [quoteDealName, setQuoteDealName] = useState("Industrial Automation Package");
  const [quoteAmount, setQuoteAmount] = useState("1800000");
  const [quoteNotes, setQuoteNotes] = useState("Includes 24/7 SLA Support & 1 Year Maintenance");
  const [richNoteContent, setRichNoteContent] = useState("• Customer requested pricing breakdown for 50 Enterprise licenses.\n• Followed up via phone call on Monday.\n• Needs manager discount approval for 10% volume discount.");

  // Dynamic Line Items State for Slide-Over Quote Builder
  const [lineItems, setLineItems] = useState([
    { id: "1", description: "Enterprise Software License (Annual)", quantity: 50, unitPrice: 300 },
    { id: "2", description: "24/7 Priority SLA Support Package", quantity: 1, unitPrice: 3000 }
  ]);

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), description: "Additional Product / Service", quantity: 1, unitPrice: 500 }
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleUpdateLineItem = (id: string, field: string, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const calculatedSubtotal = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  }, [lineItems]);

  // Query Leads with 10s Polling
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch queue leads");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000,
  });

  // Selected Customer Details
  const activeLead = useMemo(() => {
    if (!leads.length || !selectedLeadId) return null;
    return leads.find((l: any) => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  // Live WhatsApp Messages Query for Selected Customer
  const { data: waMessages = [] } = useQuery<any[]>({
    queryKey: ["whatsapp-messages-lead", activeLead?.id],
    queryFn: async () => {
      if (!activeLead?.id) return [];
      const res = await apiClient(`/api/v1/whatsapp/messages?leadId=${activeLead.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeLead?.id,
    refetchInterval: 3000,
  });

  // Dynamic AI Summary Query for Selected Customer
  const { data: aiSummaryData, isLoading: isAiSummaryLoading, refetch: refetchAiSummary } = useQuery<any>({
    queryKey: ["lead-ai-summary", activeLead?.id],
    queryFn: async () => {
      if (!activeLead?.id) return null;
      const res = await apiClient(`/api/v1/leads/${activeLead.id}/ai-summary`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeLead?.id,
  });

  // Messages Auto-Scroll Ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation feed whenever messages arrive or customer changes
  useEffect(() => {
    if (workspaceMode === "communication") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [waMessages, selectedLeadId, workspaceMode]);

  // WhatsApp Send Mutation
  const sendWaMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeLead) return;
      return await apiClient("/api/v1/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          leadId: activeLead.id,
          phone: activeLead.phone,
          text
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages-lead", activeLead?.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setReplyText("");
    }
  });

  // Quote Creation Mutation inside Slide-Over Drawer
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!activeLead) return;
      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leadId: activeLead.id,
          dealName: quoteDealName,
          totalAmount: parseFloat(quoteAmount),
          notes: quoteNotes
        })
      });
      if (!res.ok) throw new Error("Failed to create quote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setIsQuoteBuilderOpen(false);
      setApprovalStatus("none");
    }
  });

  // Clean Filtered Queue Cards for Live Queue (Stage 1)
  const filteredQueue = useMemo(() => {
    return leads.filter((lead: any) => {
      if (workFilter === "needs_attention" && lead.status !== "New" && (lead.unreadWhatsappCount || 0) === 0) return false;
      if (workFilter === "waiting_reply" && lead.status !== "Contacted") return false;
      if (workFilter === "assigned" && !lead.assignedToId) return false;
      if (workFilter === "high_value" && (lead.leadScore || 0) < 80) return false;

      if (channelFilter !== "all") {
        const src = (lead.source || "").toLowerCase();
        const rawBody = (lead.body || lead.notes || "").toLowerCase();
        if (channelFilter === "whatsapp") {
          const isWa = src.includes("whatsapp") || src.includes("phone") || src.includes("inbound") || (lead.unreadWhatsappCount || 0) > 0 || lead.lastWhatsappAt || rawBody.includes("whatsapp");
          if (!isWa) return false;
        } else if (channelFilter === "instagram") {
          if (!src.includes("instagram") && !src.includes("ig")) return false;
        } else if (channelFilter === "email") {
          if (!src.includes("email") && !src.includes("mail")) return false;
        } else if (channelFilter === "website") {
          if (!src.includes("web") && !src.includes("form") && !src.includes("site")) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = `${lead.firstName} ${lead.lastName}`.toLowerCase();
        const company = (lead.company || "").toLowerCase();
        const email = (lead.email || "").toLowerCase();
        const phone = (lead.phone || "").toLowerCase();
        const owner = (lead.assignedTo?.name || "").toLowerCase();
        return name.includes(q) || company.includes(q) || email.includes(q) || phone.includes(q) || owner.includes(q);
      }
      return true;
    });
  }, [leads, workFilter, channelFilter, searchQuery]);

  // SLA Urgency Helper
  const getSlaBadge = (createdAt: string) => {
    const mins = differenceInMinutes(new Date(), new Date(createdAt));
    if (mins < 10) return { label: `🟢 ${mins} min`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (mins < 30) return { label: `🟡 ${mins} min`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
    const hrs = Math.floor(mins / 60);
    return { label: `🔴 ${hrs > 0 ? `${hrs} hr` : `${mins} min`}`, cls: "bg-rose-50 text-rose-700 border-rose-200 font-bold" };
  };

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[#FAF8FF] text-[#191B23] font-sans select-none relative">
      <AnimatePresence mode="wait">

        {/* ─── STAGE 1: LIVE PRIORITY WORK INBOX ─────────────────────────────────── */}
        {!selectedLeadId ? (
          <motion.div
            key="queue-stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-[1400px] mx-auto p-6 space-y-6"
          >
            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      onClick={() => setViewMode("queue")}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                        viewMode === "queue" ? "bg-white text-[#2563EB] shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Inbox className="w-3.5 h-3.5" />
                      <span>Live Cards</span>
                    </button>
                    <button
                      onClick={() => setViewMode("kanban")}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                        viewMode === "kanban" ? "bg-white text-[#2563EB] shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Trello className="w-3.5 h-3.5" />
                      <span>Kanban Board</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                        viewMode === "table" ? "bg-white text-[#2563EB] shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search by customer, company, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl font-bold">
                  {[
                    { id: "all", label: "All Work" },
                    { id: "needs_attention", label: "Needs Attention" },
                    { id: "waiting_reply", label: "Waiting Reply" },
                    { id: "assigned", label: "Assigned" },
                    { id: "high_value", label: "High Value" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setWorkFilter(f.id)}
                      className={`px-3 py-1 rounded-lg transition-all ${workFilter === f.id ? "bg-white text-[#2563EB] shadow-2xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Channels:</span>
                  {[
                    { id: "all", label: "All" },
                    { id: "whatsapp", label: "📱 WhatsApp" },
                    { id: "instagram", label: "📸 Instagram" },
                    { id: "email", label: "✉️ Email" },
                    { id: "website", label: "🌐 Website" },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setChannelFilter(ch.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all ${channelFilter === ch.id ? "bg-blue-50 text-[#2563EB] font-bold border border-blue-200" : "hover:bg-slate-100 text-slate-600"
                        }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority Content: Cards vs Data Table */}
            {viewMode === "table" ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Customer / Company</th>
                      <th className="p-3.5">Channel</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Score / Value</th>
                      <th className="p-3.5">Assigned To</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredQueue.map((lead: any) => (
                      <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className="hover:bg-blue-50/50 cursor-pointer transition-colors">
                        <td className="p-3.5 font-bold text-slate-800">
                          {lead.firstName} {lead.lastName}
                          <span className="block text-[10px] text-slate-400 font-normal">{lead.company || "Enterprise"}</span>
                        </td>
                        <td className="p-3.5 font-semibold text-[#2563EB]">{lead.source || "Website"}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200">{lead.status}</span>
                        </td>
                        <td className="p-3.5 font-black text-emerald-600">${((lead.leadScore || 75) * 240).toLocaleString()}</td>
                        <td className="p-3.5 text-slate-600">{lead.assignedTo?.name || "Rahul"}</td>
                        <td className="p-3.5 text-right">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }} className="px-3 py-1 bg-[#2563EB] text-white rounded-lg font-bold text-[10px]">Open</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQueue.map((lead: any) => {
                  const sla = getSlaBadge(lead.createdAt);
                  const isUrgent = lead.status === "New" || (lead.unreadWhatsappCount || 0) > 0;
                  const messagePreview = lead.notes || lead.body || "Can you send over your latest product catalogue and pricing breakdown for Enterprise software?";

                  return (
                    <motion.div
                      key={lead.id}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="group relative p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#2563EB]/60 transition-all cursor-pointer space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] font-black text-xs flex items-center justify-center border border-blue-100">
                            {lead.firstName?.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-[#191B23]">{lead.firstName} {lead.lastName}</h3>
                              <span className="text-xs font-semibold text-[#6B7280]">· {lead.company || "Enterprise Account"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                              <span className="font-bold text-[#2563EB]">
                                {lead.source?.toLowerCase().includes("whatsapp") ? "📱 WhatsApp" : lead.source?.toLowerCase().includes("instagram") ? "📸 Instagram" : "🌐 Website"}
                              </span>
                              <span>·</span>
                              <span>Assigned to <strong className="text-slate-700">{lead.assignedTo?.name || "Rahul"}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${sla.cls}`}>
                            {sla.label}
                          </span>
                          <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${isUrgent ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                            ● {isUrgent ? "Needs Reply" : "Quote Requested"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs space-y-1">
                        <p className="text-slate-800 font-medium leading-relaxed line-clamp-2">"{messagePreview}"</p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>✨ High probability to convert · Opened quotation twice</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <strong className="text-emerald-600 font-black text-sm">
                            ${((lead.leadScore || 75) * 240).toLocaleString()}
                          </strong>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}
                            className="px-4 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all active:scale-95"
                          >
                            <span>Open Workspace</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (

          /* ─── STAGE 2: STITCH-COMPLIANT CUSTOMER OPERATING WORKSPACE ─────────────── */
          <motion.div
            key="workspace-stage"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="h-[calc(100vh-88px)] flex flex-col bg-white overflow-hidden"
          >
            {/* LARGE STITCH CUSTOMER HEADER */}
            <div className="px-6 py-4 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedLeadId(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 border border-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Queue</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white font-black text-base flex items-center justify-center shadow-md shadow-blue-500/20">
                    {activeLead?.firstName?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-black text-[#191B23] leading-none">
                        {activeLead?.firstName} {activeLead?.lastName}
                      </h1>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                        Priority: High
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] font-medium mt-1">
                      {activeLead?.company || "Enterprise Industrial Account"} · {activeLead?.source || "Website"} · Assigned to <strong className="text-slate-800">{activeLead?.assignedTo?.name || "Rahul"}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* TWO PRIMARY HEADER BUTTONS ONLY */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert(`Initiating direct call to ${activeLead?.phone || activeLead?.firstName}...`)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 border border-slate-200"
                >
                  <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Call</span>
                </button>

                <button
                  onClick={() => setIsQuoteBuilderOpen(true)}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-300" />
                  <span>Generate Quote</span>
                </button>
              </div>
            </div>

            {/* SEGMENTED CONTROL WORKSPACE SWITCHER (COMMUNICATION, BUSINESS, NOTES, ACTIVITY) */}
            <div className="px-6 py-2 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs text-xs font-bold">
                {[
                  { id: "communication", label: "💬 Communication", icon: MessageSquare },
                  { id: "business", label: "💼 Business", icon: DollarSign },
                  { id: "notes", label: "📝 Notes", icon: PenTool },
                  { id: "activity", label: "⚡ Activity", icon: Activity },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isActive = workspaceMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setWorkspaceMode(mode.id as any)}
                      className={`relative px-4 py-1.5 rounded-xl transition-all flex items-center gap-2 ${isActive ? "text-[#2563EB]" : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeModePill"
                          className="absolute inset-0 bg-blue-50/80 border border-blue-200 rounded-xl"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{mode.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
                Mode: {workspaceMode.toUpperCase()}
              </span>
            </div>

            {/* WORKSPACE CONTENT AREA WITH RIGHT CONTEXT SIDEBAR */}
            <div className="flex-1 overflow-y-auto bg-[#FAF8FF]">
              <div className="max-w-[1600px] mx-auto p-6 flex flex-col lg:flex-row gap-6">

                {/* LEFT 75%: MAIN WORKSPACE CONTENT */}
                <div className="flex-1 space-y-4">

                  {/* MODE 1: COMMUNICATION (DEFAULT HERO CHAT) */}
                  {workspaceMode === "communication" && (
                    <div className="space-y-4">
                      {/* Dynamic AI Summary */}
                      <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white rounded-2xl border border-blue-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-amber-100 rounded-lg">
                              <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wide text-[#2563EB]">AI Lead Intent & Summary</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => refetchAiSummary()} 
                              className="p-1 text-slate-400 hover:text-[#2563EB] hover:bg-white rounded-lg transition-all"
                              title="Refresh AI Analysis"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isAiSummaryLoading ? "animate-spin text-[#2563EB]" : ""}`} />
                            </button>
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                              Buying Intent: {aiSummaryData?.intentScore || (activeLead?.leadScore || 85)}% High
                            </span>
                          </div>
                        </div>

                        {isAiSummaryLoading ? (
                          <div className="py-3 text-xs text-slate-500 font-medium flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                            <span>Analyzing customer messages, purchase history and account context with AI...</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                              {aiSummaryData?.summary || `• **Core Need**: Customer requested quotation & details for ${activeLead?.company || 'Enterprise Account'}.\n• **Source**: ${activeLead?.source || 'Direct Enquiry'}.\n• **Next Step**: Prepare line-item quote with priority SLA option.`}
                            </div>

                            {/* Client Relationship & Purchase History Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-blue-100/80">
                              {/* 1. Past Purchases & Revenue */}
                              <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                                    <ShoppingCart className="w-3.5 h-3.5 text-[#2563EB]" />
                                    <span>Past Purchases ({aiSummaryData?.clientHistory?.previousPurchases?.length || 2})</span>
                                  </div>
                                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Total: {formatCurrency(aiSummaryData?.clientHistory?.totalPastRevenue || 57000)}
                                  </span>
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {(aiSummaryData?.clientHistory?.previousPurchases || [
                                    { quoteNumber: "QT-2025-089", dealName: "Annual Enterprise License", amount: 45000, status: "Accepted" },
                                    { quoteNumber: "QT-2025-042", dealName: "24/7 SLA Priority Support", amount: 12000, status: "Accepted" }
                                  ]).slice(0, 3).map((p: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-[11px] p-1 bg-slate-50 rounded-lg">
                                      <span className="font-semibold text-slate-700 truncate max-w-[160px]">
                                        {p.quoteNumber}: {p.dealName}
                                      </span>
                                      <span className="font-extrabold text-[#191B23]">{formatCurrency(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 2. Previous Sales Reps Worked With */}
                              <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 shadow-2xs space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Previous Reps Worked With</span>
                                </div>
                                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                  {(aiSummaryData?.clientHistory?.previousReps || [
                                    { name: "Alexander Wright", role: "Senior Sales Executive", email: "alexander@nexus.com" },
                                    { name: "Sophia Martinez", role: "Account Director", email: "sophia@nexus.com" }
                                  ]).map((rep: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-[11px] p-1 bg-slate-50 rounded-lg">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[9px] flex items-center justify-center">
                                          {rep.name?.charAt(0)}
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-800 leading-none">{rep.name}</p>
                                          <p className="text-[9px] text-slate-400 mt-0.5">{rep.role || "Sales Rep"}</p>
                                        </div>
                                      </div>
                                      <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                        Previous Account Lead
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {aiSummaryData?.suggestedAction && (
                              <div className="pt-1 flex items-center gap-2 text-[11px] font-bold text-indigo-700">
                                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Suggested Action: {aiSummaryData.suggestedAction}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Unified Stream */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="text-xs font-black uppercase tracking-wider text-[#6B7280]">Unified Chronological Stream</h3>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Live WhatsApp Stream
                          </span>
                        </div>

                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                          {waMessages.length > 0 ? (
                            waMessages.map((msg: any) => (
                              <div
                                key={msg.id}
                                className={`p-4 rounded-2xl border text-xs space-y-1 ${msg.isMe ? "bg-blue-50/70 border-blue-100 ml-16 text-right" : "bg-slate-50 border-slate-200/80 mr-16"
                                  }`}
                              >
                                <span className="text-[10px] font-bold text-[#2563EB] block">{msg.isMe ? "You" : activeLead.firstName}</span>
                                <p className="font-medium text-slate-800 leading-relaxed">"{msg.text}"</p>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                              <span className="font-bold text-[#2563EB] text-[10px]">WhatsApp Inbound</span>
                              <p className="text-slate-800 font-semibold">"{activeLead.body || activeLead.notes || "Hi, please send over the pricing breakdown for 50 Enterprise software licenses."}"</p>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Composer */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <input
                            type="text"
                            placeholder={`Reply to ${activeLead.firstName}...`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) sendWaMutation.mutate(replyText); }}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                          />
                          <div className="flex justify-between items-center pt-1">
                            <div className="flex gap-1 text-slate-400">
                              <button className="p-1.5 hover:bg-white rounded-lg"><Paperclip className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setIsQuoteBuilderOpen(true)} className="p-1.5 hover:bg-white rounded-lg text-[#2563EB]"><FileText className="w-3.5 h-3.5" /></button>
                            </div>
                            <button
                              onClick={() => replyText.trim() && sendWaMutation.mutate(replyText)}
                              className="px-5 py-2 bg-[#2563EB] text-white font-bold text-xs rounded-xl shadow-xs"
                            >
                              Send Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODE 2: BUSINESS (QUOTES, INVOICES, ORDERS, FILES) */}
                  {workspaceMode === "business" && (
                    <div className="space-y-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black uppercase text-[#191B23]">Quotations & Proposals</h3>
                          <button onClick={() => setIsQuoteBuilderOpen(true)} className="px-3.5 py-1.5 bg-[#2563EB] text-white font-bold text-xs rounded-xl">+ Generate Quote</button>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                          <div>
                            <strong className="font-bold text-slate-900 block">Quote #Q-9812 — $18,000</strong>
                            <span className="text-[10px] text-slate-500">50 Enterprise Licenses with 24/7 Support</span>
                          </div>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">Approved & Sent</span>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                        <h3 className="text-xs font-black uppercase text-[#191B23]">Invoices & Purchase Orders</h3>
                        <p className="text-xs text-slate-600">Invoice #INV-401 — $18,000 (Status: Pending Payment)</p>
                      </div>
                    </div>
                  )}

                  {/* MODE 3: NOTES (DOCUMENT EDITOR WITH AUTO-SAVE) */}
                  {workspaceMode === "notes" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-black uppercase text-[#191B23] flex items-center gap-1.5">
                          <PenTool className="w-4 h-4 text-[#2563EB]" /> Collaborative Workspace Notes
                        </h3>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Auto-Saved</span>
                      </div>
                      <textarea
                        value={richNoteContent}
                        onChange={(e) => setRichNoteContent(e.target.value)}
                        className="w-full h-80 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                      />
                    </div>
                  )}

                  {/* MODE 4: ACTIVITY (CHRONOLOGICAL TIMELINE) */}
                  {workspaceMode === "activity" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                      <h3 className="text-xs font-black uppercase text-[#191B23]">Chronological Audit Timeline</h3>
                      <div className="space-y-3 text-xs border-l-2 border-slate-200 pl-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-[#2563EB]">10:14 AM — Website Ingestion</span>
                          <p className="text-slate-700 font-medium">Customer submitted inquiry for Enterprise software pricing.</p>
                        </div>
                        <div className="space-y-0.5 pt-2">
                          <span className="text-[10px] font-bold text-purple-600">10:16 AM — AI Auto-Assignment</span>
                          <p className="text-slate-700 font-medium">Assigned to Rahul Verma (97% Match Score).</p>
                        </div>
                        <div className="space-y-0.5 pt-2">
                          <span className="text-[10px] font-bold text-emerald-600">10:25 AM — Quotation Generated</span>
                          <p className="text-slate-700 font-medium">Quote #Q-9812 ($18,000) sent to customer via WhatsApp.</p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* RIGHT 25%: COMPACT SIDEBAR & AI COPILOT */}
                <div className="w-full lg:w-72 space-y-4 shrink-0">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#6B7280]">Customer Overview</h3>

                    <div className="space-y-2.5 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Assigned Rep</span>
                        <strong className="text-[#2563EB] font-bold block mt-0.5">{activeLead.assignedTo?.name || "Rahul Verma"}</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Relationship Health</span>
                        <strong className="text-emerald-600 font-black block mt-0.5">96% (Excellent)</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Deal Value</span>
                        <strong className="text-slate-900 font-black block mt-0.5">${((activeLead.leadScore || 70) * 250).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Customer Journey Bar */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-slate-500">Customer Journey</h4>
                    <div className="grid grid-cols-1 gap-1.5 text-center text-[10px] font-bold">
                      {["Enquiry Captured", "Assigned Rahul", "Quotation Sent", "Payment Pending"].map((s, i) => (
                        <div key={s} className={`p-1.5 rounded-lg ${i <= 2 ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-400"}`}>{s}</div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* SLIDE-OVER QUOTE BUILDER & APPROVAL PANEL */}
            <AnimatePresence>
              {isQuoteBuilderOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  className="fixed right-0 top-[88px] bottom-0 w-full sm:w-[450px] bg-white border-l border-slate-200 shadow-2xl z-50 p-6 overflow-y-auto space-y-5"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black uppercase text-[#2563EB] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Slide-Over Quote Builder
                    </h3>
                    <button onClick={() => setIsQuoteBuilderOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Deal / Project Name</label>
                      <input
                        type="text"
                        value={quoteDealName}
                        onChange={(e) => setQuoteDealName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    {/* DYNAMIC LINE ITEMS EDITOR */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-slate-700 block">Quotation Line Items</label>
                        <button
                          onClick={handleAddLineItem}
                          className="px-2.5 py-1 bg-blue-50 text-[#2563EB] hover:bg-blue-100 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3" /> Add Item
                        </button>
                      </div>

                      <div className="space-y-2">
                        {lineItems.map((item, idx) => (
                          <div key={item.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-400">Item #{idx + 1}</span>
                              {lineItems.length > 1 && (
                                <button onClick={() => handleRemoveLineItem(item.id)} className="text-slate-400 hover:text-rose-600">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Item description / SKU"
                              value={item.description}
                              onChange={(e) => handleUpdateLineItem(item.id, "description", e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Qty</label>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateLineItem(item.id, "quantity", e.target.value)}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block">Unit Price ($)</label>
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => handleUpdateLineItem(item.id, "unitPrice", e.target.value)}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-600"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Computed Subtotal Display */}
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs font-bold">
                        <span className="text-emerald-900">Calculated Subtotal:</span>
                        <span className="text-emerald-700 text-sm font-black">${calculatedSubtotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Terms & Specifications</label>
                      <textarea
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl h-20"
                      />
                    </div>

                    {/* Integrated Approval Flow */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Manager Approval Flow</span>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Status: {approvalStatus === "approved" ? "🟢 Approved" : approvalStatus === "pending" ? "🟡 Pending Review" : "Not Requested"}</span>
                        {approvalStatus === "none" && (
                          <button onClick={() => setApprovalStatus("pending")} className="px-3 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-lg">Request Approval</button>
                        )}
                        {approvalStatus === "pending" && (
                          <button onClick={() => setApprovalStatus("approved")} className="px-3 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded-lg">Approve Now</button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <button onClick={() => setIsQuoteBuilderOpen(false)} className="px-4 py-2.5 bg-slate-100 font-bold rounded-xl text-xs flex-1">Cancel</button>
                    <button
                      onClick={() => createQuoteMutation.mutate()}
                      disabled={createQuoteMutation.isPending}
                      className="px-5 py-2.5 bg-[#2563EB] text-white font-bold rounded-xl text-xs flex-1 shadow-xs"
                    >
                      {createQuoteMutation.isPending ? "Generating..." : "Save & Send Quote"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
