import { Request, Response } from "express";
import { sequelize, Account, Contact, Deal, Quote, PurchaseOrder, Activity, Lead, LeadContactDiscovery } from "@nexus-crm/database";
import crypto from "crypto";
import {
  extractDomain,
  isPersonalDomain,
  enrichCompany,
  findContactsForDomain,
  logEnrichmentUsage
} from "../services/enrichmentService";

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const { Op } = require("sequelize");
    const where: any = {};

    if (search) {
      const searchStr = `%${search}%`;
      where[Op.or] = [
        { name: { [Op.like]: searchStr } },
        { email: { [Op.like]: searchStr } },
        { phone: { [Op.like]: searchStr } },
        { industry: { [Op.like]: searchStr } }
      ];
    }

    const accounts = await Account.findAll({
      where,
      include: [
        { model: Contact, as: "contacts" },
        {
          model: Deal,
          as: "deals",
          include: [{ model: Quote, as: "quotes" }]
        },
        { model: Account, as: "subsidiaries" },
        { model: Account, as: "parentAccount" },
        { model: sequelize.models.Subscription, as: "subscriptions" }
      ],
      order: [["createdAt", "DESC"]]
    });

    const mappedAccounts = accounts.map((acc: any) => {
      const data = acc.toJSON();
      data.deals = data.deals || [];
      return data;
    });

    return res.status(200).json(mappedAccounts);
  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id, {
      include: [
        { model: Contact, as: "contacts" },
        { 
          model: Deal, 
          as: "deals",
          include: [{ model: Quote, as: "quotes" }]
        },
        { model: Account, as: "subsidiaries" },
        { model: Account, as: "parentAccount" },
        { model: sequelize.models.Subscription, as: "subscriptions" }
      ]
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Fetch account-associated activities
    const activities = await Activity.findAll({
      where: {
        customerId: id
      },
      order: [["createdAt", "DESC"]]
    });

    // Fetch account-associated purchase orders through quotes/deals
    const dealIds = (account as any).deals?.map((d: any) => d.id) || [];
    let quotesForDeals: any[] = [];
    if (dealIds.length > 0) {
      quotesForDeals = await Quote.findAll({
        where: { dealId: dealIds }
      });
    }
    const quoteIds = quotesForDeals.map((q: any) => q.id);
    let orders: any[] = [];
    if (quoteIds.length > 0) {
      orders = await PurchaseOrder.findAll({
        where: { quoteId: quoteIds }
      });
    }

    // Fetch account-associated historical leads
    const { Op } = require("sequelize");
    const orConditions: any[] = [{ convertedAccountId: id }];
    if (account.name) orConditions.push({ company: { [Op.like]: `%${account.name}%` } });
    if (account.email) orConditions.push({ email: account.email });
    if (account.phone) orConditions.push({ phone: account.phone });

    let relatedLeads: any[] = [];
    if (sequelize.models.Lead) {
      relatedLeads = await (sequelize.models.Lead as any).findAll({
        where: { [Op.or]: orConditions },
        order: [["createdAt", "DESC"]]
      });
    }

    const accountData = account.toJSON();
    accountData.deals = accountData.deals || [];
    (accountData as any).quotes = quotesForDeals;
    (accountData as any).purchaseOrders = orders;
    (accountData as any).orders = orders;
    (accountData as any).activities = activities;
    (accountData as any).leads = relatedLeads;
    (accountData as any).relatedLeads = relatedLeads;

    return res.status(200).json(accountData);
  } catch (error: any) {
    console.error("Error fetching account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, industry, primaryContactName } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Customer name is required" });
    }

    const newAccount = await Account.create({
      id: require("crypto").randomUUID(),
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      industry: industry || "General",
      primaryContactName: primaryContactName || null
    });

    return res.status(201).json(newAccount);
  } catch (error: any) {
    console.error("Error creating account:", error);
    return res.status(500).json({ error: error.message || "Failed to create account" });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    await account.update(req.body);
    return res.status(200).json(account);
  } catch (error: any) {
    console.error("Error updating account:", error);
    return res.status(500).json({ message: "Failed to update account" });
  }
};

/**
 * Derives company domain from Account.website, or primary lead email domain, or account email domain.
 * Skips personal domains (gmail, yahoo, etc.).
 */
