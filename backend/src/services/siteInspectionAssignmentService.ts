import {
  sequelize,
  SiteInspection,
  SiteBase,
  SiteInspectorProfile,
  User,
  Lead,
} from "@nexus-crm/database";
import { Op, Transaction } from "sequelize";
import { getSettings } from "./siteInspectionSettingsService";
import {
  evaluateAndRankCandidates,
  EngineCandidate,
  EngineSiteBase,
  EngineProjectLocation,
} from "./siteInspectionAssignmentEngine";
import { logSiteInspectionAudit } from "./siteInspectionAuditService";
import { createNotification } from "./notificationService";
import { APPROVER_ROLES } from "./siteInspectionService";

export interface RequestInspectionPayload {
  siteAreaName?: string | null;
  siteLatitudeHint?: number | null;
  siteLongitudeHint?: number | null;
  priority?: "URGENT" | "NORMAL" | "LOW";
  priorityReason?: string | null;
  requiredCertifications?: string[];
  requestedInspectorId?: string | null;
  requestedInspectorReason?: string | null;
  requestNote?: string | null;
}

// Known coordinates for major Saudi industrial regions and bases
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  jubail: { lat: 27.0, lng: 49.65 },
  jafurah: { lat: 25.55, lng: 49.85 },
  yanbu: { lat: 24.09, lng: 38.06 },
  riyadh: { lat: 24.71, lng: 46.68 },
  dammam: { lat: 26.42, lng: 50.09 },
  khobar: { lat: 26.28, lng: 50.21 },
  jeddah: { lat: 21.54, lng: 39.17 },
  ras_tanura: { lat: 26.65, lng: 50.15 },
  eastern_province: { lat: 26.42, lng: 50.09 },
  western_province: { lat: 21.54, lng: 39.17 },
  central_province: { lat: 24.71, lng: 46.68 },
};

/**
 * Resolves project coordinates from explicit pin, area name, or lead profile.
 */
export function resolveLocation(
  payload: RequestInspectionPayload,
  lead: any,
  bases: any[]
): {
  location: EngineProjectLocation | null;
  source: "PIN" | "AREA_NAME" | "LEAD_FIELDS" | "NONE";
  resolvedAreaName: string | null;
} {
  // 1. Explicit coordinates / pin
  if (
    payload.siteLatitudeHint != null &&
    payload.siteLongitudeHint != null &&
    !isNaN(Number(payload.siteLatitudeHint)) &&
    !isNaN(Number(payload.siteLongitudeHint))
  ) {
    return {
      location: {
        latitude: Number(payload.siteLatitudeHint),
        longitude: Number(payload.siteLongitudeHint),
        areaName: payload.siteAreaName || null,
      },
      source: "PIN",
      resolvedAreaName: payload.siteAreaName || "Map Pin Location",
    };
  }

  // 2. Area name match against known bases and regional hubs
  if (payload.siteAreaName && payload.siteAreaName.trim()) {
    const rawName = payload.siteAreaName.trim().toLowerCase();
    for (const b of bases) {
      if (
        rawName.includes(b.name.toLowerCase()) ||
        rawName.includes(b.code.toLowerCase()) ||
        b.name.toLowerCase().includes(rawName)
      ) {
        return {
          location: { latitude: b.latitude, longitude: b.longitude, areaName: b.name },
          source: "AREA_NAME",
          resolvedAreaName: payload.siteAreaName.trim(),
        };
      }
    }

    for (const [key, coords] of Object.entries(REGION_COORDINATES)) {
      if (rawName.includes(key.replace(/_/g, " ")) || rawName.includes(key)) {
        return {
          location: { latitude: coords.lat, longitude: coords.lng, areaName: payload.siteAreaName },
          source: "AREA_NAME",
          resolvedAreaName: payload.siteAreaName.trim(),
        };
      }
    }
  }

  // 3. Fallback to Lead fields (city, territory, address)
  const leadFieldsToTest = [lead?.city, lead?.territory, lead?.address].filter(Boolean);
  for (const field of leadFieldsToTest) {
    const rawField = String(field).toLowerCase();
    for (const [key, coords] of Object.entries(REGION_COORDINATES)) {
      if (rawField.includes(key.replace(/_/g, " ")) || rawField.includes(key)) {
        return {
          location: { latitude: coords.lat, longitude: coords.lng, areaName: String(field) },
          source: "LEAD_FIELDS",
          resolvedAreaName: String(field),
        };
      }
    }
  }

  return {
    location: null,
    source: "NONE",
    resolvedAreaName: payload.siteAreaName || null,
  };
}

