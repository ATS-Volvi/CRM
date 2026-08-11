'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Leads', 'temperature', {
      type: Sequelize.STRING,
      defaultValue: 'Warm',
    });
    await queryInterface.addColumn('Leads', 'temperatureOverride', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('Leads', 'lastInboundAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Leads', 'responsivenessScore', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Leads', 'temperature');
    await queryInterface.removeColumn('Leads', 'temperatureOverride');
    await queryInterface.removeColumn('Leads', 'lastInboundAt');
    await queryInterface.removeColumn('Leads', 'responsivenessScore');
  }
};
