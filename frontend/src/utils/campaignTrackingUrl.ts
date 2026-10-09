/**
 * Campaign Tracking URL Builder
 *
 * Implements:
 * 1. Single configurable base URL with sensible default (https://face-website-fawn.vercel.app/quote.html)
 * 2. Standardized UTM conventions per supported channel:
 *    - WhatsApp: utm_source=whatsapp&utm_medium=broadcast
 *    - Instagram: utm_source=instagram&utm_medium=paid_social
 *    - Email: utm_source=email&utm_medium=newsletter
 * 3. URL-encoded campaign code handling
 */

function getPublicQuoteUrl(): string {
  if (typeof process !== "undefined" && process?.env?.VITE_PUBLIC_QUOTE_URL) {
    return process.env.VITE_PUBLIC_QUOTE_URL;
  }
  try {
    const meta = (0, eval)("import.meta");
    if (meta?.env?.VITE_PUBLIC_QUOTE_URL) {
      return meta.env.VITE_PUBLIC_QUOTE_URL;
    }
  } catch {
    // In environments where import.meta is not evaluated (e.g. Node/Jest CommonJS)
  }
  return "https://face-website-fawn.vercel.app/quote.html";
}

export const DEFAULT_PUBLIC_QUOTE_URL = getPublicQuoteUrl();

export type SupportedTrackedChannel = "WhatsApp" | "Instagram" | "Email";

export interface TrackedLinkChannelConfig {
  channel: SupportedTrackedChannel;
  source: string;
  medium: string;
  label: string;
  description: string;
}

export const TRACKED_CHANNELS: TrackedLinkChannelConfig[] = [
  {
    channel: "WhatsApp",
    source: "whatsapp",
    medium: "broadcast",
    label: "WhatsApp",
    description: "WhatsApp Broadcast (utm_source=whatsapp, utm_medium=broadcast)"
  },
  {
    channel: "Instagram",
    source: "instagram",
    medium: "paid_social",
    label: "Instagram",
    description: "Instagram Paid Social (utm_source=instagram, utm_medium=paid_social)"
  },
  {
    channel: "Email",
    source: "email",
    medium: "newsletter",
    label: "Email",
    description: "Email Newsletter (utm_source=email, utm_medium=newsletter)"
  }
];

/**
 * Builds a tracked destination URL for a campaign and channel.
 * Properly URL-encodes the campaign code, source, and medium.
 */
export function buildTrackedCampaignUrl(
  campaignCode: string,
  source: string,
  medium: string,
  baseUrl: string = DEFAULT_PUBLIC_QUOTE_URL
): string {
  const cleanCode = (campaignCode || "").trim();
  const encodedCode = encodeURIComponent(cleanCode);
  const encodedSource = encodeURIComponent((source || "").trim());
  const encodedMedium = encodeURIComponent((medium || "").trim());

  // Split any hash fragment
  const [baseWithoutHash, hash] = baseUrl.split("#");
  const separator = baseWithoutHash.includes("?") ? "&" : "?";
  const queryString = `utm_campaign=${encodedCode}&utm_source=${encodedSource}&utm_medium=${encodedMedium}`;
  const fullUrl = `${baseWithoutHash}${separator}${queryString}`;

  return hash ? `${fullUrl}#${hash}` : fullUrl;
}

/**
 * Get ready-to-share tracked URLs for all supported channels for a campaign.
 */
export function getCampaignTrackedLinks(
  campaignCode?: string | null,
  baseUrl: string = DEFAULT_PUBLIC_QUOTE_URL
): Array<TrackedLinkChannelConfig & { url: string }> {
  if (!campaignCode || !campaignCode.trim()) {
    return [];
  }

  return TRACKED_CHANNELS.map((ch) => ({
    ...ch,
    url: buildTrackedCampaignUrl(campaignCode, ch.source, ch.medium, baseUrl)
  }));
}
