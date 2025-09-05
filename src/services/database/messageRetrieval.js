const { Message, Contact, Conversation } = require('../models');
const logger = require('../utils/logger');
const queryBuilder = require('./queryBuilder');

class MessageRetrievalService {
  constructor() {
    this.defaultLimit = 50;
    this.maxLimit = 200;
  }

  /**
   * Retrieve messages based on extracted entities
   * @param {string} intent - The user's intent
   * @param {object} entities - Extracted entities from AI
   * @param {object} context - Additional context (user, conversation, etc.)
   * @param {string} originalMessage - Original user message for fallback detection
   * @returns {Promise<object>} Retrieved messages with metadata
   */
  async retrieveMessages(intent, entities, context = {}, originalMessage = '') {
    logger.info('Retrieving messages', {
      intent,
      entities: JSON.stringify(entities),
      context,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate entities
      const validationErrors = queryBuilder.validateEntities(entities);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Invalid query parameters',
          details: validationErrors,
          messages: [],
          metadata: {},
        };
      }

      let result;

      switch (intent) {
        case 'message_query':
          result = await this.handleMessageQuery(entities, context, originalMessage);
          break;
        case 'contact_query':
          result = await this.handleContactQuery(entities, context, originalMessage);
          break;
        case 'conversation_query':
          result = await this.handleConversationQuery(entities, context, originalMessage);
          break;
        case 'summary':
          result = await this.handleSummaryQuery(entities, context, originalMessage);
          break;
        default:
          result = await this.handleDefaultQuery(entities, context, originalMessage);
      }

      logger.info('Messages retrieved successfully', {
        intent,
        messageCount: result.messages?.length || 0,
        hasMetadata: !!result.metadata,
      });

      return result;
    } catch (error) {
      logger.error('Failed to retrieve messages', {
        intent,
        entities,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: 'Failed to retrieve messages',
        details: error.message,
        messages: [],
        metadata: {},
      };
    }
  }

  /**
   * Handle message query intent
   */
  async handleMessageQuery(entities, context, originalMessage = '') {
    const query = queryBuilder.buildQuery('message_query', entities, originalMessage);

    // Exclude assistant conversation messages unless specifically requested
    if (!context.includeAssistantMessages) {
      query.where.conversationId = {
        [require('sequelize').Op.ne]: '00000000-0000-0000-0000-000000000001',
      };
    }

    // Enhanced ordering for conversation grouping - first by contact, then by time
    query.order = [
      [{ model: Contact, as: 'contact' }, 'name', 'ASC'],
      ['createdAt', 'ASC']
    ];

    const messages = await Message.findAll(query);

    const metadata = {
      query_type: 'message_search',
      total_count: messages.length,
      timeframe: entities.timeframe,
      filters_applied: this.getAppliedFilters(entities),
      search_timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      messages: this.formatMessages(messages),
      metadata,
      query_info: {
        intent: 'message_query',
        entities,
        sql_summary: this.summarizeQuery(query),
      },
    };
  }

  /**
   * Handle contact query intent
   */
  async handleContactQuery(entities, context, originalMessage = '') {
    const query = queryBuilder.buildContactQuery(entities);
    const contacts = await Contact.findAll(query);

    // If looking for recent contacts, also get their recent messages
    let recentMessages = [];
    if (entities.timeframe && contacts.length > 0) {
      const contactIds = contacts.map((c) => c.id);
      const messageQuery = {
        where: {
          contactId: { [require('sequelize').Op.in]: contactIds },
        },
        include: [{
          model: Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'isGroup'],
        }],
        order: [['createdAt', 'DESC']],
        limit: 20,
      };

      if (entities.timeframe) {
        queryBuilder.addTimeframeFilter(messageQuery, entities.timeframe);
      }

      recentMessages = await Message.findAll(messageQuery);
    }

