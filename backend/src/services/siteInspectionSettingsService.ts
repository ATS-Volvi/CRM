import {
  SiteInspectionSetting,
  SiteHoliday,
  SiteInspectorProfile,
  SiteBase,
  User,
} from "@nexus-crm/database";
import { logSiteInspectionAudit } from "./siteInspectionAuditService";
import crypto from "crypto";

export interface SlaHoursConfig {
  accept: number;
  schedule: number;
  submit: number;
  review: number;
  acceptUrgent?: number;
  acceptNormal?: number;
  acceptLow?: number;
  submitUrgent?: number;
  submitNormal?: number;
  submitLowDays?: number;
}

export interface BalancedWeightsConfig {
  distance: number;
  load: number;
}

export interface WorkingHoursConfig {
  start: string; // "08:00"
  end: string;   // "17:00"
}

export interface ReminderTimesConfig {
  reminder1Percent: number; // 50
  reminder2Percent: number; // 80
}

export interface SiteInspectionSettingsData {
  assignmentMode: "legacy" | "nearest" | "balanced";
  maxOpenInspections: number;
  maxVisitsPerDay: number;
  maxDistanceKm: number;
  balancedWeights: BalancedWeightsConfig;
  workingWeek: Array<number | string>;
  workingHours: WorkingHoursConfig;
  timezone: string;
  slaHours: SlaHoursConfig;
  reminderTimes: ReminderTimesConfig;
  escalationRecipients: string[];
  automation: boolean;
  autoQualify: boolean;
}

export const DEFAULT_SETTINGS: SiteInspectionSettingsData = {
  assignmentMode: "legacy",
  maxOpenInspections: 5,
  maxVisitsPerDay: 2,
  maxDistanceKm: 300,
  balancedWeights: { distance: 0.5, load: 0.5 },
  workingWeek: [0, 1, 2, 3, 4], // Sunday to Thursday (0 = Sunday, 4 = Thursday)
  workingHours: { start: "08:00", end: "17:00" },
  timezone: "Asia/Riyadh",
  slaHours: {
    accept: 4,
    schedule: 24,
    submit: 48,
    review: 24,
    acceptUrgent: 4,
    acceptNormal: 4,
    acceptLow: 8,
    submitUrgent: 24,
    submitNormal: 48,
    submitLowDays: 5,
  },
  reminderTimes: { reminder1Percent: 50, reminder2Percent: 80 },
  escalationRecipients: ["ops_manager", "director"],
  automation: false,
  autoQualify: false,
};

/**
 * Validates setting values and returns an error message if invalid.
 */
export function validateSetting(key: keyof SiteInspectionSettingsData, value: any): string | null {
  switch (key) {
    case "assignmentMode":
      if (!["legacy", "nearest", "balanced"].includes(value)) {
        return "assignmentMode must be one of: legacy, nearest, balanced";
      }
      return null;
    case "maxOpenInspections":
      if (typeof value !== "number" || value < 1 || value > 50) {
        return "maxOpenInspections must be an integer between 1 and 50";
      }
      return null;
    case "maxVisitsPerDay":
      if (typeof value !== "number" || value < 1 || value > 20) {
        return "maxVisitsPerDay must be an integer between 1 and 20";
      }
      return null;
    case "maxDistanceKm":
      if (typeof value !== "number" || value < 10 || value > 2000) {
        return "maxDistanceKm must be a number between 10 and 2000 km";
      }
      return null;
    case "balancedWeights":
      if (
        !value ||
        typeof value.distance !== "number" ||
        typeof value.load !== "number" ||
        value.distance < 0 ||
        value.load < 0 ||
        Math.abs(value.distance + value.load - 1) > 0.01
      ) {
        return "balancedWeights must have positive distance and load weights that sum to 1.0";
      }
      return null;
    case "workingWeek":
      if (!Array.isArray(value) || value.length === 0) {
        return "workingWeek must be a non-empty array of days (numbers 0 to 6, or day names)";
      }
      const validNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      for (const d of value) {
        if (typeof d === "number") {
          if (!Number.isInteger(d) || d < 0 || d > 6) {
            return "workingWeek day numbers must be integers between 0 (Sunday) and 6 (Saturday)";
          }
        } else if (typeof d === "string") {
          if (!validNames.includes(d.toLowerCase())) {
            return `workingWeek day name "${d}" is invalid`;
          }
        } else {
          return "workingWeek elements must be day numbers (0 to 6) or day names";
        }
      }
      return null;
    case "workingHours":
      if (!value?.start || !value?.end || !/^\d{2}:\d{2}$/.test(value.start) || !/^\d{2}:\d{2}$/.test(value.end)) {
        return "workingHours must specify start and end in HH:mm format";
      }
      return null;
    case "timezone":
      if (typeof value !== "string" || !value.trim()) {
        return "timezone must be a valid timezone string (e.g. Asia/Riyadh)";
      }
      return null;
    case "slaHours":
      if (!value || typeof value !== "object") {
        return "slaHours must be an object";
      }
      const acceptVal = value.accept ?? value.acceptNormal;
      const schedVal = value.schedule ?? value.scheduleHours;
      const submitVal = value.submit ?? value.submitNormal;
      const reviewVal = value.review ?? value.reviewHours;
      if (
        typeof acceptVal !== "number" || acceptVal < 1 ||
        typeof schedVal !== "number" || schedVal < 1 ||
        typeof submitVal !== "number" || submitVal < 1 ||
        typeof reviewVal !== "number" || reviewVal < 1
      ) {
        return "slaHours must contain valid positive numbers for accept, schedule, submit, and review";
      }
      return null;
    case "automation":
    case "autoQualify":
      if (typeof value !== "boolean") {
        return `${key} must be a boolean`;
      }
      return null;
    default:
      return null;
  }
}

