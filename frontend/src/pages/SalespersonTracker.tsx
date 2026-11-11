import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import {
  Users, Search, Plus, X, MapPin, Building2, ChevronDown, Crown,
  UserCheck, BarChart3, ChevronRight, Mail, UserPlus,
  ShieldCheck, Target, Wrench, ClipboardCheck, Briefcase,
  Calendar, CalendarDays, Trash2, Edit3, Save, Clock, ExternalLink
} from "lucide-react";
import { formatCurrency } from "../utils/currency";
import KpiAttainmentTable from "../components/KpiAttainmentTable";
import { ALLOWED_USER_ROLES } from "../types/common";

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
  revenueTarget?: number;
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

export const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Representative",
  senior_ae: "Senior Account Executive",
  manager: "Sales Manager",
  sales_manager: "Sales Manager (Operational)",
  director: "Director",
  admin: "Administrator",
  site_manager: "Field Inspector / Site Surveyor",
  ops_manager: "Operations Manager",
  technician: "Field Service Technician",
};

export type DivisionCategory = "all" | "presales" | "sales" | "inspector" | "tech" | "management";

export function getEmployeeDivisionCategory(e: any): "presales" | "sales" | "inspector" | "tech" | "management" {
  if (!e) return "presales";
  if (["admin", "director", "manager", "sales_manager", "ops_manager"].includes(e.role)) {
    return "management";
  }
  if (e.role === "technician" || Boolean(e.serviceResource)) {
    return "tech";
  }
  if (e.role === "site_manager" || Boolean(e.inspectorProfile) || (e.department && String(e.department).toLowerCase().includes("inspect"))) {
    return "inspector";
  }
  if (e.role === "senior_ae" || (e.role === "sales_rep" && e.tier === "executive") || (e.department && (String(e.department).toLowerCase().includes("commercial") || String(e.department).toLowerCase().includes("enterprise")))) {
    return "sales";
  }
  return "presales"; // Default for sales_rep (agent) / inside sales / SDR
}

function roleLabel(role: string, tier?: string | null) {
  if (role === "sales_rep") {
    return tier === "executive" ? "Sales Closer (Executive AE)" : "Pre-Sales / SDR (Agent)";
  }
  if (role === "senior_ae") {
    return "Senior Account Executive (Closer)";
  }
  if (role === "site_manager") {
    return "Field Inspector (Site Feasibility)";
  }
  if (role === "technician") {
    return "Field Service Technician";
  }
  return ROLE_LABELS[role] || role;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-600",
  "from-sky-500 to-indigo-600",
];

const DEPARTMENTS = ["All", "Sales", "Enterprise", "Commercial", "SMB", "Inside Sales", "Field Service"];
const TERRITORIES = ["All", "EMEA", "APAC", "Americas", "Dubai", "MEA", "South Asia"];
const TEAMS = ["All", "Aces", "Velocity", "Global", "Hawks", "Phoenix"];

