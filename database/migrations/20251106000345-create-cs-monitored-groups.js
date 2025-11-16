'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('cs_monitored_groups', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      group_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'WhatsApp group ID (e.g., 123456789@g.us)'
      },
      group_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable group name'
      },
      is_monitored: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this group is being monitored for CS tickets'
      },
      instance_id: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'cs-ticket-monitor',
        comment: 'Evolution API instance ID'
      },
      first_seen: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this group was first detected'
      },
      last_activity: {
        type: Sequelize.DATE,
        comment: 'Last time a message was seen from this group'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index for faster lookups
    await queryInterface.addIndex('cs_monitored_groups', ['group_id']);
    await queryInterface.addIndex('cs_monitored_groups', ['instance_id']);
    await queryInterface.addIndex('cs_monitored_groups', ['is_monitored']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('cs_monitored_groups');
  }
};
