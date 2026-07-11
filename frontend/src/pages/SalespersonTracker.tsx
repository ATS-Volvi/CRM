import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  User, Phone, Mail, Award, Compass, DollarSign, Briefcase, FileSpreadsheet, Search,
  FileText, Clock, Pin, MessageSquare, TrendingUp, Users, CheckSquare, History,
  Plus, X, ChevronRight
} from "lucide-react";

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

interface Salesperson {
  id: string;
  name: string;
  role: string;
  isAvailable: boolean;
  maxOpenLeads: number;
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
}

export default function SalespersonTracker() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "sales_rep",
    maxOpenLeads: 20,
    isAvailable: true
  });

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", role: "sales_rep", maxOpenLeads: 20, isAvailable: true });
    setFormError("");
  };

  const openModal = () => { resetForm(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); resetForm(); };

  useEffect(() => {
    fetchSalespersons();
  }, []);

  const fetchSalespersons = async () => {
    try {
      const token = localStorage.getItem("nexus_token") || "";
      const res = await fetch("/api/v1/salespersons/performance", {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  const submitNewRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const token = localStorage.getItem("nexus_token") || "";
      const res = await fetch("/api/v1/salespersons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Something went wrong.");
      } else {
        closeModal();
        await fetchSalespersons();
        // Redirect directly to details on success
        if (data?.id) {
          navigate(`/salespersons/${data.id}`);
        }
      }
    } catch {
      setFormError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReps = salespersons.filter((rep) =>
    rep.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in text-on-surface">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Sales Representatives
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Monitor sales representative performance profiles, assigned leads, deal categorization and capacity limits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search salesperson..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-lg border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 py-2 px-4 bg-primary text-on-primary font-bold rounded-lg shadow-md hover:bg-primary-container hover:text-on-primary-container transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Add Representative</span>
          </button>
        </div>
      </header>

      {/* ── Add Representative Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-surface-container rounded-2xl border border-outline-variant w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-title-sm">New Representative</h2>
                  <p className="text-body-xs text-on-surface-variant">Create a sales team member account</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submitNewRep} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="px-4 py-3 rounded-lg bg-error-container/40 border border-error/30 text-error text-body-sm font-medium">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-on-surface">Full Name <span className="text-error">*</span></label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-on-surface">Email <span className="text-error">*</span></label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-on-surface">Password <span className="text-error">*</span></label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-body-sm font-semibold text-on-surface">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:outline-none focus:border-primary transition-all"
                >
                  <option value="sales_rep">Sales Rep</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="director">Director</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Max Open Leads + Availability in one row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-body-sm font-semibold text-on-surface">Max Open Leads</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={form.maxOpenLeads}
                    onChange={e => setForm(f => ({ ...f, maxOpenLeads: parseInt(e.target.value) || 20 }))}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-body-sm font-semibold text-on-surface">Available</label>
                  <div className="flex items-center h-[38px]">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.isAvailable}
                      onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        form.isAvailable ? "bg-primary" : "bg-surface-container-high"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          form.isAvailable ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-body-sm text-on-surface-variant">
                      {form.isAvailable ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-body-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary font-bold rounded-lg text-body-sm hover:bg-primary-container hover:text-on-primary-container transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-on-primary" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Representative
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-semibold">Representatives ({filteredReps.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReps.map((rep) => {
              return (
                <div
                  key={rep.id}
                  onClick={() => navigate(`/salespersons/${rep.id}`)}
                  className="p-6 rounded-xl border bg-surface hover:bg-surface-container-high border-outline-variant cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between h-48 shadow-sm group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {rep.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-body-lg text-on-surface group-hover:text-primary transition-colors">{rep.name}</div>
                        <div className="text-body-sm text-on-surface-variant capitalize mt-0.5">{rep.role.replace("_", " ")}</div>
                      </div>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${rep.isAvailable ? "bg-green-500" : "bg-amber-500"}`} title={rep.isAvailable ? "Available" : "Unavailable"}></span>
                  </div>

                  <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4 mt-4">
                    <div className="flex space-x-6">
                      <div>
                        <div className="text-body-sm font-extrabold text-on-surface">{rep.totalDeals}</div>
                        <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Deals</div>
                      </div>
                      <div>
                        <div className="text-body-sm font-extrabold text-on-surface">{rep.totalLeads}</div>
                        <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Leads</div>
                      </div>
                      <div>
                        <div className="text-body-sm font-extrabold text-on-surface">{rep.purchaseOrders.length}</div>
                        <div className="text-[11px] text-on-surface-variant uppercase font-semibold">POs</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-on-surface-variant opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
