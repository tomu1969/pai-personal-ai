const { Message, Contact, Conversation } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class MessageSearchService {
  constructor() {
    this.defaultLimit = 50;
    this.maxLimit = 200;
  }

  /**
   * Search messages with simplified parameters
   * @param {object} params - Search parameters
   * @param {string} params.start_date - Date in YYYY-MM-DD format or "today"/"yesterday"
   * @param {string} params.end_date - Date in YYYY-MM-DD format or "today"/"yesterday"
   * @param {string} [params.start_time="00:00"] - Time in HH:MM format
   * @param {string} [params.end_time="23:59"] - Time in HH:MM format
   * @param {string} [params.sender="all"] - Contact name or "all"
   * @param {string[]} [params.keywords=[]] - Keywords to search for in content
   * @param {number} [params.limit=50] - Maximum number of results
   * @returns {Promise<object>} Search results
   */
  async searchMessages(params) {
    try {
      // Validate and normalize parameters
      const normalizedParams = this.normalizeSearchParams(params);
      
      logger.info('Searching messages', {
        params: normalizedParams,
        timestamp: new Date().toISOString(),
      });

      // Build date range with validation
      const { startDate, endDate } = this.buildDateRange(normalizedParams);
      
      // Validate date range
      if (startDate > endDate) {
        logger.warn('Invalid date range: start date after end date', {
          startDate,
          endDate,
          params: normalizedParams,
        });
        
        return {
          success: false,
          error: 'Invalid date range: start date cannot be after end date',
          messages: [],
          metadata: {},
        };
      }
      
      // Check for future dates
      const now = new Date();
      if (startDate > now) {
        logger.warn('Start date is in the future, adjusting to today', {
          originalStartDate: startDate,
          adjustedDate: now,
        });
        // Don't return error, just adjust to today
      }
      
      // Build WHERE clause
      const where = {
        createdAt: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
        // Exclude assistant conversation messages
        conversationId: {
          [Op.ne]: '00000000-0000-0000-0000-000000000001',
        },
      };

      // Add sender filter with fallback handling
      if (normalizedParams.sender !== 'all') {
        where['$contact.name$'] = {
          [Op.iLike]: `%${normalizedParams.sender}%`,
        };
      }

      // Add keyword filters
      if (normalizedParams.keywords.length > 0) {
        const keywordConditions = normalizedParams.keywords.map(keyword => ({
          content: {
            [Op.iLike]: `%${keyword}%`,
          },
        }));
        where[Op.or] = keywordConditions;
      }

      // Execute search
      const messages = await Message.findAll({
        where,
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'name', 'phone'],
          },
          {
            model: Conversation,
            as: 'conversation',
            attributes: ['id', 'status', 'priority'],
          },
        ],
        order: [['createdAt', 'ASC']], // Chronological order for grouping
        limit: normalizedParams.limit,
      });

      // Group messages by sender and time window
      const groupedMessages = this.groupMessagesBySender(messages);

      logger.info('Message search completed', {
        totalMessages: messages.length,
        groupedConversations: groupedMessages.length,
        dateRange: { startDate, endDate },
      });

      return {
        success: true,
        messages: groupedMessages,
        metadata: {
          totalMessages: messages.length,
          groupedConversations: groupedMessages.length,
          dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          searchParams: normalizedParams,
        },
      };

    } catch (error) {
      logger.error('Message search failed', {
        params,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        messages: [],
        metadata: {},
      };
    }
  }

  /**
   * Normalize and validate search parameters
   */
  normalizeSearchParams(params) {
    return {
      start_date: params.start_date || 'today',
      end_date: params.end_date || 'today', 
      start_time: params.start_time || '00:00',
      end_time: params.end_time || '23:59',
      sender: (params.sender || 'all').toLowerCase(),
      keywords: Array.isArray(params.keywords) ? params.keywords : [],
      limit: Math.min(params.limit || this.defaultLimit, this.maxLimit),
    };
  }

  /**
   * Build date range from normalized parameters
   */
  buildDateRange(params) {
    const timezone = process.env.TZ || 'America/Mexico_City';
    const now = new Date();

    // Helper function to parse date keywords and relative dates
    const parseDate = (dateStr) => {
      const lowerStr = dateStr.toLowerCase();
      
      switch (lowerStr) {
        case 'today':
          return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        default:
          // Handle relative dates like "2 days ago", "1 week ago"
          const relativeMatch = lowerStr.match(/^(\d+)\s+(days?|weeks?|months?)\s+ago$/);
          if (relativeMatch) {
            const [, amount, unit] = relativeMatch;
            const date = new Date(now);
            const numAmount = parseInt(amount);
            
            switch (unit) {
              case 'day':
              case 'days':
                date.setDate(date.getDate() - numAmount);
                break;
              case 'week':
              case 'weeks':
                date.setDate(date.getDate() - (numAmount * 7));
                break;
              case 'month':
              case 'months':
                date.setMonth(date.getMonth() - numAmount);
                break;
            }
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
          }
          
          // Assume YYYY-MM-DD format
          const parsedDate = new Date(dateStr);
          
          // Validate date isn't from wrong year (AI mistake detection)
          if (parsedDate.getFullYear() < 2024) {
            logger.warn('Detected potentially incorrect year in date, using current year', {
              originalDate: dateStr,
              parsedYear: parsedDate.getFullYear(),
              currentYear: now.getFullYear(),
            });
            // Use same month/day but current year
            return new Date(now.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
          }
          
          return parsedDate;
      }
    };

    // Parse dates
    const startDate = parseDate(params.start_date);
    const endDate = parseDate(params.end_date);

    // Add time components
    const [startHour, startMin] = params.start_time.split(':').map(Number);
    const [endHour, endMin] = params.end_time.split(':').map(Number);

    startDate.setHours(startHour, startMin, 0, 0);
    endDate.setHours(endHour, endMin, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Group messages by sender and time window (30 minutes)
   */
  groupMessagesBySender(messages) {
    const groups = [];
    const GROUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

    for (const message of messages) {
      const senderId = message.contact?.id;
      const senderName = message.contact?.name || 'Unknown';
      const messageTime = new Date(message.createdAt);

      // Find existing group for this sender within time window
      const existingGroup = groups.find(group => 
        group.senderId === senderId &&
        Math.abs(messageTime - group.endTime) <= GROUP_WINDOW_MS
      );

      if (existingGroup) {
        // Add to existing group
        existingGroup.messages.push(message);
        existingGroup.endTime = new Date(Math.max(existingGroup.endTime, messageTime));
        existingGroup.content += ' ' + message.content;
      } else {
        // Create new group
        groups.push({
          senderId,
          senderName,
          phone: message.contact?.phone,
          startTime: messageTime,
          endTime: messageTime,
          messages: [message],
          content: message.content,
          messageCount: 1,
        });
      }
    }

    return groups.map(group => ({
      ...group,
      messageCount: group.messages.length,
      summary: this.summarizeContent(group.content),
    }));
  }

  /**
   * Create a brief summary of message content
   */
  summarizeContent(content) {
    if (!content) return 'No content';

    // Clean and truncate content
    const cleaned = content
      .replace(/\s+/g, ' ')
      .trim();

    // Return first 30 words or 150 characters, whichever is shorter
    const words = cleaned.split(' ');
    if (words.length <= 30) {
      return cleaned.length <= 150 ? cleaned : cleaned.substring(0, 147) + '...';
    }
    
    const first30Words = words.slice(0, 30).join(' ');
    return first30Words.length <= 150 ? first30Words : first30Words.substring(0, 147) + '...';
  }

  /**
   * Format search results for display
   */
  formatResults(searchResults) {
    if (!searchResults.success || !searchResults.messages.length) {
      return 'No messages found for the specified criteria.';
    }

    const formatted = searchResults.messages.map(group => {
      const startTime = group.startTime.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: process.env.TZ || 'America/Mexico_City',
      });

      const endTime = group.endTime.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: process.env.TZ || 'America/Mexico_City',
      });

      const timeRange = group.startTime.getTime() === group.endTime.getTime() 
        ? startTime 
        : `${startTime}–${endTime}`;

      return `*[${timeRange}] ${group.senderName}:* ${group.summary}`;
    }).join('\n');

    return formatted;
  }

  /**
   * Get search statistics
   */
  async getSearchStats(timeframe = 'today') {
    try {
      const { startDate, endDate } = this.buildDateRange({
        start_date: timeframe,
        end_date: timeframe,
        start_time: '00:00',
        end_time: '23:59',
      });

      const totalCount = await Message.count({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
          conversationId: {
            [Op.ne]: '00000000-0000-0000-0000-000000000001',
          },
        },
      });

      const senderStats = await Message.findAll({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
          conversationId: {
            [Op.ne]: '00000000-0000-0000-0000-000000000001',
          },
        },
        attributes: [
          'sender',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['sender'],
        raw: true,
      });

      return {
        timeframe,
        totalMessages: totalCount,
        messagesByType: senderStats,
        dateRange: { startDate, endDate },
      };

    } catch (error) {
      logger.error('Failed to get search stats', { error: error.message });
      return null;
    }
  }
}

module.exports = new MessageSearchService();