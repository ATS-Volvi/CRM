'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
    const quoteIdent = (name) => isSqlite ? `\`${name}\`` : `"${name}"`;

    const createTableSafe = async (tableName, attributes) => {
      const tables = await queryInterface.showAllTables();
      const tableNames = Array.isArray(tables) ? tables.map(t => (typeof t === 'object' ? t.tableName || t.name : t)) : [];
      if (!tableNames.includes(tableName)) {
        await queryInterface.createTable(tableName, attributes);
      }
    };

    const addColumnSafe = async (tableName, columnName, definition) => {
      const tableInfo = await queryInterface.describeTable(tableName).catch(() => ({}));
      if (!tableInfo[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition).catch((err) => {
          console.warn(`Could not add column ${columnName} to ${tableName}:`, err.message);
        });
      }
    };

    // 1. Create Fulfillments Table
    await createTableSafe('Fulfillments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'PurchaseOrders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
      },
      priority: {
        type: Sequelize.STRING,
        defaultValue: 'MEDIUM',
      },
      assignedTeam: {
        type: Sequelize.STRING,
        defaultValue: 'Operations / Supply',
      },
      assignedUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      plannedStartDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      plannedCompletionDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualStartDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualCompletionDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      requestedDeliveryDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actualDeliveryDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deliveryAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      dispatchReference: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      carrier: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 2. Create FulfillmentItems Table
    await createTableSafe('FulfillmentItems', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      fulfillmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Fulfillments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      quoteLineItemId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'QuoteLineItems', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      productServiceId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'PriceBookEntries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      quantityPlanned: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      quantityAllocated: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      quantityInProduction: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      quantityReady: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      quantityDispatched: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      quantityDelivered: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 3. Extend Assets Table
    await addColumnSafe('Assets', 'orderId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'PurchaseOrders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnSafe('Assets', 'orderItemId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'productServiceId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'PriceBookEntries', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnSafe('Assets', 'assetNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'modelNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'location', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'installationDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'commissionDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'warrantyStart', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'warrantyEnd', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnSafe('Assets', 'purchaseDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // 4. Extend PriceBookEntries Table
    await addColumnSafe('PriceBookEntries', 'isAssetTracked', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });

    // 5. Extend PurchaseOrders Table
    await addColumnSafe('PurchaseOrders', 'salesOwnerId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnSafe('PurchaseOrders', 'assignedSupplyUserId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnSafe('PurchaseOrders', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnSafe('PurchaseOrders', 'deliveryAddress', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnSafe('PurchaseOrders', 'requestedDeliveryDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FulfillmentItems').catch(() => {});
    await queryInterface.dropTable('Fulfillments').catch(() => {});
  }
};
