'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add columns to Leads
    await queryInterface.addColumn('Leads', 'leadNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('Leads', 'categoriesData', {
      type: Sequelize.JSON,
      allowNull: true
    });

    // 2. Create LeadReassignmentHistories table
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
    });

    // 3. Backfill Lead Numbers
    const leads = await queryInterface.sequelize.query(
      `SELECT id FROM "Leads" ORDER BY "createdAt" ASC;`,
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('LeadReassignmentHistories');
    await queryInterface.removeColumn('Leads', 'categoriesData');
    await queryInterface.removeColumn('Leads', 'leadNumber');
  }
};
