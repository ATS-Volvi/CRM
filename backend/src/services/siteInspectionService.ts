import {
  sequelize,
  SiteBase,
  SiteFacility,
  SiteInspection,
  SiteInspectionService,
  SiteInspectionAttachment,
  Lead,
  User,
  Activity,
} from "@nexus-crm/database";
import { Op } from "sequelize";
import crypto from "crypto";
import { createNotification } from "./notificationService";

export const APPROVER_ROLES = ["admin", "director", "manager", "sales_manager", "ops_manager"];

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers.
 * Rounded to 0.1 km.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
      lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
    return 0;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Computes single/round-trip cycle km and fuel estimate.
 * totalCycleKm = 2 * (mobilizationKm + sum of active waste service distanceKm)
 * estFuelLitres = totalCycleKm * fuelFactor (default 0.4 L/km)
 */
export function computeMetrics(
  mobilizationKm: number,
  services: Array<{ isActive?: boolean; distanceKm?: number | null }>
): { totalCycleKm: number; estFuelLitres: number } {
  const mob = Math.max(0, Number(mobilizationKm) || 0);
  const activeWasteKm = (services || [])
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + Math.max(0, Number(s.distanceKm) || 0), 0);

  const totalCycleKm = Math.round(2 * (mob + activeWasteKm) * 10) / 10;
  const fuelFactor = process.env.SITE_INSPECTION_FUEL_L_PER_KM
    ? parseFloat(process.env.SITE_INSPECTION_FUEL_L_PER_KM)
    : 0.4;
  const estFuelLitres = Math.round(totalCycleKm * fuelFactor * 10) / 10;

  return { totalCycleKm, estFuelLitres };
}

/**
 * Evaluates whether lead qualification/conversion can proceed.
 * Allowed only when lead.siteInspectionStatus === "APPROVED".
 * Env SITE_INSPECTION_GATE=off disables enforcement.
 */
export async function getSiteInspectionGate(
  leadId: string
): Promise<{ allowed: boolean; status: string; message: string }> {
  if (process.env.SITE_INSPECTION_GATE === "off") {
    return {
      allowed: true,
      status: "APPROVED",
      message: "Site inspection gate is disabled (SITE_INSPECTION_GATE=off).",
    };
  }

  const lead: any = await Lead.findByPk(leadId);
  if (!lead) {
    return {
      allowed: false,
      status: "NOT_REQUESTED",
      message: "Lead record not found.",
    };
  }

  const status = lead.siteInspectionStatus || "NOT_REQUESTED";

  switch (status) {
    case "APPROVED":
      return {
        allowed: true,
        status: "APPROVED",
        message: "Site inspection has been completed and approved.",
      };
    case "SUBMITTED":
      return {
        allowed: false,
        status: "SUBMITTED",
        message: "Site inspection has been submitted and is awaiting approval by an operations manager or supervisor.",
      };
    case "DRAFT":
      return {
        allowed: false,
        status: "DRAFT",
        message: "Site inspection is currently in Draft. It must be completed, submitted, and approved prior to qualification.",
      };
    case "CHANGES_REQUESTED":
      return {
        allowed: false,
        status: "CHANGES_REQUESTED",
        message: "Changes were requested on the Site Inspection. It must be revised, resubmitted, and approved.",
      };
    case "REQUESTED":
      return {
        allowed: false,
        status: "REQUESTED",
        message: "Site inspection has been requested and is awaiting completion by a Site Manager.",
      };
    case "CANCELLED":
      return {
        allowed: false,
        status: "CANCELLED",
        message: "Site inspection was cancelled. A new inspection must be requested and approved.",
      };
    case "NOT_REQUESTED":
    default:
      return {
        allowed: false,
        status: "NOT_REQUESTED",
        message: "A Site Inspection must be requested and approved before this lead can be qualified or converted.",
      };
  }
}

