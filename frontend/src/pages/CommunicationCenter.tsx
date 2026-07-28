import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Mail, MessageSquare, PhoneCall, Send, Search, Paperclip,
  CheckCheck, User, Building2, FileText, ChevronRight, Sparkles,
  Globe, CheckCircle2, MoreVertical, Plus, Instagram,
  Linkedin, MessageCircle, AlertTriangle, ArrowUpRight, BarChart2, Zap,
  RefreshCw, X, Image, SmilePlus, Clock, Wifi, WifiOff, Phone,
  ExternalLink, Copy, ChevronDown, Settings, Bell, Hash, AtSign
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

type ChannelType = "all" | "whatsapp" | "linkedin" | "instagram" | "website" | "email" | "call";

interface WhatsAppConversation {
  id: string;
  leadId?: string;
  customerId?: string;
  clientName: string;
  companyName: string;
  phone: string;
  lastMessage: string;
  channel: "whatsapp";
  time: string;
  unread: boolean;
  avatar: string;
  dealValue: string;
}

interface WhatsAppMessage {
  id: string;
  sender: string;
  isMe: boolean;
  text: string;
  time: string;
  channel: "whatsapp";
  mediaUrl?: string;
  status?: "sent" | "delivered" | "read" | "failed" | "simulated";
}

// Hardcoded conversations for other channels (LinkedIn, Instagram, Email, Website)
const staticConversations = [
  {
    id: "s-c1",
    clientName: "Linda Martinez",
    companyName: "Aegis Systems Group",
    lastMessage: "Re: Quotation QT-2025-05012 for Factory Safety Audit. Specs reviewed.",
    channel: "email" as ChannelType,
    channelHandle: "linda.martinez@aegissystems.com",
    time: "10:42 AM",
    unread: true,
    avatar: "LM",
    email: "linda.martinez@aegissystemsgroup.com",
    phone: "+1 (797) 253-3913",
    dealValue: "$642.5K",
    leadSource: "Website Contact Form",
    messages: [
      { id: "m1", sender: "Linda Martinez", isMe: false, text: "Re: Quotation QT-2025-05012 for Factory Safety Audit. We reviewed the technical specs and need delivery timelines.", time: "10:42 AM", channel: "email" as ChannelType },
      { id: "m2", sender: "You", isMe: true, text: "Thank you Linda! I have attached the updated safety compliance checklist and lead times.", time: "10:48 AM", channel: "email" as ChannelType },
    ]
  },
  {
    id: "s-c3",
    clientName: "Sarah Flores",
    companyName: "Starlight Energy Inc.",
    lastMessage: "LinkedIn InMail: Connected regarding upcoming EMEA expansion project.",
    channel: "linkedin" as ChannelType,
    channelHandle: "linkedin.com/in/sarah-flores-ehs",
    time: "Jul 20",
    unread: false,
    avatar: "SF",
    email: "s.flores@starlightenergy.com",
    phone: "+1 (604) 119-8832",
    dealValue: "$520.0K",
    leadSource: "LinkedIn Lead Capture Form",
    messages: [
      { id: "m1", sender: "Sarah Flores", isMe: false, text: "Connected via LinkedIn. We are expanding our solar assembly plant in Munich and need automated EHS monitoring.", time: "Jul 20, 02:14 PM", channel: "linkedin" as ChannelType },
    ]
  },
  {
    id: "s-c4",
    clientName: "Marco Rossi",
    companyName: "Milano Robotics & Automation",
    lastMessage: "DM: Interested in your modular assembly line robotic arms shown on Instagram.",
    channel: "instagram" as ChannelType,
    channelHandle: "@marcorossi_eng",
    time: "Jul 19",
    unread: true,
    avatar: "MR",
    email: "m.rossi@milanorobotics.it",
    phone: "+39 02 8841 902",
    dealValue: "$210.0K",
    leadSource: "Instagram Business Direct",
    messages: [
      { id: "m1", sender: "Marco Rossi", isMe: false, text: "Interested in your modular assembly line robotic arms shown in your latest reel! Do you export to Italy?", time: "Jul 19, 06:30 PM", channel: "instagram" as ChannelType },
    ]
  },
  {
    id: "s-c5",
    clientName: "David Walker",
    companyName: "Matrix Pharma Systems",
    lastMessage: "Website Form Enquiry: Demo Request for Predictive Maintenance Suite",
    channel: "website" as ChannelType,
    channelHandle: "nexus-crm.com/request-demo",
    time: "Jul 18",
    unread: false,
    avatar: "DW",
    email: "dwalker@matrixpharma.com",
    phone: "+1 (812) 441-9025",
    dealValue: "$195.0K",
    leadSource: "Website Demo Request",
    messages: [
      { id: "m1", sender: "David Walker", isMe: false, text: "Website Demo Request submitted for 50-user license for Matrix Pharma plant #4.", time: "Jul 18, 11:00 AM", channel: "website" as ChannelType },
    ]
  },
];

