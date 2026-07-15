import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, Mail, Phone, Building2, MapPin, Globe, CheckCircle2, 
  Sparkles, Clock, Calendar, CheckSquare, MessageSquare, Plus, ArrowLeftRight,
  FileText, Users, DollarSign, Activity, ChevronRight, ChevronDown, TrendingUp, Repeat, FileSpreadsheet, ShoppingBag, Pin, X
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";
import { formatDistanceToNow } from "date-fns";

export default function LeadDetail() {
  const { token } = useAuth();

  const { id } = useParams();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<string>("All");
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "call" | "email" | "meeting" | "task" | "whatsapp_sms">("note");
  const [showHistory, setShowHistory] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowActivityModal(false);
        setShowQuotationModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotesHistory", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/quotes/history/client/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    enabled: !!id && !!token
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
      mentioned_user_ids
    });
  };

  const filteredActivities = activities.filter((act: any) => {
    if (filterType === "All") return true;
    if (filterType === "Communications" && ["call", "email", "whatsapp_sms", "meeting"].includes(act.type)) return true;
    if (filterType === "Notes" && act.type === "note") return true;
    if (filterType === "Tasks" && act.type === "task") return true;
    if (filterType === "Documents" && (act.type === "quote_created" || (act.outcome && (act.outcome.includes("Quote") || act.outcome.includes("Purchase Order"))))) return true;
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
              setNoteType("meeting");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'meeting' ? 'bg-secondary-container text-secondary border-secondary' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-sm">Log Meeting</span>
          </button>
          <button 
            onClick={() => {
              setNoteType("task");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'task' ? 'bg-surface-variant text-on-surface border-outline' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-sm">Add Task</span>
          </button>
          <button 
            onClick={() => {
              setNoteType("whatsapp_sms");
              setNewNote("");
              const textarea = document.querySelector('textarea');
              if (textarea) textarea.focus();
            }}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${noteType === 'whatsapp_sms' ? 'bg-green-100 text-green-700 border-green-300' : 'border-outline text-on-surface hover:bg-surface-container-low'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm">WhatsApp/SMS</span>
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

        {/* Right Column: Stacked Activity Timeline & Quotation Summary */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Activity Timeline Preview Card */}
          <div 
            onClick={() => setShowActivityModal(true)}
            className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-[380px] flex flex-col cursor-pointer hover:border-primary transition-all group overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-on-surface group-hover:text-primary flex items-center gap-2">
                Activity Timeline 
                <span className="text-xs font-normal text-on-surface-variant group-hover:text-primary opacity-70">(Tap to pop out)</span>
              </h3>
              <span className="text-xs font-bold text-primary group-hover:underline">View All ({activities.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activities.length === 0 ? (
                <div className="text-on-surface-variant italic text-sm py-8 text-center">
                  No activities recorded yet.
                </div>
              ) : (
                activities.slice(0, 3).map((act: any) => (
                  <div key={act.id} className="relative pl-10 border-l-2 border-outline-variant/65 pb-2 last:border-0 last:pb-0">
                    <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center ${
                      act.type === 'call' ? 'bg-error-container text-error' :
                      act.type === 'email' ? 'bg-tertiary-container text-tertiary' :
                      act.type === 'meeting' ? 'bg-secondary-container text-secondary' :
                      act.type === 'stage_change' ? 'bg-primary-container text-primary' :
                      'bg-surface-container-high text-on-surface'
                    }`}>
                      {act.type === 'call' && <Phone className="w-3.5 h-3.5" />}
                      {act.type === 'email' && <Mail className="w-3.5 h-3.5" />}
                      {act.type === 'meeting' && <Users className="w-3.5 h-3.5" />}
                      {act.type === 'stage_change' && <TrendingUp className="w-3.5 h-3.5" />}
                      {act.type === 'note' && <MessageSquare className="w-3.5 h-3.5" />}
                      {act.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                      {act.type === 'whatsapp_sms' && <MessageSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex justify-between items-start text-xs mb-1">
                      <p className="font-bold text-on-surface uppercase tracking-wider text-[10px]">{act.type.replace('_', ' ')}</p>
                      <span className="text-[10px] text-on-surface-variant">{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                    </div>
                    {act.outcome && <p className="text-xs text-on-surface truncate font-medium">{act.outcome}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quotation Summary Preview Card */}
          <div 
            onClick={() => setShowQuotationModal(true)}
            className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm h-[380px] flex flex-col cursor-pointer hover:border-primary transition-all group overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-on-surface group-hover:text-primary flex items-center gap-2">
                Quotation Summary
                <span className="text-xs font-normal text-on-surface-variant group-hover:text-primary opacity-70">(Tap to pop out)</span>
              </h3>
              {quotes && quotes.length > 0 && (
                <span className="text-xs font-bold text-primary group-hover:underline">View Details</span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {isLoading ? (
                <div className="flex-1 flex justify-center items-center text-on-surface-variant animate-pulse">Loading Quote...</div>
              ) : quotes && quotes.length > 0 ? (
                <div className="space-y-4">
                  {/* Active Quote details */}
                  <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/60 relative">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-on-surface">{quotes[0].quoteNumber}</h4>
                        <p className="text-[10px] text-on-surface-variant font-medium">Version {quotes[0].version}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        quotes[0].status === "Accepted" || quotes[0].status === "Approved" ? "bg-green-100 text-green-700 border border-green-200" :
                        quotes[0].status === "Sent" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                        quotes[0].status === "Viewed" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                        quotes[0].status === "Rejected" ? "bg-red-100 text-red-700 border border-red-200" :
                        "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {quotes[0].status}
                      </span>
                    </div>

                    <div className="mb-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant opacity-75">Total Value</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(quotes[0].totalAmount)}</p>
                    </div>

                    {/* Dates milestones */}
                    <div className="space-y-1 border-t border-outline-variant/40 pt-2 text-[10px] text-on-surface-variant">
                      {quotes[0].sentAt && (
                        <div className="flex justify-between">
                          <span>Date Sent:</span>
                          <span className="font-semibold">{new Date(quotes[0].sentAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {quotes[0].acceptedAt && (
                        <div className="flex justify-between">
                          <span>Date Signed:</span>
                          <span className="font-semibold">{new Date(quotes[0].acceptedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {quotes[0].expirationDate && (
                        <div className="flex justify-between">
                          <span>Expires On:</span>
                          <span className="font-semibold">{new Date(quotes[0].expirationDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Revisions preview count */}
                  {quotes.length > 1 && (
                    <p className="text-[10px] text-on-surface-variant font-medium italic">
                      + {quotes.length - 1} previous quote versions available in pop out.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center p-4 text-center border border-dashed border-outline-variant/50 rounded-xl bg-surface-container-low/60">
                  <FileText className="w-6 h-6 text-on-surface-variant opacity-60 mb-2" />
                  <p className="text-xs font-semibold text-on-surface">No quotation created yet</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Click to generate a quotation proposal.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Activity Timeline Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowActivityModal(false)}>
          <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Activity Timeline - Full History</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Filter, search, and review all lead touchpoints</p>
              </div>
              <button 
                onClick={() => setShowActivityModal(false)}
                className="p-1.5 hover:bg-surface-container-high rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-outline-variant/60 flex gap-2 flex-wrap bg-surface-container-lowest">
              {["All", "Communications", "Notes", "Tasks", "Documents"].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  className={`text-xs font-bold uppercase px-3.5 py-1.5 rounded-full transition-all ${filterType === tab ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content (Scrollable feed) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
              {/* Note creator */}
              <div className="flex gap-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-sm">
                  ME
                </div>
                <div className="flex-1 flex flex-col">
                  <textarea 
                    className="w-full bg-transparent border-none outline-none resize-none text-sm p-1"
                    placeholder="Add a new update or log comment..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/20 mt-2">
                    <select 
                      value={noteType} 
                      onChange={(e: any) => setNoteType(e.target.value)}
                      className="text-xs bg-surface border border-outline-variant rounded px-2 py-1 outline-none text-on-surface-variant font-semibold cursor-pointer"
                    >
                      <option value="note">Note</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="task">Task</option>
                      <option value="whatsapp_sms">WhatsApp/SMS</option>
                    </select>
                    <button 
                      onClick={handleAddNote}
                      disabled={addActivityMutation.isPending || !newNote.trim()}
                      className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                    >
                      Post Note
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed */}
              <div className="relative space-y-6 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant">
                {filteredActivities.length === 0 ? (
                  <p className="text-sm text-on-surface-variant italic pl-10">No activities found matching filters.</p>
                ) : (
                  filteredActivities.map((act: any) => (
                    <div key={act.id} className="relative pl-12 group">
                      <div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-surface flex items-center justify-center z-10 ${
                        act.type === 'call' ? 'bg-error-container text-error' :
                        act.type === 'email' ? 'bg-tertiary-container text-tertiary' :
                        act.type === 'meeting' ? 'bg-secondary-container text-secondary' :
                        act.type === 'stage_change' ? 'bg-primary-container text-primary' :
                        'bg-surface-container-high text-on-surface'
                      }`}>
                        {act.type === 'call' && <Phone className="w-4 h-4" />}
                        {act.type === 'email' && <Mail className="w-4 h-4" />}
                        {act.type === 'meeting' && <Users className="w-4 h-4" />}
                        {act.type === 'stage_change' && <TrendingUp className="w-4 h-4" />}
                        {act.type === 'note' && <MessageSquare className="w-4 h-4" />}
                        {act.type === 'task' && <CheckSquare className="w-4 h-4" />}
                        {act.type === 'whatsapp_sms' && <MessageSquare className="w-4 h-4" />}
                      </div>
                      
                      <div className={`p-4 rounded-xl border transition-all ${act.pinned ? 'bg-secondary-container/10 border-secondary' : 'bg-surface-container border-outline-variant/50 group-hover:border-outline-variant'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-bold flex items-center gap-2">
                            {act.type.replace('_', ' ').toUpperCase()} 
                            {act.pinned && <Pin className="w-3.5 h-3.5 text-secondary fill-secondary" />}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant">
                              {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                            </span>
                            <button 
                              onClick={() => togglePinMutation.mutate(act.id)}
                              className={`p-1 rounded transition-colors ${act.pinned ? 'text-secondary bg-secondary-container hover:bg-secondary-container/80' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {act.outcome && <p className="text-sm text-on-surface whitespace-pre-wrap">{act.outcome}</p>}
                        {act.duration && <p className="text-xs text-on-surface-variant mt-2 font-medium">Duration: {act.duration} mins</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Summary Modal */}
      {showQuotationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowQuotationModal(false)}>
          <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Quotation Detail & Version History</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Complete proposal line items, milestones, and older drafts</p>
              </div>
              <button 
                onClick={() => setShowQuotationModal(false)}
                className="p-1.5 hover:bg-surface-container-high rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {quotes && quotes.length > 0 ? (
                <>
                  {/* Active Proposal details card */}
                  <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/60">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-base font-bold text-on-surface">{quotes[0].quoteNumber}</h4>
                        <p className="text-xs text-on-surface-variant">Version {quotes[0].version} · Created on {new Date(quotes[0].createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        quotes[0].status === "Accepted" || quotes[0].status === "Approved" ? "bg-green-100 text-green-700 border border-green-200" :
                        quotes[0].status === "Sent" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                        quotes[0].status === "Viewed" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                        "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {quotes[0].status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-b border-outline-variant/30 py-4 mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total Value</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(quotes[0].totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Associated Deal</p>
                        <p className="text-sm font-bold text-on-surface truncate">{quotes[0].deal?.name || "Deal"}</p>
                      </div>
                    </div>

                    {/* Milestones list */}
                    <div className="space-y-2 text-xs text-on-surface-variant">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Milestone Dates</p>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                          <span>Drafted:</span>
                          <span className="font-semibold text-on-surface">{new Date(quotes[0].createdAt).toLocaleDateString()}</span>
                        </div>
                        {quotes[0].sentAt && (
                          <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                            <span>Sent to Client:</span>
                            <span className="font-semibold text-on-surface">{new Date(quotes[0].sentAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {quotes[0].viewedAt && (
                          <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                            <span>Viewed:</span>
                            <span className="font-semibold text-on-surface">{new Date(quotes[0].viewedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {quotes[0].acceptedAt && (
                          <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                            <span>Accepted / Signed:</span>
                            <span className="font-semibold text-on-surface">{new Date(quotes[0].acceptedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {quotes[0].expirationDate && (
                          <div className="flex justify-between border-b border-outline-variant/10 pb-1 col-span-2">
                            <span>Expiration Date:</span>
                            <span className="font-semibold text-error">{new Date(quotes[0].expirationDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  {quotes[0].QuoteLineItems && quotes[0].QuoteLineItems.length > 0 && (
                    <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface">
                      <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Product & Pricing Details</h5>
                      </div>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-surface-container-low/50 border-b border-outline-variant/30 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                            <th className="p-3">Product Name</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotes[0].QuoteLineItems.map((item: any) => (
                            <tr key={item.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/20">
                              <td className="p-3 font-semibold text-on-surface">{item.product?.name || "Product"}</td>
                              <td className="p-3 text-center font-bold text-on-surface-variant">{item.quantity}</td>
                              <td className="p-3 text-right text-on-surface-variant">{formatCurrency(Number(item.unitPrice))}</td>
                              <td className="p-3 text-right font-bold text-primary">{formatCurrency(Number(item.totalPrice))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <a 
                      href="/quotes" 
                      className="flex-1 text-center py-2.5 border border-outline text-on-surface font-bold rounded-lg text-sm hover:bg-surface-container-low transition-all"
                    >
                      Go to Proposals Page
                    </a>
                    <a 
                      href="/quotes/new" 
                      className="flex-1 text-center py-2.5 bg-primary text-on-primary font-bold rounded-lg text-sm hover:opacity-95 transition-all"
                    >
                      Revise & Edit Quote
                    </a>
                  </div>

                  {/* Complete revisions list */}
                  {quotes.length > 1 && (
                    <div className="border-t border-outline-variant/40 pt-4">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Revisions Log</h5>
                      <div className="space-y-2">
                        {quotes.slice(1).map((histQuote: any) => (
                          <div key={histQuote.id} className="p-3.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/30 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-on-surface">{histQuote.quoteNumber}</p>
                              <p className="text-[10px] text-on-surface-variant">Version {histQuote.version} · Created on {new Date(histQuote.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{formatCurrency(histQuote.totalAmount)}</p>
                              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                histQuote.status === "Superseded" ? "bg-slate-100 text-slate-600" : "bg-primary/10 text-primary"
                              }`}>
                                {histQuote.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
                  <p className="text-sm font-bold">No quotation drafts found</p>
                  <p className="text-xs text-on-surface-variant mt-1">Generate a quotation proposal for this lead to start.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
