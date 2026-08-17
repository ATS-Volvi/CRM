import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { assignDeal } from "./assignmentEngine";
import { createNotification } from "./notificationService";
import { handleDealInboundActivity } from "./leadTemperatureService";
import { triggerLeadAssignedNotifications } from "./notificationEngine";

import { recordLeadTouch } from "./attributionService";

function isDummyKey(val?: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase();
  return lower.includes("your_") || lower.includes("change_me") || lower.includes("test_user") || lower.includes("mock_");
}

export interface LeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  sourceType?: string;
  sourceChannel?: string;
  sourceName?: string;
  sourceDetail?: string;
  sourceEntityId?: string;
  referringAccountId?: string;
  campaign?: string;
  campaignCode?: string;
  campaignId?: string;
  adId?: string;
  adName?: string;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  clickId?: string;
  industry?: string;
  message?: string;
  assignedToId?: string;
  rawPayload?: any;
  budgetRange?: string;
  categoriesData?: any;
}

/**
 * Normalizes input lead data, runs duplicate detection and lead scoring,
 * assigns the lead using the assignment engine, and persists the lead.
 */
export async function ingestLead(payload: LeadPayload) {
  try {
    const email = payload.email?.trim().toLowerCase() || "";
    let companyName = payload.company?.trim() || "";

    if (!payload.firstName || !payload.lastName || !email) {
      throw new Error("First name, last name, and email are required for ingestion");
    }

    if (!companyName) {
      companyName = `${payload.firstName} ${payload.lastName}`;
    }

    const { Lead, Account, Contact, Activity } = sequelize.models;

    // 1. Account Lookup or Link (if existing company found)
    let account = await Account.findOne({
      where: { name: { [Op.like]: companyName } }
    });

    // 2. Contact Lookup (if existing contact found)
    let contact = await Contact.findOne({
      where: { email: { [Op.like]: email } }
    });

    // 3. Lead Scoring
    let leadScore = 50; // base score
    if (email && !email.endsWith("@gmail.com") && !email.endsWith("@yahoo.com") && !email.endsWith("@hotmail.com") && !email.endsWith("@outlook.com")) {
      leadScore += 15; // Corporate email bonus
    }
    if (payload.phone) leadScore += 10;
    if (payload.company) leadScore += 10;
    if (payload.message && payload.message.length > 10) leadScore += 15;
    if (payload.source === "LinkedIn" || payload.source === "LinkedIn Ads") leadScore += 10;
    if (leadScore > 100) leadScore = 100;

    // 4. Lead Assignment
    let assignedToId = payload.assignedToId || await assignDeal({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      company: companyName,
      source: payload.source,
      industry: payload.industry
    });

    if (!assignedToId) {
      assignedToId = await getFirstAdminId();
    }

<<<<<<< HEAD
    // 5. Create Lead for dual-compatibility (Live Queue & Lead Detail screens)
    const { Lead } = sequelize.models;
    let leadRecord: any = null;
    const leadId = crypto.randomUUID();

    if (Lead) {
      try {
        leadRecord = await Lead.create({
          id: leadId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: email,
          phone: payload.phone || null,
          company: companyName,
          industry: payload.industry || null,
          source: payload.source || 'Website',
          sourceDetail: payload.sourceDetail || null,
          campaign: payload.campaign || null,
          budgetRange: payload.budgetRange || null,
          status: 'New',
          leadScore: leadScore,
          assignedToId: assignedToId,
          customerId: (account as any).id,
          body: payload.message || null,
          rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : null
        });
      } catch (leadErr) {
        console.warn("Lead dual-write note:", leadErr);
      }
    }

    // 6. Create Deal
    const dealId = crypto.randomUUID();
    const dealName = `${companyName} - ${payload.firstName} Opportunity`;

    const newDeal = await Deal.create({
      id: dealId,
      accountId: (account as any).id,
      leadId: leadRecord ? leadRecord.id : null,
      customerId: (account as any).id,
      name: dealName,
      status: "New",
      amount: 0,
      assignedToId: assignedToId,
      leadScore: leadScore,
      source: payload.source || 'Website',
      sourceDetail: payload.sourceDetail || null,
      campaign: payload.campaign || null,
      budgetRange: payload.budgetRange || null,
      categoriesData: payload.categoriesData || null,
      rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : null
    });

    // 7. Link Contact to Deal
    await DealContact.create({
      id: crypto.randomUUID(),
      dealId: dealId,
      contactId: (contact as any).id,
      role: 'Initiator',
      isPrimary: true
    });
=======
    // 5. Generate Collision-Proof Unique Lead Number with Concurrent Retry Protection
    const year = new Date().getFullYear();
    const leadId = crypto.randomUUID();

    let newLead: any = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!newLead && attempts < maxAttempts) {
      attempts++;
      const count = await Lead.count();
      const randomEntropy = Math.floor(1000 + Math.random() * 9000);
      const timeMs = Date.now().toString().slice(-4);
      // Format: LD-YYYY-XXXXX or LD-YYYY-XXXXX-RRRR if high concurrency
      const leadNumber = attempts === 1
        ? `LD-${year}-${String(count + attempts).padStart(5, '0')}-${randomEntropy}`
        : `LD-${year}-${timeMs}-${randomEntropy}`;
>>>>>>> 8c31a7e (feat: complete CRM architecture and UI redesign (Phases 1-6))

      try {
        newLead = await Lead.create({
          id: leadId,
          leadNumber,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: email,
          phone: payload.phone || null,
          company: companyName,
          source: payload.source || 'Website',
          sourceDetail: payload.sourceDetail || null,
          campaign: payload.campaign || null,
          industry: payload.industry || null,
          body: payload.message || null,
          status: "NEW",
          assignedToId: assignedToId,
          accountId: account ? (account as any).id : null,
          customerId: account ? (account as any).id : null,
          leadScore: leadScore,
          budgetRange: payload.budgetRange || null,
          nextAction: "Reply to Lead",
          nextActionDue: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h SLA
          rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : null
        });
      } catch (err: any) {
        if (err.name === 'SequelizeUniqueConstraintError' && attempts < maxAttempts) {
          // Jittered backoff to avoid thundering herd on concurrent connector runs
          await new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 20));
          continue;
        }
        throw err;
      }
    }

    if (!newLead) {
      throw new Error("Failed to generate a unique lead record after maximum attempts.");
    }

    // 5b. Record Attribution Touch & Multi-Touch History
    try {
      await recordLeadTouch({
        leadId: newLead.id,
        channel: payload.sourceChannel || payload.source || "Website",
        source: payload.source,
        sourceType: payload.sourceType,
        sourceName: payload.sourceName || payload.sourceDetail,
        sourceEntityId: payload.sourceEntityId,
        referringAccountId: payload.referringAccountId,
        campaign: payload.campaign,
        campaignCode: payload.campaignCode,
        campaignId: payload.campaignId,
        adId: payload.adId,
        adName: payload.adName,
        landingPage: payload.landingPage,
        referrer: payload.referrer,
        utmSource: payload.utmSource,
        utmMedium: payload.utmMedium,
        utmCampaign: payload.utmCampaign,
        utmTerm: payload.utmTerm,
        utmContent: payload.utmContent,
        clickId: payload.clickId,
        metadata: payload.rawPayload
      });
    } catch (attrErr) {
      console.warn("Non-blocking attribution tracking error:", attrErr);
    }

    // 6. Dispatch Role-Based Notifications
    const assignedUser = await sequelize.models.User.findByPk(assignedToId);
    triggerLeadAssignedNotifications(newLead, assignedUser).catch(e => console.error("Notification dispatch failed:", e));

    // 7. Initial Inbound Activity Logging on Lead
    const messageSnippet = payload.message
      ? payload.message.substring(0, 60) + (payload.message.length > 60 ? '...' : '')
      : 'No specific message provided.';

    await Activity.create({
      id: crypto.randomUUID(),
      type: "note",
      leadId: leadId,
      customerId: account ? (account as any).id : null,
      outcome: `Inbound Inquiry Captured via ${payload.source || 'Website'}. Campaign: ${payload.campaign || 'Direct'}. Message: ${messageSnippet}`,
      mentioned_user_ids: "[]",
      pinned: true,
      isCompleted: true,
      createdById: assignedToId,
      direction: "inbound"
    });

    if (assignedToId) {
      await createNotification(
        assignedToId,
        "system",
        "New Lead Assigned",
        `A new lead '${payload.firstName} ${payload.lastName}' from ${companyName} was just assigned to you via ${payload.source || 'Website'}.`,
        `/leads`
      );
    }

    return leadId;
  } catch (error) {
    console.error("Lead Ingestion Error:", error);
    throw error;
  }
}