export function deriveAccountDomain(account: any, linkedLeads: any[] = []): string | null {
  let domain: string | null = null;

  // 1. Account.website or account.websiteUrl
  const rawWebsite = account.website || account.websiteUrl || null;
  if (rawWebsite && typeof rawWebsite === "string") {
    const cleaned = rawWebsite
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    if (cleaned.includes(".") && !isPersonalDomain(cleaned)) {
      domain = cleaned;
    }
  }

  // 2. Primary / linked lead's email domain
  if (!domain && linkedLeads.length > 0) {
    for (const lead of linkedLeads) {
      if (lead.email) {
        const leadDomain = extractDomain(lead.email);
        if (leadDomain && !isPersonalDomain(leadDomain)) {
          domain = leadDomain;
          break;
        }
      }
    }
  }

  // 3. Account.email domain
  if (!domain && account.email) {
    const emailDomain = extractDomain(account.email);
    if (emailDomain && !isPersonalDomain(emailDomain)) {
      domain = emailDomain;
    }
  }

  // 4. If account name looks like a domain (e.g. "novigo.com")
  if (!domain && account.name && account.name.includes(".")) {
    const cleanedName = account.name
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    if (cleanedName.includes(".") && !isPersonalDomain(cleanedName)) {
      domain = cleanedName;
    }
  }

  return domain;
}

/**
 * Finds leads linked to an account via convertedAccountId, accountId, customerId, or matching company name/email.
 */
async function findLinkedLeads(accountId: string, accountName?: string, accountEmail?: string, accountPhone?: string) {
  const { Op } = require("sequelize");
  const orConditions: any[] = [
    { convertedAccountId: accountId },
    { accountId: accountId },
    { customerId: accountId }
  ];
  if (accountName) {
    orConditions.push({ company: { [Op.like]: `%${accountName}%` } });
  }
  if (accountEmail) {
    orConditions.push({ email: accountEmail });
  }
  if (accountPhone) {
    orConditions.push({ phone: accountPhone });
  }
  return Lead.findAll({
    where: { [Op.or]: orConditions },
    order: [["createdAt", "DESC"]]
  });
}

/**
 * Searches for cached Hunter enrichment data and contact discoveries for an account or domain.
 */
async function findCachedAccountEnrichment(accountId: string, domain: string | null, linkedLeads: any[]) {
  const { Op } = require("sequelize");

  // 1. Check if any linked lead has enrichmentData
  let cachedEnrichment: any = null;
  let enrichedLead: any = null;
  for (const lead of linkedLeads) {
    if (lead.enrichmentData) {
      try {
        const parsed = typeof lead.enrichmentData === "string" ? JSON.parse(lead.enrichmentData) : lead.enrichmentData;
        if (parsed && typeof parsed === "object") {
          cachedEnrichment = parsed;
          enrichedLead = lead;
          break;
        }
      } catch (e) {}
    }
  }

  // If not found in linked leads, but we have a domain, look for any lead with this domain that has enrichmentData
  if (!cachedEnrichment && domain) {
    const leadWithDomain = await Lead.findOne({
      where: {
        email: { [Op.like]: `%@${domain}` },
        enrichmentData: { [Op.ne]: null }
      },
      order: [["enrichedAt", "DESC"], ["createdAt", "DESC"]]
    });
    if (leadWithDomain?.enrichmentData) {
      try {
        cachedEnrichment = typeof leadWithDomain.enrichmentData === "string" ? JSON.parse(leadWithDomain.enrichmentData) : leadWithDomain.enrichmentData;
        enrichedLead = leadWithDomain;
      } catch (e) {}
    }
  }

  // 2. Check LeadContactDiscovery for cached discovered contacts
  let cachedDiscovery: any = null;
  const leadIds = linkedLeads.map((l: any) => l.id);
  const discoveryOr: any[] = [];
  if (leadIds.length > 0) {
    discoveryOr.push({ leadId: { [Op.in]: leadIds } });
  }
  if (domain) {
    discoveryOr.push({ domain });
  }
  if (discoveryOr.length > 0) {
    cachedDiscovery = await LeadContactDiscovery.findOne({
      where: { [Op.or]: discoveryOr },
      order: [["discoveredAt", "DESC"], ["createdAt", "DESC"]]
    });
  }

  return { cachedEnrichment, cachedDiscovery, enrichedLead };
}

/**
 * Normalizes enrichment profile and discovered contacts into standardized API payload.
 */
