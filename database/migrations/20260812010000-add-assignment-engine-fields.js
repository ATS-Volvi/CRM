'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const userDesc = await queryInterface.describeTable('Users').catch(() => ({}));
    if (!userDesc.skills) {
      await queryInterface.addColumn('Users', 'skills', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!userDesc.weight) {
      await queryInterface.addColumn('Users', 'weight', { type: Sequelize.INTEGER, defaultValue: 100 });
    }
    if (!userDesc.lastAssignedAt) {
      await queryInterface.addColumn('Users', 'lastAssignedAt', { type: Sequelize.DATE, allowNull: true });
    }
    if (!userDesc.dedicatedEmail) {
      await queryInterface.addColumn('Users', 'dedicatedEmail', { type: Sequelize.STRING, allowNull: true });
    }
    if (!userDesc.dedicatedPhone) {
      await queryInterface.addColumn('Users', 'dedicatedPhone', { type: Sequelize.STRING, allowNull: true });
    }

    const leadDesc = await queryInterface.describeTable('Leads').catch(() => ({}));
    if (!leadDesc.assignmentType) {
      await queryInterface.addColumn('Leads', 'assignmentType', { type: Sequelize.STRING, defaultValue: 'AUTOMATIC' });
    }

    const ruleDesc = await queryInterface.describeTable('AssignmentRules').catch(() => ({}));
    if (!ruleDesc.lastAssignedRepId) {
      await queryInterface.addColumn('AssignmentRules', 'lastAssignedRepId', { type: Sequelize.UUID, allowNull: true });
    }
    if (!ruleDesc.lastAssignedAt) {
      await queryInterface.addColumn('AssignmentRules', 'lastAssignedAt', { type: Sequelize.DATE, allowNull: true });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'skills').catch(() => {});
    await queryInterface.removeColumn('Users', 'weight').catch(() => {});
    await queryInterface.removeColumn('Users', 'lastAssignedAt').catch(() => {});
    await queryInterface.removeColumn('Users', 'dedicatedEmail').catch(() => {});
    await queryInterface.removeColumn('Users', 'dedicatedPhone').catch(() => {});
    await queryInterface.removeColumn('Leads', 'assignmentType').catch(() => {});
    await queryInterface.removeColumn('AssignmentRules', 'lastAssignedRepId').catch(() => {});
    await queryInterface.removeColumn('AssignmentRules', 'lastAssignedAt').catch(() => {});
  }
};
