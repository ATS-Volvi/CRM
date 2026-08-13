'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('Users');

    if (!tableDesc.skills) {
      await queryInterface.addColumn('Users', 'skills', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableDesc.status) {
      await queryInterface.addColumn('Users', 'status', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'Available',
      });
    }

    if (!tableDesc.weight) {
      await queryInterface.addColumn('Users', 'weight', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 100,
      });
    }

    if (!tableDesc.lastAssignedAt) {
      await queryInterface.addColumn('Users', 'lastAssignedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!tableDesc.dedicatedEmail) {
      await queryInterface.addColumn('Users', 'dedicatedEmail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableDesc.dedicatedPhone) {
      await queryInterface.addColumn('Users', 'dedicatedPhone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    // No-op for safe column additions
  },
};