function formatEnrichmentPayload(domain: string | null, cachedEnrichment: any, cachedDiscovery: any) {
  let discoveredContacts: any[] = [];
  let emailPattern: string | null = cachedDiscovery?.emailPattern || null;

  if (cachedDiscovery) {
    try {
      const raw = typeof cachedDiscovery.contactsFound === "string"
        ? JSON.parse(cachedDiscovery.contactsFound || "[]")
        : (cachedDiscovery.contactsFound || []);
      if (Array.isArray(raw)) {
        discoveredContacts = raw.map((c: any) => ({
          name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || "Unknown",
          position: c.position || c.department || null,
          email: c.email || "",
          confidence: typeof c.confidence === "number" ? c.confidence : (c.confidence || null),
          source: "Hunter.io",
          linkedinUrl: c.linkedinUrl || null,
          phone: c.phone || null
        }));
      }
    } catch (e) {}
  }

  const websiteUrl = cachedEnrichment?.websiteUrl || (domain ? `https://${domain}` : null);
  const city = cachedEnrichment?.city || null;
  const country = cachedEnrichment?.country || null;
  const employeeCount = typeof cachedEnrichment?.employeeCount === "number" ? cachedEnrichment.employeeCount : null;
  const sizeRange = cachedEnrichment?.sizeRange || null;
  const foundedYear = typeof cachedEnrichment?.foundedYear === "number" ? cachedEnrichment.foundedYear : null;
  const industry = cachedEnrichment?.industry || null;
  const description = cachedEnrichment?.description || null;
  const linkedinHandle = cachedEnrichment?.linkedinHandle || null;

  const hasData = Boolean(cachedEnrichment || cachedDiscovery);

  return {
    enriched: hasData,
    domain: domain || cachedEnrichment?.domain || cachedDiscovery?.domain || null,
    description,
    industry,
    sizeRange,
    employeeCount,
    foundedYear,
    city,
    country,
    linkedinHandle,
    websiteUrl,
    emailPattern,
    discoveredContacts,
    fetchedAt: cachedEnrichment?.fetchedAt || cachedDiscovery?.discoveredAt || null,
    data: hasData ? {
      description,
      industry,
      sizeRange,
      employeeCount,
      foundedYear,
      city,
      country,
      linkedinHandle,
      websiteUrl,
      emailPattern,
      discoveredContacts
    } : null
  };
}

/**
 * Triggers on-demand Hunter company enrichment and domain search contacts discovery.
 */
async function performAccountEnrichment(
  account: Account,
  linkedLeads: any[],
  domain: string | null,
  req: Request,
  res: Response
) {
  if (!domain) {
    return res.status(400).json({
      error: "Cannot enrich account: No valid company domain found on this account."
    });
  }

  if (isPersonalDomain(domain)) {
    return res.status(400).json({
      error: "Cannot enrich personal email domains."
    });
  }

  const requestedById = (req as any).user?.id || null;
  let primaryLead = linkedLeads[0];

  // If no lead exists for this account, create a stub lead so LeadContactDiscovery foreign key can attach
  if (!primaryLead) {
    try {
      primaryLead = await Lead.create({
        id: crypto.randomUUID(),
        firstName: account.primaryContactName?.split(" ")[0] || account.name,
        lastName: account.primaryContactName?.split(" ").slice(1).join(" ") || "Company",
        company: account.name,
        email: account.email || `info@${domain}`,
        accountId: account.id,
        convertedAccountId: account.id,
        source: "Account Enrichment",
        status: "CUSTOMER"
      });
    } catch (createErr) {
      console.error("[accountEnrichment] Error creating lead stub for account:", createErr);
    }
  }

  const leadId = primaryLead ? primaryLead.id : null;

  // 1. Call Hunter company enrichment
  let enrichmentResult: any = null;
  try {
    enrichmentResult = await enrichCompany(domain);
    await logEnrichmentUsage(
      leadId,
      "hunter",
      domain,
      enrichmentResult ? "enriched" : "not_found",
      enrichmentResult ? 200 : 404,
      null
    );
  } catch (enrichErr: any) {
    await logEnrichmentUsage(leadId, "hunter", domain, "failed", null, enrichErr.message || String(enrichErr));
    console.error("[accountEnrichment] Hunter company enrichment failed:", enrichErr);
  }

  // 2. Call Hunter domain search for contacts
  let discoveryResult: any = null;
  try {
    discoveryResult = await findContactsForDomain(domain);
    await logEnrichmentUsage(
      leadId,
      "hunter",
      domain,
      discoveryResult.contacts.length > 0 ? "contacts_discovered" : "not_found",
      200,
      null
    );
  } catch (hunterErr: any) {
    await logEnrichmentUsage(leadId, "hunter", domain, "failed", null, hunterErr.message || String(hunterErr));
    console.error("[accountEnrichment] Hunter contacts discovery failed:", hunterErr);
  }

  // 3. Persist enrichment to lead
  if (primaryLead && enrichmentResult) {
    try {
      await primaryLead.update({
        enrichmentStatus: "enriched",
        enrichmentData: JSON.stringify(enrichmentResult),
        enrichedAt: new Date()
      });
    } catch (saveLeadErr) {
      console.error("[accountEnrichment] Failed to update lead enrichmentData:", saveLeadErr);
    }
  }

  // 4. Persist discovery to LeadContactDiscovery
  let savedDiscovery: any = null;
  if (primaryLead && discoveryResult) {
    try {
      const existingDiscovery = await LeadContactDiscovery.findOne({
        where: { leadId: primaryLead.id }
      });
      if (existingDiscovery) {
        await existingDiscovery.update({
          domain,
          contactsFound: JSON.stringify(discoveryResult.contacts),
          emailPattern: discoveryResult.pattern,
          totalFound: discoveryResult.totalFound,
          discoveredAt: new Date(),
          requestedById
        });
        savedDiscovery = existingDiscovery;
      } else {
        savedDiscovery = await LeadContactDiscovery.create({
          id: crypto.randomUUID(),
          leadId: primaryLead.id,
          domain,
          contactsFound: JSON.stringify(discoveryResult.contacts),
          emailPattern: discoveryResult.pattern,
          totalFound: discoveryResult.totalFound,
          discoveredAt: new Date(),
          requestedById
        });
      }
    } catch (saveDiscErr) {
      console.error("[accountEnrichment] Failed to persist LeadContactDiscovery:", saveDiscErr);
    }
  }

  return res.status(200).json(
    formatEnrichmentPayload(domain, enrichmentResult, savedDiscovery || {
      domain,
      contactsFound: discoveryResult ? JSON.stringify(discoveryResult.contacts) : "[]",
      emailPattern: discoveryResult?.pattern || null,
      totalFound: discoveryResult?.totalFound || 0,
      discoveredAt: new Date()
    })
  );
}

