const PaiResponderService = require('../../assistants/pai-responder/service');
const logger = require('../../utils/logger');

class PaiResponderAdapter {
  constructor() {
    this.paiResponder = new PaiResponderService();
    this.isInitialized = false;
  }

  /**
   * Initialize the PAI Responder
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.paiResponder.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Check if PAI Responder is enabled
   */
  async isEnabled() {
    await this.initialize();
    return await this.paiResponder.isEnabled();
  }

  /**
   * Process WhatsApp message and generate response
   * This method maintains compatibility with the existing whatsapp-assistant.js interface
   * @param {string} message - User's message content
   * @param {string} contactPhone - Contact phone number
   * @param {object} assistantConfig - Assistant configuration
   * @param {object} senderInfo - Sender information
   */
  async processMessage(message, contactPhone, assistantConfig, senderInfo = {}) {
    try {
      await this.initialize();
      
      const result = await this.paiResponder.processMessage(
        message,
        contactPhone,
        senderInfo
      );

      if (!result) {
        return null; // Responder is disabled
      }

      // Return in format expected by existing code
      return {
        success: true,
        response: result.responseText,
        tokensUsed: result.tokensUsed,
        assistantType: result.assistantType,
      };

    } catch (error) {
      logger.error('PAI Responder Adapter failed to process message', {
        contactPhone,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if should respond to a message
   * @param {object} savedMessage - Message from database
   * @param {object} contact - Contact information
   * @param {object} conversation - Conversation information
   */
  async shouldRespond(savedMessage, contact, conversation) {
    try {
      await this.initialize();
      return await this.paiResponder.shouldRespond(savedMessage, contact, conversation);
    } catch (error) {
      logger.error('PAI Responder Adapter failed to check shouldRespond', {
        error: error.message,
        contactId: contact?.id,
      });
      return false;
    }
  }

  /**
   * Get responder configuration
   * Maintains compatibility with existing assistant service interface
   */
  async getStatus() {
    try {
      await this.initialize();
      const config = await this.paiResponder.getConfig();
      
      // Return in format expected by existing code
      return {
        id: config.id,
        enabled: config.enabled,
        ownerName: config.ownerName,
        assistantName: config.assistantName,
        systemPrompt: config.systemPrompt || this.paiResponder.systemPrompt,
        autoResponseTemplate: config.autoResponseTemplate,
        messagesProcessed: config.messagesProcessed,
        lastActivity: config.lastActivity,
        settings: config.responseSettings,
        messageTypePreferences: config.messageTypePreferences,
      };
    } catch (error) {
      logger.error('PAI Responder Adapter failed to get status', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Ensure assistant is initialized (for backward compatibility)
   */
  async ensureInitialized() {
    await this.initialize();
    return this;
  }

  /**
   * Increment message count (for backward compatibility)
   */
  async incrementMessageCount() {
    try {
      await this.initialize();
      await this.paiResponder.updateActivity();
    } catch (error) {
      logger.error('PAI Responder Adapter failed to increment message count', {
        error: error.message,
      });
    }
  }

  /**
   * Clear conversation history for testing
   */
  clearConversationHistory(contactPhone) {
    this.paiResponder.clearConversationHistory(contactPhone);
  }
}

module.exports = new PaiResponderAdapter();