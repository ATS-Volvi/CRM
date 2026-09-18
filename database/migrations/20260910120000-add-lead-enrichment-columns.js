'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('Leads');

    // ── 1. Add enrichment columns to Leads ──────────────────────────────────
    if (!tableDescription.enrichmentStatus) {
      await queryInterface.addColumn('Leads', 'enrichmentStatus', {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
        comment: 'pending | enriched | skipped | failed'
      });
    }

    if (!tableDescription.enrichmentData) {
      await queryInterface.addColumn('Leads', 'enrichmentData', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
        comment: 'JSON blob of normalized Hunter.io enrichment result'
      });
    }

    if (!tableDescription.enrichedAt) {
      await queryInterface.addColumn('Leads', 'enrichedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'Timestamp of last successful enrichment call'
      });
    }

    // ── 2. Create EnrichmentUsage table for credit/usage tracking ────────────
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('EnrichmentUsages')) {
      await queryInterface.createTable('EnrichmentUsages', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Leads', key: 'id' },
          onDelete: 'SET NULL'
        },
        provider: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'hunter'
        },
        domain: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: 'enriched | skipped | failed | rate_limited'
        },
        httpStatus: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        errorMessage: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        calledAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      await queryInterface.addIndex('EnrichmentUsages', ['leadId'],            { name: 'enrichment_usage_lead_idx' });
      await queryInterface.addIndex('EnrichmentUsages', ['calledAt'],          { name: 'enrichment_usage_calledat_idx' });
      await queryInterface.addIndex('EnrichmentUsages', ['provider', 'calledAt'], { name: 'enrichment_usage_provider_date_idx' });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('Leads');
    if (tableDescription.enrichmentStatus) await queryInterface.removeColumn('Leads', 'enrichmentStatus');
    if (tableDescription.enrichmentData)   await queryInterface.removeColumn('Leads', 'enrichmentData');
    if (tableDescription.enrichedAt)       await queryInterface.removeColumn('Leads', 'enrichedAt');

    const tables = await queryInterface.showAllTables();
    if (tables.includes('EnrichmentUsages')) {
      await queryInterface.dropTable('EnrichmentUsages');
    }
  }
};
