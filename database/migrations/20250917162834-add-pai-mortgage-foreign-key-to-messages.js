'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add pai_mortgage_id column with foreign key constraint
    await queryInterface.addColumn('messages', 'pai_mortgage_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'pai_mortgages',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for performance
    await queryInterface.addIndex('messages', ['pai_mortgage_id'], {
      name: 'messages_pai_mortgage_id'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('messages', 'messages_pai_mortgage_id');
    
    // Remove column
    await queryInterface.removeColumn('messages', 'pai_mortgage_id');
  }
};
