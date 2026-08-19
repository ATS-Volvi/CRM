import { sequelize, Deal, User, DealSplit } from "@nexus-crm/database";
import { Op } from "sequelize";
import { getOpenDealsCount } from "./dealAssignmentEngine";

const VALID_SPLIT_ROLES = ["senior_ae", "sales_rep", "manager", "admin", "director"];

export interface SplitInput {
  userId: string;
  splitPercentage: number;
}

/**
 * Returns all direct reports for a manager along with their live open deals count.
 */
export async function getTeamForManager(managerId: string) {
  const teamMembers: any[] = await User.findAll({
    where: { managerId },
    attributes: [
      "id",
      "name",
      "email",
      "role",
      "isAvailable",
      "dealValueCutoff",
      "maxOpenDeals",
      "department",
      "territory",
      "managerId"
    ],
    order: [["name", "ASC"]]
  });

  const enrichedTeam = await Promise.all(
    teamMembers.map(async (member) => {
      const currentOpenDeals = await getOpenDealsCount(member.id);
      return {
        ...member.toJSON(),
        currentOpenDeals
      };
    })
  );

  return enrichedTeam;
}

/**
 * Returns DealSplit rows for a deal, or synthesizes a 100% default to Deal.ownerId if unconfigured.
 */
export async function getDealSplits(dealId: string) {
  const existingSplits: any[] = await DealSplit.findAll({
    where: { dealId },
    include: [
      {
        model: User,
        as: "rep",
        attributes: ["id", "name", "email", "role", "managerId", "isAvailable"]
      },
      {
        model: User,
        as: "configuredBy",
        attributes: ["id", "name", "email", "role"]
      }
    ],
    order: [["splitPercentage", "DESC"]]
  });

  if (existingSplits && existingSplits.length > 0) {
    return {
      isDefault: false,
      dealId,
      splits: existingSplits.map((s) => ({
        id: s.id,
        dealId: s.dealId,
        userId: s.userId,
        splitPercentage: Number(s.splitPercentage),
        configuredByUserId: s.configuredByUserId,
        isCrossTeam: s.isCrossTeam,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        rep: s.rep,
        configuredBy: s.configuredBy
      }))
    };
  }

  // Synthesize default 100% split to deal owner
  const deal: any = await Deal.findByPk(dealId, {
    include: [
      {
        model: User,
        as: "owner",
        attributes: ["id", "name", "email", "role", "managerId", "isAvailable"]
      }
    ]
  });

  if (!deal) {
    throw new Error(`Deal not found with id: ${dealId}`);
  }

  const defaultSplits = deal.owner
    ? [
        {
          id: "default-owner-split",
          dealId: deal.id,
          userId: deal.owner.id,
          splitPercentage: 100.0,
          configuredByUserId: null,
          isCrossTeam: false,
          rep: deal.owner,
          configuredBy: null
        }
      ]
    : [];

  return {
    isDefault: true,
    dealId: deal.id,
    splits: defaultSplits
  };
}

/**
 * Configures commission splits for a deal atomically in a transaction.
 * Validates sum equals 100% and marks isCrossTeam = true if rep does not report to configuredByUserId.
 */
export async function setDealSplits(
  dealId: string,
  splits: SplitInput[],
  configuredByUserId: string
) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new Error("At least one split entry must be provided.");
  }

  // 1. Verify Deal exists
  const deal = await Deal.findByPk(dealId);
  if (!deal) {
    throw new Error(`Deal not found with id: ${dealId}`);
  }

  // 2. Validate percentage sum equals 100
  let totalPercentage = 0;
  for (const s of splits) {
    const pct = Number(s.splitPercentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      throw new Error(`Invalid split percentage: ${s.splitPercentage}. Each percentage must be between 0 and 100.`);
    }
    totalPercentage += pct;
  }

  const roundedSum = Math.round(totalPercentage * 100) / 100;
  if (Math.abs(roundedSum - 100) > 0.01) {
    throw new Error(`Split percentages must sum to exactly 100.00% (currently ${roundedSum.toFixed(2)}%).`);
  }

  // 3. Validate rep users and check reporting structure
  const userIds = splits.map((s) => s.userId);
  const distinctUserIds = new Set(userIds);
  if (distinctUserIds.size !== userIds.length) {
    throw new Error("Duplicate user entries are not allowed in a split configuration.");
  }

  const users: any[] = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ["id", "name", "email", "role", "managerId", "isAvailable"]
  });

  if (users.length !== userIds.length) {
    const foundIds = new Set(users.map((u) => u.id));
    const missingIds = userIds.filter((id) => !foundIds.has(id));
    throw new Error(`Invalid rep user ID(s): ${missingIds.join(", ")}`);
  }

  const userMap = new Map<string, any>(users.map((u) => [u.id, u]));

  for (const userId of userIds) {
    const u = userMap.get(userId);
    if (!u) continue;
    if (u.role && !VALID_SPLIT_ROLES.includes(u.role)) {
      throw new Error(`User ${u.name} has role "${u.role}" which is ineligible for deal splits.`);
    }
  }

  // 4. Atomic transaction to replace splits
  return await sequelize.transaction(async (t) => {
    await DealSplit.destroy({
      where: { dealId },
      transaction: t
    });

    const recordsToCreate = splits.map((s) => {
      const rep = userMap.get(s.userId);
      const isCrossTeam = rep ? rep.managerId !== configuredByUserId : false;

      return {
        dealId,
        userId: s.userId,
        splitPercentage: Number(s.splitPercentage),
        configuredByUserId,
        isCrossTeam
      };
    });

    const created = await DealSplit.bulkCreate(recordsToCreate, {
      transaction: t,
      returning: true
    });

    const enrichedSplits = created.map((row: any) => {
      const rep = userMap.get(row.userId);
      return {
        id: row.id,
        dealId: row.dealId,
        userId: row.userId,
        splitPercentage: Number(row.splitPercentage),
        configuredByUserId: row.configuredByUserId,
        isCrossTeam: row.isCrossTeam,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        rep: rep
          ? {
              id: rep.id,
              name: rep.name,
              email: rep.email,
              role: rep.role,
              managerId: rep.managerId,
              isAvailable: rep.isAvailable
            }
          : null
      };
    });

    return {
      success: true,
      isDefault: false,
      dealId,
      splits: enrichedSplits
    };
  });
}

/**
 * Deletes all explicit splits for a deal, reverting back to the synthesized default 100% to owner.
 */
export async function deleteDealSplits(dealId: string) {
  const deal = await Deal.findByPk(dealId);
  if (!deal) {
    throw new Error(`Deal not found with id: ${dealId}`);
  }

  await DealSplit.destroy({
    where: { dealId }
  });

  return await getDealSplits(dealId);
}
