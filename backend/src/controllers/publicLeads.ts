import { Request, Response } from "express";
import { ingestLead } from "../services/leadIngestion";
import { triggerTemplatedEmail } from "../services/emailService";

export const createPublicLead = async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      message,
      source,
      sourceType,
      sourceChannel,
      sourceName,
      sourceDetail,
      referringAccountId,
      campaign,
      campaignCode,
      campaignId,
      adId,
      adName,
      landingPage,
      landing_page,
      referrer,
      utmSource,
      utm_source,
      utmMedium,
      utm_medium,
      utmCampaign,
      utm_campaign,
      utmTerm,
      utm_term,
      utmContent,
      utm_content,
      clickId,
      click_id,
      industry,
      budgetRange,
      rawPayload
    } = req.body;

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
      sourceType,
      sourceChannel,
      sourceName,
      sourceDetail: sourceDetail || "Public Form Capture",
      referringAccountId,
      campaign: campaign || utm_campaign || utmCampaign,
      campaignCode,
      campaignId,
      adId,
      adName,
      landingPage: landingPage || landing_page,
      referrer,
      utmSource: utmSource || utm_source,
      utmMedium: utmMedium || utm_medium,
      utmCampaign: utmCampaign || utm_campaign,
      utmTerm: utmTerm || utm_term,
      utmContent: utmContent || utm_content,
      clickId: clickId || click_id,
      industry,
      message,
      budgetRange,
      rawPayload: rawPayload || req.body
    });

    // Run Automated Lead Intake & Missing Information Collection Engine
    try {
      const { processInboundIntakeEvent } = require("../services/leadIntakeAutomationEngine");
      await processInboundIntakeEvent({
        channel: "website",
        leadId,
        senderEmail: email,
        senderName: `${firstName} ${lastName}`.trim(),
        senderPhone: phone,
        message: message,
        formData: {
          firstName,
          lastName,
          company,
          email,
          phone,
          requirement: message
        },
        attribution: {
          source: source || "Website",
          sourceType,
          sourceChannel: sourceChannel || "website",
          sourceName,
          sourceDetail: sourceDetail || "Public Form Capture",
          campaign: campaign || utm_campaign || utmCampaign,
          utmSource: utmSource || utm_source,
          utmMedium: utmMedium || utm_medium,
          utmCampaign: utmCampaign || utm_campaign,
          referrer,
          landingPage: landingPage || landing_page
        }
      });
    } catch (intakeErr: any) {
      console.warn("Non-blocking lead intake automation error in publicLeads:", intakeErr.message);
    }

    // 1. LEAD ACKNOWLEDGEMENT AUTOMATION
    if (email) {
      const slaHours = process.env.LEAD_RESPONSE_SLA_HOURS || "24";
      try {
        await triggerTemplatedEmail("lead_acknowledgement", email, { 
          lead_name: firstName, 
          sla_hours: slaHours 
        }, leadId);
      } catch (err: any) {
        console.warn("Non-blocking lead acknowledgement email automation failed:", err.message || err);
      }
    }

    res.status(201).json({ success: true, leadId });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: error.message || "Failed to create lead" });
  }
};
