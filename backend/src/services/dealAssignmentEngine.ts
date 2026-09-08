import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { createNotification } from "./notificationEngine";

/**
 * Returns the count of open (non-Won/Lost) deals currently assigned to a user.
 * Open deal = deal whose PipelineStage.name is NOT in ["Won", "Lost", "Closed Won", "Closed Lost"]
 */
export async function getOpenDealsCount(userId: string): Promise<number> {
  const { Deal, PipelineStage } = sequelize.models;

  const closedStages: any[] = await PipelineStage.findAll({
    where: {
      name: {
        [Op.in]: ["Won", "Lost", "Closed Won", "Closed Lost"]
      }
    },
    attributes: ["id"]
  });
  const closedStageIds = closedStages.map((s: any) => s.id);

  const dealWhere: any = { ownerId: userId };
  if (closedStageIds.length > 0) {
    dealWhere.stageId = { [Op.notIn]: closedStageIds };
  }

  return await Deal.count({ where: dealWhere });
}

/**
 * Auto-assigns a Deal to the least-loaded eligible senior_ae.
 * Hard filters:
 *  - role === "senior_ae"
 *  - isAvailable === true
 *  - dealValueCutoff is null OR >= deal.amount
 *  - current open-deal count < maxOpenDeals (or maxOpenDeals is null)
 * 
 * If no eligible senior_ae is found, does not assign (keeps current owner) and returns { assigned: false }.
 */
export async function autoAssignDeal(
  dealIdOrEntityId: string,
  triggeredByUserIdOrExpectedValue?: string | number,
  externalTransaction?: any
): Promise<any> {
  const { Deal, User, DealReassignmentHistory } = sequelize.models;
  const { assignOpportunityCloser } = require("./assignmentEngine");

  const runAssignment = async (t: any) => {
    let deal: any = null;
    let dealAmount = 0;
    let changedByUserId: string | null = null;

    if (typeof triggeredByUserIdOrExpectedValue === "number") {
      dealAmount = triggeredByUserIdOrExpectedValue;
    }

    deal = await Deal.findByPk(dealIdOrEntityId, { transaction: t });
    if (deal) {
      dealAmount = Number(deal.amount || 0);
      if (typeof triggeredByUserIdOrExpectedValue === "string") {
        changedByUserId = triggeredByUserIdOrExpectedValue;
      }
    }

    const context = {
      dealId: deal?.id || dealIdOrEntityId,
      expectedValue: dealAmount,
      company: deal?.name || "Auto-Assign Deal"
    };

    const assignResult = await assignOpportunityCloser(context, {
      excludeRepId: deal?.ownerId
    });

    if (!assignResult || !assignResult.assigned || !assignResult.closerId) {
      console.log(
        `[autoAssignDeal] No eligible closer found for deal ${dealIdOrEntityId} (amount: ${dealAmount}). Reason: ${assignResult?.reason}`
      );
      await triggerManagerNotification(dealIdOrEntityId, dealAmount, "unassigned (no eligible closer within cutoff/capacity)");

      if (!deal) return null;

      return {
        assigned: false,
        dealId: deal.id,
        deal,
        reason: assignResult?.reason || "No eligible closer available within cutoff and capacity constraints"
      };
    }

    const winnerId = assignResult.closerId;
    const winner: any = await User.findByPk(winnerId, { transaction: t });

    if (!deal) {
      return winnerId;
    }

    const oldOwnerId = deal.ownerId || null;
    const auditChangedBy = changedByUserId || winnerId;

    await deal.update({ ownerId: winnerId }, { transaction: t });

    await DealReassignmentHistory.create(
      {
        id: crypto.randomUUID(),
        dealId: deal.id,
        oldOwnerId: oldOwnerId,
        newOwnerId: winnerId,
        changedByUserId: auditChangedBy,
        assignmentType: "AUTOMATIC",
        dealAmountAtReassignment: deal.amount !== undefined && deal.amount !== null ? Number(deal.amount) : null,
        exceededCutoff: false,
        exceededCapacity: false,
        reason: assignResult.reason || `Auto-assigned to ${winner?.name || winnerId} via Opportunity Closer Engine`
      },
      { transaction: t }
    );

    return {
      assigned: true,
      dealId: deal.id,
      newOwnerId: winnerId,
      deal,
      oldOwnerId,
      assignee: assignResult.assignee,
      subTeamRoutingMethod: assignResult.subTeamRoutingMethod
    };
  };

  if (externalTransaction) {
    return await runAssignment(externalTransaction);
  } else {
    try {
      return await sequelize.transaction(async (t) => await runAssignment(t));
    } catch (err: any) {
      if (err.message && err.message.includes("SQLITE_BUSY")) {
        console.warn("[autoAssignDeal] SQLITE_BUSY encountered; retrying without isolated transaction wrapper...");
        return await runAssignment(null);
      }
      throw err;
    }
  }
}

