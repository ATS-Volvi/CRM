import { Request, Response } from "express";
import { Activity } from "@nexus-crm/database";

export const getLeadActivities = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const activities = await Activity.findAll({ 
      where: { leadId },
      order: [
        ['pinned', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { type, duration, outcome, mentioned_user_ids, pinned, dueDate, priority, isCompleted } = req.body;
    const userId = (req as any).user?.id || "mock-user";

    // Validate tasks have a due date
    if (type === "task" && !dueDate) {
      return res.status(400).json({ error: "Tasks must have a due date." });
    }

    const activity = await Activity.create({
      id: require('crypto').randomUUID(),
      leadId,
      type,
      duration,
      outcome,
      mentioned_user_ids: mentioned_user_ids ? JSON.stringify(mentioned_user_ids) : "[]",
      pinned: pinned || false,
      createdById: userId,
      dueDate: dueDate || null,
      priority: priority || null,
      isCompleted: isCompleted || false
    });

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const togglePinActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const activity: any = await Activity.findByPk(id);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    activity.pinned = !activity.pinned;
    await activity.save();
    
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const completeTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await Activity.findByPk(id as string);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if ((task as any).type !== "task") {
      return res.status(400).json({ error: "This activity is not a task" });
    }

    await task.update({ isCompleted: true });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOverdueTasks = async (req: Request, res: Response) => {
  try {
    const { Op } = require("sequelize");
    const overdue = await Activity.findAll({
      where: {
        type: "task",
        isCompleted: false,
        dueDate: {
          [Op.lt]: new Date()
        }
      },
      order: [["dueDate", "ASC"]]
    });
    res.json(overdue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

