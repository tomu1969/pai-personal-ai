'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('contacts', 'is_group', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    // Update existing group contacts based on phone number pattern
    await queryInterface.sequelize.query(
      "UPDATE contacts SET is_group = true WHERE phone LIKE '%@g.us';"
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('contacts', 'is_group');
  }
};
