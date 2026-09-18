'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('LeadContactDiscoveries')) {
      await queryInterface.createTable('LeadContactDiscoveries', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        leadId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Leads', key: 'id' },
          onDelete: 'CASCADE'
        },
        domain: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        contactsFound: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: '[]',
          comment: 'JSON array of normalized discovered contacts'
        },
        emailPattern: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Detected email format pattern e.g. {first}.{last}@domain.com'
        },
        totalFound: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        discoveredAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        requestedById: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onDelete: 'SET NULL'
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

      await queryInterface.addIndex('LeadContactDiscoveries', ['leadId'], { name: 'lead_contact_discoveries_lead_idx' });
      await queryInterface.addIndex('LeadContactDiscoveries', ['domain'], { name: 'lead_contact_discoveries_domain_idx' });
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('LeadContactDiscoveries')) {
      await queryInterface.dropTable('LeadContactDiscoveries');
    }
  }
};
