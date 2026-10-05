import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import {
  recordLeadTouch,
  getSourcePerformance,
  getCampaignPerformance,
  CHANNELS,
  SOURCE_TYPES
} from "../services/attributionService";

export const getLeadAttribution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lead: any = await sequelize.models.Lead.findByPk(String(id), {
      include: [
        { model: sequelize.models.Campaign, as: "campaignModel" },
        { model: sequelize.models.CampaignAd, as: "ad" },
        { model: sequelize.models.Account, as: "referringAccount" }
      ]
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const attributions = await sequelize.models.LeadAttribution.findAll({
      where: { leadId: String(id) },
      order: [["createdAt", "ASC"]],
      include: [
        { model: sequelize.models.Campaign, as: "campaign" },
        { model: sequelize.models.CampaignAd, as: "ad" }
      ]
    });

    res.json({
      leadId: lead.id,
      channel: lead.sourceChannel || lead.communicationChannel || lead.source,
      sourceType: lead.sourceType,
      sourceName: lead.sourceName || lead.sourceDetail,
      campaign: lead.campaignModel,
      ad: lead.ad,
      referringAccount: lead.referringAccount,
      firstTouchAttribution: lead.firstTouchAttribution ? JSON.parse(lead.firstTouchAttribution) : null,
      lastTouchAttribution: lead.lastTouchAttribution ? JSON.parse(lead.lastTouchAttribution) : null,
      touches: attributions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLeadAttributionHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const events = await sequelize.models.AttributionEvent.findAll({
      where: { leadId: String(id) },
      order: [["timestamp", "ASC"]],
      include: [
        { model: sequelize.models.Campaign, as: "campaign" },
        { model: sequelize.models.CampaignAd, as: "ad" }
      ]
    });

    res.json({ leadId: id, events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export function isSalesContactTouch(channel?: string, sourceType?: string): boolean {
  const ch = (channel || "").toLowerCase().trim();
  const st = (sourceType || "").toLowerCase().trim();

  // If source type is explicit sales rep / outbound outreach
  if (st === "sales rep" || st === "sales outbound") {
    return true;
  }

  // Real 1-on-1 sales contact types: call/phone, meeting
  if (ch === "phone" || ch === "call" || ch === "phone call" || ch === "meeting" || ch === "in-person meeting") {
    return true;
  }

  // WhatsApp 1-on-1 conversation (not advertisement or broadcast)
  if (ch.includes("whatsapp") && !st.includes("ad") && !st.includes("campaign") && !st.includes("marketing") && !st.includes("social")) {
    return true;
  }

  // Direct 1-on-1 email conversation (not newsletter / marketing blast)
  if (ch === "email" && (st === "sales outbound" || st === "sales rep" || st === "direct")) {
    return true;
  }

  return false;
}

export function getSalesActivityType(channel?: string): string {
  const ch = (channel || "").toLowerCase().trim();
  if (ch.includes("call") || ch.includes("phone")) return "call";
  if (ch.includes("meeting")) return "meeting";
  if (ch.includes("whatsapp")) return "whatsapp_sms";
  if (ch.includes("email")) return "email";
  return "call";
}

export const recordManualTouch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { channel, sourceType, sourceName, campaignId, adId, utmSource, utmMedium, utmCampaign, notes } = req.body;
    const userId = (req as any).user?.id;

    // 1. Record Attribution Touch & Multi-Touch History (pure attribution tracking)
    const result = await recordLeadTouch({
      leadId: String(id),
      channel,
      sourceType,
      sourceName,
      campaignId,
      adId,
      utmSource,
      utmMedium,
      utmCampaign,
      metadata: { notes, recordedBy: userId }
    });

    // 2. Only write sales contact activity & advance lead stage if this touch represents
    // a genuine 1-on-1 sales interaction (call, meeting, WhatsApp/email conversation).
    // Marketing touches (Meta Ads, Google Ads, LinkedIn, Event, Direct, Organic, etc.)
    // strictly preserve the current lead status without advancing stages.
    const isSalesContact = isSalesContactTouch(channel, sourceType);
    if (isSalesContact) {
      const activityType = getSalesActivityType(channel);
      const cryptoModule = require("crypto");
      await sequelize.models.Activity.create({
        id: cryptoModule.randomUUID(),
        leadId: String(id),
        type: activityType,
        outcome: notes || `Direct sales contact logged via ${channel || "Outbound"}`,
        notes: notes || null,
        createdById: userId || null,
        direction: "outbound"
      });

      const { checkAndAutoAdvanceLead } = require("../services/leadStageAutomationService");
      await checkAndAutoAdvanceLead(String(id), { userId });
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLeadSourceAnalytics = async (req: Request, res: Response) => {
  try {
    const performance = await getSourcePerformance();
    res.json(performance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignsAnalytics = async (req: Request, res: Response) => {
  try {
    const performance = await getCampaignPerformance();
    res.json({ data: performance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttributionTaxonomy = async (req: Request, res: Response) => {
  try {
    const customSources = await sequelize.models.LeadSource.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]]
    });

    res.json({
      channels: CHANNELS,
      sourceTypes: SOURCE_TYPES,
      customLeadSources: customSources
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
