import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { assignLead } from "./assignmentEngine";

interface LeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  sourceDetail?: string;
  campaign?: string;
  industry?: string;
  message?: string;
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
    const company = payload.company?.trim().toLowerCase() || "";

    if (!payload.firstName || !payload.lastName || !email) {
      throw new Error("First name, last name, and email are required for ingestion");
    }

    // Find or create Customer
    const CustomerModel = sequelize.models.Customer;
    let customerId: string | null = null;
    let existingCustomer: any = null;

    if (email) {
      existingCustomer = await CustomerModel.findOne({
        where: { email: { [Op.like]: email } }
      });
    }

    if (!existingCustomer && company) {
      existingCustomer = await CustomerModel.findOne({
        where: { name: { [Op.like]: company } }
      });
    }

    if (existingCustomer) {
      customerId = (existingCustomer as any).id;
    } else {
      const newCustomer = await CustomerModel.create({
        id: crypto.randomUUID(),
        name: company || `${payload.firstName} ${payload.lastName}`,
        primaryContactName: `${payload.firstName} ${payload.lastName}`,
        email: email,
        phone: payload.phone || null,
        industry: payload.industry || null
      });
      customerId = (newCustomer as any).id;
    }

    // 1. Duplicate Detection (checks email or company)
    const LeadModel = sequelize.models.Lead;
    let existingLead: any = null;

    if (email) {
      existingLead = await LeadModel.findOne({
        where: { email: { [Op.like]: email } }
      });
    }

    if (!existingLead && company) {
      existingLead = await LeadModel.findOne({
        where: { company: { [Op.like]: company } }
      });
    }

    // 2. Lead Scoring
    let leadScore = 50; // base score
    if (email && !email.endsWith("@gmail.com") && !email.endsWith("@yahoo.com") && !email.endsWith("@hotmail.com") && !email.endsWith("@outlook.com")) {
      leadScore += 15; // Corporate email bonus
    }
    if (payload.phone) leadScore += 10;
    if (payload.company) leadScore += 10;
    if (payload.message && payload.message.length > 10) leadScore += 15;
    if (payload.source === "LinkedIn" || payload.source === "LinkedIn Ads") leadScore += 10;
    if (leadScore > 100) leadScore = 100;

    let targetLeadId: string;

    if (existingLead) {
      // Update existing lead (Merge / Update fields)
      targetLeadId = existingLead.id;
      const updates: any = {
        firstName: payload.firstName || existingLead.firstName,
        lastName: payload.lastName || existingLead.lastName,
        phone: payload.phone || existingLead.phone,
        company: payload.company || existingLead.company,
        leadScore: Math.max(existingLead.leadScore || 0, leadScore),
        sourceDetail: payload.sourceDetail || existingLead.sourceDetail,
        campaign: payload.campaign || existingLead.campaign,
        budgetRange: payload.budgetRange || existingLead.budgetRange,
        customerId: existingLead.customerId || customerId,
        categoriesData: payload.categoriesData || existingLead.categoriesData,
        rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : existingLead.rawPayload
      };
      await existingLead.update(updates);

      // Create duplicate capture activity log
      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        type: "note",
        leadId: targetLeadId,
        outcome: `Duplicate lead capture: ${payload.source || 'Unknown Source'}`,
        mentioned_user_ids: "[]",
        pinned: false,
        isCompleted: true,
        createdById: existingLead.assignedToId || (await getFirstAdminId())
      });
    } else {
      // 3. Assignment Engine
      const assignedToId = await assignLead({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        company: payload.company,
        source: payload.source,
        industry: payload.industry
      });

      // 4. Create New Lead
      targetLeadId = crypto.randomUUID();
      const year = new Date().getFullYear();
      const count = await LeadModel.count();
      const seq = String(count + 1).padStart(5, '0');
      const leadNumber = `LD-${year}-${seq}`;

      const newLead = await LeadModel.create({
        id: targetLeadId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        phone: payload.phone || null,
        company: payload.company || null,
        status: "New",
        source: payload.source || "Website",
        sourceDetail: payload.sourceDetail || null,
        campaign: payload.campaign || null,
        industry: payload.industry || null,
        leadScore,
        assignedToId,
        budgetRange: payload.budgetRange || null,
        customerId,
        leadNumber,
        categoriesData: payload.categoriesData || null,
        rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : null
      });

      // Log initial ingestion activity
      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        type: "stage_change",
        leadId: targetLeadId,
        outcome: `Lead ingested from ${payload.source || "Website"}. Initial score: ${leadScore}`,
        mentioned_user_ids: "[]",
        pinned: false,
        isCompleted: true,
        createdById: assignedToId || (await getFirstAdminId())
      });

      const { triggerCommunication } = require("./communicationService");
      
      // 1. Client-facing acknowledgement
      await triggerCommunication("new_lead_acknowledgement", {
        leadId: targetLeadId
      });

      if (assignedToId) {
        await sendAssignmentNotification(assignedToId, newLead.toJSON());

        // 2. Client-facing intro email from salesperson
        await triggerCommunication("lead_assigned_intro", {
          leadId: targetLeadId,
          salespersonId: assignedToId
        });

        // 3. Internal lead assigned email notification
        await triggerCommunication("new_lead_assigned", {
          leadId: targetLeadId,
          salespersonId: assignedToId
        });
      }
    }

    return targetLeadId;
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
  const isMockMode = !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET;
  console.log(`[CONNECTOR] Gmail Ingest running. Mock Mode: ${isMockMode}`);
  
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
  // If credentials exist, implement Gmail REST API polling here
  return null;
}

export async function processMetaConnector() {
  const isMockMode = !process.env.META_APP_ID || !process.env.META_ACCESS_TOKEN;
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
  const isMockMode = !process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_ACCESS_TOKEN;
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
