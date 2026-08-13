import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { calculateRepPerformanceProfile } from "../services/repPerformanceService";
import { createNotification } from "../services/notificationService";

export const getAssignmentPolicy = async (req: Request, res: Response) => {
  try {
    let policy: any = await sequelize.models.SalesAssignmentPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });

    if (!policy) {
      policy = await sequelize.models.SalesAssignmentPolicy.create({
        id: require("crypto").randomUUID()
      });
    }

    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAssignmentPolicy = async (req: Request, res: Response) => {
  try {
    const {
      weights,
      highValueThreshold,
      strategicLeadScoreThreshold,
      minSampleSize,
      bayesianPrior,
      bayesianWeight,
      highValueExperienceTiers,
      isPerformanceRoutingEnabled
    } = req.body;

    let policy: any = await sequelize.models.SalesAssignmentPolicy.findOne({
      order: [["createdAt", "DESC"]]
    });

    const payload = {
      weights: typeof weights === "object" ? JSON.stringify(weights) : weights,
      highValueThreshold: highValueThreshold !== undefined ? Number(highValueThreshold) : undefined,
      strategicLeadScoreThreshold: strategicLeadScoreThreshold !== undefined ? Number(strategicLeadScoreThreshold) : undefined,
      minSampleSize: minSampleSize !== undefined ? Number(minSampleSize) : undefined,
      bayesianPrior: bayesianPrior !== undefined ? Number(bayesianPrior) : undefined,
      bayesianWeight: bayesianWeight !== undefined ? Number(bayesianWeight) : undefined,
      highValueExperienceTiers: typeof highValueExperienceTiers === "object" 
        ? JSON.stringify(highValueExperienceTiers) 
        : highValueExperienceTiers,
      isPerformanceRoutingEnabled: isPerformanceRoutingEnabled !== undefined ? Boolean(isPerformanceRoutingEnabled) : undefined
    };

    // Remove undefined
    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

    if (!policy) {
      policy = await sequelize.models.SalesAssignmentPolicy.create({
        id: require("crypto").randomUUID(),
        ...payload
      });
    } else {
      await policy.update(payload);
    }

    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRepPerformanceProfiles = async (req: Request, res: Response) => {
  try {
    const reps = await sequelize.models.User.findAll({
      where: { role: { [Op.ne]: "admin" } },
      attributes: ["id"]
    });

    const profiles = await Promise.all(
      reps.map(async (r: any) => {
        try {
          return await calculateRepPerformanceProfile(r.id);
        } catch (err) {
          return null;
        }
      })
    );

    res.json(profiles.filter(p => p !== null));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAssignmentAudits = async (req: Request, res: Response) => {
  try {
    const audits = await sequelize.models.LeadAssignmentAudit.findAll({
      order: [["createdAt", "DESC"]],
      limit: 100,
      include: [
        { model: sequelize.models.User, as: "assignedTo", attributes: ["id", "name", "email", "role"] },
        { model: sequelize.models.User, as: "previousOwner", attributes: ["id", "name", "email"] },
        { model: sequelize.models.Lead, as: "lead", attributes: ["id", "firstName", "lastName", "company", "email", "industry"] }
      ]
    });

    res.json(audits);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reassignLeadManually = async (req: Request, res: Response) => {
  try {
    const { leadId, newOwnerId, reason } = req.body;
    const caller: any = (req as any).user;

    if (!leadId || !newOwnerId) {
      return res.status(400).json({ error: "leadId and newOwnerId are required." });
    }

    const lead: any = await sequelize.models.Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const newOwner: any = await sequelize.models.User.findByPk(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({ error: "New owner user not found." });
    }

    const previousOwnerId = lead.assignedToId;

    // Update Lead with MANUAL protection tag
    await lead.update({
      assignedToId: newOwnerId,
      assignmentType: "MANUAL",
      assignmentMethod: "MANUAL"
    });

    // Create Audit Entry
    const audit = await sequelize.models.LeadAssignmentAudit.create({
      id: require("crypto").randomUUID(),
      leadId: lead.id,
      previousOwnerId,
      assignedToId: newOwnerId,
      assignmentType: "MANUAL",
      leadPriorityScore: 75,
      expectedRevenue: Number(lead.expectedValue || 0),
      candidateScores: JSON.stringify([]),
      winningScore: 100,
      reason: reason || `Manual reassign by manager (${caller?.name || 'Manager'}). Protected from automated reassignment.`,
      triggerSource: "manager_override",
      createdAt: new Date()
    });

    // Notify New Owner
    await createNotification(
      newOwnerId,
      "system",
      "Lead Assigned to You",
      `Lead ${lead.firstName} ${lead.lastName} (${lead.company || 'Prospect'}) was manually assigned to you by manager.`,
      `/leads/${lead.id}`
    );

    res.json({ message: "Lead reassigned successfully.", lead, audit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
