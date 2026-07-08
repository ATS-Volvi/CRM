import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    const notifications = await sequelize.models.Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || "mock-user";
    
    const notification = await sequelize.models.Notification.findOne({ where: { id, userId } });
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    await notification.update({ isRead: true });
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "mock-user";
    await sequelize.models.Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
