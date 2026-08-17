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
      campaign: lead.campaignModel || lead.campaign,
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

export const recordManualTouch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { channel, sourceType, sourceName, campaignId, adId, utmSource, utmMedium, utmCampaign, notes } = req.body;

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
      metadata: { notes, recordedBy: (req as any).user?.id }
    });

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
