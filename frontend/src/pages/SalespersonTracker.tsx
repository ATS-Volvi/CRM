import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import {
  Users, Search, Plus, Trash2, X, TrendingUp, MapPin, Briefcase,
  Target, Award, ChevronRight, Building2
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
    : role === "sales_manager" ? "Manager"
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
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterTerritory, setFilterTerritory] = useState("All");
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "sales_rep", maxOpenLeads: 20, isAvailable: true,
    managerId: "", department: "Sales", territory: "EMEA", team: "Aces"
  });
  const [managers, setManagers] = useState<any[]>([]);

  useEffect(() => {
    fetchSalespersons();
    fetchManagers();
  }, []);

  const fetchSalespersons = async () => {
    try {
      const res = await apiClient("/api/v1/salespersons/performance");
      const data = await res.json();
      if (Array.isArray(data)) setSalespersons(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await apiClient("/api/v1/salespersons");
      const data = await res.json();
      if (Array.isArray(data)) {
        setManagers(data.filter((u: any) => u.role === "sales_manager" || u.role === "admin" || u.role === "director"));
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleAvailability = async (rep: Salesperson) => {
    try {
      setSalespersons(prev => prev.map(s => s.id === rep.id ? { ...s, isAvailable: !s.isAvailable } : s));
      await apiClient(`/api/v1/settings/availability`, {
        method: "PUT",
        body: JSON.stringify({ isAvailable: !rep.isAvailable, userId: rep.id })
      });
    } catch (err) {
      console.error(err);
      fetchSalespersons();
    }
  };

  const handleDeleteRep = async (id: string) => {
    if (!confirm("Are you sure you want to delete this representative?")) return;
    try {
      const res = await apiClient(`/api/v1/salespersons/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSalespersons(prev => prev.filter(s => s.id !== id));
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
        await fetchSalespersons();
        if (data?.id) navigate(`/salespersons/${data.id}`);
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

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Sales Representatives</h2>
            <p className="text-xs text-on-surface-variant font-medium">KPI targets · Target rings · Revenue performance · Territory insights</p>
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
                <option value="sales_manager">Sales Manager</option>
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

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-full bg-surface-container-low" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-container-low rounded w-3/4" />
                  <div className="h-2 bg-surface-container-low rounded w-1/2" />
                </div>
              </div>
              <div className="h-2 bg-surface-container-low rounded w-full" />
              <div className="h-2 bg-surface-container-low rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center">
          <Users className="w-8 h-8 text-on-surface-variant mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold text-on-surface-variant">No representatives found.</p>
          <p className="text-xs text-on-surface-variant opacity-60 mt-1">Try adjusting your filters or adding a new rep.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((rep, idx) => {
            const gradClass = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
            const pct = rep.targetAchievementPct || 0;
            const pctColor = pct >= 90 ? "text-emerald-600" : pct >= 60 ? "text-primary" : pct >= 30 ? "text-amber-500" : "text-rose-500";
            const revenue = rep.revenueClosed || 0;
            const revenueStr = revenue >= 1000000 ? `${(revenue / 1000000).toFixed(1)}M` : revenue >= 1000 ? `${(revenue / 1000).toFixed(0)}K` : `${revenue}`;

            return (
              <div key={rep.id}
                onClick={() => navigate(`/salespersons/${rep.id}`)}
                className="group bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Top-right status dot */}
                <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest ${rep.isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />

                {/* Avatar + ring */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradClass} flex items-center justify-center text-white font-bold text-sm`}>
                      {getInitials(rep.name)}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      <ProgressRing pct={pct} size={28} stroke={3} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{rep.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-semibold">{roleLabel(rep.role)}</p>
                    {rep.email && <p className="text-[10px] font-mono text-primary truncate">{rep.email}</p>}
                    <div className="flex items-center gap-1 mt-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleAvailability(rep); }}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                          rep.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {rep.isAvailable ? "● Available" : "○ OOO / Busy"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Achievement % */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Achievement</p>
                    <p className={`text-2xl font-black ${pctColor} leading-tight`}>{pct}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Revenue</p>
                    <p className="text-lg font-black text-on-surface">₹{revenueStr}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : pct >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-container-low rounded-full text-[10px] font-semibold text-on-surface-variant">
                    <Building2 className="w-2.5 h-2.5" /> {rep.department || "Sales"}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-container-low rounded-full text-[10px] font-semibold text-on-surface-variant">
                    <MapPin className="w-2.5 h-2.5" /> {rep.territory || "EMEA"}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-container-low rounded-full text-[10px] font-semibold text-on-surface-variant">
                    <Users className="w-2.5 h-2.5" /> {rep.team || "Aces"}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-outline-variant pt-3">
                  <div>
                    <p className="text-xs font-black text-on-surface">{rep.totalLeads}</p>
                    <p className="text-[9px] text-on-surface-variant font-semibold">Leads</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-on-surface">{rep.totalDeals}</p>
                    <p className="text-[9px] text-on-surface-variant font-semibold">Deals</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-on-surface">{rep.activeKpiCount || 0}</p>
                    <p className="text-[9px] text-on-surface-variant font-semibold">KPIs</p>
                  </div>
                </div>

                {/* Footer action */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant">
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm("Delete this rep?")) handleDeleteRep(rep.id); }}
                    className="p-1 hover:bg-error/10 hover:text-error text-on-surface-variant rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
  );
}
