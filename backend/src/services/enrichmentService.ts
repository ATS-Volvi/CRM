import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const HUNTER_API_BASE = "https://api.hunter.io/v2";

// Free-tier personal email domains — skip enrichment for these.
// Single shared constant reused across leadIngestion.ts and enrichmentService.ts.
export const PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "hotmail.co.uk", "yahoo.co.uk", "icloud.com", "me.com",
  "aol.com", "live.com", "msn.com", "protonmail.com",
  "yandex.com", "mail.com", "gmx.com", "zoho.com",
  "googlemail.com", "rediffmail.com"
]);

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  /** Source provider */
  source: "hunter";
  /** ISO timestamp when this was fetched */
  fetchedAt: string;
  /** Company name */
  name: string | null;
  /** Primary industry (from category.industry) */
  industry: string | null;
  /** Sector (from category.sector) */
  sector: string | null;
  /** Human-readable employee range e.g. "10K-50K" */
  sizeRange: string | null;
  /** Exact employee count when available */
  employeeCount: number | null;
  /** Estimated annual revenue string e.g. "$1B-$10B" */
  estimatedRevenue: string | null;
  /** Year the company was founded */
  foundedYear: number | null;
  /** LinkedIn company handle e.g. "company/stripe" */
  linkedinHandle: string | null;
  /** Company website URL */
  websiteUrl: string | null;
  /** Brief company description */
  description: string | null;
  /** Country name */
  country: string | null;
  /** City */
  city: string | null;
  /** Company type e.g. "privately held", "public company" */
  companyType: string | null;
  /** Top tags / keywords */
  tags: string[];
  /** Domain that was looked up */
  domain: string;
}

export interface DiscoveredContact {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  department: string | null;
  confidence: number;
  linkedinUrl: string | null;
  phone: string | null;
}

export interface DomainSearchDiscoveryResult {
  domain: string;
  organization: string | null;
  pattern: string | null;
  contacts: DiscoveredContact[];
  totalFound: number;
  fetchedAt: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

export function extractDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1].includes(".")) return null;
  return parts[1];
}

export function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain.toLowerCase());
}

function normalizeHunterResponse(data: any, domain: string): EnrichmentResult {
  const d = data?.data ?? {};
  return {
    source: "hunter",
    fetchedAt: new Date().toISOString(),
    name: d.name ?? null,
    industry: d.category?.industry ?? null,
    sector: d.category?.sector ?? null,
    sizeRange: d.metrics?.employees ?? null,
    employeeCount: typeof d.metrics?.headcount === "number" ? d.metrics.headcount : null,
    estimatedRevenue: d.metrics?.estimated_annual_revenue ?? null,
    foundedYear: typeof d.founded_year === "number" ? d.founded_year : null,
    linkedinHandle: d.social?.linkedin ?? null,
    websiteUrl: d.domain ? `https://${d.domain}` : null,
    description: d.description ?? null,
    country: d.location?.country ?? null,
    city: d.location?.city ?? null,
    companyType: d.company_type ?? null,
    tags: Array.isArray(d.category?.tags) ? d.category.tags.slice(0, 8) : [],
    domain
  };
}

export async function logEnrichmentUsage(
  leadId: string | null,
  provider: string,
  domain: string | null,
  status: string,
  httpStatus: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    // Check monthly credit usage against warning threshold (Hunter free plan provides 50 searches/mo)
    if (status === "enriched" || status === "failed" || status === "rate_limited" || status === "contacts_discovered") {
      const threshold = parseInt(process.env.HUNTER_MONTHLY_WARNING_THRESHOLD ?? "40", 10);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { Op } = require("sequelize");
      const monthlyCount = await sequelize.models.EnrichmentUsage.count({
        where: {
          provider,
          calledAt: { [Op.gte]: startOfMonth },
          status: { [Op.in]: ["enriched", "failed", "rate_limited", "contacts_discovered"] }
        }
      });

      if (monthlyCount >= threshold) {
        console.warn(
          `[enrichment] ⚠️  CREDIT WARNING: ${monthlyCount + 1} ${provider} API calls this month.` +
          ` You are at or above the ${threshold}-call warning threshold.` +
          ` Free plan limit is 50 calls/month. Monitor at https://hunter.io/dashboard`
        );
      }
    }

    await sequelize.models.EnrichmentUsage.create({
      id: crypto.randomUUID(),
      leadId: leadId ?? null,
      provider,
      domain: domain ?? null,
      status,
      httpStatus,
      errorMessage,
      calledAt: new Date()
    });
  } catch (logErr) {
    // Non-critical — never allow usage logging to surface errors to the caller
    console.error("[enrichment] Failed to log usage record:", logErr);
  }
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: findContactsForDomain (on-demand domain search)
// ─────────────────────────────────────────────────────────────────

