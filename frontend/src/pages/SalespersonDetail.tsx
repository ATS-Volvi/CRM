import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, User, Phone, Mail, Award, Compass, DollarSign, Briefcase, FileSpreadsheet,
  FileText, Clock, Pin, MessageSquare, TrendingUp, Users, CheckSquare, History,
  Instagram, Globe, Facebook
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
  approvedBy?: string | null;
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

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const { data: rep, isLoading, error } = useQuery<Salesperson>({
    queryKey: ["salespersonPerformance", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/salespersons/${id}/performance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load representative profile");
      return res.json();
    },
    enabled: !!id && !!token
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !rep) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-error bg-error-container p-4 rounded-xl">
          {error instanceof Error ? error.message : "Could not load representative details"}
        </div>
        <button
          onClick={() => navigate("/salespersons")}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-surface-container transition-colors mx-auto"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Representatives
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-8 animate-fade-in text-on-surface">
      {/* breadcrumbs & back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/salespersons")}
          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors border border-outline-variant"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <span className="cursor-pointer hover:text-primary" onClick={() => navigate("/salespersons")}>Representatives</span>
            <span>/</span>
            <span className="font-bold text-on-surface">{rep.name}</span>
          </div>
        </div>
      </div>

      {/* Hero profile details */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-outline-variant">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-display-xs font-bold shrink-0">
              {rep.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-display-xs font-bold leading-tight">{rep.name}</h1>
              <div className="flex items-center space-x-3 text-body-md text-on-surface-variant mt-1.5 flex-wrap gap-y-1">
                <span className="capitalize px-3 py-1 rounded-full bg-primary/10 text-primary text-body-xs font-semibold">
                  {rep.role.replace("_", " ")}
                </span>
                <span>•</span>
                <span className={rep.isAvailable ? "text-green-500 font-semibold" : "text-amber-500 font-semibold"}>
                  {rep.isAvailable ? "Available for assignment" : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-md w-full lg:w-auto">
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center shadow-sm">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Won POs</div>
              <div className="text-display-xs font-extrabold text-primary mt-1">{rep.purchaseOrders.length}</div>
            </div>
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center shadow-sm">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Clients</div>
              <div className="text-display-xs font-extrabold text-secondary mt-1">{rep.wonClients.length}</div>
            </div>
            <div className="bg-surface p-5 rounded-xl border border-outline-variant text-center col-span-2 md:col-span-1 shadow-sm">
              <div className="text-body-xs text-on-surface-variant font-bold uppercase tracking-wide">Leads Cap</div>
              <div className="text-display-xs font-extrabold mt-1">{rep.maxOpenLeads}</div>
            </div>
          </div>
        </div>

        {/* Lead Source KPI Cards Row */}
        {(() => {
          const leadSourceCounts = rep.leadSources.reduce((acc, curr) => {
            acc[curr.source] = curr.count;
            return acc;
          }, {} as Record<string, number>);

          const channels = [
            { label: "Email", key: "email", icon: Mail, color: "text-primary bg-primary/10" },
            { label: "Instagram", key: "instagram", icon: Instagram, color: "text-[#E1306C] bg-[#E1306C]/10" },
            { label: "Cold Call", key: "cold_call", icon: Phone, color: "text-secondary bg-secondary/10" },
            { label: "Website", key: "website", icon: Globe, color: "text-primary bg-primary/10" },
            { label: "Facebook", key: "facebook", icon: Facebook, color: "text-[#1877F2] bg-[#1877F2]/10" },
          ];

          const hasOther = typeof leadSourceCounts["other"] === "number" && leadSourceCounts["other"] > 0;
          const kpis = hasOther 
            ? [...channels, { label: "Other", key: "other", icon: Compass, color: "text-on-surface-variant bg-surface-variant" }]
            : channels;

          const isZero = rep.totalLeads === 0;

          return (
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 ${hasOther ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4 ${isZero ? "opacity-50" : ""}`}>
              {kpis.map((ch) => {
                const Icon = ch.icon;
                const count = leadSourceCounts[ch.key] || 0;
                return (
                  <div key={ch.key} className="bg-surface p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{ch.label}</span>
                      <div className={`p-1.5 rounded-lg ${ch.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-on-surface mt-2">{count}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Subsection grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead sources */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <Compass className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Lead Sources Distribution</h3>
            </div>
            <div className="space-y-3">
              {rep.leadSources.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant italic">No lead sources mapped.</p>
              ) : (
                rep.leadSources.map((ls, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{ls.source}</span>
                      <span className="text-on-surface-variant font-semibold">{ls.count} leads</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(ls.count / rep.totalLeads) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Deal categories */}
          <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
              <Briefcase className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-body-lg">Deal Categories Mix</h3>
            </div>
            <div className="space-y-3">
              {rep.dealTypes.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant italic">No deals active or won yet.</p>
              ) : (
                rep.dealTypes.map((dt, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="font-medium">{dt.stage}</span>
                      <span className="text-on-surface-variant font-semibold">{dt.count} deals</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-secondary h-2 rounded-full"
                        style={{ width: `${(dt.count / rep.totalDeals) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quotation Pipeline */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Quotation Pipeline ({rep.quotes?.length ?? 0})</h3>
          </div>
          {(!rep.quotes || rep.quotes.length === 0) ? (
            <p className="text-body-sm text-on-surface-variant italic">No quotations yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rep.quotes.map((q) => {
                const cycleColors: Record<string, string> = {
                  Draft:            "bg-surface-container-high text-on-surface-variant",
                  "Pending Approval": "bg-amber-500/10 text-amber-600",
                  Approved:         "bg-blue-500/10 text-blue-600",
                  Rejected:         "bg-red-500/10 text-red-600",
                  Sent:             "bg-indigo-500/10 text-indigo-600",
                  Viewed:           "bg-purple-500/10 text-purple-600",
                  Accepted:         "bg-green-500/10 text-green-600",
                  Expired:          "bg-slate-500/10 text-slate-500",
                  Superseded:       "bg-slate-500/10 text-slate-400",
                };
                const pillClass = cycleColors[q.cycleStage] ?? "bg-surface-container text-on-surface-variant";
                const isSuperseded = q.cycleStage === "Superseded";
                return (
                  <div key={q.id} className="flex flex-col gap-1 p-3 rounded-lg bg-surface-container border border-outline-variant/50 hover:border-outline-variant transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold text-body-sm font-mono shrink-0 ${isSuperseded ? "line-through text-on-surface-variant" : "text-primary"}`}>
                          {q.quoteNumber ?? "Draft"} v{q.version}
                        </span>
                        <span className="text-on-surface-variant text-body-xs truncate">{q.dealName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${pillClass}`}>{q.cycleStage}</span>
                        <span className="text-body-sm font-bold">${Number(q.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                        <span className="text-body-xs text-on-surface-variant">
                          {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {q.cycleStage === "Pending Approval" && q.approvalComments && (
                      <p className="text-body-xs text-on-surface-variant italic pl-1">
                        💬 {q.approvalComments}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Purchase Orders */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Associated Purchase Orders ({rep.purchaseOrders.length})</h3>
          </div>
          {rep.purchaseOrders.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic">No won purchase orders associated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-medium">
                    <th className="py-2">PO Number</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Generated Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rep.purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-colors">
                      <td className="py-2.5 font-semibold text-primary">{po.poNumber}</td>
                      <td className="py-2.5 font-bold">${Number(po.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-body-xs font-semibold ${
                          po.status === "Approved" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-on-surface-variant">{new Date(po.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Won Clients */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Client Portfolio ({rep.wonClients.length})</h3>
          </div>
          {rep.wonClients.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic">No client accounts activated yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rep.wonClients.map((client) => (
                <div key={client.id} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col justify-between space-y-2 hover:bg-surface-container-low transition-colors">
                  <div>
                    <div className="font-semibold text-body-md text-on-surface">{client.name}</div>
                    <div className="text-body-xs text-on-surface-variant font-medium">{client.company}</div>
                  </div>
                  <div className="flex items-center space-x-2 text-body-xs text-on-surface-variant font-semibold">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span>{client.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activities Timeline */}
        <div className="bg-surface p-6 rounded-xl border border-outline-variant space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-outline-variant pb-3">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-body-lg">Recent Activity</h3>
          </div>
          {(!rep.activities || rep.activities.length === 0) ? (
            <p className="text-body-sm text-on-surface-variant italic">No activities recorded yet.</p>
          ) : (
            <div className="relative space-y-6 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant max-h-80 overflow-y-auto pr-1">
              {rep.activities.map((act) => {
                const dotClass =
                  act.type === "call"         ? "bg-red-100 text-red-600" :
                  act.type === "email"        ? "bg-tertiary-container text-tertiary" :
                  act.type === "meeting"      ? "bg-secondary-container text-secondary" :
                  act.type === "stage_change" ? "bg-primary-container text-primary" :
                  act.type === "task"         ? "bg-surface-container-high text-on-surface" :
                                                "bg-surface-container-high text-on-surface-variant";
                const TypeIcon =
                  act.type === "call"         ? Phone :
                  act.type === "email"        ? Mail :
                  act.type === "meeting"      ? Users :
                  act.type === "stage_change" ? TrendingUp :
                  act.type === "task"         ? CheckSquare :
                                                MessageSquare;
                return (
                  <div key={act.id} className="relative pl-10">
                    <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-surface ${dotClass}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className={`p-3 rounded-lg border transition-colors ${
                      act.pinned ? "bg-secondary-container/10 border-secondary" : "bg-surface-container border-outline-variant/50"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-body-xs font-bold uppercase tracking-wide">{act.type.replace("_", " ")}</span>
                          {act.pinned && <Pin className="w-3 h-3 text-secondary fill-secondary" />}
                          {act.priority && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-body-xs font-semibold">{act.priority}</span>
                          )}
                        </div>
                        <span className="text-body-xs text-on-surface-variant shrink-0">
                          {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {act.outcome && <p className="text-body-sm text-on-surface mt-1 line-clamp-2">{act.outcome}</p>}
                      {act.leadName && <p className="text-body-xs text-on-surface-variant mt-1">📌 {act.leadName}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
