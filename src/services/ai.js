/**
 * AI Service - Main entry point for AI functionality
 * Routes to the appropriate AI adapter based on configuration
 */

const paiResponderAdapter = require('./ai/paiResponderAdapter');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.paiResponder = paiResponderAdapter;
  }

  /**
   * Check if AI should respond to a message
   * @param {string} content - Message content
   * @param {object} context - Message context (senderName, conversationId, contactId)
   * @returns {boolean} - Whether AI should respond
   */
  async shouldRespond(content, context) {
    try {
      // For now, route to PAI Responder
      // In the future, this could route to different AI services based on context
      const message = { content };
      const contact = { 
        name: context.senderName,
        id: context.contactId 
      };
      const conversation = { id: context.conversationId };
      
      return await this.paiResponder.shouldRespond(message, contact, conversation);
    } catch (error) {
      logger.error('AI Service shouldRespond failed', {
        error: error.message,
        context
      });
      return false;
    }
  }

  /**
   * Check if AI service is enabled
   */
  async isEnabled() {
    try {
      return await this.paiResponder.isEnabled();
    } catch (error) {
      logger.error('AI Service isEnabled check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Process a message and generate response
   */
  async processMessage(content, context) {
    try {
      return await this.paiResponder.processMessage(content, context);
    } catch (error) {
      logger.error('AI Service processMessage failed', {
        error: error.message,
        context
      });
      throw error;
    }
  }

  /**
   * Get AI service status and configuration
   */
  async getStatus() {
    try {
      return await this.paiResponder.getStatus();
    } catch (error) {
      logger.error('AI Service getStatus failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AIService();