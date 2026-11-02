import { SiteHoliday, SiteInspection, SiteInspectionAuditLog } from "@nexus-crm/database";
import { getSettings, SiteInspectionSettingsData, DEFAULT_SETTINGS } from "./siteInspectionSettingsService";

export interface SlaMilestoneCalculation {
  slaAcceptDueAt: Date;
  slaScheduleDueAt: Date;
  slaSubmitDueAt: Date;
  slaReviewDueAt: Date;
}

export type RagStatus = "ON_TRACK" | "AT_RISK" | "OVERDUE";

export interface RagResult {
  rag: RagStatus;
  percentage: number;
  remainingMinutes: number;
  formattedCountdown: string;
}

/**
 * Parses "HH:mm" time string into total minutes from midnight.
 */
export function parseTimeString(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns true if a date falls on an active working day (0 = Sunday ... 6 = Saturday)
 * and is not a public holiday.
 * Evaluated in timezone Asia/Riyadh (AST = UTC+3).
 */
export function isWorkingDay(
  date: Date,
  workingWeek: Array<number | string>,
  holidays: Array<{ date: string | Date; isRecurringYearly?: boolean }> = []
): boolean {
  // Riyadh is strictly UTC+3 with no Daylight Saving Time
  const riyadhDate = new Date(date.getTime() + 3 * 3600000);
  const dayOfWeek = riyadhDate.getUTCDay(); // 0 = Sunday, 6 = Saturday

  const dayNameToNum: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };

  const allowedDays = workingWeek.map((d) =>
    typeof d === "number" ? d : (dayNameToNum[String(d).toLowerCase()] ?? 0)
  );

  if (!allowedDays.includes(dayOfWeek)) {
    return false;
  }

  // Check public holidays
  const yyyy = riyadhDate.getUTCFullYear();
  const mm = String(riyadhDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(riyadhDate.getUTCDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const mmDd = `${mm}-${dd}`;

  for (const h of holidays) {
    const hDateStr = typeof h.date === "string" ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10);
    if (h.isRecurringYearly) {
      if (hDateStr.slice(5, 10) === mmDd) return false;
    } else {
      if (hDateStr === dateStr) return false;
    }
  }

  return true;
}

/**
 * Adds business hours to a starting date, respecting working week days,
 * working hours (e.g. 08:00 - 17:00 AST), and public holidays.
 *
 * If calendarHours is true, simply adds standard elapsed hours.
 */
export function addBusinessHours(
  startDate: Date,
  hoursToAdd: number,
  workingWeek: Array<number | string>,
  workingHours: { start: string; end: string } = { start: "08:00", end: "17:00" },
  holidays: Array<{ date: string | Date; isRecurringYearly?: boolean }> = [],
  calendarHours: boolean = false
): Date {
  if (calendarHours) {
    return new Date(startDate.getTime() + hoursToAdd * 3600000);
  }

  const startMinutes = parseTimeString(workingHours.start);
  const endMinutes = parseTimeString(workingHours.end);

  let remainingMinutes = Math.round(hoursToAdd * 60);

  // Riyadh time represented in UTC components
  let curr = new Date(startDate.getTime() + 3 * 3600000);

  while (remainingMinutes > 0) {
    const dayWorking = isWorkingDay(new Date(curr.getTime() - 3 * 3600000), workingWeek, holidays);

    if (!dayWorking) {
      // Advance to next day at start of business hours
      curr.setUTCDate(curr.getUTCDate() + 1);
      curr.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      continue;
    }

    const currMinutes = curr.getUTCHours() * 60 + curr.getUTCMinutes();

    if (currMinutes < startMinutes) {
      // Fast forward to start of business hours today
      curr.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      continue;
    }

    if (currMinutes >= endMinutes) {
      // Past business hours today, roll to tomorrow start
      curr.setUTCDate(curr.getUTCDate() + 1);
      curr.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      continue;
    }

    // Inside business hours
    const availableToday = endMinutes - currMinutes;

    if (remainingMinutes <= availableToday) {
      curr.setUTCMinutes(curr.getUTCMinutes() + remainingMinutes);
      remainingMinutes = 0;
      break;
    } else {
      remainingMinutes -= availableToday;
      curr.setUTCDate(curr.getUTCDate() + 1);
      curr.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    }
  }

  return new Date(curr.getTime() - 3 * 3600000);
}

/**
 * Computes all SLA milestone due dates for an inspection based on its priority,
 * global/inspector settings, and public holidays.
 */
export async function computeSlaMilestones(
  assignedAt: Date,
  priority: string = "NORMAL",
  customSettings?: SiteInspectionSettingsData,
  holidays?: any[]
): Promise<SlaMilestoneCalculation> {
  const settings = customSettings || (await getSettings());
  const activeHolidays = holidays || (await SiteHoliday.findAll({ where: { isActive: true } }));

  const sla = settings.slaHours || DEFAULT_SETTINGS.slaHours;
  const week = settings.workingWeek || DEFAULT_SETTINGS.workingWeek;
  const hours = settings.workingHours || DEFAULT_SETTINGS.workingHours;

  const prio = (priority || "NORMAL").toUpperCase();

  // 1. Accept SLA
  let acceptHours = sla.accept ?? 4;
  if (prio === "URGENT") acceptHours = sla.acceptUrgent ?? 4;
  if (prio === "LOW") acceptHours = sla.acceptLow ?? 8;

  const slaAcceptDueAt = addBusinessHours(assignedAt, acceptHours, week, hours, activeHolidays);

  // 2. Schedule SLA (must schedule visit within 24 working hours)
  const scheduleHours = sla.schedule ?? 24;
  const slaScheduleDueAt = addBusinessHours(assignedAt, scheduleHours, week, hours, activeHolidays);

  // 3. Submit SLA
  let slaSubmitDueAt: Date;
  if (prio === "URGENT") {
    // URGENT: 24 calendar hours
    const urgentSubmitHours = sla.submitUrgent ?? 24;
    slaSubmitDueAt = addBusinessHours(assignedAt, urgentSubmitHours, week, hours, activeHolidays, true);
  } else if (prio === "LOW") {
    // LOW: 5 working days (5 * business hours per day)
    const lowDays = sla.submitLowDays ?? 5;
    const dailyHours = (parseTimeString(hours.end) - parseTimeString(hours.start)) / 60;
    slaSubmitDueAt = addBusinessHours(assignedAt, lowDays * dailyHours, week, hours, activeHolidays);
  } else {
    // NORMAL: 48 business hours
    const normalHours = sla.submit ?? sla.submitNormal ?? 48;
    slaSubmitDueAt = addBusinessHours(assignedAt, normalHours, week, hours, activeHolidays);
  }

  // 4. Review SLA (within 24 business hours from submission; projected here from submit due date)
  const reviewHours = sla.review ?? 24;
  const slaReviewDueAt = addBusinessHours(slaSubmitDueAt, reviewHours, week, hours, activeHolidays);

  return {
    slaAcceptDueAt,
    slaScheduleDueAt,
    slaSubmitDueAt,
    slaReviewDueAt,
  };
}

/**
 * Calculates RAG status, remaining time, and human-readable countdown.
 *  - ON_TRACK: elapsed < 80% of window
 *  - AT_RISK: elapsed >= 80% and < 100%
 *  - OVERDUE: elapsed >= 100%
 */
export function calculateRagStatus(
  startedAt: Date,
  dueAt: Date,
  now: Date = new Date(),
  isPaused: boolean = false,
  pausedAt?: Date | null
): RagResult {
  const evalNow = isPaused && pausedAt ? new Date(pausedAt) : now;
  const totalWindowMs = dueAt.getTime() - startedAt.getTime();
  const remainingMs = dueAt.getTime() - evalNow.getTime();
  const remainingMinutes = Math.round(remainingMs / 60000);

  if (remainingMs <= 0) {
    const overdueMinutes = Math.abs(remainingMinutes);
    const h = Math.floor(overdueMinutes / 60);
    const m = overdueMinutes % 60;
    return {
      rag: "OVERDUE",
      percentage: 100,
      remainingMinutes,
      formattedCountdown: `Overdue by ${h}h ${m}m`,
    };
  }

  const elapsedMs = Math.max(0, evalNow.getTime() - startedAt.getTime());
  const percentage = totalWindowMs > 0 ? Math.min(100, Math.round((elapsedMs / totalWindowMs) * 100)) : 0;

  const h = Math.floor(remainingMinutes / 60);
  const m = remainingMinutes % 60;
  const formattedCountdown = `${h}h ${m}m remaining`;

  const rag: RagStatus = percentage >= 80 ? "AT_RISK" : "ON_TRACK";

  return {
    rag,
    percentage,
    remainingMinutes,
    formattedCountdown,
  };
}

/**
 * Pauses the SLA clock when inspection moves to WAITING_ON_CLIENT.
 */
export async function pauseSlaClock(
  inspectionId: string,
  reason: string,
  expectedAt?: Date | null,
  actorId?: string,
  actorRole?: string,
  ip?: string
): Promise<any> {
  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  if (!reason || !reason.trim()) {
    throw new Error("A reason is required to mark inspection as waiting on client.");
  }

  const now = new Date();
  await inspection.update({
    status: "WAITING_ON_CLIENT",
    slaPausedAt: now,
    waitingOnClientReason: reason.trim(),
    waitingOnClientExpectedAt: expectedAt || null,
  });

  await SiteInspectionAuditLog.create({
    inspectionId,
    entityType: "INSPECTION",
    entityId: inspectionId,
    action: "PAUSE_SLA_WAITING_ON_CLIENT",
    actorId: actorId || null,
    actorRole: actorRole || null,
    fromValue: "IN_PROGRESS",
    toValue: "WAITING_ON_CLIENT",
    reason: `SLA paused: ${reason.trim()}${expectedAt ? ` (Expected: ${expectedAt.toISOString().slice(0, 10)})` : ""}`,
    ip: ip || null,
  });

  return inspection;
}

/**
 * Resumes SLA clock when inspection transitions out of WAITING_ON_CLIENT.
 * Extends submitDueAt and reviewDueAt by the total minutes paused.
 */
export async function resumeSlaClock(
  inspectionId: string,
  actorId?: string,
  actorRole?: string,
  ip?: string
): Promise<any> {
  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  if (!inspection.slaPausedAt) {
    return inspection;
  }

  const now = new Date();
  const pausedMinutes = Math.max(0, Math.round((now.getTime() - new Date(inspection.slaPausedAt).getTime()) / 60000));
  const newTotalPaused = (inspection.slaTotalPausedMinutes || 0) + pausedMinutes;

  const updates: any = {
    status: "DRAFT",
    slaPausedAt: null,
    slaTotalPausedMinutes: newTotalPaused,
  };

  // Shift milestones forward by paused duration
  if (inspection.slaSubmitDueAt) {
    updates.slaSubmitDueAt = new Date(new Date(inspection.slaSubmitDueAt).getTime() + pausedMinutes * 60000);
  }
  if (inspection.slaReviewDueAt) {
    updates.slaReviewDueAt = new Date(new Date(inspection.slaReviewDueAt).getTime() + pausedMinutes * 60000);
  }
  if (inspection.slaScheduleDueAt) {
    updates.slaScheduleDueAt = new Date(new Date(inspection.slaScheduleDueAt).getTime() + pausedMinutes * 60000);
  }

  await inspection.update(updates);

  await SiteInspectionAuditLog.create({
    inspectionId,
    entityType: "INSPECTION",
    entityId: inspectionId,
    action: "RESUME_SLA_CLOCK",
    actorId: actorId || null,
    actorRole: actorRole || null,
    fromValue: "WAITING_ON_CLIENT",
    toValue: "DRAFT",
    reason: `SLA resumed after ${pausedMinutes} minutes paused. Due dates extended.`,
    ip: ip || null,
  });

  return inspection;
}

/**
 * Manual override of an inspection due date by an Ops Manager, Director, or Admin.
 * Mandatory reason required and logged to immutable audit trail.
 */
export async function overrideDueDate(
  inspectionId: string,
  milestone: "accept" | "schedule" | "submit" | "review",
  newDueAt: Date,
  reason: string,
  actorId: string,
  actorRole: string,
  ip?: string
): Promise<any> {
  const allowedRoles = ["admin", "director", "ops_manager", "manager"];
  if (!allowedRoles.includes(actorRole)) {
    throw new Error("Only Ops Managers, Directors, or Admins may override SLA due dates.");
  }

  if (!reason || !reason.trim()) {
    throw new Error("A reason explaining the due date override is mandatory.");
  }

  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  const colMap: Record<string, string> = {
    accept: "slaAcceptDueAt",
    schedule: "slaScheduleDueAt",
    submit: "slaSubmitDueAt",
    review: "slaReviewDueAt",
  };

  const key = String(milestone).toLowerCase();
  const col = colMap[key];
  if (!col) throw new Error(`Invalid milestone ${milestone}`);

  const oldVal = inspection[col] ? new Date(inspection[col]).toISOString() : null;
  const newVal = new Date(newDueAt).toISOString();

  const updates: any = {};
  updates[col] = newDueAt;
  if (milestone === "submit") {
    updates.dueAt = newDueAt;
  }

  await inspection.update(updates);

  await SiteInspectionAuditLog.create({
    inspectionId,
    entityType: "INSPECTION",
    entityId: inspectionId,
    action: "OVERRIDE_DUE_DATE",
    actorId,
    actorRole,
    fromValue: oldVal,
    toValue: newVal,
    reason: `Manual override of ${milestone} due date: ${reason.trim()}`,
    ip: ip || null,
  });

  return inspection;
}
