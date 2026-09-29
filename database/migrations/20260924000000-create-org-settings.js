'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((t) => (typeof t === 'object' ? t.tableName || t.name : t))
      : [];

    if (!tableNames.includes('OrgSettings')) {
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
    }

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM "OrgSettings" LIMIT 1;'
    ).catch(() => [[]]);

    if (!existing || existing.length === 0) {
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
