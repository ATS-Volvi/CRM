'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('OrgSettings')) {
      await queryInterface.createTable('OrgSettings', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        defaultCurrency: {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: 'SAR',
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

      const now = new Date();
      await queryInterface.bulkInsert('OrgSettings', [
        {
          id: '00000000-0000-0000-0000-000000000001',
          defaultCurrency: 'SAR',
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('OrgSettings');
  },
};
