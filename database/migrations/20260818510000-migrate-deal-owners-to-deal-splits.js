"use strict";

const crypto = require("crypto");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();
      const tableNames = Array.isArray(tables)
        ? tables.map((tbl) => (typeof tbl === "object" ? tbl.tableName || tbl.name : tbl))
        : [];

      if (tableNames.includes("DealOwners") && tableNames.includes("DealSplits")) {
        if (dialect === "sqlite") {
          const [dealOwners] = await queryInterface.sequelize.query(
            `SELECT o."dealId", o."userId", o."splitPct", o."createdAt", o."updatedAt"
             FROM "DealOwners" o
             WHERE NOT EXISTS (
               SELECT 1 FROM "DealSplits" s
               WHERE s."dealId" = o."dealId" AND s."userId" = o."userId"
             )`,
            { transaction: t }
          );
          if (dealOwners && dealOwners.length > 0) {
            const now = new Date();
            const rows = dealOwners.map((o) => ({
              id: crypto.randomUUID(),
              dealId: o.dealId,
              userId: o.userId,
              splitPercentage: o.splitPct,
              configuredByUserId: null,
              isCrossTeam: 0,
              createdAt: o.createdAt || now,
              updatedAt: o.updatedAt || now
            }));
            await queryInterface.bulkInsert("DealSplits", rows, { transaction: t });
          }
        } else {
          // Idempotently copy existing DealOwner rows into DealSplits
          await queryInterface.sequelize.query(
            `
            INSERT INTO "DealSplits" (
              id,
              "dealId",
              "userId",
              "splitPercentage",
              "configuredByUserId",
              "isCrossTeam",
              "createdAt",
              "updatedAt"
            )
            SELECT
              gen_random_uuid(),
              "dealId",
              "userId",
              "splitPct",
              NULL AS "configuredByUserId",
              false AS "isCrossTeam",
              "createdAt",
              "updatedAt"
            FROM "DealOwners" o
            WHERE NOT EXISTS (
              SELECT 1 FROM "DealSplits" s
              WHERE s."dealId" = o."dealId" AND s."userId" = o."userId"
            );
            `,
            { transaction: t }
          );
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Non-destructive down: keep DealSplits intact
  }
};