    return {
      success: true,
      contacts: this.formatContacts(contacts),
      messages: this.formatMessages(recentMessages),
      metadata: {
        query_type: 'contact_search',
        contact_count: contacts.length,
        message_count: recentMessages.length,
        search_timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle conversation query intent
   */
  async handleConversationQuery(entities, context, originalMessage = '') {
    const query = queryBuilder.buildConversationQuery(entities);
    const conversations = await Conversation.findAll(query);

    return {
      success: true,
      conversations: this.formatConversations(conversations),
      metadata: {
        query_type: 'conversation_search',
        conversation_count: conversations.length,
        search_timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle summary query intent
   */
  async handleSummaryQuery(entities, context, originalMessage = '') {
    const messageQuery = queryBuilder.buildQuery('summary', entities, originalMessage);

    // Exclude assistant conversation for summaries
    messageQuery.where.conversationId = {
      [require('sequelize').Op.ne]: '00000000-0000-0000-0000-000000000001',
    };

    // Enhanced ordering for conversation grouping - first by contact, then by time
    messageQuery.order = [
      [{ model: Contact, as: 'contact' }, 'name', 'ASC'],
      ['createdAt', 'ASC']
    ];

    const messages = await Message.findAll(messageQuery);

    // Generate summary statistics
    const summary = await this.generateMessageSummary(messages, entities);

    return {
      success: true,
      messages: this.formatMessages(messages),
      summary,
      metadata: {
        query_type: 'summary',
        message_count: messages.length,
        timeframe: entities.timeframe,
        search_timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle default/fallback query
   */
  async handleDefaultQuery(entities, context, originalMessage = '') {
    const query = {
      where: {},
      include: queryBuilder.getDefaultIncludes(),
      order: [['createdAt', 'DESC']],
      limit: 20,
    };

    // Add basic timeframe if available
    if (entities.timeframe) {
      queryBuilder.addTimeframeFilter(query, entities.timeframe);
    }

    const messages = await Message.findAll(query);

    return {
      success: true,
      messages: this.formatMessages(messages),
      metadata: {
        query_type: 'default',
        message_count: messages.length,
        search_timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format messages for AI consumption
   */
  formatMessages(messages) {
    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      messageType: msg.messageType,
      createdAt: msg.createdAt,
      contact: msg.contact ? {
        id: msg.contact.id,
        name: msg.contact.name,
        phone: msg.contact.phone,
        isGroup: msg.contact.isGroup,
      } : null,
      conversation: msg.conversation ? {
        id: msg.conversation.id,
        priority: msg.conversation.priority,
        status: msg.conversation.status,
        category: msg.conversation.category,
      } : null,
    }));
  }

  /**
   * Format contacts for AI consumption
   */
  formatContacts(contacts) {
    return contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      isGroup: contact.isGroup,
      lastSeen: contact.lastSeen,
      priority: contact.priority,
      category: contact.category,
    }));
  }

  /**
   * Format conversations for AI consumption
   */
  formatConversations(conversations) {
    return conversations.map((conv) => ({
      id: conv.id,
      priority: conv.priority,
      status: conv.status,
      category: conv.category,
      messageCount: conv.messageCount,
      lastMessageAt: conv.lastMessageAt,
      contact: conv.contact ? {
        id: conv.contact.id,
        name: conv.contact.name,
        phone: conv.contact.phone,
        isGroup: conv.contact.isGroup,
      } : null,
    }));
  }

  /**
   * Generate summary statistics from messages
   */
  async generateMessageSummary(messages, entities) {
    const summary = {
      total_messages: messages.length,
      by_sender: { user: 0, assistant: 0, system: 0 },
      by_type: {},
      by_contact: {},
      by_priority: {
        urgent: 0, high: 0, medium: 0, low: 0,
      },
      time_range: {
        oldest: null,
        newest: null,
        timeframe: entities.timeframe,
      },
      unique_contacts: new Set(),
      group_messages: 0,
      individual_messages: 0,
    };

    messages.forEach((msg) => {
      // Count by sender
      summary.by_sender[msg.sender] = (summary.by_sender[msg.sender] || 0) + 1;

      // Count by type
      summary.by_type[msg.messageType] = (summary.by_type[msg.messageType] || 0) + 1;

      // Count by contact
      if (msg.contact) {
        const contactKey = `${msg.contact.name} (${msg.contact.phone})`;
        summary.by_contact[contactKey] = (summary.by_contact[contactKey] || 0) + 1;
        summary.unique_contacts.add(msg.contact.id);

        if (msg.contact.isGroup) {
          summary.group_messages++;
        } else {
          summary.individual_messages++;
        }
      }

      // Count by priority (if available)
      if (msg.conversation?.priority) {
        summary.by_priority[msg.conversation.priority]++;
      }

      // Track time range
      if (!summary.time_range.oldest || msg.createdAt < summary.time_range.oldest) {
        summary.time_range.oldest = msg.createdAt;
      }
      if (!summary.time_range.newest || msg.createdAt > summary.time_range.newest) {
        summary.time_range.newest = msg.createdAt;
      }
    });

    // Convert Set to count
    summary.unique_contact_count = summary.unique_contacts.size;
    delete summary.unique_contacts;

    return summary;
  }

  /**
   * Get list of applied filters
   */
  getAppliedFilters(entities) {
    const filters = [];

    if (entities.timeframe) filters.push('timeframe');
    if (entities.sender) filters.push('sender');
    if (entities.content_filter) filters.push('content');
    if (entities.message_type?.length) filters.push('message_type');
    if (entities.priority?.length) filters.push('priority');

    return filters;
  }

  /**
   * Summarize query for debugging
   */
  summarizeQuery(query) {
    return {
      has_where: Object.keys(query.where || {}).length > 0,
      include_count: query.include?.length || 0,
      has_order: !!query.order,
      limit: query.limit || 'default',
    };
  }

  /**
   * Get query statistics for analysis
   */
  async getQueryStats(intent, entities) {
    try {
      const query = queryBuilder.buildQuery(intent, entities);
      const count = await Message.count({ where: query.where });

      return {
        estimated_results: count,
        query_complexity: this.calculateQueryComplexity(query),
        performance_hint: count > 1000 ? 'Consider adding more specific filters' : 'Query should perform well',
      };
    } catch (error) {
      logger.error('Failed to get query stats', { error: error.message });
      return { error: 'Could not estimate query performance' };
    }
  }

  /**
   * Calculate query complexity score
   */
  calculateQueryComplexity(query) {
    let complexity = 0;

    complexity += Object.keys(query.where || {}).length * 2;
    complexity += (query.include?.length || 0) * 3;
    complexity += query.limit > 100 ? 2 : 1;

    return Math.min(complexity, 10); // Max complexity of 10
  }
}

// Export singleton instance
module.exports = new MessageRetrievalService();
