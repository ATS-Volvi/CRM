import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  Clock,
  ArrowRight,
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
  UserCheck
} from "lucide-react";
import { campaignsApi } from "../api/marketing";
import { Campaign, CampaignPerformance, CampaignMetrics, CampaignAd } from "../types/marketing";

/**
 * Currency and Money Formatter helper
 */
function formatMoney(amount: number | string | null | undefined, currency: string = "SAR"): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "—";
  const num = Number(amount);
  const curr = currency || "SAR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  } catch (e) {
    return `${curr} ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

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

  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "leads" | "opportunities" | "ads">("overview");

  // Fetch campaign and performance report
  const {
    data: campaignDetailData,
    isLoading: loadingCampaign,
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
  if (loadingCampaign) {
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
  const campaign = campaignDetailData?.campaign;
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
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl text-xs hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
          </button>
          <button
            onClick={() => refetchCampaign()}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const performance = campaignDetailData?.performance;
  const metrics: CampaignMetrics = performance?.metrics || {
    totalLeads: 0,
    qualifiedLeads: 0,
    totalOpportunities: 0,
    wonDealsCount: 0,
    wonOrdersCount: 0,
    totalRevenue: 0,
    conversionRateLeadToQual: 0,
    conversionRateQualToOpp: 0,
    conversionRateOppToWon: 0,
    costPerLead: null,
    costPerQualifiedLead: null,
    costPerOpportunity: null,
    costPerWonDeal: null,
    roas: null,
    roiPct: null
  };

  const leads = Array.isArray(leadsData?.data) ? leadsData.data : [];
  const opportunities = Array.isArray(oppsData?.data) ? oppsData.data : [];
  const ads: CampaignAd[] = Array.isArray(campaign.ads) ? campaign.ads : [];

  const currency = campaign.currency || "SAR";
  const budget = Number(campaign.budget || 0);
  const actualSpend = campaign.actualSpend !== null && campaign.actualSpend !== undefined ? Number(campaign.actualSpend) : null;
  const budgetUtilizedPct = budget > 0 && actualSpend !== null ? Math.min(100, Math.round((actualSpend / budget) * 100)) : null;

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
                  <span className="text-xs font-bold text-slate-400">ID: {campaign.id.slice(0, 8)}...</span>
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
                      {new Date(campaign.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
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
        </div>
      )}

      {/* ── 5. TAB 3: ATTRIBUTED LEADS ── */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Attributed Leads ({leads.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customers who originated or interacted through this marketing campaign.
                </p>
              </div>
            </div>

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
                      const fullName = `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.name || `Lead #${l.leadNumber || l.id.slice(0, 8)}`;
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
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
                            {new Date(l.createdAt).toLocaleDateString()}
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
                    opportunities.map((d: any) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            to={`/opportunities/${d.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {d.name}
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
                          {new Date(d.createdAt).toLocaleDateString()}
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
                    ))
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
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Tracked Creatives & Ads ({ads.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sub-campaign ad units and creative variations attributed under this campaign.
                </p>
              </div>
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
                    <th className="py-3 px-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {ads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No creative ads registered</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Attribution is currently operating at the campaign level (code: {campaign.code}).
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ads.map((ad) => (
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
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            {ad.status || "ACTIVE"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(ad.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
