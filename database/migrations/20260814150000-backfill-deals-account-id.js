module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";
    if (!isSqlite) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Deals" 
        ALTER COLUMN "accountId" TYPE UUID USING "accountId"::UUID;
      `);
    }

    if (isSqlite) {
      await queryInterface.sequelize.query(`
        UPDATE "Deals" 
        SET "accountId" = "customerId" 
        WHERE "accountId" IS NOT "customerId";
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
