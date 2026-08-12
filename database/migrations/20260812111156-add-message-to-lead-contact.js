module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('LeadContacts', 'message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('LeadContacts', 'message');
  }
};
