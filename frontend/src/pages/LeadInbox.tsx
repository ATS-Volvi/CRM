import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Inbox,
  Search,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  Building2,
  Calendar,
  Flame,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";

export default function LeadInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterTab, setFilterTab] = useState<"all" | "new" | "urgent" | "followup" | "overdue">("all");
  const [search, setSearch] = useState("");

  const userRole = (user?.role || "sales_rep").toLowerCase();
  const isSalesRep = userRole === "sales_rep" || userRole === "salesperson";
  const isTeamLead = userRole === "team_lead" || userRole === "sales_manager";

  // Fetch Inbox Leads
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["inbox-leads", user?.id],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/leads?limit=100");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  const allLeads: any[] = Array.isArray(leadsData) ? leadsData : [];

  // Filter for logged-in user if Sales Rep
  const userLeads = useMemo(() => {
    if (isSalesRep && user?.id) {
      return allLeads.filter((l) => l.assignedToId === user.id || l.assignedTo?.id === user.id);
    }
    return allLeads;
  }, [allLeads, isSalesRep, user?.id]);

  // Tab Filtering
  const filteredLeads = useMemo(() => {
    let list = userLeads;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.company?.toLowerCase().includes(q) ||
          l.firstName?.toLowerCase().includes(q) ||
          l.lastName?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q)
      );
    }

    if (filterTab === "new") {
      return list.filter((l) => l.status === "NEW" || l.status === "New");
    }
    if (filterTab === "urgent") {
      return list.filter((l) => l.temperature === "Hot" || l.leadScore >= 75);
    }
    if (filterTab === "followup") {
      return list.filter((l) => l.status === "CONTACTED" || l.status === "Contacted");
    }
    if (filterTab === "overdue") {
      const now = new Date();
      return list.filter((l) => l.nextActionDue && new Date(l.nextActionDue) < now && l.status !== "CONVERTED");
    }

    return list;
  }, [userLeads, filterTab, search]);

  const newCount = userLeads.filter((l) => l.status === "NEW" || l.status === "New").length;
  const urgentCount = userLeads.filter((l) => l.temperature === "Hot" || l.leadScore >= 75).length;
  const followUpCount = userLeads.filter((l) => l.status === "CONTACTED" || l.status === "Contacted").length;
  const overdueCount = userLeads.filter(
    (l) => l.nextActionDue && new Date(l.nextActionDue) < new Date() && l.status !== "CONVERTED"
  ).length;

  const title = isSalesRep ? "My Inbox" : isTeamLead ? "Team Live Queue" : "Lead Intake Queue";
  const subtitle = isSalesRep
    ? "Your personal incoming messages, inquiries, and pending actions."
    : "Supervise team incoming lead streams and SLA statuses.";

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-600" /> {title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterTab === "all"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Items ({userLeads.length})
          </button>
          <button
            onClick={() => setFilterTab("new")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === "new"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>New</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
              {newCount}
            </span>
          </button>
          <button
            onClick={() => setFilterTab("urgent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === "urgent"
                ? "bg-red-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Urgent</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-800">
              {urgentCount}
            </span>
          </button>
          <button
            onClick={() => setFilterTab("followup")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === "followup"
                ? "bg-amber-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Follow-ups</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
              {followUpCount}
            </span>
          </button>
          <button
            onClick={() => setFilterTab("overdue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === "overdue"
                ? "bg-rose-700 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Overdue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800">
              {overdueCount}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter inbox items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="enterprise-input pl-9 w-full"
          />
        </div>
      </div>

      {/* Inbox List */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading your inbox items...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="enterprise-card p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No items in this queue</h3>
          <p className="text-xs text-slate-400">
            You are all caught up for this filter category.
          </p>
        </div>
      ) : (
        <div className="enterprise-card overflow-hidden divide-y divide-slate-100">
          {filteredLeads.map((item: any) => {
            const isHot = item.temperature === "Hot" || item.leadScore >= 75;
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/leads/${item.id}`)}
                className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                      {item.company || `${item.firstName} ${item.lastName}`}
                    </span>
                    <span className="text-[11px] text-slate-400">• {item.firstName} {item.lastName}</span>
                    {isHot && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
                        <Flame className="w-3 h-3 text-red-500 fill-red-500" /> Hot
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {item.sourceChannel || item.source || "Website"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-1 italic">
                    &ldquo;{item.body || item.subject || "New commercial enquiry captured."}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Next Action: <strong>{item.nextAction || "Reply to Lead"}</strong>
                    </span>
                    <span>•</span>
                    <span>Received {new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => navigate(`/leads/${item.id}`)}
                    className="enterprise-btn-primary py-1 px-3 text-xs"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (item.email) {
                        window.location.href = `mailto:${item.email}`;
                      } else {
                        navigate(`/leads/${item.id}`);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                    title="Send Email"
                  >
                    <Mail className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (item.phone) {
                        window.location.href = `tel:${item.phone}`;
                      } else {
                        navigate(`/leads/${item.id}`);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
