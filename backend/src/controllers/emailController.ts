import { Request, Response } from "express";
import { Lead, User } from "@nexus-crm/database";
import { assignLead } from "../services/assignmentEngine";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";

// Helper to parse Name & Email from "First Last <email@domain.com>" format
function parseSender(fromStr: string) {
  const emailRegex = /<([^>]+)>/;
  const match = fromStr.match(emailRegex);
  
  if (match) {
    const email = match[1].trim();
    const namePart = fromStr.replace(emailRegex, "").trim();
    const nameParts = namePart.split(" ");
    const firstName = nameParts[0] || "Email";
    const lastName = nameParts.slice(1).join(" ") || "Query";
    return { firstName, lastName, email };
  }
  
  // Fallback if no bracket format
  const cleanEmail = fromStr.trim();
  const username = cleanEmail.split("@")[0] || "Email";
  return {
    firstName: username,
    lastName: "Query",
    email: cleanEmail
  };
}

export const receiveInboundEmail = async (req: Request, res: Response) => {
  try {
    // SendGrid/Mailgun/Postmark inbound parse fields
    // We support standard POST fields: "from", "subject", "text" (or "body"), "to" (or "recipient")
    const { from, subject, text, body, sender, to, recipient, To } = req.body;
    
    const rawFrom = from || sender;
    if (!rawFrom) {
      return res.status(400).json({ error: "Missing sender information ('from' or 'sender')" });
    }

    const { firstName, lastName, email } = parseSender(rawFrom);
    const emailSubject = subject || "No Subject";
    const emailBody = text || body || "No message body provided.";

    const rawTo = to || recipient || To;
    let assignedToId = null;
    let recipientEmail = null;

    if (rawTo) {
      const parsedRecipient = parseSender(rawTo);
      recipientEmail = parsedRecipient.email;
      
      const matchedUser = await User.findOne({
        where: { email: recipientEmail }
      }) as any;

      if (matchedUser && ["sales_rep", "sales_manager", "admin", "director"].includes(matchedUser.role)) {
        assignedToId = matchedUser.id;
      }
    }

    // Fallback to engine
    if (!assignedToId) {
      assignedToId = await assignLead({
        firstName,
        lastName,
        email,
        phone: "",
        company: "",
        source: "email"
      });
    }

    const lead = await Lead.create({
      firstName,
      lastName,
      email,
      phone: "",
      company: "",
      source: "email",
      status: "New Lead",
      subject: emailSubject,
      body: emailBody,
      assignedToId: null,
      recipientEmail
    });

    if (assignedToId) {
      await assignLeadToSalesperson(lead, assignedToId);
    }

    res.status(201).json({
      message: "Inbound email ingested successfully",
      leadId: (lead as any).id,
      assignedToId
    });
  } catch (error: any) {
    console.error("Error in receiveInboundEmail webhook:", error);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
};
