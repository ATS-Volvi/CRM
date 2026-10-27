"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";
      if (tables.includes("DealOwners") && tables.includes("DealSplits")) {
        if (isSqlite) {
          const [owners] = await queryInterface.sequelize.query(
            `SELECT "dealId", "userId", "splitPct", "createdAt", "updatedAt" FROM "DealOwners" o
             WHERE NOT EXISTS (SELECT 1 FROM "DealSplits" s WHERE s."dealId" = o."dealId" AND s."userId" = o."userId")`,
            { transaction: t }
          );
          const crypto = require("crypto");
          for (const o of owners) {
            await queryInterface.sequelize.query(
              `INSERT INTO "DealSplits" (id, "dealId", "userId", "splitPercentage", "configuredByUserId", "isCrossTeam", "createdAt", "updatedAt")
               VALUES ('` + crypto.randomUUID() + `', '` + o.dealId + `', '` + o.userId + `', ` + o.splitPct + `, NULL, 0, '` + o.createdAt + `', '` + o.updatedAt + `')`,
              { transaction: t }
            );
          }
        } else {
          await queryInterface.sequelize.query(
            `
            INSERT INTO public."DealSplits" (
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
            FROM public."DealOwners" o
            WHERE NOT EXISTS (
              SELECT 1 FROM public."DealSplits" s
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