/**
 * Calls Hunter.io /v2/domain-search?domain={domain}&api_key={key}
 * Normalizes returned contacts and captures the detected email pattern.
 */
export async function findContactsForDomain(
  domain: string
): Promise<DomainSearchDiscoveryResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || apiKey === "your_hunter_api_key_here") {
    throw new Error("HUNTER_API_KEY is not configured in environment variables.");
  }

  if (isPersonalDomain(domain)) {
    throw new Error("Cannot search contacts for personal email domains.");
  }

  const url = `${HUNTER_API_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(12_000)
    });
  } catch (networkErr: any) {
    throw new Error(`Network error calling Hunter domain search: ${networkErr.message}`);
  }

  if (res.status === 200) {
    const json = (await res.json()) as any;
    const data = json?.data || {};
    const emails = Array.isArray(data.emails) ? data.emails : [];

    const contacts: DiscoveredContact[] = emails
      .map((e: any) => ({
        email: e.value || "",
        firstName: e.first_name || null,
        lastName: e.last_name || null,
        position: e.position || e.position_raw || null,
        department: e.department || null,
        confidence: typeof e.confidence === "number" ? e.confidence : 0,
        linkedinUrl: e.linkedin || null,
        phone: e.phone_number || null
      }))
      .filter((c: DiscoveredContact) => !!c.email);

    return {
      domain,
      organization: data.organization || null,
      pattern: data.pattern || null,
      contacts,
      totalFound: typeof json?.meta?.results === "number" ? json.meta.results : contacts.length,
      fetchedAt: new Date().toISOString()
    };
  }

  if (res.status === 404 || res.status === 422) {
    return {
      domain,
      organization: null,
      pattern: null,
      contacts: [],
      totalFound: 0,
      fetchedAt: new Date().toISOString()
    };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Hunter API authentication failed (${res.status}). Verify HUNTER_API_KEY.`);
  }

  if (res.status === 429) {
    throw new Error("Hunter API rate limit hit (429). Please wait a few minutes before retrying.");
  }

  throw new Error(`Hunter Domain Search returned unexpected status ${res.status}`);
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: enrichCompany
// ─────────────────────────────────────────────────────────────────

/**
 * Calls Hunter.io /v2/companies/find for a given domain.
 *
 * Returns null when:
 *  - HUNTER_API_KEY is not configured
 *  - domain is a personal email domain (gmail, yahoo, etc.)
 *  - API returns 404 (company not in Hunter's DB)
 *  - API returns 401/403 (auth error)
 *
 * Throws on transient errors (5xx, network failure) so the caller
 * can decide whether to retry or absorb.
 */
export async function enrichCompany(
  domain: string
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || apiKey === "your_hunter_api_key_here") {
    console.warn("[enrichment] HUNTER_API_KEY not configured — skipping enrichment");
    return null;
  }

  if (isPersonalDomain(domain)) {
    return null; // Caller should mark as 'skipped'
  }

  const url = `${HUNTER_API_BASE}/companies/find?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000) // 10s timeout
    });
  } catch (networkErr: any) {
    // Network / timeout — transient, let the caller handle
    throw new Error(`[enrichment] Network error calling Hunter API: ${networkErr.message}`);
  }

  if (res.status === 200) {
    const json = await res.json() as any;
    return normalizeHunterResponse(json, domain);
  }

  if (res.status === 404 || res.status === 422) {
    // Company not in Hunter's database — not an error, just skip
    return null;
  }

  if (res.status === 401 || res.status === 403) {
    // Auth error — likely wrong key; not retryable
    console.error(
      `[enrichment] Hunter API auth error (${res.status}). ` +
      `Check HUNTER_API_KEY in backend/.env is correct and active at https://hunter.io/api-keys`
    );
    return null;
  }

  if (res.status === 429) {
    // Rate limited — transient
    throw new Error(`[enrichment] Hunter API rate limit hit (429). Will retry next call.`);
  }

  // 5xx or unexpected status — transient, let the caller decide
  throw new Error(`[enrichment] Hunter API returned unexpected status ${res.status}`);
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC: enrichLeadAsync (fire-and-forget wrapper)
// ─────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget enrichment for a specific lead.
 *
 * - Extracts domain from the lead's email address
 * - Skips personal domains (marks lead 'skipped' in DB)
 * - Calls enrichCompany() and writes result to the Lead record
 * - Logs every API call to EnrichmentUsage for credit tracking
 * - NEVER throws — all errors are caught, logged, and the lead is
 *   marked 'failed' so the UI can offer a re-enrich button.
 */
