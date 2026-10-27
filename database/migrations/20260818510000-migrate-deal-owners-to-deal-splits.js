"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      if (tables.includes("DealOwners") && tables.includes("DealSplits")) {
        // Idempotently copy existing DealOwner rows into DealSplits
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
    });
  },

  async down(queryInterface, Sequelize) {
    // Non-destructive down: keep DealSplits intact
  }
};
