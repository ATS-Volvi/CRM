import React from "react";
import { Info, AlertTriangle, AlertCircle } from "lucide-react";
import { CampaignSendModeChannelConfig } from "../types/marketing";

export type SendModeState = "DRY_RUN" | "TEST_MODE" | "LIVE" | "UNKNOWN";

export interface SendModeDetails {
  mode: SendModeState;
  title: string;
  description: string;
  badgeClass: string;
  containerClass: string;
}

export function computeChannelSendMode(
  config?: Partial<CampaignSendModeChannelConfig> | null
): SendModeDetails {
  if (!config || typeof config.dryRun !== "boolean") {
    return {
      mode: "UNKNOWN",
      title: "MODE UNKNOWN",
      description: "Unable to verify delivery mode from server.",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      containerClass: "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
    };
  }

  if (config.dryRun) {
    return {
      mode: "DRY_RUN",
      title: "DRY RUN",
      description: "No real messages will be sent.",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      containerClass: "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200"
    };
  }

  if (config.allowlistActive) {
    const count = Number(config.allowlistCount ?? 0);
    const countText = count > 0 ? `${count}` : "configured";
    return {
      mode: "TEST_MODE",
      title: "TEST MODE",
      description: `Only ${countText} allowlisted recipient${count === 1 ? "" : "s"} will receive messages.`,
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
      containerClass: "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
    };
  }

  return {
    mode: "LIVE",
    title: "LIVE",
    description: "No allowlist is active. Messages go to ALL eligible recipients.",
    badgeClass: "bg-rose-600 text-white border-rose-700 font-black tracking-wide",
    containerClass: "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100 shadow-sm"
  };
}

interface CampaignSendModeBannerProps {
  channel?: "EMAIL" | "WHATSAPP" | "ALL" | string;
  config?: {
    whatsapp?: Partial<CampaignSendModeChannelConfig>;
    email?: Partial<CampaignSendModeChannelConfig>;
  } | null;
  className?: string;
  compact?: boolean;
}

export function CampaignSendModeBanner({
  channel,
  config,
  className = "",
  compact = false
}: CampaignSendModeBannerProps) {
  const normChannel = (channel || "").toUpperCase();

  // If "ALL", we show both channels or the prevailing mode
  if (normChannel === "ALL") {
    const waDetails = computeChannelSendMode(config?.whatsapp);
    const emDetails = computeChannelSendMode(config?.email);

    return (
      <div className={`space-y-2 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SingleChannelBanner
            channelLabel="WhatsApp"
            details={waDetails}
            compact={compact}
          />
          <SingleChannelBanner
            channelLabel="Email"
            details={emDetails}
            compact={compact}
          />
        </div>
      </div>
    );
  }

  const channelConfig =
    normChannel === "WHATSAPP" ? config?.whatsapp : config?.email;
  const channelLabel = normChannel === "WHATSAPP" ? "WhatsApp" : "Email";
  const details = computeChannelSendMode(channelConfig);

  return (
    <div className={className}>
      <SingleChannelBanner
        channelLabel={channelLabel}
        details={details}
        compact={compact}
      />
    </div>
  );
}

function SingleChannelBanner({
  channelLabel,
  details,
  compact = false
}: {
  channelLabel: string;
  details: SendModeDetails;
  compact?: boolean;
}) {
  const isLive = details.mode === "LIVE";
  const isTest = details.mode === "TEST_MODE";

  return (
    <div
      role="status"
      className={`rounded-xl border px-3.5 py-2.5 transition-all flex items-center justify-between gap-3 ${
        details.containerClass
      } ${isLive ? "ring-2 ring-rose-500/20" : ""}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="shrink-0">
          {isLive ? (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : isTest ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold">{channelLabel}:</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                details.badgeClass
              }`}
            >
              {details.title}
            </span>
          </div>

          {!compact && (
            <p className="text-[11px] mt-0.5 font-medium opacity-90 truncate">
              {details.description}
            </p>
          )}
        </div>
      </div>

      {compact && (
        <span className="text-[11px] font-medium opacity-85 shrink-0 hidden sm:inline">
          {details.description}
        </span>
      )}
    </div>
  );
}
