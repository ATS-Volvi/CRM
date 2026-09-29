import { sequelize } from "@nexus-crm/database";

export const ALLOWED_CURRENCIES = ["SAR", "INR", "USD", "AED", "EUR", "GBP"] as const;
export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

let cachedOrgCurrency: string | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

export const getOrgCurrency = async (): Promise<string> => {
  const now = Date.now();
  if (cachedOrgCurrency && cacheExpiry > now) {
    return cachedOrgCurrency;
  }

  try {
    const { OrgSettings } = sequelize.models;
    if (OrgSettings) {
      const setting = await OrgSettings.findOne();
      if (setting && (setting as any).defaultCurrency) {
        cachedOrgCurrency = (setting as any).defaultCurrency;
        cacheExpiry = now + CACHE_TTL_MS;
        return cachedOrgCurrency!;
      }
    }
  } catch (err) {
    console.error("[getOrgCurrency] Failed to fetch from DB, falling back to SAR:", err);
  }

  return "SAR";
};

export const invalidateOrgSettingsCache = (): void => {
  cachedOrgCurrency = null;
  cacheExpiry = 0;
};
