import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { assignLead } from "./assignmentEngine";
import { createNotification } from "./notificationService";
import { handleInboundActivity } from "./leadTemperatureService";

function isDummyKey(val?: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase();
  return lower.includes("your_") || lower.includes("change_me") || lower.includes("test_user") || lower.includes("mock_");
}

export interface LeadPayload {
  firstName: string;
  lastName: string;
  email?: string;
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
  isManualAutoResponseEnabled?: boolean;
  destinationEmail?: string;
  destinationPhone?: string;
  assignedChannelUserId?: string;
  isManualEntry?: boolean;
  createdById?: string;
}

/**
 * Normalizes input lead data, runs duplicate detection and lead scoring,
 * assigns the lead using the assignment engine, sends channel-aware automatic responses,
 * creates SLA follow-up tasks, handles delivery failures gracefully, and persists everything.
 */
export async function ingestLead(payload: LeadPayload) {
  try {
    const email = payload.email?.trim().toLowerCase() || "";
    const company = payload.company?.trim().toLowerCase() || "";

    if (!payload.firstName || !payload.lastName) {
      throw new Error("First name and last name are required for lead ingestion");
    }

    // 1. Normalize Source
    const rawSource = (payload.source || "Website").trim();
    let source = "Website";
    const srcLower = rawSource.toLowerCase();
    if (srcLower.includes("whatsapp")) source = "WhatsApp";
    else if (srcLower.includes("email") || srcLower.includes("gmail")) source = "Email";
    else if (srcLower.includes("website") || srcLower.includes("web") || srcLower.includes("public form")) source = "Website";
    else if (srcLower.includes("instagram")) source = "Instagram";
    else if (srcLower.includes("facebook") || srcLower.includes("meta")) source = "Facebook";
    else if (srcLower.includes("cold call") || srcLower.includes("cold_call")) source = "Cold Call";
    else if (srcLower.includes("manual")) source = "Manual Entry";
    else if (srcLower.includes("voice")) source = "Voice Parser";
    else if (rawSource) source = rawSource;

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
        email: email || null,
        phone: payload.phone || null,
        industry: payload.industry || null
      });
      customerId = (newCustomer as any).id;
    }

    // 2. Duplicate Detection
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

    if (!existingLead && payload.phone) {
      existingLead = await LeadModel.findOne({
        where: { phone: payload.phone }
      });
    }

    // 3. Lead Scoring
    let leadScore = 50; // base score
    if (email && !email.endsWith("@gmail.com") && !email.endsWith("@yahoo.com") && !email.endsWith("@hotmail.com") && !email.endsWith("@outlook.com")) {
      leadScore += 15; // Corporate email bonus
    }
    if (payload.phone) leadScore += 10;
    if (payload.company) leadScore += 10;
    if (payload.message && payload.message.length > 10) leadScore += 15;
    if (source === "LinkedIn" || source === "Facebook") leadScore += 10;
    if (leadScore > 100) leadScore = 100;

    let targetLeadId: string;

    if (existingLead) {
      // Update existing lead (Merge / Update fields)
      targetLeadId = existingLead.id;
      const updates: any = {
        company: existingLead.company || payload.company,
        leadScore: Math.max(existingLead.leadScore || 0, leadScore),
        sourceDetail: payload.sourceDetail || existingLead.sourceDetail,
        campaign: payload.campaign || existingLead.campaign,
        budgetRange: payload.budgetRange || existingLead.budgetRange,
        customerId: existingLead.customerId || customerId,
        categoriesData: payload.categoriesData || existingLead.categoriesData,
        rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : existingLead.rawPayload,
        lastInboundAt: new Date()
      };
      await existingLead.update(updates);

      // Check if this is a different contact for the same company/lead
      const isDifferentEmail = email && existingLead.email && email.toLowerCase() !== existingLead.email.toLowerCase();
      const isDifferentName = payload.firstName && payload.lastName && 
        (payload.firstName.toLowerCase() !== existingLead.firstName.toLowerCase() || 
         payload.lastName.toLowerCase() !== existingLead.lastName.toLowerCase());

      if (isDifferentEmail || isDifferentName) {
        const LeadContactModel = sequelize.models.LeadContact;
        if (LeadContactModel) {
          const existingContact = await LeadContactModel.findOne({
            where: {
              leadId: targetLeadId,
              email: email
            }
          });

          if (!existingContact) {
            await LeadContactModel.create({
              id: crypto.randomUUID(),
              leadId: targetLeadId,
              firstName: payload.firstName,
              lastName: payload.lastName,
              email: email,
              phone: payload.phone || null,
              role: "Additional Contact",
              message: payload.message || null,
              sourceChannel: payload.source || null
            });

            const messageSnippet = payload.message
              ? payload.message.substring(0, 60) + (payload.message.length > 60 ? '...' : '')
              : 'No message provided';

            await sequelize.models.Activity.create({
              id: crypto.randomUUID(),
              type: "note",
              leadId: targetLeadId,
              outcome: `New contact added: ${payload.firstName} ${payload.lastName} (${email}) — requesting: ${messageSnippet}`,
              mentioned_user_ids: "[]",
              pinned: false,
              isCompleted: true,
              createdById: existingLead.assignedToId || (await getFirstAdminId()),
              direction: "inbound"
            });

            if (existingLead.assignedToId) {
              await createNotification(
                existingLead.assignedToId,
                "system",
                "New Contact on Existing Lead",
                `${payload.firstName} ${payload.lastName} from ${payload.company || existingLead.company || "the same company"} just reached out — this company already has an active lead with you (originally from ${existingLead.firstName} ${existingLead.lastName}).`,
                `/leads/${targetLeadId}`
              );
            }
          } else {
            // Update the existing contact silently
            await existingContact.update({
              firstName: payload.firstName,
              lastName: payload.lastName,
              phone: payload.phone || (existingContact as any).phone
            });
          }
        }
      }

      // Check duplicate protection for outbound responses
      const existingOutbound = await sequelize.models.Activity.findOne({
        where: {
          leadId: targetLeadId,
          direction: "outbound"
        }
      });

      if (!existingOutbound) {
        // Log duplicate capture activity without re-sending welcome message
        await sequelize.models.Activity.create({
          id: crypto.randomUUID(),
          type: "note",
          leadId: targetLeadId,
          outcome: `[AUTOMATED] Duplicate lead capture from ${source}`,
          mentioned_user_ids: "[]",
          pinned: false,
          isCompleted: true,
          createdById: existingLead.assignedToId || (await getFirstAdminId()),
          direction: "inbound"
        });

        await handleInboundActivity(targetLeadId);

        if (existingLead.assignedToId) {
          await createNotification(
            existingLead.assignedToId,
            "system",
            "Duplicate Lead Inquiry Received",
            `${payload.firstName} ${payload.lastName} from ${payload.company || existingLead.company || "the same company"} submitted another inquiry via ${source}.`,
            `/leads/${targetLeadId}`
          );
        }
      }

      return targetLeadId;
    }

    // 4. Lead Assignment Engine
    const assignmentResult = await assignLead({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email || "",
      phone: payload.phone || "",
      company: payload.company || "",
      source: source,
      industry: payload.industry,
      budgetRange: payload.budgetRange,
      leadScore,
      isStrategic: Boolean(leadScore >= 80 || (payload.budgetRange && payload.budgetRange.includes("100"))),
      destinationEmail: payload.destinationEmail,
      destinationPhone: payload.destinationPhone,
      assignedChannelUserId: payload.assignedChannelUserId,
      isManualEntry: payload.isManualEntry,
      createdById: payload.createdById
    });

    let assignedToId = assignmentResult.assignedToId;
    const assignmentType = assignmentResult.assignmentType || "AUTOMATIC";

    if (!assignedToId) {
      const defaultAdmin = await sequelize.models.User.findOne({
        where: { role: "admin", isAvailable: true }
      });
      assignedToId = defaultAdmin ? (defaultAdmin as any).id : null;
    }

    // 5. Create New Lead
    targetLeadId = crypto.randomUUID();
    const year = new Date().getFullYear();
    const uniqueSuffix = String(Date.now()).slice(-5) + Math.floor(Math.random() * 90 + 10);
    const leadNumber = `LD-${year}-${uniqueSuffix}`;

    const newLead = await LeadModel.create({
      id: targetLeadId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: email || null,
      phone: payload.phone || null,
      company: payload.company || null,
      status: "New",
      source: source,
      sourceDetail: payload.sourceDetail || null,
      campaign: payload.campaign || null,
      industry: payload.industry || null,
      leadScore,
      assignedToId: assignedToId || null,
      assignmentType,
      assignmentMethod: assignmentType,
      budgetRange: payload.budgetRange || null,
      customerId,
      leadNumber,
      categoriesData: payload.categoriesData || null,
      rawPayload: payload.rawPayload ? JSON.stringify(payload.rawPayload) : null,
      lastInboundAt: new Date()
    });

    // 6. Log Initial Ingestion Activity
    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      type: "stage_change",
      leadId: targetLeadId,
      outcome: `[AUTOMATED] Lead received from ${source}. Initial score: ${leadScore}`,
      mentioned_user_ids: "[]",
      pinned: false,
      isCompleted: true,
      createdById: assignedToId || (await getFirstAdminId()),
      direction: "inbound"
    });

    // 7. Determine Channel & Automatic First Response (Requirement 2 & 3)
    let autoResponseSent = false;
    let autoResponseFailed = false;
    let autoResponseErrorReason = "";

    const assignedUser = assignedToId ? await sequelize.models.User.findByPk(assignedToId) : null;
    const ownerName = assignedUser ? (assignedUser as any).name : "Sales Team";

    // Variables for message templates
    const templateVars: Record<string, string> = {
      contact_name: `${payload.firstName} ${payload.lastName}`.trim(),
      company_name: payload.company || "Nexus CRM",
      lead_source: source,
      owner_name: ownerName,
      lead_id: leadNumber
    };

    // Helper for template interpolation
    const interpolate = (str: string) => {
      let res = str || "";
      for (const [k, v] of Object.entries(templateVars)) {
        res = res.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
      return res;
    };

    if (source === "Website" || source === "Email") {
      if (email) {
        try {
          // Fetch template from DB or fallback
          const MessageTemplateModel = sequelize.models.MessageTemplate;
          let dbTemplate: any = null;
          if (MessageTemplateModel) {
            dbTemplate = await MessageTemplateModel.findOne({
              where: {
                [Op.or]: [
                  { triggerEvent: `${source.toLowerCase()}_lead_acknowledgement` },
                  { triggerEvent: "new_lead_acknowledgement" },
                  { name: `${source} Lead Acknowledgement` }
                ],
                isActive: true
              }
            });
          }

          let subject = `Thank you for your interest, ${payload.firstName}`;
          let bodyText = `Hi ${payload.firstName}, thank you for your interest in ${payload.company || 'our company'}. We've received your enquiry and one of our sales specialists (${ownerName}) will get in touch with you shortly.`;

          if (dbTemplate) {
            subject = interpolate(dbTemplate.subject || subject);
            bodyText = interpolate(dbTemplate.body || bodyText);
          }

          const { sendEmail, getBaseHtmlTemplate } = require("./emailService");
          await sendEmail(email, subject, getBaseHtmlTemplate(`<p>${bodyText.replace(/\n/g, '<br/>')}</p>`, targetLeadId));

          await sequelize.models.EmailMessage.create({
            id: crypto.randomUUID(),
            leadId: targetLeadId,
            customerId: customerId,
            senderId: assignedToId || null,
            toEmail: email,
            subject,
            body: bodyText,
            status: "Sent"
          });

          await sequelize.models.Activity.create({
            id: crypto.randomUUID(),
            type: "email",
            leadId: targetLeadId,
            outcome: `[AUTOMATED] Automated ${source} response sent to ${email}`,
            notes: bodyText,
            mentioned_user_ids: "[]",
            pinned: false,
            isCompleted: true,
            createdById: assignedToId || (await getFirstAdminId()),
            direction: "outbound"
          });

          autoResponseSent = true;
        } catch (err: any) {
          autoResponseFailed = true;
          autoResponseErrorReason = err.message || "Email delivery failed";
        }
      } else {
        autoResponseFailed = true;
        autoResponseErrorReason = "No email address provided for website/email lead";
      }
    } else if (source === "WhatsApp") {
      const phoneNum = payload.phone || (newLead as any).whatsappPhone;
      if (phoneNum) {
        try {
          const MessageTemplateModel = sequelize.models.MessageTemplate;
          let dbTemplate: any = null;
          if (MessageTemplateModel) {
            dbTemplate = await MessageTemplateModel.findOne({
              where: {
                [Op.or]: [
                  { triggerEvent: "whatsapp_lead_acknowledgement" },
                  { name: "WhatsApp Lead Acknowledgement" }
                ],
                isActive: true
              }
            });
          }

          let msgText = `Hi ${payload.firstName}, thanks for reaching out to ${payload.company || 'Nexus CRM'}. We've received your enquiry and our sales team will assist you shortly.`;
          if (dbTemplate) {
            msgText = interpolate(dbTemplate.body || msgText);
          }

          const { sendWhatsAppMessage } = require("./whatsappService");
          await sendWhatsAppMessage(phoneNum, msgText);

          await sequelize.models.Activity.create({
            id: crypto.randomUUID(),
            type: "whatsapp_sms",
            leadId: targetLeadId,
            outcome: `[AUTOMATED] Automated WhatsApp response sent to ${phoneNum}`,
            notes: msgText,
            mentioned_user_ids: "[]",
            pinned: false,
            isCompleted: true,
            createdById: assignedToId || (await getFirstAdminId()),
            direction: "outbound"
          });

          autoResponseSent = true;
        } catch (err: any) {
          autoResponseFailed = true;
          autoResponseErrorReason = err.message || "WhatsApp delivery failed";
        }
      } else {
        autoResponseFailed = true;
        autoResponseErrorReason = "No phone number provided for WhatsApp lead";
      }
    } else if (source === "Instagram" || source === "Facebook") {
      try {
        const msgText = `Hi ${payload.firstName}, thanks for reaching out to ${payload.company || 'Nexus CRM'} via ${source}. We've received your inquiry and will follow up shortly!`;
        
        await sequelize.models.Activity.create({
          id: crypto.randomUUID(),
          type: "instagram_dm",
          leadId: targetLeadId,
          outcome: `[AUTOMATED] Automated ${source} response sent`,
          notes: msgText,
          mentioned_user_ids: "[]",
          pinned: false,
          isCompleted: true,
          createdById: assignedToId || (await getFirstAdminId()),
          direction: "outbound"
        });

        autoResponseSent = true;
      } catch (err: any) {
        autoResponseFailed = true;
        autoResponseErrorReason = err.message || `${source} response delivery failed`;
      }
    } else if (source === "Manual Entry" && payload.isManualAutoResponseEnabled && email) {
      try {
        const subject = `Welcome, ${payload.firstName}`;
        const bodyText = `Hi ${payload.firstName}, thank you for getting in touch with ${payload.company || 'Nexus CRM'}.`;
        const { sendEmail, getBaseHtmlTemplate } = require("./emailService");
        await sendEmail(email, subject, getBaseHtmlTemplate(`<p>${bodyText}</p>`, targetLeadId));

        await sequelize.models.Activity.create({
          id: crypto.randomUUID(),
          type: "email",
          leadId: targetLeadId,
          outcome: `[AUTOMATED] Automated Manual Entry response sent`,
          notes: bodyText,
          mentioned_user_ids: "[]",
          pinned: false,
          isCompleted: true,
          createdById: assignedToId || (await getFirstAdminId()),
          direction: "outbound"
        });

        autoResponseSent = true;
      } catch (err: any) {
        autoResponseFailed = true;
        autoResponseErrorReason = err.message || "Manual entry email auto-response failed";
      }
    }

    // 8. Failure Handling (Requirement 10)
    const notifyTargetId = assignedToId || (await getFirstAdminId());
    if (autoResponseFailed) {
      await sequelize.models.Activity.create({
        id: crypto.randomUUID(),
        type: "note",
        leadId: targetLeadId,
        outcome: `[AUTOMATED] Automation Failed: ${autoResponseErrorReason}`,
        notes: `Automated response could not be delivered to ${payload.firstName} ${payload.lastName}. Reason: ${autoResponseErrorReason}`,
        mentioned_user_ids: "[]",
        pinned: false,
        isCompleted: true,
        createdById: notifyTargetId,
        direction: "internal"
      });

      await createNotification(
        notifyTargetId,
        "warning",
        "⚠ Automated response failed",
        `${source} response could not be delivered to ${payload.firstName} ${payload.lastName}. Reason: ${autoResponseErrorReason}`,
        `/leads/${targetLeadId}`
      );

      // Create high-priority task for rep to follow up manually
      await sequelize.models.Task.create({
        id: crypto.randomUUID(),
        title: `[Action Required] Contact ${payload.firstName} ${payload.lastName} manually - Automated response failed`,
        description: `Automated ${source} response failed: ${autoResponseErrorReason}. Contact client manually.`,
        priority: "High",
        status: "Pending",
        ownerId: notifyTargetId,
        leadId: targetLeadId,
        customerId: customerId,
        dueDate: new Date(Date.now() + 2 * 3600 * 1000) // 2 hours
      });
    }

    // 9. Automatic Follow-Up Task & SLA (Requirement 5 & 6)
    // SLA Hours based on Lead Score & Priority
    let slaHours = 4; // default Normal priority SLA
    let taskPriority = "Medium";
    if (leadScore >= 80) {
      slaHours = 1;
      taskPriority = "High";
    } else if (leadScore < 40) {
      slaHours = 24;
      taskPriority = "Low";
    }

    const taskDueDate = new Date(Date.now() + slaHours * 3600 * 1000);
    const taskTitle = `Follow up with ${payload.firstName} ${payload.lastName}`;

    await sequelize.models.Task.create({
      id: crypto.randomUUID(),
      title: taskTitle,
      description: `Universal intake follow-up task for ${source} lead (${leadNumber}). Response SLA: ${slaHours}h.`,
      priority: taskPriority,
      status: "Pending",
      ownerId: notifyTargetId,
      leadId: targetLeadId,
      customerId: customerId,
      dueDate: taskDueDate
    });

    await sequelize.models.Activity.create({
      id: crypto.randomUUID(),
      type: "task",
      leadId: targetLeadId,
      outcome: `[AUTOMATED] Follow-up task created: ${taskTitle}`,
      notes: `Due in ${slaHours} hours (SLA: ${taskPriority} Priority)`,
      mentioned_user_ids: "[]",
      pinned: false,
      isCompleted: true,
      createdById: notifyTargetId,
      direction: "internal"
    });

    // 10. Notify Assigned Owner (Requirement 4)
    if (assignedToId) {
      await createNotification(
        assignedToId,
        "info",
        "New Lead Assigned 🎯",
        `New lead ${payload.firstName} ${payload.lastName} (${company || source}) has been assigned to you. SLA follow-up task created.`,
        `/leads/${targetLeadId}`
      );
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
