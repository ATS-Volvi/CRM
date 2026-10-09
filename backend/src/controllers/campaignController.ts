import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { getCampaignPerformance } from "../services/attributionService";
import { generateCsv } from "../utils/csvHelper";
import { fillTimeseriesGaps, TimeseriesEvent } from "../utils/timeseriesHelper";

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const { status, channel, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (search) {
      const likeOp = sequelize.getDialect() === "sqlite" ? Op.like : Op.iLike;
      where[Op.or] = [
        { name: { [likeOp]: `%${search}%` } },
        { code: { [likeOp]: `%${search}%` } },
        { description: { [likeOp]: `%${search}%` } }
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

    // Fetch batched performance metrics across all campaigns (single batched call)
    const allPerformance = await getCampaignPerformance();
    const perfMap = new Map<string, any>();
    if (Array.isArray(allPerformance)) {
      for (const p of allPerformance) {
        if (p.campaign?.id) {
          perfMap.set(p.campaign.id, p.metrics);
        }
      }
    }

    const defaultMetrics = {
      totalLeads: 0,
      qualifiedLeads: 0,
      totalOpportunities: 0,
      wonDealsCount: 0,
      wonOrdersCount: 0,
      totalRevenue: 0,
      conversionRateLeadToQual: 0,
      conversionRateQualToOpp: 0,
      conversionRateOppToWon: 0,
      costPerLead: null,
      costPerQualifiedLead: null,
      costPerOpportunity: null,
      costPerWonDeal: null,
      roas: null,
      roiPct: null
    };

    const enrichedRows = rows.map((r: any) => {
      const c = r.toJSON();
      const metrics = perfMap.get(c.id) || defaultMetrics;
      return {
        ...c,
        metrics,
        totalLeads: metrics.totalLeads,
        qualifiedLeads: metrics.qualifiedLeads,
        totalOpportunities: metrics.totalOpportunities,
        wonDealsCount: metrics.wonDealsCount,
        wonOrdersCount: metrics.wonOrdersCount,
        totalRevenue: metrics.totalRevenue,
        roas: metrics.roas,
        roiPct: metrics.roiPct
      };
    });

    res.json({
      data: enrichedRows,
      page: Number(page),
      limit: Number(limit),
      total: count,
      totalPages: Math.ceil(count / Number(limit))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportCampaigns = async (req: Request, res: Response) => {
  try {
    const { status, channel, search } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (search) {
      const likeOp = sequelize.getDialect() === "sqlite" ? Op.like : Op.iLike;
      where[Op.or] = [
        { name: { [likeOp]: `%${search}%` } },
        { code: { [likeOp]: `%${search}%` } },
        { description: { [likeOp]: `%${search}%` } }
      ];
    }

    const campaigns = await sequelize.models.Campaign.findAll({
      where,
      order: [["createdAt", "DESC"]]
    });

    // Reuse getCampaignPerformance for metrics to prevent duplicate funnel math
    const allPerformance = await getCampaignPerformance();
    const perfMap = new Map<string, any>();
    if (Array.isArray(allPerformance)) {
      for (const p of allPerformance) {
        if (p.campaign?.id) {
          perfMap.set(p.campaign.id, p.metrics);
        }
      }
    }

    const headers = [
      "name",
      "code",
      "channel",
      "platform",
      "status",
      "startDate",
      "endDate",
      "currency",
      "budget",
      "actualSpend",
      "totalLeads",
      "qualifiedLeads",
      "totalOpportunities",
      "wonOrdersCount",
      "totalRevenue",
      "costPerLead",
      "costPerWonDeal",
      "roas",
      "roiPct"
    ];

    const rows = campaigns.map((c: any) => {
      const metrics = perfMap.get(c.id) || {};
      return [
        c.name || "",
        c.code || "",
        c.channel || "",
        c.platform || "",
        c.status || "",
        c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
        c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
        c.currency || "INR",
        c.budget !== null && c.budget !== undefined ? Number(c.budget) : 0,
        c.actualSpend !== null && c.actualSpend !== undefined ? Number(c.actualSpend) : "",
        metrics.totalLeads ?? 0,
        metrics.qualifiedLeads ?? 0,
        metrics.totalOpportunities ?? 0,
        metrics.wonOrdersCount ?? 0,
        metrics.totalRevenue ?? 0,
        metrics.costPerLead !== null && metrics.costPerLead !== undefined ? metrics.costPerLead : "",
        metrics.costPerWonDeal !== null && metrics.costPerWonDeal !== undefined ? metrics.costPerWonDeal : "",
        metrics.roas !== null && metrics.roas !== undefined ? metrics.roas : "",
        metrics.roiPct !== null && metrics.roiPct !== undefined ? metrics.roiPct : ""
      ];
    });

    const csvContent = generateCsv(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="campaigns_export_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportCampaignLeads = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaign = await sequelize.models.Campaign.findByPk(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const leads = await sequelize.models.Lead.findAll({
      where: { campaignId: String(id) },
      order: [["createdAt", "DESC"]],
      include: [
        { model: sequelize.models.CampaignAd, as: "ad" },
        { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email"] }
      ]
    });

    const headers = [
      "leadNumber",
      "name",
      "company",
      "email",
      "phone",
      "status",
      "assignedTo",
      "ad",
      "createdAt"
    ];

    const rows = leads.map((l: any) => {
      const fullName = `${l.firstName || ""} ${l.lastName || ""}`.trim();
      const assigned = l.assignedTo ? `${l.assignedTo.name || ""} (${l.assignedTo.email || ""})`.trim() : "";
      const adName = l.ad ? (l.ad.name || l.ad.externalId || "") : "";
      const createdAt = l.createdAt ? new Date(l.createdAt).toISOString() : "";

      return [
        l.leadNumber || "",
        fullName,
        l.company || "",
        l.email || "",
        l.phone || "",
        l.status || "",
        assigned,
        adName,
        createdAt
      ];
    });

    const csvContent = generateCsv(headers, rows);
    const safeCode = ((campaign as any).code || id).replace(/[^a-zA-Z0-9-_]/g, "_");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="campaign_${safeCode}_leads.csv"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignTimeseries = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { granularity = "day" } = req.query;
    const validGranularity = granularity === "week" ? "week" : "day";

    const campaign = await sequelize.models.Campaign.findByPk(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const { Lead, Deal, Quote, PurchaseOrder } = sequelize.models;

    // Fetch Leads created for this campaign
    const leads = await Lead.findAll({
      where: { campaignId: String(id) },
      attributes: ["id", "createdAt"]
    });

    // Fetch Deals / Opportunities created for this campaign
    const deals = await Deal.findAll({
      where: { campaignId: String(id) },
      attributes: ["id", "createdAt"]
    });

    // Fetch Won Orders for these deals
    const dealIds = deals.map((d: any) => d.id);
    let orders: any[] = [];
    if (dealIds.length > 0) {
      orders = await PurchaseOrder.findAll({
        attributes: ["id", "createdAt", "generatedDate"],
        include: [
          {
            model: Quote,
            as: "quote",
            where: { dealId: { [Op.in]: dealIds } },
            attributes: ["id", "dealId"]
          }
        ]
      });
    }

    const events: TimeseriesEvent[] = [];

    leads.forEach((l: any) => {
      if (l.createdAt) events.push({ date: l.createdAt, type: "lead" });
    });

    deals.forEach((d: any) => {
      if (d.createdAt) events.push({ date: d.createdAt, type: "opportunity" });
    });

    orders.forEach((o: any) => {
      const orderDate = o.createdAt || o.generatedDate;
      if (orderDate) events.push({ date: orderDate, type: "wonOrder" });
    });

    const timeseries = fillTimeseriesGaps(
      events,
      validGranularity,
      (campaign as any).startDate,
      (campaign as any).endDate
    );

    res.json({
      campaignId: id,
      granularity: validGranularity,
      totalEvents: events.length,
      data: timeseries
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

    const trimmedCode = String(code).trim().toUpperCase();
    if (!/^[A-Za-z0-9-]+$/.test(trimmedCode)) {
      return res.status(400).json({ error: "Campaign code may only contain uppercase letters, numbers, and hyphens." });
    }
    if (trimmedCode.length < 2 || trimmedCode.length > 50) {
      return res.status(400).json({ error: "Campaign code must be between 2 and 50 characters." });
    }

    const existing = await sequelize.models.Campaign.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("code")),
        trimmedCode.toLowerCase()
      )
    });
    if (existing) {
      return res.status(409).json({ error: `Campaign with code '${code}' already exists.` });
    }

    const campaign = await sequelize.models.Campaign.create({
      id: crypto.randomUUID(),
      name,
      code: trimmedCode,
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
      const trimmedCode = String(req.body.code).trim().toUpperCase();
      if (!/^[A-Za-z0-9-]+$/.test(trimmedCode)) {
        return res.status(400).json({ error: "Campaign code may only contain uppercase letters, numbers, and hyphens." });
      }
      if (trimmedCode.length < 2 || trimmedCode.length > 50) {
        return res.status(400).json({ error: "Campaign code must be between 2 and 50 characters." });
      }

      const duplicate = await sequelize.models.Campaign.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("code")),
              trimmedCode.toLowerCase()
            ),
            { id: { [Op.ne]: String(id) } }
          ]
        }
      });
      if (duplicate) {
        return res.status(409).json({ error: `Campaign code '${req.body.code}' is already in use.` });
      }
      req.body.code = trimmedCode;
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

export const updateCampaignAd = async (req: Request, res: Response) => {
  try {
    const { id, adId } = req.params;
    const targetAdId = adId || id;
    const where: any = { id: String(targetAdId) };
    if (adId && id) {
      where.campaignId = String(id);
    }

    const ad = await sequelize.models.CampaignAd.findOne({ where });
    if (!ad) {
      return res.status(404).json({ error: "Campaign Ad not found" });
    }

    if (req.body.externalId && req.body.externalId !== (ad as any).externalId) {
      const campaignId = (ad as any).campaignId;
      const existing = await sequelize.models.CampaignAd.findOne({
        where: { campaignId, externalId: req.body.externalId }
      });
      if (existing) {
        return res.status(409).json({ error: `Ad with external ID '${req.body.externalId}' already exists in this campaign.` });
      }
    }

    await ad.update(req.body);
    res.json(ad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCampaignAd = async (req: Request, res: Response) => {
  try {
    const { id, adId } = req.params;
    const targetAdId = adId || id;
    const where: any = { id: String(targetAdId) };
    if (adId && id) {
      where.campaignId = String(id);
    }

    const ad = await sequelize.models.CampaignAd.findOne({ where });
    if (!ad) {
      return res.status(404).json({ error: "Campaign Ad not found" });
    }

    await ad.destroy();
    res.json({ message: "Campaign Ad deleted successfully" });
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
