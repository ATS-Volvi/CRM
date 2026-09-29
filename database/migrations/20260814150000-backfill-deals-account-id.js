module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect !== 'sqlite') {
      // Postgres: ensure accountId column is typed as UUID.
      // This is a no-op if it is already UUID; safe to run on existing data.
      await queryInterface.sequelize.query(`
        ALTER TABLE "Deals"
        ALTER COLUMN "accountId" TYPE UUID USING "accountId"::UUID;
      `);
    }
    // SQLite: accountId is already stored as TEXT (UUID string). No type change needed.

    // Backfill accountId with customerId for all existing demo data.
    // "IS DISTINCT FROM" is Postgres-only; use a dialect-portable equivalent.
    if (dialect === 'sqlite') {
      await queryInterface.sequelize.query(`
        UPDATE "Deals"
        SET "accountId" = "customerId"
        WHERE "accountId" != "customerId" OR ("accountId" IS NULL AND "customerId" IS NOT NULL);
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE "Deals"
        SET "accountId" = "customerId"
        WHERE "accountId" IS DISTINCT FROM "customerId";
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse backfill is not safe/necessary
  }
};
