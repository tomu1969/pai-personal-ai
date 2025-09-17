const PaiMortgageService = require('../../assistants/pai-mortgage/service');
const logger = require('../../utils/logger');

class PaiMortgageAdapter {
  constructor() {
    this.paiMortgage = new PaiMortgageService();
    this.isInitialized = false;
  }

  /**
   * Initialize the PAI Mortgage
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.paiMortgage.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Process assistant message (for web UI queries)
   * This method maintains compatibility with assistantMessageHandler.js
   * @param {string} content - User's query
   * @param {string} conversationId - Assistant conversation ID
   * @param {function} broadcastTyping - Typing indicator function
   * @param {function} broadcastMessage - Message broadcast function
   */
  async processAssistantMessage(content, conversationId, broadcastTyping, broadcastMessage) {
    try {
      await this.initialize();

      // Start typing indicator
      if (broadcastTyping) {
        broadcastTyping(conversationId, true, 'assistant');
      }

      logger.info('PAI Mortgage processing query', {
        content: content.substring(0, 100),
        conversationId,
      });

      // Process the query
      const result = await this.paiMortgage.processQuery(content, {
        conversationId,
        source: 'web_ui',
      });

      if (result.success) {
        // Broadcast the response
        const responseMessage = {
          id: `pai_mortgage_${Date.now()}`,
          conversationId,
          content: result.response,
          sender: 'assistant',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          metadata: {
            intent: result.intent,
            entities: result.entities,
            confidence: result.confidence,
            tokensUsed: result.tokensUsed,
            assistantType: result.assistantType,
            messageCount: result.messageCount,
          },
        };

        if (broadcastMessage) {
          broadcastMessage(conversationId, responseMessage);
        }

        logger.info('PAI Mortgage query processed successfully', {
          intent: result.intent,
          messageCount: result.messageCount,
          tokensUsed: result.tokensUsed,
        });

      } else {
        // Broadcast error message
        const errorMessage = {
          id: `pai_mortgage_error_${Date.now()}`,
          conversationId,
          content: `I'm sorry, I encountered an error processing your mortgage request: ${result.error || 'Unknown error'}`,
          sender: 'assistant',
          messageType: 'text',
          createdAt: new Date().toISOString(),
          metadata: {
            error: true,
            originalError: result.error,
          },
        };

        if (broadcastMessage) {
          broadcastMessage(conversationId, errorMessage);
        }

        logger.error('PAI Mortgage query failed', {
          content: content.substring(0, 100),
          error: result.error,
        });
      }

    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to process message', {
        content: content.substring(0, 100),
        conversationId,
        error: error.message,
        stack: error.stack,
      });

      // Broadcast error message
      const errorMessage = {
        id: `pai_mortgage_error_${Date.now()}`,
        conversationId,
        content: 'I\'m sorry, I encountered a technical error with your mortgage inquiry. Please try again later.',
        sender: 'assistant',
        messageType: 'text',
        createdAt: new Date().toISOString(),
        metadata: {
          error: true,
          technicalError: error.message,
        },
      };

      if (broadcastMessage) {
        broadcastMessage(conversationId, errorMessage);
      }

    } finally {
      // Stop typing indicator
      if (broadcastTyping) {
        broadcastTyping(conversationId, false, 'assistant');
      }
    }
  }

  /**
   * Parse intent from user message
   * Maintains compatibility with assistantAI.js interface
   * @param {string} userMessage - The user's message
   * @param {object} context - Additional context
   */
  async parseIntent(userMessage, context = {}) {
    try {
      await this.initialize();
      return await this.paiMortgage.parseIntent(userMessage, context);
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to parse intent', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate response with database results
   * Maintains compatibility with assistantAI.js interface
   * @param {string} userMessage - Original user message
   * @param {string} intent - Parsed intent
   * @param {object} entities - Extracted entities
   * @param {object} context - Database results and context
   */
  async generateResponse(userMessage, intent, entities, context = {}) {
    try {
      await this.initialize();
      return await this.paiMortgage.generateResponse(userMessage, intent, entities, context);
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to generate response', {
        intent,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get assistant configuration
   * Maintains compatibility with existing assistant service interface
   */
  async getStatus() {
    try {
      await this.initialize();
      const config = await this.paiMortgage.getConfig();
      
      // Return in format expected by existing code
      return {
        id: config.id,
        enabled: config.enabled,
        ownerName: config.ownerName,
        assistantName: config.assistantName,
        systemPrompt: config.systemPrompt || this.paiMortgage.systemPrompt,
        qualificationsProcessed: config.qualificationsProcessed,
        lastActivity: config.lastActivity,
        mortgageSettings: config.mortgageSettings,
        querySettings: config.querySettings,
      };
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to get status', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get qualification report for a user's mortgage inquiry
   * @param {object} options - Qualification options
   */
  async getQualificationReport(options = {}) {
    try {
      await this.initialize();
      return await this.paiMortgage.getQualificationReport(options);
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to get qualification report', {
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get assistant statistics
   */
  async getStats() {
    try {
      await this.initialize();
      return await this.paiMortgage.getStats();
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to get stats', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Check if assistant is enabled
   */
  async isEnabled() {
    try {
      await this.initialize();
      return await this.paiMortgage.isEnabled();
    } catch (error) {
      logger.error('PAI Mortgage Adapter failed to check if enabled', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Ensure assistant is initialized (for backward compatibility)
   */
  async ensureInitialized() {
    await this.initialize();
    return this;
  }
}

module.exports = new PaiMortgageAdapter();