/**
 * Returns a human-friendly plain text description of what changing a setting will do.
 */
export function explainSettingEffect(key: string, oldValue: any, newValue: any): string {
  switch (key) {
    case "assignmentMode":
      if (newValue === "legacy") {
        return "Switches assignment to legacy round-robin: assignees are picked solely by fewest open inspections.";
      }
      if (newValue === "nearest") {
        return "Switches assignment to nearest-base routing: qualified inspectors are ranked by geographic proximity from their base to the project site.";
      }
      if (newValue === "balanced") {
        return "Switches assignment to balanced scoring: candidates are ranked by a weighted combination of distance from base and active workload.";
      }
      return `Assignment mode updated to ${newValue}.`;
    case "maxOpenInspections":
      return `Default inspector capacity changed from ${oldValue} to ${newValue} open inspections. Inspectors with ${newValue} or more open inspections will not receive auto-assignments.`;
    case "maxVisitsPerDay":
      return `Daily visit cap changed from ${oldValue} to ${newValue}. Inspectors will not be assigned a visit on days where they already have ${newValue} visits scheduled.`;
    case "maxDistanceKm":
      return `Maximum travel radius changed from ${oldValue} km to ${newValue} km. Inspectors farther than ${newValue} km from a site will be excluded from nearest/balanced routing.`;
    case "balancedWeights":
      return `Balanced routing weights updated to ${(newValue.distance * 100).toFixed(0)}% distance and ${(newValue.load * 100).toFixed(0)}% workload.`;
    case "workingHours":
      return `Business working hours changed to ${newValue.start} - ${newValue.end} (${DEFAULT_SETTINGS.timezone}). SLA clocks will pause outside these hours.`;
    case "workingWeek": {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const formatted = Array.isArray(newValue)
        ? newValue.map((d: any) => typeof d === "number" ? dayNames[d] || d : d).join(", ")
        : String(newValue);
      return `Working week changed to ${formatted}. SLA clocks will pause on non-working days.`;
    }
    case "slaHours": {
      const sAccept = newValue.accept ?? newValue.acceptNormal ?? 4;
      const sSched = newValue.schedule ?? newValue.scheduleHours ?? 24;
      const sSubmit = newValue.submit ?? newValue.submitNormal ?? 48;
      const sReview = newValue.review ?? newValue.reviewHours ?? 24;
      return `SLA milestone targets updated: Accept in ${sAccept}h, Schedule in ${sSched}h, Submit in ${sSubmit}h, Review in ${sReview}h.`;
    }
    case "automation":
      return newValue
        ? "Enabled site inspection automation (SLA timers, notifications, escalations, auto-requeue on leave)."
        : "Disabled site inspection automation. No automated reminders or leave reassignment will occur.";
    case "autoQualify":
      return newValue
        ? "Enabled auto-qualification: approved inspections will automatically move qualified leads to QUALIFIED stage."
        : "Disabled auto-qualification: leads will remain in their current stage until manually advanced.";
    default:
      return `Updated ${key} to ${JSON.stringify(newValue)}.`;
  }
}

/**
 * Fetches all active settings, merging database overrides with system defaults
 * and environment variable fallbacks.
 */
