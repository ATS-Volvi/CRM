'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const leadsDesc = await queryInterface.describeTable('Leads').catch(() => ({}));

    // 1. Add columns to Leads idempotently
    if (!leadsDesc.leadNumber) {
      await queryInterface.addColumn('Leads', 'leadNumber', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }

    if (!leadsDesc.categoriesData) {
      await queryInterface.addColumn('Leads', 'categoriesData', {
        type: Sequelize.JSON,
        allowNull: true
      }).catch(() => {});
    }

    // 2. Create LeadReassignmentHistories table idempotently
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map(t => (typeof t === 'object' ? t.tableName || t.name : t))
      : [];

    if (!tableNames.includes('LeadReassignmentHistories')) {
      await queryInterface.createTable('LeadReassignmentHistories', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        leadId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Leads', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        oldAssignedToId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        newAssignedToId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        changedByUserId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      }).catch(() => {});
    }

    // 3. Backfill Lead Numbers
    try {
      const leads = await queryInterface.sequelize.query(
        `SELECT id FROM "Leads" WHERE "leadNumber" IS NULL ORDER BY "createdAt" ASC;`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      let seq = 1;
      for (const lead of leads) {
        const leadNum = `LD-2026-${String(seq).padStart(5, '0')}`;
        await queryInterface.sequelize.query(
          `UPDATE "Leads" SET "leadNumber" = :leadNum WHERE id = :id;`,
          {
            replacements: { leadNum, id: lead.id },
            type: queryInterface.sequelize.QueryTypes.UPDATE
          }
        );
        seq++;
      }
    } catch (e) {
      // Ignore backfill query errors if table schema differs
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('LeadReassignmentHistories').catch(() => {});
    await queryInterface.removeColumn('Leads', 'categoriesData').catch(() => {});
    await queryInterface.removeColumn('Leads', 'leadNumber').catch(() => {});
  }
};
