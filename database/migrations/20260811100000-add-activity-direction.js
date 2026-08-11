'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Activities', 'direction', {
      type: Sequelize.ENUM('inbound', 'outbound', 'internal'),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Activities', 'direction');
    
    // In PostgreSQL, ENUM types must be explicitly dropped
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Activities_direction";');
    } catch (e) {
      console.warn("Failed to drop ENUM type", e);
    }
  }
};
