'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('Deals').catch(() => ({}));
    if (!tableDesc.lossReasonCategory) {
      await queryInterface.addColumn('Deals', 'lossReasonCategory', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Deals', 'lossReasonCategory').catch(() => {});
  }
};