export default function SalespersonTracker() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const deepLinkTeamId = searchParams.get("teamId");
  const deepLinkView = searchParams.get("view");

  const [activeTab, setActiveTab] = useState<"performance" | "orgchart">("performance");
  const [perfSubTab, setPerfSubTab] = useState<"overview" | "kpi">("overview");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterTerritory, setFilterTerritory] = useState("All");
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterKpiTeam, setFilterKpiTeam] = useState<string>("All");

  const [orgSearch, setOrgSearch] = useState("");
  const [orgRoleFilter, setOrgRoleFilter] = useState<DivisionCategory>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // In-drawer technician qualifications edit mode
  const [isEditingQualifications, setIsEditingQualifications] = useState(false);
  const [qualForm, setQualForm] = useState({
    skills: "",
    certifications: "",
    experienceYears: 0,
    previousExperience: "",
    territory: "",
    attendanceStatus: "On Duty"
  });

  // In-drawer planned absence / leave scheduler
  const [isAddingLeave, setIsAddingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: "",
    endDate: "",
    leaveType: "Vacation",
    leaveReason: ""
  });

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [teamSubTabs, setTeamSubTabs] = useState<Record<string, "members" | "kpi">>({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "sales_rep", tier: "agent", maxOpenLeads: 20, isAvailable: true,
    managerId: "", department: "Sales", territory: "EMEA", team: "Aces",
    hireDate: new Date().toISOString().split("T")[0], phone: "",
    skills: "", certifications: "", experienceYearsWithCompany: 0,
    previousExperience: "", attendanceStatus: "On Duty",
    maxOpenInspections: 5, maxVisitsPerDay: 3, maxDistanceKm: 50, inspectorCertifications: ""
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
        activeKpiCount: u.activeKpiCount || 0,
        revenueClosed: Number(u.revenueClosed || 0),
        revenueTarget: Number(u.revenueTarget || 0),
        targetAchievementPct: Number(u.targetAchievementPct || 0),
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

  useEffect(() => {
    if (selectedEmployee) {
      setIsEditingQualifications(false);
      setIsAddingLeave(false);
      const res = selectedEmployee.serviceResource;
      setQualForm({
        skills: Array.isArray(res?.skills) ? res.skills.join(", ") : "",
        certifications: Array.isArray(res?.certifications) ? res.certifications.join(", ") : "",
        experienceYears: res?.experienceYearsWithCompany || 0,
        previousExperience: res?.previousExperience || "",
        territory: res?.location || selectedEmployee.territory || "",
        attendanceStatus: res?.attendanceStatus || "On Duty"
      });
      setLeaveForm({
        startDate: "",
        endDate: "",
        leaveType: "Vacation",
        leaveReason: ""
      });
    }
  }, [selectedEmployee]);

  const handleSaveQualifications = async () => {
    if (!selectedEmployee) return;
    try {
      await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({
          skills: qualForm.skills,
          certifications: qualForm.certifications,
          experienceYearsWithCompany: Number(qualForm.experienceYears),
          previousExperience: qualForm.previousExperience,
          territory: qualForm.territory,
          attendanceStatus: qualForm.attendanceStatus
        })
      });
      setSelectedEmployee((prev: any) => ({
        ...prev,
        territory: qualForm.territory,
        serviceResource: {
          ...(prev?.serviceResource || {}),
          skills: qualForm.skills.split(",").map(s => s.trim()).filter(Boolean),
          certifications: qualForm.certifications.split(",").map(c => c.trim()).filter(Boolean),
          experienceYearsWithCompany: Number(qualForm.experienceYears),
          previousExperience: qualForm.previousExperience,
          location: qualForm.territory,
          attendanceStatus: qualForm.attendanceStatus
        }
      }));
      setIsEditingQualifications(false);
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    } catch (err: any) {
      alert("Failed to save qualifications: " + err.message);
    }
  };

  const handleScheduleLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !leaveForm.startDate || !leaveForm.endDate) return;
    try {
      await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({
          leaveStartDate: leaveForm.startDate,
          leaveEndDate: leaveForm.endDate,
          leaveType: leaveForm.leaveType,
          leaveReason: leaveForm.leaveReason
        })
      });
      setIsAddingLeave(false);
      setLeaveForm({ startDate: "", endDate: "", leaveType: "Vacation", leaveReason: "" });
      const res = await apiClient("/api/v1/salespersons/org-chart");
      if (res.ok) {
        const list = await res.json();
        const found = list.find((e: any) => e.id === selectedEmployee.id);
        if (found) setSelectedEmployee(found);
      }
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    } catch (err: any) {
      alert("Failed to schedule leave: " + err.message);
    }
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    if (!selectedEmployee) return;
    try {
      await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({ removeAbsenceId: absenceId })
      });
      setSelectedEmployee((prev: any) => ({
        ...prev,
        serviceResource: {
          ...(prev?.serviceResource || {}),
          absences: (prev?.serviceResource?.absences || []).filter((a: any) => a.id !== absenceId)
        }
      }));
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    } catch (err: any) {
      alert("Failed to remove absence: " + err.message);
    }
  };

  const handleClearInspectorLeave = async () => {
    if (!selectedEmployee) return;
    try {
      await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({ clearInspectorLeave: true })
      });
      setSelectedEmployee((prev: any) => ({
        ...prev,
        inspectorProfile: {
          ...(prev?.inspectorProfile || {}),
          onLeaveFrom: null,
          onLeaveTo: null
        }
      }));
      queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
    } catch (err: any) {
      alert("Failed to clear leave: " + err.message);
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
          hireDate: new Date().toISOString().split("T")[0], phone: "",
          skills: "", certifications: "", experienceYearsWithCompany: 0,
          previousExperience: "", attendanceStatus: "On Duty",
          maxOpenInspections: 5, maxVisitsPerDay: 3, maxDistanceKm: 50, inspectorCertifications: ""
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

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "Unassigned") return 1;
        if (b === "Unassigned") return -1;
        return a.localeCompare(b);
      })
      .map(([teamName, data]) => ({
        id: data.teamLead?.id || teamName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        name: teamName,
        teamLead: data.teamLead,
        members: data.members
      }));
  }, [filtered]);

  // Deep-link support: /salespersons?teamId=<id>&view=kpi expands team and activates its KPI Detail
  useEffect(() => {
    if (deepLinkTeamId && teamGroups.length > 0) {
      const matchingTeam = teamGroups.find(
        t => t.id === deepLinkTeamId || t.teamLead?.id === deepLinkTeamId
      );
      if (matchingTeam) {
        setActiveTab("performance");
        setPerfSubTab("overview");
        setExpandedTeams(prev => new Set(prev).add(matchingTeam.id));
        if (deepLinkView === "kpi") {
          setTeamSubTabs(prev => ({ ...prev, [matchingTeam.id]: "kpi" }));
        }
      }
    }
  }, [deepLinkTeamId, deepLinkView, teamGroups]);

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // Definition: Team quota attainment is computed as total revenue / total target across
  // members who have an active revenue target (excluding reps with no target instead of counting them as 0%).
  const getTeamStats = (teamLead: Salesperson | null, members: Salesperson[]) => {
    const all = teamLead ? [teamLead, ...members] : members;
    const totalMembers = all.length;
    const availableCount = all.filter(m => m.isAvailable).length;
    const totalRevenue = all.reduce((acc, m) => acc + (m.revenueClosed || 0), 0);
    const totalLeads = all.reduce((acc, m) => acc + (m.totalLeads || 0), 0);
    const totalDeals = all.reduce((acc, m) => acc + (m.totalDeals || 0), 0);

    const membersWithTarget = all.filter(m => (m.revenueTarget || 0) > 0);
    const totalTarget = membersWithTarget.reduce((acc, m) => acc + (m.revenueTarget || 0), 0);
    const revenueForAttainment = membersWithTarget.reduce((acc, m) => acc + (m.revenueClosed || 0), 0);
    const teamAttainment = totalTarget > 0
      ? Math.round((revenueForAttainment / totalTarget) * 100)
      : null;

    return { totalMembers, availableCount, totalRevenue, totalTarget, totalLeads, totalDeals, avgAchievement: teamAttainment };
  };

  const formatRevenue = (val: number) => {
    if (val >= 1000000) return `SAR ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `SAR ${(val / 1000).toFixed(0)}K`;
    return `SAR ${val.toLocaleString()}`;
  };

  const categoryCounts = useMemo(() => {
    const counts = {
      all: orgChartEmployees.length,
      presales: 0,
      sales: 0,
      inspector: 0,
      tech: 0,
      management: 0
    };
    orgChartEmployees.forEach((e: any) => {
      const cat = getEmployeeDivisionCategory(e);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [orgChartEmployees]);

  const filteredOrgEmployees = useMemo(() => {
    const q = orgSearch.toLowerCase().trim();
    return orgChartEmployees.filter((e: any) => {
      // Role filter pill
      if (orgRoleFilter !== "all" && getEmployeeDivisionCategory(e) !== orgRoleFilter) {
        return false;
      }

      if (!q) return true;

      const techSkills: string[] = e.serviceResource?.skills || [];
      const techCerts: string[] = e.serviceResource?.certifications || [];
      const techType = e.serviceResource?.resourceType || "";
      const techAttendance = e.serviceResource?.attendanceStatus || "";
      const inspectorCerts: string[] = Array.isArray(e.inspectorProfile?.certifications)
        ? e.inspectorProfile.certifications
        : typeof e.inspectorProfile?.certifications === "string"
        ? (()=>{ try { return JSON.parse(e.inspectorProfile.certifications || "[]"); } catch { return []; } })()
        : [];
      const inspectorLanguages: string[] = Array.isArray(e.inspectorProfile?.languages)
        ? e.inspectorProfile.languages
        : typeof e.inspectorProfile?.languages === "string"
        ? (()=>{ try { return JSON.parse(e.inspectorProfile.languages || "[]"); } catch { return []; } })()
        : [];

      const category = getEmployeeDivisionCategory(e);
      const categoryKeywords = category === "presales" ? "pre sales inside sales inbound sdr agent"
        : category === "sales" ? "sales closer account executive ae deal"
        : category === "inspector" ? "field inspector site inspection feasibility surveyor survey"
        : category === "tech" ? "field technician technician service repair maintenance mechanic"
        : "manager administration director management lead supervisor";

      return (
        e.name.toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        (e.role || "").toLowerCase().includes(q) ||
        (ROLE_LABELS[e.role] || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q) ||
        (e.territory || "").toLowerCase().includes(q) ||
        (e.tier || "").toLowerCase().includes(q) ||
        categoryKeywords.includes(q) ||
        techType.toLowerCase().includes(q) ||
        techAttendance.toLowerCase().includes(q) ||
        techSkills.some((sk: string) => sk.toLowerCase().includes(q)) ||
        techCerts.some((c: string) => c.toLowerCase().includes(q)) ||
        inspectorCerts.some((c: string) => c.toLowerCase().includes(q)) ||
        inspectorLanguages.some((l: string) => l.toLowerCase().includes(q))
      );
    });
  }, [orgChartEmployees, orgSearch, orgRoleFilter]);

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
                {ALLOWED_USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
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

            {/* Technician Qualifications - Only for Technicians */}
            {form.role === "technician" && (
              <div className="md:col-span-3 p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-indigo-900 text-xs">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  <span>Field Service Qualifications & Experience</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                      Skills & Specialties (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={form.skills}
                      onChange={(e) => setForm({ ...form, skills: e.target.value })}
                      placeholder="e.g. Generator, Compactor, Electrical, Hydraulics"
                      className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                      Certifications / Licenses (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={form.certifications}
                      onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                      placeholder="e.g. 415V Master License, Cummins Certified"
                      className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                      Years with Company
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.experienceYearsWithCompany}
                      onChange={(e) =>
                        setForm({ ...form, experienceYearsWithCompany: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                      Duty / Attendance Status
                    </label>
                    <select
                      value={form.attendanceStatus}
                      onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value })}
                      className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="On Duty">🟢 On Duty (Available for Dispatch)</option>
                      <option value="On Leave">🟠 On Leave (Holiday / Medical)</option>
                      <option value="Off Shift">⚪ Off Shift</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                    Previous Industry Background & Experience
                  </label>
                  <textarea
                    rows={2}
                    value={form.previousExperience}
                    onChange={(e) => setForm({ ...form, previousExperience: e.target.value })}
                    placeholder="e.g. 6 years as lead heavy equipment mechanic at Caterpillar dealership..."
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Field Inspector Configuration - Only for Site Managers / Inspectors */}
            {form.role === "site_manager" && (
              <div className="md:col-span-3 p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                  <ClipboardCheck className="w-4 h-4 text-amber-600" />
                  <span>Site Feasibility & Inspection Dispatch Settings</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Max Open Inspections
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={form.maxOpenInspections}
                      onChange={(e) => setForm({ ...form, maxOpenInspections: Number(e.target.value) || 5 })}
                      className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Max Visits Per Day
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={form.maxVisitsPerDay}
                      onChange={(e) => setForm({ ...form, maxVisitsPerDay: Number(e.target.value) || 3 })}
                      className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Max Travel Distance (km)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="500"
                      value={form.maxDistanceKm}
                      onChange={(e) => setForm({ ...form, maxDistanceKm: Number(e.target.value) || 50 })}
                      className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Safety & Inspection Certifications (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.inspectorCertifications}
                    onChange={(e) => setForm({ ...form, inspectorCertifications: e.target.value })}
                    placeholder="e.g. OSHA 30, Civil Feasibility Survey, High-Voltage Safety"
                    className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
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
          {/* Sub-view switcher: Team Overview vs KPI Detail */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant w-fit">
            <button
              type="button"
              onClick={() => setPerfSubTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                perfSubTab === "overview"
                  ? "bg-primary text-white shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team Overview
            </button>
            <button
              type="button"
              onClick={() => setPerfSubTab("kpi")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                perfSubTab === "kpi"
                  ? "bg-primary text-white shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              KPI Detail
            </button>
          </div>

          {/* Sub-view 1: Team Overview */}
          <div className={perfSubTab === "overview" ? "space-y-6" : "hidden"}>
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
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Company Quota Attainment</span>
              <p className="text-xl font-black text-amber-600">
                {(() => {
                  const withTarget = salespersons.filter(s => (s.revenueTarget || 0) > 0);
                  const totTarget = withTarget.reduce((acc, s) => acc + (s.revenueTarget || 0), 0);
                  const totRev = withTarget.reduce((acc, s) => acc + (s.revenueClosed || 0), 0);
                  return totTarget > 0 ? `${Math.round((totRev / totTarget) * 100)}%` : "—";
                })()}
              </p>
              <span className="text-[11px] text-muted-foreground font-semibold">Total revenue / quota target</span>
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
              {teamGroups.map((team) => {
                const teamName = team.name;
                const teamLead = team.teamLead;
                const members = team.members;
                const isExpanded = expandedTeams.has(team.id);
                const currentSubTab = teamSubTabs[team.id] || "members";
                const stats = getTeamStats(teamLead, members);
                const gradientClass = AVATAR_GRADIENTS[Math.abs(teamName.length) % AVATAR_GRADIENTS.length];
                const pctColor = stats.avgAchievement === null
                  ? "text-on-surface-variant"
                  : stats.avgAchievement >= 90
                  ? "text-emerald-600"
                  : stats.avgAchievement >= 60
                  ? "text-primary"
                  : "text-amber-500";

                return (
                  <div key={team.id} className="bg-surface-container-lowest border border-outline rounded-2xl overflow-hidden shadow-2xs">
                    <button
                      onClick={() => toggleTeam(team.id)}
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
                          <p className={`text-lg font-black ${pctColor}`}>
                            {stats.avgAchievement !== null ? `${stats.avgAchievement}%` : "—"}
                          </p>
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
                        {/* Sub-tabs: Members vs KPI Detail inside expanded team */}
                        <div className="flex items-center gap-1 bg-surface-container-high/50 p-1 rounded-lg border border-outline-variant w-fit">
                          <button
                            type="button"
                            onClick={() => setTeamSubTabs(prev => ({ ...prev, [team.id]: "members" }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                              currentSubTab === "members"
                                ? "bg-surface-container-lowest text-primary shadow-xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            Members ({stats.totalMembers})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeamSubTabs(prev => ({ ...prev, [team.id]: "kpi" }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                              currentSubTab === "kpi"
                                ? "bg-surface-container-lowest text-primary shadow-xs"
                                : "text-on-surface-variant hover:text-on-surface"
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            KPI Detail
                          </button>
                        </div>

                        {currentSubTab === "members" ? (
                          <>
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
                                      <p className={`text-lg font-black ${(teamLead.revenueTarget || 0) <= 0 && (teamLead.activeKpiCount || 0) <= 0 ? "text-on-surface-variant" : teamLead.targetAchievementPct >= 90 ? "text-emerald-600" : teamLead.targetAchievementPct >= 60 ? "text-primary" : "text-amber-500"}`}>
                                        {(teamLead.revenueTarget || 0) > 0 || (teamLead.activeKpiCount || 0) > 0 ? `${teamLead.targetAchievementPct || 0}%` : "—"}
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
                                    const hasTarget = (rep.revenueTarget || 0) > 0 || (rep.activeKpiCount || 0) > 0;
                                    const pct = rep.targetAchievementPct || 0;
                                    const memPctColor = !hasTarget
                                      ? "text-on-surface-variant"
                                      : pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-primary" : pct >= 30 ? "text-amber-500" : "text-rose-500";

                                    return (
                                      <div
                                        key={rep.id}
                                        onClick={() => navigate(`/salespersons/${rep.id}`)}
                                        className="group bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="relative flex-shrink-0">
                                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${memberGrad} flex items-center justify-center text-white font-bold text-xs`}>
                                              {getInitials(rep.name)}
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                                          </div>

                                          <div className="flex-1 min-w-0">
                                            <p className="font-bold text-on-surface text-xs truncate group-hover:text-primary transition-colors">{rep.name}</p>
                                            <p className="text-[10px] text-on-surface-variant font-medium truncate">{roleLabel(rep.role, rep.tier)}</p>
                                            {rep.email && <p className="text-[9px] font-mono text-on-surface-variant truncate opacity-80">{rep.email}</p>}
                                          </div>

                                          <div className="flex-shrink-0 text-right">
                                            <p className={`text-sm font-black ${memPctColor}`}>
                                              {hasTarget ? `${pct}%` : "—"}
                                            </p>
                                            <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-wider">Attainment</p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-1 mt-3 pt-2.5 border-t border-outline-variant text-center">
                                          <div>
                                            <p className="text-xs font-black text-on-surface">{formatRevenue(rep.revenueClosed || 0)}</p>
                                            <p className="text-[8px] text-on-surface-variant font-semibold">Revenue</p>
                                          </div>
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
                          </>
                        ) : (
                          /* Lazy-loaded Team KPI Detail subtab */
                          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-2xs">
                            <div className="mb-4">
                              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-primary" /> {teamName} Team KPI Detail
                              </h4>
                              <p className="text-[11px] text-on-surface-variant">Live metrics breakdown across all {teamName} members.</p>
                            </div>
                            <KpiAttainmentTable teamId={team.id} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>

          {/* Sub-view 2: Standalone Company-wide KPI Detail */}
          <div className={perfSubTab === "kpi" ? "bg-card border border-border rounded-2xl p-6 shadow-2xs" : "hidden"}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Company KPI Attainment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Live current vs. target breakdown across all teams, reps, and KPI categories.</p>
              </div>

              {/* Team dropdown filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Team:</span>
                <select
                  value={filterKpiTeam}
                  onChange={(e) => setFilterKpiTeam(e.target.value)}
                  className="bg-surface border border-outline rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
                >
                  <option value="All">All Teams</option>
                  {teamGroups.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} Team
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <KpiAttainmentTable
              salespersonId={filterKpiTeam === "All" ? "all" : undefined}
              teamId={filterKpiTeam === "All" ? undefined : filterKpiTeam}
            />
          </div>
        </div>
      )}

      {/* TAB 2: ORG CHART & DIRECTORY */}
      {activeTab === "orgchart" && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={e => setOrgSearch(e.target.value)}
                  placeholder="Search employees by name, role, skills, equipment or email..."
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              <div className="text-xs text-on-surface-variant font-medium">
                Showing <strong>{filteredOrgEmployees.length}</strong> of <strong>{orgChartEmployees.length}</strong> total employees
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-outline-variant/60">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">Filter by Role:</span>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orgRoleFilter === "all"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-surface text-on-surface-variant hover:bg-surface-container-low border border-outline-variant"
                }`}
              >
                All ({categoryCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("presales")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  orgRoleFilter === "presales"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "bg-surface text-sky-700 hover:bg-sky-50 border border-sky-200"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                Pre-Sales ({categoryCounts.presales})
              </button>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("sales")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  orgRoleFilter === "sales"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-surface text-blue-700 hover:bg-blue-50 border border-blue-200"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Sales Closers ({categoryCounts.sales})
              </button>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("inspector")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  orgRoleFilter === "inspector"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-surface text-amber-700 hover:bg-amber-50 border border-amber-200"
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Field Inspectors ({categoryCounts.inspector})
              </button>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("tech")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  orgRoleFilter === "tech"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-surface text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Field Technicians ({categoryCounts.tech})
              </button>
              <button
                type="button"
                onClick={() => setOrgRoleFilter("management")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  orgRoleFilter === "management"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-surface text-purple-700 hover:bg-purple-50 border border-purple-200"
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                Managers & Admins ({categoryCounts.management})
              </button>
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

              {/* Field Service Qualifications & Duty Status Section (For Technicians) */}
              {(selectedEmployee.role === "technician" || selectedEmployee.serviceResource) && (
                <div className="space-y-4">
                  {/* Qualifications Card */}
                  <div className="space-y-3 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 p-4 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" /> Field Service Qualifications
                      </h4>
                      <div className="flex items-center gap-2">
                        {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                          <button
                            type="button"
                            onClick={() => setIsEditingQualifications(!isEditingQualifications)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            {isEditingQualifications ? "Cancel" : "Edit"}
                          </button>
                        )}
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                          selectedEmployee.serviceResource?.attendanceStatus === "On Leave"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : selectedEmployee.serviceResource?.attendanceStatus === "Off Shift"
                            ? "bg-slate-100 text-slate-700 border border-slate-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}>
                          {selectedEmployee.serviceResource?.attendanceStatus === "On Leave"
                            ? "🟠 On Leave"
                            : selectedEmployee.serviceResource?.attendanceStatus === "Off Shift"
                            ? "⚪ Off Shift"
                            : "🟢 On Duty"}
                        </span>
                      </div>
                    </div>

                    {isEditingQualifications ? (
                      <div className="space-y-3 pt-2 bg-white/80 p-3 rounded-lg border border-indigo-200 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                            Skills & Specialties (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={qualForm.skills}
                            onChange={(e) => setQualForm({ ...qualForm, skills: e.target.value })}
                            className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                            Certifications / Licenses (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={qualForm.certifications}
                            onChange={(e) => setQualForm({ ...qualForm, certifications: e.target.value })}
                            className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                              Years Experience
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={qualForm.experienceYears}
                              onChange={(e) => setQualForm({ ...qualForm, experienceYears: Number(e.target.value) })}
                              className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                              Duty Status
                            </label>
                            <select
                              value={qualForm.attendanceStatus}
                              onChange={(e) => setQualForm({ ...qualForm, attendanceStatus: e.target.value })}
                              className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium cursor-pointer"
                            >
                              <option value="On Duty">🟢 On Duty</option>
                              <option value="On Leave">🟠 On Leave</option>
                              <option value="Off Shift">⚪ Off Shift</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                            Territory / Service Zone
                          </label>
                          <input
                            type="text"
                            value={qualForm.territory}
                            onChange={(e) => setQualForm({ ...qualForm, territory: e.target.value })}
                            placeholder="e.g. North Zone, Dubai"
                            className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                            Previous Background
                          </label>
                          <textarea
                            rows={2}
                            value={qualForm.previousExperience}
                            onChange={(e) => setQualForm({ ...qualForm, previousExperience: e.target.value })}
                            className="w-full bg-white border border-indigo-200 rounded p-1.5 font-medium"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditingQualifications(false)}
                            className="px-3 py-1 text-xs border border-indigo-200 rounded text-indigo-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveQualifications}
                            className="px-3 py-1 text-xs font-bold bg-indigo-600 text-white rounded flex items-center gap-1 shadow-xs hover:bg-indigo-700"
                          >
                            <Save className="w-3 h-3" /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Skills badges */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-600 uppercase">Certified Skills</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedEmployee.serviceResource?.skills && selectedEmployee.serviceResource.skills.length > 0 ? (
                              selectedEmployee.serviceResource.skills.map((sk: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-indigo-800 border border-indigo-200">
                                  {sk}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No skills recorded</span>
                            )}
                          </div>
                        </div>

                        {/* Certifications badges */}
                        {selectedEmployee.serviceResource?.certifications && selectedEmployee.serviceResource.certifications.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-slate-600 uppercase">Certifications & Licenses</div>
                            <div className="flex flex-wrap gap-1">
                              {selectedEmployee.serviceResource.certifications.map((cert: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                                  🏅 {cert}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Company Experience</span>
                            <span className="font-semibold text-slate-800">
                              {selectedEmployee.serviceResource?.experienceYearsWithCompany || 0} years
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Operating Territory</span>
                            <span className="font-semibold text-slate-800">
                              {selectedEmployee.serviceResource?.location || selectedEmployee.territory || "Unassigned"}
                            </span>
                          </div>
                        </div>

                        {selectedEmployee.serviceResource?.previousExperience && (
                          <div className="pt-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Previous Background</span>
                            <p className="text-[11px] text-slate-700 italic bg-white/70 p-2 rounded border border-indigo-100 mt-0.5">
                              {selectedEmployee.serviceResource.previousExperience}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Planned Leaves & Holidays Calendar Section */}
                  <div className="space-y-2 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 p-4 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-600" /> Planned Leaves & Absence Window
                      </h4>
                      {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                        <button
                          type="button"
                          onClick={() => setIsAddingLeave(!isAddingLeave)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
                        >
                          {isAddingLeave ? "Cancel" : "+ Schedule Leave"}
                        </button>
                      )}
                    </div>

                    {/* Active Absences List */}
                    {selectedEmployee.serviceResource?.absences && selectedEmployee.serviceResource.absences.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {selectedEmployee.serviceResource.absences.map((abs: any) => (
                          <div key={abs.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-indigo-100 text-xs">
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-800 rounded font-semibold uppercase">
                                  {abs.type || "Leave"}
                                </span>
                                <span>
                                  {new Date(abs.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(abs.endDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              </div>
                              {abs.reason && <p className="text-[11px] text-slate-500 mt-0.5 italic">{abs.reason}</p>}
                            </div>
                            {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAbsence(abs.id)}
                                title="Remove Leave Record"
                                className="p-1 text-slate-400 hover:text-error transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No scheduled upcoming leaves recorded. Available for auto-dispatch.</p>
                    )}

                    {/* Schedule Leave Form */}
                    {isAddingLeave && (
                      <form onSubmit={handleScheduleLeave} className="space-y-2 pt-2 bg-white/90 p-3 rounded-lg border border-indigo-200 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">Start Date *</label>
                            <input
                              type="date"
                              required
                              value={leaveForm.startDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                              className="w-full bg-white border border-indigo-200 rounded p-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">End Date *</label>
                            <input
                              type="date"
                              required
                              value={leaveForm.endDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                              className="w-full bg-white border border-indigo-200 rounded p-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">Leave Type</label>
                            <select
                              value={leaveForm.leaveType}
                              onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                              className="w-full bg-white border border-indigo-200 rounded p-1 text-xs"
                            >
                              <option value="Vacation">Vacation / Annual</option>
                              <option value="Sick">Sick / Medical</option>
                              <option value="Personal">Personal Leave</option>
                              <option value="Training">Field Training</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">Reason / Notes</label>
                            <input
                              type="text"
                              value={leaveForm.leaveReason}
                              onChange={(e) => setLeaveForm({ ...leaveForm, leaveReason: e.target.value })}
                              placeholder="e.g. Annual holiday"
                              className="w-full bg-white border border-indigo-200 rounded p-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingLeave(false)}
                            className="px-2.5 py-1 text-xs border border-indigo-200 rounded text-indigo-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 text-xs font-bold bg-indigo-600 text-white rounded shadow-xs hover:bg-indigo-700"
                          >
                            Save Leave
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Active Dispatches & Service Appointments Card */}
                  <div className="space-y-2 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-4 rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" /> Active Dispatches ({selectedEmployee.serviceResource?.activeAppointments?.length || 0})
                      </h4>
                      <button
                        type="button"
                        onClick={() => navigate("/work-orders")}
                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        All Work Orders <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {selectedEmployee.serviceResource?.activeAppointments && selectedEmployee.serviceResource.activeAppointments.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {selectedEmployee.serviceResource.activeAppointments.map((apt: any) => (
                          <div
                            key={apt.id}
                            onClick={() => navigate("/work-orders")}
                            className="p-2.5 bg-white rounded-lg border border-indigo-100 hover:border-indigo-400 transition-all cursor-pointer text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-900">
                                {apt.appointmentNumber || "Service Appointment"}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                                {apt.status}
                              </span>
                            </div>
                            {apt.workOrder && (
                              <p className="text-[11px] text-slate-700 font-medium mt-1 truncate">
                                <strong>{apt.workOrder.workOrderNumber}:</strong> {apt.workOrder.subject}
                              </p>
                            )}
                            {apt.scheduledStartTime && (
                              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 text-indigo-500" />
                                {new Date(apt.scheduledStartTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No active dispatched service appointments currently assigned.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Field Inspector & Site Feasibility Section */}
              {(selectedEmployee.role === "site_manager" || Boolean(selectedEmployee.inspectorProfile)) && (
                <div className="space-y-4">
                  <div className="space-y-3 bg-gradient-to-br from-amber-50/90 to-orange-50/70 p-4 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-amber-950 tracking-wider flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" /> Site Feasibility & Inspection
                      </h4>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                        selectedEmployee.inspectorProfile?.isAvailable !== false
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        {selectedEmployee.inspectorProfile?.isAvailable !== false ? "🟢 Available" : "🟠 Unavailable"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                        <span className="text-[9px] text-amber-800 uppercase font-bold block">Max Open</span>
                        <span className="font-mono font-bold text-amber-950 text-sm">
                          {selectedEmployee.inspectorProfile?.maxOpenInspections ?? 5}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                        <span className="text-[9px] text-amber-800 uppercase font-bold block">Visits / Day</span>
                        <span className="font-mono font-bold text-amber-950 text-sm">
                          {selectedEmployee.inspectorProfile?.maxVisitsPerDay ?? 3}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">
                        <span className="text-[9px] text-amber-800 uppercase font-bold block">Radius</span>
                        <span className="font-mono font-bold text-amber-950 text-sm">
                          {selectedEmployee.inspectorProfile?.maxDistanceKm ?? 50} km
                        </span>
                      </div>
                    </div>

                    {/* Certifications badges */}
                    {(() => {
                      const certs = Array.isArray(selectedEmployee.inspectorProfile?.certifications)
                        ? selectedEmployee.inspectorProfile.certifications
                        : typeof selectedEmployee.inspectorProfile?.certifications === "string"
                        ? (()=>{ try { return JSON.parse(selectedEmployee.inspectorProfile.certifications || "[]"); } catch { return []; } })()
                        : [];
                      if (certs.length === 0) return null;
                      return (
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-amber-900 uppercase">Inspection Certifications</div>
                          <div className="flex flex-wrap gap-1">
                            {certs.map((c: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                📜 {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Manager Controls: Quick Adjust Limits */}
                    {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                      <div className="pt-2 border-t border-amber-200/60 space-y-2">
                        <label className="block text-[10px] font-bold text-amber-950 uppercase">Update Max Daily Visits</label>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiClient(`/api/v1/salespersons/${selectedEmployee.id}/capacity`, {
                                    method: "PUT",
                                    body: JSON.stringify({ maxVisitsPerDay: num })
                                  });
                                  setSelectedEmployee({
                                    ...selectedEmployee,
                                    inspectorProfile: {
                                      ...(selectedEmployee.inspectorProfile || {}),
                                      maxVisitsPerDay: num
                                    }
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["orgChartEmployees"] });
                                } catch (err: any) {
                                  alert("Failed to update visits limit: " + err.message);
                                }
                              }}
                              className={`flex-1 py-1 rounded text-xs font-bold transition-all ${
                                (selectedEmployee.inspectorProfile?.maxVisitsPerDay ?? 3) === num
                                  ? "bg-amber-600 text-white shadow-xs"
                                  : "bg-white text-amber-900 hover:bg-amber-100 border border-amber-200"
                              }`}
                            >
                              {num}/day
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inspector Scheduled Leave Window */}
                  <div className="space-y-2 bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-4 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-amber-950 tracking-wider flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-600" /> Planned Leave Window
                      </h4>
                      {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                        <button
                          type="button"
                          onClick={() => setIsAddingLeave(!isAddingLeave)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                        >
                          {isAddingLeave ? "Cancel" : "+ Set Leave"}
                        </button>
                      )}
                    </div>

                    {selectedEmployee.inspectorProfile?.onLeaveFrom ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200 text-xs">
                        <div>
                          <p className="font-bold text-amber-950">
                            On Leave: {new Date(selectedEmployee.inspectorProfile.onLeaveFrom).toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(selectedEmployee.inspectorProfile.onLeaveTo).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <span className="text-[10px] text-amber-700 italic">Excluded from auto-dispatch during this period</span>
                        </div>
                        {["admin", "director", "manager"].includes(currentUser?.role || "") && (
                          <button
                            type="button"
                            onClick={handleClearInspectorLeave}
                            className="px-2 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                          >
                            Clear Leave
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No scheduled leave. Available for site survey routing.</p>
                    )}

                    {isAddingLeave && (
                      <form onSubmit={handleScheduleLeave} className="space-y-2 pt-2 bg-white/90 p-3 rounded-lg border border-amber-200 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Start Date *</label>
                            <input
                              type="date"
                              required
                              value={leaveForm.startDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                              className="w-full bg-white border border-amber-200 rounded p-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">End Date *</label>
                            <input
                              type="date"
                              required
                              value={leaveForm.endDate}
                              onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                              className="w-full bg-white border border-amber-200 rounded p-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingLeave(false)}
                            className="px-2.5 py-1 text-xs border border-amber-200 rounded text-amber-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 text-xs font-bold bg-amber-600 text-white rounded shadow-xs hover:bg-amber-700"
                          >
                            Save Leave Window
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Active Site Inspections Card */}
                  <div className="space-y-2 bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-4 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold uppercase text-amber-950 tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Assigned Site Surveys ({selectedEmployee.activeSiteInspections?.length || 0})
                      </h4>
                      <button
                        type="button"
                        onClick={() => navigate("/site-inspections")}
                        className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                      >
                        All Inspections <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {selectedEmployee.activeSiteInspections && selectedEmployee.activeSiteInspections.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {selectedEmployee.activeSiteInspections.map((insp: any) => (
                          <div
                            key={insp.id}
                            onClick={() => navigate("/site-inspections")}
                            className="p-2.5 bg-white rounded-lg border border-amber-100 hover:border-amber-400 transition-all cursor-pointer text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-950">
                                {insp.city || "Site Survey"} {insp.locationDescription ? `· ${insp.locationDescription}` : ""}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase">
                                {insp.status}
                              </span>
                            </div>
                            {insp.scheduledAt && (
                              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5 text-amber-500" />
                                {new Date(insp.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No open site feasibility inspections currently assigned.</p>
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
              {(() => {
                const category = getEmployeeDivisionCategory(node);
                if (category === "tech") {
                  return (
                    <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5 text-indigo-600" />
                      {node.serviceResource?.attendanceStatus ? `Tech: ${node.serviceResource.attendanceStatus}` : "Technician"}
                    </span>
                  );
                }
                if (category === "inspector") {
                  return (
                    <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <ClipboardCheck className="w-2.5 h-2.5 text-amber-600" />
                      Field Inspector
                    </span>
                  );
                }
                if (category === "sales") {
                  return (
                    <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                      <Briefcase className="w-2.5 h-2.5 text-blue-600" />
                      Sales Closer
                    </span>
                  );
                }
                if (category === "presales") {
                  return (
                    <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                      <Target className="w-2.5 h-2.5 text-sky-600" />
                      Pre-Sales
                    </span>
                  );
                }
                return null;
              })()}
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
