import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, MapPin, Globe, CheckCircle2, 
  Sparkles, Clock, Calendar, CheckSquare, MessageSquare, Plus, ArrowLeftRight,
  FileText, Users, DollarSign, Activity, ChevronRight, TrendingUp, Repeat, FileSpreadsheet, ShoppingBag, Pin
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

export default function LeadDetail() {
  const { token } = useAuth();

  const { id } = useParams();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<string>("All");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "call" | "email" | "task">("note");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignTo, setAssignTo] = useState("");

  // We fetch a mock lead detail from our API
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      // For mock purposes we can just use the leads endpoint and find one,
      // but let's assume the API handles /leads/:id. We'll fallback to a static mock
      // if the endpoint isn't fully robust yet.
      const res = await fetch(`/api/v1/leads`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      const leads = await res.json();
      return leads[0] || null; 
    }
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id || 'mock-id'}/activities`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const addActivityMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/v1/leads/${id || 'mock-id'}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to add activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setNewNote("");
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await fetch(`/api/v1/activities/${activityId}/pin`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to pin activity");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activities"] })
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    // Check for mentions
    const mentioned_user_ids = [];
    if (newNote.includes("@")) {
      // Mock parsing for user ID if a mention is found
      mentioned_user_ids.push("mock-mentioned-user");
    }

    addActivityMutation.mutate({
      type: noteType,
      outcome: newNote,
      mentioned_user_ids,
      dueDate: noteType === 'task' ? dueDate : undefined,
      priority: noteType === 'task' ? priority : undefined,
      assignTo: noteType === 'task' ? assignTo : undefined
    });
  };

  const filteredActivities = activities.filter((act: any) => {
    if (filterType === "All") return true;
    if (filterType === "Communications" && ["call", "email", "whatsapp_sms", "meeting"].includes(act.type)) return true;
    if (filterType === "Documents" && act.type === "quote_created") return true; // Just mapping logically
    if (filterType === "Notes" && act.type === "note") return true;
    if (filterType === "Tasks" && act.type === "task") return true;
    return false;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-background h-[calc(100vh-64px)]">
      {/* Action Bar & Breadcrumbs */}
      <div className="px-8 py-4 bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-on-surface-variant text-sm">
          <a className="hover:text-primary" href="/leads">Leads</a>
          <ChevronRight className="w-4 h-4" />
          <span className="font-bold text-on-surface">{isLoading ? 'Loading...' : 'Arjun Mehta (Tech Mahindra)'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setNoteType("call");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'call' ? 'bg-error-container text-error border-error' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <Phone className="w-5 h-5" />
            <span className="text-sm">Log Call</span>
          </button>
          <button 
            onClick={() => {
              setNoteType("email");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'email' ? 'bg-tertiary-container text-tertiary border-tertiary' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <Mail className="w-5 h-5" />
            <span className="text-sm">Send Email</span>
          </button>
          <button 
            onClick={() => {
              setNoteType("task");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'task' ? 'bg-secondary-container text-secondary border-secondary' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-sm">Create Task</span>
          </button>
          <button 
            onClick={() => window.location.href = "/quotes/new"}
            className="flex items-center gap-2 px-4 py-2 border border-secondary text-secondary font-bold rounded-lg hover:bg-secondary-container/20 transition-all"
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm">Create Quote</span>
          </button>
          <button 
            onClick={() => alert("Auto-enrichment requires Phase 13 backend completion.")}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold rounded hover:bg-primary/20 transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Enrich
          </button>
          <button 
            onClick={() => alert("Schedule Meeting integration not configured.")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-sm">Schedule Meeting</span>
          </button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-12 gap-8 max-w-[1440px] mx-auto">
        {/* Left Column: Profile & Context */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Main Profile Card */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary-container">
                  <span className="text-2xl font-bold">AM</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Arjun Mehta</h2>
                  <p className="text-sm text-on-surface-variant font-medium">VP of Product Innovation</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">High Intent</span>
                    <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">LinkedIn Lead</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">Lead Score</p>
                <p className="text-3xl font-bold text-primary">89</p>
              </div>
            </div>

            <div className="space-y-4 border-t border-outline-variant pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm font-medium">Tech Mahindra (Bengaluru, India)</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm">arjun.m@techmahindra.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm">+91 98450 12345</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
              <p className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-2">Source Campaign</p>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                <span className="text-sm font-bold text-on-surface">Q3 APAC Growth Summit</span>
              </div>
            </div>
          </div>

          {/* Auto-Enrichment Insights */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm relative overflow-hidden">
              <span className="text-primary/40"><Sparkles className="w-6 h-6" /></span>
            <h3 className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-6">Smart Insights</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Company Size</p>
                <p className="text-sm font-bold text-on-surface">10,000+ Employees</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">HQ Location</p>
                <p className="text-sm font-bold text-on-surface">Mumbai, IN</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Industry</p>
                <p className="text-sm font-bold text-on-surface">IT Services</p>
              </div>
              <div className="p-4 bg-surface-bright rounded-lg border border-outline-variant">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant opacity-60 mb-1">Revenue</p>
                <p className="text-sm font-bold text-on-surface">{formatCurrencyCompact(5300000000)}</p>
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h3 className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant mb-6">Ownership</h3>
            <div className="flex items-center justify-between p-2 border border-outline-variant rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">RV</div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Rahul Varma</p>
                  <p className="text-[12px] font-semibold tracking-wider uppercase text-primary">Senior Account Exec</p>
                </div>
              </div>
              <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <Repeat className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-full">
              <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-on-surface">Activity Timeline</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilterType("All")}
                  className={`text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full ${filterType === "All" ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >All Activity</button>
                <button 
                  onClick={() => setFilterType("Communications")}
                  className={`text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full ${filterType === "Communications" ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >Communications</button>
                <button 
                  onClick={() => setFilterType("Notes")}
                  className={`text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full ${filterType === "Notes" ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >Notes</button>
                <button 
                  onClick={() => setFilterType("Tasks")}
                  className={`text-[12px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full ${filterType === "Tasks" ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >Tasks</button>
              </div>
            </div>

            {/* Quick Add Note */}
            <div className="mb-8 flex gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold shadow-sm">
                ME
              </div>
              <div className="flex-1 bg-surface-container-low rounded-lg border border-outline-variant p-2 flex flex-col">
                <textarea 
                  className="w-full bg-transparent border-none outline-none resize-none text-sm p-2"
                  placeholder={noteType === 'call' ? "Summarize the call..." : noteType === 'email' ? "Paste email contents..." : noteType === 'task' ? "Task description..." : "Leave a note or type @ to mention someone..."}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
                {noteType === 'task' && (
                  <div className="grid grid-cols-3 gap-2 p-2 border-t border-outline-variant mt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Due Date</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded p-1 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Priority</label>
                      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded p-1 text-sm outline-none focus:border-primary">
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Assign To</label>
                      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full bg-surface-container border border-outline-variant rounded p-1 text-sm outline-none focus:border-primary">
                        <option value="">Self</option>
                        <option value="u1">Ahmed K.</option>
                        <option value="u2">Sarah L.</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button 
                    onClick={handleAddNote}
                    disabled={addActivityMutation.isPending || !newNote.trim() || (noteType === 'task' && !dueDate)}
                    className="px-4 py-1.5 bg-primary text-white rounded text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {noteType === 'call' ? "Log Call" : noteType === 'email' ? "Log Email" : noteType === 'task' ? "Create Task" : "Post Note"}
                  </button>
                </div>
              </div>
            </div>
            
            {noteType !== 'note' && (
              <div className="mb-4 flex justify-end">
                <button 
                  onClick={() => { setNoteType('note'); setNewNote(''); }}
                  className="text-xs text-on-surface-variant hover:text-on-surface underline"
                >
                  Cancel {noteType} and return to note
                </button>
              </div>
            )}

            <div className="relative space-y-8 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant">
              
              {filteredActivities.length === 0 && (
                <div className="relative pl-12 text-on-surface-variant italic text-sm">
                  No activities recorded yet.
                </div>
              )}

              {filteredActivities.map((act: any) => {
                const isOverdue = act.type === 'task' && act.dueDate && new Date(act.dueDate) < new Date() && !act.completed;
                return (
                <div key={act.id} className="relative pl-12 group">
                  <div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-surface flex items-center justify-center z-10 ${
                    act.type === 'call' ? 'bg-error-container text-error' :
                    act.type === 'email' ? 'bg-tertiary-container text-tertiary' :
                    act.type === 'meeting' ? 'bg-secondary-container text-secondary' :
                    act.type === 'stage_change' ? 'bg-primary-container text-primary' :
                    act.type === 'task' ? 'bg-secondary-container text-secondary' :
                    'bg-surface-container-high text-on-surface'
                  }`}>
                    {act.type === 'call' && <Phone className="w-5 h-5" />}
                    {act.type === 'email' && <Mail className="w-5 h-5" />}
                    {act.type === 'meeting' && <Users className="w-5 h-5" />}
                    {act.type === 'stage_change' && <TrendingUp className="w-5 h-5" />}
                    {act.type === 'note' && <MessageSquare className="w-5 h-5" />}
                    {act.type === 'task' && <CheckSquare className="w-5 h-5" />}
                    {act.type === 'whatsapp_sms' && <MessageSquare className="w-5 h-5" />}
                  </div>
                  
                  <div className={`p-4 rounded-lg border transition-all ${act.pinned ? 'bg-secondary-container/10 border-secondary' : isOverdue ? 'bg-error-container/10 border-error' : 'bg-surface-container border-outline-variant/50 group-hover:border-outline-variant'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold flex items-center gap-2">
                        {act.type === 'task' && (
                          <input type="checkbox" defaultChecked={act.completed} className="mr-1 w-4 h-4 cursor-pointer accent-primary" />
                        )}
                        {act.type.replace('_', ' ').toUpperCase()} 
                        {act.pinned && <Pin className="w-4 h-4 text-secondary fill-secondary" />}
                        {isOverdue && <span className="ml-2 text-[10px] bg-error text-white px-1.5 py-0.5 rounded font-bold">OVERDUE</span>}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant">
                          {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                        </span>
                        <button 
                          onClick={() => togglePinMutation.mutate(act.id)}
                          className={`p-1 rounded transition-colors ${act.pinned ? 'text-secondary bg-secondary-container hover:bg-secondary-container/80' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {act.outcome && <p className="text-sm text-on-surface whitespace-pre-wrap">{act.outcome}</p>}
                    {act.duration && <p className="text-[12px] text-on-surface-variant mt-2 font-medium">Duration: {act.duration} mins</p>}
                    {act.type === 'task' && act.dueDate && <p className={`text-[12px] mt-2 font-medium ${isOverdue ? 'text-error' : 'text-on-surface-variant'}`}>Due: {new Date(act.dueDate).toLocaleDateString()}</p>}
                    
                    {act.mentioned_user_ids && act.mentioned_user_ids !== "[]" && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          Mentions Sent
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
