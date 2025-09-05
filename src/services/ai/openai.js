/**
 * @file openai.js
 * @description OpenAI API service for direct API communication and message generation
 * @module services/ai/openai
 * @requires axios - HTTP client for API requests
 * @requires ../config - Application configuration
 * @requires ../utils/logger - Logging utility
 * @exports AIService
 * @author PAI System
 * @since September 2025
 */

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * OpenAI API service for direct API communication
 * Provides low-level OpenAI API integration with error handling and timeout management
 * 
 * Features:
 * - Direct OpenAI API communication via axios
 * - Configurable timeout and retry handling
 * - Message generation with conversation context
 * - API key validation and status checking
 * 
 * @class AIService
 * @example
 * const aiService = new AIService();
 * const response = await aiService.generateResponse('Hello', { temperature: 0.7 });
 */
class AIService {
  /**
   * Initialize OpenAI service with API key validation and HTTP client setup
   * @constructor
   */
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || config.openai.apiKey;
    
    logger.debug('AI Service Constructor Debug', {
      envKey: process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'undefined',
      configKey: config.openai.apiKey ? `${config.openai.apiKey.substring(0, 10)}...` : 'undefined',
      finalKey: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'undefined',
      keyIncludesYourApi: this.apiKey ? this.apiKey.includes('your-api') : 'N/A'
    });
    
