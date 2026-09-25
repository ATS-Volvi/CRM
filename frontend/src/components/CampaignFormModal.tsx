import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Megaphone,
  DollarSign,
  Calendar,
  Layers,
  Users,
  Target,
  FileText,
  AlertCircle,
  CheckCircle2,
  Share2,
  Globe,
  Tag
} from "lucide-react";
import { campaignsApi } from "../api/marketing";
import { Campaign, CampaignStatus } from "../types/marketing";
import { apiClient } from "../lib/apiClient";

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign | null;
  onSuccess?: (savedCampaign: Campaign) => void;
}

const CHANNELS = [
  "Website",
  "WhatsApp",
  "Email",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Phone",
  "Manual",
  "Referral",
  "Partner",
  "API",
  "Other"
];

const PLATFORMS = [
  "Direct",
  "Google Ads",
  "Meta / Facebook",
  "Instagram",
  "LinkedIn Ads",
  "Twitter / X",
  "WhatsApp Business",
  "Email Newsletter",
  "Organic Search",
  "Event / Expo",
  "Other"
];

const STATUSES: { value: CampaignStatus; label: string; description: string }[] = [
  { value: "DRAFT", label: "Draft", description: "Planning stage, not yet receiving traffic" },
  { value: "ACTIVE", label: "Active", description: "Currently live and receiving inbound leads" },
  { value: "PAUSED", label: "Paused", description: "Temporarily stopped media spend" },
  { value: "COMPLETED", label: "Completed", description: "Concluded campaign run" },
  { value: "CANCELLED", label: "Cancelled", description: "Terminated or abandoned campaign" },
];

const CURRENCIES = ["SAR", "INR", "USD", "EUR", "AED"];

