import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize } from "@nexus-crm/database";

// ─── Helper: get calling user from request ────────────────────────────────────
function getCallerRole(req: Request): string {
  return (req as any).user?.role || "";
}
function getCallerId(req: Request): string {
  return (req as any).user?.id || "";
}

// ─── GET /api/v1/deals/:dealId/owners ─────────────────────────────────────────
export const getDealOwners = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { DealOwner, User } = sequelize.models;

    const owners = await DealOwner.findAll({
      where: { dealId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role", "department"]
        }
      ],
      order: [["splitPct", "DESC"]]
    });

    res.json({ dealId, owners });
  } catch (err: any) {
    console.error("[getDealOwners]", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/v1/deals/:dealId/owners ─────────────────────────────────────────
// Body: { owners: [{ userId, splitPct, role }] }
// Auth: admin — unrestricted; manager — only if at least one owner is their direct report
export const updateDealOwners = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const callerRole = getCallerRole(req);
    const callerId = getCallerId(req);

    if (!["admin", "manager"].includes(callerRole)) {
      res.status(403).json({ error: "Only admin or manager can edit deal ownership splits." });
      return;
    }

    const { owners } = req.body as { owners: { userId: string; splitPct: number; role?: string }[] };

    if (!Array.isArray(owners) || owners.length === 0) {
      res.status(400).json({ error: "owners must be a non-empty array of { userId, splitPct, role? }" });
      return;
    }

    // Validate split percentages sum to 100
    const totalSplit = owners.reduce((sum, o) => sum + Number(o.splitPct), 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      res.status(400).json({ error: `Split percentages must sum to 100. Current sum: ${totalSplit}` });
      return;
    }

    const { DealOwner, User, Deal } = sequelize.models;

    // Manager scope check: must have at least one direct report among the owner userIds
    if (callerRole === "manager") {
      const directReportIds = (
        await User.findAll({
          where: { managerId: callerId },
          attributes: ["id"]
        })
      ).map((u: any) => u.id);

      const ownerUserIds = owners.map((o) => o.userId);
      const hasDirectReport = ownerUserIds.some((id) => directReportIds.includes(id));
      if (!hasDirectReport) {
        res.status(403).json({
          error: "Managers can only edit splits for deals that include their direct reports."
        });
        return;
      }
    }

    // Verify deal exists
    const deal = await Deal.findByPk(String(dealId));
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    // Replace all DealOwner rows for this deal in a transaction
    await sequelize.transaction(async (t) => {
      await DealOwner.destroy({ where: { dealId }, transaction: t });
      await DealOwner.bulkCreate(
        owners.map((o) => ({
          id: require("crypto").randomUUID(),
          dealId,
          userId: o.userId,
          splitPct: o.splitPct,
          role: o.role || null
        })),
        { transaction: t }
      );
    });

    const updated = await DealOwner.findAll({
      where: { dealId },
      include: [{ model: User, as: "user", attributes: ["id", "name", "role"] }],
      order: [["splitPct", "DESC"]]
    });

    res.json({ dealId, owners: updated });
  } catch (err: any) {
    console.error("[updateDealOwners]", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/v1/workspace/settings/:key ──────────────────────────────────────
export const getWorkspaceSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { WorkspaceSetting } = sequelize.models;

    const setting = await WorkspaceSetting.findOne({ where: { key } });
    if (!setting) {
      res.status(404).json({ error: `Workspace setting '${key}' not found` });
      return;
    }

    res.json(setting);
  } catch (err: any) {
    console.error("[getWorkspaceSetting]", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/v1/workspace/settings/:key ─────────────────────────────────────
// Admin only
export const updateWorkspaceSetting = async (req: Request, res: Response) => {
  try {
    const callerRole = getCallerRole(req);
    if (callerRole !== "admin") {
      res.status(403).json({ error: "Only admin can update workspace settings." });
      return;
    }

    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined || value === null) {
      res.status(400).json({ error: "value is required" });
      return;
    }

    const { WorkspaceSetting } = sequelize.models;
    const [setting, created] = await WorkspaceSetting.findOrCreate({
      where: { key },
      defaults: {
        id: require("crypto").randomUUID(),
        key,
        value: String(value),
        description: description || null,
        updatedBy: getCallerId(req)
      }
    });

    if (!created) {
      await (setting as any).update({
        value: String(value),
        description: description !== undefined ? description : (setting as any).description,
        updatedBy: getCallerId(req)
      });
    }

    res.json(await WorkspaceSetting.findOne({ where: { key } }));
  } catch (err: any) {
    console.error("[updateWorkspaceSetting]", err);
    res.status(500).json({ error: err.message });
  }
};
