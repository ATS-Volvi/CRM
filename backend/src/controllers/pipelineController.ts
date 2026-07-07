import { Request, Response } from "express";
import { Deal, PipelineStage, LeadStageHistory } from "@nexus-crm/database";

export const getPipeline = async (req: Request, res: Response) => {
  try {
    const stages = await PipelineStage.findAll({ order: [['order', 'ASC']] });
    const deals = await Deal.findAll();

    const pipeline = stages.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

      return {
        id: stage.id,
        stage: stage.name,
        totalValue,
        deals: stageDeals.map((d: any) => ({
          id: d.id,
          name: d.name,
          value: Number(d.amount),
          company: d.name, // Mocking company since it's not on Deal right now
          lastActivity: "2 days ago", // Mocking until Activity model
          isUrgent: false
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
    const { id } = req.params;
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

    // Update Deal
    deal.stageId = toStageId;
    if (toStageObj.name === "Lost") deal.lossReason = reason;
    if (toStageObj.name === "On Hold") deal.recontactDate = recontactDate;

    await deal.save();

    res.json({ message: "Stage updated successfully", deal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
