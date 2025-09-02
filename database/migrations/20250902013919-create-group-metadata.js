'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('group_metadata', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      group_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'WhatsApp group ID (e.g., 120363401842466206@g.us)',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Group name/subject',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Group description',
      },
      profile_picture: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Group profile picture URL',
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Who created the group (WhatsApp ID)',
      },
      created_at_whatsapp: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the group was created on WhatsApp',
      },
      participants: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
        comment: 'Array of participant objects with ID, role, joinedAt',
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
        comment: 'Additional metadata from WhatsApp API',
      },
      last_synced: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When group data was last synced from WhatsApp',
      },
      source: {
        type: Sequelize.ENUM('webhook', 'api', 'manual'),
        defaultValue: 'webhook',
        allowNull: false,
        comment: 'How the group data was obtained',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether the group is still active',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('group_metadata', ['group_id']);
    await queryInterface.addIndex('group_metadata', ['name']);
    await queryInterface.addIndex('group_metadata', ['is_active']);
    await queryInterface.addIndex('group_metadata', ['last_synced']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('group_metadata');
  }
};