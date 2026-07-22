import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Calendar as CalendarIcon, CheckSquare, PhoneCall, Video, MapPin, Clock,
  Plus, Search, Filter, AlertCircle, CheckCircle2, ChevronRight, User,
  Building2, Users, FileText, ArrowUpRight, Zap, RefreshCw, X, Shield
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrencyCompact } from "../utils/currency";

type ActivityTab = "today" | "tasks" | "meetings" | "calls" | "visits" | "calendar";

export default function ActivitiesHub() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActivityTab>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("All");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<"task" | "meeting" | "call" | "visit">("task");

  // Form state
  const [form, setForm] = useState({
    title: "",
    type: "task",
    priority: "High",
    clientName: "Aegis Systems Group",
    dueDate: new Date().toISOString().split("T")[0],
    time: "10:00 AM",
    notes: ""
  });

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: ["activitiesHub"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/dashboard/today");
      if (!res.ok) return [];
      const d = await res.json();
      return d.tasks || [];
    },
    enabled: !!token
  });

  const demoMeetings = [
    { id: "m1", title: "Site Survey & Safety Audit — Aegis Systems", time: "10:00 AM", duration: "60 min", contact: "Linda Martinez", company: "Aegis Systems Group", type: "in-person", location: "Plant #4, Paris", status: "Upcoming" },
    { id: "m2", title: "Q3 Commercial Pricing Review — Apex Pharma", time: "01:30 PM", duration: "45 min", contact: "Christopher Lee", company: "Apex Pharmaceuticals", type: "video", location: "MS Teams Video Enclave", status: "Upcoming" },
    { id: "m3", title: "Technical Demo: Predictive Maintenance Suite", time: "04:00 PM", duration: "30 min", contact: "David Walker", company: "Apex Pharmaceuticals", type: "video", location: "MS Teams Video Enclave", status: "Upcoming" },
  ];

  const demoSiteVisits = [
    { id: "v1", company: "Aegis Systems Group", location: "Plant #4 - 3667 Business Ave, Paris", purpose: "Factory Layout Survey & EHS Safety Check", inspector: "Sophia Martinez", date: "Today, 10:00 AM", checklist: ["Check Emergency Exits", "Inspect Assembly Line #2", "Review Gas Sensors"], status: "In Progress" },
    { id: "v2", company: "Apex Pharmaceuticals", location: "Facility 2B - Frankfurt, Germany", purpose: "Cleanroom Automation Assessment", inspector: "Liam Carter", date: "Tomorrow, 02:00 PM", checklist: ["HEPA Air Quality Check", "HVAC Sensor Audit"], status: "Scheduled" },
  ];

  const demoCalls = [
    { id: "c1", contact: "Linda Martinez", company: "Aegis Systems Group", phone: "+1 (797) 253-3913", direction: "Outbound", duration: "14m 20s", outcome: "Connected - High Interest", followUp: "Tomorrow", time: "11:15 AM" },
    { id: "c2", contact: "Christopher Lee", company: "Apex Pharmaceuticals", phone: "+1 (812) 441-9021", direction: "Inbound", duration: "08m 45s", outcome: "Quote Requested", followUp: "Friday", time: "09:30 AM" },
    { id: "c3", contact: "Sarah Flores", company: "Aegis Systems Inc.", phone: "+1 (604) 119-8832", direction: "Outbound", duration: "03m 10s", outcome: "Left Voicemail", followUp: "Jul 25", time: "Yesterday" },
  ];

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["activitiesHub"] });
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Enterprise Activities Hub</h1>
          </div>
          <p className="text-xs text-slate-500">Unified Outlook + HubSpot + Google Calendar workspace for tasks, meetings, calls & site visits.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setCreateType("task"); setIsCreateModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" /> Log Activity
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { key: "today", label: "Today's Workspace", icon: Zap, badge: 8 },
          { key: "tasks", label: "Tasks & To-Dos", icon: CheckSquare, badge: 5 },
          { key: "meetings", label: "Meetings Calendar", icon: Video, badge: 3 },
          { key: "calls", label: "Call Logs", icon: PhoneCall, badge: 3 },
          { key: "visits", label: "Site Visits & Surveys", icon: MapPin, badge: 2 },
          { key: "calendar", label: "Unified Calendar", icon: CalendarIcon },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as ActivityTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
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

      {/* TODAY'S WORKSPACE TAB */}
      {activeTab === "today" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Col 1 & 2: Today's Schedule */}
          <div className="lg:col-span-2 space-y-6">

            {/* Meetings Widget */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-600" /> Today's Meetings ({demoMeetings.length})
                </h3>
                <span className="text-xs font-semibold text-slate-400">July 22, 2026</span>
              </div>

              <div className="space-y-3">
                {demoMeetings.map(m => (
                  <div key={m.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50/50 hover:border-blue-200 transition-all flex items-start gap-4">
                    <div className="text-center shrink-0 w-16 bg-white p-2 border border-slate-200 rounded-lg shadow-2xs">
                      <p className="text-xs font-extrabold text-slate-900">{m.time}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{m.duration}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{m.title}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">{m.type}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{m.contact}</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{m.company}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</span>
                      </p>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shrink-0">
                      Join Meeting
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Site Visits Widget */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" /> Active Site Visits & Surveys ({demoSiteVisits.length})
              </h3>
              <div className="space-y-3">
                {demoSiteVisits.map(v => (
                  <div key={v.id} className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">{v.status}</span>
                        <h4 className="text-sm font-bold text-slate-800 mt-1">{v.company}</h4>
                        <p className="text-xs text-slate-500">{v.purpose} · Inspector: {v.inspector}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{v.date}</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audit Checklist</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {v.checklist.map((c, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input type="checkbox" defaultChecked={i === 0} className="rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="truncate">{c}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Col 3: Calls & Deadlines */}
          <div className="space-y-6">

            {/* Recent Calls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-violet-600" /> Call Activity Log
              </h3>
              <div className="space-y-2">
                {demoCalls.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{c.contact}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{c.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.company} · {c.duration}</p>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="font-bold text-emerald-600">{c.outcome}</span>
                      <span className="text-slate-400">Follow-up: {c.followUp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Nudges */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">Action Required (2)</h4>
              </div>
              <ul className="text-xs text-amber-900 space-y-2">
                <li className="flex items-center justify-between">
                  <span>Weekly Activity Report Submission</span>
                  <span className="font-bold text-red-600">Overdue</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Contract Renewal — Starlight Energy</span>
                  <span className="font-bold text-amber-700">Due Today</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      )}

      {/* TASKS TAB */}
      {activeTab === "tasks" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-800">Assigned Tasks</h3>
            <div className="flex gap-2">
              {["All", "High", "Medium", "Low"].map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    filterPriority === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {[
              { id: "t1", title: "Follow-up call — Aegis Systems Group", priority: "High", due: "Today", company: "Aegis Systems Group", status: "Pending" },
              { id: "t2", title: "Send revised quotation #QT-2025-05012 to Apex Pharma", priority: "High", due: "Today", company: "Apex Pharmaceuticals", status: "Pending" },
              { id: "t3", title: "Review contract legal redlines with legal council", priority: "Medium", due: "Tomorrow", company: "Starlight Energy Inc.", status: "Pending" },
              { id: "t4", title: "Schedule site visit — Matrix Pharma", priority: "Medium", due: "Jul 25", company: "Matrix Pharmaceuticals", status: "Pending" },
            ].filter(t => filterPriority === "All" || t.priority === filterPriority).map(task => (
              <div key={task.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-400">{task.company} · Due: {task.due}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  task.priority === "High" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {task.priority} Priority
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEETINGS TAB */}
      {activeTab === "meetings" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800">Scheduled Meetings</h3>
          <div className="space-y-3">
            {demoMeetings.map(m => (
              <div key={m.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{m.title}</h4>
                  <p className="text-xs text-slate-500">{m.contact} ({m.company}) · {m.time} ({m.duration})</p>
                  <p className="text-xs text-indigo-600 font-semibold mt-1">📍 {m.location}</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700">
                  Meeting Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CALLS TAB */}
      {activeTab === "calls" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800">Call History & Logs</h3>
          <div className="space-y-3">
            {demoCalls.map(c => (
              <div key={c.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{c.contact} — {c.company}</p>
                  <p className="text-xs text-slate-500">{c.phone} · {c.direction} ({c.duration})</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Outcome: {c.outcome}</p>
                </div>
                <span className="text-xs text-slate-400 font-semibold">{c.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISITS TAB */}
      {activeTab === "visits" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800">Factory & Site Surveys</h3>
          <div className="space-y-4">
            {demoSiteVisits.map(v => (
              <div key={v.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{v.company}</h4>
                    <p className="text-xs text-slate-500">📍 {v.location}</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">{v.status}</span>
                </div>
                <p className="text-xs text-slate-700 font-medium">Purpose: {v.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CALENDAR TAB */}
      {activeTab === "calendar" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center py-12 space-y-3">
          <CalendarIcon className="w-12 h-12 text-indigo-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Unified Enterprise Calendar</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Displays Google Calendar & Outlook integrated events, site surveys, and task deadlines.</p>
        </div>
      )}

      {/* CREATE ACTIVITY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setIsCreateModalOpen(false)}>
          <form onSubmit={handleCreateActivity} className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Log New Activity</h3>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Activity Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold">
                <option value="task">Task / To-Do</option>
                <option value="meeting">Meeting</option>
                <option value="call">Call Log</option>
                <option value="visit">Site Visit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Factory Layout Safety Survey" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time</label>
                <input type="text" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="10:00 AM" className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold resize-none" placeholder="Agenda or outcome notes..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Save Activity</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
