'use strict';

/**
 * CS Message Cache Migration
 * Creates table to locally cache messages fetched from WhatsApp groups
 * for CS ticket processing when Evolution database is empty
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cs_message_cache', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      
      // Message identification
      message_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Unique message identifier from WhatsApp/Evolution'
      },
      
      message_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 hash of message content for deduplication'
      },
      
      // Group information
      group_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'WhatsApp group ID (remoteJid)'
      },
      
      group_name: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'WhatsApp group name'
      },
      
      // Sender information
      sender_jid: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Sender WhatsApp JID'
      },
      
      sender_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Sender display name'
      },
      
      // Message content
      text_content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Message text content'
      },
      
      message_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'text',
        comment: 'Type of message: text, image, audio, video, document, etc.'
      },
      
      // Message metadata
      message_timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the message was originally sent'
      },
      
      is_from_me: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this message was sent by the bot/instance'
      },
      
      // Processing status
      processed_for_tickets: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this message has been processed for CS tickets'
      },
      
      ticket_detected: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether a CS ticket was detected in this message'
      },
      
      // Cache metadata
      sync_method: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'How this message was fetched: database, force_sync, etc.'
      },
      
      evolution_endpoint: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Evolution API endpoint used to fetch this message'
      },
      
      instance_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'cs-monitor',
        comment: 'Evolution instance ID used to fetch this message'
      },
      
      // Raw data storage
      raw_data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Raw message data from Evolution API (JSONB for PostgreSQL)'
      },
      
      // Standard timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'When this cache entry was created'
      },
      
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'When this cache entry was last updated'
      }
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('cs_message_cache', ['group_id'], {
      name: 'idx_cs_message_cache_group_id'
    });
    
    await queryInterface.addIndex('cs_message_cache', ['message_timestamp'], {
      name: 'idx_cs_message_cache_timestamp'
    });
    
    await queryInterface.addIndex('cs_message_cache', ['processed_for_tickets'], {
      name: 'idx_cs_message_cache_processed'
    });
    
    await queryInterface.addIndex('cs_message_cache', ['group_id', 'message_timestamp'], {
      name: 'idx_cs_message_cache_group_time'
    });
    
    await queryInterface.addIndex('cs_message_cache', ['group_id', 'processed_for_tickets'], {
      name: 'idx_cs_message_cache_group_processed'
    });

    // Create full-text search index on message content
    await queryInterface.addIndex('cs_message_cache', ['text_content'], {
      name: 'idx_cs_message_cache_text_search',
      using: 'GIN',
      operator: 'gin_trgm_ops'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cs_message_cache');
  }
};