/**
 * Manual deal reassignment by manager or admin.
 * Requires a non-blank reason.
 * Allowed to exceed the new owner's cutoff and/or capacity, but computes and records whether it does.
 */
export async function manualReassignDeal(
  dealId: string,
  newOwnerId: string,
  reason: string,
  changedByUserId: string
): Promise<any> {
  const { Deal, User, DealReassignmentHistory } = sequelize.models;

  if (!reason || !reason.trim()) {
    throw new Error("Reason is required for manual reassignment");
  }

  if (!newOwnerId) {
    throw new Error("New owner ID is required");
  }

  const deal: any = await Deal.findByPk(dealId);
  if (!deal) {
    throw new Error("Deal not found");
  }

  const newOwner: any = await User.findByPk(newOwnerId);
  if (!newOwner) {
    throw new Error("New assignee user not found");
  }

  const dealAmount = Number(deal.amount || 0);

  // Compute exceededCutoff
  const exceededCutoff =
    newOwner.dealValueCutoff !== null &&
    newOwner.dealValueCutoff !== undefined &&
    dealAmount > Number(newOwner.dealValueCutoff);

  // Compute exceededCapacity (current open deals >= maxOpenDeals)
  const currentOpenDeals = await getOpenDealsCount(newOwner.id);
  const exceededCapacity =
    newOwner.maxOpenDeals !== null &&
    newOwner.maxOpenDeals !== undefined &&
    currentOpenDeals >= Number(newOwner.maxOpenDeals);

  const oldOwnerId = deal.ownerId || null;
  let historyRecord: any = null;

  await sequelize.transaction(async (t) => {
    await deal.update({ ownerId: newOwner.id }, { transaction: t });

    historyRecord = await DealReassignmentHistory.create(
      {
        id: crypto.randomUUID(),
        dealId: deal.id,
        oldOwnerId: oldOwnerId,
        newOwnerId: newOwner.id,
        changedByUserId: changedByUserId || newOwner.id,
        assignmentType: "MANUAL",
        dealAmountAtReassignment: deal.amount !== undefined && deal.amount !== null ? Number(deal.amount) : null,
        exceededCutoff,
        exceededCapacity,
        reason: reason.trim()
      },
      { transaction: t }
    );
  });

  return {
    success: true,
    dealId: deal.id,
    oldOwnerId,
    newOwnerId: newOwner.id,
    newOwner: {
      id: newOwner.id,
      name: newOwner.name,
      email: newOwner.email
    },
    exceededCutoff,
    exceededCapacity,
    reassignmentHistory: historyRecord
  };
}

export async function triggerManagerNotification(
  entityId: string,
  expectedValue: number,
  currentAssignee: string
) {
  const { User } = sequelize.models;
  const managers: any[] = await User.findAll({ where: { role: "manager" } });

  for (const manager of managers) {
    await createNotification({
      userId: manager.id,
      type: "HIGH_VALUE_LEAD",
      title: "High Value Lead/Deal Requires Attention",
      message: `A lead/deal valued at $${expectedValue} was flagged. Currently assigned to: ${currentAssignee}.`,
      entityId: entityId,
      entityType: "SYSTEM"
    });
  }
}