export async function enrichLeadAsync(
  leadId: string,
  email: string,
  company: string
): Promise<void> {
  const { Lead } = sequelize.models;

  // Stamp 'pending' so the UI shows a loading state immediately
  try {
    await Lead.update(
      { enrichmentStatus: "pending" },
      { where: { id: leadId } }
    );
  } catch (stampErr) {
    console.error("[enrichment] Failed to stamp lead as pending:", leadId, stampErr);
    // Continue anyway — enrichment itself might still succeed
  }

  const domain = extractDomain(email);

  // ── Skip: no domain or personal domain ─────────────────────────
  if (!domain || isPersonalDomain(domain)) {
    try {
      await Lead.update(
        { enrichmentStatus: "skipped" },
        { where: { id: leadId } }
      );
      await logEnrichmentUsage(leadId, "hunter", domain, "skipped", null, null);
      console.log(`[enrichment] Skipped personal/invalid domain for lead ${leadId} (${domain ?? "no domain"})`);
    } catch (skipErr) {
      console.error("[enrichment] Error marking lead as skipped:", leadId, skipErr);
    }
    return;
  }

  // ── Call Hunter API ─────────────────────────────────────────────
  let result: EnrichmentResult | null = null;
  let callStatus: string = "failed";
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    result = await enrichCompany(domain);

    if (result) {
      callStatus = "enriched";
      httpStatus = 200;
    } else if (!process.env.HUNTER_API_KEY || process.env.HUNTER_API_KEY === "your_hunter_api_key_here") {
      callStatus = "failed";
      errorMessage = "HUNTER_API_KEY is not configured on server";
    } else {
      // Company not found in Hunter database (404/422)
      callStatus = "not_found";
      httpStatus = 404;
    }
  } catch (enrichErr: any) {
    callStatus = enrichErr?.message?.includes("429") ? "rate_limited" : "failed";
    errorMessage = enrichErr?.message ?? String(enrichErr);
    console.error(`[enrichment] Enrichment call failed for lead ${leadId} (${domain}):`, enrichErr);
  }

  // ── Persist result ─────────────────────────────────────────────
  try {
    if (callStatus === "enriched" && result) {
      await Lead.update(
        {
          enrichmentStatus: "enriched",
          enrichmentData: JSON.stringify(result),
          enrichedAt: new Date()
        },
        { where: { id: leadId } }
      );
      console.log(`[enrichment] ✓ Lead ${leadId} enriched from Hunter.io (${domain}) — ${result.name ?? "unknown"}, ${result.industry ?? "N/A"}, ${result.sizeRange ?? "N/A"} employees`);
    } else {
      await Lead.update(
        { enrichmentStatus: callStatus },
        { where: { id: leadId } }
      );
      if (callStatus === "failed") {
        console.warn(`[enrichment] ✗ Lead ${leadId} enrichment failed (${domain}): ${errorMessage}`);
      } else {
        console.log(`[enrichment] — Lead ${leadId} enrichment skipped (${domain})`);
      }
    }
  } catch (persistErr) {
    console.error("[enrichment] Failed to persist enrichment result for lead:", leadId, persistErr);
  }

  // ── Log usage for credit tracking ──────────────────────────────
  await logEnrichmentUsage(leadId, "hunter", domain, callStatus, httpStatus, errorMessage);
}
