import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { sendWhatsAppMessage } from "../services/whatsappService";

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { leadId, text } = req.body;
    if (!leadId || !text) {
      return res.status(400).json({ error: "leadId and text are required" });
    }

    const lead = await sequelize.models.Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const l = lead as any;
    if (!l.phone) {
      return res.status(400).json({ error: "Lead has no phone number" });
    }

    // Call service to send message
    await sendWhatsAppMessage(l.phone, text);

    // Log the activity
    await sequelize.models.Activity.create({
      id: require('crypto').randomUUID(),
      leadId: l.id,
      type: "whatsapp_sms",
      notes: `Sent outbound WhatsApp: "${text}"`,
      outcome: "message sent"
    } as any);

    res.status(200).json({ success: true, message: "WhatsApp message sent" });
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    res.status(500).json({ error: error.message });
  }
};

export const verifyWebhook = (req: Request, res: Response) => {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send("Missing hub.mode or hub.verify_token");
  }
};

export const handleIncomingWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
        const from = body.entry[0].changes[0].value.messages[0].from; // sender phone number
        const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // text message
        
        console.log(`Incoming WhatsApp from ${from}: ${msg_body}`);

        // Try to find an existing Lead with this phone number
        const { Op } = require("sequelize");
        // Remove formatting from the incoming 'from' which is typically numerical (e.g. 15551234567)
        // We'll search for leads where phone like '%from%' as a simple heuristic
        const lead = await sequelize.models.Lead.findOne({
          where: {
            phone: { [Op.like]: `%${from.slice(-10)}%` } // match last 10 digits as a fallback
          }
        });

        let leadId = null;

        if (lead) {
          leadId = (lead as any).id;
        } else {
          // Create a new lead as discussed in the implementation plan
          const newLead = await sequelize.models.Lead.create({
            id: require('crypto').randomUUID(),
            firstName: "Unknown",
            lastName: "WhatsApp Lead",
            email: `unknown-${from}@whatsapp.local`, // email is required
            phone: from,
            source: "whatsapp",
            status: "New Lead"
          });
          leadId = (newLead as any).id;
          console.log(`Created new lead for unmatched phone number ${from}`);
        }

        // Log the activity
        await sequelize.models.Activity.create({
          id: require('crypto').randomUUID(),
          leadId: leadId,
          type: "whatsapp_sms",
          notes: `Received WhatsApp reply: "${msg_body}"`,
          outcome: "message received"
        } as any);
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("Error handling WhatsApp webhook:", error);
    // Return a 200 anyway so Meta doesn't aggressively retry
    res.sendStatus(200);
  }
};
