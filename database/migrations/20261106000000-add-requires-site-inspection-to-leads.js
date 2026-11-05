"use strict";
const { DataTypes } = require("sequelize");
module.exports = {
  async up(queryInterface) {
    const tableDesc = await queryInterface.describeTable("Leads");
    // 1. Add the column if not already present
    if (!tableDesc.requiresSiteInspection) {
      await queryInterface.addColumn("Leads", "requiresSiteInspection", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    // 2. Backfill: any lead that already has a siteInspectionStatus
    //    (meaning an inspection was ever requested) should be flagged true
    await queryInterface.sequelize.query(`
      UPDATE "Leads"
      SET "requiresSiteInspection" = true
      WHERE "siteInspectionStatus" IS NOT NULL
        AND "siteInspectionStatus" != 'NOT_REQUESTED'
    `);
  },
  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable("Leads");
    if (tableDesc.requiresSiteInspection) {
      await queryInterface.removeColumn("Leads", "requiresSiteInspection");
    }
  },
};

