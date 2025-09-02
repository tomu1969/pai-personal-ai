module.exports = {
  async up(queryInterface, Sequelize) {
    // Create assistants table
    await queryInterface.createTable('assistants', {
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
      auto_response_template: {
        type: Sequelize.TEXT,
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
      settings: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create contacts table
    await queryInterface.createTable('contacts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      profile_picture: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_blocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM('personal', 'business', 'spam', 'unknown'),
        defaultValue: 'unknown',
        allowNull: false,
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for contacts
    await queryInterface.addIndex('contacts', ['phone'], { unique: true });
    await queryInterface.addIndex('contacts', ['category']);
    await queryInterface.addIndex('contacts', ['priority']);

    // Create conversations table
    await queryInterface.createTable('conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      contact_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'contacts',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      assistant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'assistants',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('active', 'waiting', 'resolved', 'escalated', 'archived'),
        defaultValue: 'active',
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM('inquiry', 'support', 'sales', 'personal', 'spam', 'other'),
        defaultValue: 'other',
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      context: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      message_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      is_assistant_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for conversations
    await queryInterface.addIndex('conversations', ['contact_id']);
    await queryInterface.addIndex('conversations', ['status']);
    await queryInterface.addIndex('conversations', ['priority']);
    await queryInterface.addIndex('conversations', ['category']);
    await queryInterface.addIndex('conversations', ['last_message_at']);

    // Create messages table
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'conversations',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      contact_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'contacts',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      evolution_message_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      message_type: {
        type: Sequelize.ENUM(
          'text',
          'image',
          'audio',
          'video',
          'document',
          'sticker',
          'location',
          'contact',
          'reaction',
          'system',
        ),
        defaultValue: 'text',
        allowNull: false,
      },
      sender: {
        type: Sequelize.ENUM('user', 'assistant', 'system'),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      media_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      media_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      error: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for messages
    await queryInterface.addIndex('messages', ['conversation_id']);
    await queryInterface.addIndex('messages', ['contact_id']);
    await queryInterface.addIndex('messages', ['sender']);
    await queryInterface.addIndex('messages', ['message_type']);
    await queryInterface.addIndex('messages', ['sent_at']);
    await queryInterface.addIndex('messages', ['is_read']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('conversations');
    await queryInterface.dropTable('contacts');
    await queryInterface.dropTable('assistants');
  },
};