    if (!this.apiKey || this.apiKey.includes('your-api')) {
      logger.warn('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
      this.enabled = false;
      return;
    }

    this.model = config.openai.model || 'gpt-3.5-turbo';
    this.enabled = !!this.apiKey;

    logger.info('AI Service initialized (Ultra Simple Mode)', {
      enabled: this.enabled,
      keyPresent: !!this.apiKey,
      keyStart: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'none',
      model: this.model,
    });

    if (this.enabled) {
      this.client = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
  }

  /**
   * Check if AI service is available
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Ultra-simple message response generation
   * No complex analysis - just direct message to AI with full context
   * @param {string} messageContent - The message content
   * @param {object} context - Simple context object
   * @returns {string} Generated response or null
   */
  async generateResponse(messageContent, context = {}) {
    if (!this.enabled) {
      return null;
    }

    try {
      // Build simple system prompt with ALL context
      const systemPrompt = this.buildSimpleSystemPrompt(context);
      
      // Build conversation context for natural flow
      const conversationHistory = this.buildConversationHistory(context.recentMessages || []);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: messageContent }
      ];

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 300,
      });

      const generatedResponse = response.data.choices[0]?.message?.content;

      if (!generatedResponse) {
        throw new Error('Empty AI response received');
      }

      logger.info('Simple AI response generated', {
        originalLength: messageContent.length,
        responseLength: generatedResponse.length,
        tokensUsed: response.data.usage?.total_tokens,
        senderName: context.senderName,
      });

      return generatedResponse.trim();
    } catch (error) {
      logger.error('AI response generation failed', {
        error: error.message,
        contentLength: messageContent.length,
        senderName: context.senderName,
      });
      return null;
    }
  }

  /**
   * Ultra-simple decision: should PAI respond to this message?
   * Default to YES unless explicitly a greeting acknowledgment
   * @param {string} messageContent - Message to analyze
   * @param {object} context - Context information
   * @returns {boolean} Should respond
   */
  async shouldRespond(messageContent, context = {}) {
    if (!this.enabled) {
      return true; // When AI disabled, always try to respond
    }

    // Simple rules - let the system prompt handle everything else
    const lowerContent = messageContent.toLowerCase().trim();
    
    // Don't respond to very short acknowledgments if conversation seems complete
    const isShortAcknowledgment = ['ok', 'gracias', 'thanks', 'perfecto', 'perfect', 'bien', 'good'].includes(lowerContent);
    if (isShortAcknowledgment && context.seemsComplete) {
      return false;
    }

    // Always respond to everything else - let PAI decide through the system prompt
    return true;
  }

  /**
   * Build simple system prompt with all necessary context
   * @param {object} context - Context information
   * @returns {string} System prompt
   */
  buildSimpleSystemPrompt(context) {
    const ownerName = context.ownerName || 'Tomás';
    const senderName = context.senderName || 'the sender';
    const isSpanish = this.detectSpanish(context.lastMessage || '');

    // Use the configured system prompt from the assistant settings
    const configuredPrompt = context.systemPrompt || context.ownerSystemPrompt || 
      `Your name is PAI. You are a personal AI assistant that answers WhatsApp messages on behalf of your owner, ${ownerName}.

Always greet each sender by their name. 

Always reply in the same language as the last message received. Always identify yourself as "Pai, ${ownerName}' Assistant" if in English, or "Pai, el asistente de ${ownerName}" if in Spanish. 

Keep responses polite, concise, and professional, adjusting tone to match the sender (casual if casual, formal if formal). 

**Always** ask relevant follow-up questions to clarify intent or move the conversation forward. If the sender message is vague, ask for clarification instead of assuming. Suggest next steps only when appropriate.

Only stop asking once you've clarified the sender's intention or request.

Once you've clarified the sender's request or intent, paraphrase it and express that you will convey it to ${ownerName} so he can get back to the sender.`;

    return `${configuredPrompt}

CURRENT CONTEXT:
- You are responding to: ${senderName}
- Owner: ${ownerName}
- Language preference: ${isSpanish ? 'Spanish' : 'English'} (match the sender's language)
- Current time: ${new Date().toLocaleString()}

CRITICAL REQUIREMENTS - MUST FOLLOW:
1. ALWAYS identify yourself as "Pai, ${ownerName}' Assistant" or "Pai, el asistente de ${ownerName}" in EVERY response
2. ALWAYS use the sender's name (${senderName}) naturally in your response
3. Continue conversations until you have complete information
4. Match the sender's language: ${isSpanish ? 'Spanish' : 'English'}
5. Ask clarifying questions for vague requests
6. Never respond without including your PAI identity

Example format:
- Spanish: "¡Hola ${senderName}! Soy Pai, el asistente de ${ownerName}. [your response]"
- English: "Hello ${senderName}! I'm Pai, ${ownerName}' Assistant. [your response]"

Respond to the following message following these requirements EXACTLY.`;
  }

  /**
   * Build conversation history from recent messages for context
   * @param {Array} recentMessages - Array of recent message objects or string
   * @returns {Array} Formatted messages for OpenAI
   */
  buildConversationHistory(recentMessages) {
    if (!recentMessages || recentMessages.length === 0) {
      return [];
    }

    // If it's a string (legacy format), return empty for now
    if (typeof recentMessages === 'string') {
      return [];
    }

    // Convert recent messages to OpenAI format
    const history = [];
    
    // Take only the last 8 messages to avoid token limits
    const latestMessages = recentMessages.slice(-8);
    
    for (const msg of latestMessages) {
      if (msg.sender === 'user') {
        history.push({ role: 'user', content: msg.content });
      } else if (msg.sender === 'assistant') {
        history.push({ role: 'assistant', content: msg.content });
      }
    }

    return history;
  }

  /**
   * Detect if content is Spanish
   * @param {string} content - Content to analyze
   * @returns {boolean} Is Spanish
   */
  detectSpanish(content) {
    if (!content) return false;
    
    const spanishIndicators = /[ñáéíóúü¿¡]|hola|gracias|necesito|quiero|puedo|hablar|ayuda/i;
    return spanishIndicators.test(content);
  }

  /**
   * Get AI service statistics
   */
  async getServiceStats() {
    return {
      enabled: this.enabled,
      model: this.model,
      apiKeyConfigured: !!this.apiKey,
      mode: 'ultra-simple',
    };
  }

  /**
   * Test AI connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'AI service not configured' };
    }

    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Hello, please respond with "AI service is working"',
          },
        ],
        max_tokens: 20,
      });

      const content = response.data.choices[0]?.message?.content;

      return {
        success: true,
        model: this.model,
        response: content,
        tokensUsed: response.data.usage?.total_tokens,
        mode: 'ultra-simple',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
      };
    }
  }
}

// Export singleton instance
module.exports = new AIService();