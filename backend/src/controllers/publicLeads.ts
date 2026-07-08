import { Request, Response } from "express";
import { Lead, AssignmentRule } from "@nexus-crm/database";
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
      assignedToId
    });

    res.status(201).json({ success: true, leadId: lead.id });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
};
