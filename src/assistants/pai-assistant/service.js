const { OpenAI } = require('openai');
const BaseAssistant = require('../shared/base-assistant');
const { PaiAssistant } = require('../../models');
const { ASSISTANT_TYPES, RESPONSE_FORMATS } = require('../shared/types');
const messageRetrieval = require('../../services/messageRetrieval');
const logger = require('../../utils/logger');

class PaiAssistantService extends BaseAssistant {
  constructor() {
    super('PAI Assistant', 'pai_assistant.md');
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4o-mini';
    this.currentConfig = null;
  }

  /**
   * Get PAI Assistant configuration from database
   */
  async getConfig() {
    if (!this.currentConfig) {
      const [assistant] = await PaiAssistant.findOrCreate({
        where: {},
        defaults: {
          enabled: true,
          ownerName: process.env.OWNER_NAME || 'Owner',
          assistantName: 'PAI Assistant',
          summarySettings: {
            defaultTimeframe: 24,
            format: 'chronological',
            includeCategories: ['personal', 'business', 'support', 'sales', 'inquiry'],
            includePriorities: ['urgent', 'high', 'medium', 'low'],
            showActionItems: true,
            showAssistantActivity: false,
            maxMessagesPerSummary: 100,
          },
          querySettings: {
            defaultLimit: 50,
            maxLimit: 200,
            enableTimeframeFallback: true,
            defaultSearchDepth: 'week',
          },
        },
      });
      this.currentConfig = assistant;
    }
    return this.currentConfig;
  }

  /**
   * Parse user intent and extract entities
   * @param {string} userMessage - The user's message
   * @param {object} context - Additional context
   */
  async parseIntent(userMessage, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      // Use the existing assistantAI logic but with PAI Assistant configuration
      const assistantAI = require('../../services/assistantAI');
      
      logger.info('PAI Assistant parsing intent', {
        messageLength: userMessage.length,
        context,
      });

      const result = await assistantAI.parseIntent(userMessage, {
        ...context,
        assistantConfig: config,
        systemPrompt: this.personalizePrompt({
          ownerName: config.ownerName,
          assistantName: config.assistantName,
        }),
      });

      // Update activity tracking
      await this.updateActivity();

      return {
        ...result,
        assistantType: ASSISTANT_TYPES.PAI_ASSISTANT,
      };

    } catch (error) {
      logger.error('PAI Assistant failed to parse intent', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Generate AI response with database results
   * @param {string} userMessage - Original user message
   * @param {string} intent - Parsed intent
   * @param {object} entities - Extracted entities
   * @param {object} context - Database query results and context
   */
  async generateResponse(userMessage, intent, entities, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      logger.info('PAI Assistant generating response', {
        intent,
        hasDbResults: !!context.messages,
        messageCount: context.messages?.length || 0,
      });

      // Use the existing assistantAI logic but with PAI Assistant configuration
      const assistantAI = require('../../services/assistantAI');
      
      const result = await assistantAI.generateResponse(userMessage, intent, entities, {
        ...context,
        assistantConfig: config,
        systemPrompt: this.personalizePrompt({
          ownerName: config.ownerName,
          assistantName: config.assistantName,
        }),
      });

      // Update activity tracking
      await this.updateActivity();

      return {
        ...result,
        assistantType: ASSISTANT_TYPES.PAI_ASSISTANT,
      };

    } catch (error) {
      logger.error('PAI Assistant failed to generate response', {
        intent,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Process a complete query from intent parsing to response generation
   * @param {string} userMessage - The user's query
   * @param {object} context - Additional context
   */
  async processQuery(userMessage, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      if (!config.enabled) {
        logger.debug('PAI Assistant is disabled');
        return {
          success: false,
          reason: 'assistant_disabled',
        };
      }

      // Step 1: Parse intent and extract entities
      const intentResult = await this.parseIntent(userMessage, context);
      
      if (!intentResult.success) {
        return intentResult;
      }

      // Step 2: Retrieve relevant data from database
      const retrievalResult = await messageRetrieval.retrieveMessages(
        intentResult.intent,
        intentResult.entities,
        {
          ...context,
          conversationId: context.conversationId || '00000000-0000-0000-0000-000000000001',
          contactId: context.contactId || '00000000-0000-0000-0000-000000000001',
          includeAssistantMessages: false,
        },
        userMessage // Pass original message for fallback detection
      );

      // Step 3: Generate response with database results
      let responseResult;
      if (retrievalResult.success) {
        responseResult = await this.generateResponse(
          userMessage,
          intentResult.intent,
          intentResult.entities,
          {
            messages: retrievalResult.messages,
            contacts: retrievalResult.contacts,
            conversations: retrievalResult.conversations,
            metadata: retrievalResult.metadata,
            assistantConfig: config,
          }
        );
      } else {
        // Generate response without database results
        responseResult = await this.generateResponse(
          userMessage,
          intentResult.intent,
          intentResult.entities,
          {
            assistantConfig: config,
            error: retrievalResult.error,
          }
        );
      }

      return {
        success: true,
        intent: intentResult.intent,
        entities: intentResult.entities,
        confidence: intentResult.confidence,
        response: responseResult.responseMessage,
        tokensUsed: (intentResult.tokensUsed || 0) + (responseResult.tokensUsed || 0),
        assistantType: ASSISTANT_TYPES.PAI_ASSISTANT,
        retrievalSuccess: retrievalResult.success,
        messageCount: retrievalResult.messages?.length || 0,
      };

    } catch (error) {
      logger.error('PAI Assistant failed to process query', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        assistantType: ASSISTANT_TYPES.PAI_ASSISTANT,
      };
    }
  }

  /**
   * Get summary of recent messages
   * @param {object} options - Summary options
   */
  async getSummary(options = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      const summaryOptions = {
        timeframe: options.timeframe || config.summarySettings.defaultTimeframe,
        format: options.format || config.summarySettings.format,
        maxMessages: options.maxMessages || config.summarySettings.maxMessagesPerSummary,
        includeCategories: options.includeCategories || config.summarySettings.includeCategories,
        includePriorities: options.includePriorities || config.summarySettings.includePriorities,
      };

      const summaryQuery = `summarize messages from the last ${summaryOptions.timeframe} hours in ${summaryOptions.format} format`;
      
      return await this.processQuery(summaryQuery, {
        summaryMode: true,
        summaryOptions,
      });

    } catch (error) {
      logger.error('PAI Assistant failed to generate summary', {
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update activity tracking
   */
  async updateActivity() {
    try {
      await PaiAssistant.increment('queriesProcessed', { where: {} });
      await PaiAssistant.update(
        { lastActivity: new Date() },
        { where: {} }
      );
    } catch (error) {
      logger.error('Failed to update PAI Assistant activity', {
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
   * Get assistant statistics
   */
  async getStats() {
    try {
      const config = await this.getConfig();
      return {
        enabled: config.enabled,
        queriesProcessed: config.queriesProcessed,
        lastActivity: config.lastActivity,
        summarySettings: config.summarySettings,
        querySettings: config.querySettings,
        assistantType: ASSISTANT_TYPES.PAI_ASSISTANT,
      };
    } catch (error) {
      logger.error('Failed to get PAI Assistant stats', {
        error: error.message,
      });
      return null;
    }
  }
}

module.exports = PaiAssistantService;