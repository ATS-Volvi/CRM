import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { Users, Search, Plus, Trash2, Edit2, Check, X, ShieldAlert, Key } from "lucide-react";

interface Salesperson {
  id: string;
  name: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
  totalLeads: number;
  totalDeals: number;
}

export default function SalespersonTracker() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "sales_rep",
    maxOpenLeads: 20,
    isAvailable: true,
    managerId: ""
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
      if (Array.isArray(data)) {
        setSalespersons(data);
      }
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
        setManagers(data.filter((u: any) => u.role === "sales_manager" || u.role === "admin"));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAvailability = async (rep: Salesperson) => {
    try {
      // Optimistic update
      setSalespersons(prev => prev.map(s => s.id === rep.id ? { ...s, isAvailable: !s.isAvailable } : s));
      
      const res = await apiClient(`/api/v1/settings/availability`, {
        method: "PUT",
        body: JSON.stringify({ isAvailable: !rep.isAvailable, userId: rep.id })
      });
      if (!res.ok) throw new Error("Failed to toggle availability");
    } catch (err) {
      console.error(err);
      // Revert if error
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
    } catch (err: any) {
      alert(err.message);
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
    try {
      const res = await apiClient("/api/v1/salespersons", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          managerId: form.managerId || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Something went wrong.");
      } else {
        setIsFormOpen(false);
        setForm({ name: "", email: "", password: "", role: "sales_rep", maxOpenLeads: 20, isAvailable: true, managerId: "" });
        await fetchSalespersons();
        if (data?.id) {
          navigate(`/salespersons/${data.id}`);
        }
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSalespersons = salespersons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[1000px] mx-auto p-8 space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Sales Representatives</h2>
            <p className="text-xs text-on-surface-variant">Track performance, manage open lead thresholds, and assign roles.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reps..."
              className="w-full bg-surface border border-outline rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none"
            />
          </div>
          {!isFormOpen && (
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm whitespace-nowrap"
            >
              <span>+ Add Representative</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Form Card above table */}
      {isFormOpen && (
        <form onSubmit={submitNewRep} className="bg-surface-container-lowest border border-outline rounded-2xl p-6 shadow-sm space-y-4 animate-slide-down">
          <h3 className="text-sm font-bold text-on-surface">Register Sales Representative</h3>
          {formError && <div className="text-xs font-bold text-error bg-error-container/30 border border-error/20 p-2.5 rounded-lg">{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name *</label>
              <input 
                type="text" 
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email Address *</label>
              <input 
                type="email" 
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. john@company.com"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Password *</label>
              <input 
                type="password" 
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
              <select 
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="sales_rep">Sales Representative</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Max Lead Cap</label>
              <input 
                type="number" 
                value={form.maxOpenLeads}
                onChange={e => setForm({ ...form, maxOpenLeads: parseInt(e.target.value) || 20 })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Reporting Manager</label>
              <select 
                value={form.managerId}
                onChange={e => setForm({ ...form, managerId: e.target.value })}
                className="w-full bg-surface border border-outline rounded-lg p-2.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="">No Manager (Self)</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button 
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-outline rounded-lg text-xs font-bold text-on-surface-variant"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
            >
              Register Account
            </button>
          </div>
        </form>
      )}

      {/* Table Card Container */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">System Role</th>
              <th className="px-6 py-3.5">Availability</th>
              <th className="px-6 py-3.5 text-center">Active Leads</th>
              <th className="px-6 py-3.5 text-center">Deals Won</th>
              <th className="px-6 py-3.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">Loading representatives...</td>
              </tr>
            ) : filteredSalespersons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs font-bold text-on-surface-variant italic">No representatives found.</td>
              </tr>
            ) : (
              filteredSalespersons.map((rep) => (
                <tr key={rep.id} className="group hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-3">
                    <Link to={`/salespersons/${rep.id}`} className="font-bold text-primary hover:underline">
                      {rep.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 font-semibold text-on-surface-variant text-xs">
                    {rep.role === "sales_rep" ? "Sales Representative" : rep.role === "sales_manager" ? "Sales Manager" : "Administrator"}
                  </td>
                  <td className="px-6 py-3">
                    <button 
                      onClick={() => handleToggleAvailability(rep)}
                      className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                        rep.isAvailable 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {rep.isAvailable ? "Available" : "OOO / Busy"}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-center text-on-surface font-semibold">{rep.totalLeads} / {rep.maxOpenLeads}</td>
                  <td className="px-6 py-3 text-center text-on-surface font-semibold">{rep.totalDeals}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDeleteRep(rep.id)}
                        className="p-1 hover:bg-error-container hover:text-on-error-container rounded text-error"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
