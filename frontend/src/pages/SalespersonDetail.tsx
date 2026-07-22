import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, User, Phone, Mail, Award, Compass, DollarSign, Briefcase, FileSpreadsheet,
  FileText, Clock, Pin, MessageSquare, TrendingUp, Users, CheckSquare, History,
  Instagram, Globe, Facebook, CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, Minus, Plus,
  Target, BarChart2, Edit2, Lock, Unlock, RotateCcw, MapPin, Building2, X, Save
} from "lucide-react";
import { apiClient } from "../lib/apiClient";

interface Quote {
  id: string;
  quoteNumber: string | null;
  version: number;
  status: string;
  cycleStage: string;
  totalAmount: number;
  dealId: string;
  dealName: string;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  expirationDate: string | null;
  approvalStatus?: string | null;
  approvalComments?: string | null;
  approvedBy?: string | null;
}

interface ActivityEntry {
  id: string;
  type: string;
  outcome: string | null;
  createdAt: string;
  leadId: string | null;
  leadName: string | null;
  pinned: boolean;
  priority: string | null;
}

interface LeadHistoryEntry {
  id: string;
  name: string;
  company: string;
  dealValue: number;
  closeDate: string;
  source: string;
  type: "won" | "lost";
}

interface KpiTarget {
  id: string;
  kpiName: string;
  targetValue: number;
  currentValue: number;
  frequency: string;
  weightage: number;
  effectiveDate: string;
  expiryDate: string;
  notes: string;
  status: string;
  salespersonId: string;
}

interface Salesperson {
  id: string;
  name: string;
  email?: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  department: string;
  territory: string;
  team: string;
  email: string;
  totalLeads: number;
  totalDeals: number;
  purchaseOrders: {
    id: string;
    poNumber: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  wonClients: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
  }[];
  leadSources: { source: string; count: number }[];
  dealTypes: { stage: string; count: number }[];
  quotes: Quote[];
  activities: ActivityEntry[];
  wonLeads: LeadHistoryEntry[];
  lostLeads: LeadHistoryEntry[];
  successRate: number;
  sourceBreakdown: Record<string, { total: number; won: number; winRate: number }>;
  bestFitSuggestion: {
    source: string | null;
    winRate: number | null;
    reason?: string;
  } | null;
}

const KPI_CATEGORIES: Record<string, string[]> = {
  "Lead Generation": ["New Leads", "Qualified Leads", "Assigned Leads"],
  "Prospecting": ["Calls Made", "Follow-ups", "Emails", "Customer Visits"],
  "Meetings": ["Meetings Scheduled", "Meetings Completed", "Product Demo", "Technical Meeting"],
  "Sales": ["Quotations Sent", "Quotations Approved", "Purchase Orders", "Revenue Closed"],
  "Conversion": ["Lead → Meeting %", "Meeting → Proposal %", "Proposal → PO %", "Lead → Customer %"],
  "Finance": ["Invoice Clearance", "Payment Collection", "Outstanding Collections"],
  "Customer": ["New Clients", "Repeat Clients"],
  "Performance": ["Monthly Achievement", "Quarterly Achievement", "Performance Score"],
};

