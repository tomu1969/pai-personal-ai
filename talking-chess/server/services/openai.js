/**
 * OpenAI Service - Talking Chess Chat Mentor
 * Handles OpenAI API integration for Irina chess mentor
 */

const { OpenAI } = require('openai');
const config = require('../config');

class OpenAIService {
  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }

  /**
   * Generate chat response using OpenAI GPT
   * @param {string} systemPrompt - System prompt with context
   * @param {string} userMessage - User's message
   * @param {Array} chatHistory - Previous chat messages
   * @returns {Promise<string>} - AI response
   */
  async generateChatResponse(systemPrompt, userMessage, chatHistory = []) {
    try {
      // Format messages for OpenAI API
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add chat history
      chatHistory.forEach(msg => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message || msg.content
        });
      });

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      // Call OpenAI API
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      });

      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Provide graceful fallback response
      if (error.code === 'insufficient_quota') {
        return "I'm experiencing some technical difficulties with my chess analysis. Please try again shortly.";
      } else if (error.code === 'rate_limit_exceeded') {
        return "I'm thinking too hard! Please give me a moment and try again.";
      } else {
        return "I'm having trouble analyzing this position right now. Could you rephrase your question?";
      }
    }
  }

  /**
   * Validate API connection
   * @returns {Promise<boolean>} - True if connection is valid
   */
  async validateConnection() {
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });
      return true;
    } catch (error) {
      console.error('OpenAI connection validation failed:', error);
      return false;
    }
  }
}

module.exports = OpenAIService;