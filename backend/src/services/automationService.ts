import { AutomationRule, Task, Activity, User, Deal } from "@nexus-crm/database";
import { createNotification } from "./notificationService";

export const triggerStageChangeAutomations = async (deal: any, toStageName: string, userId?: string) => {
  try {
    const activeRules: any[] = await AutomationRule.findAll({
      where: {
        triggerType: "stage_change",
        isActive: true
      }
    });

    for (const rule of activeRules) {
      const condition = rule.triggerCondition || {};
      const targetStage = condition.stageName || condition.toStage || condition.stage;

      // Check if condition matches
      if (!targetStage || targetStage === "Any" || targetStage === "All" || targetStage.toLowerCase() === toStageName.toLowerCase()) {
        const config = rule.actionConfig || {};

        if (rule.actionType === "create_task") {
          await Task.create({
            title: config.taskTitle || `Follow-up on ${deal.name}`,
            description: config.taskDescription || `Automated task triggered by stage change to ${toStageName}`,
            priority: config.priority || "High",
            status: "Pending",
            ownerId: deal.ownerId || userId,
            leadId: deal.leadId,
            customerId: deal.customerId,
            dueDate: new Date(Date.now() + (config.dueDays || 2) * 86400000)
          });

          await Activity.create({
            leadId: deal.leadId,
            type: "task_created",
            outcome: `Automated Task Created: ${config.taskTitle || 'Follow-up task'}`,
            createdById: userId,
      direction: "internal"
          });
        } else if (rule.actionType === "assign_user" && config.targetUserId) {
          deal.ownerId = config.targetUserId;
          await deal.save();

          await createNotification(
            config.targetUserId,
            "info",
            "Automated Assignment 🎯",
            `Deal "${deal.name}" was automatically assigned to you via Automation Rule: ${rule.name}`,
            "/pipeline"
          );
        } else if (rule.actionType === "send_message") {
          await Activity.create({
            leadId: deal.leadId,
            type: "email",
            outcome: `Automated Email Sent (Template #${config.templateId || 'Default',
      direction: "internal"}): Stage reached ${toStageName}`,
            createdById: userId
          });
        }
      }
    }
  } catch (err: any) {
    console.error("Error triggering stage change automations:", err);
  }
};
