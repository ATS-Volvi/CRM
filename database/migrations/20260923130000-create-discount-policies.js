'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create DiscountPolicies table if not exists
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('DiscountPolicies')) {
      await queryInterface.createTable('DiscountPolicies', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        role: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        maxDiscountPercent: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
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

      // 2. Seed initial default discount policy values
      const now = new Date();
      await queryInterface.bulkInsert('DiscountPolicies', [
        {
          id: '11111111-1111-4111-a111-111111111111',
          role: 'Sales Rep',
          maxDiscountPercent: 10.00,
          description: 'Frontline Sales Representative standard discretionary discount limit',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '22222222-2222-4222-a222-222222222222',
          role: 'Team Lead',
          maxDiscountPercent: 20.00,
          description: 'Team Lead discount approval threshold',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '33333333-3333-4333-a333-333333333333',
          role: 'Admin',
          maxDiscountPercent: 100.00,
          description: 'Executive and Admin unlimited discount approval authority',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('DiscountPolicies');
  },
};
