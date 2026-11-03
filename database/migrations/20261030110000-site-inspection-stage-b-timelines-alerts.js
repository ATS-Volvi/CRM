"use strict";

/**
 * Site Inspection Phase 2 — Stage B (Timelines, SLA Clocks, Alerts and Escalation).
 *
 * Strictly additive and idempotent:
 *  - creates SiteInspectionAlerts table (deduplicated notification tracking)
 *  - creates SiteInspectionAutomationRuns table (scanner heartbeat & reliability)
 *  - adds Stage B nullable columns to SiteInspections:
 *      waitingOnClientReason, waitingOnClientExpectedAt, slaPausedAt,
 *      slaTotalPausedMinutes, moreTimeReason, moreTimeRequestedHours,
 *      moreTimeStatus, moreTimeApprovedById, moreTimeApprovedAt,
 *      escalatedToOpsAt, escalatedToDirectorAt
 * Works on Postgres and SQLite. Re-running is a no-op.
 *
 * Rollback: Production rollback is performed by switching settings off.
 * down() removes strictly what up() added.
 */

const STAGE_B_COLUMNS = {
  waitingOnClientReason: { type: "TEXT" },
  waitingOnClientExpectedAt: { type: "DATE" },
  slaPausedAt: { type: "DATE" },
  slaTotalPausedMinutes: { type: "INTEGER" },
  moreTimeReason: { type: "TEXT" },
  moreTimeRequestedHours: { type: "INTEGER" },
  moreTimeStatus: { type: "STRING" }, // PENDING | APPROVED | REJECTED
  moreTimeApprovedById: { type: "UUID" },
  moreTimeApprovedAt: { type: "DATE" },
  escalatedToOpsAt: { type: "DATE" },
  escalatedToDirectorAt: { type: "DATE" },
};

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

    // 1. SiteInspectionAlerts
    if (!tableNames.includes("SiteInspectionAlerts")) {
      await queryInterface.createTable("SiteInspectionAlerts", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        dedupeKey: { type: Sequelize.STRING, allowNull: false, unique: true },
        inspectionId: { type: Sequelize.UUID, allowNull: true },
        alertType: { type: Sequelize.STRING, allowNull: false },
        recipientId: { type: Sequelize.UUID, allowNull: false },
        recipientRole: { type: Sequelize.STRING, allowNull: true },
        channel: { type: Sequelize.STRING, allowNull: false, defaultValue: "IN_APP" },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: "SENT" },
        sentAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        scheduledFor: { type: Sequelize.DATE, allowNull: true },
        payload: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 2. SiteInspectionAutomationRuns
    if (!tableNames.includes("SiteInspectionAutomationRuns")) {
      await queryInterface.createTable("SiteInspectionAutomationRuns", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        startedAt: { type: Sequelize.DATE, allowNull: false },
        completedAt: { type: Sequelize.DATE, allowNull: true },
        alertsScanned: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        alertsTriggered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        escalationsTriggered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: "SUCCESS" },
        errorDetails: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 3. Add Stage B columns to SiteInspections
    let existingCols = {};
    try {
      existingCols = await queryInterface.describeTable("SiteInspections");
    } catch (e) {
      existingCols = {};
    }

    for (const [colName, colDef] of Object.entries(STAGE_B_COLUMNS)) {
      if (!existingCols[colName]) {
        const type = Sequelize[colDef.type] || Sequelize.STRING;
        await queryInterface.addColumn("SiteInspections", colName, {
          type,
          allowNull: true,
        });
      }
    }

    // 4. Indexes
    const alertIndexes = [
      { fields: ["dedupeKey"], name: "site_inspection_alerts_dedupe_key" },
      { fields: ["inspectionId"], name: "site_inspection_alerts_inspection_id" },
      { fields: ["recipientId"], name: "site_inspection_alerts_recipient_id" },
      { fields: ["alertType"], name: "site_inspection_alerts_alert_type" },
      { fields: ["scheduledFor"], name: "site_inspection_alerts_scheduled_for" },
    ];

    for (const idx of alertIndexes) {
      if (!(await indexExists(queryInterface, "SiteInspectionAlerts", idx.name))) {
        try {
          await queryInterface.addIndex("SiteInspectionAlerts", idx.fields, { name: idx.name });
        } catch (e) {}
      }
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.dropTable("SiteInspectionAlerts");
    } catch (e) {}

    try {
      await queryInterface.dropTable("SiteInspectionAutomationRuns");
    } catch (e) {}

    for (const colName of Object.keys(STAGE_B_COLUMNS)) {
      try {
        await queryInterface.removeColumn("SiteInspections", colName);
      } catch (e) {}
    }
  },
};
