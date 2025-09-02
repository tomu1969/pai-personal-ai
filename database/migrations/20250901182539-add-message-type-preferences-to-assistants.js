'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('assistants', 'message_type_preferences', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        allMessages: true,
        individualMessages: true,
        groupMessages: true,
        reactions: true,
        distributionLists: true
      },
      comment: 'JSON object storing which message types the assistant should respond to'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('assistants', 'message_type_preferences');
  }
};
