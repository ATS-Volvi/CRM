"use strict";

/**
 * Site Inspection Phase 2 — Stage A (assignment engine and settings).
 *
 * Strictly additive and idempotent:
 *  - creates SiteInspectorProfiles, SiteInspectionSettings, SiteHolidays, SiteInspectionAuditLogs
 *  - adds NULLABLE columns to SiteInspections (no database defaults, so existing rows are untouched)
 *  - adds indexes
 * Works on Postgres and SQLite. Re-running is a no-op.
 *
 * down() removes only what this migration adds. Production rollback is done by
 * switching the feature settings off, NOT by running db:migrate:undo.
 */

const NEW_INSPECTION_COLUMNS = {
  siteAreaName: { type: "STRING" },
  siteLatitudeHint: { type: "FLOAT" },
  siteLongitudeHint: { type: "FLOAT" },
  siteLocationSource: { type: "STRING" }, // PIN | AREA_NAME | LEAD_FIELDS | NONE
  priority: { type: "STRING" }, // URGENT | NORMAL | LOW (null is treated as NORMAL)
  priorityReason: { type: "TEXT" },
  requiredCertifications: { type: "TEXT" }, // JSON array, e.g. ["HAZARDOUS"]
  assignmentMode: { type: "STRING" }, // legacy | nearest | balanced | manual
  assignmentState: { type: "STRING" }, // ASSIGNED | UNASSIGNED | NEEDS_AREA | PENDING_CONFIRMATION
  assignmentReason: { type: "TEXT" },
  assignedAt: { type: "DATE" },
  requestedInspectorId: { type: "UUID" },
  requestedInspectorReason: { type: "TEXT" },
  acceptedAt: { type: "DATE" },
  declinedAt: { type: "DATE" },
  declineReason: { type: "TEXT" },
  scheduledVisitAt: { type: "DATE" },
  startedAt: { type: "DATE" },
  slaAcceptDueAt: { type: "DATE" },
  slaScheduleDueAt: { type: "DATE" },
  slaSubmitDueAt: { type: "DATE" },
  slaReviewDueAt: { type: "DATE" },
};

const NEW_INDEXES = [
  { fields: ["status", "assignedToId"], name: "site_inspections_status_assigned_to_id" },
  { fields: ["assignedToId", "dueAt"], name: "site_inspections_assigned_to_id_due_at" },
  { fields: ["assignmentState"], name: "site_inspections_assignment_state" },
  { fields: ["scheduledVisitAt"], name: "site_inspections_scheduled_visit_at" },
  { fields: ["slaAcceptDueAt"], name: "site_inspections_sla_accept_due_at" },
  { fields: ["slaSubmitDueAt"], name: "site_inspections_sla_submit_due_at" },
  { fields: ["slaReviewDueAt"], name: "site_inspections_sla_review_due_at" },
];

