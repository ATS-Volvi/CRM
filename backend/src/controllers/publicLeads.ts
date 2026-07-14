import { Request, Response } from "express";
import { ingestLead } from "../services/leadIngestion";

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

    res.status(201).json({ success: true, leadId });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: error.message || "Failed to create lead" });
  }
};
