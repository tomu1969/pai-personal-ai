const fs = require('fs');
const path = require('path');
// Force load .env file, override existing environment variables  
require('dotenv').config({ override: true });
const { OpenAI } = require('openai');
const logger = require('../utils/logger');

class WhatsAppAssistant {
  constructor() {
    // Load system prompt
    this.systemPrompt = fs.readFileSync(
      path.join(__dirname, '../../prompts/pai_responder.md'),
      'utf8'
    );

    // Init OpenAI client
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Conversation histories by contact phone
    this.conversationHistories = new Map();
    
    logger.info('WhatsApp Assistant initialized with OpenAI');
  }

  /**
   * Get or create conversation history for a contact
   */
  getConversationHistory(contactPhone, assistantConfig = {}) {
    if (!this.conversationHistories.has(contactPhone)) {
      // Create personalized system prompt with assistant configuration
      const personalizedPrompt = this.systemPrompt
        .replace(/{{owner_name}}/g, assistantConfig.ownerName || 'the owner')
        .replace(/{{assistant_name}}/g, assistantConfig.assistantName || 'PAI');
      
      this.conversationHistories.set(contactPhone, [
        { role: 'system', content: personalizedPrompt }
      ]);
      
      logger.debug('Created new conversation history', { contactPhone, assistantName: assistantConfig.assistantName });
    }
    return this.conversationHistories.get(contactPhone);
  }

  /**
   * Process a WhatsApp message and generate AI response
   * @param {string} message - User's message content
   * @param {string} contactPhone - Contact phone number
   * @param {object} assistantConfig - Assistant configuration from database
   * @returns {Promise<string>} AI generated response
   */
  async processMessage(message, contactPhone, assistantConfig = {}) {
    try {
      logger.info('Processing WhatsApp message', { 
        contactPhone, 
        messageLength: message.length,
        assistantName: assistantConfig.assistantName,
        contactName: assistantConfig.contactName 
      });

      // Get conversation history for this contact
      const history = this.getConversationHistory(contactPhone, assistantConfig);
      
      // Add user message to history with sender context if available
      const userMessage = assistantConfig.contactName 
        ? `${assistantConfig.contactName}: ${message}`
        : message;
      history.push({ role: 'user', content: userMessage });

      // Keep history manageable (last 20 messages + system prompt)
      if (history.length > 21) {
        // Keep system prompt and last 20 messages
        const systemPrompt = history[0];
        const recentMessages = history.slice(-20);
        history.length = 0;
        history.push(systemPrompt, ...recentMessages);
      }

      // Generate AI response
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: history,
        temperature: 0.7,
        max_tokens: 500
      });

      const aiResponse = response.choices[0].message.content;
      
      // Add AI response to history
      history.push({ role: 'assistant', content: aiResponse });

      logger.info('WhatsApp Assistant response generated', {
        contactPhone,
        responseLength: aiResponse.length,
        tokensUsed: response.usage.total_tokens
      });

      return aiResponse;

    } catch (error) {
      logger.error('Error processing WhatsApp message', {
        error: error.message,
        contactPhone,
        messageLength: message.length
      });
      
      // Return friendly error message
      return "I'm having trouble processing your message right now. Please try again in a moment.";
    }
  }

  /**
   * Clear conversation history for a contact
   */
  clearConversationHistory(contactPhone) {
    this.conversationHistories.delete(contactPhone);
    logger.debug('Cleared conversation history', { contactPhone });
  }

  /**
   * Clear all conversation histories
   */
  clearAllConversationHistories() {
    const count = this.conversationHistories.size;
    this.conversationHistories.clear();
    logger.info('Cleared all conversation histories', { count });
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    return {
      activeConversations: this.conversationHistories.size,
      totalMessages: Array.from(this.conversationHistories.values())
        .reduce((total, history) => total + history.length - 1, 0) // -1 for system prompt
    };
  }
}

// Export singleton instance
module.exports = new WhatsAppAssistant();
