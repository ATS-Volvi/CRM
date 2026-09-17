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

    // 1. ServiceResources Table
    await createTableSafe('ServiceResources', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      resourceType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Technician',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
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

    // 2. WorkOrders Table
    await createTableSafe('WorkOrders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      workOrderNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'New',
      },
      priority: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Medium',
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      accountId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      contactId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      dealId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Deals', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      assetId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Assets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      supportTicketId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'SupportTickets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      duration: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      durationInHours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      totalPrice: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      tax: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      grandTotal: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      street: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      postalCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(9, 6),
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

    // 3. WorkOrderLineItems Table
    await createTableSafe('WorkOrderLineItems', {
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
      lineItemNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'New',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      assetId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Assets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      priceBookEntryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'PriceBookEntries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 1,
      },
      unitPrice: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      totalPrice: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      duration: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      durationInHours: {
        type: Sequelize.DECIMAL(10, 2),
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

    // 4. ServiceAppointments Table
    await createTableSafe('ServiceAppointments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      appointmentNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      parentRecordId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      workOrderId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'WorkOrders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      workOrderLineItemId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'WorkOrderLineItems', key: 'id' },
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
      contactId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      accountId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'New',
      },
      earliestStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      dueDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      scheduledStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      scheduledEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualStartTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualEndTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualDuration: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      duration: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      durationInHours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      street: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      postalCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(9, 6),
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

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ServiceAppointments').catch(() => {});
    await queryInterface.dropTable('WorkOrderLineItems').catch(() => {});
    await queryInterface.dropTable('WorkOrders').catch(() => {});
    await queryInterface.dropTable('ServiceResources').catch(() => {});
  }
};
