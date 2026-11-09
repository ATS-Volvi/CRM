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

    await createTableSafe('EmailSuppressions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING,
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

    try {
      await queryInterface.addIndex('EmailSuppressions', ['email'], {
        unique: true,
        name: 'email_suppressions_email_unique'
      });
    } catch (e) {
      // index might already exist from unique constraint
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('EmailSuppressions');
  }
};
