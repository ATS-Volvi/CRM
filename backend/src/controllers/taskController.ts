import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

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
        { model: sequelize.models.Customer, as: "customer", attributes: ["id", "name", "email"] }
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
    const { title, description, priority, dueDate, reminderDate, ownerId, leadId, customerId } = req.body;
    const task = await sequelize.models.Task.create({
      id: require("crypto").randomUUID(),
      title,
      description,
      priority: priority || "Medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      status: "Pending",
      ownerId: ownerId || (req as any).user?.id || null,
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
        createdById: (req as any).user?.id || null
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
    const task = await sequelize.models.Task.findByPk(id as string);
    if (!task) return res.status(404).json({ error: "Task not found" });

    await task.update({ status });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
