'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Users table additions
    await queryInterface.addColumn('Users', 'onLeave', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'delegatedUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 2. Leads table additions
    await queryInterface.addColumn('Leads', 'isStrategic', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });

    // 3. ApprovalRequests table additions
    await queryInterface.addColumn('ApprovalRequests', 'assignedApproverId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ApprovalRequests', 'assignedApproverId');
    await queryInterface.removeColumn('Leads', 'isStrategic');
    await queryInterface.removeColumn('Users', 'delegatedUserId');
    await queryInterface.removeColumn('Users', 'onLeave');
  }
};
