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
    const { type, duration, outcome, mentioned_user_ids, pinned, notes } = req.body;
    const userId = (req as any).user?.id || "mock-user";

    const activity = await Activity.create({
      leadId,
      type,
      duration,
      outcome,
      mentioned_user_ids: mentioned_user_ids ? JSON.stringify(mentioned_user_ids) : "[]",
      pinned: pinned || false,
      createdById: userId,
      // If we had a generic text content field, we'd map notes there. We use outcome for now.
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