export async function getSettings(transaction?: any): Promise<SiteInspectionSettingsData> {
  const settings: SiteInspectionSettingsData = { ...DEFAULT_SETTINGS };

  // Environment variable overrides (highest precedence for operational flags)
  if (process.env.SITE_INSPECTION_ASSIGNMENT_MODE) {
    const mode = process.env.SITE_INSPECTION_ASSIGNMENT_MODE.toLowerCase();
    if (["legacy", "nearest", "balanced"].includes(mode)) {
      settings.assignmentMode = mode as any;
    }
  }
  if (process.env.SITE_INSPECTION_AUTOMATION !== undefined) {
    settings.automation = process.env.SITE_INSPECTION_AUTOMATION === "on" || process.env.SITE_INSPECTION_AUTOMATION === "true";
  }
  if (process.env.SITE_INSPECTION_AUTO_QUALIFY !== undefined) {
    settings.autoQualify = process.env.SITE_INSPECTION_AUTO_QUALIFY === "on" || process.env.SITE_INSPECTION_AUTO_QUALIFY === "true";
  }

  try {
    const rows = await SiteInspectionSetting.findAll(transaction ? { transaction } : undefined);
    for (const row of rows) {
      if (row.value) {
        try {
          const parsed = JSON.parse(row.value);
          (settings as any)[row.key] = parsed;
        } catch {
          (settings as any)[row.key] = row.value;
        }
      }
    }
  } catch (err) {
    console.warn("[SiteInspectionSettings] Error fetching settings from DB, using defaults:", err);
  }

  return settings;
}

/**
 * Updates a set of settings with range validation, plain-text effect reporting, and audit logging.
 */
export async function updateSettings(
  updates: Partial<SiteInspectionSettingsData>,
  actorId?: string,
  actorRole?: string,
  ip?: string
): Promise<{ settings: SiteInspectionSettingsData; explanations: Record<string, string> }> {
  const current = await getSettings();
  const explanations: Record<string, string> = {};

  for (const [key, val] of Object.entries(updates)) {
    const typedKey = key as keyof SiteInspectionSettingsData;
    const err = validateSetting(typedKey, val);
    if (err) {
      throw new Error(`Invalid setting for ${key}: ${err}`);
    }

    const oldVal = (current as any)[typedKey];
    const explanation = explainSettingEffect(key, oldVal, val);
    explanations[key] = explanation;

    await SiteInspectionSetting.upsert({
      key,
      value: JSON.stringify(val),
      updatedBy: actorId || null,
    });

    await logSiteInspectionAudit({
      entityType: "SETTING",
      entityId: key,
      action: "UPDATE_SETTING",
      actorId: actorId || null,
      actorRole: actorRole || null,
      fromValue: oldVal,
      toValue: val,
      reason: explanation,
      ip: ip || null,
    });
  }

  const refreshed = await getSettings();
  return { settings: refreshed, explanations };
}

// ─── Holidays Management ──────────────────────────────────────────────────

export async function listHolidays(onlyActive: boolean = true): Promise<any[]> {
  const where: any = {};
  if (onlyActive) where.isActive = true;
  return SiteHoliday.findAll({ where, order: [["date", "ASC"]] });
}

export async function addHoliday(
  date: string,
  name: string,
  actorId?: string,
  actorRole?: string
): Promise<any> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Holiday date must be in YYYY-MM-DD format");
  }
  if (!name || !name.trim()) {
    throw new Error("Holiday name is required");
  }

  const holiday = await SiteHoliday.create({
    id: crypto.randomUUID(),
    date,
    name: name.trim(),
    isActive: true,
  });

  await logSiteInspectionAudit({
    entityType: "HOLIDAY",
    entityId: holiday.id,
    action: "ADD_HOLIDAY",
    actorId: actorId || null,
    actorRole: actorRole || null,
    toValue: { date, name },
  });

  return holiday;
}

export async function updateHoliday(
  id: string,
  updates: { date?: string; name?: string; isActive?: boolean },
  actorId?: string,
  actorRole?: string
): Promise<any> {
  const holiday = await SiteHoliday.findByPk(id);
  if (!holiday) throw new Error("Holiday not found");

  const old = holiday.toJSON();
  await holiday.update(updates);

  await logSiteInspectionAudit({
    entityType: "HOLIDAY",
    entityId: holiday.id,
    action: "UPDATE_HOLIDAY",
    actorId: actorId || null,
    actorRole: actorRole || null,
    fromValue: old,
    toValue: holiday.toJSON(),
  });

  return holiday;
}

export async function deleteHoliday(id: string, actorId?: string, actorRole?: string): Promise<void> {
  const holiday = await SiteHoliday.findByPk(id);
  if (!holiday) return;

  const old = holiday.toJSON();
  await holiday.destroy();

  await logSiteInspectionAudit({
    entityType: "HOLIDAY",
    entityId: id,
    action: "DELETE_HOLIDAY",
    actorId: actorId || null,
    actorRole: actorRole || null,
    fromValue: old,
  });
}

