import { sequelize } from "@nexus-crm/database";
import * as nodemailer from "nodemailer";

// Fallback message templates in case DB is not yet populated
const DEFAULT_TEMPLATES: Record<string, { name: string; channel: string; bodyTemplate: string }> = {
  new_lead_acknowledgement: {
    name: "New Lead Acknowledgement",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nThank you for reaching out to {{company_name}}! We have received your enquiry and our representative will contact you shortly.\n\nBest regards,\n{{company_name}} Team"
  },
  lead_assigned_intro: {
    name: "Lead Assigned Intro",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nMy name is {{salesperson_name}} and I will be your dedicated account manager at {{company_name}}. I look forward to working with you!\n\nBest regards,\n{{salesperson_name}}"
  },
  quote_sent: {
    name: "Quote Sent",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nWe have prepared a new quotation for you totaling {{quote_value}}. Please review the attached details.\n\nBest regards,\n{{salesperson_name}}"
  },
  quote_expiry_reminder: {
    name: "Quote Expiry Reminder",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nThis is a friendly reminder that your quotation of value {{quote_value}} is expiring soon. Let us know if you have any questions.\n\nBest regards,\n{{salesperson_name}}"
  },
  po_received: {
    name: "PO Received Thank-You",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nWe have received your purchase order of {{quote_value}}. Thank you for your business! We will begin processing it immediately.\n\nBest regards,\n{{company_name}} Team"
  },
  deal_lost_feedback: {
    name: "Deal Lost Feedback Request",
    channel: "email",
    bodyTemplate: "Hello {{lead_name}},\n\nWe are sorry we couldn't partner with you on this project. We would appreciate if you could share any feedback to help us improve.\n\nBest regards,\n{{company_name}} Team"
  },
  new_lead_assigned: {
    name: "New Lead Assigned Alert",
    channel: "email",
    bodyTemplate: "Hi {{salesperson_name}},\n\nYou have been assigned a new lead: {{lead_name}} from {{company_name}}."
  },
  sla_breach_escalation: {
    name: "SLA Breach Escalation",
    channel: "email",
    bodyTemplate: "Warning: Lead {{lead_name}} assigned to {{salesperson_name}} has breached response SLA limit."
  },
  high_value_deal_won: {
    name: "High Value Deal Won Broadcast",
    channel: "email",
    bodyTemplate: "Celebration! {{salesperson_name}} has successfully closed a deal worth {{quote_value}} with {{company_name}}!"
  },
  kpi_drop_alert: {
    name: "KPI Drop Alert",
    channel: "email",
    bodyTemplate: "Alert: Salesperson {{salesperson_name}}'s close rate has dropped below target threshold."
  }
};

// Auto-seed default templates if empty
export async function seedDefaultMessageTemplates() {
  try {
    const count = await sequelize.models.MessageTemplate.count();
    if (count === 0) {
      console.log("Seeding default message templates...");
      const templatesToInsert = Object.entries(DEFAULT_TEMPLATES).map(([triggerEvent, t]) => ({
        id: require('crypto').randomUUID(),
        name: t.name,
        triggerEvent,
        channel: t.channel,
        bodyTemplate: t.bodyTemplate,
        isActive: true
      }));
      await sequelize.models.MessageTemplate.bulkCreate(templatesToInsert);
    }
  } catch (error) {
    console.error("Failed to seed default message templates:", error);
  }
}

export async function triggerCommunication(
  triggerEvent: string,
  context: { leadId?: string; salespersonId?: string; quoteValue?: number }
) {
  try {
    // 1. Fetch template from DB or fallback
    let template = await sequelize.models.MessageTemplate.findOne({
      where: { triggerEvent, isActive: true }
    });

    const templateData = template 
      ? (template.toJSON() as { name: string; bodyTemplate: string; channel: string })
      : DEFAULT_TEMPLATES[triggerEvent];

    if (!templateData) {
      console.warn(`No message template configured or default found for trigger event: ${triggerEvent}`);
      return;
    }

    // 2. Resolve merge field parameters
    let leadName = "Valued Customer";
    let companyName = "Nexus Client";
    let salespersonName = "Nexus Representative";
    
    if (context.leadId) {
      const lead = await sequelize.models.Lead.findByPk(context.leadId);
      if (lead) {
        leadName = `${(lead as any).firstName} ${(lead as any).lastName}`.trim();
        companyName = (lead as any).company || "Nexus Client";
      }
    }
    
    if (context.salespersonId) {
      const user = await sequelize.models.User.findByPk(context.salespersonId);
      if (user) {
        salespersonName = (user as any).name;
      }
    }

    const quoteValStr = context.quoteValue !== undefined 
      ? `$${Number(context.quoteValue).toLocaleString()}` 
      : "$0.00";

    // 3. Perform merge replacement
    let body = templateData.bodyTemplate
      .replace(/\{\{lead_name\}\}/g, leadName)
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{salesperson_name\}\}/g, salespersonName)
      .replace(/\{\{quote_value\}\}/g, quoteValStr);

    // 4. Simulate sending or execute nodemailer
    const subject = `[Nexus CRM] - ${templateData.name}`;
    console.log(`\n--- STAKEHOLDER COMMUNICATION OUTBOX ---`);
    console.log(`Trigger Event: ${triggerEvent}`);
    console.log(`Channel: ${templateData.channel}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log(`----------------------------------------\n`);

    // We can also log to system notification or database activity if relevant
  } catch (error) {
    console.error("Communication trigger service error:", error);
  }
}
