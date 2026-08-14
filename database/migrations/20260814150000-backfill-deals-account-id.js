module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure accountId is UUID just in case (though it should already be from the previous schema)
    await queryInterface.sequelize.query(`
      ALTER TABLE "Deals" 
      ALTER COLUMN "accountId" TYPE UUID USING "accountId"::UUID;
    `);

    // Backfill accountId with customerId for all existing demo data
    await queryInterface.sequelize.query(`
      UPDATE "Deals" 
      SET "accountId" = "customerId" 
      WHERE "accountId" IS DISTINCT FROM "customerId";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse backfill is not safe/necessary
  }
};
