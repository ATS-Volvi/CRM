import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Search, Globe, X, User, Plus, Filter, Calendar } from "lucide-react";
import { formatCurrency } from "../utils/currency";

export default function LeadInbox() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isSimpleView, setIsSimpleView] = useState(true);

  // Fetch leads
  const { data: leads, isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token
  });

  // Filter leads based on search query and status dropdown
  const filteredLeads = leads?.filter((lead: any) => {
    const numberStr = lead.leadNumber || "";
    const nameStr = `${lead.firstName} ${lead.lastName}`.toLowerCase();
    const companyStr = (lead.company || "").toLowerCase();
    const matchesSearch = 
      numberStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameStr.includes(searchQuery.toLowerCase()) ||
      companyStr.includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Contacted":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Qualified":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Lost":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="p-8 pb-12 max-w-[1440px] mx-auto min-h-screen space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-on-surface">Leads Inbox</h2>
          <p className="text-base text-on-surface-variant font-semibold">
            {leads ? `${leads.length} total leads` : "Loading leads..."}
          </p>
        </div>
        <Link 
          to="/leads/new" 
          className="flex items-center gap-2 px-6 py-4 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>+ New Lead</span>
        </Link>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead number, client, or company..." 
            className="w-full bg-surface border border-outline rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Status Dropdown & Toggle View */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-on-surface-variant" />
            <span className="text-sm font-semibold text-on-surface-variant">Status:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-outline rounded-xl px-4 py-3 text-sm focus:ring-primary focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Meeting/Demo">Meeting/Demo</option>
              <option value="Proposal">Proposal</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          <div className="flex border border-outline-variant rounded-xl overflow-hidden p-0.5 bg-surface-container">
            <button 
              onClick={() => setIsSimpleView(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSimpleView ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-variant'}`}
            >
              Simple
            </button>
            <button 
              onClick={() => setIsSimpleView(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isSimpleView ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-variant'}`}
            >
              Full
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="px-6 py-4">Lead #</th>
                <th className="px-6 py-4">Client</th>
                {!isSimpleView && <th className="px-6 py-4">Services/Category</th>}
                {!isSimpleView && <th className="px-6 py-4">Salesperson</th>}
                {!isSimpleView && <th className="px-6 py-4">Lead Type</th>}
                <th className="px-6 py-4 text-right">Expected Value</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={isSimpleView ? 5 : 8} className="px-6 py-12 text-center font-bold text-on-surface-variant">Loading leads...</td>
                </tr>
              ) : filteredLeads && filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={isSimpleView ? 5 : 8} className="px-6 py-16 text-center space-y-3">
                    <p className="font-bold text-on-surface-variant">No leads yet — capture your first business opportunity!</p>
                    <Link to="/leads/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90">
                      + Create First Lead
                    </Link>
                  </td>
                </tr>
              ) : (
              filteredLeads?.map((lead: any) => {
                  let servicesStr = "N/A";
                  if (lead.categoriesData) {
                    try {
                      const data = typeof lead.categoriesData === "string" ? JSON.parse(lead.categoriesData) : lead.categoriesData;
                      if (Array.isArray(data) && data.length > 0) {
                        servicesStr = data.map((d: any) => d.categoryName).join(", ");
                      }
                    } catch (e) {
                      // ignore
                    }
                  }
                  return (
                    <tr key={lead.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-primary hover:underline">
                        <Link to={`/leads/${lead.id}`}>
                          {lead.leadNumber || "N/A"}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-on-surface">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-on-surface-variant">{lead.company || "No Company"}</p>
                      </td>
                      {!isSimpleView && (
                        <td className="px-6 py-4 max-w-[200px] truncate" title={servicesStr}>
                          {servicesStr}
                        </td>
                      )}
                      {!isSimpleView && (
                        <td className="px-6 py-4 font-semibold text-on-surface-variant">
                          {lead.assignedTo?.name || "Unassigned"}
                        </td>
                      )}
                      {!isSimpleView && (
                        <td className="px-6 py-4 font-semibold text-on-surface-variant">
                          {lead.industry || "General"}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right font-bold text-on-surface">
                        {formatCurrency(lead.leadScore * 100)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant font-semibold">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
