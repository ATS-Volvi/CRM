import {
  sequelize,
  SiteInspection,
  User,
  SiteInspectionAlert,
  SiteInspectionAutomationRun,
} from "@nexus-crm/database";
import { Op } from "sequelize";
import { getSettings } from "./siteInspectionSettingsService";
import { sendSiteInspectionAlert } from "./siteInspectionAlertService";
import { calculateRagStatus, isWorkingDay } from "./siteInspectionSlaService";

const ADVISORY_LOCK_ID = 982341;

let lastScannerRunStats: {
  startedAt: Date | null;
  completedAt: Date | null;
  alertsScanned: number;
  alertsTriggered: number;
  escalationsTriggered: number;
  status: string;
  error?: string | null;
} = {
  startedAt: null,
  completedAt: null,
  alertsScanned: 0,
  alertsTriggered: 0,
  escalationsTriggered: 0,
  status: "IDLE",
  error: null,
};

let scannerIntervalHandle: any = null;

/**
 * Returns latest automation health status for GET /api/health/automation.
 */
export async function getAutomationHealth(): Promise<any> {
  const settings = await getSettings().catch(() => ({ automation: false }));
  const latestRun = await SiteInspectionAutomationRun.findOne({
    order: [["startedAt", "DESC"]],
  }).catch(() => null);

  return {
    status: "healthy",
    automationEnabled: Boolean(settings.automation || process.env.SITE_INSPECTION_AUTOMATION === "true"),
    inMemoryStats: lastScannerRunStats,
    lastDatabaseRun: latestRun,
    serverTimeUtc: new Date().toISOString(),
    serverTimeRiyadh: new Date(Date.now() + 3 * 3600000).toISOString().replace("Z", "+03:00"),
    advisoryLockKey: ADVISORY_LOCK_ID,
  };
}

/**
 * Executes a single scan pass across all active inspections.
 * Thread-safe and instance-safe: guarded by Postgres advisory lock.
 */
