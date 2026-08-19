import { Request, Response } from "express";
import {
  getTeamForManager,
  getDealSplits,
  setDealSplits,
  deleteDealSplits
} from "../services/dealSplitService";
import { getStuckDeals } from "../services/dealHealthService";

const MANAGER_ROLES = ["manager", "admin", "director"];

/**
 * GET /manager/team
 * Returns the calling manager's direct reports.
 */
export async function getManagerTeamHandler(req: Request, res: Response) {
  try {
    const caller = (req as any).user;
    if (!caller || !caller.id) {
      return res.status(401).json({ error: "Unauthorized: User context missing" });
    }

    if (!caller.role || !MANAGER_ROLES.includes(caller.role.toLowerCase())) {
      return res.status(403).json({
        error: "Forbidden: Access restricted to sales managers and administrators."
      });
    }

    const team = await getTeamForManager(caller.id);
    return res.status(200).json({
      success: true,
      managerId: caller.id,
      team
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch manager team" });
  }
}

/**
 * GET /deals/:dealId/splits
 * Returns current commission splits (or synthesized default 100% to owner).
 */
export async function getDealSplitsHandler(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId);
    if (!dealId) {
      return res.status(400).json({ error: "dealId parameter is required" });
    }

    const result = await getDealSplits(dealId);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    const status = error.message?.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: error.message || "Failed to fetch deal splits" });
  }
}

/**
 * PUT /deals/:dealId/splits
 * Configures commission splits for a deal.
 * Requires role: manager, sales_manager, admin, director.
 */
export async function setDealSplitsHandler(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId);
    const { splits } = req.body;
    const caller = (req as any).user;

    if (!caller || !caller.id) {
      return res.status(401).json({ error: "Unauthorized: User context missing" });
    }

    if (!caller.role || !MANAGER_ROLES.includes(caller.role.toLowerCase())) {
      return res.status(403).json({
        error: "Forbidden: Only sales managers and administrators can configure deal commission splits."
      });
    }

    if (!splits || !Array.isArray(splits)) {
      return res.status(400).json({ error: "Request body must contain a 'splits' array" });
    }

    const result = await setDealSplits(dealId, splits, caller.id);
    return res.status(200).json({
      message: "Deal commission splits updated successfully",
      ...result
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Failed to configure deal splits" });
  }
}

/**
 * DELETE /deals/:dealId/splits
 * Reverts commission splits for a deal back to default.
 * Requires role: manager, sales_manager, admin, director.
 */
export async function deleteDealSplitsHandler(req: Request, res: Response) {
  try {
    const dealId = String(req.params.dealId);
    const caller = (req as any).user;

    if (!caller || !caller.id) {
      return res.status(401).json({ error: "Unauthorized: User context missing" });
    }

    if (!caller.role || !MANAGER_ROLES.includes(caller.role.toLowerCase())) {
      return res.status(403).json({
        error: "Forbidden: Only sales managers and administrators can configure deal commission splits."
      });
    }

    if (!dealId) {
      return res.status(400).json({ error: "dealId parameter is required" });
    }

    const result = await deleteDealSplits(dealId);
    return res.status(200).json({
      message: "Deal commission splits reverted to default",
      ...result
    });
  } catch (error: any) {
    const status = error.message?.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: error.message || "Failed to reset deal splits" });
  }
}

/**
 * GET /manager/stuck-deals?thresholdDays=14
 * Returns deals owned by the manager's team that have not been updated
 * in more than thresholdDays days (excluding closed and On Hold stages).
 * Restricted to manager / admin / director roles.
 */
export async function getStuckDealsHandler(req: Request, res: Response) {
  try {
    const caller = (req as any).user;
    if (!caller || !caller.id) {
      return res.status(401).json({ error: "Unauthorized: User context missing" });
    }

    if (!caller.role || !MANAGER_ROLES.includes(caller.role.toLowerCase())) {
      return res.status(403).json({
        error: "Forbidden: Access restricted to sales managers and administrators."
      });
    }

    const thresholdDays = Math.max(1, parseInt(String(req.query.thresholdDays || "14"), 10) || 14);

    const stuckDeals = await getStuckDeals(caller.id, thresholdDays);

    return res.status(200).json({
      success: true,
      managerId: caller.id,
      thresholdDays,
      count: stuckDeals.length,
      stuckDeals
    });
  } catch (error: any) {
    console.error("[getStuckDealsHandler] Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch stuck deals" });
  }
}
