import nodemailer from "nodemailer";
import { sequelize } from "@nexus-crm/database";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const renderTemplate = (templateString: string, dataObj: Record<string, string>): string => {
  let rendered = templateString;
  for (const [key, value] of Object.entries(dataObj)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value);
  }
  return rendered;
};

export const getBaseHtmlTemplate = (bodyContent: string, leadId?: string): string => {
  const baseUrl = process.env.BASE_URL || "http://localhost:5506";
  const unsubscribeHtml = leadId 
    ? `<p style="margin-top: 10px;">Don't want to receive these emails? <a href="${baseUrl}/api/v1/leads/unsubscribe/${leadId}">Unsubscribe here</a></p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background-color: #262B34; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px; }
    .content { padding: 32px; color: #333333; line-height: 1.6; }
    .footer { background-color: #f9f9f9; padding: 24px; text-align: center; color: #888888; font-size: 12px; border-top: 1px solid #eeeeee; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NEXUS CRM</h1>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Nexus Enterprises LLC. All rights reserved.</p>
      <p>123 Tech Corridor, Internet City, Dubai</p>
      ${unsubscribeHtml}
    </div>
  </div>
</body>
</html>
  `;
};

export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Nexus CRM" <no-reply@nexus-crm.com>',
      to,
      subject,
      html: htmlContent,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export const triggerTemplatedEmail = async (templateName: string, to: string, dataObj: Record<string, string>, leadId?: string) => {
  try {
    if (leadId) {
      const lead = await sequelize.models.Lead.findByPk(leadId);
      if (lead && (lead as any).optedOutEmail) {
        console.warn(`[COMPLIANCE] Aborting email send. Lead ${leadId} has opted out of emails.`);
        return;
      }
    }

    const template = await sequelize.models.MessageTemplate.findOne({ where: { name: templateName, channel: 'email' } });
    if (!template) {
      console.warn(`Template ${templateName} not found`);
      return;
    }
    
    const t = template as any;
    let chosenSubject = t.subject || "";
    let chosenBody = t.body;
    let selectedVariant = 'A';

    // A/B Testing Logic
    if (t.isAbTest) {
      if (t.winnerVariant === 'A' || t.winnerVariant === 'B') {
        selectedVariant = t.winnerVariant;
      } else {
        selectedVariant = Math.random() < 0.5 ? 'A' : 'B';
      }

      if (selectedVariant === 'B' && t.variantBBody) {
        chosenSubject = t.variantBSubject || chosenSubject;
        chosenBody = t.variantBBody;
        if (!t.winnerVariant) {
           t.variantBSends += 1;
           await t.save();
        }
      } else {
        selectedVariant = 'A'; // fallback to A if B missing
        if (!t.winnerVariant) {
           t.variantASends += 1;
           await t.save();
        }
      }
    }

    const subject = renderTemplate(chosenSubject, dataObj);
    let bodyContent = renderTemplate(chosenBody, dataObj);
    
    // Inject Tracking Pixel for A/B Tests
    if (t.isAbTest) {
      const baseUrl = process.env.BASE_URL || "http://localhost:5505";
      const pixelUrl = `${baseUrl}/api/v1/message-templates/track/${t.id}?variant=${selectedVariant}`;
      bodyContent += `\n<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    }

    const html = getBaseHtmlTemplate(bodyContent, leadId);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n=== RENDERED EMAIL BODY ===\n${bodyContent}\n===========================\n`);
    }

    await sendEmail(to, subject, html);
  } catch (error) {
    console.error("Error triggering templated email:", error);
  }
};

export const processScheduledEmails = async () => {
  try {
    const { Op } = require("sequelize");
    const now = new Date();
    
    // Find scheduled emails where sendAfter has passed and sentAt is null
    const pendingEmails = await sequelize.models.ScheduledEmail.findAll({
      where: {
        sentAt: null,
        sendAfter: { [Op.lte]: now }
      },
      include: [{ model: sequelize.models.Lead, as: 'lead' }]
    });

    for (const record of pendingEmails) {
      const emailRecord = record as any;
      const lead = emailRecord.lead;
      if (lead && lead.email) {
        await triggerTemplatedEmail(emailRecord.templateName, lead.email, {
          lead_name: lead.firstName || 'there',
          sender_company_name: process.env.COMPANY_NAME || "Our Company"
        }, lead.id).catch(err => console.error("Scheduled email send failed:", err));
        
        emailRecord.sentAt = new Date();
        await emailRecord.save();
        console.log(`Sent scheduled email ${emailRecord.templateName} to ${lead.email}`);
      } else {
        // Mark as sent anyway so it doesn't get stuck in a retry loop if there's no email
        emailRecord.sentAt = new Date();
        await emailRecord.save();
      }
    }
  } catch (error) {
    console.error("Error processing scheduled emails:", error);
  }
};

export const processQuoteFollowUps = async () => {
  try {
    const { Op } = require("sequelize");
    
    const followUpDays = parseInt(process.env.QUOTE_FOLLOWUP_DAYS || "5", 10);
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - followUpDays);

    const staleQuotes = await sequelize.models.Quote.findAll({
      where: {
        status: "Sent",
        statusChangedAt: { [Op.lte]: staleDate },
        followUpSentAt: null
      },
      include: [{ 
        model: sequelize.models.Deal, 
        as: "deal",
        include: [{ model: sequelize.models.Lead, as: "lead" }]
      }]
    });

    for (const record of staleQuotes) {
      const quote = record as any;
      const lead = quote.deal?.lead;
      if (lead && lead.email) {
        const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(Number(quote.totalAmount || 0));
        
        await triggerTemplatedEmail("quote_no_response_followup", lead.email, {
          lead_name: lead.firstName || 'there',
          quote_amount: formattedAmount,
          sender_company_name: process.env.COMPANY_NAME || "Our Company"
        }, lead.id).catch(err => console.error("Quote followup email failed:", err));
        
        quote.followUpSentAt = new Date();
        await quote.save();
        console.log(`Sent quote follow-up for Quote ${quote.id} to ${lead.email}`);
      } else {
        // Mark as sent to avoid endless retries on quotes without valid lead emails
        quote.followUpSentAt = new Date();
        await quote.save();
      }
    }
  } catch (error) {
    console.error("Error processing quote follow-ups:", error);
  }
};
