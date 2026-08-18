import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";
import * as crypto from "crypto";
import { LIFECYCLE_STAGE_RULES } from "./leadJourneyWorkflowEngine";
import { createNotification } from "./notificationEngine";

export async function enforceSLAs() {
  const { Lead, User, LeadReassignmentHistory } = sequelize.models;

  console.log("[SLA ENFORCEMENT] Starting SLA check job...");

  // Find all leads that are not won or lost, and have an assigned user
  const activeLeads: any = await Lead.findAll({
    where: {
      status: { [Op.notIn]: ["Won", "Lost"] },
      assignedToId: { [Op.ne]: null }
    },
    include: [{ model: User, as: "assignedTo", attributes: ["id", "role", "name"] }]
  });

  const now = new Date();
  let breachedCount = 0;

  for (const lead of activeLeads) {
    const stage = lead.status;
    const rules = (LIFECYCLE_STAGE_RULES as any)[stage];
    
    if (!rules || rules.slaHours <= 0) continue; // No SLA enforcement for this stage
    
    const slaMs = rules.slaHours * 3600 * 1000;
    const lastUpdate = lead.updatedAt;
    
    // Check if SLA has been breached
    if (now.getTime() - lastUpdate.getTime() > slaMs) {
      // It's breached. We should only reassign if they are a sales_rep, 
      // or we can escalate them to senior_ae unconditionally if they aren't one.
      const currentRole = lead.assignedTo.role;
      if (currentRole === "sales_rep") {
        console.log(`[SLA BREACH] Lead ${lead.id} breached SLA in stage ${stage}. Escalating...`);
        
        // Find an available senior_ae
        const seniorAe: any = await User.findOne({
          where: {
            role: { [Op.or]: ["senior_ae", "manager"] },
            isAvailable: true
          }
        });

        if (seniorAe) {
          const oldOwnerId = lead.assignedToId;
          const newOwnerId = seniorAe.id;

          // Reassign Lead
          await lead.update({ assignedToId: newOwnerId });

          // Log History
          await LeadReassignmentHistory.create({
            id: crypto.randomUUID(),
            leadId: lead.id,
            oldAssignedToId: oldOwnerId,
            newAssignedToId: newOwnerId,
            changedByUserId: newOwnerId, // Automated escalations get tracked as the new assignee taking over (or a system user if we had one)
            reason: `SLA Breach in stage ${stage}. Lead untouched for > ${rules.slaHours} hours. Auto-escalated to ${seniorAe.name}.`
          });

          // Notify the users
          await createNotification({
            userId: oldOwnerId,
            type: "SLA_BREACH_LOST_LEAD",
            title: "Lead Reassigned",
            message: `Lead ${lead.firstName} ${lead.lastName} was reassigned due to SLA breach.`
          });
          await createNotification({
            userId: newOwnerId,
            type: "SLA_BREACH_ESCALATION",
            title: "Lead Escalated",
            message: `Lead ${lead.firstName} ${lead.lastName} was escalated to you due to SLA breach.`
          });

          breachedCount++;
        } else {
          console.log(`[SLA BREACH] Lead ${lead.id} breached, but no senior_ae found to escalate to.`);
        }
      }
    }
  }

  console.log(`[SLA ENFORCEMENT] Completed. Escalated ${breachedCount} leads.`);
  return breachedCount;
}
