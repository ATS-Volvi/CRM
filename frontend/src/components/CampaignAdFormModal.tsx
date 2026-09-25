import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Layers,
  Tag,
  Share2,
  Tv,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { campaignsApi } from "../api/marketing";
import { CampaignAd } from "../types/marketing";

interface CampaignAdFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName?: string;
  defaultPlatform?: string;
  ad?: CampaignAd | null;
  onSuccess?: (savedAd: CampaignAd) => void;
}

const PLATFORMS = [
  "Google Ads",
  "Meta / Facebook",
  "Instagram",
  "LinkedIn Ads",
  "Twitter / X",
  "TikTok",
  "YouTube",
  "WhatsApp Business",
  "Email",
  "Direct",
  "Other"
];

const CREATIVE_TYPES = [
  "Image",
  "Video",
  "Carousel",
  "Text / Search",
  "Banner",
  "Dynamic Product Ad",
  "Story / Reel",
  "Lead Form Ad",
  "Other"
];

const STATUSES: { value: "ACTIVE" | "PAUSED" | "ARCHIVED"; label: string; description: string }[] = [
  { value: "ACTIVE", label: "Active", description: "Currently running and capturing lead attributions" },
  { value: "PAUSED", label: "Paused", description: "Temporarily inactive in ad network" },
  { value: "ARCHIVED", label: "Archived", description: "Concluded or retired creative" }
];

export function CampaignAdFormModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  defaultPlatform,
  ad,
  onSuccess
}: CampaignAdFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(ad && ad.id);

  // Form states
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [platform, setPlatform] = useState("Google Ads");
  const [creativeType, setCreativeType] = useState("Image");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "ARCHIVED">("ACTIVE");

  // Validation & Error states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Populate form on open or when editing an ad
  useEffect(() => {
    if (isOpen) {
      if (ad) {
        setName(ad.name || "");
        setExternalId(ad.externalId || "");
        setPlatform(ad.platform || defaultPlatform || "Google Ads");
        setCreativeType(ad.creativeType || "Image");
        setStatus((ad.status as any) || "ACTIVE");
      } else {
        setName("");
        setExternalId("");
        setPlatform(defaultPlatform || "Google Ads");
        setCreativeType("Image");
        setStatus("ACTIVE");
      }
      setFormErrors({});
      setServerError(null);
    }
  }, [isOpen, ad, defaultPlatform]);

  // Form validation
  const validate = () => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Ad name is required.";
    }

    if (externalId.trim() && externalId.trim().length > 100) {
      errors.externalId = "External ID is too long (max 100 characters).";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Mutation for creating or updating ad
  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<CampaignAd> = {
        name: name.trim(),
        externalId: externalId.trim() || undefined,
        platform: platform || undefined,
        creativeType: creativeType || undefined,
        status
      };

      if (isEdit && ad?.id) {
        return await campaignsApi.updateCampaignAd(campaignId, ad.id, payload);
      } else {
        return await campaignsApi.createCampaignAd(campaignId, payload);
      }
    },
    onSuccess: (savedAd) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      if (onSuccess) {
        onSuccess(savedAd);
      }
      onClose();
    },
    onError: (err: any) => {
      setServerError(err.message || "An unexpected error occurred while saving the ad.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Creative Ad" : "Register Creative Ad"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {campaignName ? `Under campaign: ${campaignName}` : "Sub-campaign ad unit for multi-touch attribution"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Submission Error</span>
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Ad Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Ad / Creative Name</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Summer Commercial HVAC Video A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:bg-white dark:focus:bg-slate-900 transition-all ${
                formErrors.name
                  ? "border-rose-300 focus:ring-rose-500 bg-rose-50/30"
                  : "border-slate-200 dark:border-slate-700 focus:ring-blue-600"
              }`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                {formErrors.name}
              </p>
            )}
          </div>

          {/* External Ad ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>External Ad ID</span>
                <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Meta/Google/LinkedIn ID</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 23849182938120 or gads_lead_gen_01"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
            {formErrors.externalId && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                {formErrors.externalId}
              </p>
            )}
            <p className="text-[10px] text-slate-400">
              Used to match utm_content or ad ID parameters during lead ingestion.
            </p>
          </div>

          {/* Platform & Creative Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Advertising Platform</span>
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-all"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Creative Type</span>
              </label>
              <select
                value={creativeType}
                onChange={(e) => setCreativeType(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition-all"
              >
                {CREATIVE_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Ad Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    status === s.value
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-600"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{s.label}</span>
                    {status === s.value && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEdit ? "Update Creative Ad" : "Save Creative Ad"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
