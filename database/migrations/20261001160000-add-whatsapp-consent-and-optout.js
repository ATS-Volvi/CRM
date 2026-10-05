'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const safeAddColumn = async (tableName, columnName, options) => {
      try {
        const tableDesc = await queryInterface.describeTable(tableName);
        if (!tableDesc[columnName]) {
          await queryInterface.addColumn(tableName, columnName, options);
        }
      } catch (err) {
        try {
          await queryInterface.addColumn(tableName, columnName, options);
        } catch (innerErr) {
          console.warn(`[Migration] Notice: column ${columnName} on ${tableName}:`, innerErr.message);
        }
      }
    };

    // Add to Leads
    await safeAddColumn('Leads', 'optedOutWhatsapp', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    await safeAddColumn('Leads', 'whatsappConsentStatus', {
      type: Sequelize.STRING,
      defaultValue: 'UNSPECIFIED',
      allowNull: false
    });
    await safeAddColumn('Leads', 'whatsappOptOutAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await safeAddColumn('Leads', 'whatsappOptInAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await safeAddColumn('Leads', 'whatsappOptOutSource', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Add to Contacts
    await safeAddColumn('Contacts', 'optedOutWhatsapp', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    await safeAddColumn('Contacts', 'whatsappConsentStatus', {
      type: Sequelize.STRING,
      defaultValue: 'UNSPECIFIED',
      allowNull: false
    });
    await safeAddColumn('Contacts', 'whatsappOptOutAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await safeAddColumn('Contacts', 'whatsappOptInAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    const safeRemoveColumn = async (tableName, columnName) => {
      try {
        await queryInterface.removeColumn(tableName, columnName);
      } catch (e) {
        console.warn(`[Migration] Failed to remove ${columnName} from ${tableName}:`, e.message);
      }
    };

    await safeRemoveColumn('Leads', 'whatsappOptOutSource');
    await safeRemoveColumn('Leads', 'whatsappOptInAt');
    await safeRemoveColumn('Leads', 'whatsappOptOutAt');
    await safeRemoveColumn('Leads', 'whatsappConsentStatus');
    await safeRemoveColumn('Leads', 'optedOutWhatsapp');

    await safeRemoveColumn('Contacts', 'whatsappOptInAt');
    await safeRemoveColumn('Contacts', 'whatsappOptOutAt');
    await safeRemoveColumn('Contacts', 'whatsappConsentStatus');
    await safeRemoveColumn('Contacts', 'optedOutWhatsapp');
  }
};
