'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    // SQLite has no native ENUM — store as TEXT with the same allowed values enforced at app layer
    const columnType = dialect === 'sqlite'
      ? Sequelize.STRING
      : Sequelize.ENUM('inbound', 'outbound', 'internal');

    await queryInterface.addColumn('Activities', 'direction', {
      type: columnType,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Activities', 'direction');

    // In PostgreSQL, ENUM types must be explicitly dropped; SQLite has none to drop
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'sqlite') {
      try {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Activities_direction";');
      } catch (e) {
        console.warn('Failed to drop ENUM type', e);
      }
    }
  }
};
