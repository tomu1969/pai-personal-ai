const {
  Contact, Conversation, Message, sequelize,
} = require('../../models');
const logger = require('../../utils/logger');
const filterService = require('./filters');
const aiService = require('../ai/assistantAI');

class ConversationService {
  /**
   * Find or create contact based on phone number
   * @param {string} phone - Phone number
   * @param {object} additionalInfo - Additional contact information
   * @returns {Promise<Contact>} Contact instance
   */
  async findOrCreateContact(phone, additionalInfo = {}) {
    try {
      // Determine if it's a group based on phone number pattern
      const isGroup = additionalInfo.isGroup !== undefined
        ? additionalInfo.isGroup
        : phone.includes('@g.us');

      const [contact, created] = await Contact.findOrCreate({
        where: { phone },
        defaults: {
          phone,
          name: additionalInfo.name || null,
          profilePicture: additionalInfo.profilePicture || null,
          category: 'unknown',
          priority: 'medium',
          isGroup,
          metadata: additionalInfo.metadata || {},
        },
      });

      if (created) {
        logger.info('New contact created', {
          contactId: contact.id,
          phone: contact.phone,
          name: contact.name,
          isGroup,
        });
      } else {
        // Update contact with new information if available
        const updates = {};
        if (additionalInfo.name && !contact.name) {
          updates.name = additionalInfo.name;
        }
        if (additionalInfo.isGroup !== undefined && contact.isGroup !== additionalInfo.isGroup) {
          updates.isGroup = additionalInfo.isGroup;
        }
        updates.lastSeen = new Date();

        if (Object.keys(updates).length > 1) { // More than just lastSeen
          await contact.update(updates);
        }
      }

      return contact;
    } catch (error) {
      logger.error('Failed to find or create contact', {
        phone,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find or create conversation for a contact
   * @param {string} contactId - Contact ID
   * @param {object} messageAnalysis - Analysis of the triggering message
   * @returns {Promise<Conversation>} Conversation instance
   */
  async findOrCreateConversation(contactId, messageAnalysis = {}) {
    try {
      // Look for an active conversation first
      let conversation = await Conversation.findOne({
        where: {
          contactId,
          status: ['active', 'waiting'],
        },
        order: [['lastMessageAt', 'DESC']],
      });

      if (!conversation) {
        // Create new conversation
        conversation = await Conversation.create({
          contactId,
          status: 'active',
          priority: messageAnalysis.priority || 'medium',
          category: this.mapCategoryToConversationEnum(messageAnalysis.category) || 'other',
          context: {
            analysis: messageAnalysis,
            createdBy: 'assistant',
          },
          lastMessageAt: new Date(),
          messageCount: 0,
        });

        logger.info('New conversation created', {
          conversationId: conversation.id,
          contactId,
          priority: conversation.priority,
          category: conversation.category,
        });
      } else {
        // Update existing conversation with new message context
        await conversation.update({
          lastMessageAt: new Date(),
          priority: this.updatePriority(conversation.priority, messageAnalysis.priority),
          context: {
            ...conversation.context,
            lastAnalysis: messageAnalysis,
          },
        });
      }

      return conversation;
    } catch (error) {
      logger.error('Failed to find or create conversation', {
        contactId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Save incoming message to database
   * @param {object} messageData - Parsed message data from webhook
   * @param {string} contactId - Contact ID
   * @param {string} conversationId - Conversation ID
   * @param {object} analysis - Message analysis results
   * @returns {Promise<Message>} Created message instance
   */
  async saveMessage(messageData, contactId, conversationId, analysis = {}) {
    try {
      const message = await Message.create({
        conversationId,
        contactId,
        evolutionMessageId: messageData.messageId,
        messageType: this.mapMessageType(messageData.messageType),
        sender: 'user',
        content: messageData.content,
        mediaUrl: messageData.mediaUrl,
        mediaType: messageData.mediaType,
        metadata: {
          pushName: messageData.pushName,
          timestamp: messageData.timestamp,
          analysis,
          whatsappKey: messageData.key,
        },
        sentAt: new Date(messageData.timestamp * 1000),
      });

      // Update conversation message count and last activity
      await Conversation.update(
        {
          messageCount: require('sequelize').literal('message_count + 1'),
          lastMessageAt: new Date(messageData.timestamp * 1000),
        },
        { where: { id: conversationId } },
      );

      logger.info('Message saved to database', {
        messageId: message.id,
        conversationId,
        contactId,
        messageType: message.messageType,
        contentLength: message.content.length,
      });

      return message;
    } catch (error) {
      logger.error('Failed to save message', {
        messageId: messageData.messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Save assistant response to database
   * @param {string} conversationId - Conversation ID
   * @param {string} contactId - Contact ID
   * @param {string} responseContent - Response content
   * @param {object} metadata - Additional metadata
   * @returns {Promise<Message>} Created message instance
   */
  async saveAssistantMessage(conversationId, contactId, responseContent, metadata = {}) {
    try {
      const message = await Message.create({
        conversationId,
        contactId,
        messageType: 'text',
        sender: 'assistant',
        content: responseContent,
        metadata: {
          ...metadata,
          autoGenerated: true,
          timestamp: Date.now(),
        },
        sentAt: new Date(),
      });

      // Update conversation message count and last activity
      await Conversation.update(
        {
          messageCount: require('sequelize').literal('message_count + 1'),
          lastMessageAt: new Date(),
        },
        { where: { id: conversationId } },
      );

      logger.info('Assistant message saved', {
        messageId: message.id,
        conversationId,
        responseLength: responseContent.length,
      });

      return message;
    } catch (error) {
      logger.error('Failed to save assistant message', {
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get conversation history with messages
   * @param {string} conversationId - Conversation ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Conversation with messages
   */
  async getConversationHistory(conversationId, options = {}) {
    try {
      const { limit = 50, offset = 0, includeDeleted = false } = options;

      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'phone', 'name', 'category', 'priority'],
          },
          {
            model: Message,
            as: 'messages',
            where: includeDeleted ? {} : { isDeleted: false },
            order: [['sentAt', 'ASC']],
            limit,
            offset,
            attributes: {
              exclude: ['metadata'], // Exclude large metadata field by default
            },
          },
        ],
      });

      if (!conversation) {
        return null;
      }

      return {
        conversation: conversation.toJSON(),
        messageCount: await Message.count({
          where: {
            conversationId,
            isDeleted: includeDeleted ? [true, false] : false,
          },
        }),
      };
    } catch (error) {
      logger.error('Failed to get conversation history', {
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update conversation status and summary
   * @param {string} conversationId - Conversation ID
   * @param {object} updates - Update data
   * @returns {Promise<Conversation>} Updated conversation
   */
  async updateConversation(conversationId, updates = {}) {
    try {
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const allowedUpdates = {
        status: updates.status,
        priority: updates.priority,
        category: updates.category,
        summary: updates.summary,
        tags: updates.tags,
        isAssistantEnabled: updates.isAssistantEnabled,
      };

      // Remove undefined values
      Object.keys(allowedUpdates).forEach((key) => {
        if (allowedUpdates[key] === undefined) {
          delete allowedUpdates[key];
        }
      });

      // Set resolved date if status is being changed to resolved
      if (updates.status === 'resolved' && conversation.status !== 'resolved') {
        allowedUpdates.resolvedAt = new Date();
      }

      await conversation.update(allowedUpdates);

      logger.info('Conversation updated', {
        conversationId,
        updates: Object.keys(allowedUpdates),
      });

      return conversation;
    } catch (error) {
      logger.error('Failed to update conversation', {
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate and update conversation summary using AI
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<string>} Generated summary
   */
  async generateConversationSummary(conversationId) {
    try {
      const conversationData = await this.getConversationHistory(conversationId, {
        limit: 50,
      });

      if (!conversationData?.conversation?.messages?.length) {
        return null;
      }

      const { conversation, messages } = conversationData.conversation;

      // Generate AI summary if available
      let summary = null;
      if (aiService.isEnabled()) {
        summary = await aiService.summarizeConversation(messages, {
          contactName: conversation.contact?.name,
          category: conversation.category,
          priority: conversation.priority,
        });
      }

      // Fallback to basic summary if AI not available
      if (!summary) {
        summary = this.generateBasicSummary(messages, conversation);
      }

      // Update conversation with summary
      await this.updateConversation(conversationId, { summary });

      logger.info('Conversation summary generated', {
        conversationId,
        summaryLength: summary?.length || 0,
        messageCount: messages.length,
        aiGenerated: !!summary,
      });

      return summary;
    } catch (error) {
      logger.error('Failed to generate conversation summary', {
        conversationId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get active conversations for dashboard
   * @param {object} filters - Filter criteria
   * @param {object} pagination - Pagination options
   * @returns {Promise<object>} Conversations list with metadata
   */
  async getActiveConversations(filters = {}, pagination = {}) {
    try {
      const { limit = 20, offset = 0 } = pagination;
      const whereClause = { ...filters };

      const { count, rows } = await Conversation.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'phone', 'name', 'category', 'priority', 'lastSeen'],
          },
        ],
        order: [['lastMessageAt', 'DESC']],
        limit,
        offset,
        attributes: {
          exclude: ['context'], // Exclude large context field
        },
      });

      return {
        conversations: rows,
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      };
    } catch (error) {
      logger.error('Failed to get active conversations', {
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get conversation statistics
   * @param {string} timeRange - Time range for statistics
   * @returns {Promise<object>} Statistics data
   */
  async getConversationStats(timeRange = '24h') {
    try {
      let timeFilter;
      const now = new Date();

      switch (timeRange) {
        case '1h':
          timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const [
        totalConversations,
        activeConversations,
        resolvedConversations,
        totalMessages,
        uniqueContacts,
      ] = await Promise.all([
        Conversation.count({
          where: {
            createdAt: { [sequelize.Op.gte]: timeFilter },
          },
        }),
        Conversation.count({
          where: {
            status: ['active', 'waiting'],
          },
        }),
        Conversation.count({
          where: {
            resolvedAt: { [sequelize.Op.gte]: timeFilter },
          },
        }),
        Message.count({
          where: {
            createdAt: { [sequelize.Op.gte]: timeFilter },
          },
        }),
        Contact.count({
          distinct: true,
          include: [{
            model: Message,
            as: 'messages',
            where: {
              createdAt: { [sequelize.Op.gte]: timeFilter },
            },
          }],
        }),
      ]);

      return {
        timeRange,
        totalConversations,
        activeConversations,
        resolvedConversations,
        totalMessages,
        uniqueContacts,
        averageMessagesPerConversation: totalConversations > 0
          ? (totalMessages / totalConversations).toFixed(2)
          : 0,
        resolutionRate: totalConversations > 0
          ? ((resolvedConversations / totalConversations) * 100).toFixed(2)
          : 0,
      };
    } catch (error) {
      logger.error('Failed to get conversation statistics', {
        timeRange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Archive old resolved conversations
   * @param {number} daysOld - Days since resolution
   * @returns {Promise<number>} Number of archived conversations
   */
  async archiveOldConversations(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const [updatedCount] = await Conversation.update(
        { status: 'archived' },
        {
          where: {
            status: 'resolved',
            resolvedAt: { [sequelize.Op.lte]: cutoffDate },
          },
        },
      );

      if (updatedCount > 0) {
        logger.info('Conversations archived', {
          count: updatedCount,
          cutoffDate,
        });
      }

      return updatedCount;
    } catch (error) {
      logger.error('Failed to archive old conversations', {
        daysOld,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Helper: Update conversation priority based on new message analysis
   */
  updatePriority(currentPriority, newPriority) {
    const priorityLevels = {
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4,
    };

    const currentLevel = priorityLevels[currentPriority] || 2;
    const newLevel = priorityLevels[newPriority] || 2;

    // Use higher priority
    const maxLevel = Math.max(currentLevel, newLevel);
    return Object.keys(priorityLevels).find((key) => priorityLevels[key] === maxLevel) || 'medium';
  }

  /**
   * Helper: Map WhatsApp message type to our message type
   */
  mapMessageType(whatsappType) {
    const typeMap = {
      conversation: 'text',
      extendedTextMessage: 'text',
      imageMessage: 'image',
      audioMessage: 'audio',
      videoMessage: 'video',
      documentMessage: 'document',
      stickerMessage: 'sticker',
      locationMessage: 'location',
      contactMessage: 'contact',
      reactionMessage: 'reaction',
    };

    return typeMap[whatsappType] || 'text';
  }

  /**
   * Helper: Generate basic summary without AI
   */
  generateBasicSummary(messages, conversation) {
    if (!messages.length) return 'No messages in conversation';

    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.sender === 'user');
    const assistantMessages = messages.filter((m) => m.sender === 'assistant');

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return `Conversation with ${conversation.contact?.name || 'Unknown Contact'}. `
           + `${messageCount} total messages (${userMessages.length} from user, ${assistantMessages.length} from assistant). `
           + `Category: ${conversation.category}, Priority: ${conversation.priority}. `
           + `Started: ${firstMessage.sentAt}, Last activity: ${lastMessage.sentAt}.`;
  }

  /**
   * Map AI analysis category to conversation enum values
   */
  mapCategoryToConversationEnum(analysisCategory) {
    const categoryMap = {
      business: 'sales', // Map business -> sales (allowed enum)
      sales: 'sales',
      support: 'support',
      personal: 'personal',
      spam: 'spam',
      inquiry: 'inquiry',
    };

    return categoryMap[analysisCategory] || 'other';
  }
}

// Export singleton instance
module.exports = new ConversationService();
