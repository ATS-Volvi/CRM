module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      // Idempotent add column
      const tableInfo = await queryInterface.describeTable('Users');
      if (!tableInfo.dealValueCutoff) {
        await queryInterface.addColumn('Users', 'dealValueCutoff', {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: true
        }, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn('Users', 'dealValueCutoff', { transaction: t });
    });
  }
};
