'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('SequenceEnrollments');
    await queryInterface.dropTable('SequenceSteps');
    await queryInterface.dropTable('Sequences');
  },

  down: async (queryInterface, Sequelize) => {
    // No-op rollback for removed feature
  }
};
