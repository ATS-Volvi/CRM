import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import crypto from "crypto";

export async function reassignDeal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { toUserId, reason } = req.body;
    const adminOrManagerId = (req as any).user?.userId; // Assume auth middleware injects this

    if (!toUserId) {
      return res.status(400).json({ error: "Missing toUserId" });
    }

    const { Deal, User, DealReassignmentHistory } = sequelize.models;

    const deal: any = await Deal.findByPk(id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const newOwner: any = await User.findByPk(toUserId);
    if (!newOwner) return res.status(404).json({ error: "New assignee not found" });

    const oldOwnerId = deal.ownerId;
    const autoReason = `Manually reassigned to ${newOwner.name}`;
    const finalReason = reason && reason.trim() !== "" ? reason : autoReason;

    await sequelize.transaction(async (t) => {
      await deal.update({ ownerId: toUserId }, { transaction: t });

      await DealReassignmentHistory.create({
        id: crypto.randomUUID(),
        dealId: id,
        fromUserId: oldOwnerId,
        toUserId: toUserId,
        reason: finalReason,
        reassignedBy: adminOrManagerId
      }, { transaction: t });
    });

    res.json({ success: true, message: "Deal reassigned successfully", dealId: id });
  } catch (error) {
    console.error("Deal Reassign Error:", error);
    res.status(500).json({ error: "Failed to reassign deal" });
  }
}

export async function getFlaggedDeals(req: Request, res: Response) {
  try {
    // Flagged means no owner but has expected value > 0
    const { Deal, Lead } = sequelize.models;

    const flaggedDeals: any[] = await Deal.findAll({
      where: { ownerId: null }
    });

    const flaggedLeads: any[] = await Lead.findAll({
      where: { assignedToId: null }
    });

    res.json({
      success: true,
      data: {
        deals: flaggedDeals,
        leads: flaggedLeads
      }
    });
  } catch (error) {
    console.error("Get Flagged Deals Error:", error);
    res.status(500).json({ error: "Failed to fetch flagged items" });
  }
}
