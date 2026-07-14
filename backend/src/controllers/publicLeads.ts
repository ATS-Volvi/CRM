import { Request, Response } from "express";
import { ingestLead } from "../services/leadIngestion";
import { triggerTemplatedEmail } from "../services/emailService";

export const createPublicLead = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, company, message, source, sourceDetail, campaign, industry, rawPayload } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    const leadId = await ingestLead({
      firstName,
      lastName,
      email,
      phone,
      company,
      source: source || "Website",
      sourceDetail: sourceDetail || "Public Form Capture",
      campaign: campaign || "Organic Search",
      industry,
      message,
      rawPayload: rawPayload || req.body
    });

    // 1. LEAD ACKNOWLEDGEMENT AUTOMATION
    if (email) {
      const slaHours = process.env.LEAD_RESPONSE_SLA_HOURS || "24";
      triggerTemplatedEmail("lead_acknowledgement", email, { 
        lead_name: firstName, 
        sla_hours: slaHours 
      }, leadId).catch(err => console.error("Email send failed:", err));
    }

    res.status(201).json({ success: true, leadId });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: error.message || "Failed to create lead" });
  }
};
