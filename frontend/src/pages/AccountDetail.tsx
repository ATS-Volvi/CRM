import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Target,
  FileText,
  ShoppingBag,
  Package,
  Truck,
  Activity,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Wrench
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { CreateSupportTicketModal } from "../components/CreateSupportTicketModal";
import { SupportTicketDetailDrawer } from "../components/SupportTicketDetailDrawer";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "overview" | "contacts" | "opportunities" | "quotes" | "orders" | "supply" | "assets" | "activities" | "tickets"
  >("overview");

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Fetch Account 360 data
  const { data: account, isLoading, error } = useQuery({
    queryKey: ["account-detail-360", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/accounts/${id}`);
      return res;
    },
    enabled: !!id
  });

  // Fetch related contacts
  const { data: contactsData } = useQuery({
    queryKey: ["account-contacts", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/contacts?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related opportunities
  const { data: oppsData } = useQuery({
    queryKey: ["account-opportunities", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/opportunities?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related assets
  const { data: assetsData } = useQuery({
    queryKey: ["account-assets", id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/assets?accountId=${id}`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: !!id
  });

  // Fetch related support tickets
  const { data: ticketsData, refetch: refetchTickets } = useQuery({
    queryKey: ["account-support-tickets", id],
    queryFn: async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/v1/support-tickets?accountId=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const contacts: any[] = Array.isArray(contactsData) ? contactsData : [];
  const opportunities: any[] = Array.isArray(oppsData) ? oppsData : [];
  const assets: any[] = Array.isArray(assetsData) ? assetsData : [];
  const tickets: any[] = Array.isArray(ticketsData) ? ticketsData : [];

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading Customer 360 profile...
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-red-600 font-semibold text-sm">Account not found</div>
        <button onClick={() => navigate("/accounts")} className="enterprise-btn-primary mx-auto">
          Back to Accounts
        </button>
      </div>
    );
  }

  const pipelineValue = opportunities.reduce((sum, o) => sum + Number(o.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/accounts")}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Accounts</span>
      </button>

      {/* Account 360 Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Customer 360 Account
            </span>
            <span className="text-xs text-slate-400">ID: {account.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
            <span>Industry: <strong>{account.industry || "Manufacturing"}</strong></span>
            <span>•</span>
            <span>Owner: <strong>{account.owner?.name || "Account Manager"}</strong></span>
            <span>•</span>
            <span>Territory: <strong>{account.territory || "Middle East & GCC"}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 shrink-0">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Pipeline Value</div>
            <div className="text-xl font-extrabold text-slate-900">
              ₹{pipelineValue.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Installed Assets</div>
            <div className="text-xl font-bold text-teal-600">{assets.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "contacts"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Contacts</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {contacts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "opportunities"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Opportunities</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {opportunities.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("assets")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "assets"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Assets</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {assets.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("tickets")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "tickets"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Support Tickets</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            tickets.length > 0 ? "bg-blue-100 text-blue-700 font-bold" : "bg-slate-100 text-slate-600"
          }`}>
            {tickets.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Opportunities */}
            <div className="enterprise-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" /> Active Commercial Opportunities
                </h3>
              </div>

              {opportunities.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No active commercial opportunities for this account.
                </div>
              ) : (
                <div className="space-y-2">
                  {opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 hover:border-blue-300 hover:bg-white transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{opp.name}</div>
                        <div className="text-[11px] text-slate-500">Stage: {opp.stageId}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-slate-900">
                          ₹{Number(opp.amount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">Prob: {opp.probability || 50}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Installed Assets */}
            <div className="enterprise-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-teal-600" /> Installed & Delivered Assets
                </h3>
              </div>

              {assets.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No delivered assets tracked for this customer yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((ast) => (
                    <div
                      key={ast.id}
                      onClick={() => navigate("/assets")}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 hover:border-teal-300 hover:bg-white transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {ast.name} ({ast.assetNumber})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Serial: {ast.serialNumber || "N/A"} • Location: {ast.location || "On-site"}
                        </div>
                      </div>
                      <span className="enterprise-badge bg-teal-50 text-teal-700 border-teal-200">
                        {ast.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support Tickets Section */}
            <div className="enterprise-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <LifeBuoy className="w-3.5 h-3.5 text-blue-600" /> Support & Service Tickets ({tickets.length})
                </h3>
                <button
                  onClick={() => setIsTicketModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Raise Ticket
                </button>
              </div>

              {tickets.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No support tickets logged for this account.
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.slice(0, 3).map((tick) => (
                    <div
                      key={tick.id}
                      onClick={() => setSelectedTicket(tick)}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 hover:border-blue-300 hover:bg-white transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">TICK-{tick.id.substring(0, 6).toUpperCase()}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {tick.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 truncate max-w-sm">{tick.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          tick.status === "open"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : tick.status === "in_progress"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : tick.status === "resolved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}>
                          {tick.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {tickets.length > 3 && (
                    <button
                      onClick={() => setActiveTab("tickets")}
                      className="w-full text-center text-xs text-blue-600 font-bold hover:underline py-1.5"
                    >
                      View all {tickets.length} tickets →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR: Key Contacts */}
          <div className="space-y-4">
            <div className="enterprise-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" /> Key Contacts
                </h3>
              </div>

              {contacts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No contacts registered for this account.
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-slate-500 text-[11px]">Role: {c.role || "Executive"}</div>
                      {c.email && <div className="text-slate-600">{c.email}</div>}
                      {c.phone && <div className="text-slate-600">{c.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CONTACTS */}
      {activeTab === "contacts" && (
        <div className="enterprise-card overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Role / Designation</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Primary Contact</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold text-slate-900">
                    {c.firstName} {c.lastName}
                  </td>
                  <td>{c.role || "General Stakeholder"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.phone || "—"}</td>
                  <td>
                    {c.isPrimary ? (
                      <span className="enterprise-badge bg-blue-50 text-blue-700 border-blue-200">
                        Primary
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: OPPORTUNITIES */}
      {activeTab === "opportunities" && (
        <div className="enterprise-card overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Stage</th>
                <th>Expected Value</th>
                <th>Probability</th>
                <th>Owner</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                  className="cursor-pointer transition-colors"
                >
                  <td className="font-semibold text-slate-900">{opp.name}</td>
                  <td>
                    <span className="enterprise-badge bg-slate-100 text-slate-700 border-slate-200">
                      {opp.stageId}
                    </span>
                  </td>
                  <td className="font-bold text-slate-900">
                    ₹{Number(opp.amount || 0).toLocaleString()}
                  </td>
                  <td>{opp.probability || 50}%</td>
                  <td>{opp.owner?.name || "Rep"}</td>
                  <td className="text-right">
                    <button
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="enterprise-btn-outline py-1 px-2.5 text-xs"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: ASSETS */}
      {activeTab === "assets" && (
        <div className="enterprise-card overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Asset Number</th>
                <th>Product / Name</th>
                <th>Serial Number</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((ast) => (
                <tr key={ast.id}>
                  <td className="font-mono text-xs font-bold text-slate-900">{ast.assetNumber}</td>
                  <td className="font-semibold text-slate-800">{ast.name}</td>
                  <td className="font-mono text-xs text-slate-600">{ast.serialNumber || "—"}</td>
                  <td>{ast.location || "Customer Facility"}</td>
                  <td>
                    <span className="enterprise-badge bg-teal-50 text-teal-700 border-teal-200">
                      {ast.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: SUPPORT TICKETS */}
      {activeTab === "tickets" && (
        <div className="enterprise-card overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Support & Maintenance History</h3>
              <p className="text-xs text-slate-500">All field tickets, maintenance requests, and issues logged for this account.</p>
            </div>
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Raise New Ticket
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <LifeBuoy className="w-8 h-8 opacity-30 mx-auto" />
              <p>No support tickets found for this account.</p>
            </div>
          ) : (
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Equipment / Asset</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Date Logged</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t: any) => (
                  <tr key={t.id} onClick={() => setSelectedTicket(t)} className="cursor-pointer hover:bg-slate-50">
                    <td className="font-mono text-xs font-bold text-primary">
                      TICK-{t.id.substring(0, 6).toUpperCase()}
                    </td>
                    <td>{t.asset?.name ? `${t.asset.name} (S/N: ${t.asset.serialNumber || "N/A"})` : "—"}</td>
                    <td>
                      <span className="enterprise-badge bg-slate-100 text-slate-700">
                        {t.category}
                      </span>
                    </td>
                    <td className="max-w-xs truncate text-xs text-slate-700">{t.description}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        t.status === "open"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : t.status === "in_progress"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : t.status === "resolved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }}
                        className="enterprise-btn-outline py-1 px-2.5 text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Support Ticket Modal & Drawer */}
      <CreateSupportTicketModal
        isOpen={isTicketModalOpen}
        defaultAccountId={id}
        onClose={() => setIsTicketModalOpen(false)}
        onSuccess={() => refetchTickets()}
      />

      <SupportTicketDetailDrawer
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={() => refetchTickets()}
      />
    </div>
  );
}
