'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create PAI Responders table
    await queryInterface.createTable('pai_responders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      owner_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      assistant_name: {
        type: Sequelize.STRING,
        defaultValue: 'PAI',
        allowNull: false,
      },
      system_prompt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      auto_response_template: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      message_type_preferences: {
        type: Sequelize.JSONB,
        defaultValue: {
          allMessages: true,
          individualMessages: true,
          groupMessages: true,
          reactions: true,
          distributionLists: true,
        },
        allowNull: false,
      },
      response_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          cooldownMinutes: 30,
          maxMessagesPerHour: 20,
          enableEmoticons: true,
          enableFollowUpQuestions: true,
          signatureFormat: 'bottom',
        },
        allowNull: false,
      },
      messages_processed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create PAI Assistants table
    await queryInterface.createTable('pai_assistants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      owner_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      assistant_name: {
        type: Sequelize.STRING,
        defaultValue: 'PAI Assistant',
        allowNull: false,
      },
      system_prompt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      summary_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          defaultTimeframe: 24,
          format: 'chronological',
          includeCategories: ['personal', 'business', 'support', 'sales', 'inquiry'],
          includePriorities: ['urgent', 'high', 'medium', 'low'],
          showActionItems: true,
          showAssistantActivity: false,
          maxMessagesPerSummary: 100,
        },
        allowNull: false,
      },
      query_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          defaultLimit: 50,
          maxLimit: 200,
          enableTimeframeFallback: true,
          defaultSearchDepth: 'week',
        },
        allowNull: false,
      },
      last_summary_requested_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      queries_processed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add foreign key columns to messages table
    await queryInterface.addColumn('messages', 'pai_responder_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'pai_responders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('messages', 'pai_assistant_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'pai_assistants',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Migrate data from existing assistants table
    const assistants = await queryInterface.sequelize.query(
      'SELECT * FROM assistants',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (assistants.length > 0) {
      const assistant = assistants[0]; // Use first assistant as template

      // Create PAI Responder record
      await queryInterface.bulkInsert('pai_responders', [{
        id: Sequelize.fn('uuid_generate_v4'),
        enabled: assistant.enabled,
        owner_name: assistant.owner_name,
        assistant_name: assistant.assistant_name || 'PAI',
        system_prompt: null, // Will use prompts/pai_responder.md
        auto_response_template: assistant.auto_response_template,
        message_type_preferences: assistant.message_type_preferences || {
          allMessages: true,
          individualMessages: true,
          groupMessages: true,
          reactions: true,
          distributionLists: true,
        },
        response_settings: {
          cooldownMinutes: 30,
          maxMessagesPerHour: 20,
          enableEmoticons: true,
          enableFollowUpQuestions: true,
          signatureFormat: 'bottom',
        },
        messages_processed: assistant.messages_processed || 0,
        last_activity: assistant.last_activity,
        created_at: new Date(),
        updated_at: new Date(),
      }]);

      // Create PAI Assistant record
      await queryInterface.bulkInsert('pai_assistants', [{
        id: Sequelize.fn('uuid_generate_v4'),
        enabled: true, // Assistant always enabled for owner
        owner_name: assistant.owner_name,
        assistant_name: (assistant.assistant_name || 'PAI') + ' Assistant',
        system_prompt: null, // Will use prompts/pai_assistant.md
        summary_settings: assistant.summary_settings || {
          defaultTimeframe: 24,
          format: 'chronological',
          includeCategories: ['personal', 'business', 'support', 'sales', 'inquiry'],
          includePriorities: ['urgent', 'high', 'medium', 'low'],
          showActionItems: true,
          showAssistantActivity: false,
          maxMessagesPerSummary: 100,
        },
        query_settings: {
          defaultLimit: 50,
          maxLimit: 200,
          enableTimeframeFallback: true,
          defaultSearchDepth: 'week',
        },
        last_summary_requested_at: assistant.last_summary_requested_at,
        queries_processed: 0,
        last_activity: assistant.last_activity,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key columns from messages
    await queryInterface.removeColumn('messages', 'pai_responder_id');
    await queryInterface.removeColumn('messages', 'pai_assistant_id');

    // Drop new tables
    await queryInterface.dropTable('pai_assistants');
    await queryInterface.dropTable('pai_responders');
  }
};
