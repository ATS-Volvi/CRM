import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LifeBuoy, Plus, Search, Filter, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Building2, Package, Eye, Wrench, ShieldAlert
} from "lucide-react";
import { CreateSupportTicketModal } from "../components/CreateSupportTicketModal";
import { SupportTicketDetailDrawer } from "../components/SupportTicketDetailDrawer";

export default function SupportTickets() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Fetch support tickets
  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["support-tickets", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);

      const res = await fetch(`/api/v1/support-tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch support tickets");
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    }
  });

  // Quick Status update mutation directly from row
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/v1/support-tickets/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    }
  });

  const filteredTickets = tickets.filter((t: any) => {
    const accName = t.account?.name || "";
    const assetName = t.asset?.name || "";
    const desc = t.description || "";
    const tickId = `TICK-${t.id.substring(0, 6)}`.toLowerCase();
    const query = searchQuery.toLowerCase();

    return (
      tickId.includes(query) ||
      accName.toLowerCase().includes(query) ||
      assetName.toLowerCase().includes(query) ||
      desc.toLowerCase().includes(query)
    );
  });

  // Metrics
  const openCount = tickets.filter((t: any) => t.status === "open").length;
  const inProgressCount = tickets.filter((t: any) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t: any) => t.status === "resolved").length;
  const closedCount = tickets.filter((t: any) => t.status === "closed").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" /> Open
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Wrench className="w-3 h-3 text-amber-600" /> In Progress
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "issue":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            Issue
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            Maintenance
          </span>
        );
      case "other":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
            Other
          </span>
        );
      default:
        return <span>{category}</span>;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <LifeBuoy className="w-4 h-4" />
            <span>Customer Service & Field Support</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface">Support Tickets</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Log, track, and resolve equipment issues, maintenance requests, and customer inquiries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-surface-container border border-outline-variant rounded-xl text-on-surface-variant hover:text-on-surface transition-colors"
            title="Refresh Tickets"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
          </button>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Raise Support Ticket
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}
          className={`p-4 bg-surface-container-lowest border rounded-2xl shadow-sm cursor-pointer transition-all ${
            statusFilter === "open" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-outline-variant hover:border-outline"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Open</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{openCount}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Awaiting triage</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
          className={`p-4 bg-surface-container-lowest border rounded-2xl shadow-sm cursor-pointer transition-all ${
            statusFilter === "in_progress" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-outline-variant hover:border-outline"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{inProgressCount}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Under investigation</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === "resolved" ? "all" : "resolved")}
          className={`p-4 bg-surface-container-lowest border rounded-2xl shadow-sm cursor-pointer transition-all ${
            statusFilter === "resolved" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-outline-variant hover:border-outline"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Resolved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{resolvedCount}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Solution confirmed</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === "closed" ? "all" : "closed")}
          className={`p-4 bg-surface-container-lowest border rounded-2xl shadow-sm cursor-pointer transition-all ${
            statusFilter === "closed" ? "border-slate-500 ring-2 ring-slate-500/20" : "border-outline-variant hover:border-outline"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Closed</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-600 mt-2">{closedCount}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Archived</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket ID, account, asset, or issue..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          
          {/* Category Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category:</span>
            <div className="flex gap-1">
              {[
                { key: "all", label: "All" },
                { key: "issue", label: "Issue" },
                { key: "maintenance", label: "Maintenance" },
                { key: "other", label: "Other" }
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategoryFilter(c.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === c.key
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status:</span>
            <div className="flex gap-1">
              {[
                { key: "all", label: "All" },
                { key: "open", label: "Open" },
                { key: "in_progress", label: "In Prog" },
                { key: "resolved", label: "Resolved" },
                { key: "closed", label: "Closed" }
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === st.key
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Ticket ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Account</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Equipment / Asset</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Date Raised</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-xs">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
                      <LifeBuoy className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="font-bold text-on-surface-variant text-sm">No support tickets found.</p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-4 h-4" /> Raise New Ticket
                    </button>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket: any) => (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-surface-container-low/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedTicket(ticket)}
                        className="font-mono font-bold text-primary text-xs hover:underline text-left"
                      >
                        TICK-{ticket.id.substring(0, 6).toUpperCase()}
                      </button>
                    </td>

                    <td className="px-6 py-4">
                      {ticket.account ? (
                        <Link
                          to={`/accounts/${ticket.account.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-on-surface text-sm hover:text-primary hover:underline flex items-center gap-1"
                        >
                          {ticket.account.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">Unassigned</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {ticket.asset ? (
                        <div>
                          <p className="font-medium text-on-surface text-xs">{ticket.asset.name}</p>
                          <p className="text-[10px] text-on-surface-variant font-mono">S/N: {ticket.asset.serialNumber || "N/A"}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {getCategoryBadge(ticket.category || "issue")}
                    </td>

                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-xs text-on-surface truncate" title={ticket.description}>
                        {ticket.description || "No description"}
                      </p>
                    </td>

                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={ticket.status || "open"}
                        onChange={(e) => updateStatusMutation.mutate({ id: ticket.id, status: e.target.value })}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-outline-variant bg-surface-container-low text-on-surface focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-xs text-on-surface-variant font-medium">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-bold rounded-xl transition-colors shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <CreateSupportTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Ticket Detail Drawer */}
      <SupportTicketDetailDrawer
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={() => refetch()}
      />

    </div>
  );
}