// ─── Inspector Profiles Management ────────────────────────────────────────

export async function getInspectorProfiles(): Promise<any[]> {
  const siteManagers = await User.findAll({
    where: { role: "site_manager" },
    attributes: ["id", "name", "email", "role", "status", "phone"],
    include: [
      {
        model: SiteInspectorProfile,
        as: "inspectorProfile",
        include: [{ model: SiteBase, as: "homeBase" }],
      },
    ],
    order: [["name", "ASC"]],
  });

  return siteManagers.map((sm: any) => {
    const prof = sm.inspectorProfile;
    return {
      userId: sm.id,
      name: sm.name,
      email: sm.email,
      phone: sm.phone,
      status: sm.status,
      profile: prof
        ? {
            id: prof.id,
            homeBaseId: prof.homeBaseId,
            homeBaseName: prof.homeBase?.name || null,
            coverageBaseIds: prof.coverageBaseIds ? JSON.parse(prof.coverageBaseIds) : [],
            isAvailable: prof.isAvailable,
            onLeaveFrom: prof.onLeaveFrom,
            onLeaveTo: prof.onLeaveTo,
            maxOpenInspections: prof.maxOpenInspections,
            maxVisitsPerDay: prof.maxVisitsPerDay,
            maxDistanceKm: prof.maxDistanceKm,
            certifications: prof.certifications ? JSON.parse(prof.certifications) : [],
            languages: prof.languages ? JSON.parse(prof.languages) : [],
            lastAssignedAt: prof.lastAssignedAt,
          }
        : null,
    };
  });
}

export async function getInspectorProfileByUserId(userId: string): Promise<any> {
  return SiteInspectorProfile.findOne({
    where: { userId },
    include: [{ model: SiteBase, as: "homeBase" }],
  });
}

export async function upsertInspectorProfile(
  userId: string,
  data: {
    homeBaseId?: string | null;
    coverageBaseIds?: string[];
    isAvailable?: boolean;
    onLeaveFrom?: Date | string | null;
    onLeaveTo?: Date | string | null;
    maxOpenInspections?: number | null;
    maxVisitsPerDay?: number | null;
    maxDistanceKm?: number | null;
    certifications?: string[];
    languages?: string[];
  },
  actorId?: string,
  actorRole?: string,
  ip?: string
): Promise<any> {
  const user = await User.findByPk(userId);
  if (!user || user.role !== "site_manager") {
    throw new Error("Inspector profile can only be configured for users with role 'site_manager'");
  }

  let profile = await SiteInspectorProfile.findOne({ where: { userId } });
  const old = profile ? profile.toJSON() : null;

  const payload: any = {
    userId,
    homeBaseId: data.homeBaseId !== undefined ? data.homeBaseId : profile?.homeBaseId || null,
    coverageBaseIds:
      data.coverageBaseIds !== undefined ? JSON.stringify(data.coverageBaseIds) : profile?.coverageBaseIds || "[]",
    isAvailable: data.isAvailable !== undefined ? data.isAvailable : profile?.isAvailable ?? true,
    onLeaveFrom: data.onLeaveFrom ? new Date(data.onLeaveFrom) : null,
    onLeaveTo: data.onLeaveTo ? new Date(data.onLeaveTo) : null,
    maxOpenInspections: data.maxOpenInspections !== undefined ? data.maxOpenInspections : profile?.maxOpenInspections ?? null,
    maxVisitsPerDay: data.maxVisitsPerDay !== undefined ? data.maxVisitsPerDay : profile?.maxVisitsPerDay ?? null,
    maxDistanceKm: data.maxDistanceKm !== undefined ? data.maxDistanceKm : profile?.maxDistanceKm ?? null,
    certifications:
      data.certifications !== undefined ? JSON.stringify(data.certifications) : profile?.certifications || "[]",
    languages: data.languages !== undefined ? JSON.stringify(data.languages) : profile?.languages || "[]",
  };

  if (!profile) {
    payload.id = crypto.randomUUID();
    profile = await SiteInspectorProfile.create(payload);
  } else {
    await profile.update(payload);
  }

  await logSiteInspectionAudit({
    entityType: "PROFILE",
    entityId: userId,
    action: old ? "UPDATE_PROFILE" : "CREATE_PROFILE",
    actorId: actorId || null,
    actorRole: actorRole || null,
    fromValue: old,
    toValue: profile.toJSON(),
    reason: `Updated inspector profile for ${user.name}`,
    ip: ip || null,
  });

  return profile;
}
