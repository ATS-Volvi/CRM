import { sequelize, User, Lead, Deal, LeadReassignmentHistory, DealReassignmentHistory } from "@nexus-crm/database";
import { Op } from "sequelize";
import { assignLead, assignOpportunityCloser } from "./assignmentEngine";
import { createNotification } from "./notificationService";

export interface AbsenceReassignmentSummary {
  reassignedLeadsCount: number;
  reassignedDealsCount: number;
  details: {
    leads: Array<{ leadId: string; title: string; previousOwnerId: string; newOwnerId: string; newOwnerName: string }>;
    deals: Array<{ dealId: string; name: string; previousOwnerId: string; newOwnerId: string; newOwnerName: string }>;
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
    details: {
      leads: [],
      deals: []
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

    console.log(`[ABSENCE AUTO-REASSIGN] Completed: ${summary.reassignedLeadsCount} leads and ${summary.reassignedDealsCount} deals auto-reassigned.`);
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
      totalTransferred += summary.reassignedLeadsCount + summary.reassignedDealsCount;
    }

    return totalTransferred;
  } catch (error) {
    console.error("[checkAndReassignAllAbsentReps] Error:", error);
    return 0;
  }
}
