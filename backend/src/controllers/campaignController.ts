import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { getCampaignPerformance } from "../services/attributionService";

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const { status, channel, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { rows, count } = await sequelize.models.Campaign.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: sequelize.models.CampaignAd, as: "ads" },
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email"] }
      ]
    });

    res.json({
      data: rows,
      page: Number(page),
      limit: Number(limit),
      total: count,
      totalPages: Math.ceil(count / Number(limit))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaign = await sequelize.models.Campaign.findByPk(String(id), {
      include: [
        { model: sequelize.models.CampaignAd, as: "ads" },
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email"] }
      ]
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const performance = await getCampaignPerformance(String(id));

    res.json({ campaign, performance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      description,
      channel,
      platform,
      status = "DRAFT",
      startDate,
      endDate,
      budget = 0,
      actualSpend,
      currency = "INR",
      targetAudience,
      objective
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: "Campaign name and unique code are required" });
    }

    const existing = await sequelize.models.Campaign.findOne({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: `Campaign with code '${code}' already exists.` });
    }

    const campaign = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name,
      code,
      description,
      channel: channel || "Other",
      platform,
      status,
      startDate,
      endDate,
      budget: Number(budget || 0),
      actualSpend: actualSpend !== undefined && actualSpend !== null ? Number(actualSpend) : null,
      currency,
      ownerId: (req as any).user?.id || null,
      targetAudience,
      objective
    });

    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaign = await sequelize.models.Campaign.findByPk(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (req.body.code && req.body.code !== (campaign as any).code) {
      const duplicate = await sequelize.models.Campaign.findOne({ where: { code: req.body.code } });
      if (duplicate) {
        return res.status(409).json({ error: `Campaign code '${req.body.code}' is already in use.` });
      }
    }

    await campaign.update(req.body);
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaign = await sequelize.models.Campaign.findByPk(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    await campaign.destroy();
    res.json({ message: "Campaign deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCampaignAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, externalId, platform, creativeType, status = "ACTIVE" } = req.body;

    const campaign = await sequelize.models.Campaign.findByPk(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (!name) {
      return res.status(400).json({ error: "Ad name is required" });
    }

    if (externalId) {
      const existing = await sequelize.models.CampaignAd.findOne({
        where: { campaignId: String(id), externalId }
      });
      if (existing) {
        return res.status(409).json({ error: `Ad with external ID '${externalId}' already exists in this campaign.` });
      }
    }

    const ad = await sequelize.models.CampaignAd.create({
      id: crypto.randomUUID(),
      campaignId: String(id),
      name,
      externalId: externalId || null,
      platform: platform || (campaign as any).platform || (campaign as any).channel,
      creativeType,
      status
    });

    res.status(201).json(ad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignLeads = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { rows, count } = await sequelize.models.Lead.findAndCountAll({
      where: { campaignId: String(id) },
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: sequelize.models.CampaignAd, as: "ad" },
        { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email"] }
      ]
    });

    res.json({
      data: rows,
      page: Number(page),
      limit: Number(limit),
      total: count,
      totalPages: Math.ceil(count / Number(limit))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignOpportunities = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deals = await sequelize.models.Deal.findAll({
      where: { campaignId: String(id) },
      include: [
        { model: sequelize.models.Account, as: "account" },
        { model: sequelize.models.CampaignAd, as: "ad" }
      ]
    });

    res.json({ data: deals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignPerformanceReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const performance = await getCampaignPerformance(String(id));
    if (!performance) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(performance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