async function indexExists(queryInterface, table, name) {
  try {
    const indexes = await queryInterface.showIndex(table);
    return indexes.some((i) => i.name === name);
  } catch (e) {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === "string" ? t : t.tableName));

    // 1. SiteInspectorProfiles
    if (!tableNames.includes("SiteInspectorProfiles")) {
      await queryInterface.createTable("SiteInspectorProfiles", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false, unique: true },
        homeBaseId: { type: Sequelize.UUID, allowNull: true },
        coverageBaseIds: { type: Sequelize.TEXT, allowNull: true }, // JSON array of SiteBase ids
        isAvailable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        onLeaveFrom: { type: Sequelize.DATE, allowNull: true },
        onLeaveTo: { type: Sequelize.DATE, allowNull: true },
        maxOpenInspections: { type: Sequelize.INTEGER, allowNull: true }, // null = use global setting
        maxVisitsPerDay: { type: Sequelize.INTEGER, allowNull: true },
        maxDistanceKm: { type: Sequelize.FLOAT, allowNull: true },
        certifications: { type: Sequelize.TEXT, allowNull: true }, // JSON array: HAZARDOUS, SEWAGE, GENERAL
        languages: { type: Sequelize.TEXT, allowNull: true }, // JSON array
        lastAssignedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 2. SiteInspectionSettings (key/value JSON)
    if (!tableNames.includes("SiteInspectionSettings")) {
      await queryInterface.createTable("SiteInspectionSettings", {
        key: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
        value: { type: Sequelize.TEXT, allowNull: true }, // JSON-encoded
        updatedBy: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 3. SiteHolidays
    if (!tableNames.includes("SiteHolidays")) {
      await queryInterface.createTable("SiteHolidays", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      if (!(await indexExists(queryInterface, "SiteHolidays", "site_holidays_date"))) {
        await queryInterface.addIndex("SiteHolidays", ["date"], { name: "site_holidays_date" });
      }
    }

    // 4. SiteInspectionAuditLogs (append-only; no updatedAt)
    if (!tableNames.includes("SiteInspectionAuditLogs")) {
      await queryInterface.createTable("SiteInspectionAuditLogs", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        inspectionId: { type: Sequelize.UUID, allowNull: true },
        entityType: { type: Sequelize.STRING, allowNull: false }, // INSPECTION | SETTING | PROFILE | HOLIDAY | ATTACHMENT | EXPORT
        entityId: { type: Sequelize.STRING, allowNull: true },
        action: { type: Sequelize.STRING, allowNull: false },
        actorId: { type: Sequelize.UUID, allowNull: true }, // null = system
        actorRole: { type: Sequelize.STRING, allowNull: true },
        fromValue: { type: Sequelize.TEXT, allowNull: true },
        toValue: { type: Sequelize.TEXT, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        ip: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      for (const [fields, name] of [
        [["inspectionId", "createdAt"], "site_inspection_audit_logs_inspection_id_created_at"],
        [["entityType", "createdAt"], "site_inspection_audit_logs_entity_type_created_at"],
        [["actorId"], "site_inspection_audit_logs_actor_id"],
      ]) {
        if (!(await indexExists(queryInterface, "SiteInspectionAuditLogs", name))) {
          await queryInterface.addIndex("SiteInspectionAuditLogs", fields, { name });
        }
      }
    }

    // 5. Nullable columns on SiteInspections (no DB defaults => existing rows unchanged)
    if (tableNames.includes("SiteInspections")) {
      const desc = await queryInterface.describeTable("SiteInspections");
      for (const [column, spec] of Object.entries(NEW_INSPECTION_COLUMNS)) {
        if (!desc[column]) {
          await queryInterface.addColumn("SiteInspections", column, {
            type: Sequelize[spec.type],
            allowNull: true,
          });
        }
      }

      // 6. Indexes ((leadId) already exists from 20261025000000)
      for (const idx of NEW_INDEXES) {
        if (!(await indexExists(queryInterface, "SiteInspections", idx.name))) {
          await queryInterface.addIndex("SiteInspections", idx.fields, { name: idx.name });
        }
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === "string" ? t : t.tableName));

    if (tableNames.includes("SiteInspections")) {
      for (const idx of NEW_INDEXES) {
        if (await indexExists(queryInterface, "SiteInspections", idx.name)) {
          await queryInterface.removeIndex("SiteInspections", idx.name);
        }
      }
      const desc = await queryInterface.describeTable("SiteInspections");
      for (const column of Object.keys(NEW_INSPECTION_COLUMNS)) {
        if (desc[column]) {
          await queryInterface.removeColumn("SiteInspections", column);
        }
      }
    }

    for (const table of ["SiteInspectionAuditLogs", "SiteHolidays", "SiteInspectionSettings", "SiteInspectorProfiles"]) {
      if (tableNames.includes(table)) {
        await queryInterface.dropTable(table);
      }
    }
  },
};