export function CampaignFormModal({
  isOpen,
  onClose,
  campaign,
  onSuccess
}: CampaignFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(campaign && campaign.id);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState("Website");
  const [platform, setPlatform] = useState("Direct");
  const [status, setStatus] = useState<CampaignStatus>("DRAFT");
  const [budget, setBudget] = useState<string>("");
  const [actualSpend, setActualSpend] = useState<string>("");
  const [currency, setCurrency] = useState("SAR");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [ownerId, setOwnerId] = useState("");

  // Validation & Error states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch salespersons/users for owner selection
  const { data: salespersons = [] } = useQuery({
    queryKey: ["salespersons-for-campaign-owner"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>("/api/v1/salespersons");
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: isOpen
  });

  // Populate or reset form on open / campaign change
  useEffect(() => {
    if (isOpen) {
      setFormErrors({});
      setServerError(null);

      if (campaign) {
        setName(campaign.name || "");
        setCode(campaign.code || "");
        setDescription(campaign.description || "");
        setChannel(campaign.channel || "Website");
        setPlatform(campaign.platform || "Direct");
        setStatus(campaign.status || "DRAFT");
        setBudget(campaign.budget !== undefined && campaign.budget !== null ? String(campaign.budget) : "");
        setActualSpend(campaign.actualSpend !== undefined && campaign.actualSpend !== null ? String(campaign.actualSpend) : "");
        setCurrency(campaign.currency || "SAR");
        setStartDate(campaign.startDate ? campaign.startDate.split("T")[0] : "");
        setEndDate(campaign.endDate ? campaign.endDate.split("T")[0] : "");
        setTargetAudience(campaign.targetAudience || "");
        setObjective(campaign.objective || "");
        setOwnerId(campaign.ownerId || (campaign as any).owner?.id || "");
      } else {
        setName("");
        setCode("");
        setDescription("");
        setChannel("Website");
        setPlatform("Direct");
        setStatus("DRAFT");
        setBudget("");
        setActualSpend("");
        setCurrency("SAR");
        setStartDate("");
        setEndDate("");
        setTargetAudience("");
        setObjective("");
        setOwnerId("");
      }
    }
  }, [isOpen, campaign]);

  // Client-side validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Campaign name is required.";
    }

    if (!code.trim()) {
      errors.code = "Campaign unique code is required.";
    } else if (!/^[A-Za-z0-9_-]+$/.test(code.trim())) {
      errors.code = "Campaign code must contain only letters, numbers, hyphens, and underscores.";
    }

    if (budget && isNaN(Number(budget))) {
      errors.budget = "Budget must be a valid number.";
    } else if (budget && Number(budget) < 0) {
      errors.budget = "Budget cannot be negative.";
    }

    if (actualSpend && isNaN(Number(actualSpend))) {
      errors.actualSpend = "Actual spend must be a valid number.";
    } else if (actualSpend && Number(actualSpend) < 0) {
      errors.actualSpend = "Actual spend cannot be negative.";
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = "End date cannot be earlier than start date.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Mutation for Create / Update
  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Campaign>) => {
      if (isEdit && campaign?.id) {
        return await campaignsApi.updateCampaign(campaign.id, payload);
      } else {
        return await campaignsApi.createCampaign(payload);
      }
    },
    onSuccess: (savedData) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-detail"] });
      if (onSuccess) onSuccess(savedData);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.message || "An error occurred while saving the campaign.";
      setServerError(msg);

      // Highlight code field error if uniqueness violation
      if (msg.toLowerCase().includes("code") && msg.toLowerCase().includes("already exists")) {
        setFormErrors((prev) => ({
          ...prev,
          code: msg
        }));
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    const payload: Partial<Campaign> = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      channel,
      platform: platform.trim() || undefined,
      status,
      budget: budget ? Number(budget) : 0,
      actualSpend: actualSpend !== "" ? Number(actualSpend) : null,
      currency,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      targetAudience: targetAudience.trim() || undefined,
      objective: objective.trim() || undefined,
      ownerId: ownerId || undefined
    };

    saveMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Marketing Campaign" : "Create New Marketing Campaign"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit
                  ? `Update campaign configuration and attribution parameters for ${campaign?.code}`
                  : "Set up a new acquisition campaign, attribution code, and budget"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Submission Error</span>
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="e.g. Q4 Google Search Industrial Surge"
                className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  formErrors.name ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {formErrors.name && (
                <span className="text-[11px] text-rose-500 font-semibold mt-1 block">{formErrors.name}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Campaign Code (Unique) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: "" }));
                }}
                placeholder="e.g. GOOGLE-SEARCH-Q4"
                className={`w-full px-3 py-2 text-xs font-mono rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  formErrors.code ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {formErrors.code ? (
                <span className="text-[11px] text-rose-500 font-semibold mt-1 block">{formErrors.code}</span>
              ) : (
                <span className="text-[10px] text-slate-400 mt-1 block">Used in UTM parameters and lead matching</span>
              )}
            </div>
          </div>

          {/* Row 2: Channel, Platform & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Platform / Ad Network
              </label>
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. Google Ads, Meta Ads"
                list="platform-suggestions"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="platform-suggestions">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lifecycle Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Financials (Budget, Actual Spend, Currency) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Allocated Budget
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value);
                    if (formErrors.budget) setFormErrors((prev) => ({ ...prev, budget: "" }));
                  }}
                  placeholder="0.00"
                  className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.budget ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700"
                  }`}
                />
              </div>
              {formErrors.budget && (
                <span className="text-[11px] text-rose-500 font-semibold mt-1 block">{formErrors.budget}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Actual Spend (Media Cost)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={actualSpend}
                onChange={(e) => {
                  setActualSpend(e.target.value);
                  if (formErrors.actualSpend) setFormErrors((prev) => ({ ...prev, actualSpend: "" }));
                }}
                placeholder="Leave blank if unspent"
                className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.actualSpend ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {formErrors.actualSpend && (
                <span className="text-[11px] text-rose-500 font-semibold mt-1 block">{formErrors.actualSpend}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Operating Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Dates & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (formErrors.endDate) setFormErrors((prev) => ({ ...prev, endDate: "" }));
                }}
                className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                  formErrors.endDate ? "border-rose-300 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {formErrors.endDate && (
                <span className="text-[11px] text-rose-500 font-semibold mt-1 block">{formErrors.endDate}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Campaign Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Current User / Unassigned</option>
                {salespersons.map((sp: any) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} {sp.role ? `(${sp.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Target Audience & Objective */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Audience / Segment
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. GCC Tier-1 Contractors, Facility Managers"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Strategic Objective
              </label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Generate 50 Qualified Industrial Leads"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 6: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description & Scope Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide strategic context, messaging notes, or creative guidelines for this campaign..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEdit ? "Save Changes" : "Create Campaign"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
