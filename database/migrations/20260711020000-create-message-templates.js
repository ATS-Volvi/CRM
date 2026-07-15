'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // MessageTemplates is already created safely in initial-schema.js
  },

  down: async (queryInterface, Sequelize) => {
    // Handled in initial-schema.js
  }
};
