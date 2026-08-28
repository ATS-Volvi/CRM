import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import {
  Users, Search, Plus, X, MapPin, Building2, ChevronDown, Crown,
  UserCheck, BarChart3, ChevronRight, Mail, UserPlus,
  ShieldCheck
} from "lucide-react";
import { formatCurrency } from "../utils/currency";

interface Salesperson {
  id: string;
  name: string;
  email?: string;
  role: string;
  tier?: string | null;
  dealValueCutoff?: number | null;
  isAvailable: boolean;
  maxOpenLeads?: number | null;
  totalLeads: number;
  totalDeals: number;
  department: string;
  territory: string;
  team: string;
  activeKpiCount: number;
  revenueClosed: number;
  targetAchievementPct: number;
  managerId?: string | null;
  hireDate?: string | null;
  phone?: string | null;
  createdByUserId?: string | null;
  createdByUser?: { id: string; name: string; email: string } | null;
  manager?: { id: string; name: string; email: string; role: string } | null;
  teamMembers?: any[];
}

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
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function roleLabel(role: string, tier?: string | null) {
  if (role === "sales_rep") {
    return tier === "executive" ? "Sales Rep (Executive)" : "Sales Rep (Agent)";
  }
  return role === "manager" ? "Sales Manager"
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

const DEPARTMENTS = ["All", "Sales", "Enterprise", "Commercial", "SMB", "Inside Sales"];
const TERRITORIES = ["All", "EMEA", "APAC", "Americas", "Dubai", "MEA", "South Asia"];
const TEAMS = ["All", "Aces", "Velocity", "Global", "Hawks", "Phoenix"];

export default function SalespersonTracker() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"performance" | "orgchart">("performance");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterTerritory, setFilterTerritory] = useState("All");
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const [orgSearch, setOrgSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "sales_rep", tier: "agent", maxOpenLeads: 20, isAvailable: true,
    managerId: "", department: "Sales", territory: "EMEA", team: "Aces",
    hireDate: new Date().toISOString().split("T")[0], phone: ""
  });

  const { data: salespersons = [] } = useQuery<Salesperson[]>({
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
        tier: u.tier || null,
        dealValueCutoff: u.dealValueCutoff !== undefined ? u.dealValueCutoff : null,
        isAvailable: u.isAvailable ?? true,
        maxOpenLeads: u.maxOpenLeads,
        totalLeads: u.totalLeads ?? 0,
        totalDeals: u.totalDeals ?? 0,
        department: u.department || "Sales",
        territory: u.territory || "EMEA",
        team: u.team || "Aces",
        activeKpiCount: 0,
        revenueClosed: 0,
        targetAchievementPct: 0,
        managerId: u.managerId || null,
        hireDate: u.hireDate,
        phone: u.phone,
        createdByUserId: u.createdByUserId,
      }));
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: orgChartEmployees = [] } = useQuery<any[]>({
    queryKey: ["orgChartEmployees"],
    queryFn: async () => {
      const res = await apiClient("/api/v1/salespersons/org-chart");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 2 * 60 * 1000
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

  const availableManagers = useMemo(() => {
    if (!currentUser) return managers;
    if (currentUser.role === "manager") {
      return managers.filter(m => m.id === currentUser.id || m.managerId === currentUser.id);
    }
    return managers;
  }, [managers, currentUser]);

  const handleToggleAvailability = async (rep: Salesperson) => {
    try {
      const willBeAvailable = !rep.isAvailable;
      queryClient.setQueryData<Salesperson[]>(["salespersonsPerformance"], prev =>
        (prev || []).map(s => s.id === rep.id ? { ...s, isAvailable: willBeAvailable } : s)
      );
      await apiClient(`/api/v1/settings/availability`, {
        method: "PUT",
        body: JSON.stringify({ isAvailable: willBeAvailable, userId: rep.id })
      });
      queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    } catch (err) {
      console.error(err);
      queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
    }
  };

  const submitNewRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    let managerIdToSubmit = form.managerId || null;
    if (currentUser?.role === "manager") {
      managerIdToSubmit = form.managerId || currentUser.id;
    }

    try {
      const payload: any = {
        ...form,
        managerId: managerIdToSubmit,
        tier: form.role === "sales_rep" ? form.tier : null,
        maxOpenLeads: form.role === "sales_rep" ? form.maxOpenLeads : null
      };

      const res = await apiClient("/api/v1/salespersons", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Something went wrong.");
      } else {
        setIsFormOpen(false);
        setForm({
          name: "", email: "", password: "", role: "sales_rep", tier: "agent",
          maxOpenLeads: 20, isAvailable: true, managerId: "",
          department: "Sales", territory: "EMEA", team: "Aces",
          hireDate: new Date().toISOString().split("T")[0], phone: ""
        });
        await queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
        await queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
        if (data?.id && activeTab === "performance") navigate(`/salespersons/${data.id}`);
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = salespersons.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || (s.department || "").toLowerCase().includes(q) || (s.territory || "").toLowerCase().includes(q);
    const matchDept = filterDept === "All" || (s.department || "Sales") === filterDept;
    const matchTerritory = filterTerritory === "All" || (s.territory || "EMEA") === filterTerritory;
    const matchTeam = filterTeam === "All" || (s.team || "Aces") === filterTeam;
    const matchStatus = filterStatus === "All" || (filterStatus === "Available" ? s.isAvailable : !s.isAvailable);
    return matchSearch && matchDept && matchTerritory && matchTeam && matchStatus;
  });

  const teamGroups = useMemo(() => {
    const groups: Record<string, { teamLead: Salesperson | null; members: Salesperson[] }> = {};

    filtered.forEach(rep => {
      const teamName = rep.team || "Unassigned";
      if (!groups[teamName]) {
        groups[teamName] = { teamLead: null, members: [] };
      }
      const isLead = rep.role === "manager" || rep.role === "admin" || rep.role === "director";
      if (isLead && !groups[teamName].teamLead) {
        groups[teamName].teamLead = rep;
      } else {
        groups[teamName].members.push(rep);
      }
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const toggleTeam = (teamName: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  };

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

  const filteredOrgEmployees = useMemo(() => {
    const q = orgSearch.toLowerCase();
    if (!q) return orgChartEmployees;
    return orgChartEmployees.filter((e: any) =>
      e.name.toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.role || "").toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q)
    );
  }, [orgChartEmployees, orgSearch]);

  const orgTree = useMemo(() => {
    const empMap = new Map<string, any>();
    filteredOrgEmployees.forEach((e: any) => {
      empMap.set(e.id, { ...e, children: [] });
    });

    const roots: any[] = [];
    filteredOrgEmployees.forEach((e: any) => {
      const node = empMap.get(e.id);
      if (e.managerId && empMap.has(e.managerId)) {
        empMap.get(e.managerId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [filteredOrgEmployees]);

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-6 animate-fade-in">

      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <UserCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Business Users</h2>
            <p className="text-xs text-on-surface-variant font-medium">Company Directory · Performance Hub · Organization Chart</p>
          </div>
        </div>

        {["admin", "director", "manager"].includes(currentUser?.role || "") && (
          <button
            onClick={() => setIsFormOpen(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm whitespace-nowrap"
          >
            {isFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isFormOpen ? "Cancel" : "Add New Employee"}
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-outline-variant">
        <button
          onClick={() => setActiveTab("performance")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "performance"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Sales Performance
        </button>

        <button
          onClick={() => setActiveTab("orgchart")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === "orgchart"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Org Chart & Directory
          <span className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full font-bold">
            {orgChartEmployees.length}
          </span>
        </button>
      </div>

      {/* Registration Form Modal */}
      {isFormOpen && (
        <form onSubmit={submitNewRep} className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">Add New Employee</h3>
          {formError && <div className="text-xs font-bold text-error bg-error-container/30 border border-error/20 p-2.5 rounded-lg">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name *</label>
              <input
                type="text" required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Jane Smith"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email Address *</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. jane@company.com"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Password *</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 8 characters"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Personal Phone Number</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +966 50 123 4567"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Hire Date</label>
              <input
                type="date"
                value={form.hireDate}
                onChange={e => setForm({ ...form, hireDate: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={e => {
                const newRole = e.target.value;
                setForm({ ...form, role: newRole, tier: newRole === "sales_rep" ? "agent" : "" });
              }}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                <option value="sales_rep">Sales Representative</option>
                <option value="manager">Sales Manager</option>
                <option value="director">Director</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {/* Rep Tier Dropdown - Only for Sales Representatives */}
            {form.role === "sales_rep" && (
              <div>
                <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Rep Tier & Closing Authority</label>
                <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
                  className="w-full bg-surface border-2 border-primary/40 rounded-lg p-2.5 text-xs font-bold text-primary focus:outline-none cursor-pointer">
                  <option value="agent">Agent (Junior Rep - Default 50k Cutoff)</option>
                  <option value="executive">Executive (Senior Rep - Default 250k Cutoff)</option>
                </select>
              </div>
            )}

            {/* Max Lead Cap - Only for Sales Representatives */}
            {form.role === "sales_rep" && (
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Max Lead Cap</label>
                <input type="number" value={form.maxOpenLeads}
                  onChange={e => setForm({ ...form, maxOpenLeads: parseInt(e.target.value) || 20 })}
                  className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </div>
            )}

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
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reporting Manager</label>
              <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer">
                <option value="">No Manager (Self / Direct Top-level)</option>
                {availableManagers.map(m => <option key={m.id} value={m.id}>{m.name} ({roleLabel(m.role)})</option>)}
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
              {submitting ? "Registering..." : "Register Employee"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 1: SALES PERFORMANCE */}
      {activeTab === "performance" && (
        <div className="space-y-6">
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
              <p className="text-xl font-black text-primary">{teamGroups.length}</p>
              <span className="text-[11px] text-muted-foreground font-semibold">Sales units</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-3.5 h-3.5" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40" />
            </div>

            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="bg-surface border border-outline rounded-lg px-2.5 py-1.5 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
              {DEPARTMENTS.map(d => <option key={d} value={d}>Dept: {d}</option>)}
            </select>

            <select value={filterTerritory} onChange={e => setFilterTerritory(e.target.value)}
              className="bg-surface border border-outline rounded-lg px-2.5 py-1.5 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
              {TERRITORIES.map(t => <option key={t} value={t}>Territory: {t}</option>)}
            </select>

            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="bg-surface border border-outline rounded-lg px-2.5 py-1.5 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
              {TEAMS.map(t => <option key={t} value={t}>Team: {t}</option>)}
            </select>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-surface border border-outline rounded-lg px-2.5 py-1.5 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
              <option value="All">Status: All</option>
              <option value="Available">Available</option>
              <option value="OOO">OOO / Unavailable</option>
            </select>

            {(search || filterDept !== "All" || filterTerritory !== "All" || filterTeam !== "All" || filterStatus !== "All") && (
              <button onClick={() => { setSearch(""); setFilterDept("All"); setFilterTerritory("All"); setFilterTeam("All"); setFilterStatus("All"); }}
                className="text-[11px] text-primary font-bold hover:underline px-1">
                Clear Filters
              </button>
            )}
          </div>

          {teamGroups.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest border border-outline rounded-2xl">
              <p className="text-xs text-on-surface-variant font-medium">No sales representatives match the current filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamGroups.map(([teamName, { teamLead, members }]) => {
                const isExpanded = expandedTeams.has(teamName);
                const stats = getTeamStats(teamLead, members);
                const gradientClass = AVATAR_GRADIENTS[Math.abs(teamName.length) % AVATAR_GRADIENTS.length];
                const pctColor = stats.avgAchievement >= 90 ? "text-emerald-600" : stats.avgAchievement >= 60 ? "text-primary" : "text-amber-500";

                return (
                  <div key={teamName} className="bg-surface-container-lowest border border-outline rounded-2xl overflow-hidden shadow-2xs">
                    <button
                      onClick={() => toggleTeam(teamName)}
                      className="w-full p-5 flex items-center justify-between hover:bg-surface-container-low/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold text-sm shadow-xs`}>
                          {teamName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-on-surface text-base">{teamName} Team</h3>
                            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                              {stats.totalMembers} Member{stats.totalMembers !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                            Lead: <span className="font-bold text-on-surface">{teamLead ? teamLead.name : "Unassigned"}</span> · {stats.availableCount}/{stats.totalMembers} Available
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Quota Attainment</p>
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

                        <div className={`p-1.5 rounded-lg border border-outline-variant transition-transform ${isExpanded ? "rotate-180 bg-primary/10" : ""}`}>
                          <ChevronDown className={`w-4 h-4 ${isExpanded ? "text-primary" : "text-on-surface-variant"}`} />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-outline-variant bg-surface-container-low/20 px-5 pt-4 pb-5 space-y-4">
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
                                <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(teamLead.role, teamLead.tier)} · {teamLead.department || "Sales"} · {teamLead.territory || "EMEA"}</p>
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
                                    <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />

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
                                        <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(rep.role, rep.tier)}</p>
                                        {rep.email && <p className="text-[10px] font-mono text-primary truncate">{rep.email}</p>}
                                      </div>
                                    </div>

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

                                    <div className="mb-3">
                                      <div className="h-1 bg-surface-container-low rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                                          style={{ width: `${Math.min(100, pct)}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container-low rounded-full text-[9px] font-semibold text-on-surface-variant">
                                        <Building2 className="w-2 h-2" /> {rep.department || "Sales"}
                                      </span>
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container-low rounded-full text-[9px] font-semibold text-on-surface-variant">
                                        <MapPin className="w-2 h-2" /> {rep.territory || "EMEA"}
                                      </span>
                                    </div>

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
      )}

      {/* TAB 2: ORG CHART & DIRECTORY */}
      {activeTab === "orgchart" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between bg-surface-container-lowest border border-outline rounded-xl p-4 shadow-2xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input
                type="text"
                value={orgSearch}
                onChange={e => setOrgSearch(e.target.value)}
                placeholder="Search employees by name, role, department or email..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              Showing <strong>{filteredOrgEmployees.length}</strong> of <strong>{orgChartEmployees.length}</strong> total employees
            </div>
          </div>

          {orgTree.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-lowest border border-outline rounded-2xl">
              <p className="text-xs text-on-surface-variant font-medium">No employees found matching the search criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orgTree.map(rootNode => (
                <OrgTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  onSelect={emp => setSelectedEmployee(emp)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* EMPLOYEE DETAIL DRAWER / MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest h-full shadow-2xl overflow-y-auto flex flex-col border-l border-outline animate-slide-left">

            {/* Header */}
            <div className="p-6 bg-gradient-to-b from-primary/10 to-transparent border-b border-outline-variant relative">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md flex-shrink-0">
                  {getInitials(selectedEmployee.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-on-surface truncate">{selectedEmployee.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                      {roleLabel(selectedEmployee.role, selectedEmployee.tier)}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                      selectedEmployee.isAvailable ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {selectedEmployee.isAvailable ? "● Available" : "○ OOO"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">

              {/* Rep Tier & Closing Authority Section (For Sales Reps) */}
              {selectedEmployee.role === "sales_rep" && (
                <div className="space-y-3 bg-gradient-to-br from-primary/5 to-purple-500/5 p-4 rounded-xl border border-primary/20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-extrabold uppercase text-primary tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Closing Authority & Rep Tier
                    </h4>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                      (selectedEmployee.tier || "agent") === "executive"
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-blue-100 text-blue-800 border border-blue-300"
                    }`}>
                      {(selectedEmployee.tier || "agent") === "executive" ? "Executive (Senior)" : "Agent (Junior)"}
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant font-medium">Closing Cutoff Threshold:</span>
                      <span className="font-mono font-bold text-primary text-sm">
                        {selectedEmployee.dealValueCutoff !== null && selectedEmployee.dealValueCutoff !== undefined
                          ? formatCurrency(Number(selectedEmployee.dealValueCutoff))
                          : formatCurrency(selectedEmployee.tier === "executive" ? 250000 : 50000)}
                      </span>
                    </div>

                    {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                      <div className="pt-2 border-t border-primary/10 space-y-2">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase">Update Rep Tier & Default Authority</label>
                        <div className="flex gap-2">
                          <select
                            value={selectedEmployee.tier || "agent"}
                            onChange={async (e) => {
                              const newTier = e.target.value;
                              const newCutoff = newTier === "executive" ? 250000 : 50000;
                              try {
                                await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
                                  method: "PUT",
                                  body: JSON.stringify({ tier: newTier, dealValueCutoff: newCutoff })
                                });
                                setSelectedEmployee({ ...selectedEmployee, tier: newTier, dealValueCutoff: newCutoff });
                                queryClient.invalidateQueries({ queryKey: ["salespersonsPerformance"] });
                                queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
                              } catch (err: any) {
                                alert("Failed to update tier: " + err.message);
                              }
                            }}
                            className="flex-1 bg-surface border border-outline rounded-lg p-2 text-xs font-bold cursor-pointer"
                          >
                            <option value="agent">Agent (Junior - 50k Cutoff)</option>
                            <option value="executive">Executive (Senior - 250k Cutoff)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="space-y-3 bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/60">
                <h4 className="text-[10px] font-extrabold uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Contact Details
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Email:</span>
                    <a href={`mailto:${selectedEmployee.email}`} className="font-mono text-primary font-bold hover:underline truncate max-w-[220px]">
                      {selectedEmployee.email || "N/A"}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Personal Phone:</span>
                    <a href={selectedEmployee.phone ? `tel:${selectedEmployee.phone}` : undefined} className="font-semibold text-on-surface">
                      {selectedEmployee.phone || selectedEmployee.dedicatedPhone || "Not recorded"}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Hire Date:</span>
                    <span className="font-semibold text-on-surface">
                      {selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Not recorded"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Department / Team:</span>
                    <span className="font-semibold text-on-surface">
                      {selectedEmployee.department || "Sales"} · {selectedEmployee.team || "Aces"}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Onboarding Info */}
              <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/60 space-y-1">
                <h4 className="text-[10px] font-extrabold uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary" /> System Onboarding Record
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Added by <strong className="text-on-surface font-bold">{selectedEmployee.createdByUser?.name || "System Administrator"}</strong>
                  {selectedEmployee.createdAt && ` on ${new Date(selectedEmployee.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
                </p>
              </div>

              {/* Reporting Manager Section */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500" /> Reporting Manager
                </h4>

                {selectedEmployee.manager ? (
                  <div
                    onClick={() => {
                      const mgr = orgChartEmployees.find(e => e.id === selectedEmployee.manager.id);
                      if (mgr) setSelectedEmployee(mgr);
                    }}
                    className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:border-amber-500/50 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                        {getInitials(selectedEmployee.manager.name)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{selectedEmployee.manager.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(selectedEmployee.manager.role)} · {selectedEmployee.manager.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant italic">
                    Top-level executive (No reporting manager assigned).
                  </div>
                )}
              </div>

              {/* Direct Reports Section */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Direct Reports ({
                    selectedEmployee.teamMembers?.length ||
                    orgChartEmployees.filter(e => e.managerId === selectedEmployee.id).length
                  })
                </h4>

                {(() => {
                  const reports = selectedEmployee.teamMembers || orgChartEmployees.filter(e => e.managerId === selectedEmployee.id);
                  if (reports.length === 0) {
                    return (
                      <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant italic">
                        No direct reports assigned to this employee.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {reports.map((rep: any) => (
                        <div
                          key={rep.id}
                          onClick={() => {
                            const found = orgChartEmployees.find(e => e.id === rep.id);
                            if (found) setSelectedEmployee(found);
                          }}
                          className="p-3 bg-surface-container-lowest border border-outline-variant rounded-xl hover:border-primary transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                              {getInitials(rep.name)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{rep.name}</p>
                              <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(rep.role, rep.tier)}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary transition-colors" />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function OrgTreeNode({ node, level = 0, onSelect }: { node: any; level?: number; onSelect: (emp: any) => void }) {
  const hasChildren = node.children && node.children.length > 0;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-surface-container-lowest border border-outline rounded-xl overflow-hidden shadow-2xs">
      <div
        onClick={() => onSelect(node)}
        className="p-4 hover:bg-surface-container-low/40 flex items-center justify-between cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {getInitials(node.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">{node.name}</span>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                {roleLabel(node.role, node.tier)}
              </span>
              {hasChildren && (
                <span className="px-2 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded-full">
                  {node.children.length} Report{node.children.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="text-xs text-on-surface-variant font-medium mt-0.5">
              {node.email} · {node.department || "Sales"} · {node.territory || "EMEA"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
              className="p-1 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180 text-primary" : ""}`} />
            </button>
          )}
          <span className="text-[11px] font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Details <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="pl-6 border-l-2 border-primary/20 ml-6 my-2 space-y-2 pr-3 pb-2">
          {node.children.map((child: any) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
