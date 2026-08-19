import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { autoAssignDeal, manualReassignDeal, getOpenDealsCount } from "../services/dealAssignmentEngine";

/**
 * Helper to get caller ID from JWT token payload attached by authMiddleware.
 */
function getCallerId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId || "";
}

/**
 * POST /deals/:dealId/auto-assign
 * Automatically assigns a deal to the least-loaded eligible senior_ae under cutoff & capacity constraints.
 */
export async function autoAssignDealHandler(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId || req.params.id || "");
    if (!dealId) {
      return res.status(400).json({ error: "dealId parameter is required" });
    }

    const { Deal } = sequelize.models;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const callerId = getCallerId(req);
    const result = await autoAssignDeal(dealId, callerId);

    if (result && result.assigned) {
      return res.status(200).json({
        success: true,
        message: "Deal auto-assigned successfully",
        ...result
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "No eligible senior_ae found matching cutoff and capacity limits. Please assign manually.",
        ...result
      });
    }
  } catch (error: any) {
    console.error("[autoAssignDealHandler] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to auto-assign deal" });
  }
}

/**
 * POST /deals/:dealId/reassign
 * PUT  /deals/:id/reassign (backward-compatibility alias)
 * Manually reassigns a deal to a specified owner.
 * Reason is strictly REQUIRED. Overrides cutoff/capacity guardrails with audit flags.
 */
export async function reassignDeal(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId || req.params.id || "");
    const { newOwnerId, toUserId, reason } = req.body;
    const targetUserId = String(newOwnerId || toUserId || "");

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for manual reassignment" });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: "newOwnerId is required" });
    }

    const callerId = getCallerId(req);
    const result = await manualReassignDeal(dealId, targetUserId, reason.trim(), callerId);

    return res.status(200).json({
      success: true,
      message: "Deal reassigned successfully",
      ...result
    });
  } catch (error: any) {
    console.error("[reassignDeal] Error:", error);
    if (error.message === "Deal not found") {
      return res.status(404).json({ error: "Deal not found" });
    }
    if (error.message === "New assignee user not found") {
      return res.status(404).json({ error: "New assignee not found" });
    }
    return res.status(500).json({ error: error.message || "Failed to reassign deal" });
  }
}

/**
 * GET /deals/:dealId/reassignment-history
 * Returns the full reassignment audit history for a specific deal.
 */
export async function getDealReassignmentHistory(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId || req.params.id || "");
    const { DealReassignmentHistory, User, Deal } = sequelize.models;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const history = await DealReassignmentHistory.findAll({
      where: { dealId },
      include: [
        {
          model: User,
          as: "oldOwner",
          attributes: ["id", "name", "email", "role"]
        },
        {
          model: User,
          as: "newOwner",
          attributes: ["id", "name", "email", "role"]
        },
        {
          model: User,
          as: "changedByUser",
          attributes: ["id", "name", "email", "role"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.status(200).json({
      success: true,
      dealId,
      history
    });
  } catch (error: any) {
    console.error("[getDealReassignmentHistory] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch deal reassignment history" });
  }
}

/**
 * GET /settings/deal-assignment-cutoffs
 * Lists senior_ae users with their dealValueCutoff, maxOpenDeals, isAvailable status and active open deals.
 */
export async function getDealAssignmentCutoffs(req: Request, res: Response) {
  try {
    const { User } = sequelize.models;

    const seniorAes: any[] = await User.findAll({
      where: { role: "senior_ae" },
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "dealValueCutoff",
        "maxOpenDeals",
        "isAvailable",
        "department",
        "territory",
        "status"
      ],
      order: [["name", "ASC"]]
    });

    const repsWithLoad = await Promise.all(
      seniorAes.map(async (rep) => {
        const openDealsCount = await getOpenDealsCount(rep.id);
        return {
          id: rep.id,
          name: rep.name,
          email: rep.email,
          role: rep.role,
          dealValueCutoff: rep.dealValueCutoff !== null && rep.dealValueCutoff !== undefined ? Number(rep.dealValueCutoff) : null,
          maxOpenDeals: rep.maxOpenDeals !== null && rep.maxOpenDeals !== undefined ? Number(rep.maxOpenDeals) : null,
          isAvailable: rep.isAvailable,
          department: rep.department,
          territory: rep.territory,
          status: rep.status,
          currentOpenDeals: openDealsCount
        };
      })
    );

    return res.status(200).json({
      success: true,
      users: repsWithLoad
    });
  } catch (error: any) {
    console.error("[getDealAssignmentCutoffs] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch deal assignment settings" });
  }
}

/**
 * PUT /settings/deal-assignment-cutoffs/:userId
 * Updates dealValueCutoff and/or maxOpenDeals for a senior_ae user.
 */
export async function updateDealAssignmentCutoffs(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId || req.params.id || "");
    const { dealValueCutoff, maxOpenDeals } = req.body;

    const { User } = sequelize.models;
    const user: any = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "senior_ae") {
      return res.status(400).json({ error: "User is not a senior_ae" });
    }

    const updates: any = {};

    if (dealValueCutoff !== undefined) {
      if (dealValueCutoff === null || dealValueCutoff === "") {
        updates.dealValueCutoff = null;
      } else {
        const val = Number(dealValueCutoff);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ error: "dealValueCutoff must be a non-negative number or null" });
        }
        updates.dealValueCutoff = val;
      }
    }

    if (maxOpenDeals !== undefined) {
      if (maxOpenDeals === null || maxOpenDeals === "") {
        updates.maxOpenDeals = null;
      } else {
        const val = Number(maxOpenDeals);
        if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
          return res.status(400).json({ error: "maxOpenDeals must be a non-negative integer or null" });
        }
        updates.maxOpenDeals = val;
      }
    }

    await user.update(updates);

    return res.status(200).json({
      success: true,
      message: "Deal assignment settings updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dealValueCutoff: user.dealValueCutoff !== null && user.dealValueCutoff !== undefined ? Number(user.dealValueCutoff) : null,
        maxOpenDeals: user.maxOpenDeals !== null && user.maxOpenDeals !== undefined ? Number(user.maxOpenDeals) : null,
        isAvailable: user.isAvailable
      }
    });
  } catch (error: any) {
    console.error("[updateDealAssignmentCutoffs] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update deal assignment settings" });
  }
}

/**
 * GET /deals/flagged
 * Returns unassigned deals and leads requiring attention.
 */
export async function getFlaggedDeals(req: Request, res: Response) {
  try {
    const { Deal, Lead } = sequelize.models;

    const flaggedDeals: any[] = await Deal.findAll({
      where: { ownerId: null }
    });

    const flaggedLeads: any[] = await Lead.findAll({
      where: { assignedToId: null }
    });

    return res.json({
      success: true,
      data: {
        deals: flaggedDeals,
        leads: flaggedLeads
      }
    });
  } catch (error) {
    console.error("[getFlaggedDeals] Error:", error);
    return res.status(500).json({ error: "Failed to fetch flagged items" });
  }
}
