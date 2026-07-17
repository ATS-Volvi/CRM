'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add columns to Users table
    try {
      await queryInterface.addColumn('Users', 'department', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {
      console.log('Column department already exists');
    }
    try {
      await queryInterface.addColumn('Users', 'territory', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {
      console.log('Column territory already exists');
    }
    try {
      await queryInterface.addColumn('Users', 'team', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {
      console.log('Column team already exists');
    }

    // 2. Create KpiTargets table
    await queryInterface.createTable('KpiTargets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      salespersonId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      kpiName: { type: Sequelize.STRING, allowNull: false },
      targetValue: { type: Sequelize.FLOAT, defaultValue: 0 },
      currentValue: { type: Sequelize.FLOAT, defaultValue: 0 },
      frequency: { type: Sequelize.STRING, defaultValue: 'monthly' },
      weightage: { type: Sequelize.INTEGER, defaultValue: 10 },
      effectiveDate: { type: Sequelize.DATE, allowNull: true },
      expiryDate: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: { type: Sequelize.STRING, defaultValue: 'Active' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 3. Create KpiTargetHistories table
    await queryInterface.createTable('KpiTargetHistories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      kpiTargetId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'KpiTargets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      oldValue: { type: Sequelize.FLOAT, defaultValue: 0 },
      newValue: { type: Sequelize.FLOAT, defaultValue: 0 },
      changedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      changeDate: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      reason: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('KpiTargetHistories');
    await queryInterface.dropTable('KpiTargets');
    await queryInterface.removeColumn('Users', 'team');
    await queryInterface.removeColumn('Users', 'territory');
    await queryInterface.removeColumn('Users', 'department');
  }
};