async function getFirstAdminId(): Promise<string> {
  const admin = await sequelize.models.User.findOne({ where: { role: "admin" } });
  return admin ? (admin as any).id : "00000000-0000-0000-0000-000000000000";
}

async function sendAssignmentNotification(userId: string, lead: any) {
  try {
    const user = await sequelize.models.User.findByPk(userId);
    if (!user) return;
    const userEmail = (user as any).email;
    const userName = (user as any).name;

    console.log(`[NOTIFICATION] Sending Email to ${userName} (${userEmail}): "New Lead Assigned: ${lead.firstName} ${lead.lastName} from ${lead.company || 'Unknown Company'} (Score: ${lead.leadScore})"`);
    
    // Stub for push / in-app notification
    console.log(`[NOTIFICATION] Stub Push Notification triggered for User ${userId}`);
  } catch (error) {
    console.error("Failed to send assignment notification:", error);
  }
}

// ──────────────────────────────────────────────────────────────
// CONNECTORS WITH MOCK FALLBACKS
// ──────────────────────────────────────────────────────────────

export async function processGmailConnector() {
  const { GmailConfig } = require("@nexus-crm/database");
  const { decryptToken, fetchUnreadEmails } = require("./gmailService");
  
  try {
    const config = await GmailConfig.findOne();
    if (config) {
      console.log(`[CONNECTOR] Gmail Ingest running via real API connected to ${config.connectedEmail}`);
      const decrypted = decryptToken(config.encryptedRefreshToken);
      const emails = await fetchUnreadEmails(decrypted);
      
      let lastIngestedId = null;
      for (const email of emails) {
        lastIngestedId = await ingestLead({
          firstName: email.senderName.split(" ")[0] || "Unknown",
          lastName: email.senderName.split(" ").slice(1).join(" ") || "Sender",
          email: email.senderEmail,
          phone: email.phone,
          company: email.senderName + " Org",
          source: "Gmail Connector",
          sourceDetail: `Email Subject: ${email.subject}`,
          message: email.body,
          rawPayload: email.rawPayload
        });
      }
      
      config.lastSyncedAt = new Date();
      await config.save();
      return lastIngestedId;
    }
  } catch (err) {
    console.error("[CONNECTOR] Real Gmail API ingest failed:", err);
  }

  const isMockMode = isDummyKey(process.env.GMAIL_CLIENT_ID) || isDummyKey(process.env.GMAIL_CLIENT_SECRET);
  console.log(`[CONNECTOR] Gmail Ingest falling back to Mock. Mock Mode: ${isMockMode}`);
  
  if (isMockMode) {
    // Generate simulated lead
    const mockNames = [
      { firstName: "Majed", lastName: "Al-Otaibi", company: "Riyadh Construction", email: "majed@riyadhconst.com" },
      { firstName: "Khaled", lastName: "Al-Masri", company: "Red Sea Dev", email: "khaled@redseadev.sa" }
    ];
    const pick = mockNames[Math.floor(Math.random() * mockNames.length)];
    return await ingestLead({
      ...pick,
      phone: "+966501234567",
      source: "Email",
      sourceDetail: "Gmail Mock Integration",
      campaign: "GCC Site Cabin Campaign",
      rawPayload: { simulated: true, headers: { from: pick.email, subject: "Quote request for site cabins" } }
    });
  }
  return null;
}

