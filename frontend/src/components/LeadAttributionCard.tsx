import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Compass,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Radio,
  Tag,
  Share2,
  Calendar,
  Layers,
  Globe,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Target
} from "lucide-react";
import { attributionApi, campaignsApi } from "../api/marketing";

interface LeadAttributionCardProps {
  leadId: string;
}

export const LeadAttributionCard: React.FC<LeadAttributionCardProps> = ({ leadId }) => {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showManualTouchModal, setShowManualTouchModal] = useState(false);

  // Manual touch form state
  const [channel, setChannel] = useState("Meta Ads");
  const [sourceType, setSourceType] = useState("Paid Social");
  const [sourceName, setSourceName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Lead Attribution snapshot & touches
  const { data: attribution, isLoading: isLoadingAttr } = useQuery({
    queryKey: ["lead-attribution", leadId],
    queryFn: () => attributionApi.getLeadAttribution(leadId),
    enabled: !!leadId
  });

  // 2. Fetch Multi-Touch History
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["lead-attribution-history", leadId],
    queryFn: () => attributionApi.getLeadAttributionHistory(leadId),
    enabled: !!leadId
  });

  // 3. Fetch active campaigns for manual touch dropdown
  const { data: campaignsList } = useQuery({
    queryKey: ["campaigns-dropdown"],
    queryFn: () => campaignsApi.getCampaigns({ limit: 50 }),
    enabled: showManualTouchModal
  });

  // 4. Record Manual Touch Mutation
  const recordTouchMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      return attributionApi.recordManualTouch(leadId, {
        channel,
        sourceType,
        sourceName: sourceName.trim() || undefined,
        campaignId: selectedCampaignId || undefined,
        utmSource: utmSource.trim() || undefined,
        utmMedium: utmMedium.trim() || undefined,
        utmCampaign: utmCampaign.trim() || undefined,
        touchType: "INTERMEDIATE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-attribution", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-attribution-history", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      setShowManualTouchModal(false);
      setSourceName("");
      setNotes("");
      setUtmCampaign("");
    },
    onError: (err: any) => {
      setFormError(err?.message || "Failed to record manual touch.");
    }
  });

  const getChannelBadgeClass = (ch?: string) => {
    const c = (ch || "").toLowerCase();
    if (c.includes("meta") || c.includes("facebook") || c.includes("instagram")) {
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    }
    if (c.includes("google") || c.includes("search") || c.includes("sem")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
    }
    if (c.includes("linkedin")) {
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800";
    }
    if (c.includes("email") || c.includes("outbound")) {
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
    }
    if (c.includes("event") || c.includes("trade show") || c.includes("conference")) {
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
    }
    return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  };

  const channelLabel = attribution?.channel || "Direct / Website";
  const campaign = attribution?.campaign;
  const ad = attribution?.ad;
  const events = historyData?.events || [];
  const touches = attribution?.touches || [];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Campaign &amp; Attribution
            </h3>
            <span className="text-[10px] text-slate-400">Marketing acquisition &amp; touch points</span>
          </div>
        </div>

        <button
          onClick={() => setShowManualTouchModal(true)}
          className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          title="Record offline or manual touchpoint"
        >
          <Plus className="w-3 h-3" />
          <span>Log Touch</span>
        </button>
      </div>

      {isLoadingAttr ? (
        <div className="py-6 text-center text-xs text-slate-400">
          Loading attribution data...
        </div>
      ) : (
        <div className="space-y-3.5 text-xs">
          {/* Channel & Source Snapshot */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Acquisition Channel
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${getChannelBadgeClass(channelLabel)}`}>
                <Radio className="w-3 h-3" />
                {channelLabel}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Source Type
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {attribution?.sourceType || "Organic / Direct"}
              </span>
              {attribution?.sourceName && (
                <div className="text-[10px] text-slate-400 truncate">
                  {attribution.sourceName}
                </div>
              )}
            </div>
          </div>

          {/* Associated Campaign */}
          <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3" /> Campaign Origin
              </span>
              {campaign?.id && (
                <Link
                  to={`/campaigns/${campaign.id}`}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  <span>View Campaign</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
            </div>

            {campaign ? (
              <div>
                <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                  {campaign.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900 font-bold">
                    {campaign.code}
                  </span>
                  {campaign.channel && <span>via {campaign.channel}</span>}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 italic text-[11px]">
                No campaign explicitly tagged (Direct Inbound)
              </div>
            )}
          </div>

          {/* Ad Creative (if applicable) */}
          {ad && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Ad Creative
              </span>
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {ad.name}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                {ad.creativeType && <span className="bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.2 rounded">{ad.creativeType}</span>}
                {ad.platform && <span>{ad.platform}</span>}
                {ad.externalId && <span className="font-mono text-[9px]">{ad.externalId}</span>}
              </div>
            </div>
          )}

          {/* Collapsible Touch History Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex justify-between items-center text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Touchpoints &amp; Attribution History ({events.length || touches.length})</span>
              </span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                {events.length === 0 && touches.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    No multi-touch events recorded yet.
                  </div>
                ) : (
                  (events.length > 0 ? events : touches).map((ev: any, idx: number) => (
                    <div
                      key={ev.id || idx}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] border ${getChannelBadgeClass(ev.channel)}`}>
                          {ev.channel || "Touch"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ev.timestamp || ev.createdAt ? new Date(ev.timestamp || ev.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                        </span>
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {ev.sourceName || ev.campaign?.name || ev.sourceType || "Marketing Engagement"}
                      </div>
                      {ev.utmCampaign && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          utm_campaign: {ev.utmCampaign}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Touchpoint Recording Modal */}
      {showManualTouchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-600" />
                Log Manual Marketing Touch
              </h3>
              <button
                onClick={() => setShowManualTouchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Channel *
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="enterprise-input w-full"
                >
                  <option value="Meta Ads">Meta Ads (Facebook / Instagram)</option>
                  <option value="Google Ads">Google Ads (Search / Display)</option>
                  <option value="LinkedIn">LinkedIn Sponsored Content</option>
                  <option value="Email">Outbound Email / Newsletter</option>
                  <option value="Phone">Direct Phone / Cold Call</option>
                  <option value="Event">Trade Show / Conference / Event</option>
                  <option value="Direct">Direct / Website Inbound</option>
                  <option value="Referral">Partner Referral</option>
                  <option value="Other">Other / Offline</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Source Type
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="enterprise-input w-full"
                >
                  <option value="Paid Social">Paid Social</option>
                  <option value="Paid Search">Paid Search</option>
                  <option value="Organic Search">Organic Search</option>
                  <option value="Direct Traffic">Direct Traffic</option>
                  <option value="Email Marketing">Email Marketing</option>
                  <option value="Event Attendance">Event Attendance</option>
                  <option value="Partner Network">Partner Network</option>
                  <option value="Sales Outbound">Sales Outbound</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link to Campaign (Optional)
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="enterprise-input w-full"
                >
                  <option value="">-- None / General Inbound --</option>
                  {campaignsList?.data?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Source Name / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dubai Big5 Expo"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    UTM Campaign
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. q3-expo-surge"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="enterprise-input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowManualTouchModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => recordTouchMutation.mutate()}
                disabled={recordTouchMutation.isPending}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {recordTouchMutation.isPending ? "Recording..." : "Record Touchpoint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