/**
 * Loads all active site managers with their profiles and current workload.
 */
async function loadEngineCandidates(transaction?: Transaction): Promise<EngineCandidate[]> {
  const users = await User.findAll({
    where: {
      role: "site_manager",
      [Op.or]: [{ status: { [Op.ne]: "Inactive" } }, { status: null }],
    },
    include: [
      {
        model: SiteInspectorProfile,
        as: "inspectorProfile",
      },
    ],
    transaction,
  });

  const openStatuses = ["REQUESTED", "DRAFT", "CHANGES_REQUESTED", "SUBMITTED"];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const candidates: EngineCandidate[] = [];

  for (const u of users as any[]) {
    const openCount = await SiteInspection.count({
      where: {
        assignedToId: u.id,
        status: { [Op.in]: openStatuses },
      },
      transaction,
    });

    const todayVisits = await SiteInspection.count({
      where: {
        assignedToId: u.id,
        scheduledVisitAt: {
          [Op.between]: [todayStart, todayEnd],
        },
      },
      transaction,
    });

    const prof = u.inspectorProfile;
    candidates.push({
      userId: u.id,
      name: u.name,
      isAvailable: prof ? prof.isAvailable : u.isAvailable ?? true,
      userStatus: u.status,
      onLeaveFrom: prof?.onLeaveFrom || null,
      onLeaveTo: prof?.onLeaveTo || null,
      homeBaseId: prof?.homeBaseId || null,
      coverageBaseIds: prof?.coverageBaseIds ? JSON.parse(prof.coverageBaseIds) : [],
      maxOpenInspections: prof?.maxOpenInspections || null,
      maxVisitsPerDay: prof?.maxVisitsPerDay || null,
      maxDistanceKm: prof?.maxDistanceKm || null,
      certifications: prof?.certifications ? JSON.parse(prof.certifications) : [],
      languages: prof?.languages ? JSON.parse(prof.languages) : [],
      lastAssignedAt: prof?.lastAssignedAt || null,
      openInspectionsCount: openCount,
      scheduledVisitsTodayCount: todayVisits,
    });
  }

  return candidates;
}

