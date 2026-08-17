'use strict';

const crypto = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isSqlite = queryInterface.sequelize.getDialect() === 'sqlite';
    const quoteIdent = (name) => isSqlite ? `\`${name}\`` : `"${name}"`;

    const leadsTable = quoteIdent('Leads');
    const dealsTable = quoteIdent('Deals');
    const pipelineStagesTable = quoteIdent('PipelineStages');

    // 1. In Postgres, alter enum types or alter column to VARCHAR to support new values freely
    if (!isSqlite) {
      // Convert PipelineStages.name to VARCHAR to avoid enum constraint lockups
      await queryInterface.sequelize.query(`
        ALTER TABLE "PipelineStages" ALTER COLUMN "name" TYPE VARCHAR(255);
      `).catch(() => {});

      await queryInterface.sequelize.query(`
        ALTER TABLE "Leads" ALTER COLUMN "status" TYPE VARCHAR(255);
      `).catch(() => {});
    }

    // 2. Add accountId to Leads if missing
    const tableInfoLeads = await queryInterface.describeTable('Leads').catch(() => ({}));
    if (!tableInfoLeads.accountId) {
      await queryInterface.addColumn('Leads', 'accountId', {
        type: Sequelize.UUID,
        references: {
          model: 'Accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        allowNull: true
      });
    }

    // Add accountId to Deals if missing
    const tableInfoDeals = await queryInterface.describeTable('Deals').catch(() => ({}));
    if (!tableInfoDeals.accountId) {
      await queryInterface.addColumn('Deals', 'accountId', {
        type: Sequelize.UUID,
        references: {
          model: 'Accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        allowNull: true
      });
    }
    if (!tableInfoDeals.enteredStageAt) {
      await queryInterface.addColumn('Deals', 'enteredStageAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }).catch(() => {});
    }
    if (!tableInfoDeals.lastCustomerActivityAt) {
      await queryInterface.addColumn('Deals', 'lastCustomerActivityAt', {
        type: Sequelize.DATE,
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoDeals.stageVerificationStatus) {
      await queryInterface.addColumn('Deals', 'stageVerificationStatus', {
        type: Sequelize.STRING,
        defaultValue: 'VERIFIED'
      }).catch(() => {});
    }
    if (!tableInfoDeals.stageEvidence) {
      await queryInterface.addColumn('Deals', 'stageEvidence', {
        type: Sequelize.TEXT,
        defaultValue: '[]'
      }).catch(() => {});
    }

    // Add columns to LeadStageHistories if missing
    const tableInfoLSH = await queryInterface.describeTable('LeadStageHistories').catch(() => ({}));
    if (!tableInfoLSH.transitionType) {
      await queryInterface.addColumn('LeadStageHistories', 'transitionType', {
        type: Sequelize.STRING,
        defaultValue: 'VALIDATED_MANUAL'
      }).catch(() => {});
    }
    if (!tableInfoLSH.evidenceData) {
      await queryInterface.addColumn('LeadStageHistories', 'evidenceData', {
        type: Sequelize.TEXT,
        defaultValue: '[]'
      }).catch(() => {});
    }
    if (!tableInfoLSH.isVerified) {
      await queryInterface.addColumn('LeadStageHistories', 'isVerified', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      }).catch(() => {});
    }

    // Add columns to PriceBookEntries if missing
    const tableInfoPBE = await queryInterface.describeTable('PriceBookEntries').catch(() => ({}));
    if (!tableInfoPBE.uom) {
      await queryInterface.addColumn('PriceBookEntries', 'uom', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoPBE.internalCost) {
      await queryInterface.addColumn('PriceBookEntries', 'internalCost', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoPBE.minSellingPrice) {
      await queryInterface.addColumn('PriceBookEntries', 'minSellingPrice', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoPBE.targetMarginPct) {
      await queryInterface.addColumn('PriceBookEntries', 'targetMarginPct', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoPBE.tax) {
      await queryInterface.addColumn('PriceBookEntries', 'tax', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      }).catch(() => {});
    }

    // Add columns to QuoteLineItems if missing
    const tableInfoQLI = await queryInterface.describeTable('QuoteLineItems').catch(() => ({}));
    if (!tableInfoQLI.catalogItemId) {
      await queryInterface.addColumn('QuoteLineItems', 'catalogItemId', {
        type: Sequelize.UUID,
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoQLI.discount) {
      await queryInterface.addColumn('QuoteLineItems', 'discount', {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      }).catch(() => {});
    }
    if (!tableInfoQLI.tax) {
      await queryInterface.addColumn('QuoteLineItems', 'tax', {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      }).catch(() => {});
    }
    if (!tableInfoQLI.isCustom) {
      await queryInterface.addColumn('QuoteLineItems', 'isCustom', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }).catch(() => {});
    }
    if (!tableInfoQLI.customDescription) {
      await queryInterface.addColumn('QuoteLineItems', 'customDescription', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(() => {});
    }
    if (!tableInfoQLI.sortOrder) {
      await queryInterface.addColumn('QuoteLineItems', 'sortOrder', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }).catch(() => {});
    }
    if (!tableInfoQLI.internalCostSnapshot) {
      await queryInterface.addColumn('QuoteLineItems', 'internalCostSnapshot', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      }).catch(() => {});
    }

    // 3. Backfill accountId from customerId in Deals and Leads
    await queryInterface.sequelize.query(`
      UPDATE ${dealsTable}
      SET ${quoteIdent('accountId')} = ${quoteIdent('customerId')}
      WHERE ${quoteIdent('accountId')} IS NULL AND ${quoteIdent('customerId')} IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${leadsTable}
      SET ${quoteIdent('accountId')} = ${quoteIdent('customerId')}
      WHERE ${quoteIdent('accountId')} IS NULL AND ${quoteIdent('customerId')} IS NOT NULL;
    `);

    // 4. Setup Opportunity Pipeline Stages
    const targetStages = [
      { name: 'Discovery', order: 1, probability: 10 },
      { name: 'Requirements', order: 2, probability: 20 },
      { name: 'Solution/Scope', order: 3, probability: 40 },
      { name: 'Quote Preparation', order: 4, probability: 60 },
      { name: 'Quote Sent', order: 5, probability: 70 },
      { name: 'Negotiation', order: 6, probability: 80 },
      { name: 'Agreed', order: 7, probability: 90 },
      { name: 'Won', order: 8, probability: 100 },
      { name: 'Lost', order: 9, probability: 0 }
    ];

    // Ensure all 9 target stages exist
    for (const ts of targetStages) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id, name FROM ${pipelineStagesTable} WHERE name = :name LIMIT 1;`,
        { replacements: { name: ts.name } }
      );

      if (!existing || existing.length === 0) {
        const stageId = crypto.randomUUID();
        const nowSql = isSqlite ? "datetime('now')" : "NOW()";
        await queryInterface.sequelize.query(
          `INSERT INTO ${pipelineStagesTable} (${quoteIdent('id')}, ${quoteIdent('name')}, ${quoteIdent('order')}, ${quoteIdent('probability')}, ${quoteIdent('createdAt')}, ${quoteIdent('updatedAt')})
           VALUES (:id, :name, :order, :probability, ${nowSql}, ${nowSql});`,
          { replacements: { id: stageId, name: ts.name, order: ts.order, probability: ts.probability } }
        );
      } else {
        await queryInterface.sequelize.query(
          `UPDATE ${pipelineStagesTable} SET ${quoteIdent('order')} = :order, ${quoteIdent('probability')} = :probability WHERE ${quoteIdent('id')} = :id;`,
          { replacements: { id: existing[0].id, order: ts.order, probability: ts.probability } }
        );
      }
    }

    // Get stage map of all target stages (name -> id)
    const [allNewStages] = await queryInterface.sequelize.query(
      `SELECT id, name FROM ${pipelineStagesTable};`
    );

    const targetStageMap = {};
    for (const s of allNewStages) {
      targetStageMap[s.name] = s.id;
    }

    // Map old stage names to new target stage names
    const oldToNewMapping = {
      'New': 'Discovery',
      'Contacted': 'Discovery',
      'Qualified': 'Requirements',
      'Qualification': 'Requirements',
      'Meeting/Demo': 'Solution/Scope',
      'Meeting': 'Solution/Scope',
      'Needs Analysis': 'Solution/Scope',
      'Proposal': 'Quote Preparation',
      'Quote Sent': 'Quote Sent',
      'Negotiation': 'Negotiation',
      'Agreed': 'Agreed',
      'Won': 'Won',
      'Closed Won': 'Won',
      'Lost': 'Lost',
      'Closed Lost': 'Lost',
      'On Hold': 'Lost'
    };

    // Remap deals from old stages to new stages
    for (const s of allNewStages) {
      if (!targetStages.some(ts => ts.name === s.name)) {
        const mappedTargetName = oldToNewMapping[s.name] || 'Discovery';
        const targetId = targetStageMap[mappedTargetName];
        if (targetId) {
          await queryInterface.sequelize.query(
            `UPDATE ${dealsTable} SET ${quoteIdent('stageId')} = :targetId WHERE ${quoteIdent('stageId')} = :oldId;`,
            { replacements: { targetId, oldId: s.id } }
          );
        }

        // Delete obsolete stage
        await queryInterface.sequelize.query(
          `DELETE FROM ${pipelineStagesTable} WHERE ${quoteIdent('id')} = :oldId;`,
          { replacements: { oldId: s.id } }
        );
      }
    }

    // 5. Migrate Leads.status to NEW / CONTACTED / QUALIFIED / CONVERTED / NOT_CONVERTED
    await queryInterface.sequelize.query(`
      UPDATE ${leadsTable}
      SET ${quoteIdent('status')} = CASE
        WHEN ${quoteIdent('status')} IN ('New', 'New Lead') OR ${quoteIdent('status')} IS NULL THEN 'NEW'
        WHEN ${quoteIdent('status')} = 'Contacted' THEN 'CONTACTED'
        WHEN ${quoteIdent('status')} = 'Qualified' AND ${quoteIdent('id')} IN (SELECT ${quoteIdent('leadId')} FROM ${dealsTable} WHERE ${quoteIdent('leadId')} IS NOT NULL) THEN 'CONVERTED'
        WHEN ${quoteIdent('status')} = 'Qualified' THEN 'QUALIFIED'
        WHEN ${quoteIdent('status')} IN ('Unqualified', 'Lost', 'Disqualified', 'On Hold', 'Not Converted') THEN 'NOT_CONVERTED'
        WHEN ${quoteIdent('status')} IN ('Won', 'Converted', 'Closed Won') THEN 'CONVERTED'
        ELSE 'NEW'
      END;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Non-destructive down migration
  }
};
