import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { sendEmail } from "./emailService";

export const createNotification = async (userId: string, type: string, title: string, message: string, link?: string) => {
  try {
    const notification = await sequelize.models.Notification.create({
      id: require('crypto').randomUUID(),
      userId,
      type,
      title,
      message,
      link: link || null,
      isRead: false
    });

    // Optionally check if user prefers email notifications and trigger emailService here
    // For now, let's just log it or we can add a check later.
    
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
};

export const checkOverdueTasks = async () => {
  try {
    const now = new Date();
    // Assuming activities have a 'dueDate' or similar. 
    // Wait, let's look at Activity model in index.ts: it has 'createdAt', 'duration'. It does not have 'dueDate'.
    // If there is no dueDate, we can't easily check for overdue tasks without modifying the model. 
    // Let's assume we check activities created > 7 days ago that are "task" and don't have an outcome.
    
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 2); // 2 days grace period for standard overdue
    
    const managerGraceDate = new Date();
    managerGraceDate.setDate(managerGraceDate.getDate() - 5); // 5 days grace period -> escalate to manager

    const overdueTasks = await sequelize.models.Activity.findAll({
      where: {
        type: 'task',
        outcome: null,
        createdAt: {
          [Op.lt]: overdueDate
        }
      },
      include: [{ model: sequelize.models.User, as: 'createdBy' }]
    });

    for (const task of overdueTasks) {
      const t = task as any;
      const isManagerEscalation = new Date(t.createdAt) < managerGraceDate;

      if (isManagerEscalation) {
        // Find a manager (mock logic: find user with role 'manager' or similar, or just send to admin)
        const manager = await sequelize.models.User.findOne({ where: { role: 'admin' } });
        if (manager) {
          await createNotification(
            (manager as any).id,
            'alert',
            'Task Overdue Escalation',
            `A task assigned to ${t.createdBy?.name || 'Unknown'} is significantly overdue.`,
            `/leads/${t.leadId}`
          );
        }
      } else {
        // Standard notification to the assigned user
        if (t.createdById) {
          await createNotification(
            t.createdById,
            'alert',
            'Task Overdue',
            `Your task is overdue. Please complete it or update the outcome.`,
            `/leads/${t.leadId}`
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to check overdue tasks:", error);
  }
};
