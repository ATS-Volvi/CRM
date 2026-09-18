import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";

export interface RawTouchPayload {
  leadId?: string;
  opportunityId?: string;
  channel?: string;
  source?: string;
  sourceType?: string;
  sourceName?: string;
  sourceDetail?: string;
  sourceEntityId?: string;
  referringAccountId?: string;
  campaign?: string;
  campaignId?: string;
  campaignCode?: string;
  adId?: string;
  adName?: string;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  clickId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface NormalizedAttribution {
  channel: string;
  sourceType: string;
  sourceName: string;
  sourceEntityId: string | null;
  referringAccountId: string | null;
  campaignId: string | null;
  adId: string | null;
  landingPage: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  clickId: string | null;
  rawPayload?: any;
}

/**
 * Standard Controlled Taxonomy
 */
export const CHANNELS = [
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
] as const;

export const SOURCE_TYPES = [
  "Organic",
  "Advertisement",
  "Campaign",
  "Existing Customer",
  "Company Referral",
  "Middleman / Agent",
  "Partner",
  "Sales Rep",
  "Event",
  "Marketplace",
  "Other"
] as const;

/**
 * 1. Normalize source inputs into controlled taxonomy
 */
export function normalizeSourceData(input: RawTouchPayload): NormalizedAttribution {
  const rawChannel = (input.channel || input.source || "").trim();
  const rawType = (input.sourceType || "").trim();
  const utmSource = (input.utmSource || "").trim().toLowerCase();
  const utmMedium = (input.utmMedium || "").trim().toLowerCase();

  let channel = "Other";
  let sourceType = "Other";
  let sourceName = input.sourceName || input.sourceDetail || input.source || "";

  // Channel Normalization
  const lowerCh = rawChannel.toLowerCase();
  if (lowerCh.includes("web") || lowerCh.includes("site") || lowerCh.includes("form")) {
    channel = "Website";
  } else if (lowerCh.includes("whatsapp") || lowerCh.includes("wa")) {
    channel = "WhatsApp";
  } else if (lowerCh.includes("instagram") || lowerCh.includes("ig") || lowerCh.includes("insta")) {
    channel = "Instagram";
  } else if (lowerCh.includes("facebook") || lowerCh.includes("fb") || lowerCh.includes("meta")) {
    channel = "Facebook";
  } else if (lowerCh.includes("linkedin") || lowerCh.includes("li")) {
    channel = "LinkedIn";
  } else if (lowerCh.includes("email") || lowerCh.includes("gmail") || lowerCh.includes("mail")) {
    channel = "Email";
  } else if (lowerCh.includes("phone") || lowerCh.includes("call") || lowerCh.includes("telephony")) {
    channel = "Phone";
  } else if (lowerCh.includes("referral") || lowerCh.includes("ref")) {
    channel = "Referral";
  } else if (lowerCh.includes("partner")) {
    channel = "Partner";
  } else if (lowerCh.includes("api") || lowerCh.includes("webhook")) {
    channel = "API";
  } else if (lowerCh.includes("manual") || lowerCh.includes("offline")) {
    channel = "Manual";
  }

  // UTM Source Override for Technical Website Visits
  if (channel === "Website" && utmSource) {
    if (utmSource.includes("instagram") || utmSource.includes("ig")) {
      sourceName = "Instagram Ads";
      sourceType = "Advertisement";
    } else if (utmSource.includes("google") || utmSource.includes("adwords")) {
      sourceName = "Google Ads";
      sourceType = "Advertisement";
    } else if (utmSource.includes("facebook") || utmSource.includes("meta")) {
      sourceName = "Facebook Ads";
      sourceType = "Advertisement";
    } else if (utmSource.includes("linkedin")) {
      sourceName = "LinkedIn Ads";
      sourceType = "Advertisement";
    }
  }

  // Source Type Normalization
  const lowerType = rawType.toLowerCase();
  if (lowerType.includes("ad") || lowerType.includes("cpc") || lowerType.includes("paid") || utmMedium.includes("cpc") || utmMedium.includes("paid")) {
    sourceType = "Advertisement";
  } else if (lowerType.includes("company") || lowerType.includes("customer")) {
    sourceType = "Company Referral";
  } else if (lowerType.includes("middleman") || lowerType.includes("agent") || lowerType.includes("broker")) {
    sourceType = "Middleman / Agent";
  } else if (lowerType.includes("partner")) {
    sourceType = "Partner";
  } else if (lowerType.includes("sales") || lowerType.includes("rep")) {
    sourceType = "Sales Rep";
  } else if (lowerType.includes("event") || lowerType.includes("expo") || lowerType.includes("fair")) {
    sourceType = "Event";
  } else if (lowerType.includes("campaign") || input.campaign || input.utmCampaign) {
    sourceType = sourceType === "Other" ? "Campaign" : sourceType;
  } else if (lowerType.includes("organic") || lowerCh.includes("organic")) {
    sourceType = "Organic";
  }

  if (sourceType === "Other" && (channel === "Referral" || input.referringAccountId)) {
    sourceType = input.referringAccountId ? "Company Referral" : "Middleman / Agent";
  }

  if (!sourceName) {
    sourceName = input.campaign || input.utmSource || channel;
  }

  return {
    channel,
    sourceType,
    sourceName,
    sourceEntityId: input.sourceEntityId || null,
    referringAccountId: input.referringAccountId || null,
    campaignId: input.campaignId || null,
    adId: input.adId || null,
    landingPage: input.landingPage || null,
    referrer: input.referrer || null,
    utmSource: input.utmSource || null,
    utmMedium: input.utmMedium || null,
    utmCampaign: input.utmCampaign || null,
    utmTerm: input.utmTerm || null,
    utmContent: input.utmContent || null,
    clickId: input.clickId || null,
    rawPayload: input.metadata || input
  };
}

/**
 * 2. Lookup or match Campaign and Ad by code, name, or externalId
 */
export async function resolveCampaignAndAd(input: RawTouchPayload, transaction?: any): Promise<{ campaignId: string | null; adId: string | null }> {
  const { Campaign, CampaignAd } = sequelize.models;
  let campaignId = input.campaignId || null;
  let adId = input.adId || null;

  // Resolve Campaign by code, name, or utm_campaign
  if (!campaignId && (input.campaignCode || input.campaign || input.utmCampaign)) {
    const term = input.campaignCode || input.campaign || input.utmCampaign;
    const likeOp = sequelize.getDialect() === "sqlite" ? Op.like : Op.iLike;
    const campaignRecord: any = await Campaign.findOne({
      where: {
        [Op.or]: [
          { code: term },
          { name: { [likeOp]: `%${term}%` } }
        ]
      },
      transaction
    });
    if (campaignRecord) {
      campaignId = campaignRecord.id;
    }
  }

  // Resolve Ad by externalId, name, or utm_content
  if (!adId && (input.adName || input.utmContent)) {
    const likeOp = sequelize.getDialect() === "sqlite" ? Op.like : Op.iLike;
    const adTerm = input.adName || input.utmContent;
    const adRecord: any = await CampaignAd.findOne({
      where: {
        ...(campaignId ? { campaignId } : {}),
        [Op.or]: [
          { externalId: adTerm },
          { name: { [likeOp]: `%${adTerm}%` } }
        ]
      },
      transaction
    });
    if (adRecord) {
      adId = adRecord.id;
      if (!campaignId) campaignId = adRecord.campaignId;
    }
  }

  return { campaignId, adId };
}

/**
 * 3. Multi-Touch Attribution Engine
 * Records first touch, last marketing touch, and event history
 */
export async function recordLeadTouch(payload: RawTouchPayload, transaction?: any): Promise<{
  leadAttribution: any;
  attributionEvent: any;
  isFirstTouch: boolean;
}> {
  const { Lead, LeadAttribution, AttributionEvent } = sequelize.models;
  const leadId = payload.leadId;

  const resolved = await resolveCampaignAndAd(payload, transaction);
  const normalized = normalizeSourceData({
    ...payload,
    campaignId: resolved.campaignId || payload.campaignId,
    adId: resolved.adId || payload.adId
  });

  const now = payload.timestamp || new Date();

  let existingAttributions: any[] = [];
  if (leadId) {
    existingAttributions = await LeadAttribution.findAll({
      where: { leadId },
      order: [["createdAt", "ASC"]],
      transaction
    });
  }

  const isFirstTouch = existingAttributions.length === 0;

  // Multi-Touch Rule: Direct visits or simple follow-ups must NOT erase prior marketing last-touch
  const isDirectVisit = normalized.channel === "Website" && !normalized.utmSource && normalized.sourceType === "Other";
  
  let touchType = isFirstTouch ? "FIRST_TOUCH" : (isDirectVisit ? "INTERMEDIATE" : "LAST_TOUCH");

  // Create LeadAttribution record
  const attributionId = crypto.randomUUID();
  const leadAttribution = await LeadAttribution.create(
    {
      id: attributionId,
      leadId: leadId || crypto.randomUUID(),
      channel: normalized.channel,
      sourceType: normalized.sourceType,
      sourceName: normalized.sourceName,
      sourceEntityId: normalized.sourceEntityId,
      referringAccountId: normalized.referringAccountId,
      campaignId: normalized.campaignId,
      adId: normalized.adId,
      landingPage: normalized.landingPage,
      referrer: normalized.referrer,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      utmTerm: normalized.utmTerm,
      utmContent: normalized.utmContent,
      clickId: normalized.clickId,
      touchType,
      firstTouchAt: isFirstTouch ? now : (existingAttributions[0]?.firstTouchAt || now),
      lastTouchAt: now
    },
    { transaction }
  );

  // Log Attribution Event in historical timeline
  const attributionEvent = await AttributionEvent.create(
    {
      id: crypto.randomUUID(),
      leadId: leadId || null,
      opportunityId: payload.opportunityId || null,
      channel: normalized.channel,
      sourceType: normalized.sourceType,
      sourceName: normalized.sourceName,
      campaignId: normalized.campaignId,
      adId: normalized.adId,
      timestamp: now,
      metadata: JSON.stringify(normalized.rawPayload || {})
    },
    { transaction }
  );

  // Update Lead record attribution snapshot if leadId exists
  if (leadId) {
    const lead: any = await Lead.findByPk(leadId, { transaction });
    if (lead) {
      const updates: any = {};
      
      if (isFirstTouch || !lead.firstTouchAttribution) {
        updates.firstTouchAttribution = JSON.stringify(normalized);
        updates.sourceChannel = normalized.channel;
        updates.sourceType = normalized.sourceType;
        updates.sourceName = normalized.sourceName;
        if (normalized.campaignId) updates.campaignId = normalized.campaignId;
        if (normalized.adId) updates.adId = normalized.adId;
        if (normalized.referringAccountId) updates.referringAccountId = normalized.referringAccountId;
      }

      if (!isDirectVisit) {
        updates.lastTouchAttribution = JSON.stringify(normalized);
        if (normalized.campaignId) updates.campaignId = normalized.campaignId;
        if (normalized.adId) updates.adId = normalized.adId;
      }

      await lead.update(updates, { transaction });
    }
  }

  return { leadAttribution, attributionEvent, isFirstTouch };
}

/**
 * 4. Carry Over Attribution to Opportunity upon Lead Conversion
 */
export async function carryOverAttributionToOpportunity(
  leadId: string,
  opportunityId: string,
  transaction?: any
): Promise<void> {
  const { Lead, Deal, AttributionEvent } = sequelize.models;

  const lead: any = await Lead.findByPk(leadId, { transaction });
  const deal: any = await Deal.findByPk(opportunityId, { transaction });

  if (!lead || !deal) return;

  await deal.update(
    {
      campaignId: lead.campaignId || deal.campaignId,
      adId: lead.adId || deal.adId,
      sourceType: lead.sourceType || deal.sourceType,
      sourceChannel: lead.sourceChannel || lead.communicationChannel || deal.sourceChannel,
      sourceName: lead.sourceName || lead.sourceDetail || deal.sourceName,
      referringAccountId: lead.referringAccountId || deal.referringAccountId,
      firstTouchAttribution: lead.firstTouchAttribution || deal.firstTouchAttribution,
      lastTouchAttribution: lead.lastTouchAttribution || deal.lastTouchAttribution
    },
    { transaction }
  );

  // Record Opportunity Linkage in Attribution Events
  await AttributionEvent.create(
    {
      id: crypto.randomUUID(),
      leadId,
      opportunityId,
      channel: lead.sourceChannel || "Conversion",
      sourceType: lead.sourceType || "Converted Lead",
      sourceName: lead.sourceName || "Sales Conversion",
      campaignId: lead.campaignId,
      adId: lead.adId,
      timestamp: new Date(),
      metadata: JSON.stringify({
        event: "LEAD_CONVERTED_TO_OPPORTUNITY",
        leadNumber: lead.leadNumber,
        opportunityId
      })
    },
    { transaction }
  );
}

/**
 * 5. Campaign Performance & Marketing-to-Revenue Aggregator
 */
export async function getCampaignPerformance(campaignId?: string): Promise<any> {
  const { Campaign, CampaignAd, Lead, Deal, Quote, PurchaseOrder } = sequelize.models;

  const campaigns = await Campaign.findAll({
    where: campaignId ? { id: campaignId } : {},
    include: [{ model: CampaignAd, as: "ads" }]
  });

  const results = [];

  for (const c of campaigns as any[]) {
    const cId = c.id;

    // Leads Count & Qualified Count
    const leads = await Lead.findAll({
      where: { campaignId: cId }
    });
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l: any) => l.status === "QUALIFIED" || l.status === "CONVERTED").length;

