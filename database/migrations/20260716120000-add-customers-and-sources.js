'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Customers table
    await queryInterface.createTable('Customers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      primaryContactName: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      industry: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 2. Create LeadSources table
    await queryInterface.createTable('LeadSources', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Seed initial values into LeadSources
    const initialSources = ['email', 'facebook', 'instagram', 'linkedin', 'website', 'api', 'manual'];
    const crypto = require('crypto');
    for (const src of initialSources) {
      await queryInterface.bulkInsert('LeadSources', [{
        id: crypto.randomUUID(),
        name: src,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
    }

    // 3. Add customerId to Leads and Deals
    await queryInterface.addColumn('Leads', 'customerId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Customers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('Deals', 'customerId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Customers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Deals', 'customerId');
    await queryInterface.removeColumn('Leads', 'customerId');
    await queryInterface.dropTable('LeadSources');
    await queryInterface.dropTable('Customers');
  }
};