/**
 * Creates and requests a new Site Inspection for a Lead.
 * Ensures one live inspection per lead.
 * Assigns inspector via the assignment engine (legacy, nearest, balanced).
 */
export async function requestSiteInspection(
  leadId: string,
  requestedById?: string,
  requestNote?: string,
  options?: any,
  actorRole?: string
): Promise<any> {
  const lead: any = await Lead.findByPk(leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  // Check for existing live inspection
  const existingInspection = await SiteInspection.findOne({
    where: {
      leadId,
      status: { [Op.ne]: "CANCELLED" },
    },
    include: [{ model: SiteInspectionService, as: "services" }],
    order: [["createdAt", "DESC"]],
  });

  if (existingInspection) {
    return existingInspection;
  }

  // Generate inspection number: SI-YYYY-####
  const currentYear = new Date().getFullYear();
  const countThisYear = await SiteInspection.count();
  let inspectionNumber = `SI-${currentYear}-${String(countThisYear + 1).padStart(4, "0")}`;
  const existingNum = await SiteInspection.findOne({ where: { inspectionNumber } });
  if (existingNum) {
    inspectionNumber = `SI-${currentYear}-${String(countThisYear + 1).padStart(4, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  }

  // SLA Hours
  const slaHours = parseInt(process.env.SITE_INSPECTION_SLA_HOURS || "48", 10);
  const dueAt = new Date(Date.now() + slaHours * 3600 * 1000);

  const clientName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  const rfqNum = lead.leadNumber || (lead.id ? lead.id.slice(0, 8).toUpperCase() : "");
  const scope = lead.body || lead.notes || lead.extractedRequirement?.requirement || lead.subject || "";

  const payloadOptions = options || {};
  const priority = payloadOptions.priority || "NORMAL";
  if (priority === "URGENT" && (!payloadOptions.priorityReason || !payloadOptions.priorityReason.trim())) {
    throw new Error("Priority URGENT requires a priority reason.");
  }

  const { isPhase2SchemaReady } = require("@nexus-crm/database");
  const { getSettings } = require("./siteInspectionSettingsService");
  const settings = await getSettings().catch(() => ({ assignmentMode: "legacy" }));
  const hasPhase2ExplicitOptions = Boolean(
    payloadOptions.requestedInspectorId ||
    payloadOptions.siteAreaName ||
    (payloadOptions.priority && payloadOptions.priority !== "NORMAL") ||
    (payloadOptions.requiredCertifications && payloadOptions.requiredCertifications.length > 0)
  );
  const usePhase2Engine = Boolean(isPhase2SchemaReady && (settings.assignmentMode !== "legacy" || hasPhase2ExplicitOptions));

  const createFields: any = {
    id: crypto.randomUUID(),
    inspectionNumber,
    leadId: lead.id,
    dealId: null,
    status: "REQUESTED",
    assignedToId: null, // Set below
    requestedById: requestedById || lead.assignedToId || null,
    requestNote: requestNote || payloadOptions.requestNote || null,
    dueAt,
    baseId: null,
    baseName: null,
    siteName: lead.company || clientName || "Client Site",
    siteAddress: null,
    latitude: null,
    longitude: null,
    auditAt: null,
    rfqNumber: rfqNum,
    scopeSummary: scope,
    clientOrganization: lead.company || "",
    clientRepName: clientName || "",
    clientRepPhone: lead.phone || "",
    mobilizationRoute: null,
    mobilizationKm: 0,
    speedLimitKmh: 80,
    baseToSiteStraightKm: 0,
    totalCycleKm: 0,
    estFuelLitres: 0,
    observations: null,
    accepted: false,
    revision: 1,
  };

  if (isPhase2SchemaReady && (SiteInspection as any).rawAttributes?.priority) {
    createFields.priority = priority;
    createFields.priorityReason = payloadOptions.priorityReason || null;
    createFields.siteAreaName = payloadOptions.siteAreaName || null;
    createFields.siteLatitudeHint = payloadOptions.siteLatitudeHint || null;
  }

  // Create with retry in case of transient database locks or collisions
  let inspection: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createFields.inspectionNumber = inspectionNumber;
      inspection = await SiteInspection.create(createFields);
      break;
    } catch (err: any) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1) + Math.floor(Math.random() * 50)));
      inspectionNumber = `SI-${currentYear}-${String(countThisYear + attempt + 2).padStart(4, "0")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    }
  }

  // Pre-create the 3 waste services inactive
  await SiteInspectionService.bulkCreate([
    {
      id: crypto.randomUUID(),
      inspectionId: inspection.id,
      serviceType: "SEWAGE",
      isActive: false,
      distanceKm: 0,
    },
    {
      id: crypto.randomUUID(),
      inspectionId: inspection.id,
      serviceType: "GENERAL",
      isActive: false,
      distanceKm: 0,
    },
    {
      id: crypto.randomUUID(),
      inspectionId: inspection.id,
      serviceType: "HAZARDOUS",
      isActive: false,
      distanceKm: 0,
    },
  ]);

  // Log Activity on the lead
  try {
    const creatorId = requestedById || lead.assignedToId;
    if (creatorId) {
      await Activity.create({
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: "site_inspection",
        outcome: `Site Inspection requested (${inspectionNumber})`,
        notes: requestNote || "Site inspection requested prior to qualification.",
        createdById: creatorId,
        direction: "internal",
      });
    }
  } catch (actErr) {
    console.warn("[requestSiteInspection] Activity create warn:", actErr);
  }

  // Sync Lead state
  await lead.update({
    siteInspectionStatus: "REQUESTED",
    siteInspectionId: inspection.id,
  });

  // Assign inspector
  if (usePhase2Engine) {
    // Phase 2 Transactional Assignment Service (engine, advisory locks, audit logs, notifications)
    try {
      const { assignInspectionTransaction } = require("./siteInspectionAssignmentService");
      await assignInspectionTransaction(
        inspection.id,
        {
          siteAreaName: payloadOptions.siteAreaName,
          siteLatitudeHint: payloadOptions.siteLatitudeHint,
          siteLongitudeHint: payloadOptions.siteLongitudeHint,
          priority,
          priorityReason: payloadOptions.priorityReason,
          requiredCertifications: payloadOptions.requiredCertifications,
          requestedInspectorId: payloadOptions.requestedInspectorId,
          requestedInspectorReason: payloadOptions.requestedInspectorReason,
          requestNote: requestNote || payloadOptions.requestNote,
        },
        requestedById,
        actorRole
      );
    } catch (assignErr) {
      console.error("[requestSiteInspection] Phase 2 Assignment error:", assignErr);
    }
  } else {
    // Pure Legacy Pre-Phase 2 Assignment: fewest open inspections, fair round-robin
    // Does NOT query SiteInspectorProfiles, SiteInspectionSettings, or write SiteInspectionAuditLogs
    try {
      const siteManagers = await User.findAll({
        where: {
          role: "site_manager",
          [Op.or]: [{ status: { [Op.ne]: "Inactive" } }, { status: null }],
        },
      });

      let assignedManagerId: string | null = null;
      if (siteManagers.length > 0) {
        const openStatuses = ["REQUESTED", "DRAFT", "CHANGES_REQUESTED", "SUBMITTED"];
        const managersWithCounts = await Promise.all(
          siteManagers.map(async (mgr: any) => {
            const openCount = await SiteInspection.count({
              where: {
                assignedToId: mgr.id,
                status: { [Op.in]: openStatuses },
              },
            });
            return { id: mgr.id, openCount };
          })
        );

        managersWithCounts.sort((a, b) => a.openCount - b.openCount);
        assignedManagerId = managersWithCounts[0]?.id || null;
      }

      if (assignedManagerId) {
        await inspection.update({ assignedToId: assignedManagerId });
        try {
          const { createNotification } = require("./notificationService");
          await createNotification(
            assignedManagerId,
            "site_inspection",
            "New Site Inspection Assigned",
            `Site Inspection ${inspectionNumber} has been assigned to you.`,
            `/site-inspections/${inspection.id}`
          );
        } catch (notifErr) {
          console.warn("[requestSiteInspection] Notification warning:", notifErr);
        }
      }
    } catch (legacyErr) {
      console.error("[requestSiteInspection] Legacy assignment error:", legacyErr);
    }
  }

  return SiteInspection.findByPk(inspection.id, {
    include: [
      { model: SiteInspectionService, as: "services" },
      { model: SiteBase, as: "base" },
      { model: User, as: "assignedTo" },
    ],
  });
}

/**
 * Ensures a contacted lead has an inspection requested.
 * Called from leadStageAutomationService inside the CONTACTED branch.
 */
export async function ensureInspectionRequestedForContactedLead(leadId: string): Promise<void> {
  if (process.env.SITE_INSPECTION_GATE === "off") return;
  const lead: any = await Lead.findByPk(leadId);
  if (!lead) return;

  if (!lead.siteInspectionStatus || lead.siteInspectionStatus === "NOT_REQUESTED" || !lead.siteInspectionId) {
    await requestSiteInspection(leadId, lead.assignedToId);
  }
}

/**
 * Saves draft inspection data.
 * Validates coordinate ranges, positive km, facility match.
 * Recomputes metrics and straight-line base->site km.
 */
export async function saveInspectionDraft(
  inspectionId: string,
  data: any,
  userId?: string
): Promise<any> {
  const inspection: any = await SiteInspection.findByPk(inspectionId, {
    include: [{ model: SiteInspectionService, as: "services" }],
  });
  if (!inspection) throw new Error("Site inspection not found");

  if (!["REQUESTED", "DRAFT", "CHANGES_REQUESTED"].includes(inspection.status)) {
    throw new Error(`Cannot edit inspection in status ${inspection.status}`);
  }

  // Validate coordinates
  if (data.latitude !== undefined && data.latitude !== null && data.latitude !== "") {
    const lat = Number(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error("Latitude must be a valid number between -90 and 90");
    }
  }
  if (data.longitude !== undefined && data.longitude !== null && data.longitude !== "") {
    const lng = Number(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error("Longitude must be a valid number between -180 and 180");
    }
  }

  // Validate non-negative km
  if (data.mobilizationKm !== undefined && data.mobilizationKm !== null) {
    const mob = Number(data.mobilizationKm);
    if (isNaN(mob) || mob < 0) {
      throw new Error("Mobilization km must be non-negative");
    }
  }

  // Lookup Base if provided
  let baseObj: any = null;
  if (data.baseId) {
    baseObj = await SiteBase.findByPk(data.baseId);
    if (baseObj) {
      data.baseName = baseObj.name;
    }
  }

  // Calculate straight-line distance if base and site lat/lng available
  const siteLat = data.latitude !== undefined ? Number(data.latitude) : inspection.latitude;
  const siteLng = data.longitude !== undefined ? Number(data.longitude) : inspection.longitude;
  const baseLat = baseObj ? baseObj.latitude : null;
  const baseLng = baseObj ? baseObj.longitude : null;

  if (baseLat != null && baseLng != null && siteLat != null && siteLng != null) {
    data.baseToSiteStraightKm = haversineKm(baseLat, baseLng, siteLat, siteLng);
  }

  // Update Services if provided
  let currentServices = inspection.services || [];
  if (Array.isArray(data.services)) {
    for (const svcData of data.services) {
      if (svcData.distanceKm !== undefined && svcData.distanceKm !== null) {
        const d = Number(svcData.distanceKm);
        if (isNaN(d) || d < 0) {
          throw new Error("Service distance km must be non-negative");
        }
      }
      if (svcData.roadCondition && !["Good", "Fair", "Poor"].includes(svcData.roadCondition)) {
        throw new Error("Road condition must be Good, Fair, or Poor");
      }

      // Verify facility matches serviceType
      if (svcData.facilityId) {
        const facility: any = await SiteFacility.findByPk(svcData.facilityId);
        if (facility) {
          svcData.facilityName = facility.name;
          if (svcData.serviceType && facility.serviceType !== svcData.serviceType) {
            throw new Error(`Facility ${facility.name} does not match service type ${svcData.serviceType}`);
          }
        }
      }

      if (svcData.id) {
        const existingSvc = currentServices.find((s: any) => s.id === svcData.id);
        if (existingSvc) {
          await existingSvc.update(svcData);
        }
      } else if (svcData.serviceType) {
        const existingByType = currentServices.find((s: any) => s.serviceType === svcData.serviceType);
        if (existingByType) {
          await existingByType.update(svcData);
        } else {
          await SiteInspectionService.create({
            ...svcData,
            id: crypto.randomUUID(),
            inspectionId: inspection.id,
          });
        }
      }
    }
    // Reload updated services
    currentServices = await SiteInspectionService.findAll({ where: { inspectionId: inspection.id } });
  }

  // Recompute cycle metrics
  const mobKm = data.mobilizationKm !== undefined ? Number(data.mobilizationKm) : inspection.mobilizationKm;
  const metrics = computeMetrics(mobKm, currentServices);
  data.totalCycleKm = metrics.totalCycleKm;
  data.estFuelLitres = metrics.estFuelLitres;

  // Transition REQUESTED -> DRAFT
  if (inspection.status === "REQUESTED") {
    data.status = "DRAFT";
  }

  // Update inspection fields
  const allowedFields = [
    "status", "baseId", "baseName", "siteName", "siteAddress", "latitude", "longitude",
    "auditAt", "rfqNumber", "scopeSummary", "clientOrganization", "clientRepName",
    "clientRepPhone", "mobilizationRoute", "mobilizationKm", "speedLimitKmh",
    "baseToSiteStraightKm", "totalCycleKm", "estFuelLitres", "observations", "accepted",
  ];

  const updatePayload: any = {};
  for (const f of allowedFields) {
    if (data[f] !== undefined) updatePayload[f] = data[f];
  }

  await inspection.update(updatePayload);

  // Sync lead status if changed
  if (data.status && data.status !== inspection.status) {
    await Lead.update(
      { siteInspectionStatus: data.status },
      { where: { id: inspection.leadId } }
    );
  } else if (inspection.status === "REQUESTED" && data.status === "DRAFT") {
    await Lead.update(
      { siteInspectionStatus: "DRAFT" },
      { where: { id: inspection.leadId } }
    );
  }

  return SiteInspection.findByPk(inspection.id, {
    include: [
      { model: SiteInspectionService, as: "services" },
      { model: SiteInspectionAttachment, as: "attachments" },
      { model: SiteBase, as: "base" },
      { model: User, as: "assignedTo" },
    ],
  });
}

/**
 * Validates that an inspection satisfies all requirements to be submitted.
 */
export async function validateForSubmit(
  inspectionId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const inspection: any = await SiteInspection.findByPk(inspectionId, {
    include: [
      { model: SiteInspectionService, as: "services" },
      { model: SiteInspectionAttachment, as: "attachments" },
    ],
  });

  if (!inspection) return { valid: false, errors: ["Site inspection not found"] };

  const errors: string[] = [];

  if (!inspection.baseId && !inspection.baseName) {
    errors.push("Operations base is required.");
  }
  if (inspection.latitude == null || inspection.longitude == null) {
    errors.push("Valid GPS coordinates (latitude and longitude) are required.");
  }
  if (!inspection.auditAt) {
    errors.push("Audit date and time is required.");
  }
  if (!inspection.clientOrganization || !inspection.clientOrganization.trim()) {
    errors.push("Client organisation name is required.");
  }
  if (!inspection.clientRepName || !inspection.clientRepName.trim()) {
    errors.push("Client representative name is required.");
  }
  if (!inspection.mobilizationKm || Number(inspection.mobilizationKm) <= 0) {
    errors.push("Mobilization one-way distance must be greater than 0 km.");
  }

  const activeServices = (inspection.services || []).filter((s: any) => s.isActive);
  if (activeServices.length === 0) {
    errors.push("At least one active waste service scope (Sewage, General, or Hazardous) must be selected.");
  } else {
    for (const svc of activeServices) {
      if (!svc.facilityId && !svc.facilityName) {
        errors.push(`Disposal facility is required for active ${svc.serviceType} service.`);
      }
      if (!svc.distanceKm || Number(svc.distanceKm) <= 0) {
        errors.push(`Haulage distance must be greater than 0 km for ${svc.serviceType} service.`);
      }
      if (!svc.roadCondition) {
        errors.push(`Road condition rating is required for ${svc.serviceType} service.`);
      }
    }
  }

  const attachments = inspection.attachments || [];
  if (attachments.length === 0) {
    errors.push("At least one site photo or supporting document attachment is required.");
  }

  if (!inspection.accepted) {
    errors.push("You must confirm and accept that site assessment details are accurate.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Submits an inspection for supervisor/ops review.
 */
export async function submitInspection(
  inspectionId: string,
  submitData?: any,
  userId?: string
): Promise<any> {
  if (submitData) {
    await saveInspectionDraft(inspectionId, submitData, userId);
  }

  const completeness = await validateForSubmit(inspectionId);
  if (!completeness.valid) {
    throw new Error(`Cannot submit inspection: ${completeness.errors.join(" ")}`);
  }

  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  await inspection.update({
    status: "SUBMITTED",
    submittedAt: new Date(),
    accepted: true,
  });

  // Sync lead status
  await Lead.update(
    { siteInspectionStatus: "SUBMITTED" },
    { where: { id: inspection.leadId } }
  );

  // Notify approvers
  try {
    const approvers = await User.findAll({
      where: { role: { [Op.in]: APPROVER_ROLES } },
    });
    for (const approver of approvers) {
      await createNotification(
        (approver as any).id,
        "site_inspection",
        "Site Inspection Submitted",
        `Site Inspection ${inspection.inspectionNumber} has been submitted and awaits your review.`,
        `/site-inspections/${inspection.id}`
      );
    }
  } catch (err) {
    console.warn("[submitInspection] Approver notification warn:", err);
  }

  return SiteInspection.findByPk(inspection.id, {
    include: [
      { model: SiteInspectionService, as: "services" },
      { model: SiteInspectionAttachment, as: "attachments" },
      { model: SiteBase, as: "base" },
      { model: User, as: "assignedTo" },
    ],
  });
}

/**
 * Reviews an inspection (APPROVE or REQUEST_CHANGES).
 * Nobody may approve their own inspection.
 */
export async function reviewInspection(
  inspectionId: string,
  action: "APPROVE" | "REQUEST_CHANGES",
  reviewerId: string,
  reviewerRole: string,
  comment?: string
): Promise<any> {
  if (!APPROVER_ROLES.includes(reviewerRole)) {
    throw new Error("Only supervisors, operations managers, and administrators may review site inspections.");
  }

  const inspection: any = await SiteInspection.findByPk(inspectionId);
  if (!inspection) throw new Error("Site inspection not found");

  if (inspection.status !== "SUBMITTED") {
    throw new Error(`Cannot review inspection in status ${inspection.status}. Must be SUBMITTED.`);
  }

  if (inspection.assignedToId && inspection.assignedToId === reviewerId) {
    throw new Error("Self-approval is forbidden: Nobody may approve their own site inspection.");
  }

  const lead: any = await Lead.findByPk(inspection.leadId);

  if (action === "REQUEST_CHANGES") {
    if (!comment || !comment.trim()) {
      throw new Error("A review comment explaining the requested changes is required.");
    }

    await inspection.update({
      status: "CHANGES_REQUESTED",
      revision: (inspection.revision || 1) + 1,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: comment.trim(),
    });

    if (lead) {
      await lead.update({ siteInspectionStatus: "CHANGES_REQUESTED" });
    }

    // Notify assigned site manager
    if (inspection.assignedToId) {
      try {
        await createNotification(
          inspection.assignedToId,
          "site_inspection",
          "Changes Requested on Site Inspection",
          `Changes requested for ${inspection.inspectionNumber}: ${comment.trim()}`,
          `/site-inspections/${inspection.id}`
        );
      } catch (notifErr) {
        console.warn("[reviewInspection] Notification warn:", notifErr);
      }
    }
  } else if (action === "APPROVE") {
    await inspection.update({
      status: "APPROVED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: comment ? comment.trim() : null,
    });

    if (lead) {
      await lead.update({ siteInspectionStatus: "APPROVED" });

      // Notify lead owner
      if (lead.assignedToId) {
        try {
          await createNotification(
            lead.assignedToId,
            "site_inspection",
            "Site Inspection Approved",
            `Site Inspection for lead ${lead.company || lead.firstName} has been approved.`,
            `/leads/${lead.id}`
          );
        } catch (notifErr) {
          console.warn("[reviewInspection] Notification warn:", notifErr);
        }
      }

      // Attempt auto-advancing lead now that gate is satisfied
      try {
        const { checkAndAutoAdvanceLead } = require("./leadStageAutomationService");
        await checkAndAutoAdvanceLead(lead.id, { userId: reviewerId });
      } catch (autoErr) {
        console.warn("[reviewInspection] Auto-advance error:", autoErr);
      }
    }
  } else {
    throw new Error(`Invalid review action: ${action}`);
  }

  return SiteInspection.findByPk(inspection.id, {
    include: [
      { model: SiteInspectionService, as: "services" },
      { model: SiteInspectionAttachment, as: "attachments" },
      { model: SiteBase, as: "base" },
      { model: User, as: "assignedTo" },
      { model: User, as: "reviewedBy" },
    ],
  });
}

/**
 * Reassigns an inspection to a new site manager.
 */
export async function reassignInspection(
  inspectionId: string,
  newAssigneeId: string,
  callerRole: string,
  reason?: string,
  actorId?: string,
  ip?: string
): Promise<any> {
  if (!APPROVER_ROLES.includes(callerRole)) {
    throw new Error("Only managers or approvers may reassign site inspections.");
  }

  const { isPhase2SchemaReady } = require("@nexus-crm/database");
  if (!isPhase2SchemaReady) {
    const inspection: any = await SiteInspection.findByPk(inspectionId);
    if (!inspection) throw new Error("Site inspection not found");

    const newAssignee: any = await User.findByPk(newAssigneeId);
    if (!newAssignee) throw new Error("New assignee user not found");

    await inspection.update({ assignedToId: newAssigneeId });

    try {
      await createNotification(
        newAssigneeId,
        "site_inspection",
        "Site Inspection Assigned",
        `Site Inspection ${inspection.inspectionNumber} has been reassigned to you.`,
        `/site-inspections/${inspection.id}`
      );
    } catch (err) {
      console.warn("[reassignInspection] Notification warn:", err);
    }

    return inspection;
  }

  const { manualReassignInspection } = require("./siteInspectionAssignmentService");
  return manualReassignInspection(
    inspectionId,
    newAssigneeId,
    reason || "Reassigned by manager",
    actorId || "system",
    callerRole,
    ip
  );
}
