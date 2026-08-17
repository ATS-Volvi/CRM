import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Megaphone,
  Search,
  Plus,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  BarChart2,
  Calendar
} from "lucide-react";
import { campaignsApi, attributionApi } from "../api/marketing";
import { CampaignPerformance, SourcePerformance } from "../types/marketing";

export default function Campaigns() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"campaigns" | "sources">("campaigns");
  const [search, setSearch] = useState("");

  // Fetch all campaigns performance
  const { data: campaignsData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["campaigns-analytics"],
    queryFn: async () => {
      const res = await attributionApi.getCampaignsAnalytics();
      return res.data || [];
    }
  });

  // Fetch lead source & channel analytics
  const { data: sourceData, isLoading: loadingSources } = useQuery<SourcePerformance>({
    queryKey: ["source-analytics"],
    queryFn: async () => {
      const res = await attributionApi.getLeadSourceAnalytics();
      return res;
    }
  });

  const campaigns: CampaignPerformance[] = Array.isArray(campaignsData) ? campaignsData : [];

  const totalLeads = campaigns.reduce((sum, c) => sum + (c.metrics?.totalLeads || 0), 0);
  const totalWonRevenue = campaigns.reduce((sum, c) => sum + (c.metrics?.totalRevenue || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.campaign?.actualSpend || 0), 0);
  const overallRoas = totalSpend > 0 ? (totalWonRevenue / totalSpend).toFixed(2) : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" /> Campaigns & Attribution
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Measure full-funnel Marketing-to-Revenue performance, lead acquisition channels, and ROI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "campaigns"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab("sources")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "sources"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Source Dimensions
            </button>
          </div>
        </div>
      </div>

      {/* Top High-Level Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Inbound Leads
          </div>
          <div className="text-xl font-extrabold text-slate-900">{totalLeads}</div>
          <div className="text-[11px] text-slate-500">Across all tracked campaigns</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Marketing Spend
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            ₹{totalSpend.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Actual media & campaign costs</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Won Revenue Attributed
          </div>
          <div className="text-xl font-extrabold text-emerald-600">
            ₹{totalWonRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Closed orders from campaign leads</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Overall ROAS / Return
          </div>
          <div className="text-xl font-extrabold text-blue-600">
            {overallRoas ? `${overallRoas}x` : "—"}
          </div>
          <div className="text-[11px] text-slate-500">Revenue / Actual Media Spend</div>
        </div>
      </div>

      {/* TAB 1: CAMPAIGNS TABLE */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="enterprise-card overflow-hidden">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Channel & Platform</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Spend</th>
                  <th>Leads</th>
                  <th>Qualified</th>
                  <th>Opps</th>
                  <th>Won Orders</th>
                  <th>Won Revenue</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {loadingCampaigns ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-400">
                      Loading campaign performance data...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-400">
                      No active marketing campaigns found.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((row) => {
                    const c = row.campaign;
                    const m = row.metrics;
                    return (
                      <tr key={c.id} className="transition-colors">
                        <td className="font-semibold text-slate-900">
                          <div className="text-xs font-bold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">code: {c.code}</div>
                        </td>
                        <td>
                          <div className="text-xs font-medium text-slate-800">{c.channel}</div>
                          <div className="text-[10px] text-slate-400">{c.platform || "Direct"}</div>
                        </td>
                        <td>
                          <span
                            className={`enterprise-badge ${
                              c.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : c.status === "PAUSED"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="text-slate-700 font-medium">
                          ₹{Number(c.budget || 0).toLocaleString()}
                        </td>
                        <td className="text-slate-900 font-bold">
                          {c.actualSpend !== null ? `₹${Number(c.actualSpend).toLocaleString()}` : "—"}
                        </td>
                        <td className="font-semibold text-slate-800">{m?.totalLeads || 0}</td>
                        <td className="text-slate-700">{m?.qualifiedLeads || 0}</td>
                        <td className="text-slate-700">{m?.totalOpportunities || 0}</td>
                        <td className="text-slate-700 font-semibold">{m?.wonOrdersCount || 0}</td>
                        <td className="text-emerald-700 font-bold">
                          ₹{Number(m?.totalRevenue || 0).toLocaleString()}
                        </td>
                        <td className="font-bold text-blue-600">
                          {m?.roas !== null && m?.roas !== undefined ? `${m.roas}x` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SOURCE DIMENSIONS BREAKDOWN */}
      {activeTab === "sources" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Channel */}
          <div className="enterprise-card p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Users className="w-3.5 h-3.5 text-blue-600" /> Performance by Acquisition Channel
            </h3>

            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Leads</th>
                  <th>Qualified</th>
                  <th>Opps</th>
                  <th>Won</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sourceData?.byChannel?.map((ch) => (
                  <tr key={ch.channel}>
                    <td className="font-semibold text-slate-800">{ch.channel}</td>
                    <td>{ch.leads}</td>
                    <td>{ch.qualified}</td>
                    <td>{ch.opportunities}</td>
                    <td>{ch.won}</td>
                    <td className="font-bold text-emerald-600">
                      ₹{Number(ch.revenue || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Source Type */}
          <div className="enterprise-card p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Performance by Source Type
            </h3>

            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Source Type</th>
                  <th>Leads</th>
                  <th>Qualified</th>
                  <th>Opps</th>
                  <th>Won</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sourceData?.bySourceType?.map((st) => (
                  <tr key={st.sourceType}>
                    <td className="font-semibold text-slate-800">{st.sourceType}</td>
                    <td>{st.leads}</td>
                    <td>{st.qualified}</td>
                    <td>{st.opportunities}</td>
                    <td>{st.won}</td>
                    <td className="font-bold text-emerald-600">
                      ₹{Number(st.revenue || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
