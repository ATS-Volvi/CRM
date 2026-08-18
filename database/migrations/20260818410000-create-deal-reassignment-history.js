module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      // Idempotent create table
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('DealReassignmentHistories')) {
        await queryInterface.createTable('DealReassignmentHistories', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false
          },
          dealId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'Deals', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          fromUserId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          toUserId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          reason: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          reassignedBy: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('NOW')
          }
        }, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.dropTable('DealReassignmentHistories', { transaction: t });
    });
  }
};
