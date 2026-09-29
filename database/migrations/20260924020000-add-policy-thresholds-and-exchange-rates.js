'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((t) => (typeof t === 'object' ? t.tableName || t.name : t))
      : [];

    // 1. AdminApprovalPolicies extensions
    if (tableNames.includes('AdminApprovalPolicies')) {
      const tableInfo = await queryInterface.describeTable('AdminApprovalPolicies');
      
      if (!tableInfo.repSelfApprovalDefault) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'repSelfApprovalDefault', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 1000000,
        });
      }
      if (!tableInfo.teamLeadApprovalDefault) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'teamLeadApprovalDefault', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 5000000,
        });
      }
      if (!tableInfo.repTierCutoffExecutive) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'repTierCutoffExecutive', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 250000,
        });
      }
      if (!tableInfo.repTierCutoffAgent) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'repTierCutoffAgent', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 50000,
        });
      }
      if (!tableInfo.repTierCutoffDefault) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'repTierCutoffDefault', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 1000000,
        });
      }
      if (!tableInfo.currency) {
        await queryInterface.addColumn('AdminApprovalPolicies', 'currency', {
          type: Sequelize.STRING(3),
          defaultValue: 'INR',
        });
      }

      // Seed initial row if table is empty
      const [existingRows] = await queryInterface.sequelize.query('SELECT id FROM "AdminApprovalPolicies" LIMIT 1;');
      if (!existingRows || existingRows.length === 0) {
        const now = new Date();
        await queryInterface.bulkInsert('AdminApprovalPolicies', [
          {
            id: '00000000-0000-0000-0000-000000000001',
            maximumSalesRepApproval: 2500000,
            maximumTeamLeadApproval: 10000000,
            maximumRepDiscount: 0.10,
            maximumTeamLeadDiscount: 0.20,
            minimumAllowedMargin: 0.15,
            repSelfApprovalDefault: 1000000,
            teamLeadApprovalDefault: 5000000,
            repTierCutoffExecutive: 250000,
            repTierCutoffAgent: 50000,
            repTierCutoffDefault: 1000000,
            currency: 'INR',
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }

    // 2. SalesAssignmentPolicies extensions
    if (tableNames.includes('SalesAssignmentPolicies')) {
      const tableInfo = await queryInterface.describeTable('SalesAssignmentPolicies');
      if (!tableInfo.leadScoreValueMultiplier) {
        await queryInterface.addColumn('SalesAssignmentPolicies', 'leadScoreValueMultiplier', {
          type: Sequelize.DECIMAL(15, 2),
          defaultValue: 10000,
        });
      }
      if (!tableInfo.currency) {
        await queryInterface.addColumn('SalesAssignmentPolicies', 'currency', {
          type: Sequelize.STRING(3),
          defaultValue: 'INR',
        });
      }

      // Seed initial row if table is empty
      const [existingRows] = await queryInterface.sequelize.query('SELECT id FROM "SalesAssignmentPolicies" LIMIT 1;');
      if (!existingRows || existingRows.length === 0) {
        const now = new Date();
        await queryInterface.bulkInsert('SalesAssignmentPolicies', [
          {
            id: '00000000-0000-0000-0000-000000000001',
            weights: JSON.stringify({
              conversionRate: 0.20,
              industrySkill: 0.20,
              territoryMatch: 0.10,
              revenuePerformance: 0.10,
              experienceTier: 0.10,
              responseTime: 0.05,
              slaCompliance: 0.05,
              workloadCapacity: 0.10,
              fairnessDistribution: 0.05,
              managerRating: 0.05,
            }),
            highValueThreshold: 10000000,
            strategicLeadScoreThreshold: 85,
            minSampleSize: 5,
            bayesianPrior: 0.25,
            bayesianWeight: 3,
            highValueExperienceTiers: JSON.stringify([
              'Senior Sales Representative',
              'Enterprise AE',
              'Strategic AE',
              'senior_ae',
              'sales_manager',
            ]),
            isPerformanceRoutingEnabled: true,
            leadScoreValueMultiplier: 10000,
            currency: 'INR',
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }

    // 3. ExchangeRates table
    if (!tableNames.includes('ExchangeRates')) {
      await queryInterface.createTable('ExchangeRates', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        fromCurrency: {
          type: Sequelize.STRING(3),
          allowNull: false,
        },
        toCurrency: {
          type: Sequelize.STRING(3),
          allowNull: false,
        },
        rate: {
          type: Sequelize.DECIMAL(18, 6),
          allowNull: false,
        },
        updatedById: {
          type: Sequelize.UUID,
          allowNull: true,
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

    // Seed initial rates if table is empty
    const [existingRates] = await queryInterface.sequelize.query(
      'SELECT id FROM "ExchangeRates" LIMIT 1;'
    ).catch(() => [[]]);

    if (!existingRates || existingRates.length === 0) {
      const now = new Date();
      const initialRates = [
        // Identities
        { fromCurrency: 'SAR', toCurrency: 'SAR', rate: 1.0 },
        { fromCurrency: 'INR', toCurrency: 'INR', rate: 1.0 },
        { fromCurrency: 'USD', toCurrency: 'USD', rate: 1.0 },
        { fromCurrency: 'AED', toCurrency: 'AED', rate: 1.0 },
        { fromCurrency: 'EUR', toCurrency: 'EUR', rate: 1.0 },
        { fromCurrency: 'GBP', toCurrency: 'GBP', rate: 1.0 },
        // SAR base
        { fromCurrency: 'SAR', toCurrency: 'INR', rate: 22.25 },
        { fromCurrency: 'INR', toCurrency: 'SAR', rate: 0.044944 },
        { fromCurrency: 'SAR', toCurrency: 'USD', rate: 0.266667 },
        { fromCurrency: 'USD', toCurrency: 'SAR', rate: 3.75 },
        { fromCurrency: 'SAR', toCurrency: 'AED', rate: 0.980392 },
        { fromCurrency: 'AED', toCurrency: 'SAR', rate: 1.02 },
        { fromCurrency: 'SAR', toCurrency: 'EUR', rate: 0.245098 },
        { fromCurrency: 'EUR', toCurrency: 'SAR', rate: 4.08 },
        { fromCurrency: 'SAR', toCurrency: 'GBP', rate: 0.206186 },
        { fromCurrency: 'GBP', toCurrency: 'SAR', rate: 4.85 },
        // USD pairs
        { fromCurrency: 'USD', toCurrency: 'INR', rate: 83.50 },
        { fromCurrency: 'INR', toCurrency: 'USD', rate: 0.011976 },
        { fromCurrency: 'USD', toCurrency: 'AED', rate: 3.67 },
        { fromCurrency: 'AED', toCurrency: 'USD', rate: 0.272480 },
        { fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.917431 },
        { fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.09 },
        { fromCurrency: 'USD', toCurrency: 'GBP', rate: 0.775194 },
        { fromCurrency: 'GBP', toCurrency: 'USD', rate: 1.29 },
      ];

      await queryInterface.bulkInsert(
        'ExchangeRates',
        initialRates.map((r, i) => ({
          id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          rate: r.rate,
          updatedById: null,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ExchangeRates');
  },
};