/**
 * GET /api/v1/accounts/:id/enrichment
 * Returns cached Hunter enrichment data and discovered contacts.
 * Does NOT call Hunter again if a cached result exists.
 */
export const getAccountEnrichment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const linkedLeads = await findLinkedLeads(id, account.name, account.email || undefined, account.phone || undefined);
    const domain = deriveAccountDomain(account, linkedLeads);

    const { cachedEnrichment, cachedDiscovery } = await findCachedAccountEnrichment(id, domain, linkedLeads);

    // If cached data exists, return it immediately without calling Hunter!
    if (cachedEnrichment || cachedDiscovery) {
      return res.status(200).json(formatEnrichmentPayload(domain, cachedEnrichment, cachedDiscovery));
    }

    // If ?enrich=true query parameter is passed, perform on-demand enrichment
    if (req.query.enrich === "true") {
      return await performAccountEnrichment(account, linkedLeads, domain, req, res);
    }

    // No cached data exists yet
    return res.status(200).json({
      enriched: false,
      domain,
      message: "No enrichment data yet",
      description: null,
      industry: null,
      sizeRange: null,
      employeeCount: null,
      foundedYear: null,
      city: null,
      country: null,
      linkedinHandle: null,
      websiteUrl: domain ? `https://${domain}` : null,
      emailPattern: null,
      discoveredContacts: [],
      data: null
    });
  } catch (error: any) {
    console.error("Error fetching account enrichment:", error);
    return res.status(500).json({ message: "Internal server error fetching account enrichment", error: error.message });
  }
};

/**
 * POST /api/v1/accounts/:id/enrichment
 * Trigger enrichment/discovery for an account on-demand.
 */
export const enrichAccount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const linkedLeads = await findLinkedLeads(id, account.name, account.email || undefined, account.phone || undefined);
    const domain = req.body?.domain || deriveAccountDomain(account, linkedLeads);

    const refresh = req.query.refresh === "true" || req.body?.refresh === true;
    if (!refresh) {
      const { cachedEnrichment, cachedDiscovery } = await findCachedAccountEnrichment(id, domain, linkedLeads);
      if (cachedEnrichment || cachedDiscovery) {
        return res.status(200).json(formatEnrichmentPayload(domain, cachedEnrichment, cachedDiscovery));
      }
    }

    return await performAccountEnrichment(account, linkedLeads, domain, req, res);
  } catch (error: any) {
    console.error("Error enriching account:", error);
    return res.status(500).json({ message: "Internal server error enriching account", error: error.message });
  }
};