async function withBusyRetry<T>(fn: () => Promise<T>, maxRetries = 10): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (
        (err?.message?.includes("SQLITE_BUSY") ||
          err?.original?.code === "SQLITE_BUSY" ||
          err?.name === "SequelizeTimeoutError") &&
        attempt < maxRetries
      ) {
        attempt++;
        await new Promise((r) => setTimeout(r, 50 * attempt + Math.floor(Math.random() * 50)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Assigns an inspection transactionally with row locking / Postgres advisory lock.
 */
export async function assignInspectionTransaction(
  inspectionId: string,
  payload: RequestInspectionPayload,
  actorId?: string,
  actorRole?: string
): Promise<any> {
  const pendingNotifications: Array<{ userId: string; type: string; title: string; message: string; link?: string }> = [];

  const resultInspection = await withBusyRetry(async () => {
    return sequelize.transaction(async (t) => {
      // 1. Acquire advisory lock on PostgreSQL to guarantee strict mutual exclusion
      if (sequelize.getDialect() === "postgres") {
        await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('site_inspection_assignment'));", {
          transaction: t,
        });
      }

      const settings = await getSettings(t);

      const inspection: any = await SiteInspection.findByPk(inspectionId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!inspection) throw new Error("Site inspection not found");

      const lead: any = await Lead.findByPk(inspection.leadId, { transaction: t });
      const bases = await SiteBase.findAll({ where: { isActive: true }, transaction: t });

      // Validate URGENT priority reason requirement
      const priority = payload.priority || inspection.priority || "NORMAL";
      if (priority === "URGENT") {
        const reason = payload.priorityReason || inspection.priorityReason;
        if (!reason || !reason.trim()) {
          throw new Error("Priority URGENT requires a priority reason.");
        }
      }

      // Resolve location
      const { location, source, resolvedAreaName } = resolveLocation(payload, lead, bases);

      // If rep requested a specific inspector
      if (payload.requestedInspectorId) {
        const isApprover = actorRole && APPROVER_ROLES.includes(actorRole);
        if (!isApprover) {
          // Sales rep requesting specific inspector: enter PENDING_CONFIRMATION
          await inspection.update(
            {
              siteAreaName: resolvedAreaName,
              siteLatitudeHint: location?.latitude || null,
              siteLongitudeHint: location?.longitude || null,
              siteLocationSource: source,
              priority,
              priorityReason: payload.priorityReason || null,
              requestedInspectorId: payload.requestedInspectorId,
              requestedInspectorReason: payload.requestedInspectorReason || null,
              assignmentState: "PENDING_CONFIRMATION",
              assignmentReason: `Sales rep requested inspector. Awaiting manager confirmation. Reason: ${payload.requestedInspectorReason || "None specified"}`,
            },
            { transaction: t }
          );

          await logSiteInspectionAudit({
            inspectionId: inspection.id,
            entityType: "INSPECTION",
            entityId: inspection.id,
            action: "REQUEST_SPECIFIC_INSPECTOR",
            actorId,
            actorRole,
            toValue: { requestedInspectorId: payload.requestedInspectorId, state: "PENDING_CONFIRMATION" },
            reason: payload.requestedInspectorReason,
            transaction: t,
          });

          // Queue notifications for Ops Managers
          try {
            const approvers = await User.findAll({
              where: { role: { [Op.in]: APPROVER_ROLES } },
              transaction: t,
            });
            for (const app of approvers) {
              pendingNotifications.push({
                userId: (app as any).id,
                type: "site_inspection",
                title: "Inspector Request Pending Confirmation",
                message: `Specific inspector requested for ${inspection.inspectionNumber}. Please confirm or reassign.`,
                link: `/site-inspections/${inspection.id}`,
              });
            }
          } catch {}

          return inspection;
        }
      }

      // Check if needs area (location source is NONE)
      if (source === "NONE" && settings.assignmentMode !== "legacy") {
        await inspection.update(
          {
            siteAreaName: payload.siteAreaName || null,
            siteLocationSource: "NONE",
            assignmentState: "NEEDS_AREA",
            assignmentReason: "Site inspection has no project area or coordinates. Needs area assignment.",
            priority,
            priorityReason: payload.priorityReason || null,
          },
          { transaction: t }
        );

        await logSiteInspectionAudit({
          inspectionId: inspection.id,
          entityType: "INSPECTION",
          entityId: inspection.id,
          action: "NEEDS_AREA",
          actorId,
          actorRole,
          toValue: { state: "NEEDS_AREA" },
          reason: "Location could not be resolved from area name or lead fields",
          transaction: t,
        });

        // Queue alert for Ops Manager
        try {
          const approvers = await User.findAll({
            where: { role: { [Op.in]: APPROVER_ROLES } },
            transaction: t,
          });
          for (const app of approvers) {
            pendingNotifications.push({
              userId: (app as any).id,
              type: "site_inspection",
              title: "Site Inspection Needs Area",
              message: `Site Inspection ${inspection.inspectionNumber} has no project area or map pin. Needs area assignment.`,
              link: `/site-inspections/${inspection.id}`,
            });
          }
        } catch {}

        return inspection;
      }

      // Evaluate candidates with pure assignment engine
      const candidates = await loadEngineCandidates(t);
      const engineBases: EngineSiteBase[] = bases.map((b: any) => ({
        id: b.id,
        name: b.name,
        latitude: b.latitude,
        longitude: b.longitude,
      }));

      const decision = evaluateAndRankCandidates({
        mode: settings.assignmentMode,
        projectLocation: location,
        requiredCertifications: payload.requiredCertifications,
        candidates,
        bases: engineBases,
        settings: {
          maxOpenInspections: settings.maxOpenInspections,
          maxVisitsPerDay: settings.maxVisitsPerDay,
          maxDistanceKm: settings.maxDistanceKm,
          balancedWeights: settings.balancedWeights,
        },
      });

      const now = new Date();
      const updateFields: any = {
        siteAreaName: resolvedAreaName,
        siteLatitudeHint: location?.latitude || null,
        siteLongitudeHint: location?.longitude || null,
        siteLocationSource: source,
        priority,
        priorityReason: payload.priorityReason || null,
        requiredCertifications: payload.requiredCertifications ? JSON.stringify(payload.requiredCertifications) : null,
        assignmentMode: decision.assignmentMode,
        assignmentState: decision.assignmentState,
        assignmentReason: decision.assignmentReason,
      };

      if (decision.selectedUserId) {
        updateFields.assignedToId = decision.selectedUserId;
        updateFields.assignedAt = now;

        // Update inspector profile lastAssignedAt
        await SiteInspectorProfile.update(
          { lastAssignedAt: now },
          { where: { userId: decision.selectedUserId }, transaction: t }
        );
      } else {
        updateFields.assignedToId = null;
      }

      await inspection.update(updateFields, { transaction: t });

      // Audit log entry
      await logSiteInspectionAudit({
        inspectionId: inspection.id,
        entityType: "INSPECTION",
        entityId: inspection.id,
        action: decision.selectedUserId ? "AUTO_ASSIGN" : "ASSIGN_UNASSIGNED",
        actorId,
        actorRole,
        toValue: {
          assignedToId: decision.selectedUserId,
          mode: decision.assignmentMode,
          state: decision.assignmentState,
          reason: decision.assignmentReason,
        },
        reason: decision.assignmentReason,
        transaction: t,
      });

      // Queue notifications
      if (decision.selectedUserId) {
        pendingNotifications.push({
          userId: decision.selectedUserId,
          type: "site_inspection",
          title: "New Site Inspection Assigned",
          message: `Site Inspection ${inspection.inspectionNumber} (${priority} Priority) has been assigned to you. Area: ${resolvedAreaName || "Saudi Arabia"}. Reason: ${decision.assignmentReason}`,
          link: `/site-inspections/${inspection.id}`,
        });
      } else {
        // Notify Ops Managers that inspection is in UNASSIGNED queue
        try {
          const approvers = await User.findAll({
            where: { role: { [Op.in]: APPROVER_ROLES } },
            transaction: t,
          });
          for (const app of approvers) {
            pendingNotifications.push({
              userId: (app as any).id,
              type: "site_inspection",
              title: "Site Inspection Unassigned",
              message: `Site Inspection ${inspection.inspectionNumber} could not be assigned: ${decision.assignmentReason}`,
              link: `/site-inspections/${inspection.id}`,
            });
          }
        } catch {}
      }

      return inspection;
    });
  });

  // Dispatch queued notifications asynchronously after transaction commits
  for (const n of pendingNotifications) {
    createNotification(n.userId, n.type, n.title, n.message, n.link).catch(() => {});
  }

  return resultInspection;
}

