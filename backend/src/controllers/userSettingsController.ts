import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import bcrypt from "bcrypt";

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

export const updateMySettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { password, isAvailable } = req.body;
    const dbUser = await sequelize.models.User.findByPk(user.id);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const updates: any = {};
    if (password !== undefined && password.trim() !== "") {
      updates.password = await bcrypt.hash(password, 10);
    }
    if (isAvailable !== undefined) {
      updates.isAvailable = !!isAvailable;
    }

    await dbUser.update(updates);
    res.json({ message: "Settings updated successfully", isAvailable: dbUser.toJSON().isAvailable });
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

    if (!["admin", "director", "sales_manager"].includes(user.role)) {
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
