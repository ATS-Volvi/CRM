import { Lead, Activity, LeadStageHistory, sequelize } from "@nexus-crm/database";
import { validateStageTransition } from "./stageValidationService";
import { computeStageNextAction } from "./stageNextActionEngine";

export interface LeadAutoAdvanceResult {
  transitioned: boolean;
  fromStage?: string;
  toStage?: string;
  leadId?: string;
  evidence?: any[];
}

/**
 * Evaluates and automatically advances a Lead's lifecycle status if entry criteria
 * defined in stageValidationService are fully met.
 * 
 * Rules:
 * 1. Auto-trigger NEW -> CONTACTED on verified outbound Activity.
 * 2. Auto-trigger CONTACTED -> QUALIFIED when expected/estimated value & requirements/notes are both present.
 * 3. Idempotent & non-regressive: Does not move leads backwards or re-trigger if already at/past target.
 */
export async function checkAndAutoAdvanceLead(
  leadId: string,
  options?: { userId?: string; source?: string }
): Promise<LeadAutoAdvanceResult> {
  if (!leadId) return { transitioned: false };

  try {
    const lead: any = await Lead.findByPk(leadId);
    if (!lead) return { transitioned: false };

    const currentStatus = (lead.status || "NEW").toUpperCase();
    const userId = options?.userId || (lead.assignedToId || "system-auto");

    // ── 1. Check NEW -> CONTACTED ──────────────────────────────────────────────
    if (currentStatus === "NEW") {
      const validation = await validateStageTransition(
        leadId,
        "NEW",
        "CONTACTED",
        userId
      );

      if (validation.allowed) {
        // Re-check lead status to guard against race conditions or concurrent manual updates
        const freshLead: any = await Lead.findByPk(leadId);
        if (!freshLead || (freshLead.status || "").toUpperCase() !== "NEW") {
          return { transitioned: false };
        }

        const fromStage = "New";
        const toStage = "Contacted";

        const nextActionConfig = computeStageNextAction("CONTACTED");
        freshLead.status = "CONTACTED";
        freshLead.nextAction = nextActionConfig.nextAction;
        freshLead.nextActionDue = nextActionConfig.hoursDue > 0
          ? new Date(Date.now() + nextActionConfig.hoursDue * 3600 * 1000)
          : null;
        await freshLead.save();

        // Write LeadStageHistory audit log
        await LeadStageHistory.create({
          leadId: freshLead.id,
          fromStage,
          toStage,
          changedById: userId,
          reason: "Automatic transition: Outbound contact activity logged",
          transitionType: validation.transitionType || "AUTOMATIC",
          evidenceData: JSON.stringify(validation.evidence),
          isVerified: true
        });

        // Write Activity audit record
        await Activity.create({
          leadId: freshLead.id,
          type: "stage_change",
          outcome: `Stage automatically updated from ${fromStage} to ${toStage} [${validation.verificationStatus}]`,
          notes: JSON.stringify(validation.evidence),
          createdById: userId,
          direction: "internal"
        });

        // Immediately check if lead also qualifies for QUALIFIED
        const qualCheck = await checkAndAutoAdvanceLead(leadId, options);
        if (qualCheck.transitioned) {
          return {
            transitioned: true,
            fromStage,
            toStage: qualCheck.toStage,
            leadId: freshLead.id,
            evidence: validation.evidence
          };
        }

        return {
          transitioned: true,
          fromStage,
          toStage,
          leadId: freshLead.id,
          evidence: validation.evidence
        };
      }
    }

    // ── 2. Check CONTACTED -> QUALIFIED ────────────────────────────────────────
    if (currentStatus === "CONTACTED") {
      const validation = await validateStageTransition(
        leadId,
        "CONTACTED",
        "QUALIFIED",
        userId
      );

      if (validation.allowed) {
        // Re-check lead status to guard against race conditions
        const freshLead: any = await Lead.findByPk(leadId);
        if (!freshLead || (freshLead.status || "").toUpperCase() !== "CONTACTED") {
          return { transitioned: false };
        }

        const fromStage = "Contacted";
        const toStage = "Qualified";

        const nextActionConfig = computeStageNextAction("QUALIFIED");
        freshLead.status = "QUALIFIED";
        freshLead.nextAction = nextActionConfig.nextAction;
        freshLead.nextActionDue = nextActionConfig.hoursDue > 0
          ? new Date(Date.now() + nextActionConfig.hoursDue * 3600 * 1000)
          : null;
        await freshLead.save();

        // Write LeadStageHistory audit log
        await LeadStageHistory.create({
          leadId: freshLead.id,
          fromStage,
          toStage,
          changedById: userId,
          reason: "Automatic transition: Estimated value and requirements documented",
          transitionType: validation.transitionType || "AUTOMATIC",
          evidenceData: JSON.stringify(validation.evidence),
          isVerified: true
        });

        // Write Activity audit record
        await Activity.create({
          leadId: freshLead.id,
          type: "stage_change",
          outcome: `Stage automatically updated from ${fromStage} to ${toStage} [${validation.verificationStatus}]`,
          notes: JSON.stringify(validation.evidence),
          createdById: userId,
          direction: "internal"
        });

        return {
          transitioned: true,
          fromStage,
          toStage,
          leadId: freshLead.id,
          evidence: validation.evidence
        };
      }
    }

    return { transitioned: false };
  } catch (error) {
    console.error(`[leadStageAutomationService] Error auto-advancing lead ${leadId}:`, error);
    return { transitioned: false };
  }
}
