'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add summary tracking fields to assistants table
    await queryInterface.addColumn('assistants', 'last_summary_requested_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('assistants', 'summary_settings', {
      type: Sequelize.JSONB,
      defaultValue: {
        defaultTimeframe: 24, // hours
        format: 'detailed', // detailed or concise
        includeCategories: ['personal', 'business', 'support', 'sales', 'inquiry'],
        includePriorities: ['urgent', 'high', 'medium', 'low'],
        showActionItems: true,
        showAssistantActivity: true,
      },
      allowNull: false,
    });

    // Create summary history table for tracking generated summaries
    await queryInterface.createTable('summary_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      assistant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'assistants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      requested_by_contact_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'contacts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      period_start: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      period_end: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      message_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      summary_content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      summary_data: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      request_type: {
        type: Sequelize.ENUM('manual', 'scheduled', 'triggered'),
        defaultValue: 'manual',
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('summary_history', ['assistant_id', 'created_at']);
    await queryInterface.addIndex('summary_history', ['period_start', 'period_end']);
    await queryInterface.addIndex('summary_history', ['requested_by_contact_id']);
  },

  async down(queryInterface, Sequelize) {
    // Remove columns from assistants table
    await queryInterface.removeColumn('assistants', 'last_summary_requested_at');
    await queryInterface.removeColumn('assistants', 'summary_settings');

    // Drop summary history table
    await queryInterface.dropTable('summary_history');
  }
};