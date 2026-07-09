import { Request, Response } from "express";
import { Lead, AssignmentRule } from "@nexus-crm/database";
import { triggerTemplatedEmail } from "../services/emailService";
import { assignLeadToSalesperson } from "../services/leadAssignmentService";
import { assignLead } from "../services/assignmentEngine";

export const createPublicLead = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, company, message, source } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    const assignedToId = await assignLead({
      firstName,
      lastName,
      email,
      phone,
      company,
      source: source || "Website"
    });

    const lead = await Lead.create({
      firstName,
      lastName,
      email,
      phone,
      company,
      source: source || "Website",
      status: "New",
      assignedToId: null // We will set this via the assignment service to trigger the hooks
    });

    if (assignedToId) {
      await assignLeadToSalesperson(lead, assignedToId);
    }

    // 1. LEAD ACKNOWLEDGEMENT AUTOMATION
    if (email) {
      const slaHours = process.env.LEAD_RESPONSE_SLA_HOURS || "24";
      triggerTemplatedEmail("lead_acknowledgement", email, { 
        lead_name: firstName, 
        sla_hours: slaHours 
      }, (lead as any).id).catch(err => console.error("Email send failed:", err));
    }

    res.status(201).json({ message: "Lead captured successfully", leadId: (lead as any).id });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
};
