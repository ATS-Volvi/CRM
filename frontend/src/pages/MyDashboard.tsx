import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  Target,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowRight,
  MessageSquare,
  Phone,
  FileText,
  Flame,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Inbox
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";
import { normalizeStageName } from "../utils/pipelineStages";

export default function MyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName = user?.name?.split(" ")[0] || "there";

  // Fetch Rep's personal leads & follow-ups
  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ["rep-leads-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/leads?limit=50");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  // Fetch Rep's opportunities
  const { data: oppsData, isLoading: loadingOpps } = useQuery({
    queryKey: ["rep-opps-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/opportunities?limit=50");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  // Fetch Rep's tasks / follow-ups
  const { data: tasksData } = useQuery({
    queryKey: ["rep-tasks-today"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/dashboard/today");
      return res || { tasks: [], followUpsNeeded: [] };
    }
  });

  // Fetch Rep's Notifications
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/notifications");
      return Array.isArray(res) ? res : res?.data || [];
    }
  });

  const leads: any[] = Array.isArray(leadsData) ? leadsData : [];
  const opportunities: any[] = Array.isArray(oppsData) ? oppsData : [];
  const notifications: any[] = Array.isArray(notificationsData) ? notificationsData : [];

  // Metrics Calculation
  const newLeads = leads.filter((l) => (l.status || "").toUpperCase() === "NEW");
  const contactedLeads = leads.filter((l) => (l.status || "").toUpperCase() === "CONTACTED");
  const qualifiedLeads = leads.filter((l) => (l.status || "").toUpperCase() === "QUALIFIED");
  const getStageName = (o: any) => normalizeStageName(o.stage?.name || o.stageId);

  const discoveryOpps = opportunities.filter((o) => getStageName(o) === "Discovery");
  const reqOpps = opportunities.filter((o) => getStageName(o) === "Requirements");
  const solutionOpps = opportunities.filter((o) => getStageName(o) === "Solution / Scope");
  const quotePrepOpps = opportunities.filter((o) => getStageName(o) === "Quote Preparation");
  const quoteSentOpps = opportunities.filter((o) => getStageName(o) === "Quote Sent");
  const negotiationOpps = opportunities.filter((o) => getStageName(o) === "Negotiation");
  const agreedOpps = opportunities.filter((o) => getStageName(o) === "Agreed");

  const tasks = tasksData?.tasks || [];
  const overdueTasks = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date());

  const totalWonRevenue = opportunities
    .filter((o) => getStageName(o) === "Won")
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const totalPipelineValue = opportunities
    .filter((o) => {
      const s = getStageName(o);
      return s !== "Won" && s !== "Lost";
    })
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  // Construct Focus Action Items
  const focusItems: {
    id: string;
    type: "lead" | "opportunity" | "task";
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    url: string;
  }[] = [];

  // 0. Customer Interest & Auto-Escalation Notifications
  notifications
    .filter((n) => !n.isRead && (n.title?.includes("Customer") || n.title?.includes("Interest") || n.title?.includes("Approval")))
    .slice(0, 3)
    .forEach((n) => {
      focusItems.push({
        id: `notif-${n.id}`,
        type: "opportunity",
        title: n.title,
        subtitle: n.message,
        badge: n.type === "alert" ? "Approval Escalation" : "Customer Engagement",
        badgeColor: n.type === "alert" ? "bg-purple-50 text-purple-700 border-purple-200 font-bold" : "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold",
        url: n.link || "/opportunities"
      });
    });

  // 1. High priority/new leads
  newLeads.slice(0, 3).forEach((l) => {
    focusItems.push({
      id: `lead-${l.id}`,
      type: "lead",
      title: `New Inbound Enquiry: ${l.company || `${l.firstName} ${l.lastName}`}`,
      subtitle: `Via ${l.sourceChannel || l.source || "Website"} • Assigned to you`,
      badge: "Action Required",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      url: `/leads/${l.id}`
    });
  });

  // 2. Opportunities requiring quotes/follow-up
  opportunities
    .filter((o) => {
      const s = getStageName(o);
      return s === "Quote Preparation" || s === "Negotiation" || s === "Quote Sent" || s === "Requirements";
    })
    .slice(0, 2)
    .forEach((o) => {
      const stageName = getStageName(o);
      focusItems.push({
        id: `opp-${o.id}`,
        type: "opportunity",
        title: `Commercial Follow-up: ${o.name}`,
        subtitle: `Stage: ${stageName} • Value: ${formatCurrency(o.amount || 0)}`,
        badge: "Commercial",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        url: `/opportunities/${o.id}`
      });
    });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header with Greeting & Purpose */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Good morning, {userName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Here is your daily action queue and commercial pipeline overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/leads/new")} className="enterprise-btn-primary">
            <span>+ Inbound Lead</span>
          </button>
          <button onClick={() => navigate("/inbox")} className="enterprise-btn-secondary">
            <Inbox className="w-3.5 h-3.5" />
            <span>Open My Inbox</span>
          </button>
        </div>
      </div>

      {/* 2. Top Compact Daily Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate("/leads")}
          className="enterprise-card p-4 space-y-1 cursor-pointer hover:border-blue-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">New Leads</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{newLeads.length}</div>
          <div className="text-[11px] text-slate-500">Requires initial response</div>
        </div>

        <div
          onClick={() => navigate("/inbox")}
          className="enterprise-card p-4 space-y-1 cursor-pointer hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Follow-ups Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {contactedLeads.length + tasks.length}
          </div>
          <div className="text-[11px] text-slate-500">Active follow-up queue</div>
        </div>

        <div
          onClick={() => navigate("/activities")}
          className="enterprise-card p-4 space-y-1 cursor-pointer hover:border-emerald-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Deals</span>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{opportunities.length}</div>
          <div className="text-[11px] text-slate-500">Commercial opportunities</div>
        </div>

        <div
          onClick={() => navigate("/activities")}
          className="enterprise-card p-4 space-y-1 cursor-pointer hover:border-red-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue Actions</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-600">{overdueTasks.length}</div>
          <div className="text-[11px] text-slate-500">Past SLA deadline</div>
        </div>
      </div>

      {/* 3. MAIN SECTION: FOCUS QUEUE & PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FOCUS Action Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" /> Today&apos;s Focus Actions
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Highest priority tasks & enquiries
              </span>
            </div>

            {focusItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p>You are all caught up! No urgent pending actions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {focusItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(item.url)}
                    className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`enterprise-badge ${item.badgeColor}`}>{item.badge}</span>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MY PERFORMANCE (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="enterprise-card p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> My Performance
              </h2>
              <Link to="/rep-portal" className="text-[11px] text-blue-600 font-semibold hover:underline">
                Full Portal →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Closed Revenue</div>
                <div className="text-base font-extrabold text-emerald-600">
                  ₹{totalWonRevenue.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Active Pipeline</div>
                <div className="text-base font-extrabold text-slate-900">
                  ₹{totalPipelineValue.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Quarterly Target</div>
                <div className="text-base font-extrabold text-slate-800">₹25,00,000</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-0.5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Win Rate</div>
                <div className="text-base font-extrabold text-blue-600">68%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MY PIPELINE: SEPARATE LEADS AND OPPORTUNITY STAGES */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          My Active Pipeline Breakdown
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEADS STAGES */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" /> Pre-Sales Leads ({leads.length})
              </div>
              <Link to="/leads" className="text-[11px] text-blue-600 font-semibold hover:underline">
                View All Leads →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => navigate("/leads")}
                className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-center cursor-pointer hover:bg-blue-100/60 transition-colors"
              >
                <div className="text-lg font-extrabold text-blue-700">{newLeads.length}</div>
                <div className="text-[11px] font-semibold text-blue-600">New</div>
              </div>

              <div
                onClick={() => navigate("/leads")}
                className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-100 text-center cursor-pointer hover:bg-amber-100/60 transition-colors"
              >
                <div className="text-lg font-extrabold text-amber-700">{contactedLeads.length}</div>
                <div className="text-[11px] font-semibold text-amber-600">Contacted</div>
              </div>

              <div
                onClick={() => navigate("/leads")}
                className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-center cursor-pointer hover:bg-emerald-100/60 transition-colors"
              >
                <div className="text-lg font-extrabold text-emerald-700">{qualifiedLeads.length}</div>
                <div className="text-[11px] font-semibold text-emerald-600">Qualified</div>
              </div>
            </div>
          </div>

          {/* OPPORTUNITIES STAGES */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600" /> Commercial Opportunities ({opportunities.length})
              </div>
              <Link
                to="/pipeline"
                className="text-[11px] text-blue-600 font-semibold hover:underline"
              >
                View Pipeline →
              </Link>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              <div
                onClick={() => navigate("/pipeline")}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center cursor-pointer hover:bg-slate-100"
              >
                <div className="text-sm font-extrabold text-slate-800">{discoveryOpps.length}</div>
                <div className="text-[10px] text-slate-500 truncate">Discovery</div>
              </div>

              <div
                onClick={() => navigate("/pipeline")}
                className="p-2 rounded-lg bg-cyan-50 border border-cyan-100 text-center cursor-pointer hover:bg-cyan-100"
              >
                <div className="text-sm font-extrabold text-cyan-800">{reqOpps.length}</div>
                <div className="text-[10px] text-cyan-600 truncate">Reqs</div>
              </div>

              <div
                onClick={() => navigate("/pipeline")}
                className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-center cursor-pointer hover:bg-amber-100"
              >
                <div className="text-sm font-extrabold text-amber-800">{quotePrepOpps.length}</div>
                <div className="text-[10px] text-amber-600 truncate">Quote Prep</div>
              </div>

              <div
                onClick={() => navigate("/pipeline")}
                className="p-2 rounded-lg bg-orange-50 border border-orange-100 text-center cursor-pointer hover:bg-orange-100"
              >
                <div className="text-sm font-extrabold text-orange-800">{quoteSentOpps.length}</div>
                <div className="text-[10px] text-orange-600 truncate">Sent</div>
              </div>

              <div
                onClick={() => navigate("/pipeline")}
                className="p-2 rounded-lg bg-violet-50 border border-violet-100 text-center cursor-pointer hover:bg-violet-100"
              >
                <div className="text-sm font-extrabold text-violet-800">{negotiationOpps.length}</div>
                <div className="text-[10px] text-violet-600 truncate">Negotiation</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
