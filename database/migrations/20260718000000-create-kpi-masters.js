'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('KpiMasters', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      category: { type: Sequelize.STRING, allowNull: false },
      targetValue: { type: Sequelize.FLOAT, defaultValue: 0 },
      frequency: { type: Sequelize.STRING, defaultValue: 'monthly' },
      weightage: { type: Sequelize.INTEGER, defaultValue: 10 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('KpiMasters');
  }
};
