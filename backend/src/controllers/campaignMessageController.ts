import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import {
  computeAudience,
  computeWhatsAppAudience,
  getCampaignMessageConfig,
  getCampaignWhatsAppConfig,
  maskPhone,
  handleTrackingPixel,
  getMessageStats,
  executeMessageSend,
  cancelMessage
} from "../services/campaignMessageService";

const validateAudienceFilterCampaigns = async (
  filterInput: any,
  currentCampaignId?: string
): Promise<{ valid: boolean; error?: string }> => {
  if (!filterInput) return { valid: true };

  let filter: any = filterInput;
  if (typeof filter === "string") {
    try {
      filter = JSON.parse(filter);
    } catch {
      return { valid: true };
    }
  }

  if (filter && typeof filter === "object" && "includeFromCampaignIds" in filter) {
    if (!Array.isArray(filter.includeFromCampaignIds)) {
      return { valid: false, error: "includeFromCampaignIds must be an array of campaign IDs" };
    }
    const ids: string[] = filter.includeFromCampaignIds;
    for (const id of ids) {
      if (typeof id !== "string" || !id.trim()) {
        return { valid: false, error: "All campaign IDs in includeFromCampaignIds must be non-empty strings" };
      }
    }
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim())));
    if (uniqueIds.length > 0) {
      const existingCampaigns = await sequelize.models.Campaign.findAll({
        where: { id: { [Op.in]: uniqueIds } },
        attributes: ["id"]
      });
      const foundIds = new Set(existingCampaigns.map((c: any) => c.id));
      if (currentCampaignId) {
        foundIds.add(currentCampaignId);
      }
      const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        return {
          valid: false,
          error: `Campaign not found in includeFromCampaignIds: ${missingIds.join(", ")}`
        };
      }
    }
  }

  return { valid: true };
};

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const getCampaignMessageConfigHandler = async (req: Request, res: Response) => {
  try {
    const emailConfig = getCampaignMessageConfig();
    const whatsappConfig = getCampaignWhatsAppConfig();
    res.json({
      dryRun: emailConfig.dryRun,
      maxRecipients: emailConfig.maxRecipients,
      allowlistActive: emailConfig.allowlistActive,
      email: {
        dryRun: emailConfig.dryRun,
        maxRecipients: emailConfig.maxRecipients,
        allowlistActive: emailConfig.allowlistActive
      },
      whatsapp: {
        dryRun: whatsappConfig.dryRun,
        maxRecipients: whatsappConfig.maxRecipients,
        allowlistActive: whatsappConfig.allowlistActive,
        batchSize: whatsappConfig.batchSize,
        batchDelayMs: whatsappConfig.batchDelayMs
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignMessages = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);

    // Validate campaign existence
    const campaign = await sequelize.models.Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const messages = (await sequelize.models.CampaignMessage.findAll({
      where: { campaignId },
      order: [["createdAt", "DESC"]]
    })) as any[];

    const results = await Promise.all(
      messages.map(async (msg) => {
        const stats = await getMessageStats(msg.id);
        return {
          ...msg.toJSON(),
          stats
        };
      })
    );

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignMessageById = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);

    const message = (await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    })) as any;

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const stats = await getMessageStats(message.id);
    res.json({
      ...message.toJSON(),
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignMessageStatsHandler = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);

    const message = await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const stats = await getMessageStats(messageId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCampaignMessage = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const {
      name,
      subject,
      bodyHtml,
      audienceFilter,
      scheduledAt,
      channel = "EMAIL",
      templateSid,
      templateVariables
    } = req.body;
    const caller = (req as any).user;

    const normalizedChannel = String(channel).toUpperCase();
    if (normalizedChannel !== "EMAIL" && normalizedChannel !== "WHATSAPP") {
      return res.status(400).json({ error: "Channel must be EMAIL or WHATSAPP" });
    }

    if (!name) {
      return res.status(400).json({ error: "Message name is required" });
    }

    if (normalizedChannel === "WHATSAPP") {
      if (!templateSid) {
        return res.status(400).json({ error: "WhatsApp campaign messages require an approved templateSid" });
      }
    } else {
      if (!subject || !bodyHtml) {
        return res.status(400).json({ error: "Name, subject, and body HTML are required for Email messages" });
      }
    }

    const campaign = await sequelize.models.Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const validation = await validateAudienceFilterCampaigns(audienceFilter, campaignId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const filterString =
      typeof audienceFilter === "object" ? JSON.stringify(audienceFilter) : audienceFilter || null;

    const templateVarsString =
      typeof templateVariables === "object"
        ? JSON.stringify(templateVariables)
        : templateVariables || null;

    const message: any = await sequelize.models.CampaignMessage.create({
      id: crypto.randomUUID(),
      campaignId,
      name,
      channel: normalizedChannel,
      templateSid: normalizedChannel === "WHATSAPP" ? templateSid : null,
      templateVariables: normalizedChannel === "WHATSAPP" ? templateVarsString : null,
      subject: subject || (normalizedChannel === "WHATSAPP" ? templateSid : ""),
      bodyHtml: bodyHtml || "",
      audienceFilter: filterString,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: caller?.id || null
    });

    const stats = await getMessageStats(message.id);
    res.status(201).json({
      ...message.toJSON(),
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCampaignMessage = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);
    const { name, subject, bodyHtml, audienceFilter, scheduledAt, templateSid, templateVariables } = req.body;

    const message = (await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    })) as any;

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const editableStatuses = ["DRAFT", "SCHEDULED", "PARTIAL", "FAILED"];
    if (!editableStatuses.includes(message.status)) {
      return res.status(400).json({ error: `Cannot edit message in ${message.status} status` });
    }

    if (name !== undefined) message.name = name;
    if (subject !== undefined) message.subject = subject;
    if (bodyHtml !== undefined) message.bodyHtml = bodyHtml;
    if (templateSid !== undefined) message.templateSid = templateSid;
    if (templateVariables !== undefined) {
      message.templateVariables =
        typeof templateVariables === "object" ? JSON.stringify(templateVariables) : templateVariables;
    }
    if (audienceFilter !== undefined) {
      const validation = await validateAudienceFilterCampaigns(audienceFilter, campaignId);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      message.audienceFilter =
        typeof audienceFilter === "object" ? JSON.stringify(audienceFilter) : audienceFilter;
    }
    if (scheduledAt !== undefined) {
      message.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      message.status = scheduledAt ? "SCHEDULED" : "DRAFT";
    }

    await message.save();

    const stats = await getMessageStats(message.id);
    res.json({
      ...message.toJSON(),
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCampaignMessage = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);

    const message = (await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    })) as any;

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    if (message.status !== "DRAFT" && message.status !== "CANCELLED") {
      return res.status(400).json({ error: "Only DRAFT or CANCELLED messages can be deleted" });
    }

    await message.destroy();
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const previewAudience = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = req.params.messageId ? String(req.params.messageId) : undefined;
    let filter = req.body?.audienceFilter;
    let channel = req.body?.channel ? String(req.body.channel).toUpperCase() : undefined;

    // Validate campaign exists
    const campaign = await sequelize.models.Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (messageId && messageId !== "draft") {
      const message = (await sequelize.models.CampaignMessage.findOne({
        where: { id: messageId, campaignId }
      })) as any;
      if (!message) {
        return res.status(404).json({ error: "Message not found in this campaign" });
      }
      if (!channel) {
        channel = (message.channel || "EMAIL").toUpperCase();
      }
      if (!filter && message.audienceFilter) {
        try {
          filter = JSON.parse(message.audienceFilter);
        } catch {
          filter = message.audienceFilter;
        }
      }
    }

    const validation = await validateAudienceFilterCampaigns(filter, campaignId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    channel = channel || "EMAIL";

    if (channel === "WHATSAPP") {
      const { eligibleLeads, excludedCount, excludedByReason } = await computeWhatsAppAudience(
        campaignId,
        filter
      );

      const sample = eligibleLeads.slice(0, 10).map((l: any) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: maskPhone(l.phone),
        company: l.company,
        leadScore: l.leadScore,
        status: l.status,
        country: l.country || l.territory || null,
        industry: l.industry || null
      }));

      return res.json({
        channel: "WHATSAPP",
        eligibleCount: eligibleLeads.length,
        excludedCount,
        excludedByReason,
        sample
      });
    }

    // Default: EMAIL
    const { eligibleLeads, excludedCount, excludedByReason } = await computeAudience(
      campaignId,
      filter
    );

    const sample = eligibleLeads.slice(0, 10).map((l: any) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      company: l.company,
      leadScore: l.leadScore,
      status: l.status,
      country: l.country || l.territory || null,
      industry: l.industry || null
    }));

    return res.json({
      channel: "EMAIL",
      eligibleCount: eligibleLeads.length,
      excludedCount,
      excludedByReason,
      sample
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendCampaignMessage = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);
    const { confirm } = req.body;

    // Strict validation: reject unless confirm === true
    if (confirm !== true) {
      return res.status(400).json({ error: "Explicit confirmation (confirm: true) is required to send campaign emails" });
    }

    const message = (await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    })) as any;

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const allowedStatuses = ["DRAFT", "SCHEDULED"];
    if (!allowedStatuses.includes(message.status)) {
      return res.status(400).json({ error: `Only messages in DRAFT or SCHEDULED status can be sent (current: ${message.status})` });
    }

    const { scheduledAt } = req.body;
    if (scheduledAt !== undefined && scheduledAt !== null && scheduledAt !== "") {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: "Invalid scheduled date format" });
      }

      const now = new Date();
      if (scheduledDate.getTime() <= now.getTime()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }

      const maxFutureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      if (scheduledDate.getTime() > maxFutureDate.getTime()) {
        return res.status(400).json({ error: "Scheduled time cannot be more than 90 days in the future" });
      }

      message.scheduledAt = scheduledDate;
      message.status = "SCHEDULED";
      await message.save();

      const stats = await getMessageStats(message.id);
      return res.status(200).json({
        message: "Message scheduled successfully",
        ...message.toJSON(),
        stats
      });
    }

    const result = await executeMessageSend(campaignId, messageId, { confirm: true });
    res.status(202).json({
      message: "Sending started",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const unscheduleCampaignMessageHandler = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);

    const { unscheduleMessage } = require("../services/campaignMessageService");
    const result = await unscheduleMessage(campaignId, messageId);

    res.json({
      message: "Message unscheduled successfully",
      campaignMessage: result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const resumeCampaignMessage = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({ error: "Explicit confirmation (confirm: true) is required to resume campaign emails" });
    }

    const message = (await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    })) as any;

    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const allowedStatuses = ["PARTIAL", "FAILED"];
    if (!allowedStatuses.includes(message.status)) {
      return res.status(400).json({ error: `Only messages in PARTIAL or FAILED status can be resumed (current: ${message.status})` });
    }

    const { resumeMessageSend } = require("../services/campaignMessageService");
    const result = await resumeMessageSend(campaignId, messageId, { confirm: true });
    res.status(202).json({
      message: "Resuming send delivery",
      ...result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


export const getCampaignMessageRecipients = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);
    const { page = 1, limit = 50, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Validate message belongs to campaign
    const message = await sequelize.models.CampaignMessage.findOne({
      where: { id: messageId, campaignId }
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found in this campaign" });
    }

    const where: any = { campaignMessageId: messageId };
    if (status && status !== "ALL") {
      where.status = status;
    }

    const { count, rows } = await sequelize.models.CampaignRecipient.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "ASC"]]
    });

    res.json({
      total: count,
      page: Number(page),
      limit: Number(limit),
      recipients: rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const cancelCampaignMessageHandler = async (req: Request, res: Response) => {
  try {
    const campaignId = String(req.params.id);
    const messageId = String(req.params.messageId);
    const message = await cancelMessage(campaignId, messageId);
    res.json({
      message: "Message cancelled",
      campaignMessage: message
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const trackPixel = async (req: Request, res: Response) => {
  try {
    const recipientId = req.params.recipientId ? String(req.params.recipientId) : "";
    if (recipientId) {
      await handleTrackingPixel(recipientId);
    }
  } catch (error) {
    console.error("[CampaignMessageController] Error handling tracking pixel:", error);
  } finally {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).send(TRANSPARENT_GIF_BUFFER);
  }
};
