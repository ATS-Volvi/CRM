import { Request, Response } from "express";
import { Op } from "sequelize";
import { sequelize } from "@nexus-crm/database";
import { getDealSplits, setDealSplits } from "../services/dealSplitService";

// ─── Helper: get calling user from request ────────────────────────────────────
function getCallerRole(req: Request): string {
  return (req as any).user?.role || "";
}
function getCallerId(req: Request): string {
  return (req as any).user?.id || "";
}

/**
 * @deprecated Use GET /api/v1/deals/:dealId/splits instead.
 * ─── GET /api/v1/deals/:dealId/owners ─────────────────────────────────────────
 */
export const getDealOwners = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const splitData = await getDealSplits(String(dealId));

    const owners = (splitData.splits || []).map((s: any) => ({
      id: s.id,
      dealId: s.dealId,
      userId: s.userId,
      splitPct: s.splitPercentage,
      role: null,
      user: s.rep,
      createdAt: s.createdAt || new Date(),
      updatedAt: s.updatedAt || new Date()
    }));

    res.json({ dealId, owners });
  } catch (err: any) {
    console.error("[getDealOwners]", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @deprecated Use PUT /api/v1/deals/:dealId/splits instead.
 * ─── PUT /api/v1/deals/:dealId/owners ─────────────────────────────────────────
 */
export const updateDealOwners = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const callerRole = getCallerRole(req);
    const callerId = getCallerId(req);

    if (!["admin", "manager", "director"].includes(callerRole)) {
      res.status(403).json({ error: "Only admin or manager can edit deal ownership splits." });
      return;
    }

    const { owners } = req.body as { owners: { userId: string; splitPct: number; role?: string }[] };

    if (!Array.isArray(owners) || owners.length === 0) {
      res.status(400).json({ error: "owners must be a non-empty array of { userId, splitPct, role? }" });
      return;
    }

    const splits = owners.map((o) => ({
      userId: o.userId,
      splitPercentage: Number(o.splitPct)
    }));

    const result = await setDealSplits(String(dealId), splits, callerId);

    const updatedOwners = (result.splits || []).map((s) => ({
      id: s.id,
      dealId: s.dealId,
      userId: s.userId,
      splitPct: s.splitPercentage,
      role: null,
      user: s.rep
    }));

    res.json({ dealId, owners: updatedOwners });
  } catch (err: any) {
    console.error("[updateDealOwners]", err);
    res.status(400).json({ error: err.message });
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
