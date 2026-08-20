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

  const stageFilter: any = closedStageIds.length > 0
    ? {
        [Op.or]: [
          { [Op.is]: null },
          { [Op.notIn]: closedStageIds }
        ]
      }
    : {};

  return await Deal.count({
    where: {
      ownerId: userId,
      stageId: stageFilter
    }
  });
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
  triggeredByUserIdOrExpectedValue?: string | number
): Promise<any> {
  const { Deal, User, DealReassignmentHistory, PipelineStage } = sequelize.models;

  return await sequelize.transaction(async (t) => {
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

    // 1. Fetch available senior_ae users
    const seniorAes: any[] = await User.findAll({
      where: {
        role: "senior_ae",
        [Op.or]: [
          { isAvailable: true },
          { isAvailable: { [Op.is]: null } }
        ]
      },
      transaction: t
    });

    // 2. Closed stages for capacity counting
    const closedStages: any[] = await PipelineStage.findAll({
      where: {
        name: {
          [Op.in]: ["Won", "Lost", "Closed Won", "Closed Lost"]
        }
      },
      attributes: ["id"],
      transaction: t
    });
    const closedStageIds = closedStages.map((s: any) => s.id);

    const stageFilter: any = closedStageIds.length > 0
      ? {
          [Op.or]: [
            { [Op.is]: null },
            { [Op.notIn]: closedStageIds }
          ]
        }
      : {};

    // 3. Filter candidates by cutoff AND capacity (both are HARD filters)
    const candidateEvaluations = await Promise.all(
      seniorAes.map(async (rep) => {
        const openDealsCount = await Deal.count({
          where: {
            ownerId: rep.id,
            stageId: stageFilter
          },
          transaction: t
        });

        // Cutoff check: null = uncapped
        const withinCutoff =
          rep.dealValueCutoff === null ||
          rep.dealValueCutoff === undefined ||
          Number(rep.dealValueCutoff) >= dealAmount;

        // Capacity check: null = uncapped
        const withinCapacity =
          rep.maxOpenDeals === null ||
          rep.maxOpenDeals === undefined ||
          openDealsCount < Number(rep.maxOpenDeals);

        return {
          rep,
          openDealsCount,
          withinCutoff,
          withinCapacity,
          isEligible: withinCutoff && withinCapacity
        };
      })
    );

    const eligibleCandidates = candidateEvaluations.filter((c) => c.isEligible);

    // 4. If no one is eligible, do NOT throw and do NOT force-assign
    if (eligibleCandidates.length === 0) {
      console.log(
        `[autoAssignDeal] No eligible senior_ae found for deal ${dealIdOrEntityId} (amount: ${dealAmount}).`
      );
      await triggerManagerNotification(dealIdOrEntityId, dealAmount, "unassigned (no eligible senior_ae within cutoff/capacity)");

      if (!deal) {
        return null;
      }

      return {
        assigned: false,
        dealId: deal.id,
        deal,
        reason: "No eligible senior_ae available within cutoff and capacity constraints"
      };
    }

    // 5. Tie-break: fewest open deals (least loaded)
    eligibleCandidates.sort((a, b) => a.openDealsCount - b.openDealsCount);
    const winner = eligibleCandidates[0].rep;

    if (!deal) {
      return winner.id;
    }

    // 6. Assign deal and record audit history
    const oldOwnerId = deal.ownerId || null;
    const auditChangedBy = changedByUserId || winner.id;

    await deal.update({ ownerId: winner.id }, { transaction: t });

    const historyRecord = await DealReassignmentHistory.create(
      {
        id: crypto.randomUUID(),
        dealId: deal.id,
        oldOwnerId: oldOwnerId,
        newOwnerId: winner.id,
        changedByUserId: auditChangedBy,
        assignmentType: "AUTOMATIC",
        dealAmountAtReassignment: deal.amount !== undefined && deal.amount !== null ? Number(deal.amount) : null,
        exceededCutoff: false,
        exceededCapacity: false,
        reason: `Auto-assigned to ${winner.name} (least loaded senior_ae with ${eligibleCandidates[0].openDealsCount} open deals)`
      },
      { transaction: t }
    );

    return {
      assigned: true,
      dealId: deal.id,
      newOwnerId: winner.id,
      deal,
      oldOwnerId
    };
  });
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
