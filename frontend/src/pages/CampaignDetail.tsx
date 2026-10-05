import React, { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Megaphone,
  TrendingUp,
  BarChart2,
  Users,
  Target,
  DollarSign,
  Calendar,
  Sparkles,
  Layers,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  FileText,
  Briefcase,
  Percent,
  RefreshCw,
  Tag,
  Share2,
  Filter,
  Eye,
  Building2,
  Mail,
  Phone,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Download,
  X
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from "recharts";
import { campaignsApi } from "../api/marketing";
import { Campaign, CampaignPerformance, CampaignMetrics, CampaignAd } from "../types/marketing";
import { CampaignAdFormModal } from "../components/CampaignAdFormModal";
import { CampaignMessagesTab } from "../components/CampaignMessagesTab";

import { formatMoney } from "../lib/formatMoney";

/**
 * Status Badge Renderer for Campaign Status
 */
function getStatusBadgeClass(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "PAUSED":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
    case "COMPLETED":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    case "DRAFT":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "leads" | "opportunities" | "ads" | "messages">("overview");

  // Timeseries granularity & query
  const [timeseriesGranularity, setTimeseriesGranularity] = useState<"day" | "week">("day");

  // Leads CSV export state
  const [isExportingLeads, setIsExportingLeads] = useState(false);
  const [exportLeadsError, setExportLeadsError] = useState<string | null>(null);

  // Ad modal and delete state
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<CampaignAd | null>(null);
  const [adToDelete, setAdToDelete] = useState<CampaignAd | null>(null);
  const [deleteAdError, setDeleteAdError] = useState<string | null>(null);

  // Fetch campaign and performance report
  const {
    data: campaignDetailData,
    isLoading: loadingCampaign,
    isPending: pendingCampaign,
    isError: errorCampaign,
    refetch: refetchCampaign
  } = useQuery({
    queryKey: ["campaign-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Campaign ID required");
      return await campaignsApi.getCampaignById(id);
    },
    enabled: !!id
  });

  // Fetch timeseries data for Performance & Funnel tab
  const {
    data: timeseriesData,
    isLoading: loadingTimeseries,
    refetch: refetchTimeseries
  } = useQuery({
    queryKey: ["campaign-timeseries", id, timeseriesGranularity],
    queryFn: async () => {
      if (!id) return null;
      return await campaignsApi.getCampaignTimeseries(id, timeseriesGranularity);
    },
    enabled: !!id && (activeTab === "performance" || activeTab === "overview")
  });

  const handleExportLeadsCsv = async () => {
    if (!id || !campaignDetailData?.campaign) return;
    try {
      setIsExportingLeads(true);
      setExportLeadsError(null);
      await campaignsApi.exportCampaignLeadsCsv(id, campaignDetailData.campaign.code);
    } catch (err: any) {
      setExportLeadsError(err.message || "Failed to export campaign leads");
    } finally {
      setIsExportingLeads(false);
    }
  };

  // Delete Ad Mutation
  const deleteAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      if (!id) throw new Error("Campaign ID required");
      return await campaignsApi.deleteCampaignAd(id, adId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      refetchCampaign();
      setAdToDelete(null);
      setDeleteAdError(null);
    },
    onError: (err: any) => {
      setDeleteAdError(err.message || "Failed to delete creative ad");
    }
  });

  // Fetch leads attributed to this campaign
  const {
    data: leadsData,
    isLoading: loadingLeads,
    refetch: refetchLeads
  } = useQuery({
    queryKey: ["campaign-leads", id],
    queryFn: async () => {
      if (!id) return { data: [], total: 0 };
      return await campaignsApi.getCampaignLeads(id, { limit: 100 });
    },
    enabled: !!id && (activeTab === "leads" || activeTab === "overview")
  });

  // Fetch opportunities attributed to this campaign
  const {
    data: oppsData,
    isLoading: loadingOpps,
    refetch: refetchOpps
  } = useQuery({
    queryKey: ["campaign-opportunities", id],
    queryFn: async () => {
      if (!id) return { data: [] };
      return await campaignsApi.getCampaignOpportunities(id);
    },
    enabled: !!id && (activeTab === "opportunities" || activeTab === "overview")
  });

  // Loading State
  if (loadingCampaign || (pendingCampaign && !campaignDetailData)) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  // 404 / Error State
  const rawData: any = campaignDetailData;
  const rawCampaign: Campaign | null = rawData?.campaign || (rawData?.id ? (rawData as Campaign) : null);
  const campaign = rawCampaign;
  if (errorCampaign || !campaign || !campaign.id) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-5 my-12">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Campaign Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The campaign with identifier <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{id}</code> could not be found or has been removed.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate("/campaigns")}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl text-xs hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
          </button>
          <button
            onClick={() => refetchCampaign()}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const performance = rawData?.performance || (rawData?.metrics ? { metrics: rawData.metrics } : null);
  const rawMetrics = performance?.metrics;
  const metrics: CampaignMetrics = {
    totalLeads: Number(rawMetrics?.totalLeads ?? 0),
    qualifiedLeads: Number(rawMetrics?.qualifiedLeads ?? 0),
    totalOpportunities: Number(rawMetrics?.totalOpportunities ?? 0),
    wonDealsCount: Number(rawMetrics?.wonDealsCount ?? 0),
    wonOrdersCount: Number(rawMetrics?.wonOrdersCount ?? 0),
    totalRevenue: Number(rawMetrics?.totalRevenue ?? 0),
    conversionRateLeadToQual: Number(rawMetrics?.conversionRateLeadToQual ?? 0),
    conversionRateQualToOpp: Number(rawMetrics?.conversionRateQualToOpp ?? 0),
    conversionRateOppToWon: Number(rawMetrics?.conversionRateOppToWon ?? 0),
    costPerLead: rawMetrics?.costPerLead !== null && rawMetrics?.costPerLead !== undefined ? Number(rawMetrics.costPerLead) : null,
    costPerQualifiedLead: rawMetrics?.costPerQualifiedLead !== null && rawMetrics?.costPerQualifiedLead !== undefined ? Number(rawMetrics.costPerQualifiedLead) : null,
    costPerOpportunity: rawMetrics?.costPerOpportunity !== null && rawMetrics?.costPerOpportunity !== undefined ? Number(rawMetrics.costPerOpportunity) : null,
    costPerWonDeal: rawMetrics?.costPerWonDeal !== null && rawMetrics?.costPerWonDeal !== undefined ? Number(rawMetrics.costPerWonDeal) : null,
    roas: rawMetrics?.roas !== null && rawMetrics?.roas !== undefined ? Number(rawMetrics.roas) : null,
    roiPct: rawMetrics?.roiPct !== null && rawMetrics?.roiPct !== undefined ? Number(rawMetrics.roiPct) : null,
    adMetrics: Array.isArray(rawMetrics?.adMetrics) ? rawMetrics.adMetrics : []
  };

  const leads = Array.isArray(leadsData?.data) ? leadsData.data : [];
  const opportunities = Array.isArray(oppsData?.data) ? oppsData.data : [];
  const ads: CampaignAd[] = Array.isArray(campaign.ads) ? campaign.ads : [];

  const [adSortField, setAdSortField] = useState<"leads" | null>("leads");
  const [adSortDirection, setAdSortDirection] = useState<"asc" | "desc">("desc");

  const adMetricsMap = useMemo(() => {
    const map = new Map<string, any>();
    (metrics.adMetrics || []).forEach((m: any) => {
      if (m && m.adId) map.set(m.adId, m);
    });
    return map;
  }, [metrics.adMetrics]);

  const sortedAds = useMemo(() => {
    const list = [...ads];
    if (adSortField === "leads") {
      list.sort((a, b) => {
        if (!a || !b) return 0;
        const ma = a.id ? adMetricsMap.get(a.id) : null;
        const mb = b.id ? adMetricsMap.get(b.id) : null;
        const aLeads = ma ? (ma.totalLeads ?? 0) : leads.filter((l: any) => l && l.adId === a.id).length;
        const bLeads = mb ? (mb.totalLeads ?? 0) : leads.filter((l: any) => l && l.adId === b.id).length;
        return adSortDirection === "asc" ? aLeads - bLeads : bLeads - aLeads;
      });
    }
    return list;
  }, [ads, adSortField, adSortDirection, adMetricsMap, leads]);

  const currency = campaign.currency || "INR";
  const budget = Number(campaign.budget || 0);
  const actualSpend = campaign.actualSpend !== null && campaign.actualSpend !== undefined ? Number(campaign.actualSpend) : null;
  const budgetUtilizedPct = budget > 0 && actualSpend !== null && !isNaN(actualSpend) ? Math.min(100, Math.round((actualSpend / budget) * 100)) : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. TOP BREADCRUMB & HEADER ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              onClick={() => navigate("/campaigns")}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Campaigns
            </button>
            <span>/</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{campaign.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchCampaign();
                refetchLeads();
                refetchOpps();
              }}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh Campaign Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
                <Megaphone className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {campaign.name}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase border ${getStatusBadgeClass(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    code: {campaign.code}
                  </span>
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                    <Share2 className="w-3.5 h-3.5 text-blue-500" /> {campaign.channel}
                  </span>
                  {campaign.platform && (
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Globe className="w-3.5 h-3.5 text-slate-400" /> {campaign.platform}
                    </span>
                  )}
                  {campaign.startDate && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(campaign.startDate).toLocaleDateString()}
                      {campaign.endDate ? ` – ${new Date(campaign.endDate).toLocaleDateString()}` : " (Ongoing)"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Hero Financial Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Budget</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block">
                  {formatMoney(budget, currency)}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actual Spend</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block">
                  {formatMoney(actualSpend, currency)}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Won Revenue</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block">
                  {formatMoney(metrics.totalRevenue, currency)}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Return (ROAS)</span>
                <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 block">
                  {metrics.roas !== null && metrics.roas !== undefined ? `${metrics.roas}x` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TAB NAVIGATION BAR ── */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "performance"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Performance & Funnel</span>
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "leads"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Attributed Leads</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {metrics.totalLeads || leads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("opportunities")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "opportunities"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Opportunities</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {metrics.totalOpportunities || opportunities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ads")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "ads"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Ads & Creatives</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {ads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("messages")}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "messages"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Messages & Broadcasts</span>
        </button>
      </div>

      {/* ── 3. TAB 1: OVERVIEW ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads Inbound</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{metrics.totalLeads}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {metrics.qualifiedLeads} qualified ({metrics.conversionRateLeadToQual}%)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Opportunities Created</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{metrics.totalOpportunities}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {metrics.wonDealsCount} won deals ({metrics.conversionRateOppToWon}%)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Closed Won Revenue</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(metrics.totalRevenue, currency)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {metrics.wonOrdersCount} confirmed purchase orders
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Marketing Return (ROAS)</span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {metrics.roas !== null && metrics.roas !== undefined ? `${metrics.roas}x` : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {metrics.roiPct !== null && metrics.roiPct !== undefined ? `${metrics.roiPct > 0 ? "+" : ""}${metrics.roiPct}% ROI` : "Spend basis required"}
              </div>
            </div>
          </div>

          {/* 2-Column Detail Bento */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Core Specifications & Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Campaign Profile Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Campaign Specification
                  </h3>
                  <span className="text-xs font-bold text-slate-400">ID: {campaign.id ? `${campaign.id.slice(0, 8)}...` : "—"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign Name</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{campaign.name}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Code</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {campaign.code}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acquisition Channel</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{campaign.channel}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platform / Media</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{campaign.platform || "Direct"}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Audience</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {campaign.targetAudience || "General Commercial Audience"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Objective</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {campaign.objective || "Lead Generation & Direct Acquisition"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign Owner</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(campaign as any).owner?.name || "Unassigned"}
                    </span>
                    {(campaign as any).owner?.email && (
                      <span className="block text-[11px] text-slate-400">{(campaign as any).owner?.email}</span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description & Scope Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Strategic Scope & Description
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {campaign.description || "No strategic scope notes provided for this marketing campaign."}
                </p>
              </div>
            </div>

            {/* Right 5 Columns: Budget & Schedule Bento */}
            <div className="lg:col-span-5 space-y-6">
              {/* Financial & Budget Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Commercial Budget & Spend
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allocated Budget:</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {formatMoney(budget, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Actual Spend:</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {formatMoney(actualSpend, currency)}
                    </span>
                  </div>

                  {budgetUtilizedPct !== null && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Budget Utilized:</span>
                        <span className="font-extrabold text-blue-600">{budgetUtilizedPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            budgetUtilizedPct > 90 ? "bg-rose-500" : budgetUtilizedPct > 75 ? "bg-amber-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${Math.min(100, budgetUtilizedPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule & Duration Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <Calendar className="w-4 h-4 text-blue-600" /> Campaign Schedule
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Start Date:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "Not specified"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">End Date:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "Ongoing / Open"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Operating Currency:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{currency}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TAB 2: PERFORMANCE & FUNNEL ── */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* Empty State: If campaign has no leads or data yet */}
          {metrics.totalLeads === 0 && leads.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <BarChart2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No data yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  There are no leads or interactions attributed to this campaign yet. Performance charts and funnel conversion rates will populate automatically as leads are captured.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Full-Funnel Visual Pipeline */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" /> Attribution Marketing-to-Revenue Funnel
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      End-to-end conversion efficiency from initial lead acquisition to closed won revenue.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Full-Funnel Attribution
                  </span>
                </div>

                {/* Visual 5-Stage Funnel Flow */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
                  {/* Stage 1: Inbound Leads */}
                  <div className="bg-gradient-to-b from-blue-50/80 to-white dark:from-slate-800/90 dark:to-slate-900 border border-blue-200/90 dark:border-blue-900/60 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        1. Inbound Leads
                      </span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {metrics.totalLeads}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Attributed touches</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-blue-100 dark:border-slate-800 text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                      <span>Qual. Rate</span>
                      <span>{metrics.conversionRateLeadToQual}%</span>
                    </div>
                  </div>

                  {/* Stage 2: Qualified Leads */}
                  <div className="bg-gradient-to-b from-indigo-50/80 to-white dark:from-slate-800/90 dark:to-slate-900 border border-indigo-200/90 dark:border-indigo-900/60 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        2. Qualified Leads
                      </span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {metrics.qualifiedLeads}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Sales accepted</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-indigo-100 dark:border-slate-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                      <span>Opp. Conv.</span>
                      <span>{metrics.conversionRateQualToOpp}%</span>
                    </div>
                  </div>

                  {/* Stage 3: Opportunities */}
                  <div className="bg-gradient-to-b from-purple-50/80 to-white dark:from-slate-800/90 dark:to-slate-900 border border-purple-200/90 dark:border-purple-900/60 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        3. Opportunities
                      </span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {metrics.totalOpportunities}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Active deals</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-purple-100 dark:border-slate-800 text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                      <span>Win Rate</span>
                      <span>{metrics.conversionRateOppToWon}%</span>
                    </div>
                  </div>

                  {/* Stage 4: Won Orders */}
                  <div className="bg-gradient-to-b from-teal-50/80 to-white dark:from-slate-800/90 dark:to-slate-900 border border-teal-200/90 dark:border-teal-900/60 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                        4. Won Orders
                      </span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {metrics.wonOrdersCount}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">({metrics.wonDealsCount} won deals)</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-teal-100 dark:border-slate-800 text-[11px] font-bold text-teal-600 dark:text-teal-400 flex items-center justify-between">
                      <span>Closed</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Stage 5: Won Revenue */}
                  <div className="bg-gradient-to-b from-emerald-50/80 to-white dark:from-slate-800/90 dark:to-slate-900 border border-emerald-300/90 dark:border-emerald-800/60 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        5. Total Revenue
                      </span>
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                        {formatMoney(metrics.totalRevenue, currency)}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Attributed revenue</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-emerald-100 dark:border-slate-800 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                      <span>ROAS</span>
                      <span>{metrics.roas !== null && metrics.roas !== undefined ? `${metrics.roas}x` : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unit Economics & Cost Efficiency KPI Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Unit Economics & Cost Efficiency
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Cost Per Lead */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost / Lead (CPL)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {formatMoney(metrics.costPerLead, currency)}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Per inbound lead</span>
                  </div>

                  {/* Cost Per Qualified Lead */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost / Qual. Lead (CPQL)</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {formatMoney(metrics.costPerQualifiedLead, currency)}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Per qualified lead</span>
                  </div>

                  {/* Cost Per Opportunity */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost / Opportunity</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {formatMoney(metrics.costPerOpportunity, currency)}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Per created deal</span>
                  </div>

                  {/* Cost Per Won Deal */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost / Won Deal</span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {formatMoney(metrics.costPerWonDeal, currency)}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Per closed customer</span>
                  </div>

                  {/* ROAS */}
                  <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 shadow-xs space-y-1 bg-blue-50/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">ROAS Return</span>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {metrics.roas !== null && metrics.roas !== undefined ? `${metrics.roas}x` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Revenue / Spend</span>
                  </div>

                  {/* ROI % */}
                  <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 shadow-xs space-y-1 bg-emerald-50/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">ROI %</span>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {metrics.roiPct !== null && metrics.roiPct !== undefined ? `${metrics.roiPct > 0 ? "+" : ""}${metrics.roiPct}%` : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">Net Profit Return</span>
                  </div>
                </div>
              </div>

              {/* ── CHARTS SECTION (Feature 2) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Chart (a): Leads & Opportunities Velocity Over Time */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Velocity Over Time
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Leads, opportunities, and won orders created per period.
                      </p>
                    </div>

                    {/* Day / Week Granularity Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setTimeseriesGranularity("day")}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                          timeseriesGranularity === "day"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeseriesGranularity("week")}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                          timeseriesGranularity === "week"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        Weekly
                      </button>
                    </div>
                  </div>

                  {loadingTimeseries ? (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                      Loading velocity timeline...
                    </div>
                  ) : (
                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeseriesData?.data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "#334155",
                              borderRadius: "0.75rem",
                              color: "#fff",
                              fontSize: "11px",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                          <Line
                            type="monotone"
                            dataKey="leads"
                            name="Leads"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 2.5 }}
                            activeDot={{ r: 4.5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="opportunities"
                            name="Opportunities"
                            stroke="#7c3aed"
                            strokeWidth={2.5}
                            dot={{ r: 2.5 }}
                            activeDot={{ r: 4.5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="wonOrders"
                            name="Won Orders"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={{ r: 2.5 }}
                            activeDot={{ r: 4.5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Chart (b): Stage Conversion Funnel Bar Chart */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Stage Conversion Funnel
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Lifecycle volume & conversion percentages between stages.
                    </p>
                  </div>

                  <div className="h-48 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={[
                          { stage: "Leads", count: metrics.totalLeads, label: "1. Inbound Leads", conv: "100%", fill: "#2563eb" },
                          { stage: "Qualified", count: metrics.qualifiedLeads, label: "2. Qualified", conv: `${metrics.conversionRateLeadToQual}% of Leads`, fill: "#4f46e5" },
                          { stage: "Opps", count: metrics.totalOpportunities, label: "3. Opportunities", conv: `${metrics.conversionRateQualToOpp}% of Qualified`, fill: "#7c3aed" },
                          { stage: "Won", count: metrics.wonOrdersCount, label: "4. Won Orders", conv: `${metrics.conversionRateOppToWon}% of Opps`, fill: "#059669" }
                        ]}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} allowDecimals={false} tickLine={false} />
                        <YAxis type="category" dataKey="stage" stroke="#94a3b8" fontSize={10} tickLine={false} width={65} />
                        <Tooltip
                          formatter={(val: any, _name: any, item: any) => [`${val} (${item.payload.conv})`, item.payload.label]}
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "0.75rem",
                            color: "#fff",
                            fontSize: "11px"
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {[
                            { fill: "#2563eb" },
                            { fill: "#4f46e5" },
                            { fill: "#7c3aed" },
                            { fill: "#059669" }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stage-to-Stage Transition Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 block">Lead → Qualified</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">{metrics.conversionRateLeadToQual}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 block">Qual → Opportunity</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{metrics.conversionRateQualToOpp}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 block">Opportunity → Won</span>
                      <span className="font-extrabold text-purple-600 dark:text-purple-400">{metrics.conversionRateOppToWon}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">Overall Conversion</span>
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                        {metrics.totalLeads > 0 ? Number((((metrics.wonDealsCount ?? 0) / metrics.totalLeads) * 100).toFixed(1)) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 5. TAB 3: ATTRIBUTED LEADS ── */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Attributed Leads ({leads.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customers who originated or interacted through this marketing campaign.
                </p>
              </div>

              {/* Export Leads CSV Button */}
              <button
                type="button"
                onClick={handleExportLeadsCsv}
                disabled={isExportingLeads || leads.length === 0}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 shadow-2xs self-start sm:self-auto"
                title="Export attributed leads to CSV"
              >
                {isExportingLeads ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>{isExportingLeads ? "Exporting..." : "Export CSV"}</span>
              </button>
            </div>

            {/* Leads Export Error Banner */}
            {exportLeadsError && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{exportLeadsError}</span>
                </div>
                <button
                  onClick={() => setExportLeadsError(null)}
                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="py-3 px-4">Lead / Customer</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Rep</th>
                    <th className="py-3 px-4">Attributed Ad</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        Loading attributed leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No leads attributed yet</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Incoming leads tagged with campaign code <code>{campaign.code}</code> will appear here automatically.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    leads.map((l: any) => {
                      if (!l) return null;
                      const fullName = `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.name || `Lead #${l.leadNumber || (l.id ? l.id.slice(0, 8) : "—")}`;
                      return (
                        <tr key={l.id || Math.random()} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              to={`/leads/${l.id}`}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5"
                            >
                              <span>{fullName}</span>
                            </Link>
                            {l.leadNumber && (
                              <span className="text-[10px] text-slate-400 font-mono block">{l.leadNumber}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {l.company || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {l.email && <div className="text-[11px] truncate max-w-[160px]">{l.email}</div>}
                            {l.phone && <div className="text-[10px] text-slate-400">{l.phone}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {l.status || "NEW"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {l.assignedTo?.name || "Unassigned"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {l.ad?.name || "Direct / Campaign"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              to={`/leads/${l.id}`}
                              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              View <ArrowRight className="w-3 h-3" />
                            </Link>
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
      )}

      {/* ── 6. TAB 4: OPPORTUNITIES ── */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Attributed Opportunities & Deals ({opportunities.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Commercial opportunities generated from leads acquired by this campaign.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="py-3 px-4">Opportunity Name</th>
                    <th className="py-3 px-4">Account / Client</th>
                    <th className="py-3 px-4">Deal Amount</th>
                    <th className="py-3 px-4">Stage / Status</th>
                    <th className="py-3 px-4">Creative / Ad</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loadingOpps ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Loading attributed opportunities...
                      </td>
                    </tr>
                  ) : opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        <Briefcase className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No opportunities attributed yet</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          When attributed leads are qualified and converted to commercial deals, they will appear here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    opportunities.map((d: any) => {
                      if (!d) return null;
                      return (
                        <tr key={d.id || Math.random()} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              to={`/opportunities/${d.id}`}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {d.name || "Unnamed Opportunity"}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {d.account?.name || "Direct Account"}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {formatMoney(d.amount, currency)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {d.stage?.name || d.status || "OPEN"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {d.ad?.name || "Campaign-wide"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              to={`/opportunities/${d.id}`}
                              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              View <ArrowRight className="w-3 h-3" />
                            </Link>
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
      )}

      {/* ── 7. TAB 5: ADS & CREATIVES ── */}
      {activeTab === "ads" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Tracked Creatives & Ads ({ads.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sub-campaign ad units and creative variations attributed under this campaign.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedAd(null);
                  setIsAdModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Ad</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="py-3 px-4">Ad / Creative Name</th>
                    <th className="py-3 px-4">External Ad ID</th>
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Creative Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors select-none"
                      onClick={() => {
                        if (adSortField === "leads") {
                          setAdSortDirection(adSortDirection === "desc" ? "asc" : "desc");
                        } else {
                          setAdSortField("leads");
                          setAdSortDirection("desc");
                        }
                      }}
                      title="Sort by Leads"
                    >
                      <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                        <span>Leads</span>
                        <ArrowUpDown className={`w-3 h-3 ${adSortField === "leads" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                      </div>
                    </th>
                    <th className="py-3 px-4">Qualified</th>
                    <th className="py-3 px-4">Opps</th>
                    <th className="py-3 px-4">Won</th>
                    <th className="py-3 px-4">Revenue</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {sortedAds.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-10 text-slate-400">
                        <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No creative ads registered</div>
                        <div className="text-xs text-slate-400 mt-0.5 mb-3">
                          Attribution is currently operating at the campaign level (code: {campaign.code}).
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAd(null);
                            setIsAdModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Register First Ad</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    sortedAds.map((ad) => {
                      const m = adMetricsMap.get(ad.id);
                      const adLeads = m ? m.totalLeads : leads.filter((l: any) => l.adId === ad.id).length;
                      const adQual = m ? m.qualifiedLeads : leads.filter((l: any) => l.adId === ad.id && (l.status === "QUALIFIED" || l.status === "CONVERTED")).length;
                      const adOpps = m ? m.totalOpportunities : opportunities.filter((o: any) => o.adId === ad.id).length;
                      const adWon = m ? m.wonOrdersCount : 0;
                      const adRevenue = m ? m.totalRevenue : 0;

                      return (
                        <tr key={ad.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {ad.name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {ad.externalId || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {ad.platform || campaign.platform || "Direct"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {ad.creativeType || "Standard Ad"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                ad.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : ad.status === "PAUSED"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {ad.status || "ACTIVE"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {adLeads > 0 ? adLeads : "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {adQual > 0 ? adQual : "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {adOpps > 0 ? adOpps : "—"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {adWon > 0 ? adWon : "—"}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            {adRevenue > 0 ? formatMoney(adRevenue, currency) : "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit Action */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAd(ad);
                                  setIsAdModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Edit Creative Ad"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Action */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAdError(null);
                                  setAdToDelete(ad);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Creative Ad"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Final Muted Unattributed Row */}
                  <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 italic">
                    <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                      Not attributed to an ad
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3 px-4 text-slate-400">Direct / General</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        General
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 not-italic">
                      {(() => {
                        const adMetricsList = Array.isArray(metrics.adMetrics) ? metrics.adMetrics : [];
                        const unattr = adMetricsList.find((m: any) => m && (m.isUnattributed || m.adId === null));
                        const leadsCount = unattr ? (unattr.totalLeads ?? 0) : leads.filter((l: any) => l && !l.adId).length;
                        return leadsCount > 0 ? leadsCount : "—";
                      })()}
                    </td>
                    <td className="py-3 px-4 not-italic">
                      {(() => {
                        const adMetricsList = Array.isArray(metrics.adMetrics) ? metrics.adMetrics : [];
                        const unattr = adMetricsList.find((m: any) => m && (m.isUnattributed || m.adId === null));
                        const count = unattr ? (unattr.qualifiedLeads ?? 0) : leads.filter((l: any) => l && !l.adId && (l.status === "QUALIFIED" || l.status === "CONVERTED")).length;
                        return count > 0 ? count : "—";
                      })()}
                    </td>
                    <td className="py-3 px-4 not-italic">
                      {(() => {
                        const adMetricsList = Array.isArray(metrics.adMetrics) ? metrics.adMetrics : [];
                        const unattr = adMetricsList.find((m: any) => m && (m.isUnattributed || m.adId === null));
                        const count = unattr ? (unattr.totalOpportunities ?? 0) : opportunities.filter((o: any) => o && !o.adId).length;
                        return count > 0 ? count : "—";
                      })()}
                    </td>
                    <td className="py-3 px-4 not-italic">
                      {(() => {
                        const adMetricsList = Array.isArray(metrics.adMetrics) ? metrics.adMetrics : [];
                        const unattr = adMetricsList.find((m: any) => m && (m.isUnattributed || m.adId === null));
                        const count = unattr ? (unattr.wonOrdersCount ?? 0) : 0;
                        return count > 0 ? count : "—";
                      })()}
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-600 dark:text-emerald-400 not-italic">
                      {(() => {
                        const adMetricsList = Array.isArray(metrics.adMetrics) ? metrics.adMetrics : [];
                        const unattr = adMetricsList.find((m: any) => m && (m.isUnattributed || m.adId === null));
                        const rev = unattr ? (unattr.totalRevenue ?? 0) : 0;
                        return rev > 0 ? formatMoney(rev, currency) : "—";
                      })()}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">—</td>
                    <td className="py-3 px-4 text-right text-slate-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. TAB 6: MESSAGES & BROADCASTS ── */}
      {activeTab === "messages" && id && (
        <CampaignMessagesTab campaignId={id} campaignName={campaign.name} />
      )}

      {/* ── CREATE / EDIT CAMPAIGN AD MODAL ── */}
      {id && (
        <CampaignAdFormModal
          isOpen={isAdModalOpen}
          onClose={() => {
            setIsAdModalOpen(false);
            setSelectedAd(null);
          }}
          campaignId={id}
          campaignName={campaign.name}
          defaultPlatform={campaign.platform || campaign.channel}
          ad={selectedAd}
          onSuccess={() => {
            refetchCampaign();
          }}
        />
      )}

      {/* ── DELETE AD CONFIRMATION MODAL ── */}
      {adToDelete && id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900 shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Creative Ad "{adToDelete.name}"?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to remove this creative ad? Historical attribution records will remain preserved under the parent campaign.
                </p>
              </div>

              {deleteAdError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Deletion Error</span>
                    <span>{deleteAdError}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdToDelete(null);
                    setDeleteAdError(null);
                  }}
                  disabled={deleteAdMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => deleteAdMutation.mutate(adToDelete.id)}
                  disabled={deleteAdMutation.isPending}
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleteAdMutation.isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Ad</span>
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
