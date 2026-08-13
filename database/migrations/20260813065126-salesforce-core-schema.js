module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Rename Customers to Accounts
    await queryInterface.renameTable('Customers', 'Accounts');

    // 2. Create Contacts table
    await queryInterface.createTable('Contacts', {
      id: { type: Sequelize.UUID, primaryKey: true },
      accountId: { type: Sequelize.UUID, allowNull: false },
      firstName: { type: Sequelize.STRING, allowNull: true },
      lastName: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      role: { type: Sequelize.STRING, allowNull: true },
      sourceChannel: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 3. Create DealContacts table
    await queryInterface.createTable('DealContacts', {
      id: { type: Sequelize.UUID, primaryKey: true },
      dealId: { type: Sequelize.UUID, allowNull: false },
      contactId: { type: Sequelize.UUID, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: true },
      isPrimary: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 4. Deals table already has customerId, we'll add accountId and eventually migrate data, then drop customerId
    // But for SQLite compatibility, dropping columns is hard. Let's just add accountId.
    await queryInterface.addColumn('Deals', 'accountId', {
      type: Sequelize.UUID,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Deals', 'accountId');
    await queryInterface.dropTable('DealContacts');
    await queryInterface.dropTable('Contacts');
    await queryInterface.renameTable('Accounts', 'Customers');
  }
};
