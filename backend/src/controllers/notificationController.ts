import { Request, Response } from "express";
import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import { 
  createNotification, 
  triggerLeadAssignedNotifications, 
  triggerQuoteApprovalNotifications, 
  triggerSlaBreachNotification, 
  triggerSystemFailureNotification 
} from "../services/notificationEngine";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const userRole = (user?.role || "sales_rep").toUpperCase();
    const normalizedRole = userRole === "SALES_MANAGER" ? "TEAM_LEAD" : userRole === "DIRECTOR" || userRole === "SUPER_ADMIN" ? "ADMIN" : userRole;

    const { severity, entityType, unreadOnly, grouped } = req.query;

    const where: any = {
      [Op.or]: [
        { userId: userId || null },
        { role: normalizedRole }
      ]
    };

    if (severity) {
      where.severity = severity;
    }

    if (entityType && entityType !== "all") {
      where.entityType = (entityType as string).toUpperCase();
    }

    if (unreadOnly === "true") {
      where.isRead = false;
    }

    const notifications: any[] = await sequelize.models.Notification.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 100
    });

    if (grouped === "true") {
      // Group notifications by groupKey
      const groupsMap: Record<string, { groupKey: string; title: string; count: number; unreadCount: number; latest: any; items: any[] }> = {};

      notifications.forEach(n => {
        const key = n.groupKey || `group_${n.type}_${n.entityType || 'gen'}`;
        if (!groupsMap[key]) {
          groupsMap[key] = {
            groupKey: key,
            title: n.title,
            count: 0,
            unreadCount: 0,
            latest: n,
            items: []
          };
        }
        groupsMap[key].count += 1;
        if (!n.isRead) groupsMap[key].unreadCount += 1;
        groupsMap[key].items.push(n);
      });

      const groupedResult = Object.values(groupsMap).map(g => {
        if (g.count > 1) {
          return {
            ...g.latest.toJSON(),
            title: g.count > 1 ? `${g.count} Notifications: ${g.title}` : g.title,
            groupCount: g.count,
            unreadCount: g.unreadCount,
            items: g.items
          };
        }
        return { ...g.latest.toJSON(), groupCount: 1, unreadCount: g.unreadCount ? 1 : 0 };
      });

      return res.json(groupedResult);
    }

    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const notification = await sequelize.models.Notification.findByPk(String(id));
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    await notification.update({ isRead: true, readAt: new Date() });
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const userRole = (user?.role || "sales_rep").toUpperCase();

    await sequelize.models.Notification.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          [Op.or]: [
            { userId },
            { role: userRole }
          ],
          isRead: false
        }
      }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Dev Endpoint: Simulate role-specific events to test notification engine
 */
export const simulateNotificationEvent = async (req: Request, res: Response) => {
  try {
    const { eventType, entityId } = req.body;
    const user = (req as any).user;

    switch (eventType) {
      case "LEAD_ASSIGNED": {
        const lead = entityId ? await sequelize.models.Lead.findByPk(entityId) : { id: "demo-lead", company: "Gulf Oil Corp", firstName: "Ahmed", leadScore: 90, temperature: "Hot", isStrategic: true, source: "WhatsApp" };
        await triggerLeadAssignedNotifications(lead, user);
        return res.json({ message: "Triggered LEAD_ASSIGNED notifications for Sales Rep & Team Lead" });
      }
      case "QUOTE_APPROVAL_TL": {
        const quote = { id: entityId || "demo-quote-1", quoteNumber: "QT-2026-0888", totalAmount: 2500000, update: async () => {} };
        await triggerQuoteApprovalNotifications(quote, { amount: 2500000 }, user);
        return res.json({ message: "Triggered QUOTE_APPROVAL for Team Lead (₹25L)" });
      }
      case "QUOTE_APPROVAL_ADMIN": {
        const quote = { id: entityId || "demo-quote-2", quoteNumber: "QT-2026-0999", totalAmount: 7500000, update: async () => {} };
        await triggerQuoteApprovalNotifications(quote, { amount: 7500000 }, user);
        return res.json({ message: "Triggered QUOTE_APPROVAL for Admin (₹75L)" });
      }
      case "SLA_BREACH": {
        const lead = { id: entityId || "demo-lead-sla", company: "Titan Engineering", firstName: "Michael", assignedToId: user.id };
        await triggerSlaBreachNotification(lead);
        return res.json({ message: "Triggered SLA Breach notification for Rep & Team Lead" });
      }
      case "SYSTEM_FAILURE": {
        await triggerSystemFailureNotification("whatsapp_webhook", "WhatsApp Webhook Failure", "Meta webhook failed to respond within 5000ms threshold.");
        return res.json({ message: "Triggered System Failure notification for Admin" });
      }
      default:
        await createNotification({
          userId: user.id,
          role: "SALES_REP",
          type: "DEMO_NOTIFICATION",
          severity: "INFO",
          title: "Demo Notification Triggered",
          message: "Role-Based Notification Engine test notification."
        });
        return res.json({ message: "Created generic demo notification" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
