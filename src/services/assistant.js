const {
  Assistant, Contact, Conversation, Message,
} = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

class AssistantService {
  constructor() {
    this.currentAssistant = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the assistant service
   * Load the current assistant configuration from database
   */
  async initialize() {
    try {
      // Get or create the default assistant
      const [assistant] = await Assistant.findOrCreate({
        where: {},
        defaults: {
          enabled: config.assistant.defaultStatus,
          ownerName: config.assistant.ownerName,
          assistantName: 'PAI',
          systemPrompt: `Your name is PAI. You are a personal AI assistant that answers WhatsApp messages on behalf of your owner, Tomás. 
Always greet each sender by their name. 
Always reply in the same language as the last message received. 
Always identify yourself as "Pai, Tomás' Assistant" if in English, or "Pai, el asistente de Tomás" if in Spanish. 
Keep responses polite, concise, and professional, adjusting tone to match the sender (casual if casual, formal if formal). 
**Always** ask relevant follow-up questions to clarify intent or move the conversation forward. 
If the sender message is vague, ask for clarification instead of assuming. 
Suggest next steps only when appropriate. 
Only stop asking once you've clarified the sender's intention or request. 
Once you've clarified the sender's request or intent, paraphrase it and express that you will convey it to Tomás so he can get back to the sender.`,
          autoResponseTemplate: config.assistant.autoResponseTemplate,
          messagesProcessed: 0,
          settings: {
            summaryIntervalHours: config.assistant.summaryIntervalHours,
          },
        },
      });

      this.currentAssistant = assistant;
      this.isInitialized = true;

      logger.info('Assistant service initialized', {
        assistantId: assistant.id,
        enabled: assistant.enabled,
        ownerName: assistant.ownerName,
      });

      return assistant;
    } catch (error) {
      logger.error('Failed to initialize assistant service', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Ensure assistant is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.currentAssistant;
  }

  /**
   * Check if assistant is currently enabled
   */
  async isEnabled() {
    const assistant = await this.ensureInitialized();
    return assistant.enabled;
  }

  /**
   * Toggle assistant on/off
   */
  async toggle(enabled) {
    try {
      const assistant = await this.ensureInitialized();

      await assistant.update({
        enabled,
        lastActivity: enabled ? new Date() : assistant.lastActivity,
      });

      this.currentAssistant = assistant;

      logger.info('Assistant status toggled', {
        assistantId: assistant.id,
        enabled,
        previousStatus: !enabled,
      });

      return {
        success: true,
        enabled: assistant.enabled,
        lastActivity: assistant.lastActivity,
        messagesProcessed: assistant.messagesProcessed,
      };
    } catch (error) {
      logger.error('Failed to toggle assistant status', {
        enabled,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get assistant status and statistics
   */
  async getStatus() {
    try {
      const assistant = await this.ensureInitialized();

      // Get recent activity statistics
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recentMessages, activeConversations, totalContacts] = await Promise.all([
        Message.count({
          where: {
            createdAt: {
              [require('sequelize').Op.gte]: last24Hours,
            },
            sender: 'user',
          },
        }),
        Conversation.count({
          where: {
            status: ['active', 'waiting'],
          },
        }),
        Contact.count(),
      ]);

      return {
        id: assistant.id,
        enabled: assistant.enabled,
        ownerName: assistant.ownerName,
        assistantName: assistant.assistantName,
        systemPrompt: assistant.systemPrompt,
        autoResponseTemplate: assistant.autoResponseTemplate,
        messageTypePreferences: assistant.messageTypePreferences,
        lastActivity: assistant.lastActivity,
        messagesProcessed: assistant.messagesProcessed,
        settings: assistant.settings,
        statistics: {
          recentMessages,
          activeConversations,
          totalContacts,
          uptime: process.uptime(),
        },
        createdAt: assistant.createdAt,
        updatedAt: assistant.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get assistant status', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update assistant configuration
   */
  async updateConfig(updates) {
    try {
      const assistant = await this.ensureInitialized();

      const allowedUpdates = {
        ownerName: updates.ownerName,
        assistantName: updates.assistantName,
        autoResponseTemplate: updates.autoResponseTemplate,
        systemPrompt: updates.systemPrompt,
        messageTypePreferences: updates.messageTypePreferences,
        settings: updates.settings ? {
          ...assistant.settings,
          ...updates.settings,
        } : assistant.settings,
      };

      // Remove undefined values
      Object.keys(allowedUpdates).forEach((key) => {
        if (allowedUpdates[key] === undefined) {
          delete allowedUpdates[key];
        }
      });

      await assistant.update(allowedUpdates);
      this.currentAssistant = assistant;

      logger.info('Assistant configuration updated', {
        assistantId: assistant.id,
        updates: Object.keys(allowedUpdates),
      });

      return assistant;
    } catch (error) {
      logger.error('Failed to update assistant configuration', {
        updates,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Increment message processed counter
   */
  async incrementMessageCount() {
    try {
      const assistant = await this.ensureInitialized();

      await assistant.update({
        messagesProcessed: assistant.messagesProcessed + 1,
        lastActivity: new Date(),
      });

      this.currentAssistant = assistant;

      logger.debug('Message count incremented', {
        assistantId: assistant.id,
        newCount: assistant.messagesProcessed + 1,
      });
    } catch (error) {
      logger.error('Failed to increment message count', {
        error: error.message,
      });
    }
  }

  /**
   * Generate auto-response message
   * Replace template variables with actual values
   */
  async generateAutoResponse(contactName = null) {
    try {
      const assistant = await this.ensureInitialized();
      let template = assistant.autoResponseTemplate;

      // Replace template variables
      const variables = {
        '{{owner_name}}': assistant.ownerName,
        '{{contact_name}}': contactName || 'there',
        '{{timestamp}}': new Date().toLocaleString(),
      };

      Object.entries(variables).forEach(([placeholder, value]) => {
        template = template.replace(new RegExp(placeholder, 'g'), value);
      });

      return template;
    } catch (error) {
      logger.error('Failed to generate auto-response', {
        contactName,
        error: error.message,
      });
      return `Hi! This is ${config.assistant.ownerName}'s personal assistant. I'm currently helping filter messages. What do you need assistance with?`;
    }
  }

  /**
   * Ultra-simplified: should respond to this message?
   * Remove all complex logic - just check basic conditions
   */
  async shouldRespond(message, contact, conversation) {
    try {
      // Basic checks only
      if (!await this.isEnabled()) {
        return false;
      }

      // Don't respond to system messages
      if (message.sender === 'system' || message.sender === 'assistant') {
        return false;
      }

      // Don't respond to blocked contacts
      if (contact && contact.isBlocked) {
        return false;
      }

      // Don't respond if assistant is disabled for this conversation
      if (conversation && !conversation.isAssistantEnabled) {
        return false;
      }

      // Use AI's simple decision logic
      const aiService = require('./ai');
      const assistant = await this.ensureInitialized();
      
      const shouldRespond = await aiService.shouldRespond(message.content, {
        ownerName: assistant.ownerName,
        senderName: contact.name,
        conversationId: conversation.id,
      });

      logger.debug(`Ultra-simple AI decision: ${shouldRespond ? 'RESPOND' : 'NO RESPONSE'}`, {
        conversationId: conversation.id,
        content: message.content.substring(0, 50),
        senderName: contact.name,
      });

      return shouldRespond;
    } catch (error) {
      logger.error('Failed to determine if assistant should respond', {
        messageId: message.id,
        error: error.message,
      });
      // Default to responding when in doubt
      return true;
    }
  }

  /**
   * Reset assistant statistics
   */
  async resetStatistics() {
    try {
      const assistant = await this.ensureInitialized();

      await assistant.update({
        messagesProcessed: 0,
        lastActivity: null,
      });

      this.currentAssistant = assistant;

      logger.info('Assistant statistics reset', {
        assistantId: assistant.id,
      });

      return assistant;
    } catch (error) {
      logger.error('Failed to reset assistant statistics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get assistant performance metrics
   */
  async getMetrics(timeRange = '24h') {
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
        totalMessages,
        assistantMessages,
        uniqueContacts,
        conversationsCreated,
        conversationsResolved,
      ] = await Promise.all([
        Message.count({
          where: {
            createdAt: { [require('sequelize').Op.gte]: timeFilter },
            sender: 'user',
          },
        }),
        Message.count({
          where: {
            createdAt: { [require('sequelize').Op.gte]: timeFilter },
            sender: 'assistant',
          },
        }),
        Message.count({
          distinct: true,
          col: 'contactId',
          where: {
            createdAt: { [require('sequelize').Op.gte]: timeFilter },
            sender: 'user',
          },
        }),
        Conversation.count({
          where: {
            createdAt: { [require('sequelize').Op.gte]: timeFilter },
          },
        }),
        Conversation.count({
          where: {
            resolvedAt: { [require('sequelize').Op.gte]: timeFilter },
          },
        }),
      ]);

      const responseRate = totalMessages > 0 ? (assistantMessages / totalMessages * 100).toFixed(2) : 0;

      return {
        timeRange,
        totalMessages,
        assistantMessages,
        uniqueContacts,
        conversationsCreated,
        conversationsResolved,
        responseRate: parseFloat(responseRate),
        averageResponseTime: 0, // TODO: Calculate based on message timestamps
      };
    } catch (error) {
      logger.error('Failed to get assistant metrics', {
        timeRange,
        error: error.message,
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AssistantService();
