const { Op } = require('sequelize');
const logger = require('../utils/logger');

class QueryBuilder {
  constructor() {
    // Define mapping between entities and database fields
    this.fieldMappings = {
      message_type: 'messageType',
      sender: 'sender',
      content: 'content',
      created_at: 'createdAt',
    };
  }

  /**
   * Build a Sequelize query from extracted entities
   * @param {string} intent - The extracted intent
   * @param {object} entities - The extracted entities
   * @param {string} originalMessage - The original user message (for fallback detection)
   * @returns {object} Sequelize query configuration
   */
  buildQuery(intent, entities, originalMessage = '') {
    logger.debug('Building database query', {
      intent,
      entities,
      timestamp: new Date().toISOString(),
    });

    const query = {
      where: {},
      include: [],
      order: [['createdAt', 'DESC']],
      limit: 50, // Default limit
    };

    try {
      // Apply fallback logic for AI misinterpretation of "today"
      const correctedEntities = this.correctTimeframeMisinterpretation(entities, originalMessage);
      
      // Build WHERE clause based on entities
      this.addTimeframeFilter(query, correctedEntities.timeframe);
      this.addSenderFilter(query, entities.sender);
      this.addContentFilter(query, entities.content_filter);
      this.addMessageTypeFilter(query, entities.message_type);
      this.addPriorityFilter(query, entities.priority);

      // Add include relationships based on intent
      this.addIncludes(query, intent);

      // Create a serializable version of the where clause for logging
      const loggableWhere = Object.keys(query.where).reduce((acc, key) => {
        const value = query.where[key];
        if (key === 'createdAt' && (value[Op.gte] || value[Op.lte])) {
          acc[key] = { 
            gte: value[Op.gte]?.toISOString(),
            lte: value[Op.lte]?.toISOString()
          };
        } else if (key === 'conversationId' && value[Op.ne]) {
          acc[key] = { ne: value[Op.ne] };
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});

      logger.info('Query built successfully', {
        intent,
        whereClause: JSON.stringify(loggableWhere),
        rawWhere: JSON.stringify(query.where),
        includeCount: query.include.length,
        limit: query.limit,
      });

      return query;
    } catch (error) {
      logger.error('Failed to build query', {
        intent,
        entities,
        error: error.message,
        stack: error.stack,
      });

      // Return default query on error
      return {
        where: {},
        include: this.getDefaultIncludes(),
        order: [['createdAt', 'DESC']],
        limit: 10,
      };
    }
  }

  /**
   * Add timeframe filter to query
   */
  addTimeframeFilter(query, timeframe) {
    if (!timeframe || !timeframe.value) return;

    const now = new Date();
    const startDate = new Date();

    switch (timeframe.unit) {
      case 'minutes':
        startDate.setMinutes(now.getMinutes() - timeframe.value);
        break;
      case 'hours':
        startDate.setHours(now.getHours() - timeframe.value);
        break;
      case 'days':
        if (timeframe.relative === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate.setDate(now.getDate() - timeframe.value);
        }
        break;
      case 'weeks':
        startDate.setDate(now.getDate() - (timeframe.value * 7));
        break;
      default:
        startDate.setHours(now.getHours() - 24); // Default to 24 hours
    }

    query.where.createdAt = {
      [Op.gte]: startDate,
      [Op.lte]: now,
    };

    logger.debug('Added timeframe filter', {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      timeframe,
      dateRange: `${startDate.toISOString()} to ${now.toISOString()}`,
      whereClauseAfterAdd: JSON.stringify(query.where),
    });
  }

  /**
   * Add sender filter to query
   */
  addSenderFilter(query, sender) {
    if (!sender) return;

    if (sender.type === 'assistant') {
      query.where.sender = 'assistant';
    } else if (sender.type === 'user') {
      query.where.sender = 'user';
    } else if (sender.name) {
      // Filter by contact name (requires join)
      query.include.push({
        model: require('../models').Contact,
        as: 'contact',
        where: {
          name: { [Op.iLike]: `%${sender.name}%` },
        },
        attributes: ['id', 'name', 'phone', 'isGroup'],
      });
    }

    logger.debug('Added sender filter', { sender });
  }

  /**
   * Add content filter to query
   */
  addContentFilter(query, contentFilter) {
    if (!contentFilter || (!contentFilter.keywords?.length && !contentFilter.exclude?.length)) return;

    const contentConditions = [];

    if (contentFilter.keywords?.length) {
      const keywordConditions = contentFilter.keywords.map((keyword) => ({
        content: { [Op.iLike]: `%${keyword}%` },
      }));
      contentConditions.push({ [Op.or]: keywordConditions });
    }

    if (contentFilter.exclude?.length) {
      const excludeConditions = contentFilter.exclude.map((keyword) => ({
        content: { [Op.notILike]: `%${keyword}%` },
      }));
      contentConditions.push(...excludeConditions);
    }

    if (contentConditions.length > 0) {
      query.where[Op.and] = query.where[Op.and] || [];
      query.where[Op.and].push(...contentConditions);
    }

    logger.debug('Added content filter', { contentFilter });
  }

  /**
   * Add message type filter to query
   */
  addMessageTypeFilter(query, messageTypes) {
    if (!messageTypes || !Array.isArray(messageTypes) || messageTypes.length === 0) return;

    query.where.messageType = {
      [Op.in]: messageTypes,
    };

    logger.debug('Added message type filter', { messageTypes });
  }

  /**
   * Add priority filter to query (for conversations)
   */
  addPriorityFilter(query, priority) {
    if (!priority || !Array.isArray(priority) || priority.length === 0) return;

    // This applies to conversation-level queries
    query.include.push({
      model: require('../models').Conversation,
      as: 'conversation',
      where: {
        priority: { [Op.in]: priority },
      },
      attributes: ['id', 'priority', 'status', 'category'],
    });

    logger.debug('Added priority filter', { priority });
  }

  /**
   * Add appropriate includes based on intent
   */
  addIncludes(query, intent) {
    const defaultIncludes = this.getDefaultIncludes();

    // Always include contact info unless already added
    const hasContactInclude = query.include.some((inc) => inc.model === require('../models').Contact || inc.as === 'contact');

    if (!hasContactInclude) {
      query.include.push(defaultIncludes.find((inc) => inc.as === 'contact'));
    }

    // Add conversation include for certain intents
    if (['conversation_query', 'summary'].includes(intent)) {
      const hasConversationInclude = query.include.some((inc) => inc.model === require('../models').Conversation || inc.as === 'conversation');

      if (!hasConversationInclude) {
        query.include.push(defaultIncludes.find((inc) => inc.as === 'conversation'));
      }
    }

    logger.debug('Added includes for intent', {
      intent,
      includeCount: query.include.length,
    });
  }

  /**
   * Get default includes for message queries
   */
  getDefaultIncludes() {
    return [
      {
        model: require('../models').Contact,
        as: 'contact',
        attributes: ['id', 'name', 'phone', 'profilePicture', 'isGroup'],
      },
      {
        model: require('../models').Conversation,
        as: 'conversation',
        attributes: ['id', 'priority', 'status', 'category'],
        include: [{
          model: require('../models').Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'isGroup'],
        }],
      },
    ];
  }

