"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "sqlite") {
      const tableInfo = await queryInterface.describeTable("PurchaseOrders");
      if (!tableInfo.type) {
        await queryInterface.addColumn("PurchaseOrders", "type", {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "customer_po"
        });
      }
      return;
    }

    await queryInterface.sequelize.transaction(async (t) => {
      // Step 1: Create ENUM type (idempotent)
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

      // Step 2: Add column if not already present
      // DEFAULT 'customer_po' automatically backfills all 37 existing rows — no separate UPDATE needed
      const tableInfo = await queryInterface.describeTable("PurchaseOrders");
      if (!tableInfo.type) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "PurchaseOrders" ADD COLUMN type enum_PurchaseOrders_type NOT NULL DEFAULT 'customer_po'`,
          { transaction: t }
        );
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
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "sqlite") {
      await queryInterface.removeColumn("PurchaseOrders", "type");
      return;
    }

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
