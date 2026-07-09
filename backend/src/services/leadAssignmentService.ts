import { Lead, User } from "@nexus-crm/database";
import { createNotification } from "./notificationService";
import { triggerTemplatedEmail } from "./emailService";

export const assignLeadToSalesperson = async (lead: any, assignedToId: string) => {
  if (!lead) throw new Error("Lead not provided");

  const isReassignment = lead.assignedToId !== assignedToId;
  
  if (!isReassignment) return lead;

  lead.assignedToId = assignedToId;
  await lead.save();

  // 1. Notify the salesperson inside the app
  try {
    await createNotification(
      assignedToId,
      'info',
      'New Lead Assigned',
      `A new lead from ${lead.company} (${lead.firstName} ${lead.lastName}) was assigned to you.`,
      `/leads/${lead.id}`
    );
  } catch (err) {
    console.error("Failed to create assignment notification:", err);
  }

  // 2. ASSIGNMENT INTRO AUTOMATION (Email the Lead)
  if (lead.email) {
    try {
      const salesperson = await User.findByPk(assignedToId) as any;
      if (salesperson) {
        await triggerTemplatedEmail("assignment_intro", lead.email, {
          lead_name: lead.firstName || 'there',
          rep_name: salesperson.name || 'a representative'
        }, lead.id).catch(err => console.error("Assignment email failed", err));
      }
    } catch (err) {
      console.error("Assignment intro email failed:", err);
    }
  }

  return lead;
};
