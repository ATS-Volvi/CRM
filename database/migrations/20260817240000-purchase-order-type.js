"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";
    await queryInterface.sequelize.transaction(async (t) => {
      if (!isSqlite) {
        await queryInterface.sequelize.query(
          `
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_PurchaseOrders_type') THEN
              CREATE TYPE enum_PurchaseOrders_type AS ENUM ('customer_po', 'supply_order');
            END IF;
          END
          $$;
          `,
          { transaction: t }
        );
      }

      const tableInfo = await queryInterface.describeTable("PurchaseOrders");
      if (!tableInfo.type) {
        if (isSqlite) {
          await queryInterface.addColumn("PurchaseOrders", "type", {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "customer_po"
          }, { transaction: t });
        } else {
          await queryInterface.sequelize.query(
            `ALTER TABLE "PurchaseOrders" ADD COLUMN type enum_PurchaseOrders_type NOT NULL DEFAULT 'customer_po'`,
            { transaction: t }
          );
        }
      }

      // Step 3: Verify backfill (read-only, informational — does not alter data)
      const [result] = await queryInterface.sequelize.query(
        `SELECT type, COUNT(*) FROM "PurchaseOrders" GROUP BY type`,
        { transaction: t }
      );
      console.log("[migration 20260817240000] PurchaseOrders.type counts after migration:", result);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE "PurchaseOrders" DROP COLUMN IF EXISTS type`,
        { transaction: t }
      );
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS enum_PurchaseOrders_type`,
        { transaction: t }
      );
    });
  }
};
