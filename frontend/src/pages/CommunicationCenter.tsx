import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail, MessageSquare, PhoneCall, Send, Search, Filter, Paperclip,
  CheckCheck, Clock, User, Building2, FileText, ChevronRight, Sparkles,
  RefreshCw, Globe, CheckCircle2, Shield, MoreVertical, Plus, Instagram,
  Linkedin, MessageCircle, AlertTriangle, ArrowUpRight, BarChart2, Zap
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrencyCompact } from "../utils/currency";

type ChannelType = "all" | "whatsapp" | "linkedin" | "instagram" | "website" | "email" | "call";

interface OmnichannelConversation {
  id: string;
  clientName: string;
  companyName: string;
  lastMessage: string;
  channel: ChannelType;
  channelHandle?: string;
  time: string;
  unread: boolean;
  avatar: string;
  email: string;
  phone: string;
  dealValue: string;
  leadSource: string;
  messages: Array<{
    id: string;
    sender: string;
    isMe: boolean;
    text: string;
    time: string;
    channel: ChannelType;
    mediaUrl?: string;
    mediaType?: "image" | "pdf";
  }>;
}

export default function CommunicationCenter() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [activeView, setActiveView] = useState<"workspace" | "analytics">("workspace");
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string>("c1");
  const [replyText, setReplyText] = useState("");

  const quickReplyTemplates = [
    "Thank you for reaching out! Here is the requested product quotation PDF.",
    "Our technical team has reviewed your cleanroom specification requirements.",
    "Hi there! Would you be available for a 15-minute technical discovery call tomorrow?",
    "We have received your website inquiry and assigned a dedicated account director."
  ];

  const conversations: OmnichannelConversation[] = [
    {
      id: "c1",
      clientName: "Linda Martinez",
      companyName: "Aegis Systems Group",
      lastMessage: "Re: Quotation QT-2025-05012 for Factory Safety Audit. Specs reviewed.",
      channel: "email",
      channelHandle: "linda.martinez@aegissystems.com",
      time: "10:42 AM",
      unread: true,
      avatar: "LM",
      email: "linda.martinez@aegissystemsgroup.com",
      phone: "+1 (797) 253-3913",
      dealValue: "$642.5K",
      leadSource: "Website Contact Form",
      messages: [
        { id: "m1", sender: "Linda Martinez", isMe: false, text: "Re: Quotation QT-2025-05012 for Factory Safety Audit. We reviewed the technical specs and need delivery timelines.", time: "10:42 AM", channel: "email" },
        { id: "m2", sender: "You (Sophia Martinez)", isMe: true, text: "Thank you Linda! I have attached the updated safety compliance checklist and lead times.", time: "10:48 AM", channel: "email" },
      ]
    },
    {
      id: "c2",
      clientName: "Christopher Lee",
      companyName: "Apex Pharmaceuticals",
      lastMessage: "Hi! Can you send the updated cleanroom automation catalog via WhatsApp?",
      channel: "whatsapp",
      channelHandle: "+1 (812) 441-9021",
      time: "09:15 AM",
      unread: false,
      avatar: "CL",
      email: "clee@apexpharma.com",
      phone: "+1 (812) 441-9021",
      dealValue: "$380.0K",
      leadSource: "WhatsApp Business API",
      messages: [
        { id: "m1", sender: "Christopher Lee", isMe: false, text: "Hi! Can you send the updated cleanroom automation catalog via WhatsApp?", time: "09:15 AM", channel: "whatsapp" },
        { id: "m2", sender: "You (Sophia Martinez)", isMe: true, text: "Sure Christopher! Sending the PDF catalog right now.", time: "09:18 AM", channel: "whatsapp", mediaUrl: "Cleanroom_Automation_Catalog_2026.pdf", mediaType: "pdf" },
      ]
    },
    {
      id: "c3",
      clientName: "Sarah Flores",
      companyName: "Starlight Energy Inc.",
      lastMessage: "LinkedIn InMail: Connected regarding upcoming EMEA expansion project.",
      channel: "linkedin",
      channelHandle: "linkedin.com/in/sarah-flores-ehs",
      time: "Jul 20",
      unread: false,
      avatar: "SF",
      email: "s.flores@starlightenergy.com",
      phone: "+1 (604) 119-8832",
      dealValue: "$520.0K",
      leadSource: "LinkedIn Lead Capture Form",
      messages: [
        { id: "m1", sender: "Sarah Flores", isMe: false, text: "Connected via LinkedIn. We are expanding our solar assembly plant in Munich and need automated EHS monitoring.", time: "Jul 20, 02:14 PM", channel: "linkedin" },
      ]
    },
    {
      id: "c4",
      clientName: "Marco Rossi",
      companyName: "Milano Robotics & Automation",
      lastMessage: "DM: Interested in your modular assembly line robotic arms shown on Instagram.",
      channel: "instagram",
      channelHandle: "@marcorossi_eng",
      time: "Jul 19",
      unread: true,
      avatar: "MR",
      email: "m.rossi@milanorobotics.it",
      phone: "+39 02 8841 902",
      dealValue: "$210.0K",
      leadSource: "Instagram Business Direct",
      messages: [
        { id: "m1", sender: "Marco Rossi", isMe: false, text: "Interested in your modular assembly line robotic arms shown in your latest reel! Do you export to Italy?", time: "Jul 19, 06:30 PM", channel: "instagram" },
      ]
    },
    {
      id: "c5",
      clientName: "David Walker",
      companyName: "Matrix Pharma Systems",
      lastMessage: "Website Form Enquiry: Demo Request for Predictive Maintenance Suite",
      channel: "website",
      channelHandle: "https://nexus-crm.com/request-demo",
      time: "Jul 18",
      unread: false,
      avatar: "DW",
      email: "dwalker@matrixpharma.com",
      phone: "+1 (812) 441-9025",
      dealValue: "$195.0K",
      leadSource: "Website Demo Request",
      messages: [
        { id: "m1", sender: "David Walker", isMe: false, text: "Website Demo Request submitted for 50-user license for Matrix Pharma plant #4.", time: "Jul 18, 11:00 AM", channel: "website" },
      ]
    },
  ];

  const filtered = conversations.filter(c => {
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

  const activeConv = conversations.find(c => c.id === selectedConvId) || conversations[0];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    activeConv.messages.push({
      id: "m" + Date.now(),
      sender: "You (Sophia Martinez)",
      isMe: true,
      text: replyText,
      time: "Just now",
      channel: activeConv.channel
    });

    setReplyText("");
  };

  const getChannelBadge = (ch: ChannelType) => {
    switch (ch) {
      case "whatsapp": return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"><MessageCircle className="w-3 h-3" /> WhatsApp</span>;
      case "linkedin": return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800"><Linkedin className="w-3 h-3" /> LinkedIn</span>;
      case "instagram": return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800"><Instagram className="w-3 h-3" /> Instagram</span>;
      case "website": return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800"><Globe className="w-3 h-3" /> Website</span>;
      case "email": return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800"><Mail className="w-3 h-3" /> Email</span>;
      default: return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700"><MessageSquare className="w-3 h-3" /> Chat</span>;
    }
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] flex flex-col">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" /> Unified Omnichannel Communication Hub
          </h1>
          <p className="text-xs text-slate-500">Single customer inbox integrating WhatsApp Business, LinkedIn, Instagram & Website Webhooks</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveView("workspace")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === "workspace" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Omnichannel Workspace
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === "analytics" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Channel Analytics
          </button>
        </div>
      </div>

      {/* ANALYTICS VIEW */}
      {activeView === "analytics" && (
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Response Time</p>
              <p className="text-2xl font-black text-emerald-600">4.2 mins</p>
              <p className="text-xs text-emerald-600 font-semibold">98.2% delivery rate</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">LinkedIn Lead Conversions</p>
              <p className="text-2xl font-black text-blue-600">34 Leads</p>
              <p className="text-xs text-blue-600 font-semibold">SAR 1.8M open pipeline</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Instagram DMs & Comments</p>
              <p className="text-2xl font-black text-pink-600">19 Inquiries</p>
              <p className="text-xs text-pink-600 font-semibold">12 converted to qualified leads</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Website Webhook Ingestion</p>
              <p className="text-2xl font-black text-indigo-600">128 Forms</p>
              <p className="text-xs text-indigo-600 font-semibold">Auto-assigned via Round Robin</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Lead Attribution & Revenue by Channel</h3>
            <div className="space-y-3">
              {[
                { channel: "Website Inquiries & Demo Requests", leads: 128, revenue: "SAR 14.2M", share: 42, color: "bg-indigo-600" },
                { channel: "LinkedIn Lead Capture & InMail", leads: 84, revenue: "SAR 9.8M", share: 29, color: "bg-blue-600" },
                { channel: "WhatsApp Business API", leads: 62, revenue: "SAR 6.5M", share: 19, color: "bg-emerald-600" },
                { channel: "Instagram Business Direct", leads: 31, revenue: "SAR 3.2M", share: 10, color: "bg-pink-600" },
              ].map(item => (
                <div key={item.channel} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{item.channel}</span>
                    <span className="font-extrabold text-indigo-600">{item.revenue}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.share}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{item.leads} Leads Captured</span>
                    <span>{item.share}% Total Attribution</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OMNICHANNEL WORKSPACE 3-PANE VIEW */}
      {activeView === "workspace" && (
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANE: Channel Filter & Conversation List (30%) */}
          <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
            
            {/* Channel Filters */}
            <div className="p-3 border-b border-slate-100 flex gap-1 overflow-x-auto no-scrollbar bg-slate-50">
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedChannel === ch.key ? "bg-indigo-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by phone, email, handle..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filtered.map(conv => {
                const isSelected = conv.id === activeConv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors space-y-1.5 ${
                      isSelected ? "bg-indigo-50/70 border-l-4 border-indigo-600" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-200 font-extrabold text-[11px] flex items-center justify-center text-slate-700">
                          {conv.avatar}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">{conv.clientName}</p>
                          <p className="text-[10px] text-slate-400">{conv.companyName}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{conv.time}</span>
                    </div>

                    <p className="text-xs text-slate-600 truncate">{conv.lastMessage}</p>

                    <div className="flex items-center justify-between pt-1">
                      {getChannelBadge(conv.channel)}
                      {conv.unread && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* CENTER PANE: Interactive Thread View (45%) */}
          <div className="flex-1 bg-slate-50 flex flex-col h-full border-r border-slate-200 min-w-0">
            
            {/* Thread Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                  {activeConv.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{activeConv.clientName}</h2>
                    {getChannelBadge(activeConv.channel)}
                  </div>
                  <p className="text-xs text-slate-500">{activeConv.companyName} · {activeConv.channelHandle}</p>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeConv.messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                  <div className={`p-3.5 rounded-2xl text-xs max-w-[80%] space-y-2 shadow-2xs ${
                    msg.isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                    {msg.mediaUrl && (
                      <div className="p-2 bg-black/10 rounded-lg flex items-center gap-2 text-[11px] font-bold">
                        <FileText className="w-4 h-4" /> {msg.mediaUrl}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Quick Templates Bar */}
            <div className="p-2 bg-white border-t border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar">
              {quickReplyTemplates.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => setReplyText(t)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors"
                >
                  {t.slice(0, 35)}...
                </button>
              ))}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply via ${activeConv.channel.toUpperCase()}...`}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button type="submit" className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>

          {/* RIGHT PANE: Customer Context Card (25%) */}
          <div className="hidden lg:block w-80 bg-white p-5 space-y-6 overflow-y-auto shrink-0 border-l border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Context</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">{activeConv.companyName}</h3>
              <p className="text-xs font-extrabold text-indigo-600 mt-0.5">{activeConv.dealValue} Open Pipeline</p>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Contact Person</span>
                <span className="font-bold text-slate-800">{activeConv.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lead Source</span>
                <span className="font-bold text-slate-800">{activeConv.leadSource}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone</span>
                <span className="font-bold text-slate-800">{activeConv.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Handle / Link</span>
                <span className="font-bold text-indigo-600 truncate max-w-[140px]">{activeConv.channelHandle}</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
              <button onClick={() => navigate("/customers")} className="w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl text-left flex items-center justify-between">
                <span>Open Customer 360 Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate("/quotes/new")} className="w-full px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl text-left flex items-center justify-between">
                <span>Generate Quotation</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