    // Opportunities Count
    const deals = await Deal.findAll({
      where: { campaignId: cId }
    });
    const totalOpportunities = deals.length;

    // Won Deals & Orders Revenue
    const dealIds = deals.map((d: any) => d.id);
    let wonDealsCount = 0;
    let totalRevenue = 0;
    let wonOrdersCount = 0;

    if (dealIds.length > 0) {
      const orders = await PurchaseOrder.findAll({
        include: [
          {
            model: Quote,
            as: "quote",
            where: { dealId: { [Op.in]: dealIds } }
          }
        ]
      });

      wonOrdersCount = orders.length;
      wonDealsCount = new Set(orders.map((o: any) => o.quote?.dealId)).size;
      totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.amount || o.grandTotal || 0), 0);
    }

    const budget = Number(c.budget || 0);
    const actualSpend = c.actualSpend !== null && c.actualSpend !== undefined ? Number(c.actualSpend) : null;

    // Unit Economics
    const costBasis = actualSpend !== null ? actualSpend : (budget > 0 ? budget : null);
    const costPerLead = costBasis !== null && totalLeads > 0 ? Number((costBasis / totalLeads).toFixed(2)) : null;
    const costPerQualifiedLead = costBasis !== null && qualifiedLeads > 0 ? Number((costBasis / qualifiedLeads).toFixed(2)) : null;
    const costPerOpportunity = costBasis !== null && totalOpportunities > 0 ? Number((costBasis / totalOpportunities).toFixed(2)) : null;
    const costPerWonDeal = costBasis !== null && wonDealsCount > 0 ? Number((costBasis / wonDealsCount).toFixed(2)) : null;

    // ROAS & ROI (Do not invent/fabricate if cost is unavailable)
    let roas = null;
    let roiPct = null;
    if (actualSpend !== null && actualSpend > 0) {
      roas = Number((totalRevenue / actualSpend).toFixed(2));
      roiPct = Number((((totalRevenue - actualSpend) / actualSpend) * 100).toFixed(2));
    }

    results.push({
      campaign: {
        id: c.id,
        name: c.name,
        code: c.code,
        channel: c.channel,
        platform: c.platform,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        budget,
        actualSpend,
        currency: c.currency,
        adsCount: (c as any).ads?.length || 0
      },
      metrics: {
        totalLeads,
        qualifiedLeads,
        totalOpportunities,
        wonDealsCount,
        wonOrdersCount,
        totalRevenue,
        conversionRateLeadToQual: totalLeads > 0 ? Number(((qualifiedLeads / totalLeads) * 100).toFixed(1)) : 0,
        conversionRateQualToOpp: qualifiedLeads > 0 ? Number(((totalOpportunities / qualifiedLeads) * 100).toFixed(1)) : 0,
        conversionRateOppToWon: totalOpportunities > 0 ? Number(((wonDealsCount / totalOpportunities) * 100).toFixed(1)) : 0,
        costPerLead,
        costPerQualifiedLead,
        costPerOpportunity,
        costPerWonDeal,
        roas,
        roiPct
      }
    });
  }

  return campaignId ? results[0] || null : results;
}