/**
 * Manual override reassignment by Ops Manager, Admin, or Director with required reason.
 */
export async function manualReassignInspection(
  inspectionId: string,
  newAssigneeId: string,
  reason: string,
  actorId: string,
  actorRole: string,
  ip?: string
): Promise<any> {
  if (!APPROVER_ROLES.includes(actorRole)) {
    throw new Error("Only managers or approvers may reassign site inspections.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A reason is required when reassigning an inspection.");
  }

  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  if (["SUBMITTED", "APPROVED", "CANCELLED"].includes(inspection.status)) {
    throw new Error(`Cannot reassign inspection in status ${inspection.status}`);
  }

  const targetUser: any = await User.findByPk(newAssigneeId);
  if (!targetUser) throw new Error("Target user not found");
  if (targetUser.role !== "site_manager") {
    throw new Error("Site inspections can only be assigned to users with role 'site_manager'");
  }

  const oldAssigneeId = inspection.assignedToId;
  const now = new Date();

  await inspection.update({
    assignedToId: newAssigneeId,
    assignmentMode: "manual",
    assignmentState: "ASSIGNED",
    assignmentReason: `Manual override by ${actorRole}: ${reason.trim()}`,
    assignedAt: now,
  });

  await SiteInspectorProfile.update(
    { lastAssignedAt: now },
    { where: { userId: newAssigneeId } }
  );

  await logSiteInspectionAudit({
    inspectionId: inspection.id,
    entityType: "INSPECTION",
    entityId: inspection.id,
    action: "MANUAL_REASSIGN",
    actorId,
    actorRole,
    fromValue: { assignedToId: oldAssigneeId },
    toValue: { assignedToId: newAssigneeId },
    reason: reason.trim(),
    ip,
  });

  try {
    await createNotification(
      newAssigneeId,
      "site_inspection",
      "Site Inspection Reassigned To You",
      `Site Inspection ${inspection.inspectionNumber} has been reassigned to you. Reason: ${reason.trim()}`,
      `/site-inspections/${inspection.id}`
    );
  } catch {}

  return inspection;
}

