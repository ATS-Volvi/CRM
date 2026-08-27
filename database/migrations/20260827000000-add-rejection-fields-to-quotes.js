'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Quotes');
    if (!tableInfo.rejectionReason) {
      await queryInterface.addColumn('Quotes', 'rejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null
      });
    }
    if (!tableInfo.rejectedByUserId) {
      await queryInterface.addColumn('Quotes', 'rejectedByUserId', {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null
      });
    }
    if (!tableInfo.rejectedAt) {
      await queryInterface.addColumn('Quotes', 'rejectedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Quotes');
    if (tableInfo.rejectionReason) {
      await queryInterface.removeColumn('Quotes', 'rejectionReason');
    }
    if (tableInfo.rejectedByUserId) {
      await queryInterface.removeColumn('Quotes', 'rejectedByUserId');
    }
    if (tableInfo.rejectedAt) {
      await queryInterface.removeColumn('Quotes', 'rejectedAt');
    }
  }
};
