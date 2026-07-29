'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map(t => (typeof t === 'object' ? t.tableName || t.name : t))
      : [];

    // 1. Create Customers table if not present
    if (!tableNames.includes('Customers')) {
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
      }).catch(() => {});
    }

    // 2. Create LeadSources table if not present
    if (!tableNames.includes('LeadSources')) {
      await queryInterface.createTable('LeadSources', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch(() => {});
    }

    // Seed initial values into LeadSources (idempotent - ignore duplicates)
    const initialSources = ['email', 'facebook', 'instagram', 'linkedin', 'website', 'api', 'manual'];
    const crypto = require('crypto');
    for (const src of initialSources) {
      try {
        await queryInterface.bulkInsert('LeadSources', [{
          id: crypto.randomUUID(),
          name: src,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }]);
      } catch (e) {
        // Ignore duplicate key validation errors if source already exists
      }
    }

    // 3. Add customerId to Leads and Deals idempotently
    const leadsDesc = await queryInterface.describeTable('Leads').catch(() => ({}));
    if (!leadsDesc.customerId) {
      await queryInterface.addColumn('Leads', 'customerId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }

    const dealsDesc = await queryInterface.describeTable('Deals').catch(() => ({}));
    if (!dealsDesc.customerId) {
      await queryInterface.addColumn('Deals', 'customerId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }

    const activitiesDesc = await queryInterface.describeTable('Activities').catch(() => ({}));
    if (!activitiesDesc.customerId) {
      await queryInterface.addColumn('Activities', 'customerId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }).catch(() => {});
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Deals', 'customerId').catch(() => {});
    await queryInterface.removeColumn('Leads', 'customerId').catch(() => {});
    await queryInterface.dropTable('LeadSources').catch(() => {});
    await queryInterface.dropTable('Customers').catch(() => {});
  }
};