  /**
   * Build query for contact search
   */
  buildContactQuery(entities) {
    const query = {
      where: {},
      order: [['lastSeen', 'DESC']],
      limit: 20,
    };

    if (entities.name) {
      query.where.name = { [Op.iLike]: `%${entities.name}%` };
    }

    if (entities.group !== undefined) {
      query.where.isGroup = entities.group;
    }

    return query;
  }

  /**
   * Build query for conversation search
   */
  buildConversationQuery(entities) {
    const query = {
      where: {},
      include: [{
        model: require('../models').Contact,
        as: 'contact',
        attributes: ['id', 'name', 'phone', 'isGroup'],
      }],
      order: [['lastMessageAt', 'DESC']],
      limit: 20,
    };

    if (entities.priority?.length) {
      query.where.priority = { [Op.in]: entities.priority };
    }

    if (entities.status) {
      query.where.status = entities.status;
    }

    return query;
  }

  /**
   * Validate query entities
   */
  validateEntities(entities) {
    const errors = [];

    if (entities.timeframe && entities.timeframe.value && entities.timeframe.value < 0) {
      errors.push('Timeframe value cannot be negative');
    }

    if (entities.message_type?.length) {
      const validTypes = ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction', 'system'];
      const invalidTypes = entities.message_type.filter((type) => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid message types: ${invalidTypes.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Correct AI misinterpretation of timeframe entities
   * @param {object} entities - The extracted entities
   * @param {string} originalMessage - The original user message
   * @returns {object} Corrected entities
   */
  correctTimeframeMisinterpretation(entities, originalMessage) {
    if (!entities.timeframe || !originalMessage) {
      return entities;
    }

    const correctedEntities = { ...entities };
    const timeframe = entities.timeframe;
    const lowerMessage = originalMessage.toLowerCase();

    // Detect AI misinterpretation: "today" parsed as {"relative":"past","unit":"days","value":1}
    if (
      timeframe.relative === 'past' &&
      timeframe.unit === 'days' &&
      timeframe.value === 1 &&
      (lowerMessage.includes('today') || lowerMessage.includes('hoy'))
    ) {
      logger.info('Detected AI misinterpretation: "today" parsed as past 1 day, correcting', {
        originalTimeframe: timeframe,
        originalMessage,
      });

      correctedEntities.timeframe = {
        ...timeframe,
        relative: 'today',
        value: 0,
      };

      logger.info('Corrected timeframe entity', {
        correctedTimeframe: correctedEntities.timeframe,
      });
    }

    // Detect similar misinterpretation for "yesterday"
    if (
      timeframe.relative === 'past' &&
      timeframe.unit === 'days' &&
      timeframe.value === 1 &&
      (lowerMessage.includes('yesterday') || lowerMessage.includes('ayer'))
    ) {
      logger.info('Detected AI misinterpretation: "yesterday" parsed as past 1 day, correcting', {
        originalTimeframe: timeframe,
        originalMessage,
      });

      correctedEntities.timeframe = {
        ...timeframe,
        relative: 'yesterday',
        value: 1,
      };

      logger.info('Corrected timeframe entity for yesterday', {
        correctedTimeframe: correctedEntities.timeframe,
      });
    }

    return correctedEntities;
  }
}

// Export singleton instance
module.exports = new QueryBuilder();
