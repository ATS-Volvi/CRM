import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Target,
  Search,
  Plus,
  LayoutList,
  Columns3,
  Building2,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  FileText
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../utils/currency";

export default function Opportunities() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const OPPORTUNITY_STAGES = [
    { key: "DISCOVERY", label: "Discovery", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "REQUIREMENTS", label: "Requirements", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { key: "SOLUTION_DESIGN", label: "Solution / Scope", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { key: "PROPOSAL_QUOTE", label: "Quote Preparation", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "QUOTE_SENT", label: "Quote Sent", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { key: "NEGOTIATION", label: "Negotiation", color: "bg-violet-50 text-violet-700 border-violet-200" },
    { key: "AGREED_PENDING_ORDER", label: "Agreed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "CLOSED_WON", label: "Won", color: "bg-green-100 text-green-800 border-green-300 font-bold" },
    { key: "CLOSED_LOST", label: "Lost", color: "bg-slate-100 text-slate-600 border-slate-200" }
  ];

  const { data: oppsData, isLoading } = useQuery({
    queryKey: ["opportunities-list", selectedStage, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStage !== "ALL") params.set("stage", selectedStage);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await apiClient.get(`/api/v1/opportunities?${params.toString()}`);
      return res;
    }
  });

  const opportunities: any[] = Array.isArray(oppsData) ? oppsData : oppsData?.data || [];
  const totalCount = oppsData?.total || opportunities.length;

  const getStageBadge = (stageId: string) => {
    const s = OPPORTUNITY_STAGES.find((st) => st.key === stageId) || {
      label: stageId || "Discovery",
      color: "bg-slate-100 text-slate-700 border-slate-200"
    };
    return <span className={`enterprise-badge ${s.color}`}>{s.label}</span>;
  };

  const totalPipelineValue = opportunities.reduce(
    (sum, o) => sum + Number(o.amount || o.estimatedValue || 0),
    0
  );

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" /> Opportunities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage genuine commercial requirements from discovery to close.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Total Pipeline</div>
            <div className="text-sm font-bold text-slate-900">
              ₹{totalPipelineValue.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "kanban"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Columns3 className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search opportunities, accounts, contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="enterprise-input pl-9 w-full"
            />
          </div>

          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="enterprise-input shrink-0"
          >
            <option value="ALL">All Stages</option>
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <strong>{opportunities.length}</strong> opportunities
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading commercial opportunities...
        </div>
      ) : opportunities.length === 0 ? (
        <div className="enterprise-card p-12 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">No opportunities found</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Qualified leads will appear here upon commercial conversion.
            </p>
          </div>
          <button onClick={() => navigate("/leads")} className="enterprise-btn-primary mx-auto">
            <span>View Pre-Sales Leads</span>
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* PRIMARY LIST VIEW */
        <div className="enterprise-card overflow-hidden">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Account</th>
                <th>Primary Contact</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Expected Value</th>
                <th>Probability</th>
                <th>Expected Close</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp: any) => (
                <tr
                  key={opp.id}
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                  className="cursor-pointer transition-colors"
                >
                  <td className="font-semibold text-slate-900">
                    <div className="text-xs font-semibold hover:text-blue-600">{opp.name}</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      ID: {opp.id.slice(0, 8)}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-800 flex items-center gap-1.5 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{opp.account?.name || "General Account"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-700">
                      {opp.primaryContact?.firstName
                        ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName || ""}`
                        : "—"}
                    </div>
                  </td>
                  <td>{getStageBadge(opp.stageId)}</td>
                  <td>
                    <div className="text-xs text-slate-700">{opp.owner?.name || "Assigned Rep"}</div>
                  </td>
                  <td className="font-bold text-slate-900">
                    ₹{Number(opp.amount || 0).toLocaleString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700">
                      <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${opp.probability || 50}%` }}
                        />
                      </div>
                      <span>{opp.probability || 50}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>
                        {opp.expectedCloseDate
                          ? new Date(opp.expectedCloseDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })
                          : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/opportunities/${opp.id}`);
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                      title="Open Opportunity"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* KANBAN PIPELINE VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 overflow-x-auto pb-4">
          {OPPORTUNITY_STAGES.slice(0, 7).map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stageId === stage.key);
            const stageTotal = stageOpps.reduce(
              (sum, o) => sum + Number(o.amount || o.estimatedValue || 0),
              0
            );

            return (
              <div
                key={stage.key}
                className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80 flex flex-col min-h-[500px]"
              >
                <div className="px-1 py-1.5 mb-2 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{stage.label}</span>
                    <span className="text-[11px] font-semibold bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded-full">
                      {stageOpps.length}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    ₹{stageTotal.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {stageOpps.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="enterprise-card p-3 cursor-pointer space-y-2 hover:border-emerald-400"
                    >
                      <div className="text-xs font-bold text-slate-900 leading-snug">{opp.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{opp.account?.name || "General Account"}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-900">
                          ₹{Number(opp.amount || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {opp.owner?.name || "Rep"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