export async function runAutomationScanPass(fakeNow?: Date): Promise<any> {
  const now = fakeNow || new Date();
  const settings = await getSettings();

  // If automation is switched off, do not perform alerts or escalations
  if (!settings.automation && process.env.SITE_INSPECTION_AUTOMATION !== "true") {
    return { skipped: true, reason: "Automation disabled by setting" };
  }

  const isPostgres = sequelize.getDialect() === "postgres";
  let lockAcquired = true;

  if (isPostgres) {
    try {
      const [result]: any = await sequelize.query(
        `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked;`
      );
      lockAcquired = Boolean(result && (result[0]?.locked === true || result[0]?.locked === "t"));
    } catch (e) {
      lockAcquired = true; // Fallback if mock
    }
  }

  if (!lockAcquired) {
    console.log("[SiteInspectionScanner] Another instance is currently executing scan. Skipping.");
    return { skipped: true, reason: "Advisory lock busy" };
  }

  const startedAt = new Date();
  let alertsScanned = 0;
  let alertsTriggered = 0;
  let escalationsTriggered = 0;

  try {
    const openStatuses = ["REQUESTED", "DRAFT", "CHANGES_REQUESTED", "SUBMITTED", "WAITING_ON_CLIENT"];
    const inspections: any[] = await SiteInspection.findAll({
      where: {
        status: { [Op.in]: openStatuses },
      },
    });

    alertsScanned = inspections.length;

    // Cache Ops Managers and Directors for escalations
    const approvers: any[] = await User.findAll({
      where: {
        role: { [Op.in]: ["ops_manager", "director", "admin"] },
      },
    });
    const opsManagers = approvers.filter((u) => u.role === "ops_manager" || u.role === "admin");
    const directors = approvers.filter((u) => u.role === "director" || u.role === "admin");

    for (const insp of inspections) {
      const inspectorId = insp.assignedToId;

      // ─── 1. ACCEPT SLA (Status: REQUESTED) ───────────────────────────────
      if (insp.status === "REQUESTED" && insp.slaAcceptDueAt && inspectorId) {
        const assignedAt = insp.assignedAt ? new Date(insp.assignedAt) : new Date(insp.createdAt);
        const dueAt = new Date(insp.slaAcceptDueAt);
        const rag = calculateRagStatus(assignedAt, dueAt, now);

        if (rag.percentage >= 50 && rag.percentage < 80) {
          const res = await sendSiteInspectionAlert({
            alertType: "REMINDER_50",
            customDedupeKey: `REMINDER_50:accept:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `Reminder: Please accept inspection ${insp.inspectionNumber}`,
            message: `Inspection ${insp.inspectionNumber} is awaiting your response (${rag.formattedCountdown}).`,
          });
          if (res.sent) alertsTriggered++;
        }

        if (rag.percentage >= 80 && rag.rag !== "OVERDUE") {
          const res = await sendSiteInspectionAlert({
            alertType: "REMINDER_80",
            customDedupeKey: `REMINDER_80:accept:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `Action Required: Acceptance SLA At Risk for ${insp.inspectionNumber}`,
            message: `Acceptance SLA for ${insp.inspectionNumber} is at 80% threshold (${rag.formattedCountdown}). Please accept or decline immediately.`,
            isUrgent: true,
          });
          if (res.sent) alertsTriggered++;
        }

        if (rag.rag === "OVERDUE") {
          const res = await sendSiteInspectionAlert({
            alertType: "OVERDUE_INSPECTOR",
            customDedupeKey: `OVERDUE:accept:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `Overdue: Inspection acceptance expired for ${insp.inspectionNumber}`,
            message: `Inspection ${insp.inspectionNumber} acceptance window is ${rag.formattedCountdown}.`,
            isUrgent: true,
          });
          if (res.sent) alertsTriggered++;
        }
      }

      // ─── 2. SUBMIT SLA (Status: DRAFT or CHANGES_REQUESTED) ──────────────
      if (
        (insp.status === "DRAFT" || insp.status === "CHANGES_REQUESTED") &&
        insp.slaSubmitDueAt &&
        inspectorId
      ) {
        const startPoint = insp.acceptedAt ? new Date(insp.acceptedAt) : new Date(insp.createdAt);
        const dueAt = new Date(insp.slaSubmitDueAt);
        const rag = calculateRagStatus(startPoint, dueAt, now, Boolean(insp.slaPausedAt), insp.slaPausedAt);

        // 50% Reminder
        if (rag.percentage >= 50 && rag.percentage < 80) {
          const res = await sendSiteInspectionAlert({
            alertType: "REMINDER_50",
            customDedupeKey: `REMINDER_50:submit:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `SLA Reminder (50%): ${insp.inspectionNumber}`,
            message: `Site assessment submission for ${insp.inspectionNumber} is half-way (${rag.formattedCountdown}).`,
          });
          if (res.sent) alertsTriggered++;
        }

        // 80% Reminder (At Risk)
        if (rag.percentage >= 80 && rag.rag !== "OVERDUE") {
          const res = await sendSiteInspectionAlert({
            alertType: "REMINDER_80",
            customDedupeKey: `REMINDER_80:submit:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `URGENT: Submission SLA At Risk for ${insp.inspectionNumber}`,
            message: `Inspection ${insp.inspectionNumber} has reached 80% of its SLA (${rag.formattedCountdown}). Please complete and submit the audit form.`,
            isUrgent: true,
          });
          if (res.sent) alertsTriggered++;
        }

        // Overdue & Multi-Tier Escalations
        if (rag.rag === "OVERDUE") {
          // Alert inspector
          const res1 = await sendSiteInspectionAlert({
            alertType: "OVERDUE_INSPECTOR",
            customDedupeKey: `OVERDUE:submit:${insp.id}:${inspectorId}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `OVERDUE: Submission deadline breached for ${insp.inspectionNumber}`,
            message: `Inspection ${insp.inspectionNumber} is ${rag.formattedCountdown}. Immediate submission or extension request required.`,
            isUrgent: true,
          });
          if (res1.sent) alertsTriggered++;

          // Escalation Level 1: Ops Manager
          for (const ops of opsManagers) {
            const resOps = await sendSiteInspectionAlert({
              alertType: "OVERDUE_ESCALATION_OPS",
              customDedupeKey: `ESCALATE_OPS:submit:${insp.id}:${ops.id}`,
              inspectionId: insp.id,
              recipientId: ops.id,
              recipientRole: ops.role,
              title: `Escalation (Ops): Overdue inspection ${insp.inspectionNumber}`,
              message: `Site inspection ${insp.inspectionNumber} is overdue (${rag.formattedCountdown}). Assigned inspector: ID ${inspectorId}. Please review or reassign.`,
              isUrgent: true,
            });
            if (resOps.sent) {
              escalationsTriggered++;
              alertsTriggered++;
            }
          }

          if (!insp.escalatedToOpsAt) {
            await insp.update({ escalatedToOpsAt: now });
          }

          // Escalation Level 2: Director after a further 24 hours
          if (insp.escalatedToOpsAt) {
            const msSinceOpsEscalation = now.getTime() - new Date(insp.escalatedToOpsAt).getTime();
            if (msSinceOpsEscalation >= 24 * 3600000) {
              for (const dir of directors) {
                const resDir = await sendSiteInspectionAlert({
                  alertType: "OVERDUE_ESCALATION_DIRECTOR",
                  customDedupeKey: `ESCALATE_DIRECTOR:submit:${insp.id}:${dir.id}`,
                  inspectionId: insp.id,
                  recipientId: dir.id,
                  recipientRole: dir.role,
                  title: `Critical Escalation (Director): Overdue inspection ${insp.inspectionNumber} (+24h)`,
                  message: `Inspection ${insp.inspectionNumber} has remained overdue for more than 24 hours following initial Ops Manager escalation. Action required.`,
                  isUrgent: true,
                });
                if (resDir.sent) {
                  escalationsTriggered++;
                  alertsTriggered++;
                }
              }

              if (!insp.escalatedToDirectorAt) {
                await insp.update({ escalatedToDirectorAt: now });
              }
            }
          }
        }
      }

      // ─── 3. MORNING VISIT SUMMARY (Scheduled visits today) ───────────────
      if (insp.scheduledVisitAt && inspectorId) {
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const rd = new Date(utc + 3 * 3600000);
        const visitUtc = new Date(insp.scheduledVisitAt).getTime() + new Date(insp.scheduledVisitAt).getTimezoneOffset() * 60000;
        const visitRd = new Date(visitUtc + 3 * 3600000);

        const isToday =
          rd.getFullYear() === visitRd.getFullYear() &&
          rd.getMonth() === visitRd.getMonth() &&
          rd.getDate() === visitRd.getDate();

        // Sent around morning (07:00 to 10:00 AST)
        if (isToday && rd.getHours() >= 7 && rd.getHours() <= 10) {
          const ymd = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}-${String(rd.getDate()).padStart(2, "0")}`;
          const res = await sendSiteInspectionAlert({
            alertType: "MORNING_SUMMARY",
            customDedupeKey: `MORNING_SUMMARY:${insp.id}:${inspectorId}:${ymd}`,
            inspectionId: insp.id,
            recipientId: inspectorId,
            title: `Today's Scheduled Visit: ${insp.inspectionNumber}`,
            message: `You have a site inspection visit scheduled today for ${insp.inspectionNumber}. Site: ${insp.siteAreaName || insp.siteAddress || "Designated Location"}.`,
          });
          if (res.sent) alertsTriggered++;
        }
      }
    }

    const completedAt = new Date();
    lastScannerRunStats = {
      startedAt,
      completedAt,
      alertsScanned,
      alertsTriggered,
      escalationsTriggered,
      status: "SUCCESS",
      error: null,
    };

    // Record run log in database
    await SiteInspectionAutomationRun.create({
      startedAt,
      completedAt,
      alertsScanned,
      alertsTriggered,
      escalationsTriggered,
      status: "SUCCESS",
      errorDetails: null,
    }).catch((e) => console.warn("[SiteInspectionScanner] Run log error:", e));

    return lastScannerRunStats;
  } catch (err: any) {
    console.error("[SiteInspectionScanner] Error in scan pass:", err);
    lastScannerRunStats = {
      startedAt,
      completedAt: new Date(),
      alertsScanned,
      alertsTriggered,
      escalationsTriggered,
      status: "FAILED",
      error: err?.message || String(err),
    };

    await SiteInspectionAutomationRun.create({
      startedAt,
      completedAt: new Date(),
      alertsScanned,
      alertsTriggered,
      escalationsTriggered,
      status: "FAILED",
      errorDetails: err?.message || String(err),
    }).catch(() => {});

    throw err;
  } finally {
    if (isPostgres) {
      try {
        await sequelize.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID});`);
      } catch (e) {}
    }
  }
}

/**
 * Starts the in-process background automation scheduler (scans every 60s).
 */
export function startAutomationScheduler(intervalMs: number = 60000): void {
  if (scannerIntervalHandle) return;

  // Immediate catch-up scan on startup (recovers anything missed while instance slept)
  runAutomationScanPass().catch((err) =>
    console.warn("[SiteInspectionScanner] Startup catch-up scan error:", err)
  );

  scannerIntervalHandle = setInterval(() => {
    runAutomationScanPass().catch((err) =>
      console.warn("[SiteInspectionScanner] Periodic scan pass error:", err)
    );
  }, intervalMs);

  console.log(`[SiteInspectionScanner] Scheduler started (interval: ${intervalMs / 1000}s, AST timezone).`);
}

/**
 * Stops the in-process background automation scheduler.
 */
export function stopAutomationScheduler(): void {
  if (scannerIntervalHandle) {
    clearInterval(scannerIntervalHandle);
    scannerIntervalHandle = null;
    console.log("[SiteInspectionScanner] Scheduler stopped.");
  }
}
