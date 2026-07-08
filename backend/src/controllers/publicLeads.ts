import { Request, Response } from "express";
import { Lead, AssignmentRule } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";

export const createPublicLead = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, company, message, source } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    let assignedToId: string | null = null;
    
    try {
      const rules = await AssignmentRule.findAll({
        where: { isActive: true },
        order: [["priority", "DESC"]],
      });

      for (const rule of rules) {
        let matches = false;
        try {
          const criteriaObj = JSON.parse(rule.criteria);
          matches = Object.keys(criteriaObj).every(key => {
            return req.body[key] === criteriaObj[key];
          });
        } catch (e) {
          console.warn("Invalid JSON in rule criteria:", rule.id);
        }

        if (matches) {
          assignedToId = rule.assignToId;
          break;
        }
      }
    } catch (ruleError) {
      console.error("Error evaluating assignment rules:", ruleError);
    }

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

    if (assignedToId) {
      await createNotification(
        assignedToId,
        'info',
        'New Lead Assigned',
        `A new lead from ${company} (${firstName} ${lastName}) was assigned to you by the auto-routing rules.`,
        `/leads/${(lead as any).id}`
      );
    }

    res.status(201).json({ message: "Lead captured successfully", leadId: (lead as any).id });
  } catch (error: any) {
    console.error("Error creating public lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
};
