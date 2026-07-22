import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getEmailMessages = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;

    const emails = await sequelize.models.EmailMessage.findAll({
      where,
      include: [{ model: sequelize.models.User, as: "sender", attributes: ["id", "name", "email"] }],
      order: [["createdAt", "DESC"]]
    });
    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendEmailMessage = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, toEmail, subject, body, scheduledAt } = req.body;
    const status = scheduledAt ? "Scheduled" : "Sent";
    const message = await sequelize.models.EmailMessage.create({
      id: require("crypto").randomUUID(),
      leadId: leadId || null,
      customerId: customerId || null,
      senderId: (req as any).user?.id || null,
      toEmail,
      subject,
      body,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      openedAt: status === "Sent" ? new Date() : null
    });

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "Email",
        title: `Email ${status}: ${subject}`,
        notes: body.substring(0, 150),
        createdById: (req as any).user?.id || null
      });
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