const quickReplyTemplates = [
  { label: "Send Quote", text: "Thank you for reaching out! I have prepared a quotation for your requirements. Please find the details attached." },
  { label: "Schedule Call", text: "Hi! Would you be available for a 15-minute discovery call? I can schedule it at your convenience." },
  { label: "Follow Up", text: "Following up on my previous message. Please let me know if you have any questions or need additional information." },
  { label: "Catalog", text: "Our technical team has prepared the latest product catalog with specifications. I will send it to you right away." },
  { label: "Thank You", text: "Thank you for your interest in Nexus Automation Systems! A dedicated account executive will reach out to you shortly." },
];

export default function CommunicationCenter() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeView, setActiveView] = useState<"workspace" | "analytics">("workspace");
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [localMessages, setLocalMessages] = useState<WhatsAppMessage[]>([]);
  const [isWaConnected, setIsWaConnected] = useState(true);

  // ─── FETCH WHATSAPP CONVERSATIONS ─────────────────────────
  const { data: whatsappConvs = [], isLoading: loadingConvs, refetch: refetchConvs } = useQuery<WhatsAppConversation[]>({
    queryKey: ["whatsapp-conversations"],
    queryFn: async (): Promise<WhatsAppConversation[]> => {
      const res = await apiClient("/api/v1/whatsapp/conversations");
      return res.json();
    },
    refetchInterval: 5000, // Poll every 5s for new messages
    refetchOnWindowFocus: true,
  });

  // ─── FETCH MESSAGES FOR SELECTED WA CONV ──────────────────
  const selectedWaConv = whatsappConvs.find(c => c.id === selectedConvId);
  const { data: waMessages = [], isLoading: loadingMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: ["whatsapp-messages", selectedConvId],
    queryFn: async (): Promise<WhatsAppMessage[]> => {
      const targetId = selectedWaConv?.leadId || selectedWaConv?.customerId || selectedConvId;
      const res = await apiClient(`/api/v1/whatsapp/messages/${targetId}`);
      return res.json();
    },
    enabled: !!selectedConvId && selectedConvId.startsWith("s-") === false,
    refetchInterval: 3000, // Poll every 3s while viewing thread
    refetchOnWindowFocus: true,
  });

  // Merge API messages with local optimistic updates
  const displayMessages: WhatsAppMessage[] = selectedConvId && !selectedConvId.startsWith("s-")
    ? [...waMessages, ...localMessages]
    : [];

  useEffect(() => {
    setLocalMessages([]);
  }, [selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, localMessages]);

  // ─── SEND WHATSAPP MESSAGE ─────────────────────────────────
  const sendWaMutation = useMutation({
    mutationFn: async (text: string) => {
      const conv = whatsappConvs.find(c => c.id === selectedConvId);
      return await apiClient("/api/v1/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          leadId: conv?.leadId || undefined,
          customerId: conv?.customerId || undefined,
          phone: conv?.phone,
          text
        })
      });
    },
    onMutate: (text) => {
      const optimistic: WhatsAppMessage = {
        id: `opt-${Date.now()}`,
        sender: "You",
        isMe: true,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        channel: "whatsapp",
        status: "sent"
      };
      setLocalMessages(prev => [...prev, optimistic]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    }
  });

  // ─── BUILD UNIFIED CONVERSATION LIST ──────────────────────
  // WhatsApp from API + other channels from static data
  const whatsappItems = whatsappConvs.map(c => ({
    id: c.id,
    clientName: c.clientName,
    companyName: c.companyName,
    lastMessage: c.lastMessage,
    channel: "whatsapp" as ChannelType,
    channelHandle: c.phone,
    time: c.time,
    unread: c.unread,
    avatar: c.avatar,
    email: "",
    phone: c.phone,
    dealValue: c.dealValue,
    leadSource: "WhatsApp Business API",
    messages: []
  }));

  const allConversations = [...whatsappItems, ...staticConversations];

  const filtered = allConversations.filter(c => {
    if (selectedChannel !== "all" && c.channel !== selectedChannel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.clientName.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        (c.channelHandle || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeConv = allConversations.find(c => c.id === selectedConvId) || allConversations[0];
  const activeIsWhatsApp = activeConv?.channel === "whatsapp" && !activeConv.id.startsWith("s-");

  // For static channel messages
  const staticMessages = activeConv?.messages || [];
  const currentMessages = activeIsWhatsApp ? displayMessages : staticMessages;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const text = replyText.trim();
    setReplyText("");
    setShowTemplates(false);

    if (activeIsWhatsApp) {
      sendWaMutation.mutate(text);
    } else {
      // For non-WhatsApp channels, just add optimistically to UI
      activeConv.messages.push({
        id: "m" + Date.now(),
        sender: "You",
        isMe: true,
        text,
        time: "Just now",
        channel: activeConv.channel
      });
    }
  };

  const getChannelBadge = (ch: ChannelType) => {
    switch (ch) {
      case "whatsapp": return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800"><MessageCircle className="w-2.5 h-2.5" /> WhatsApp</span>;
      case "linkedin": return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800"><Linkedin className="w-2.5 h-2.5" /> LinkedIn</span>;
      case "instagram": return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-800"><Instagram className="w-2.5 h-2.5" /> Instagram</span>;
      case "website": return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800"><Globe className="w-2.5 h-2.5" /> Website</span>;
      case "email": return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700"><Mail className="w-2.5 h-2.5" /> Email</span>;
      default: return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600"><MessageSquare className="w-2.5 h-2.5" /> Chat</span>;
    }
  };

  const getChannelIcon = (ch: ChannelType) => {
    switch (ch) {
      case "whatsapp": return <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-white" /></div>;
      case "linkedin": return <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center"><Linkedin className="w-4 h-4 text-white" /></div>;
      case "instagram": return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center"><Instagram className="w-4 h-4 text-white" /></div>;
      case "website": return <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center"><Globe className="w-4 h-4 text-white" /></div>;
      case "email": return <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center"><Mail className="w-4 h-4 text-white" /></div>;
      default: return <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-white" /></div>;
    }
  };

  const getMsgStatusIcon = (status?: string) => {
    if (!status) return null;
    if (status === "read") return <CheckCheck className="w-3 h-3 text-blue-400" />;
    if (status === "delivered") return <CheckCheck className="w-3 h-3 text-white/60" />;
    if (status === "simulated") return <span className="text-[9px] text-white/50 italic">simulated</span>;
    return <CheckCheck className="w-3 h-3 text-white/40" />;
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] flex flex-col">

      {/* ── Header Bar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Omnichannel Communication Hub</h1>
            <p className="text-[11px] text-slate-400">WhatsApp Business · LinkedIn · Instagram · Email · Website Webhooks</p>
          </div>
          {/* WhatsApp connection status */}
          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${isWaConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {isWaConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isWaConnected ? "WhatsApp Live" : "WhatsApp Offline"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchConvs()}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title="Refresh conversations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveView("workspace")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === "workspace" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveView("analytics")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === "analytics" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* ── ANALYTICS VIEW ── */}
      {activeView === "analytics" && (
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "WhatsApp Response Time", value: "4.2 mins", sub: "98.2% delivery rate", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <MessageCircle className="w-5 h-5 text-emerald-600" /> },
              { label: "LinkedIn Conversions", value: "34 Leads", sub: "SAR 1.8M open pipeline", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: <Linkedin className="w-5 h-5 text-blue-600" /> },
              { label: "Instagram Inquiries", value: "19 DMs", sub: "12 converted to leads", color: "text-pink-600", bg: "bg-pink-50 border-pink-200", icon: <Instagram className="w-5 h-5 text-pink-600" /> },
              { label: "Website Form Ingestion", value: "128 Forms", sub: "Auto-assigned via Round Robin", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", icon: <Globe className="w-5 h-5 text-indigo-600" /> },
            ].map(item => (
              <div key={item.label} className={`bg-white p-5 rounded-2xl border ${item.bg} shadow-sm space-y-2`}>
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  {item.icon}
                </div>
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className={`text-xs font-semibold ${item.color}`}>{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-indigo-600" /> Lead Attribution & Revenue by Channel</h3>
            <div className="space-y-3">
              {[
                { channel: "Website Inquiries & Demo Requests", leads: 128, revenue: "SAR 14.2M", share: 42, color: "bg-indigo-600" },
                { channel: "LinkedIn Lead Capture & InMail", leads: 84, revenue: "SAR 9.8M", share: 29, color: "bg-blue-600" },
                { channel: "WhatsApp Business API", leads: whatsappConvs.length || 62, revenue: "SAR 6.5M", share: 19, color: "bg-emerald-600" },
                { channel: "Instagram Business Direct", leads: 31, revenue: "SAR 3.2M", share: 10, color: "bg-pink-600" },
              ].map(item => (
                <div key={item.channel} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{item.channel}</span>
                    <span className="font-extrabold text-indigo-600">{item.revenue}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full rounded-full transition-all`} style={{ width: `${item.share}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{item.leads} Leads Captured</span>
                    <span>{item.share}% Total Attribution</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Config Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base">WhatsApp Business API Connected</h3>
              <p className="text-sm text-white/80 mt-1">Webhook verified · Meta Cloud API v18.0 · Phone ID: {import.meta.env.VITE_WA_PHONE_ID || "Configured in .env"}</p>
            </div>
            <button onClick={() => navigate("/settings")} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configure
            </button>
          </div>
        </div>
      )}

      {/* ── OMNICHANNEL WORKSPACE ── */}
      {activeView === "workspace" && (
        <div className="flex-1 flex overflow-hidden">

          {/* ── LEFT PANE: Conversation List ── */}
          <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">

            {/* Channel Filters */}
            <div className="p-2.5 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar bg-slate-50/70">
              {[
                { key: "all", label: "All" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "linkedin", label: "LinkedIn" },
                { key: "instagram", label: "Instagram" },
                { key: "website", label: "Website" },
                { key: "email", label: "Email" },
              ].map(ch => (
                <button
                  key={ch.key}
                  onClick={() => setSelectedChannel(ch.key as ChannelType)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${selectedChannel === ch.key ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {ch.label}
                  {ch.key === "whatsapp" && whatsappConvs.length > 0 && (
                    <span className="ml-1 px-1 py-0.5 bg-emerald-500 text-white rounded-full text-[9px]">{whatsappConvs.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="p-2.5 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingConvs && whatsappItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Loading conversations...
                </div>
              )}
              {filtered.length === 0 && !loadingConvs && (
                <div className="p-6 text-center text-xs text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No conversations found
                </div>
              )}
              {filtered.map(conv => {
                const isSelected = conv.id === activeConv?.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? "bg-indigo-50 border-l-[3px] border-indigo-600" : "border-l-[3px] border-transparent"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 font-extrabold text-[11px] flex items-center justify-center text-slate-600">
                            {conv.avatar}
                          </div>
                          {/* Channel indicator dot */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${conv.channel === "whatsapp" ? "bg-emerald-500" : conv.channel === "linkedin" ? "bg-blue-600" : conv.channel === "instagram" ? "bg-pink-500" : conv.channel === "email" ? "bg-slate-500" : "bg-indigo-600"}`}>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight truncate">{conv.clientName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{conv.companyName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">{conv.time}</span>
                        {conv.unread && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate pl-11">{conv.lastMessage}</p>
                  </div>
                );
              })}
            </div>

          </div>

          {/* ── CENTER PANE: Message Thread ── */}
          {activeConv ? (
            <div className="flex-1 flex flex-col h-full border-r border-slate-200 min-w-0">

              {/* Thread Header */}
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  {getChannelIcon(activeConv.channel)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{activeConv.clientName}</h2>
                      {getChannelBadge(activeConv.channel)}
                    </div>
                    <p className="text-[11px] text-slate-400">{activeConv.companyName} · {activeConv.channelHandle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeIsWhatsApp && (
                    <a
                      href={`https://wa.me/${activeConv.phone?.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Open in WhatsApp
                    </a>
                  )}
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* WhatsApp Info Banner */}
              {activeIsWhatsApp && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Messages sent via WhatsApp Business API. Replies are logged to the lead's activity timeline automatically.</span>
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>

                {loadingMessages && activeIsWhatsApp && (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                )}

                {/* Date separator */}
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 font-medium bg-white px-2 py-0.5 rounded-full border border-slate-200">Today</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {currentMessages.length === 0 && !loadingMessages && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <MessageCircle className="w-10 h-10 mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs mt-1">Send the first message to start the conversation</p>
                  </div>
                )}

                {currentMessages.map((msg: any) => (
                  <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                    {!msg.isMe && (
                      <span className="text-[10px] text-slate-400 mb-1 ml-1">{msg.sender}</span>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-xs max-w-[75%] space-y-1.5 shadow-sm ${msg.isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"}`}>
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                      {msg.mediaUrl && (
                        <div className={`p-2 rounded-lg flex items-center gap-2 text-[11px] font-bold ${msg.isMe ? "bg-white/15" : "bg-slate-100 text-slate-600"}`}>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{msg.mediaUrl}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-slate-400">{msg.time}</span>
                      {msg.isMe && getMsgStatusIcon(msg.status)}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Templates Bar */}
              {showTemplates && (
                <div className="bg-white border-t border-slate-200 p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Reply Templates</span>
                    <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                    {quickReplyTemplates.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setReplyText(t.text); setShowTemplates(false); }}
                        className="text-left px-3 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[11px] border border-slate-200 transition-colors"
                      >
                        <span className="font-bold mr-2">{t.label}:</span>
                        <span className="text-slate-500">{t.text.slice(0, 60)}...</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reply Input */}
              <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(prev => !prev)}
                    title="Quick reply templates"
                    className={`p-2 rounded-lg transition-colors ${showTemplates ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-400"}`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 gap-2 focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 transition-all">
                    <input
                      type="text"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={activeIsWhatsApp ? "Send WhatsApp message..." : `Reply via ${activeConv?.channel?.toUpperCase() || ""}...`}
                      className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
                    />
                    {activeIsWhatsApp && (
                      <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sendWaMutation.isPending}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                  >
                    {sendWaMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                {activeIsWhatsApp && (
                  <p className="text-[10px] text-slate-400 mt-1.5 ml-2">
                    Messages are delivered via Meta WhatsApp Business API and logged to activity timeline
                  </p>
                )}
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium">Select a conversation</p>
              </div>
            </div>
          )}

          {/* ── RIGHT PANE: Customer Context ── */}
          {activeConv && (
            <div className="hidden lg:flex flex-col w-72 bg-white overflow-y-auto shrink-0 border-l border-slate-200">
              {/* Contact Header */}
              <div className="p-5 border-b border-slate-100 space-y-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-extrabold text-base flex items-center justify-center mx-auto">
                  {activeConv.avatar}
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-extrabold text-slate-900">{activeConv.clientName}</h3>
                  <p className="text-[11px] text-slate-500">{activeConv.companyName}</p>
                  <p className="text-xs font-extrabold text-indigo-600 mt-1">{activeConv.dealValue} Pipeline</p>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Details</p>
                {[
                  { icon: <AtSign className="w-3 h-3" />, label: "Email", value: activeConv.email },
                  { icon: <Phone className="w-3 h-3" />, label: "Phone", value: activeConv.phone },
                  { icon: <Hash className="w-3 h-3" />, label: "Source", value: activeConv.leadSource },
                  { icon: <Globe className="w-3 h-3" />, label: "Handle", value: activeConv.channelHandle },
                ].map(item => item.value ? (
                  <div key={item.label} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400">{item.label}</p>
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{item.value}</p>
                    </div>
                  </div>
                ) : null)}
              </div>

              {/* Quick Actions */}
              <div className="p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</p>
                <button onClick={() => navigate("/customers")} className="w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-xl text-left flex items-center justify-between transition-colors">
                  <span>Open Customer 360</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => navigate("/quotes/new")} className="w-full px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold rounded-xl text-left flex items-center justify-between transition-colors">
                  <span>Generate Quotation</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {activeIsWhatsApp && (
                  <button className="w-full px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-xl text-left flex items-center justify-between transition-colors">
                    <span>Send Product Catalog</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
