'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Deals').catch(() => ({}));

    if (!tableInfo.status) {
      await queryInterface.addColumn('Deals', 'status', {
        type: Sequelize.STRING,
        defaultValue: 'OPEN',
        allowNull: false
      }).catch(err => console.warn("Could not add status to Deals:", err.message));
    }

    if (!tableInfo.wonAt) {
      await queryInterface.addColumn('Deals', 'wonAt', {
        type: Sequelize.DATE,
        allowNull: true
      }).catch(err => console.warn("Could not add wonAt to Deals:", err.message));
    }

    if (!tableInfo.winningQuoteId) {
      await queryInterface.addColumn('Deals', 'winningQuoteId', {
        type: Sequelize.UUID,
        allowNull: true
      }).catch(err => console.warn("Could not add winningQuoteId to Deals:", err.message));
    }

    if (!tableInfo.wonReason) {
      await queryInterface.addColumn('Deals', 'wonReason', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(err => console.warn("Could not add wonReason to Deals:", err.message));
    }

    if (!tableInfo.lostAt) {
      await queryInterface.addColumn('Deals', 'lostAt', {
        type: Sequelize.DATE,
        allowNull: true
      }).catch(err => console.warn("Could not add lostAt to Deals:", err.message));
    }

    if (!tableInfo.lostBy) {
      await queryInterface.addColumn('Deals', 'lostBy', {
        type: Sequelize.UUID,
        allowNull: true
      }).catch(err => console.warn("Could not add lostBy to Deals:", err.message));
    }

    if (!tableInfo.lossNotes) {
      await queryInterface.addColumn('Deals', 'lossNotes', {
        type: Sequelize.TEXT,
        allowNull: true
      }).catch(err => console.warn("Could not add lossNotes to Deals:", err.message));
    }

    if (!tableInfo.currentActivity) {
      await queryInterface.addColumn('Deals', 'currentActivity', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(err => console.warn("Could not add currentActivity to Deals:", err.message));
    }

    if (!tableInfo.healthStatus) {
      await queryInterface.addColumn('Deals', 'healthStatus', {
        type: Sequelize.STRING,
        defaultValue: 'HEALTHY',
        allowNull: false
      }).catch(err => console.warn("Could not add healthStatus to Deals:", err.message));
    }

    if (!tableInfo.nextAction) {
      await queryInterface.addColumn('Deals', 'nextAction', {
        type: Sequelize.STRING,
        allowNull: true
      }).catch(err => console.warn("Could not add nextAction to Deals:", err.message));
    }

    if (!tableInfo.nextActionDue) {
      await queryInterface.addColumn('Deals', 'nextActionDue', {
        type: Sequelize.DATE,
        allowNull: true
      }).catch(err => console.warn("Could not add nextActionDue to Deals:", err.message));
    }

    if (!tableInfo.idempotencyKeys) {
      await queryInterface.addColumn('Deals', 'idempotencyKeys', {
        type: Sequelize.TEXT,
        defaultValue: '[]',
        allowNull: true
      }).catch(err => console.warn("Could not add idempotencyKeys to Deals:", err.message));
    }

    // Backfill historical deals
    try {
      await queryInterface.sequelize.query(`
        UPDATE "Deals" d
        SET "status" = CASE
          WHEN s."name" IN ('Won', 'Closed Won') THEN 'WON'
          WHEN s."name" IN ('Lost', 'Closed Lost') THEN 'LOST'
          ELSE 'OPEN'
        END,
        "healthStatus" = 'HEALTHY',
        "currentActivity" = CASE
          WHEN s."name" IN ('Won', 'Closed Won') THEN 'Opportunity Won'
          WHEN s."name" IN ('Lost', 'Closed Lost') THEN 'Opportunity Closed Lost'
          WHEN s."name" = 'Quote Preparation' THEN 'Quote in preparation'
          WHEN s."name" = 'Quote Sent' THEN 'Quote sent to customer'
          WHEN s."name" = 'Negotiation' THEN 'Commercial negotiation in progress'
          WHEN s."name" = 'Agreed' THEN 'Customer agreement reached'
          ELSE 'Opportunity created'
        END
        FROM "PipelineStages" s
        WHERE d."stageId" = s."id";
      `);

      // Ensure any deals with null status are marked OPEN
      await queryInterface.sequelize.query(`
        UPDATE "Deals"
        SET "status" = 'OPEN'
        WHERE "status" IS NULL;
      `);
    } catch (err) {
      console.warn("Backfill warning:", err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // No-op to preserve data safety
  }
};
