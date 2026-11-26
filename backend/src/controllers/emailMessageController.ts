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
    let { leadId, customerId, opportunityId, dealId, toEmail, subject, body, scheduledAt } = req.body;
    const targetDealId = opportunityId || dealId;

    if (targetDealId && (!leadId || !customerId)) {
      const d: any = await sequelize.models.Deal.findByPk(targetDealId);
      if (d) {
        if (!leadId) leadId = d.leadId;
        if (!customerId) customerId = d.accountId || d.customerId;
      }
    }

    const initialStatus = scheduledAt ? "Scheduled" : "Sent";
    const senderId = (req as any).user?.id || null;

    const message = await sequelize.models.EmailMessage.create({
      id: require("crypto").randomUUID(),
      leadId: leadId || null,
      customerId: customerId || null,
      senderId,
      toEmail,
      subject,
      body,
      status: initialStatus,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      openedAt: null
    });

    let activityRecord: any = null;
    if (leadId || customerId || targetDealId) {
      activityRecord = await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId: leadId || null,
        customerId: customerId || null,
        type: "email",
        outcome: `Email Sent: ${subject}`,
        notes: body.substring(0, 500),
        createdById: senderId,
        direction: "outbound"
      });
    }

    // Fast-acknowledgement: Return 201 Created immediately so rep/UI is never blocked
    res.status(201).json(message);

    // Asynchronously dispatch via pooled SMTP in the background
    if (!scheduledAt && toEmail) {
      setImmediate(async () => {
        try {
          const { sendEmail, getBaseHtmlTemplate } = require("../services/emailService");
          const html = getBaseHtmlTemplate(body, leadId);
          const info = await sendEmail(toEmail, subject, html);

          if (!info) {
            throw new Error("Transporter returned empty response");
          }

          if (leadId) {
            try {
              const { checkAndAutoAdvanceLead } = require("../services/leadStageAutomationService");
              await checkAndAutoAdvanceLead(leadId, { userId: senderId });
            } catch (stageErr) {
              console.warn("[Email Message] Stage auto-advance notice:", stageErr);
            }
          }
        } catch (sendErr: any) {
          console.error("Failed to dispatch email in background:", sendErr);
          const errorMsg = sendErr.message || String(sendErr);
          try {
            await message.update({ status: "Failed" });
            if (activityRecord) {
              await activityRecord.update({
                outcome: `Email Failed: ${subject}`,
                notes: `ERROR: ${errorMsg}\n\n${body.substring(0, 150)}`
              });
            }
            if (senderId) {
              const { createNotification } = require("../services/notificationService");
              await createNotification(
                senderId,
                "Email Delivery Notice",
                `Email to ${toEmail} encountered an issue: ${errorMsg}`,
                "warning"
              );
            }
          } catch (updateErr) {
            console.error("Failed to update message failure state:", updateErr);
          }
        }
      });
    }
  } catch (error: any) {
    console.error("Error sending email message:", error);
    res.status(500).json({ error: error.message });
  }
};
