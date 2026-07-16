import { Request, Response } from "express";
import { Deal, PipelineStage, LeadStageHistory, Activity, User, sequelize } from "@nexus-crm/database";
import { createNotification } from "../services/notificationService";

export const getPipeline = async (req: Request, res: Response) => {
  try {
    const stages = await PipelineStage.findAll({ order: [['order', 'ASC']] });
    const deals = await Deal.findAll();

    const stageToGroupMap: { [key: string]: string } = {
      "New": "Prospecting",
      "Contacted": "Prospecting",
      "Qualified": "Prospecting",
      "Meeting/Demo": "Active Deal",
      "Proposal": "Active Deal",
      "Negotiation": "Active Deal",
      "Won": "Closed",
      "Lost": "Closed",
      "On Hold": "Closed"
    };

    const pipeline = stages.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

      return {
        id: stage.id,
        stage: stage.name,
        group: stageToGroupMap[stage.name] || "Prospecting",
        totalValue,
        deals: stageDeals.map((d: any) => ({
          id: d.id,
          name: d.name,
          value: Number(d.amount),
          company: d.name, // Mocking company since it's not on Deal right now
          lastActivity: "2 days ago", // Mocking until Activity model
          isUrgent: false,
          competitors: d.competitors,
          probability: d.probability,
          group: stageToGroupMap[stage.name] || "Prospecting"
        }))
      };
    });

    res.json(pipeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const moveDealStage = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { toStageId, reason, recontactDate } = req.body;
    const userId = (req as any).user?.id || "mock-user"; // Fallback to mock user if auth is bypassed

    const deal: any = await Deal.findByPk(id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const fromStageId = deal.stageId;
    
    // Get stage names for history
    const fromStageObj: any = await PipelineStage.findByPk(fromStageId);
    const toStageObj: any = await PipelineStage.findByPk(toStageId);

    if (toStageObj.name === "Lost" && !reason) {
      return res.status(400).json({ error: "Loss reason is required." });
    }
    if (toStageObj.name === "On Hold" && (!reason || !recontactDate)) {
      return res.status(400).json({ error: "Reason and re-contact date are required for On Hold." });
    }

    // Write history
    await LeadStageHistory.create({
      leadId: deal.leadId || id, // Fallback to deal id if leadId is null for now
      fromStage: fromStageObj ? fromStageObj.name : 'Unknown',
      toStage: toStageObj ? toStageObj.name : 'Unknown',
      changedById: userId,
      reason: reason || null
    });

    // Write Activity
    await Activity.create({
      leadId: deal.leadId || id,
      type: "stage_change",
      outcome: `Stage updated to ${toStageObj ? toStageObj.name : 'Unknown'}${reason ? ' - Reason: ' + reason : ''}`,
      createdById: userId
    });

    // Update Deal
    if (toStageId) deal.stageId = toStageId;
    if (toStageObj && toStageObj.name === "Lost") deal.lossReason = reason;
    if (toStageObj && toStageObj.name === "On Hold") deal.recontactDate = recontactDate;
    if (req.body.competitors !== undefined) deal.competitors = req.body.competitors;
    if (req.body.probability !== undefined) deal.probability = req.body.probability;

    await deal.save();

    if (toStageObj.name === "Won") {
      await createNotification(
        deal.ownerId,
        'success',
        'Deal Won! 🎉',
        `Congratulations! The deal ${deal.name} was marked as Won.`,
        `/pipeline`
      );
    } else if (toStageObj.name === "Lost" && deal.leadId) {
      const existing = await sequelize.models.ScheduledEmail.findOne({
        where: { leadId: deal.leadId, templateName: "deal_lost_feedback", sentAt: null }
      });
      
      if (!existing) {
        const sendAfterDate = new Date();
        sendAfterDate.setDate(sendAfterDate.getDate() + 2); // 2 days from now
        
        await sequelize.models.ScheduledEmail.create({
          id: require('crypto').randomUUID(),
          leadId: deal.leadId,
          templateName: "deal_lost_feedback",
          sendAfter: sendAfterDate
        });
      }
    }

    res.json({ message: "Stage updated successfully", deal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDeal = async (req: Request, res: Response) => {
  try {
    const { name, amount, stageId, leadId, competitors, probability } = req.body;
    const adminUser = await sequelize.models.User.findOne({ where: { role: 'admin' } });
    const userId = (req as any).user?.id || (adminUser ? (adminUser as any).id : null);

    // Default to the first stage if no stageId provided
    let targetStageId = stageId;
    if (!targetStageId) {
       const firstStage = await PipelineStage.findOne({ order: [['order', 'ASC']] });
       if (firstStage) {
          targetStageId = firstStage.id;
       }
    }

    let customerId: string | null = null;
    if (leadId) {
      const lead = await sequelize.models.Lead.findByPk(leadId);
      if (lead) {
        customerId = (lead as any).customerId;
      }
    }

    const deal = await Deal.create({
      id: require('crypto').randomUUID(),
      name,
      amount,
      stageId: targetStageId,
      leadId: leadId || null,
      competitors: competitors || null,
      probability: probability !== undefined ? probability : null,
      ownerId: userId,
      customerId
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeals = async (req: Request, res: Response) => {
  try {
    const deals = await Deal.findAll({
      include: [
        { model: PipelineStage, as: "stage" }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
