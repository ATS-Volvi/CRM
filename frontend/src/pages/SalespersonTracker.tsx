import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import {
  Users, Search, Plus, Trash2, X, TrendingUp, MapPin, Briefcase,
  Target, Award, ChevronRight, Building2, ChevronDown, Crown,
  Shield, UserCheck, BarChart3, Activity, Star, Eye
} from "lucide-react";

interface Salesperson {
  id: string;
  name: string;
  email?: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  totalLeads: number;
  totalDeals: number;
  department: string;
  territory: string;
  team: string;
  activeKpiCount: number;
  revenueClosed: number;
  targetAchievementPct: number;
  managerId?: string | null;
}

// SVG circular progress ring component
function ProgressRing({ pct, size = 56, stroke = 4, color = "var(--color-primary, #6366f1)" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(100, Math.max(0, pct)) / 100 * circ;
  const cx = size / 2;
  const ringColor = pct >= 90 ? "#10b981" : pct >= 60 ? color : pct >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cx} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="transparent" />
      <circle
        cx={cx} cy={cx} r={r}
        stroke={ringColor}
        strokeWidth={stroke}
        fill="transparent"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function roleLabel(role: string) {
  return role === "sales_rep" ? "Sales Rep"
    : role === "manager" ? "Sales Manager"
    : role === "admin" ? "Admin"
    : role === "director" ? "Director"
    : role;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-600",
  "from-sky-500 to-indigo-600",
];

const TEAM_COLORS: Record<string, string> = {
  "Aces": "from-violet-500 to-indigo-600",
  "Velocity": "from-emerald-500 to-teal-600",
  "Global": "from-blue-500 to-cyan-600",
  "Hawks": "from-orange-500 to-amber-600",
  "Phoenix": "from-rose-500 to-pink-600",
};

const TEAM_ICONS: Record<string, string> = {
  "Aces": "♠",
  "Velocity": "⚡",
  "Global": "🌍",
  "Hawks": "🦅",
  "Phoenix": "🔥",
};

const DEPARTMENTS = ["All", "Sales", "Enterprise", "Commercial", "SMB", "Inside Sales"];
const TERRITORIES = ["All", "EMEA", "APAC", "Americas", "Dubai", "MEA", "South Asia"];
const TEAMS = ["All", "Aces", "Velocity", "Global", "Hawks", "Phoenix"];

export default function SalespersonTracker() {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterTerritory, setFilterTerritory] = useState("All");
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const navigate = useNavigate();

  // Expanded team tracking
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "sales_rep", maxOpenLeads: 20, isAvailable: true,
    managerId: "", department: "Sales", territory: "EMEA", team: "Aces"
  });

  const queryClient = useQueryClient();
  const { data: salespersons = [], isLoading: loading, refetch: fetchSalespersons } = useQuery<Salesperson[]>({
    queryKey: ["salespersonsPerformance"],
    queryFn: async () => {
      try {
        const res = await apiClient("/api/v1/salespersons/performance");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (e) {}

      const res2 = await apiClient("/api/v1/salespersons");
      if (!res2.ok) return [];
      const list = await res2.json();
      return (list || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email || "",
        role: u.role || "sales_rep",
        isAvailable: u.isAvailable ?? true,
        maxOpenLeads: u.maxOpenLeads ?? 35,
        totalLeads: u.totalLeads ?? 0,
        totalDeals: u.totalDeals ?? 0,
        department: u.department || "Sales",
        territory: u.territory || "EMEA",
        team: u.team || "Aces",
        activeKpiCount: 0,
        revenueClosed: 0,
        targetAchievementPct: 0,
        managerId: u.managerId || null,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  const { data: managers = [] } = useQuery<any[]>({
    queryKey: ["salespersonManagers"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/salespersons");
      if (!res.ok) return [];
      const list = await res.json();
      return (list || []).filter((u: any) => u.role === "manager" || u.role === "admin" || u.role === "director");
    },
    staleTime: 5 * 60 * 1000
  });

  const handleToggleAvailability = async (rep: Salesperson) => {
    try {
<<<<<<< HEAD
      // Optimistic update
      queryClient.setQueryData<Salesperson[]>(["salespersonsPerformance"], prev =>
        (prev || []).map(s => s.id === rep.id ? { ...s, isAvailable: !s.isAvailable } : s)
      );
=======
>>>>>>> 8c31a7e (feat: complete CRM architecture and UI redesign (Phases 1-6))
      await apiClient(`/api/v1/settings/availability`, {
        method: "PUT",
        body: JSON.stringify({ isAvailable: !rep.isAvailable, userId: rep.id })
      });
      queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
    } catch (err) {
      console.error(err);
      queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
    }
  };

  const handleDeleteRep = async (id: string) => {
    if (!confirm("Are you sure you want to delete this representative?")) return;
    try {
      const res = await apiClient(`/api/v1/salespersons/${id}`, { method: "DELETE" });
      if (res.ok) {
<<<<<<< HEAD
        queryClient.setQueryData<Salesperson[]>(["salespersonsPerformance"], prev =>
          (prev || []).filter(s => s.id !== id)
        );
=======
        queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
>>>>>>> 8c31a7e (feat: complete CRM architecture and UI redesign (Phases 1-6))
      } else {
        const err = await res.json();
        alert(err.error || "Delete failed.");
      }
    } catch (err: any) { alert(err.message); }
  };

  const submitNewRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await apiClient("/api/v1/salespersons", {
        method: "POST",
        body: JSON.stringify({ ...form, managerId: form.managerId || null })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Something went wrong.");
      } else {
        setIsFormOpen(false);
        setForm({ name: "", email: "", password: "", role: "sales_rep", maxOpenLeads: 20, isAvailable: true, managerId: "", department: "Sales", territory: "EMEA", team: "Aces" });
        await queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
        if (data?.id) navigate(`/salespersons/${data.id}`);
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Apply filters
  const filtered = salespersons.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || (s.department || "").toLowerCase().includes(q) || (s.territory || "").toLowerCase().includes(q);
    const matchDept = filterDept === "All" || (s.department || "Sales") === filterDept;
    const matchTerritory = filterTerritory === "All" || (s.territory || "EMEA") === filterTerritory;
    const matchTeam = filterTeam === "All" || (s.team || "Aces") === filterTeam;
    const matchStatus = filterStatus === "All" || (filterStatus === "Available" ? s.isAvailable : !s.isAvailable);
    return matchSearch && matchDept && matchTerritory && matchTeam && matchStatus;
  });

  // Group by team
  const teamGroups = useMemo(() => {
    const groups: Record<string, { teamLead: Salesperson | null; members: Salesperson[] }> = {};

    filtered.forEach(rep => {
      const teamName = rep.team || "Unassigned";
      if (!groups[teamName]) {
        groups[teamName] = { teamLead: null, members: [] };
      }

      // Identify team lead: manager, admin, or director role
      const isLead = rep.role === "manager" || rep.role === "admin" || rep.role === "director";
      if (isLead && !groups[teamName].teamLead) {
        groups[teamName].teamLead = rep;
      } else {
        groups[teamName].members.push(rep);
      }
    });

    // Sort teams by name, but put "Unassigned" last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const toggleTeam = (teamName: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
  };

  // Aggregate stats for a team
  const getTeamStats = (teamLead: Salesperson | null, members: Salesperson[]) => {
    const all = teamLead ? [teamLead, ...members] : members;
    const totalMembers = all.length;
    const availableCount = all.filter(m => m.isAvailable).length;
    const totalRevenue = all.reduce((acc, m) => acc + (m.revenueClosed || 0), 0);
    const totalLeads = all.reduce((acc, m) => acc + (m.totalLeads || 0), 0);
    const totalDeals = all.reduce((acc, m) => acc + (m.totalDeals || 0), 0);
    const avgAchievement = totalMembers > 0
      ? Math.round(all.reduce((acc, m) => acc + (m.targetAchievementPct || 0), 0) / totalMembers)
      : 0;
    return { totalMembers, availableCount, totalRevenue, totalLeads, totalDeals, avgAchievement };
  };

  const formatRevenue = (val: number) => {
    if (val >= 1000000) return `₹${(val / 1000000).toFixed(1)}M`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Team Hub</h2>
            <p className="text-xs text-on-surface-variant font-medium">Teams · Team Leads · Members · Performance</p>
          </div>
        </div>
        <button
          onClick={() => setIsFormOpen(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm whitespace-nowrap"
        >
          {isFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isFormOpen ? "Cancel" : "Add Representative"}
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Sales Reps</span>
          <p className="text-xl font-black text-foreground">{salespersons.length}</p>
          <span className="text-[11px] text-muted-foreground font-semibold">{salespersons.filter(s => s.isAvailable).length} available for routing</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Closed Revenue</span>
          <p className="text-xl font-black text-emerald-600">
            {formatRevenue(salespersons.reduce((acc, s) => acc + (s.revenueClosed || 0), 0))}
          </p>
          <span className="text-[11px] text-muted-foreground font-semibold">Attributed sales volume</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Quota Attainment</span>
          <p className="text-xl font-black text-amber-600">
            {salespersons.length > 0
              ? Math.round(salespersons.reduce((acc, s) => acc + (s.targetAchievementPct || 0), 0) / salespersons.length)
              : 0}%
          </p>
          <span className="text-[11px] text-muted-foreground font-semibold">Team performance average</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Teams</span>
          <p className="text-xl font-black text-purple-600">{teamGroups.length}</p>
          <span className="text-[11px] text-muted-foreground font-semibold">Across all territories</span>
        </div>
      </div>

      {/* Registration Form */}
      {isFormOpen && (
        <form onSubmit={submitNewRep} className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">Register Sales Representative</h3>
          {formError && <div className="text-xs font-bold text-error bg-error-container/30 border border-error/20 p-2.5 rounded-lg">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Full Name *", type: "text", key: "name", placeholder: "e.g. John Doe", required: true },
              { label: "Email Address *", type: "email", key: "email", placeholder: "e.g. john@company.com", required: true },
              { label: "Password *", type: "password", key: "password", placeholder: "Min. 8 characters", required: true },
            ].map(({ label, type, key, placeholder, required }) => (
              <div key={key}>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  type={type} required={required}
                  value={(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            ))}

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                <option value="sales_rep">Sales Representative</option>
                <option value="manager">Sales Manager</option>
                <option value="director">Director</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Department</label>
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                {DEPARTMENTS.filter(d => d !== "All").map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Territory</label>
              <select value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                {TERRITORIES.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Team</label>
              <select value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                {TEAMS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Max Lead Cap</label>
              <input type="number" value={form.maxOpenLeads}
                onChange={e => setForm({ ...form, maxOpenLeads: parseInt(e.target.value) || 20 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reporting Manager</label>
              <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                <option value="">No Manager (Self)</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60">
              {submitting ? "Registering..." : "Register Account"}
            </button>
          </div>
        </form>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-3.5 h-3.5" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search team members..."
            className="w-full bg-surface border border-outline rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
        {[
          { label: "Dept", options: DEPARTMENTS, value: filterDept, onChange: setFilterDept },
          { label: "Territory", options: TERRITORIES, value: filterTerritory, onChange: setFilterTerritory },
          { label: "Team", options: TEAMS, value: filterTeam, onChange: setFilterTeam },
          { label: "Status", options: ["All", "Available", "OOO / Busy"], value: filterStatus, onChange: setFilterStatus },
        ].map(({ label, options, value, onChange }) => (
          <select key={label} value={value} onChange={e => onChange(e.target.value)}
            className="bg-surface border border-outline rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer text-on-surface">
            {options.map(o => <option key={o} value={o}>{label}: {o}</option>)}
          </select>
        ))}
        <span className="ml-auto text-xs text-on-surface-variant font-semibold">
          {filtered.length} of {salespersons.length} team members
        </span>
      </div>

      {/* TEAM-FIRST VIEW */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 animate-pulse space-y-3">
              <div className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-xl bg-surface-container-low" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-container-low rounded w-1/3" />
                  <div className="h-3 bg-surface-container-low rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : teamGroups.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center">
          <Users className="w-8 h-8 text-on-surface-variant mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold text-on-surface-variant">No teams found.</p>
          <p className="text-xs text-on-surface-variant opacity-60 mt-1">Try adjusting your filters or adding a new rep.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teamGroups.map(([teamName, { teamLead, members }], teamIdx) => {
            const isExpanded = expandedTeams.has(teamName);
            const stats = getTeamStats(teamLead, members);
            const gradientClass = TEAM_COLORS[teamName] || AVATAR_GRADIENTS[teamIdx % AVATAR_GRADIENTS.length];
            const teamIcon = TEAM_ICONS[teamName] || "👥";
            const pctColor = stats.avgAchievement >= 90 ? "text-emerald-600" : stats.avgAchievement >= 60 ? "text-primary" : stats.avgAchievement >= 30 ? "text-amber-500" : "text-rose-500";

            return (
              <div key={teamName} className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">

                {/* TEAM CARD HEADER — Always visible */}
                <button
                  onClick={() => toggleTeam(teamName)}
                  className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface-container-low/30 transition-colors"
                >
                  {/* Team Identity */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Team Icon */}
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-2xl shadow-sm flex-shrink-0`}>
                      {teamIcon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-black text-on-surface">Team {teamName}</h3>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full">
                          {stats.totalMembers} {stats.totalMembers === 1 ? "member" : "members"}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold rounded-full">
                          {stats.availableCount} online
                        </span>
                      </div>

                      {/* Team Lead Info */}
                      {teamLead ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-bold text-on-surface">{teamLead.name}</span>
                          <span className="text-[10px] font-semibold text-on-surface-variant">· {roleLabel(teamLead.role)}</span>
                          {teamLead.territory && (
                            <span className="flex items-center gap-0.5 text-[10px] text-on-surface-variant font-medium">
                              <MapPin className="w-2.5 h-2.5" /> {teamLead.territory}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Shield className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-on-surface-variant italic font-medium">No designated team lead</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Team Stats Summary */}
                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Quota</p>
                      <p className={`text-lg font-black ${pctColor}`}>{stats.avgAchievement}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Revenue</p>
                      <p className="text-lg font-black text-on-surface">{formatRevenue(stats.totalRevenue)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Leads</p>
                      <p className="text-lg font-black text-on-surface">{stats.totalLeads}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Deals</p>
                      <p className="text-lg font-black text-on-surface">{stats.totalDeals}</p>
                    </div>

                    {/* Expand/Collapse indicator */}
                    <div className={`p-1.5 rounded-lg border border-outline-variant transition-transform ${isExpanded ? "rotate-180 bg-primary/10" : ""}`}>
                      <ChevronDown className={`w-4 h-4 ${isExpanded ? "text-primary" : "text-on-surface-variant"}`} />
                    </div>
                  </div>
                </button>

                {/* EXPANDED: Team Members Grid */}
                {isExpanded && (
                  <div className="border-t border-outline-variant bg-surface-container-low/20 px-5 pt-4 pb-5 space-y-4">

                    {/* Team Lead Card (highlighted) */}
                    {teamLead && (
                      <div className="mb-3">
                        <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-600 uppercase tracking-wider mb-2">
                          <Crown className="w-3 h-3" /> Team Lead
                        </span>
                        <div
                          onClick={() => navigate(`/salespersons/${teamLead.id}`)}
                          className="group bg-surface-container-lowest border-2 border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer flex items-center gap-4"
                        >
                          <div className="relative flex-shrink-0">
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold text-sm ring-2 ring-amber-300`}>
                              {getInitials(teamLead.name)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${teamLead.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{teamLead.name}</p>
                            <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(teamLead.role)} · {teamLead.department || "Sales"} · {teamLead.territory || "EMEA"}</p>
                            {teamLead.email && <p className="text-[10px] font-mono text-primary truncate">{teamLead.email}</p>}
                          </div>

                          <div className="flex items-center gap-6 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase">Target</p>
                              <p className={`text-lg font-black ${teamLead.targetAchievementPct >= 90 ? "text-emerald-600" : teamLead.targetAchievementPct >= 60 ? "text-primary" : "text-amber-500"}`}>
                                {teamLead.targetAchievementPct || 0}%
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase">Revenue</p>
                              <p className="text-lg font-black text-on-surface">{formatRevenue(teamLead.revenueClosed || 0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase">Leads</p>
                              <p className="text-sm font-black text-on-surface">{teamLead.totalLeads}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase">Deals</p>
                              <p className="text-sm font-black text-on-surface">{teamLead.totalDeals}</p>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              View <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Team Members */}
                    <div>
                      <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">
                        <Users className="w-3 h-3" /> Team Members ({members.length})
                      </span>

                      {members.length === 0 ? (
                        <div className="text-center py-6 text-xs text-on-surface-variant font-medium italic">
                          No additional team members found.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {members.map((rep, idx) => {
                            const memberGrad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                            const pct = rep.targetAchievementPct || 0;
                            const memPctColor = pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-primary" : pct >= 30 ? "text-amber-500" : "text-rose-500";

                            return (
                              <div
                                key={rep.id}
                                onClick={() => navigate(`/salespersons/${rep.id}`)}
                                className="group bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                              >
                                {/* Status dot */}
                                <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />

                                {/* Avatar + Info */}
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="relative flex-shrink-0">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${memberGrad} flex items-center justify-center text-white font-bold text-xs`}>
                                      {getInitials(rep.name)}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1">
                                      <ProgressRing pct={pct} size={22} stroke={2} />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{rep.name}</p>
                                    <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(rep.role)}</p>
                                    {rep.email && <p className="text-[10px] font-mono text-primary truncate">{rep.email}</p>}
                                  </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="text-[9px] font-bold text-on-surface-variant uppercase">Target</p>
                                    <p className={`text-base font-black ${memPctColor}`}>{pct}%</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] font-bold text-on-surface-variant uppercase">Revenue</p>
                                    <p className="text-sm font-black text-on-surface">{formatRevenue(rep.revenueClosed || 0)}</p>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-3">
                                  <div className="h-1 bg-surface-container-low rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Metadata chips */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container-low rounded-full text-[9px] font-semibold text-on-surface-variant">
                                    <Building2 className="w-2 h-2" /> {rep.department || "Sales"}
                                  </span>
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container-low rounded-full text-[9px] font-semibold text-on-surface-variant">
                                    <MapPin className="w-2 h-2" /> {rep.territory || "EMEA"}
                                  </span>
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2 text-center border-t border-outline-variant pt-2">
                                  <div>
                                    <p className="text-xs font-black text-on-surface">{rep.totalLeads}</p>
                                    <p className="text-[8px] text-on-surface-variant font-semibold">Leads</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-on-surface">{rep.totalDeals}</p>
                                    <p className="text-[8px] text-on-surface-variant font-semibold">Deals</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-on-surface">{rep.activeKpiCount || 0}</p>
                                    <p className="text-[8px] text-on-surface-variant font-semibold">KPIs</p>
                                  </div>
                                </div>

                                {/* Footer action */}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant">
                                  <button
                                    onClick={e => { e.stopPropagation(); handleToggleAvailability(rep); }}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                                      rep.isAvailable
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                    }`}
                                  >
                                    {rep.isAvailable ? "● Available" : "○ OOO"}
                                  </button>
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Profile <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
