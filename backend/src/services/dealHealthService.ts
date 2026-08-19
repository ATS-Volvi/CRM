import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { getTeamForManager } from "./dealSplitService";

const CLOSED_STAGE_NAMES = ["Won", "Lost", "Closed Won", "Closed Lost"];
const ON_HOLD_STAGE_NAMES = ["On Hold"];

export interface StuckDeal {
  id: string;
  name: string;
  amount: number;
  ownerName: string;
  ownerId: string;
  stageName: string;
  stageId: string;
  daysSinceUpdate: number;
  /** ISO timestamp of last updatedAt — NOTE: updatedAt is used as a proxy for last
   *  stage movement. It resets on ANY field edit, not just stage changes, so this
   *  is intentionally approximate. A rep editing notes weekly will not appear stuck
   *  here even if their stage hasn't moved. Acceptable for a first pass. */
  lastActivityAt: string;
}

/**
 * Returns open, non-On-Hold deals belonging to the manager's team that have not
 * been updated in more than `thresholdDays` days, sorted oldest-first.
 *
 * "Stuck" is determined by Deal.updatedAt (Sequelize automatic timestamp) as a proxy
 * for last stage movement. This is imprecise — updatedAt changes on any field edit,
 * not exclusively on stageId changes — but avoids a new migration column for this pass.
 */
export async function getStuckDeals(
  managerId: string,
  thresholdDays = 14
): Promise<StuckDeal[]> {
  const { Deal, PipelineStage, User } = sequelize.models;

  // 1. Resolve the manager's team (includes the manager themselves)
  const teamMembers = await getTeamForManager(managerId);
  const teamMemberIds = teamMembers.map((m: any) => m.id);
  const ownerIds = [managerId, ...teamMemberIds];

  // 2. Resolve closed stage IDs (reusing same list as dealAssignmentEngine.ts)
  const closedStages: any[] = await PipelineStage.findAll({
    where: { name: { [Op.in]: CLOSED_STAGE_NAMES } },
    attributes: ["id"]
  });
  const closedStageIds = closedStages.map((s: any) => s.id);

  // 3. Resolve On Hold stage IDs (deliberately parked — exclude from "stuck")
  const onHoldStages: any[] = await PipelineStage.findAll({
    where: { name: { [Op.in]: ON_HOLD_STAGE_NAMES } },
    attributes: ["id"]
  });
  const onHoldStageIds = onHoldStages.map((s: any) => s.id);

  const excludedStageIds = [...closedStageIds, ...onHoldStageIds];

  // 4. Compute the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

  // 5. Build stage filter — exclude closed + on-hold stages
  const stageFilter: any =
    excludedStageIds.length > 0
      ? {
          [Op.or]: [
            { [Op.is]: null },
            { [Op.notIn]: excludedStageIds }
          ]
        }
      : {};

  // 6. Query stuck deals
  const stuckDeals: any[] = await Deal.findAll({
    where: {
      ownerId: { [Op.in]: ownerIds },
      stageId: stageFilter,
      updatedAt: { [Op.lt]: cutoffDate }
    },
    include: [
      {
        model: PipelineStage,
        as: "stage",
        attributes: ["id", "name"]
      },
      {
        model: User,
        as: "owner",
        attributes: ["id", "name"]
      }
    ],
    order: [["updatedAt", "ASC"]] // oldest first = most stalled at top
  });

  const now = Date.now();

  return stuckDeals.map((d: any) => {
    const lastActivityAt = d.updatedAt as Date;
    const daysSinceUpdate = Math.floor(
      (now - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: d.id,
      name: d.name,
      amount: Number(d.amount || 0),
      ownerId: d.ownerId,
      ownerName: d.owner?.name || "Unassigned",
      stageId: d.stageId,
      stageName: d.stage?.name || "Unknown",
      daysSinceUpdate,
      lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : ""
    };
  });
}
