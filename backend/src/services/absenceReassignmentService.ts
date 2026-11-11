import { sequelize, User, Lead, Deal, LeadReassignmentHistory, DealReassignmentHistory } from "@nexus-crm/database";
import { Op } from "sequelize";
import { assignLead, assignOpportunityCloser } from "./assignmentEngine";
import { createNotification } from "./notificationService";

export interface AbsenceReassignmentSummary {
  reassignedLeadsCount: number;
  reassignedDealsCount: number;
  reassignedAppointmentsCount: number;
  reassignedInspectionsCount: number;
  details: {
    leads: Array<{ leadId: string; title: string; previousOwnerId: string; newOwnerId: string; newOwnerName: string }>;
    deals: Array<{ dealId: string; name: string; previousOwnerId: string; newOwnerId: string; newOwnerName: string }>;
    appointments: Array<{ appointmentId: string; appointmentNumber: string; previousResourceId: string; newResourceId: string; newResourceName: string }>;
    inspections: Array<{ inspectionId: string; title: string; previousInspectorId: string; newInspectorId: string; newInspectorName: string }>;
  };
}

/**
 * Automatically reassigns all active leads and open opportunities of an absent/on-leave sales representative
 * to the most suitable active available candidates using the multi-factor scoring engine.
 */
export async function reassignAbsentRepWorkload(
  absentUserId: string,
  customReason?: string
): Promise<AbsenceReassignmentSummary> {
  const summary: AbsenceReassignmentSummary = {
    reassignedLeadsCount: 0,
    reassignedDealsCount: 0,
    reassignedAppointmentsCount: 0,
    reassignedInspectionsCount: 0,
    details: {
      leads: [],
      deals: [],
      appointments: [],
      inspections: []
    }
  };

  try {
    const absentUser: any = await User.findByPk(absentUserId);
    const absentUserName = absentUser ? absentUser.name : "Absent Representative";

    console.log(`[ABSENCE AUTO-REASSIGN] Starting auto-reassignment for absent rep: ${absentUserName} (${absentUserId})`);

    // ─────────────────────────────────────────────────────────────
    // 1. REASSIGN ACTIVE LEADS
    // ─────────────────────────────────────────────────────────────
    const openLeads = await Lead.findAll({
      where: {
        assignedToId: absentUserId,
        status: {
          [Op.notIn]: ["Converted", "Lost", "Disqualified", "CONVERTED", "NOT_CONVERTED", "Won"]
        }
      }
    });

    console.log(`[ABSENCE AUTO-REASSIGN] Found ${openLeads.length} active leads currently assigned to ${absentUserName}.`);

    for (const rawLead of openLeads) {
      const lead = rawLead as any;
      try {
        const leadContext = {
          leadId: lead.id,
          firstName: lead.firstName || "Customer",
          lastName: lead.lastName || "",
          email: lead.email || "",
          phone: lead.phone || "",
          company: lead.company || "",
          industry: lead.industry || "General",
          territory: lead.territory || "General",
          expectedValue: Number(lead.expectedRevenue || (lead.leadScore ? lead.leadScore * 1000 : 50000)),
          leadScore: lead.leadScore || 50,
          source: lead.source || "inbound",
          isManualEntry: false
        };

        // Run multi-factor assignment engine to find the best available active fit
        const result = await assignLead(leadContext);

        if (result.assignedToId && result.assignedToId !== absentUserId) {
          const newRep: any = await User.findByPk(result.assignedToId);
          const newRepName = newRep ? newRep.name : "Replacement Representative";

          // Update lead owner
          await lead.update({
            assignedToId: result.assignedToId,
            assignmentType: "PERFORMANCE_BEST_FIT",
            assignmentMethod: "AUTO_ABSENCE_REASSIGNMENT"
          });

          // Record Lead Reassignment History
          if (LeadReassignmentHistory) {
            await LeadReassignmentHistory.create({
              leadId: lead.id,
              oldAssignedToId: absentUserId,
              newAssignedToId: result.assignedToId,
              reason: customReason || `Auto-Reassigned: Previous owner (${absentUserName}) is absent / on leave. Multi-factor engine routed lead to best available fit (${newRepName}).`,
              reassignedAt: new Date()
            });
          }

          // Create in-app notification for the replacement representative
          await createNotification(
            result.assignedToId,
            "info",
            "Auto-Reassigned Lead Received",
            `Lead "${lead.company || lead.firstName}" has been automatically reassigned to you because ${absentUserName} is marked absent / on leave.`,
            `/leads/${lead.id}`
          );

          summary.reassignedLeadsCount++;
          summary.details.leads.push({
            leadId: lead.id,
            title: lead.company || `${lead.firstName} ${lead.lastName}`,
            previousOwnerId: absentUserId,
            newOwnerId: result.assignedToId,
            newOwnerName: newRepName
          });

          console.log(`[ABSENCE AUTO-REASSIGN] Lead "${lead.company || lead.id}" successfully reassigned from ${absentUserName} to ${newRepName}.`);
        }
      } catch (leadErr) {
        console.error(`[ABSENCE AUTO-REASSIGN] Error reassigning lead ${lead.id}:`, leadErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. REASSIGN OPEN OPPORTUNITIES / DEALS
    // ─────────────────────────────────────────────────────────────
    const openDeals = await Deal.findAll({
      where: {
        ownerId: absentUserId,
        status: {
          [Op.notIn]: ["WON", "LOST", "CLOSED_WON", "CLOSED_LOST", "Won", "Lost"]
        }
      }
    });

    console.log(`[ABSENCE AUTO-REASSIGN] Found ${openDeals.length} open deals currently owned by ${absentUserName}.`);

    for (const rawDeal of openDeals) {
      const deal = rawDeal as any;
      try {
        const dealContext = {
          dealId: deal.id,
          name: deal.name,
          firstName: deal.name || "Customer",
          lastName: "",
          email: "",
          amount: Number(deal.amount || 50000),
          stageId: deal.stageId,
          accountId: deal.accountId,
          expectedValue: Number(deal.amount || 50000)
        };

        // Run closer assignment engine excluding the absent rep
        const closerResult = await assignOpportunityCloser(dealContext, {
          excludeRepId: absentUserId,
          fallbackAction: "assign_manager"
        });

        if (closerResult.closerId && closerResult.closerId !== absentUserId) {
          const newCloser: any = await User.findByPk(closerResult.closerId);
          const newCloserName = newCloser ? newCloser.name : "Replacement Closer";

          await deal.update({
            ownerId: closerResult.closerId
          });

          if (DealReassignmentHistory) {
            await DealReassignmentHistory.create({
              dealId: deal.id,
              oldOwnerId: absentUserId,
              newOwnerId: closerResult.closerId,
              assignmentType: "AUTOMATIC",
              dealAmountAtReassignment: Number(deal.amount || 0),
              reason: customReason || `Auto-Reassigned: Deal owner (${absentUserName}) is marked absent / on leave. Multi-factor closer engine routed deal to ${newCloserName}.`,
              reassignedAt: new Date()
            });
          }

          await createNotification(
            closerResult.closerId,
            "info",
            "Auto-Reassigned Opportunity Received",
            `Deal "${deal.name}" ($${Number(deal.amount || 0).toLocaleString()}) has been automatically reassigned to you because ${absentUserName} is marked absent / on leave.`,
            `/opportunities/${deal.id}`
          );

          summary.reassignedDealsCount++;
          summary.details.deals.push({
            dealId: deal.id,
            name: deal.name,
            previousOwnerId: absentUserId,
            newOwnerId: closerResult.closerId,
            newOwnerName: newCloserName
          });

          console.log(`[ABSENCE AUTO-REASSIGN] Deal "${deal.name}" successfully reassigned from ${absentUserName} to ${newCloserName}.`);
        }
      } catch (dealErr) {
        console.error(`[ABSENCE AUTO-REASSIGN] Error reassigning deal ${deal.id}:`, dealErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. REASSIGN TODAY'S FIELD TECHNICIAN APPOINTMENTS
    // ─────────────────────────────────────────────────────────────
    try {
      const ServiceResource = sequelize.models.ServiceResource as any;
      const ServiceAppointment = sequelize.models.ServiceAppointment as any;

      if (ServiceResource && ServiceAppointment) {
        const resource: any = await ServiceResource.findOne({
          where: { userId: absentUserId }
        });

        if (resource) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const pendingAppointments = await ServiceAppointment.findAll({
            where: {
              serviceResourceId: resource.id,
              status: { [Op.notIn]: ["Completed", "Canceled", "Cannot Complete"] },
              scheduledStartTime: { [Op.gte]: todayStart }
            }
          });

          console.log(`[ABSENCE AUTO-REASSIGN] Found ${pendingAppointments.length} pending service appointments for technician resource ${resource.name || resource.id}.`);

          if (pendingAppointments.length > 0) {
            // Find alternate available technician
            const alternateResource: any = await ServiceResource.findOne({
              where: {
                id: { [Op.ne]: resource.id },
                isActive: true
              }
            });

            for (const rawAppt of pendingAppointments) {
              const appt = rawAppt as any;
              if (alternateResource) {
                await appt.update({
                  serviceResourceId: alternateResource.id,
                  notes: `${appt.notes || ""}\n[System Auto-Reassignment] Reassigned from ${resource.name} due to absence: ${customReason || "Sudden absence / on leave"}`.trim()
                });

                if (alternateResource.userId) {
                  await createNotification(
                    alternateResource.userId,
                    "info",
                    "Service Dispatch Auto-Reassigned",
                    `Service Appointment ${appt.appointmentNumber || appt.id} has been transferred to you due to ${resource.name}'s absence.`,
                    `/work-orders`
                  );
                }

                summary.reassignedAppointmentsCount++;
                summary.details.appointments.push({
                  appointmentId: appt.id,
                  appointmentNumber: appt.appointmentNumber || appt.id,
                  previousResourceId: resource.id,
                  newResourceId: alternateResource.id,
                  newResourceName: alternateResource.name || "Alternate Technician"
                });
              } else {
                // No alternate technician available: flag appointment as needing reschedule and alert ops
                await appt.update({
                  status: "Needs Reschedule",
                  notes: `${appt.notes || ""}\n[Urgent] Primary technician ${resource.name} is absent. No alternate available; rescheduling required.`.trim()
                });

                try {
                  const opsManagers = await User.findAll({
                    where: {
                      role: { [Op.in]: ["admin", "ops_manager", "manager", "director"] },
                      isAvailable: true
                    },
                    attributes: ["id"]
                  });
                  for (const mgr of opsManagers) {
                    await createNotification(
                      mgr.id,
                      "warning",
                      "Urgent: Unassigned Service Appointment",
                      `Technician ${resource.name} is absent and appointment ${appt.appointmentNumber || appt.id} has no alternate technician available. Manual reschedule required.`,
                      `/work-orders`
                    );
                  }
                } catch (notifErr) {}
              }
            }
          }
        }
      }
    } catch (apptErr: any) {
      console.warn("[ABSENCE AUTO-REASSIGN] Error checking ServiceAppointments:", apptErr.message);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. REASSIGN TODAY'S SITE INSPECTIONS
    // ─────────────────────────────────────────────────────────────
    try {
      const SiteInspection = sequelize.models.SiteInspection as any;
      if (SiteInspection) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const openInspections = await SiteInspection.findAll({
          where: {
            assignedToId: absentUserId,
            status: { [Op.in]: ["requested", "scheduled", "in_progress", "draft"] }
          }
        });

        console.log(`[ABSENCE AUTO-REASSIGN] Found ${openInspections.length} open site inspections assigned to ${absentUserName}.`);

        if (openInspections.length > 0) {
          // Find replacement inspector
          const altInspector: any = await User.findOne({
            where: {
              id: { [Op.ne]: absentUserId },
              role: { [Op.in]: ["site_inspector", "inspector", "sales_rep", "admin"] },
              isAvailable: true,
              onLeave: false
            }
          });

          for (const rawInsp of openInspections) {
            const insp = rawInsp as any;
            if (altInspector) {
              await insp.update({
                assignedToId: altInspector.id,
                assignedInspectorName: altInspector.name
              });

              await createNotification(
                altInspector.id,
                "info",
                "Site Survey Auto-Reassigned",
                `Site Survey "${insp.companyName || insp.id}" has been reassigned to you due to ${absentUserName}'s absence.`,
                `/site-inspections`
              );

              summary.reassignedInspectionsCount++;
              summary.details.inspections.push({
                inspectionId: insp.id,
                title: insp.companyName || insp.id,
                previousInspectorId: absentUserId,
                newInspectorId: altInspector.id,
                newInspectorName: altInspector.name
              });
            } else {
              // No alternate inspector available: notify ops
              try {
                const opsManagers = await User.findAll({
                  where: {
                    role: { [Op.in]: ["admin", "ops_manager", "manager", "director"] },
                    isAvailable: true
                  },
                  attributes: ["id"]
                });
                for (const mgr of opsManagers) {
                  await createNotification(
                    mgr.id,
                    "warning",
                    "Urgent: Unassigned Site Survey",
                    `Inspector ${absentUserName} is absent and site survey "${insp.companyName || insp.id}" has no available alternate inspector. Manual action required.`,
                    `/site-inspections`
                  );
                }
              } catch (notifErr) {}
            }
          }
        }
      }
    } catch (inspErr: any) {
      console.warn("[ABSENCE AUTO-REASSIGN] Error checking SiteInspections:", inspErr.message);
    }

    console.log(`[ABSENCE AUTO-REASSIGN] Completed: ${summary.reassignedLeadsCount} leads, ${summary.reassignedDealsCount} deals, ${summary.reassignedAppointmentsCount} appointments, ${summary.reassignedInspectionsCount} inspections.`);
    return summary;
  } catch (error) {
    console.error("[ABSENCE AUTO-REASSIGN] Global execution error:", error);
    return summary;
  }
}

/**
 * Scans all sales representatives in the system and ensures that any absent/on-leave reps
 * have their open workloads transferred to available reps.
 */
export async function checkAndReassignAllAbsentReps(): Promise<number> {
  try {
    const absentReps = await User.findAll({
      where: {
        role: { [Op.ne]: "admin" },
        [Op.or]: [
          { isAvailable: false },
          { onLeave: true },
          { status: "On Leave" },
          { status: "OOO" },
          { status: "Offline" },
          { status: "Suspended" }
        ]
      }
    });

    let totalTransferred = 0;
    for (const rep of absentReps) {
      const summary = await reassignAbsentRepWorkload(rep.id);
      totalTransferred +=
        summary.reassignedLeadsCount +
        summary.reassignedDealsCount +
        summary.reassignedAppointmentsCount +
        summary.reassignedInspectionsCount;
    }

    return totalTransferred;
  } catch (error) {
    console.error("[checkAndReassignAllAbsentReps] Error:", error);
    return 0;
  }
}
