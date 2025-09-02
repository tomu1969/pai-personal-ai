const {
  Assistant, Contact, Conversation, Message, SummaryHistory,
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const aiService = require('./ai');

class SummaryService {
  constructor() {
    this.summaryTriggers = [
      'summary', 'status', 'report', 'update', 'what happened',
      'resumen', 'estado', 'reporte', 'actualización', 'que pasó',
    ];
    this.timePeriodKeywords = {
      today: { hours: 0, days: 0, useToday: true },
      yesterday: { hours: 0, days: 1, useYesterday: true },
      'last hour': { hours: 1 },
      '2 hours': { hours: 2 },
      '3 hours': { hours: 3 },
      '6 hours': { hours: 6 },
      '12 hours': { hours: 12 },
      '24 hours': { hours: 24 },
      '2 days': { days: 2 },
      '3 days': { days: 3 },
      week: { days: 7 },
      'this week': { days: 7, useThisWeek: true },
    };
  }

  /**
   * Check if a message is requesting a summary
   * @param {string} content - Message content
   * @returns {boolean}
   */
  isSummaryRequest(content) {
    const lowerContent = content.toLowerCase().trim();
    
    // Check for exact matches or common phrases
    const hasMainTrigger = this.summaryTriggers.some(trigger => 
      lowerContent === trigger ||
      lowerContent.includes(`send ${trigger}`) ||
      lowerContent.includes(`${trigger} now`) ||
      lowerContent.includes(`${trigger} please`) ||
      lowerContent.includes(`give me ${trigger}`) ||
      lowerContent.includes(`show me ${trigger}`) ||
      lowerContent.includes(`${trigger} of`) ||
      lowerContent.includes(`${trigger} for`) ||
      lowerContent.includes(`${trigger} today`) ||
      lowerContent.includes(`${trigger} yesterday`) ||
      lowerContent.includes(`${trigger} last`) ||
      lowerContent.startsWith(trigger + ' ')
    );
    
    // Also check for common summary request patterns
    const summaryPatterns = [
      /give me (?:a |an )?(?:summary|report|update|status)/,
      /can you (?:give|send|show) (?:me )?(?:a |an )?(?:summary|report|update)/,
      /(?:summary|report|update|status) (?:of|for|from) (?:the )?(?:last|today|yesterday)/,
      /what happened (?:in )?(?:the )?(?:last|today|yesterday)/,
      /(?:show|tell) me what (?:happened|occurred)/
    ];
    
    const hasPatternMatch = summaryPatterns.some(pattern => pattern.test(lowerContent));
    
    return hasMainTrigger || hasPatternMatch;
  }

  /**
   * Extract time period from message content
   * @param {string} content - Message content
   * @returns {object} Time period configuration
   */
  extractTimePeriod(content) {
    const lowerContent = content.toLowerCase();
    
    // Check for specific time period keywords
    for (const [keyword, config] of Object.entries(this.timePeriodKeywords)) {
      if (lowerContent.includes(keyword)) {
        return config;
      }
    }
    
    // Check for numeric patterns like "summary 2 days" or "last 3 hours"
    const numberPatterns = [
      /(\d+)\s*hours?/,
      /(\d+)\s*days?/,
      /last\s*(\d+)\s*hours?/,
      /last\s*(\d+)\s*days?/,
    ];
    
    for (const pattern of numberPatterns) {
      const match = lowerContent.match(pattern);
      if (match) {
        const number = parseInt(match[1]);
        if (pattern.source.includes('hour')) {
          return { hours: number };
        } else {
          return { days: number };
        }
      }
    }
    
    // Default to 24 hours
    return { hours: 24 };
  }

  /**
   * Generate summary for a contact/user
   * @param {string} contactId - ID of contact requesting summary
   * @param {string} content - Original message content for context
   * @returns {Promise<string>} Formatted summary for WhatsApp
   */
  async generateSummary(contactId, content = '') {
    try {
      const assistant = await Assistant.findOne();
      if (!assistant) {
        return '❌ Assistant not configured. Please set up the assistant first.';
      }

      // Extract time period from message
      const timePeriod = this.extractTimePeriod(content);
      const { startDate, endDate } = this.calculateDateRange(timePeriod);

      logger.info('Generating summary', {
        contactId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timePeriod,
      });

      // Fetch messages in the time period
      const messages = await this.fetchMessagesInPeriod(startDate, endDate);
      
      if (messages.length === 0) {
        const periodText = this.formatPeriodText(timePeriod);
        return `📊 *Message Summary*\n_${periodText}_\n\n🔍 No messages found in this period.`;
      }

      // Categorize and analyze messages
      const analysis = await this.analyzeMessages(messages);
      
      // Format summary for WhatsApp
      const summary = await this.formatSummaryForWhatsApp(analysis, timePeriod);
      
      // Save summary history
      await this.saveSummaryHistory(assistant.id, contactId, startDate, endDate, messages.length, summary, analysis);
      
      // Update last summary requested timestamp
      await assistant.update({ lastSummaryRequestedAt: new Date() });
      
      // Save summary message to Assistant conversation
      await this.saveSummaryToAssistantConversation(summary, assistant.id, contactId);
      
      return summary;

    } catch (error) {
      logger.error('Error generating summary', {
        contactId,
        error: error.message,
        stack: error.stack,
      });
      return '❌ Sorry, there was an error generating your summary. Please try again later.';
    }
  }

  /**
   * Calculate date range based on time period configuration
   * @param {object} timePeriod - Time period configuration
   * @returns {object} Start and end dates
   */
  calculateDateRange(timePeriod) {
    const endDate = new Date();
    let startDate = new Date();

    if (timePeriod.useToday) {
      startDate.setHours(0, 0, 0, 0);
    } else if (timePeriod.useYesterday) {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (timePeriod.useThisWeek) {
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (timePeriod.hours) {
      startDate.setHours(startDate.getHours() - timePeriod.hours);
    } else if (timePeriod.days) {
      startDate.setDate(startDate.getDate() - timePeriod.days);
    }

    return { startDate, endDate };
  }

  /**
   * Fetch messages within a time period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Messages with contact information
   */
  async fetchMessagesInPeriod(startDate, endDate) {
    return await Message.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: Conversation,
          as: 'conversation',
          include: [
            {
              model: Contact,
              as: 'contact',
              attributes: ['id', 'name', 'phone', 'isGroup'],
            },
          ],
          attributes: ['id', 'priority', 'category', 'status'],
        },
      ],
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'content', 'sender', 'messageType', 'createdAt'],
    });
  }

  /**
   * Analyze messages and categorize them
   * @param {Array} messages - Array of messages
   * @returns {object} Analysis results
   */
  async analyzeMessages(messages) {
    const analysis = {
      total: messages.length,
      byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
      byCategory: { personal: 0, business: 0, support: 0, sales: 0, inquiry: 0, other: 0 },
      bySender: { user: 0, assistant: 0 },
      byType: { text: 0, image: 0, audio: 0, video: 0, document: 0, reaction: 0 },
      groups: 0,
      individual: 0,
      urgent: [],
      actionItems: [],
      assistantActivity: [],
      recentMessages: [],
    };

    for (const message of messages) {
      // Count by sender
      analysis.bySender[message.sender] = (analysis.bySender[message.sender] || 0) + 1;

      // Count by message type
      analysis.byType[message.messageType] = (analysis.byType[message.messageType] || 0) + 1;

      // Count groups vs individual
      if (message.conversation?.contact?.isGroup || message.conversation?.contact?.phone.includes('@g.us')) {
        analysis.groups++;
      } else {
        analysis.individual++;
      }

      // Count by priority and category
      const priority = message.conversation?.priority || 'medium';
      const category = message.conversation?.category || 'other';
      
      analysis.byPriority[priority] = (analysis.byPriority[priority] || 0) + 1;
      analysis.byCategory[category] = (analysis.byCategory[category] || 0) + 1;

      // Track urgent messages
      if (priority === 'urgent' || priority === 'high') {
        analysis.urgent.push({
          contact: message.conversation?.contact?.name || 'Unknown',
          content: message.content,
          time: message.createdAt,
          priority,
        });
      }

      // Track assistant activity
      if (message.sender === 'assistant') {
        analysis.assistantActivity.push({
          contact: message.conversation?.contact?.name || 'Unknown',
          content: message.content.substring(0, 100),
          time: message.createdAt,
        });
      }

      // Keep recent messages for context
      if (analysis.recentMessages.length < 5) {
        analysis.recentMessages.push({
          contact: message.conversation?.contact?.name || 'Unknown',
          content: message.content,
          sender: message.sender,
          time: message.createdAt,
        });
      }
    }

    // Use AI to extract action items if available
    if (aiService.isEnabled() && messages.length > 0) {
      try {
        analysis.actionItems = await this.extractActionItemsWithAI(messages.slice(0, 20)); // Limit for API efficiency
      } catch (error) {
        logger.warn('Failed to extract action items with AI', { error: error.message });
      }
    }

    return analysis;
  }

  /**
   * Extract action items using AI
   * @param {Array} messages - Recent messages
   * @returns {Promise<Array>} Extracted action items
   */
  async extractActionItemsWithAI(messages) {
    const prompt = `Analyze these messages and extract any action items, commitments, deadlines, or important dates mentioned. Return as a JSON array of objects with "item", "contact", and "urgency" fields.

Recent messages:
${messages.map(msg => `${msg.conversation?.contact?.name || 'Unknown'}: ${msg.content}`).join('\n')}`;

    try {
      const result = await aiService.analyzeMessage(prompt, { task: 'extract_action_items' });
      return result.actionItems || [];
    } catch (error) {
      logger.warn('AI action item extraction failed', { error: error.message });
      return [];
    }
  }

  /**
   * Format summary for WhatsApp display
   * @param {object} analysis - Analysis results
   * @param {object} timePeriod - Time period configuration
   * @returns {string} Formatted summary
   */
  async formatSummaryForWhatsApp(analysis, timePeriod) {
    const periodText = this.formatPeriodText(timePeriod);
    
    let summary = `📊 *Message Summary*\n_${periodText}_\n\n`;

    // Overview section
    summary += `📈 *Overview*\n`;
    summary += `• Total Messages: ${analysis.total}\n`;
    summary += `• From You: ${analysis.bySender.user || 0}\n`;
    summary += `• Assistant Replies: ${analysis.bySender.assistant || 0}\n`;
    summary += `• Groups: ${analysis.groups} | Individual: ${analysis.individual}\n\n`;

    // Priority breakdown
    if (analysis.byPriority.urgent + analysis.byPriority.high > 0) {
      summary += `🔴 *High Priority (${analysis.byPriority.urgent + analysis.byPriority.high})*\n`;
      if (analysis.byPriority.urgent > 0) {
        summary += `• Urgent: ${analysis.byPriority.urgent}\n`;
      }
      if (analysis.byPriority.high > 0) {
        summary += `• High: ${analysis.byPriority.high}\n`;
      }
      summary += `\n`;
    }

    // Urgent messages
    if (analysis.urgent.length > 0) {
      summary += `🚨 *Urgent Items*\n`;
      analysis.urgent.slice(0, 3).forEach(item => {
        const timeAgo = this.formatTimeAgo(item.time);
        summary += `• ${item.contact} - ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''} (${timeAgo})\n`;
      });
      if (analysis.urgent.length > 3) {
        summary += `• ...and ${analysis.urgent.length - 3} more urgent items\n`;
      }
      summary += `\n`;
    }

    // Action items
    if (analysis.actionItems.length > 0) {
      summary += `📋 *Action Items*\n`;
      analysis.actionItems.slice(0, 5).forEach(item => {
        summary += `• ${item.item} (${item.contact})\n`;
      });
      summary += `\n`;
    }

    // Categories breakdown
    const nonZeroCategories = Object.entries(analysis.byCategory).filter(([_, count]) => count > 0);
    if (nonZeroCategories.length > 0) {
      summary += `💬 *Categories*\n`;
      nonZeroCategories.forEach(([category, count]) => {
        const emoji = this.getCategoryEmoji(category);
        summary += `${emoji} ${category}: ${count}\n`;
      });
      summary += `\n`;
    }

    // Assistant activity
    if (analysis.bySender.assistant > 0) {
      summary += `✅ *Assistant Activity*\n`;
      summary += `• Handled ${analysis.bySender.assistant} messages\n`;
      
      if (analysis.assistantActivity.length > 0) {
        const recentActivity = analysis.assistantActivity.slice(0, 3);
        recentActivity.forEach(activity => {
          const timeAgo = this.formatTimeAgo(activity.time);
          summary += `• Replied to ${activity.contact} (${timeAgo})\n`;
        });
      }
      summary += `\n`;
    }

    // Message types
    const nonZeroTypes = Object.entries(analysis.byType).filter(([_, count]) => count > 0 && count !== analysis.byType.text);
    if (nonZeroTypes.length > 0) {
      summary += `📎 *Media*\n`;
      nonZeroTypes.forEach(([type, count]) => {
        const emoji = this.getTypeEmoji(type);
        summary += `${emoji} ${type}: ${count}\n`;
      });
    }

    return summary.trim();
  }

  /**
   * Format time period text for display
   * @param {object} timePeriod - Time period configuration
   * @returns {string} Formatted period text
   */
  formatPeriodText(timePeriod) {
    if (timePeriod.useToday) return 'Today';
    if (timePeriod.useYesterday) return 'Yesterday';
    if (timePeriod.useThisWeek) return 'This Week';
    if (timePeriod.hours === 1) return 'Last Hour';
    if (timePeriod.hours) return `Last ${timePeriod.hours} Hours`;
    if (timePeriod.days === 1) return 'Last 24 Hours';
    if (timePeriod.days) return `Last ${timePeriod.days} Days`;
    return 'Last 24 Hours';
  }

  /**
   * Format time ago text
   * @param {Date} date - Date to format
   * @returns {string} Time ago text
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  }

  /**
   * Get emoji for category
   * @param {string} category - Category name
   * @returns {string} Emoji
   */
  getCategoryEmoji(category) {
    const emojis = {
      personal: '👤',
      business: '💼',
      support: '🛠️',
      sales: '💰',
      inquiry: '❓',
      other: '📝',
    };
    return emojis[category] || '📝';
  }

  /**
   * Get emoji for message type
   * @param {string} type - Message type
   * @returns {string} Emoji
   */
  getTypeEmoji(type) {
    const emojis = {
      image: '📷',
      audio: '🎵',
      video: '📹',
      document: '📄',
      reaction: '👍',
    };
    return emojis[type] || '📝';
  }

  /**
   * Save summary history to database
   * @param {string} assistantId - Assistant ID
   * @param {string} contactId - Contact ID who requested
   * @param {Date} startDate - Period start
   * @param {Date} endDate - Period end
   * @param {number} messageCount - Number of messages
   * @param {string} summaryContent - Formatted summary
   * @param {object} summaryData - Analysis data
   */
  async saveSummaryHistory(assistantId, contactId, startDate, endDate, messageCount, summaryContent, summaryData) {
    try {
      await SummaryHistory.create({
        assistantId,
        requestedByContactId: contactId,
        periodStart: startDate,
        periodEnd: endDate,
        messageCount,
        summaryContent,
        summaryData,
        requestType: 'manual',
      });
    } catch (error) {
      logger.error('Failed to save summary history', { error: error.message });
    }
  }

  /**
   * Save summary message to Assistant conversation
   * @param {string} summaryContent - The generated summary
   * @param {string} assistantId - Assistant ID
   * @param {string} requestedByContactId - Contact who requested the summary
   */
  async saveSummaryToAssistantConversation(summaryContent, assistantId, requestedByContactId) {
    try {
      const { Conversation, Message } = require('../models');
      
      // Fixed UUID for Assistant conversation
      const ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';
      const ASSISTANT_CONTACT_ID = '00000000-0000-0000-0000-000000000001';
      
      // Find or ensure Assistant conversation exists
      let assistantConversation = await Conversation.findByPk(ASSISTANT_CONVERSATION_ID);
      
      if (!assistantConversation) {
        logger.warn('Assistant conversation not found, creating new one');
        // Fallback: create the Assistant conversation if it doesn't exist
        const { Contact } = require('../models');
        
        let assistantContact = await Contact.findByPk(ASSISTANT_CONTACT_ID);
        if (!assistantContact) {
          // Create Assistant contact as fallback
          assistantContact = await Contact.create({
            id: ASSISTANT_CONTACT_ID,
            phone: 'assistant@system',
            name: 'AI Assistant',
            category: 'business',
            priority: 'high',
            metadata: { isAssistant: true }
          });
        }
        
        // Create Assistant conversation
        assistantConversation = await Conversation.create({
          id: ASSISTANT_CONVERSATION_ID,
          contactId: ASSISTANT_CONTACT_ID,
          assistantId,
          status: 'active',
          priority: 'high',
          category: 'support',
          summary: 'Assistant conversation for summaries and system updates',
          context: { isAssistant: true, purpose: 'system_summaries' },
          tags: ['system', 'assistant', 'summaries'],
          isAssistantEnabled: false, // Assistant doesn't respond to itself
        });
      }
      
      // Add metadata about who requested the summary
      let messageContent = summaryContent;
      if (requestedByContactId && requestedByContactId !== ASSISTANT_CONTACT_ID) {
        const requestingContact = await require('../models').Contact.findByPk(requestedByContactId);
        const requesterName = requestingContact?.name || 'Unknown';
        messageContent = `📋 *Summary requested by ${requesterName}*\n\n${summaryContent}`;
      }
      
      // Create message in Assistant conversation
      await Message.create({
        conversationId: ASSISTANT_CONVERSATION_ID,
        contactId: ASSISTANT_CONTACT_ID,
        messageType: 'text',
        sender: 'assistant',
        content: messageContent,
        metadata: {
          isSummary: true,
          requestedBy: requestedByContactId,
          generatedAt: new Date().toISOString()
        },
        isRead: false,
        sentAt: new Date(),
      });
      
      // Update conversation last message time
      await assistantConversation.update({
        lastMessageAt: new Date(),
        messageCount: assistantConversation.messageCount + 1,
      });
      
      logger.info('Summary saved to Assistant conversation', {
        assistantConversationId: ASSISTANT_CONVERSATION_ID,
        requestedBy: requestedByContactId,
        summaryLength: summaryContent.length
      });
      
    } catch (error) {
      logger.error('Failed to save summary to Assistant conversation', {
        error: error.message,
        stack: error.stack,
        assistantId,
        requestedByContactId
      });
      // Don't throw - this is not critical for the main summary functionality
    }
  }
}

module.exports = new SummaryService();