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

    let sendStatus = status;
    let sendErrorMsg = "";

    if (status === "Sent" && toEmail) {
      try {
        const { sendEmail, getBaseHtmlTemplate } = require("../services/emailService");
        const html = getBaseHtmlTemplate(body, leadId);
        const info = await sendEmail(toEmail, subject, html);
        if (!info) {
           sendStatus = "Failed";
           sendErrorMsg = "Mailgun API returned null (timed out or auth failed)";
        }
      } catch (sendErr: any) {
        console.warn("Failed to dispatch email via transporter:", sendErr);
        sendStatus = "Failed";
        sendErrorMsg = sendErr.message || String(sendErr);
      }
    }

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "email",
        outcome: `Email ${sendStatus}: ${subject}`,
        notes: sendErrorMsg ? `ERROR: ${sendErrorMsg}\n\n${body.substring(0, 150)}` : body.substring(0, 150),
        createdById: (req as any).user?.id || null,
        direction: "outbound"
      });
    }

    if (sendStatus === "Failed") {
      return res.status(500).json({ error: "Failed to send email. Check Mailgun API credentials.", details: sendErrorMsg });
    }

    res.status(201).json(message);
  } catch (error: any) {
    console.error("Error sending email message:", error);
    res.status(500).json({ error: error.message });
  }
};
