import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, Target, DollarSign, Users, Inbox, Trello, FileText,
  Calendar, PhoneCall, Video, MapPin, CheckSquare, Sparkles, Plus,
  ChevronRight, ArrowUpRight, Zap, Shield, User, MessageSquare, Clock, AlertCircle,
  RefreshCw, CheckCircle, ExternalLink, Globe, AlertTriangle
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrencyCompact } from "../utils/currency";

export default function RepPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "customers" | "opportunities" | "coaching">("overview");

  // User Greeting & Role Info
  const userFirstName = user?.name ? user.name.split(" ")[0] : "Sales Rep";
  const currentHour = new Date().getHours();
  const timeOfDay = currentHour < 12 ? "morning" : currentHour < 18 ? "afternoon" : "evening";
  const greeting = `Good ${timeOfDay}, ${userFirstName}`;
  const repName = user?.name || "Sales Representative";
  const repRole = user?.role === "sales_rep" ? "Enterprise Sales Executive" : (user?.role || "Sales Representative");
  const territory = user?.territory || "Assigned Territory";

  // 1. Leads Query (My Leads)
  const { data: leads = [], isLoading: isLeadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["rep-leads", user?.id],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/leads");
      return Array.isArray(res) ? res : (res as any)?.data || [];
    }
  });

  const myLeads = leads.filter((l: any) => !user?.id || l.assignedToId === user.id);
  const newLeadsCount = myLeads.filter((l: any) => (l.status || "").toLowerCase() === "new").length;

  // Single Most Recent Inbound Lead
  const newestInbound = myLeads.length > 0
    ? [...myLeads].sort((a, b) => new Date(b.createdAt || b.lastInboundAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.lastInboundAt || a.updatedAt || 0).getTime())[0]
    : null;

  // 2. Today's Operational Dashboard Data (Follow-ups & Tasks)
  const { data: todayData } = useQuery({
    queryKey: ["rep-today-data", user?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>("/dashboard/today");
        return res || { tasks: [], followUpsNeeded: [], newLeadsToday: [] };
      } catch {
        return { tasks: [], followUpsNeeded: [], newLeadsToday: [] };
      }
    }
  });

  const followUpsDueCount = (todayData?.followUpsNeeded?.length || 0) + (todayData?.tasks?.length || 0);

  // 3. Activities Query (Meetings Today & Overdue)
  const { data: activities = [] } = useQuery({
    queryKey: ["rep-activities", user?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>("/activities");
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    }
  });

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

  const myActivities = (activities || []).filter((a: any) => !user?.id || a.createdById === user.id || a.assignedToId === user.id);

  const meetingsToday = myActivities.filter((a: any) => {
    const actTime = new Date(a.scheduledAt || a.dueDate || a.createdAt || 0);
    const isToday = actTime >= startOfToday && actTime <= endOfToday;
    const typeStr = (a.type || "").toLowerCase();
    const isMeetingType = typeStr === "meeting" || typeStr === "call" || typeStr === "demo";
    return isToday && isMeetingType;
  });

  const overdueCount = myActivities.filter((a: any) => {
    if (a.isCompleted) return false;
    const due = new Date(a.dueDate || a.scheduledAt || 0);
    return due.getTime() > 0 && due < new Date();
  }).length + (todayData?.followUpsNeeded?.length || 0);

  // 4. Deals & Pipeline Query (Full 8 Stages Breakdown)
  const { data: deals = [] } = useQuery({
    queryKey: ["rep-deals", user?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>("/pipeline/deals");
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    }
  });

  const myDeals = deals.filter((d: any) => !user?.id || d.ownerId === user.id);

  const PIPELINE_STAGES = [
    "New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost"
  ];

  const pipelineStageSummary = PIPELINE_STAGES.map(stageName => {
    const stageDeals = myDeals.filter((d: any) => {
      const sName = d.stage?.name || (typeof d.stage === "string" ? d.stage : "");
      return sName.toLowerCase() === stageName.toLowerCase();
    });
    const stageAmount = stageDeals.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
    return {
      stage: stageName,
      count: stageDeals.length,
      amount: stageAmount
    };
  });

  const activePipelineValue = myDeals
    .filter((d: any) => {
      const sName = (d.stage?.name || (typeof d.stage === "string" ? d.stage : "")).toLowerCase();
      return sName !== "won" && sName !== "lost" && sName !== "closed won" && sName !== "closed lost";
    })
    .reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);

  // 5. Customers Portfolio Query
  const { data: customers = [] } = useQuery({
    queryKey: ["rep-customers"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>("/customers");
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    }
  });

  // 6. Coaching Notes Query
  const { data: coachingNotes = [] } = useQuery({
    queryKey: ["rep-coaching-notes"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>("/coaching-notes");
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    }
  });

  // Helper for source channel icons & styles
  const getChannelBadge = (source: string) => {
    const s = (source || "").toLowerCase();
    if (s.includes("whatsapp")) return { icon: MessageSquare, label: "WhatsApp", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (s.includes("email")) return { icon: Inbox, label: "Email", color: "bg-blue-50 text-blue-700 border-blue-200" };
    if (s.includes("web")) return { icon: Globe, label: "Website", color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (s.includes("call") || s.includes("phone")) return { icon: PhoneCall, label: "Cold Call", color: "bg-amber-50 text-amber-700 border-amber-200" };
    if (s.includes("facebook") || s.includes("fb")) return { icon: Users, label: "Facebook", color: "bg-blue-100 text-blue-800 border-blue-300" };
    if (s.includes("instagram") || s.includes("ig")) return { icon: Sparkles, label: "Instagram", color: "bg-pink-50 text-pink-700 border-pink-200" };
    return { icon: Zap, label: source || "Inbound", color: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  // Relative time formatter
  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "Recently";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Greeting Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center font-black text-xl text-amber-300 shadow-inner">
            {userFirstName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{greeting}</h1>
            <p className="text-xs text-indigo-200 mt-1">Here's what needs you today. · {repRole} ({territory})</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur p-3.5 rounded-xl border border-white/10">
          <div className="text-right">
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Active Pipeline</p>
            <p className="text-lg font-black text-amber-300">{formatCurrencyCompact(activePipelineValue)}</p>
            <p className="text-[11px] text-slate-300">{myDeals.length} active opportunities</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Leaderboard Removed) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { key: "overview", label: "Overview", icon: Zap },
          { key: "leads", label: "My Assigned Leads", icon: Inbox, badge: myLeads.length },
          { key: "customers", label: "My Account Portfolio", icon: Users, badge: customers.length },
          { key: "opportunities", label: "My Pipeline", icon: Trello, badge: myDeals.length },
          { key: "coaching", label: "Manager Coaching", icon: Sparkles, badge: coachingNotes.length },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-primary text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* Row of 4 Real Stat Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. New Leads */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Leads</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Inbox className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{newLeadsCount}</p>
              <p className="text-xs font-semibold text-blue-600">Assigned to you with status 'New'</p>
            </div>

            {/* 2. Follow-ups Due */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-ups Due</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <CheckSquare className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{followUpsDueCount}</p>
              <p className="text-xs font-semibold text-indigo-600">Pending tasks & SLA follow-ups</p>
            </div>

            {/* 3. Meetings Today */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meetings Today</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{meetingsToday.length}</p>
              <p className="text-xs font-semibold text-amber-600">Scheduled calls & demos today</p>
            </div>

            {/* 4. Overdue */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertCircle className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-rose-600">{overdueCount}</p>
              <p className="text-xs font-semibold text-rose-600">Tasks or stale leads requiring action</p>
            </div>

          </div>

          {/* Newest Inbound Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Newest Inbound Requirement
              </h2>
              <Link to="/sales-queue" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                See all in Lead Inbox →
              </Link>
            </div>

            {newestInbound ? (
              (() => {
                const channel = getChannelBadge(newestInbound.source);
                const ChannelIcon = channel.icon;
                const contactName = `${newestInbound.firstName || ""} ${newestInbound.lastName || ""}`.trim() || "Inbound Lead";
                const messageText = newestInbound.body || newestInbound.subject || newestInbound.rawPayload || "New lead inquiry received.";
                const budget = newestInbound.budgetRange || (newestInbound.budget ? formatCurrencyCompact(newestInbound.budget) : "Standard Budget");

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-all space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${channel.color}`}>
                          <ChannelIcon className="w-3.5 h-3.5" />
                          {channel.label}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {getRelativeTime(newestInbound.createdAt || newestInbound.lastInboundAt)}
                        </span>
                      </div>

                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                        Budget: {budget}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900">
                          {newestInbound.company || "Individual Account"} <span className="font-semibold text-slate-500">({contactName})</span>
                        </h3>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Status: {newestInbound.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 bg-white p-3 rounded-xl border border-slate-200 line-clamp-2 italic">
                        "{messageText}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Email: {newestInbound.email || "No email"} · Phone: {newestInbound.phone || "No phone"}
                      </span>
                      <button
                        onClick={() => navigate(`/leads/${newestInbound.id}`)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        Open Lead <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No new inbound leads assigned</p>
                <p className="text-xs text-slate-500">New leads ingested from WhatsApp, Email, or Web forms will appear here.</p>
              </div>
            )}
          </div>

          {/* Two-Column Row: Today's Activities & My Pipeline Stage Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left Column: Today (Scheduled Meetings & Tasks) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" /> Today's Scheduled Activities ({meetingsToday.length})
                  </h3>
                  <Link to="/activities" className="text-xs font-bold text-indigo-600 hover:underline">
                    View Calendar →
                  </Link>
                </div>

                {meetingsToday.length > 0 ? (
                  <div className="space-y-3">
                    {meetingsToday.map((act: any) => (
                      <div key={act.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            {act.type === "call" ? <PhoneCall className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{act.subject || act.description || "Scheduled Activity"}</p>
                            <p className="text-[11px] text-slate-500">
                              {act.scheduledAt ? new Date(act.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md capitalize">
                          {act.status || "Scheduled"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-600">No meetings or calls scheduled for today</p>
                    <p className="text-[11px] text-slate-400 mt-1">Use Quick Actions to schedule a new call or demo.</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <button onClick={() => navigate("/activities")} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                  + Log Call / Activity
                </button>
              </div>
            </div>

            {/* Right Column: My Pipeline (Full 8 Stages Count & Value) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Trello className="w-4 h-4 text-purple-600" /> My Pipeline Stage Breakdown
                </h3>
                <Link to="/pipeline" className="text-xs font-bold text-purple-600 hover:underline">
                  Open Kanban →
                </Link>
              </div>

              <div className="space-y-2.5">
                {pipelineStageSummary.map((st) => (
                  <div key={st.stage} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        st.stage === "Won" ? "bg-emerald-500" : st.stage === "Lost" ? "bg-rose-400" : "bg-indigo-500"
                      }`} />
                      <span className="text-xs font-bold text-slate-800">{st.stage}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900">{formatCurrencyCompact(st.amount)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 min-w-[24px] text-center">
                        {st.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* LEADS TAB (Live Backend Data) */}
      {activeTab === "leads" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-600" /> My Assigned Leads ({myLeads.length})
            </h3>
            <button onClick={() => navigate("/leads/new")} className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
              + Create Lead
            </button>
          </div>

          {myLeads.length > 0 ? (
            <div className="space-y-3">
              {myLeads.map((l: any) => (
                <div key={l.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {l.firstName} {l.lastName} — <span className="text-indigo-600">{l.company || "Individual Account"}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Status: <span className="font-semibold text-slate-700">{l.status}</span> · Source: <span className="font-semibold text-slate-700">{l.source || "N/A"}</span> · Score: <span className="font-bold text-emerald-600">{l.leadScore || 50}/100</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-extrabold text-slate-900">{l.budgetRange || "Standard Budget"}</span>
                    <button onClick={() => navigate(`/leads/${l.id}`)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold">
                      View Lead →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">No leads currently assigned to you</p>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMERS TAB (Live Backend Data) */}
      {activeTab === "customers" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> Account Portfolio ({customers.length})
            </h3>
            <button onClick={() => navigate("/customers")} className="text-xs font-bold text-purple-600 hover:underline">
              Open Customer 360 Hub →
            </button>
          </div>

          {customers.length > 0 ? (
            <div className="space-y-3">
              {customers.map((c: any) => (
                <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.primaryContactName || c.email || "Active Account"}</p>
                  </div>
                  <button onClick={() => navigate("/customers")} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">
                    Open 360 →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">No customer accounts registered yet</p>
            </div>
          )}
        </div>
      )}

      {/* OPPORTUNITIES TAB (Live Backend Data) */}
      {activeTab === "opportunities" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Trello className="w-5 h-5 text-indigo-600" /> My Opportunities ({myDeals.length})
            </h3>
            <button onClick={() => navigate("/pipeline")} className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
              Open Pipeline Kanban →
            </button>
          </div>

          {myDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myDeals.map((d: any) => (
                <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded border border-indigo-100">
                    {d.stage?.name || typeof d.stage === "string" ? d.stage : "Opportunity"}
                  </span>
                  <p className="text-sm font-bold text-slate-900">{d.name}</p>
                  <p className="text-xs font-extrabold text-emerald-600">{formatCurrencyCompact(parseFloat(d.amount) || 0)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">No active opportunities in your pipeline</p>
            </div>
          )}
        </div>
      )}

      {/* COACHING TAB (Live Backend Data) */}
      {activeTab === "coaching" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" /> Manager Coaching Notes
          </h3>

          {coachingNotes.length > 0 ? (
            <div className="space-y-3">
              {coachingNotes.map((n: any) => (
                <div key={n.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">{n.author?.name || "Sales Manager"}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Coaching</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.content || n.text}</p>
                  <p className="text-[10px] text-slate-400 pt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">No coaching notes from your manager yet</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