export async function processMetaConnector() {
  const isMockMode = isDummyKey(process.env.META_APP_ID) || isDummyKey(process.env.META_ACCESS_TOKEN);
  console.log(`[CONNECTOR] Meta Ingest running. Mock Mode: ${isMockMode}`);

  if (isMockMode) {
    const mockNames = [
      { firstName: "Yasmin", lastName: "Qureshi", company: "Designers Hub", email: "yasmin@designershub.com" },
      { firstName: "Tariq", lastName: "Jameel", company: "BuildCorp LLC", email: "tariq@buildcorp.ae" }
    ];
    const pick = mockNames[Math.floor(Math.random() * mockNames.length)];
    return await ingestLead({
      ...pick,
      phone: "+971509876543",
      source: "Facebook",
      sourceDetail: "Meta Ads Lead Form Mock",
      campaign: "Prefab Office Ads",
      rawPayload: { simulated: true, ad_id: "meta_ad_prefab_101", lead_id: "fb_lead_55029" }
    });
  }
  return null;
}

export async function processLinkedInConnector() {
  const isMockMode = isDummyKey(process.env.LINKEDIN_CLIENT_ID) || isDummyKey(process.env.LINKEDIN_ACCESS_TOKEN);
  console.log(`[CONNECTOR] LinkedIn Ingest running. Mock Mode: ${isMockMode}`);

  if (isMockMode) {
    return await ingestLead({
      firstName: "Hassan",
      lastName: "Raza",
      email: "hassan.raza@kfn.com.sa",
      company: "KFN Holdings",
      phone: "+966551122334",
      source: "LinkedIn",
      sourceDetail: "LinkedIn Lead Gen Forms Mock",
      campaign: "Enterprise Prefab Buildings",
      rawPayload: { simulated: true, linkedin_form_id: "li_form_993", profile_url: "linkedin.com/in/hassanraza" }
    });
  }
  return null;
}
