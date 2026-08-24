import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { checkRecordAccess } from "../services/handoffAccessService";

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { leadId, customerId, ownerId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (customerId) where.customerId = customerId;
    if (ownerId) where.ownerId = ownerId;

    const tasks = await sequelize.models.Task.findAll({
      where,
      include: [
        { model: sequelize.models.User, as: "owner", attributes: ["id", "name", "email"] },
        { model: sequelize.models.Lead, as: "lead", attributes: ["id", "firstName", "lastName", "company"] },
        { model: sequelize.models.Account, as: "customer", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, priority, dueDate, reminderDate, ownerId, leadId, dealId, customerId } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (leadId || dealId) {
      const access = await checkRecordAccess(userId, userRole, { leadId, dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This record has been reassigned to another representative.",
          isViewOnly: true
        });
      }
    }

    const task = await sequelize.models.Task.create({
      id: require("crypto").randomUUID(),
      title,
      description,
      priority: priority || "Medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      status: "Pending",
      ownerId: ownerId || userId || null,
      leadId: leadId || null,
      customerId: customerId || null
    });

    if (leadId) {
      await sequelize.models.Activity.create({
        id: require("crypto").randomUUID(),
        leadId,
        type: "Task",
        title: `Task Created: ${title}`,
        notes: description || `Priority: ${priority || "Medium"}`,
        createdById: userId || null,
        direction: "internal"
      });
    }

    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    const task: any = await sequelize.models.Task.findByPk(id as string);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.leadId || task.dealId) {
      const access = await checkRecordAccess(userId, userRole, { leadId: task.leadId, dealId: task.dealId });
      if (!access.canWrite) {
        return res.status(403).json({
          error: access.reason || "Handed off — view only. This task belongs to a reassigned record.",
          isViewOnly: true
        });
      }
    }

    await task.update({ status });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
