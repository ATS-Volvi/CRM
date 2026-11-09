'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const createTableSafe = async (tableName, attributes) => {
      const tables = await queryInterface.showAllTables();
      const tableNames = Array.isArray(tables) ? tables.map(t => (typeof t === 'object' ? t.tableName || t.name : t)) : [];
      if (!tableNames.includes(tableName)) {
        await queryInterface.createTable(tableName, attributes);
      }
    };

    // 1. WorkOrderNotifications Table
    await createTableSafe('WorkOrderNotifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      workOrderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'WorkOrders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      appointmentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ServiceAppointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      recipientEmail: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      recipientSource: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Pending',
      },
      skipReason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      dedupeKey: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastError: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      scheduledFor: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // 2. WorkOrderFeedback Table
    await createTableSafe('WorkOrderFeedback', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      workOrderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'WorkOrders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      appointmentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ServiceAppointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      serviceResourceId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ServiceResources', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tokenHash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      tokenVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      tokenExpiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      submittedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('WorkOrderFeedback');
    await queryInterface.dropTable('WorkOrderNotifications');
  },
};
