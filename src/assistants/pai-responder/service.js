const { OpenAI } = require('openai');
const BaseAssistant = require('../shared/base-assistant');
const { PaiResponder } = require('../../models');
const { ASSISTANT_TYPES } = require('../shared/types');
const logger = require('../../utils/logger');

class PaiResponderService extends BaseAssistant {
  constructor() {
    super('PAI Responder', 'pai_responder.md');
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.conversationHistories = new Map();
    this.currentConfig = null;
  }

  /**
   * Get PAI Responder configuration from database
   */
  async getConfig() {
    if (!this.currentConfig) {
      const [responder] = await PaiResponder.findOrCreate({
        where: {},
        defaults: {
          enabled: false,
          ownerName: process.env.OWNER_NAME || 'Owner',
          assistantName: 'PAI',
          autoResponseTemplate: 'Hello! I\'m PAI, your assistant. How can I help you today?',
          responseSettings: {
            cooldownMinutes: 30,
            maxMessagesPerHour: 20,
            enableEmoticons: true,
            enableFollowUpQuestions: true,
            signatureFormat: 'bottom',
          },
        },
      });
      this.currentConfig = responder;
    }
    return this.currentConfig;
  }

  /**
   * Get or create conversation history for a contact
   * @param {string} contactPhone - Contact phone number
   * @param {object} assistantConfig - Assistant configuration
   */
  getConversationHistory(contactPhone, assistantConfig = {}) {
    if (!this.conversationHistories.has(contactPhone)) {
      const personalizedPrompt = this.personalizePrompt({
        ownerName: assistantConfig.ownerName || 'the owner',
        assistantName: assistantConfig.assistantName || 'PAI',
      });
      
      this.conversationHistories.set(contactPhone, [
        { role: 'system', content: personalizedPrompt }
      ]);
      
      logger.debug('Created new conversation history for PAI Responder', {
        contactPhone,
        assistantName: assistantConfig.assistantName,
      });
    }
    return this.conversationHistories.get(contactPhone);
  }

  /**
   * Process a WhatsApp message and generate AI response
   * @param {string} message - User's message content
   * @param {string} contactPhone - Contact phone number
   * @param {object} senderInfo - Sender information
   */
  async processMessage(message, contactPhone, senderInfo = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      if (!config.enabled) {
        logger.debug('PAI Responder is disabled');
        return null;
      }

      const conversationHistory = this.getConversationHistory(contactPhone, config);
      
      // Add user message to history
      conversationHistory.push({
        role: 'user',
        content: `${senderInfo.pushName || 'User'}: ${message}`
      });

      // Keep only last 10 messages to avoid context limit
      if (conversationHistory.length > 11) { // 1 system + 10 conversation messages
        conversationHistory.splice(1, conversationHistory.length - 11);
      }

      logger.info('PAI Responder processing message', {
        contactPhone,
        messageLength: message.length,
        historyLength: conversationHistory.length,
      });

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversationHistory,
        temperature: 0.8,
        max_completion_tokens: 300,
      });

      const responseText = completion.choices[0].message.content;

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: responseText
      });

      // Update activity tracking
      await this.updateActivity();

      logger.info('PAI Responder generated response', {
        contactPhone,
        responseLength: responseText.length,
        tokensUsed: completion.usage.total_tokens,
      });

      return {
        responseText,
        tokensUsed: completion.usage.total_tokens,
        assistantType: ASSISTANT_TYPES.PAI_RESPONDER,
      };

    } catch (error) {
      logger.error('PAI Responder failed to process message', {
        contactPhone,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Check if should respond based on cooldown and rate limiting
   * @param {object} savedMessage - Message from database
   * @param {object} contact - Contact information
   * @param {object} conversation - Conversation information
   */
  async shouldRespond(savedMessage, contact, conversation) {
    try {
      const config = await this.getConfig();
      
      if (!config.enabled) {
        return false;
      }

      // Check cooldown period
      const cooldownMs = (config.responseSettings.cooldownMinutes || 30) * 60 * 1000;
      const lastResponse = await this.getLastResponseTime(contact.id);
      
      if (lastResponse && (Date.now() - lastResponse.getTime()) < cooldownMs) {
        logger.debug('PAI Responder cooldown active', {
          contactId: contact.id,
          cooldownMinutes: config.responseSettings.cooldownMinutes,
        });
        return false;
      }

      // Check hourly rate limit
      const hourlyLimit = config.responseSettings.maxMessagesPerHour || 20;
      const responsesThisHour = await this.getResponsesInLastHour(contact.id);
      
      if (responsesThisHour >= hourlyLimit) {
        logger.debug('PAI Responder rate limit reached', {
          contactId: contact.id,
          responsesThisHour,
          hourlyLimit,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking if PAI Responder should respond', {
        error: error.message,
        contactId: contact?.id,
      });
      return false;
    }
  }

  /**
   * Get last response time for a contact
   */
  async getLastResponseTime(contactId) {
    const { Message } = require('../../models');
    const lastResponse = await Message.findOne({
      where: {
        sender: 'assistant',
        paiResponderId: { [require('sequelize').Op.ne]: null },
      },
      include: [{
        model: require('../../models').Conversation,
        as: 'conversation',
        where: { contactId },
      }],
      order: [['createdAt', 'DESC']],
    });
    return lastResponse?.createdAt || null;
  }

  /**
   * Get number of responses in the last hour for a contact
   */
  async getResponsesInLastHour(contactId) {
    const { Message, Conversation } = require('../../models');
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await Message.count({
      where: {
        sender: 'assistant',
        paiResponderId: { [require('sequelize').Op.ne]: null },
        createdAt: { [require('sequelize').Op.gte]: hourAgo },
      },
      include: [{
        model: Conversation,
        as: 'conversation',
        where: { contactId },
      }],
    });
    
    return count;
  }

  /**
   * Update activity tracking
   */
  async updateActivity() {
    try {
      await PaiResponder.increment('messagesProcessed', { where: {} });
      await PaiResponder.update(
        { lastActivity: new Date() },
        { where: {} }
      );
    } catch (error) {
      logger.error('Failed to update PAI Responder activity', {
        error: error.message,
      });
    }
  }

  /**
   * Ensure the assistant is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this;
  }

  /**
   * Clear conversation history for a contact (for testing/debugging)
   */
  clearConversationHistory(contactPhone) {
    this.conversationHistories.delete(contactPhone);
    logger.debug('Cleared conversation history for PAI Responder', { contactPhone });
  }
}

module.exports = PaiResponderService;