function getSourceIcon(source: string) {
  const src = source.toLowerCase().trim();
  if (src === "email") return Mail;
  if (src === "instagram" || src === "ig") return Instagram;
  if (src === "cold_call" || src === "cold call" || src === "coldcall") return Phone;
  if (src === "website" || src === "web") return Globe;
  if (src === "facebook" || src === "fb") return Facebook;
  return Compass;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function getAchievementPct(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

// SVG circular progress ring
function ProgressRing({ pct, size = 40, stroke = 3 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(100, Math.max(0, pct)) / 100 * circ;
  const cx = size / 2;
  const ringColor = pct >= 90 ? "#10b981" : pct >= 60 ? "#6366f1" : pct >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="transparent" />
      <circle cx={cx} cy={cx} r={r} stroke={ringColor} strokeWidth={stroke} fill="transparent"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
}

// Edit Target Modal
function EditTargetModal({
  kpi, onClose, onSaved
}: { kpi: KpiTarget; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    targetValue: kpi.targetValue,
    frequency: kpi.frequency,
    weightage: kpi.weightage,
    notes: kpi.notes || "",
    reason: ""
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const res = await apiClient(`/api/v1/kpis/target/${kpi.id}`, {
        method: "PUT",
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error || "Save failed");
      } else {
        onSaved();
        onClose();
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-outline p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-on-surface">Edit KPI Target</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">{kpi.kpiName}</p>
        {err && <div className="text-xs font-bold text-error bg-error-container/30 p-2.5 rounded-lg">{err}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Target Value</label>
            <input type="number" value={form.targetValue}
              onChange={e => setForm({ ...form, targetValue: parseFloat(e.target.value) || 0 })}
              className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Frequency</label>
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
              className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Weightage (%)</label>
            <input type="number" min="0" max="100" value={form.weightage}
              onChange={e => setForm({ ...form, weightage: parseFloat(e.target.value) || 0 })}
              className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Reason for Change</label>
          <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
            placeholder="Optional audit trail note"
            className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Target"}
          </button>
        </div>
      </div>
    </div>
  );
}

// KPI Target row card
function KpiRow({ kpi, onEdit, isAdmin }: { kpi: KpiTarget; onEdit: (kpi: KpiTarget) => void; isAdmin: boolean }) {
  const pct = getAchievementPct(kpi.currentValue, kpi.targetValue);
  const isLocked = kpi.status === "Locked";
  const pctColor = pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-primary" : pct >= 30 ? "text-amber-500" : "text-rose-500";
  const barColor = pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-amber-500" : "bg-rose-500";


  const formatVal = (v: number, name: string) => {
    if (name.includes("%")) return `${v}%`;
    if (name === "Revenue Closed" || name === "Payment Collection" || name === "Outstanding Collections") {
      return v >= 1000000 ? `₹${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;
    }
    return v.toLocaleString();
  };

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${isLocked ? "border-outline-variant/50 opacity-70" : "border-outline-variant hover:border-primary/30"}`}>
      <ProgressRing pct={pct} size={36} stroke={3} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-on-surface truncate">{kpi.kpiName}</p>
          {isLocked && <Lock className="w-3 h-3 text-on-surface-variant flex-shrink-0" />}
          <span className="text-[10px] font-semibold text-on-surface-variant px-1.5 py-0.5 bg-surface-container rounded capitalize flex-shrink-0">{kpi.frequency}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className={`text-[10px] font-black ${pctColor} flex-shrink-0`}>{pct}%</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-xs font-black text-on-surface">{formatVal(kpi.currentValue, kpi.kpiName)}</p>
        <p className="text-[9px] text-on-surface-variant font-semibold">/ {formatVal(kpi.targetValue, kpi.kpiName)}</p>
      </div>

      {isAdmin && !isLocked && (
        <button onClick={() => onEdit(kpi)}
          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all opacity-60 hover:opacity-100 flex-shrink-0">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const TABS = ["Performance", "Target Management"];

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("Performance");
  const [filterSegment, setFilterSegment] = useState<string | null>(null);
  const [localCap, setLocalCap] = useState<number>(0);
  const [editingKpi, setEditingKpi] = useState<KpiTarget | null>(null);
  const [lockState, setLockState] = useState(false);
  const [locking, setLocking] = useState(false);

  const isAdmin = authUser && ["admin", "director", "sales_manager"].includes((authUser as any).role);

  const updateCapMutation = useMutation({
    mutationFn: async (newCap: number) => {
      const res = await apiClient(`/api/v1/salespersons/${id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({ maxOpenLeads: newCap })
      });
      if (!res.ok) throw new Error("Failed to update capacity limit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salespersonPerformance", id] });
    }
  });

  const { data: rep, isLoading, error } = useQuery<Salesperson>({
    queryKey: ["salespersonPerformance", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/performance`);
      if (!res.ok) throw new Error("Failed to load representative profile");
      return res.json();
    },
    enabled: !!id && !!token
  });

  const { data: kpiTargets, isLoading: kpiLoading, refetch: refetchKpis } = useQuery<KpiTarget[]>({
    queryKey: ["salespersonKpis", id],
    queryFn: async () => {
      const res = await apiClient(`/api/v1/salespersons/${id}/kpis`);
      if (!res.ok) throw new Error("Failed to load KPI targets");
      return res.json();
    },
    enabled: !!id && !!token
  });

  useEffect(() => {
    if (rep) {
      setLocalCap(rep.maxOpenLeads);
    }
  }, [rep]);

  useEffect(() => {
    if (kpiTargets && kpiTargets.length > 0) {
      setLockState(kpiTargets.every(t => t.status === "Locked"));
    }
  }, [kpiTargets]);

  const handleToggleLock = async () => {
    setLocking(true);
    try {
      await apiClient("/api/v1/kpis/lock", {
        method: "POST",
        body: JSON.stringify({ salespersonId: id, status: lockState ? "Active" : "Locked" })
      });
      setLockState(v => !v);
      refetchKpis();
    } catch (e) {
      console.error(e);
    } finally {
      setLocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !rep) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-error bg-error-container p-4 rounded-xl">
          {error instanceof Error ? error.message : "Could not load representative details"}
        </div>
        <button onClick={() => navigate("/salespersons")}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-surface-container transition-colors mx-auto">
          <ArrowLeft className="w-5 h-5" />Back to Representatives
        </button>
      </div>
    );
  }

  const allHistoryLeads: LeadHistoryEntry[] = [
    ...(rep.wonLeads || []).map(l => ({ ...l, type: "won" as const })),
    ...(rep.lostLeads || []).map(l => ({ ...l, type: "lost" as const }))
  ].sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());

  const filteredHistory = allHistoryLeads.filter(lead => {
    if (!filterSegment) return true;
    if (filterSegment === "won") return lead.type === "won";
    if (filterSegment === "lost") return lead.type === "lost";
    return lead.source.toLowerCase().trim() === filterSegment.toLowerCase().trim();
  });

  const leadSourceCounts = rep.leadSources.reduce((acc, curr) => {
    acc[curr.source] = curr.count;
    return acc;
  }, {} as Record<string, number>);

  const channels = [
    { label: "Email", key: "email", icon: Mail, color: "text-primary bg-primary/10" },
    { label: "Instagram", key: "instagram", icon: Instagram, color: "text-[#E1306C] bg-[#E1306C]/10" },
    { label: "Cold Call", key: "cold_call", icon: Phone, color: "text-secondary bg-secondary/10" },
    { label: "Website", key: "website", icon: Globe, color: "text-primary bg-primary/10" },
    { label: "Facebook", key: "facebook", icon: Facebook, color: "text-[#1877F2] bg-[#1877F2]/10" },
  ];

  // KPI summary metrics
  const overallAchievementPct = kpiTargets && kpiTargets.length > 0
    ? Math.round(kpiTargets.reduce((sum, t) => sum + getAchievementPct(t.currentValue, t.targetValue), 0) / kpiTargets.length)
    : 0;
  const monthlyTarget = kpiTargets?.find(t => t.kpiName === "Monthly Achievement");
  const revTarget = kpiTargets?.find(t => t.kpiName === "Revenue Closed");
  const perfScore = kpiTargets?.find(t => t.kpiName === "Performance Score");

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in text-on-surface">

      {/* Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/salespersons")}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors border border-outline-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-on-surface-variant text-sm">
          <span className="cursor-pointer hover:text-primary" onClick={() => navigate("/salespersons")}>Representatives</span>
          <span>/</span>
          <span className="font-bold text-on-surface">{rep.name}</span>
        </div>
      </div>

      {/* Profile hero card */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center text-white text-xl font-black flex-shrink-0">
              {getInitials(rep.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-on-surface">{rep.name}</h1>
                {rep.email && <span className="text-xs font-mono text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-md border border-outline-variant">{rep.email}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="capitalize px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {rep.role.replace("_", " ")}
                </span>
                <span className={`text-xs font-semibold ${rep.isAvailable ? "text-emerald-500" : "text-amber-500"}`}>
                  ● {rep.isAvailable ? "Available" : "OOO / Busy"}
                </span>
                <span className="flex items-center gap-1 text-xs text-on-surface-variant font-semibold">
                  <Building2 className="w-3 h-3" /> {rep.department || "Sales"}
                </span>
                <span className="flex items-center gap-1 text-xs text-on-surface-variant font-semibold">
                  <MapPin className="w-3 h-3" /> {rep.territory || "EMEA"}
                </span>
                <span className="flex items-center gap-1 text-xs text-on-surface-variant font-semibold">
                  <Users className="w-3 h-3" /> Team {rep.team || "Aces"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { label: "Won POs", value: rep.purchaseOrders.length, color: "text-primary" },
              { label: "Clients", value: rep.wonClients.length, color: "text-secondary" },
              { label: "Total Leads", value: rep.totalLeads, color: "text-on-surface" },
              { label: "KPI Score", value: `${perfScore ? Math.round(perfScore.currentValue) : 0}%`, color: "text-emerald-600" },
              { label: "Leads Cap", value: null, color: "text-on-surface", isCapControl: true },
            ].map(({ label, value, color, isCapControl }) => (
              <div key={label} className="bg-surface p-3 rounded-xl border border-outline-variant text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                {isCapControl ? (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <button disabled={localCap <= 0} onClick={e => { e.stopPropagation(); setLocalCap(c => Math.max(0, c - 5)); }}
                      className="p-0.5 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50">
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-sm font-extrabold text-on-surface">{localCap}</span>
                    <button onClick={e => { e.stopPropagation(); setLocalCap(c => c + 5); }}
                      className="p-0.5 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <p className={`text-lg font-extrabold mt-1 ${color}`}>{value}</p>
                )}
                {isCapControl && localCap !== rep.maxOpenLeads && (
                  <button disabled={updateCapMutation.isPending} onClick={e => { e.stopPropagation(); updateCapMutation.mutate(localCap); }}
                    className="mt-1 text-[9px] font-bold px-2 py-0.5 bg-primary text-white rounded hover:opacity-90 disabled:opacity-60">
                    {updateCapMutation.isPending ? "..." : "Save"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-outline-variant pb-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}>
            {tab === "Target Management" && <Target className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
            {tab === "Performance" && <BarChart2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── TARGET MANAGEMENT TAB ── */}
      {activeTab === "Target Management" && (
        <div className="space-y-6">

          {/* KPI Summary hero row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Overall Achievement",
                value: `${overallAchievementPct}%`,
                sub: "Avg across all KPIs",
                color: overallAchievementPct >= 80 ? "text-emerald-600" : overallAchievementPct >= 50 ? "text-primary" : "text-rose-500",
              },
              {
                label: "Monthly Achievement",
                value: `${monthlyTarget ? Math.round(monthlyTarget.currentValue) : 0}%`,
                sub: `Target: ${monthlyTarget ? monthlyTarget.targetValue : 80}%`,
                color: "text-primary",
              },
              {
                label: "Revenue Closed",
                value: revTarget ? (revTarget.currentValue >= 1000000 ? `₹${(revTarget.currentValue / 1000000).toFixed(1)}M` : `₹${(revTarget.currentValue / 1000).toFixed(0)}K`) : "₹0",
                sub: `Target: ₹${revTarget ? (revTarget.targetValue / 1000).toFixed(0) : 100}K`,
                color: "text-emerald-600",
              },
              {
                label: "Performance Score",
                value: `${perfScore ? Math.round(perfScore.currentValue) : 0}%`,
                sub: "Weighted KPI composite",
                color: "text-secondary",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Lock / Unlock banner for admin */}
          {isAdmin && (
            <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                {lockState ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-emerald-500" />}
                <p className="text-xs font-bold text-on-surface">
                  Targets are currently <span className={lockState ? "text-amber-500" : "text-emerald-500"}>{lockState ? "Locked" : "Active"}</span>
                  {lockState && " — editing disabled for all KPIs"}
                </p>
              </div>
              <button onClick={handleToggleLock} disabled={locking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  lockState
                    ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                }`}>
                {lockState ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {locking ? "..." : lockState ? "Unlock All Targets" : "Lock All Targets"}
              </button>
            </div>
          )}

          {/* KPI categories */}
          {kpiLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 animate-pulse space-y-3">
                  <div className="h-3 bg-surface-container-low rounded w-1/3" />
                  {[1, 2, 3].map(j => <div key={j} className="h-10 bg-surface-container-low rounded-xl" />)}
                </div>
              ))}
            </div>
          ) : !kpiTargets || kpiTargets.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center">
              <Target className="w-8 h-8 text-on-surface-variant mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold text-on-surface-variant">No KPI targets configured yet.</p>
              <p className="text-xs text-on-surface-variant opacity-60 mt-1">Targets will auto-initialize on first load.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from(new Set(kpiTargets.map(t => (t as any).category || "General"))).map((category) => {
                const categoryKpis = kpiTargets.filter(t => ((t as any).category || "General") === category);
                if (categoryKpis.length === 0) return null;
                const catAvg = Math.round(categoryKpis.reduce((s, t) => s + getAchievementPct(t.currentValue, t.targetValue), 0) / categoryKpis.length);
                return (
                  <div key={category} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">{category}</h3>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        catAvg >= 80 ? "bg-emerald-500/10 text-emerald-600" : catAvg >= 50 ? "bg-primary/10 text-primary" : "bg-rose-500/10 text-rose-500"
                      }`}>{catAvg}% avg</span>
                    </div>
                    <div className="space-y-2">
                      {categoryKpis.map(kpi => (
                        <KpiRow key={kpi.id} kpi={kpi} onEdit={setEditingKpi} isAdmin={!!isAdmin} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PERFORMANCE TAB ── */}
      {activeTab === "Performance" && (
        <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 space-y-8">

          {/* TOP CLICKABLE KPI CARDS ROW */}
          <div>
            <h3 className="text-title-xs font-bold text-on-surface mb-4">Click metrics to filter lead and deal history</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

              <button onClick={() => setFilterSegment(null)}
                className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                  filterSegment === null ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-outline-variant bg-surface"
                }`}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total Leads</span>
                  <div className="p-1.5 rounded-lg bg-surface-container"><Users className="w-4 h-4 text-on-surface-variant" /></div>
                </div>
                <div className="text-2xl font-extrabold text-on-surface mt-2">{rep.totalLeads}</div>
              </button>

              <button onClick={() => setFilterSegment("won")}
                className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                  filterSegment === "won" ? "border-green-500 bg-green-500/5 ring-1 ring-green-500" : "border-outline-variant bg-surface"
                }`}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-green-600">Won Leads</span>
                  <div className="p-1.5 rounded-lg bg-green-500/10"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
                </div>
                <div className="text-2xl font-extrabold text-green-600 mt-2">{(rep.wonLeads || []).length}</div>
              </button>

              <button onClick={() => setFilterSegment("lost")}
                className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                  filterSegment === "lost" ? "border-red-500 bg-red-500/5 ring-1 ring-red-500" : "border-outline-variant bg-surface"
                }`}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Lost Leads</span>
                  <div className="p-1.5 rounded-lg bg-red-500/10"><XCircle className="w-4 h-4 text-red-600" /></div>
                </div>
                <div className="text-2xl font-extrabold text-red-600 mt-2">{(rep.lostLeads || []).length}</div>
              </button>

              <div className="p-4 rounded-xl border border-outline-variant bg-surface shadow-sm flex flex-col justify-between h-28 select-none">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Success Rate</span>
                  <div className="p-1.5 rounded-lg bg-primary/10"><TrendingUp className="w-4 h-4 text-primary" /></div>
                </div>
                <div className="text-2xl font-extrabold text-on-surface mt-2">{Math.round((rep.successRate || 0) * 100)}%</div>
              </div>

              {channels.map((ch) => {
                const Icon = ch.icon;
                const count = leadSourceCounts[ch.key] || 0;
                const isSelected = filterSegment === ch.key;
                return (
                  <button key={ch.key} onClick={() => setFilterSegment(ch.key)}
                    className={`p-4 rounded-xl border text-left shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all ${
                      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-outline-variant bg-surface"
                    }`}>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{ch.label}</span>
                      <div className={`p-1.5 rounded-lg ${ch.color}`}><Icon className="w-4 h-4" /></div>
                    </div>
                    <div className="text-2xl font-extrabold text-on-surface mt-2">{count}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BEST FIT CALLOUT */}
          {rep.bestFitSuggestion && (
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-on-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-body-lg text-primary">Best Fit Lead Source Suggestion</h4>
                {rep.bestFitSuggestion.source ? (
                  <p className="text-body-sm text-on-surface">
                    This representative performs exceptionally well with <span className="font-bold uppercase text-primary">{rep.bestFitSuggestion.source}</span> leads,
                    with a win rate of <span className="font-bold text-primary">{rep.bestFitSuggestion.winRate}%</span>.
                  </p>
                ) : (
                  <p className="text-body-sm text-on-surface-variant italic">
                    Recommendation unavailable: {rep.bestFitSuggestion.reason || "insufficient closed deals"}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* LEAD & DEAL HISTORY */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-body-lg">Lead & Deal History</h3>
              </div>
              {filterSegment && (
                <div className="flex items-center gap-2">
                  <span className="text-body-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
                    <Filter className="w-3 h-3" /> Filter: {filterSegment}
                  </span>
                  <button onClick={() => setFilterSegment(null)} className="text-body-xs font-bold text-red-500 hover:underline">Clear</button>
                </div>
              )}
            </div>
            {filteredHistory.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant italic py-4">No closed leads/deals found matching this segment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                      <th className="py-2.5">Lead / Company</th>
                      <th className="py-2.5">Lead Source</th>
                      <th className="py-2.5">Deal Status</th>
                      <th className="py-2.5">Deal Value</th>
                      <th className="py-2.5">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item, idx) => {
                      const SourceIcon = getSourceIcon(item.source);
                      return (
                        <tr key={idx} className="border-b border-outline-variant/40 hover:bg-surface-container-high transition-colors">
                          <td className="py-3">
                            <div className="font-semibold text-on-surface">{item.name}</div>
                            <div className="text-body-xs text-on-surface-variant font-medium">{item.company}</div>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 text-body-xs bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/60 font-semibold text-on-surface-variant capitalize">
                              <SourceIcon className="w-3.5 h-3.5" />{item.source}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 text-body-xs font-semibold px-2 py-0.5 rounded-full ${
                              item.type === "won" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                            }`}>
                              {item.type === "won" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {item.type === "won" ? "Won" : "Lost"}
                            </span>
                          </td>
                          <td className="py-3 font-bold">${Number(item.dealValue).toLocaleString()}</td>
                          <td className="py-3 text-on-surface-variant">{new Date(item.closeDate).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subsection grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                <Compass className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-body-lg">Lead Sources Distribution</h3>
              </div>
              <div className="space-y-3">
                {rep.leadSources.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant italic">No lead sources mapped.</p>
                ) : rep.leadSources.map((ls, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{ls.source}</span>
                      <span className="text-on-surface-variant font-semibold">{ls.count} leads</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${(ls.count / (rep.totalLeads || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-body-lg">Deal Categories Mix</h3>
              </div>
              <div className="space-y-3">
                {rep.dealTypes.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant italic">No deals active or won yet.</p>
                ) : rep.dealTypes.map((dt, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{dt.stage}</span>
                      <span className="text-on-surface-variant font-semibold">{dt.count} deals</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div className="bg-secondary h-2 rounded-full" style={{ width: `${(dt.count / (rep.totalDeals || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quotation Pipeline */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Quotation Pipeline ({rep.quotes?.length ?? 0})</h3>
            </div>
            {(!rep.quotes || rep.quotes.length === 0) ? (
              <p className="text-body-sm text-on-surface-variant italic">No quotations yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {rep.quotes.map((q) => {
                  const cycleColors: Record<string, string> = {
                    Draft: "bg-surface-container-high text-on-surface-variant",
                    "Pending Approval": "bg-amber-500/10 text-amber-600",
                    Approved: "bg-blue-500/10 text-blue-600",
                    Rejected: "bg-red-500/10 text-red-600",
                    Sent: "bg-indigo-500/10 text-indigo-600",
                    Viewed: "bg-purple-500/10 text-purple-600",
                    Accepted: "bg-green-500/10 text-green-600",
                    Expired: "bg-slate-500/10 text-slate-500",
                    Superseded: "bg-slate-500/10 text-slate-400",
                  };
                  const pillClass = cycleColors[q.cycleStage] ?? "bg-surface-container text-on-surface-variant";
                  const isSuperseded = q.cycleStage === "Superseded";
                  return (
                    <div key={q.id} className="flex flex-col gap-1 p-3 rounded-lg bg-surface-container border border-outline-variant/50 hover:border-outline-variant transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-semibold text-body-sm font-mono shrink-0 ${isSuperseded ? "line-through text-on-surface-variant" : "text-primary"}`}>
                            {q.quoteNumber ?? "Draft"} v{q.version}
                          </span>
                          <span className="text-on-surface-variant text-body-xs truncate">{q.dealName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${pillClass}`}>{q.cycleStage}</span>
                          <span className="text-body-sm font-bold">${Number(q.totalAmount).toLocaleString()}</span>
                          <span className="text-body-xs text-on-surface-variant">{formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Purchase Orders */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <DollarSign className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Associated Purchase Orders ({rep.purchaseOrders.length})</h3>
            </div>
            {rep.purchaseOrders.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant italic">No won purchase orders associated yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                      <th className="py-2">PO Number</th><th className="py-2">Amount</th>
                      <th className="py-2">Status</th><th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rep.purchaseOrders.map((po) => (
                      <tr key={po.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-colors">
                        <td className="py-2.5 font-semibold text-primary">{po.poNumber}</td>
                        <td className="py-2.5 font-bold">${Number(po.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${po.status === "Approved" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-on-surface-variant">{new Date(po.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Won Clients */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Client Portfolio ({rep.wonClients.length})</h3>
            </div>
            {rep.wonClients.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant italic">No client accounts activated yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rep.wonClients.map((client) => (
                  <div key={client.id} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col justify-between space-y-2 hover:bg-surface-container-low transition-colors">
                    <div>
                      <div className="font-semibold text-body-md text-on-surface">{client.name}</div>
                      <div className="text-body-xs text-on-surface-variant font-medium">{client.company}</div>
                    </div>
                    <div className="flex items-center space-x-2 text-body-xs text-on-surface-variant font-semibold">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      <span>{client.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activities Timeline */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <History className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Recent Activity</h3>
            </div>
            {(!rep.activities || rep.activities.length === 0) ? (
              <p className="text-body-sm text-on-surface-variant italic">No activities recorded yet.</p>
            ) : (
              <div className="relative space-y-6 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant max-h-80 overflow-y-auto pr-1">
                {rep.activities.map((act) => {
                  const dotClass =
                    act.type === "call" ? "bg-red-100 text-red-600" :
                    act.type === "email" ? "bg-tertiary-container text-tertiary" :
                    act.type === "meeting" ? "bg-secondary-container text-secondary" :
                    act.type === "stage_change" ? "bg-primary-container text-primary" :
                    "bg-surface-container-high text-on-surface-variant";
                  const TypeIcon =
                    act.type === "call" ? Phone :
                    act.type === "email" ? Mail :
                    act.type === "meeting" ? Users :
                    act.type === "stage_change" ? TrendingUp :
                    act.type === "task" ? CheckSquare : MessageSquare;
                  return (
                    <div key={act.id} className="relative pl-10">
                      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-surface ${dotClass}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div className={`p-3 rounded-lg border transition-colors ${act.pinned ? "bg-secondary-container/10 border-secondary" : "bg-surface-container border-outline-variant/50"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-body-xs font-bold uppercase tracking-wide">{act.type.replace("_", " ")}</span>
                            {act.pinned && <Pin className="w-3 h-3 text-secondary fill-secondary" />}
                            {act.priority && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-body-xs font-semibold">{act.priority}</span>}
                          </div>
                          <span className="text-body-xs text-on-surface-variant shrink-0">{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                        </div>
                        {act.outcome && <p className="text-body-sm text-on-surface mt-1 line-clamp-2">{act.outcome}</p>}
                        {act.leadName && <p className="text-body-xs text-on-surface-variant mt-1">📌 {act.leadName}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {editingKpi && (
        <EditTargetModal
          kpi={editingKpi}
          onClose={() => setEditingKpi(null)}
          onSaved={() => refetchKpis()}
        />
      )}
    </div>
  );
}