/**
 * 6. Lead Source & Channel Quality Performance Aggregator
 */
export async function getSourcePerformance(): Promise<any> {
  const { Lead, Deal, Quote, PurchaseOrder } = sequelize.models;

  const leads = await Lead.findAll();
  const deals = await Deal.findAll();
  const orders = await PurchaseOrder.findAll({
    include: [{ model: Quote, as: "quote" }]
  });

  const channelMap: Record<string, {
    channel: string;
    leads: number;
    qualified: number;
    opportunities: number;
    won: number;
    revenue: number;
  }> = {};

  const sourceTypeMap: Record<string, {
    sourceType: string;
    leads: number;
    qualified: number;
    opportunities: number;
    won: number;
    revenue: number;
  }> = {};

  // Aggregate Leads
  for (const l of leads as any[]) {
    const ch = l.sourceChannel || l.communicationChannel || l.source || "Other";
    const st = l.sourceType || "Other";

    if (!channelMap[ch]) {
      channelMap[ch] = { channel: ch, leads: 0, qualified: 0, opportunities: 0, won: 0, revenue: 0 };
    }
    channelMap[ch].leads++;
    if (l.status === "QUALIFIED" || l.status === "CONVERTED") {
      channelMap[ch].qualified++;
    }

    if (!sourceTypeMap[st]) {
      sourceTypeMap[st] = { sourceType: st, leads: 0, qualified: 0, opportunities: 0, won: 0, revenue: 0 };
    }
    sourceTypeMap[st].leads++;
    if (l.status === "QUALIFIED" || l.status === "CONVERTED") {
      sourceTypeMap[st].qualified++;
    }
  }

  // Aggregate Opportunities
  for (const d of deals as any[]) {
    const ch = d.sourceChannel || "Other";
    const st = d.sourceType || "Other";

    if (channelMap[ch]) channelMap[ch].opportunities++;
    if (sourceTypeMap[st]) sourceTypeMap[st].opportunities++;
  }

  // Aggregate Won Revenue
  for (const o of orders as any[]) {
    const deal = deals.find((d: any) => d.id === o.quote?.dealId) as any;
    if (deal) {
      const ch = deal.sourceChannel || "Other";
      const st = deal.sourceType || "Other";
      const rev = Number(o.amount || o.grandTotal || 0);

      if (channelMap[ch]) {
        channelMap[ch].won++;
        channelMap[ch].revenue += rev;
      }
      if (sourceTypeMap[st]) {
        sourceTypeMap[st].won++;
        sourceTypeMap[st].revenue += rev;
      }
    }
  }

  return {
    byChannel: Object.values(channelMap).map(c => ({
      ...c,
      leadToQualRate: c.leads > 0 ? Number(((c.qualified / c.leads) * 100).toFixed(1)) : 0,
      oppToWonRate: c.opportunities > 0 ? Number(((c.won / c.opportunities) * 100).toFixed(1)) : 0
    })),
    bySourceType: Object.values(sourceTypeMap).map(s => ({
      ...s,
      leadToQualRate: s.leads > 0 ? Number(((s.qualified / s.leads) * 100).toFixed(1)) : 0,
      oppToWonRate: s.opportunities > 0 ? Number(((s.won / s.opportunities) * 100).toFixed(1)) : 0
    }))
  };
}
