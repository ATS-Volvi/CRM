import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import bcrypt from "bcryptjs";

export const getMySettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const fullUser = await sequelize.models.User.findByPk(user.id, {
      attributes: ["id", "name", "email", "role", "isAvailable", "managerId"]
    });
    res.json(fullUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

import { reassignAbsentRepWorkload } from "../services/absenceReassignmentService";

export const updateMySettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { password, isAvailable, onLeave, status } = req.body;
    const dbUser = await sequelize.models.User.findByPk(user.id);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const updates: any = {};
    if (password !== undefined && password.trim() !== "") {
      updates.password = await bcrypt.hash(password, 10);
    }
    if (isAvailable !== undefined) {
      updates.isAvailable = !!isAvailable;
    }
    if (onLeave !== undefined) {
      updates.onLeave = !!onLeave;
    }
    if (status !== undefined) {
      updates.status = status;
    }

    await dbUser.update(updates);

    // If marked unavailable / absent / on leave, auto-reassign open workload
    let reassignmentSummary = null;
    if (updates.isAvailable === false || updates.onLeave === true || updates.status === "On Leave" || updates.status === "OOO") {
      reassignmentSummary = await reassignAbsentRepWorkload(user.id);
    }

    res.json({
      message: "Settings updated successfully",
      isAvailable: dbUser.toJSON().isAvailable,
      reassignmentSummary
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAvailability = async (req: Request, res: Response) => {
  try {
    const targetUserId = req.body.userId || (req as any).user?.id;
    if (!targetUserId) return res.status(400).json({ error: "User ID is required" });

    const { isAvailable, onLeave, status } = req.body;
    const user: any = await sequelize.models.User.findByPk(targetUserId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const updates: any = {};
    if (isAvailable !== undefined) updates.isAvailable = !!isAvailable;
    if (onLeave !== undefined) updates.onLeave = !!onLeave;
    if (status !== undefined) updates.status = status;

    await user.update(updates);

    // If rep marked unavailable / on leave, automatically reassign active workload to best-fit reps
    let reassignmentSummary = null;
    if (updates.isAvailable === false || updates.onLeave === true || updates.status === "On Leave" || updates.status === "OOO") {
      reassignmentSummary = await reassignAbsentRepWorkload(targetUserId);
    }

    res.json({
      message: `Availability updated for ${user.name || 'representative'}`,
      isAvailable: user.isAvailable,
      reassignmentSummary
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyTeam = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const team = await sequelize.models.User.findAll({
      where: { managerId: user.id },
      attributes: ["id", "name", "email", "role", "isAvailable", "managerId"]
    });
    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reassignTeamManager = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (!["admin", "director", "manager"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden: only managers, directors and admins can reassign team managers" });
    }

    const { memberId, managerId } = req.body;
    const member = await sequelize.models.User.findByPk(memberId);
    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Verify permission: non-admins can only reassign members they manage
    if (user.role !== "admin" && (member as any).managerId !== user.id) {
      return res.status(403).json({ error: "Forbidden: you can only reassign team members who report directly to you" });
    }

    await member.update({ managerId: managerId || null });
    res.json({ message: "Manager reassigned successfully", member });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDealValueCutoff = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || (user.role !== "manager" && user.role !== "admin")) {
      return res.status(403).json({ error: "Forbidden: Only managers or admins can update cutoffs" });
    }

    const { id } = req.params;
    let { dealValueCutoff } = req.body;

    const dbUser = await sequelize.models.User.findByPk(id as string);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    if (dealValueCutoff === undefined || dealValueCutoff === "" || dealValueCutoff === null) {
      dealValueCutoff = null; // null means unlimited
    } else {
      dealValueCutoff = Number(dealValueCutoff);
    }

    await dbUser.update({ dealValueCutoff });
    res.json({ message: "Deal value cutoff updated successfully", dealValueCutoff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
