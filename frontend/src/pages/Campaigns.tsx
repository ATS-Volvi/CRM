import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
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
  Calendar,
  Edit2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  X,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { campaignsApi, attributionApi } from "../api/marketing";
import { Campaign, CampaignPerformance, SourcePerformance } from "../types/marketing";
import { CampaignFormModal } from "../components/CampaignFormModal";

export default function Campaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"campaigns" | "sources">("campaigns");
  const [search, setSearch] = useState("");

  // Modal states for Create / Edit
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Deletion modal states
  const [campaignToDelete, setCampaignToDelete] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch all campaigns with performance data
  const {
    data: campaignsData,
    isLoading: loadingCampaigns,
    refetch: refetchCampaigns
  } = useQuery({
    queryKey: ["campaigns-analytics"],
    queryFn: async () => {
      try {
        const res = await campaignsApi.getCampaigns({ limit: 100 });
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
      } catch (e) {}

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

  // Delete Campaign Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await campaignsApi.deleteCampaign(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToDelete(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err.message || "Failed to delete campaign");
    }
  });

  const campaigns: any[] = Array.isArray(campaignsData) ? campaignsData : [];

  const totalLeads = campaigns.reduce((sum, row: any) => {
    const m = row.metrics || row;
    return sum + (m.totalLeads || 0);
  }, 0);
  const totalWonRevenue = campaigns.reduce((sum, row: any) => {
    const m = row.metrics || row;
    return sum + (m.totalRevenue || 0);
  }, 0);
  const totalSpend = campaigns.reduce((sum, row: any) => {
    const c = row.campaign || row;
    return sum + (c.actualSpend || 0);
  }, 0);
  const overallRoas = totalSpend > 0 ? (totalWonRevenue / totalSpend).toFixed(2) : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Campaigns & Attribution
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Measure full-funnel Marketing-to-Revenue performance, lead acquisition channels, and ROI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "campaigns"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab("sources")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "sources"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Source Dimensions
            </button>
          </div>

          {/* Create Campaign Button */}
          <button
            onClick={() => {
              setSelectedCampaign(null);
              setIsFormModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Top High-Level Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Inbound Leads
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{totalLeads}</div>
          <div className="text-[11px] text-slate-500">Across all tracked campaigns</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Marketing Spend
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            ₹{totalSpend.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Actual media & campaign costs</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Won Revenue Attributed
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ₹{totalWonRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Closed orders from campaign leads</div>
        </div>

        <div className="enterprise-card p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Overall ROAS / Return
          </div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
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
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingCampaigns ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-slate-400">
                      Loading campaign performance data...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-400">
                      <Megaphone className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <div className="font-semibold text-slate-700 dark:text-slate-300">No active marketing campaigns found</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Click "Create Campaign" to launch a new campaign and start tracking full-funnel attribution.
                      </div>
                    </td>
                  </tr>
                ) : (
                  campaigns.map((row: any) => {
                    const c = row.campaign || row;
                    const m = row.metrics || row;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/campaigns/${c.id}`)}
                        className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        <td className="font-semibold text-slate-900">
                          <Link
                            to={`/campaigns/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {c.name}
                          </Link>
                          <div className="text-[11px] text-slate-400 font-mono">code: {c.code}</div>
                        </td>
                        <td>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{c.channel}</div>
                          <div className="text-[10px] text-slate-400">{c.platform || "Direct"}</div>
                        </td>
                        <td>
                          <span
                            className={`enterprise-badge ${
                              c.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : c.status === "PAUSED"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="text-slate-700 font-medium">
                          ₹{Number(c.budget || 0).toLocaleString()}
                        </td>
                        <td className="text-slate-900 dark:text-white font-bold">
                          {c.actualSpend !== null && c.actualSpend !== undefined ? `₹${Number(c.actualSpend).toLocaleString()}` : "—"}
                        </td>
                        <td className="font-semibold text-slate-800 dark:text-slate-200">{m?.totalLeads || 0}</td>
                        <td className="text-slate-700 dark:text-slate-300">{m?.qualifiedLeads || 0}</td>
                        <td className="text-slate-700 dark:text-slate-300">{m?.totalOpportunities || 0}</td>
                        <td className="text-slate-700 dark:text-slate-300 font-semibold">{m?.wonOrdersCount || 0}</td>
                        <td className="text-emerald-700 dark:text-emerald-400 font-bold">
                          ₹{Number(m?.totalRevenue || 0).toLocaleString()}
                        </td>
                        <td className="font-bold text-blue-600 dark:text-blue-400">
                          {m?.roas !== null && m?.roas !== undefined ? `${m.roas}x` : "—"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit Action Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCampaign(c);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Campaign"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Action Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteError(null);
                                setCampaignToDelete(c);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Campaign"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* View Detail Link */}
                            <Link
                              to={`/campaigns/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline p-1.5"
                              title="View Campaign Details"
                            >
                              <span>View</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
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
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
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
                {loadingSources ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-slate-400">
                      Loading channel metrics...
                    </td>
                  </tr>
                ) : !sourceData?.byChannel || sourceData.byChannel.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-slate-400">
                      No channel attribution data.
                    </td>
                  </tr>
                ) : (
                  sourceData.byChannel.map((ch) => (
                    <tr key={ch.channel}>
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{ch.channel}</td>
                      <td>{ch.leads}</td>
                      <td>{ch.qualified}</td>
                      <td>{ch.opportunities}</td>
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{ch.won}</td>
                      <td className="text-emerald-700 dark:text-emerald-400 font-bold">₹{ch.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* By Source Type */}
          <div className="enterprise-card p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Target className="w-3.5 h-3.5 text-indigo-600" /> Performance by Source Type
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
                {loadingSources ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-slate-400">
                      Loading source metrics...
                    </td>
                  </tr>
                ) : !sourceData?.bySourceType || sourceData.bySourceType.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-slate-400">
                      No source type attribution data.
                    </td>
                  </tr>
                ) : (
                  sourceData.bySourceType.map((st) => (
                    <tr key={st.sourceType}>
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{st.sourceType}</td>
                      <td>{st.leads}</td>
                      <td>{st.qualified}</td>
                      <td>{st.opportunities}</td>
                      <td className="font-semibold text-slate-800 dark:text-slate-200">{st.won}</td>
                      <td className="text-emerald-700 dark:text-emerald-400 font-bold">₹{st.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT CAMPAIGN MODAL ── */}
      <CampaignFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedCampaign(null);
        }}
        campaign={selectedCampaign}
        onSuccess={() => {
          refetchCampaigns();
        }}
      />

      {/* ── DELETE CONFIRMATION DIALOG MODAL ── */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900 shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Campaign "{campaignToDelete.name}"?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete campaign <span className="font-mono font-bold text-slate-700 dark:text-slate-200">({campaignToDelete.code})</span>? This will permanently remove the campaign record.
                </p>
              </div>

              {/* Surfaced Backend Rejection Error */}
              {deleteError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Deletion Rejected</span>
                    <span>{deleteError}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCampaignToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(campaignToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
