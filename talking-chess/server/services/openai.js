/**
 * OpenAI Service - Talking Chess Chat Mentor
 * Handles OpenAI API integration for Irina chess mentor
 * Now with tool calling support for grounded chess analysis
 */

const { OpenAI } = require('openai');
const config = require('../config');
const { toolDefinitions, executeTool } = require('../tools');

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
   * Generate chat response using OpenAI GPT with tool calling support
   * @param {string} systemPrompt - System prompt with context
   * @param {string} userMessage - User's message
   * @param {Array} chatHistory - Previous chat messages
   * @param {Object} [gameContext] - Game context for tool execution (fen, studentColor)
   * @returns {Promise<string>} - AI response
   */
  async generateChatResponse(systemPrompt, userMessage, chatHistory = [], gameContext = null) {
    try {
      // Format messages for OpenAI API
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Filter out contaminated chat history (bad assistant responses that ask for position info)
      // These are hallucinations from before the prompt was fixed
      const badPatterns = [
        'provide the current position',
        'provide your position',
        'tell me the position',
        'tell me what position',
        'share the position',
        'what is the current position',
        'what position are you'
      ];

      const filteredHistory = chatHistory.filter(msg => {
        if (msg.sender === 'assistant') {
          const content = (msg.message || msg.content || '').toLowerCase();
          return !badPatterns.some(pattern => content.includes(pattern));
        }
        return true;
      });

      // Add filtered chat history
      filteredHistory.forEach(msg => {
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

      // If we have game context, use tool calling
      if (gameContext && gameContext.fen && gameContext.studentColor) {
        return await this.generateWithTools(messages, gameContext);
      }

      // Fall back to simple completion without tools
      return await this.simpleCompletion(messages);
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
   * Simple completion without tools (backward compatible)
   * @param {Array} messages - Formatted messages
   * @returns {Promise<string>} - AI response
   */
  async simpleCompletion(messages) {
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
  }

  /**
   * Generate response with tool calling loop
   * Executes tools until Irina produces a final response
   * @param {Array} messages - Initial messages
   * @param {Object} gameContext - Game context for tool execution
   * @returns {Promise<string>} - AI response
   */
  async generateWithTools(messages, gameContext) {
    const maxIterations = 5; // Prevent infinite loops
    let currentMessages = [...messages];

    console.log('[OPENAI] Starting tool-enabled chat with context:', {
      fen: gameContext.fen?.substring(0, 30) + '...',
      studentColor: gameContext.studentColor
    });

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',  // Use gpt-4o for better tool calling
        messages: currentMessages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        max_tokens: 500,
        temperature: 0.7
      });

      const assistantMessage = response.choices[0].message;
      currentMessages.push(assistantMessage);

      // If no tool calls, we have the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        console.log('[OPENAI] Final response after', i + 1, 'iteration(s)');
        return assistantMessage.content?.trim() || "I'm having trouble formulating a response.";
      }

      // Process each tool call
      console.log('[OPENAI] Processing', assistantMessage.tool_calls.length, 'tool call(s)');

      for (const toolCall of assistantMessage.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (parseError) {
          console.warn('[OPENAI] Failed to parse tool arguments:', parseError.message);
        }

        const result = await executeTool(
          toolCall.function.name,
          args,
          gameContext
        );

        console.log('[OPENAI] Tool result for', toolCall.function.name, ':',
          JSON.stringify(result).substring(0, 100) + '...'
        );

        // Add tool result to conversation
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    // Fallback if max iterations reached
    console.warn('[OPENAI] Max iterations reached without final response');
    return "I'm having trouble analyzing this position right now.";
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