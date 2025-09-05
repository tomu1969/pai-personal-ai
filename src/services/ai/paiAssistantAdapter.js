const PaiAssistantService = require('../../assistants/pai-assistant/service');
const logger = require('../../utils/logger');

class PaiAssistantAdapter {
  constructor() {
    this.paiAssistant = new PaiAssistantService();
    this.isInitialized = false;
  }

  /**
   * Initialize the PAI Assistant
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.paiAssistant.initialize();
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

      logger.info('PAI Assistant processing query', {
        content: content.substring(0, 100),
        conversationId,
      });

      // Process the query
      const result = await this.paiAssistant.processQuery(content, {
        conversationId,
        source: 'web_ui',
      });

      if (result.success) {
        // Broadcast the response
        const responseMessage = {
          id: `pai_assistant_${Date.now()}`,
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

        logger.info('PAI Assistant query processed successfully', {
          intent: result.intent,
          messageCount: result.messageCount,
          tokensUsed: result.tokensUsed,
        });

      } else {
        // Broadcast error message
        const errorMessage = {
          id: `pai_assistant_error_${Date.now()}`,
          conversationId,
          content: `I'm sorry, I encountered an error processing your request: ${result.error || 'Unknown error'}`,
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

        logger.error('PAI Assistant query failed', {
          content: content.substring(0, 100),
          error: result.error,
        });
      }

    } catch (error) {
      logger.error('PAI Assistant Adapter failed to process message', {
        content: content.substring(0, 100),
        conversationId,
        error: error.message,
        stack: error.stack,
      });

      // Broadcast error message
      const errorMessage = {
        id: `pai_assistant_error_${Date.now()}`,
        conversationId,
        content: 'I\'m sorry, I encountered a technical error. Please try again later.',
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
      return await this.paiAssistant.parseIntent(userMessage, context);
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to parse intent', {
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
      return await this.paiAssistant.generateResponse(userMessage, intent, entities, context);
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to generate response', {
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
      const config = await this.paiAssistant.getConfig();
      
      // Return in format expected by existing code
      return {
        id: config.id,
        enabled: config.enabled,
        ownerName: config.ownerName,
        assistantName: config.assistantName,
        systemPrompt: config.systemPrompt || this.paiAssistant.systemPrompt,
        queriesProcessed: config.queriesProcessed,
        lastActivity: config.lastActivity,
        summarySettings: config.summarySettings,
        querySettings: config.querySettings,
      };
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to get status', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get summary of messages
   * @param {object} options - Summary options
   */
  async getSummary(options = {}) {
    try {
      await this.initialize();
      return await this.paiAssistant.getSummary(options);
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to get summary', {
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
      return await this.paiAssistant.getStats();
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to get stats', {
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
      return await this.paiAssistant.isEnabled();
    } catch (error) {
      logger.error('PAI Assistant Adapter failed to check if enabled', {
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

module.exports = new PaiAssistantAdapter();