/**
 * Bulk-assigns inspections from the Unassigned queue to a specified inspector
 * or triggers auto-assignment for each.
 */
export async function bulkAssignInspections(
  inspectionIds: string[],
  targetAssigneeId: string | null,
  reason: string,
  actorId: string,
  actorRole: string
): Promise<{ assignedCount: number; errors: Array<{ id: string; error: string }> }> {
  if (!APPROVER_ROLES.includes(actorRole)) {
    throw new Error("Only managers or approvers may bulk-assign inspections.");
  }

  let assignedCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of inspectionIds) {
    try {
      if (targetAssigneeId) {
        await manualReassignInspection(id, targetAssigneeId, reason, actorId, actorRole);
      } else {
        // Auto-reassign via transaction
        await assignInspectionTransaction(id, {}, actorId, actorRole);
      }
      assignedCount++;
    } catch (err: any) {
      errors.push({ id, error: err.message || String(err) });
    }
  }

  return { assignedCount, errors };
}

/**
 * Delegation: when an inspector is on leave, their open inspections are
 * automatically re-offered to the next available candidates.
 * Active only when SITE_INSPECTION_AUTOMATION is enabled.
 */
export async function delegateInspectionsForAbsentInspector(
  absentUserId: string,
  reason: string = "Inspector is on approved leave"
): Promise<{ reofferedCount: number }> {
  const settings = await getSettings();
  if (!settings.automation) {
    return { reofferedCount: 0 };
  }

  const openStatuses = ["REQUESTED", "DRAFT", "CHANGES_REQUESTED"];
  const inspections = await SiteInspection.findAll({
    where: {
      assignedToId: absentUserId,
      status: { [Op.in]: openStatuses },
    },
  });

  let reofferedCount = 0;
  for (const insp of inspections) {
    try {
      await assignInspectionTransaction(
        insp.id,
        {
          siteAreaName: insp.siteAreaName,
          siteLatitudeHint: insp.siteLatitudeHint,
          siteLongitudeHint: insp.siteLongitudeHint,
          priority: insp.priority || "NORMAL",
          priorityReason: insp.priorityReason,
        },
        undefined,
        "system"
      );
      reofferedCount++;
    } catch (err) {
      console.warn(`[Delegation] Failed to re-offer inspection ${insp.id}:`, err);
    }
  }

  return { reofferedCount };
}
