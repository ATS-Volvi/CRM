"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add nullable kpiMasterId column to KpiTargets
    const tableInfo = await queryInterface.describeTable("KpiTargets");
    if (!tableInfo.kpiMasterId) {
      await queryInterface.addColumn("KpiTargets", "kpiMasterId", {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "KpiMasters",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    // 2. Backfill existing rows by matching KpiTarget.kpiName === KpiMaster.name where unambiguous
    // (Unambiguous: names that appear exactly once in KpiMasters)
    const [unambiguousMasters] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM "KpiMasters"
      WHERE name IN (
        SELECT name FROM "KpiMasters" GROUP BY name HAVING COUNT(*) = 1
      )
    `);

    for (const master of unambiguousMasters) {
      await queryInterface.sequelize.query(
        `UPDATE "KpiTargets"
         SET "kpiMasterId" = :masterId
         WHERE "kpiName" = :kpiName AND "kpiMasterId" IS NULL`,
        {
          replacements: { masterId: master.id, kpiName: master.name },
        }
      );
    }
  },

  async down(queryInterface, _Sequelize) {
    const tableInfo = await queryInterface.describeTable("KpiTargets");
    if (tableInfo.kpiMasterId) {
      await queryInterface.removeColumn("KpiTargets", "kpiMasterId");
    }
  },
};
