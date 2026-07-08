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

export const getBaseHtmlTemplate = (bodyContent: string): string => {
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

export const triggerTemplatedEmail = async (templateName: string, to: string, dataObj: Record<string, string>) => {
  try {
    const template = await sequelize.models.MessageTemplate.findOne({ where: { name: templateName, channel: 'email' } });
    if (!template) {
      console.warn(`Template ${templateName} not found`);
      return;
    }
    
    const subject = renderTemplate((template as any).subject || "", dataObj);
    const bodyContent = renderTemplate((template as any).body, dataObj);
    const html = getBaseHtmlTemplate(bodyContent);
    
    await sendEmail(to, subject, html);
  } catch (error) {
    console.error("Error triggering templated email:", error);
  }
};
