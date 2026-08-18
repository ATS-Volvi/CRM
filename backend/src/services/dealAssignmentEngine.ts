import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { createNotification } from "./notificationEngine";

export async function autoAssignDeal(entityId: string, expectedValue: number): Promise<string | null> {
  const { User } = sequelize.models;

  // Find all eligible senior AEs (who are available)
  const seniorAes: any[] = await User.findAll({
    where: {
      role: { [Op.or]: ["senior_ae", "manager"] },
      isAvailable: true
    }
  });

  // Filter candidates by dealValueCutoff
  const eligibleReps = seniorAes.filter((rep) => {
    // If dealValueCutoff is null, they have unlimited capacity
    if (rep.dealValueCutoff === null || rep.dealValueCutoff === undefined) return true;
    return Number(rep.dealValueCutoff) >= expectedValue;
  });

  if (eligibleReps.length === 0) {
    console.log(`[autoAssignDeal] No eligible reps found for deal/lead ${entityId} with value ${expectedValue}. Triggering HIGH_VALUE_LEAD notification.`);
    await triggerManagerNotification(entityId, expectedValue, "unassigned");
    return null; // Leave unassigned
  }

  // Tie-break: lowest (maxActiveOpportunities - currently assigned active Deals)
  // We'll calculate current workload for each eligible rep.
  // First, get the stage IDs for Closed Won and Closed Lost so we can exclude them.
  const closedStages = await sequelize.models.PipelineStage.findAll({
    where: { name: { [Op.in]: ["Closed Won", "Closed Lost"] } },
    attributes: ["id"]
  });
  const closedStageIds = closedStages.map((s: any) => s.id);

  const repWorkloads = await Promise.all(
    eligibleReps.map(async (rep) => {
      const activeDeals = await sequelize.models.Deal.count({
        where: {
          ownerId: rep.id,
          stageId: { 
            [Op.and]: [
              { [Op.ne]: null },
              { [Op.notIn]: closedStageIds }
            ]
          } // Only count deals in active stages
        }
      });
      // capacity = maxActiveOpportunities - activeDeals
      const capacity = Number(rep.maxActiveOpportunities) - activeDeals;
      return { rep, activeDeals, capacity };
    })
  );

  // Filter out reps who are at or over capacity (capacity <= 0)
  const repsWithCapacity = repWorkloads.filter(rw => rw.capacity > 0);

  if (repsWithCapacity.length === 0) {
    console.log(`[autoAssignDeal] All eligible reps for value ${expectedValue} are at capacity. Triggering notification.`);
    await triggerManagerNotification(entityId, expectedValue, "unassigned (reps at capacity)");
    return null; // Leave unassigned
  }

  // Sort by capacity descending (highest remaining capacity wins)
  repsWithCapacity.sort((a, b) => b.capacity - a.capacity);

  const winner = repsWithCapacity[0].rep;
  return winner.id;
}

export async function triggerManagerNotification(entityId: string, expectedValue: number, currentAssignee: string) {
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
