const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const messageSearchService = require('../services/messageSearch');
const logger = require('../utils/logger');

class SimplifiedPaiAssistant {
  constructor() {
    // Load system prompt
    this.systemPrompt = fs.readFileSync(
      path.join(__dirname, '../../prompts/pai_assistant.md'),
      'utf8'
    );

    // Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.model = 'gpt-4o-mini';
    
    // Conversation history
    this.conversationHistory = [
      { role: 'system', content: this.systemPrompt }
    ];

    logger.info('Simplified PAI Assistant initialized');
  }

  /**
   * Define the search_messages function for OpenAI function calling
   */
  getFunctionDefinition() {
    return {
      name: 'search_messages',
      description: 'Search WhatsApp messages based on time period, sender, and keywords',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format, keywords: "today", "yesterday", or relative: "2 days ago", "1 week ago". IMPORTANT: Always use current year (2025), never use past years like 2023.',
          },
          end_date: {
            type: 'string', 
            description: 'End date in YYYY-MM-DD format, keywords: "today", "yesterday", or relative: "2 days ago", "1 week ago". IMPORTANT: Always use current year (2025), never use past years like 2023.',
          },
          start_time: {
            type: 'string',
            description: 'Start time in HH:MM format (default: 00:00)',
            default: '00:00',
          },
          end_time: {
            type: 'string',
            description: 'End time in HH:MM format (default: 23:59)',
            default: '23:59',
          },
          sender: {
            type: 'string',
            description: 'Contact name to filter by, or "all" for all contacts (default: all)',
            default: 'all',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords to search for in message content (default: [])',
            default: [],
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return (default: 50)',
            default: 50,
            minimum: 1,
            maximum: 200,
          },
          fresh_search: {
            type: 'boolean',
            description: 'Force fresh search instead of using conversation context (default: false)',
            default: false,
          },
        },
        required: ['start_date', 'end_date'],
      },
    };
  }

  /**
   * Process a user message and return response
   */
  async processMessage(userMessage) {
    try {
      logger.info('Processing PAI Assistant message', {
        messageLength: userMessage.length,
        timestamp: new Date().toISOString(),
      });

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Keep conversation history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 21) { // 1 system + 20 messages
        this.conversationHistory.splice(1, 2); // Remove oldest user/assistant pair
      }

      // Make OpenAI request with function calling
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.conversationHistory,
        functions: [this.getFunctionDefinition()],
        function_call: 'auto', // Let AI decide when to call function
        temperature: 0.3,
        max_tokens: 800,
      });

      const choice = response.choices[0];
      
      // Check if AI wants to call search function
      if (choice.message.function_call) {
        return await this.handleFunctionCall(choice.message);
      } else {
        // Regular conversation response
        const assistantResponse = choice.message.content;
        
        this.conversationHistory.push({
          role: 'assistant',
          content: assistantResponse,
        });

        logger.info('PAI Assistant response generated', {
          responseLength: assistantResponse.length,
          tokensUsed: response.usage.total_tokens,
        });

        return {
          success: true,
          message: assistantResponse,
          type: 'conversation',
          tokensUsed: response.usage.total_tokens,
        };
      }

    } catch (error) {
      logger.error('PAI Assistant processing failed', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        message: "I'm sorry, I encountered an error processing your request. Please try again.",
        type: 'error',
      };
    }
  }

  /**
   * Handle function call from OpenAI
   */
  async handleFunctionCall(message) {
    try {
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments);

      logger.info('Handling function call', {
        functionName,
        arguments: functionArgs,
      });

      if (functionName === 'search_messages') {
        // Execute search
        const searchResults = await messageSearchService.searchMessages(functionArgs);
        
        if (searchResults.success) {
          // Format results for user
          const formattedResults = messageSearchService.formatResults(searchResults);
          const responseMessage = formattedResults || 'No messages found for the specified criteria.';

          // Add function call and result to conversation history
          this.conversationHistory.push({
            role: 'assistant',
            content: null,
            function_call: message.function_call,
          });

          this.conversationHistory.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              messageCount: searchResults.metadata.totalMessages,
              groupCount: searchResults.metadata.groupedConversations,
              formattedResults: responseMessage,
            }),
          });

          // Generate final response based on search results
          const finalResponse = await this.client.chat.completions.create({
            model: this.model,
            messages: this.conversationHistory,
            temperature: 0.3,
            max_tokens: 600,
          });

          const finalMessage = finalResponse.choices[0].message.content;
          
          this.conversationHistory.push({
            role: 'assistant', 
            content: finalMessage,
          });

          logger.info('Search function call completed', {
            messageCount: searchResults.metadata.totalMessages,
            groupCount: searchResults.metadata.groupedConversations,
            responseLength: finalMessage.length,
          });

          return {
            success: true,
            message: finalMessage,
            type: 'search_results',
            metadata: searchResults.metadata,
            tokensUsed: finalResponse.usage.total_tokens,
          };

        } else {
          // Search failed
          const errorMessage = `I encountered an error searching your messages: ${searchResults.error}`;
          
          this.conversationHistory.push({
            role: 'assistant',
            content: errorMessage,
          });

          return {
            success: false,
            message: errorMessage,
            type: 'search_error',
            error: searchResults.error,
          };
        }
      } else {
        throw new Error(`Unknown function: ${functionName}`);
      }

    } catch (error) {
      logger.error('Function call handling failed', {
        functionCall: message.function_call,
        error: error.message,
      });

      const errorMessage = "I had trouble processing your search request. Could you try rephrasing it?";
      
      this.conversationHistory.push({
        role: 'assistant',
        content: errorMessage,
      });

      return {
        success: false,
        message: errorMessage,
        type: 'function_error',
        error: error.message,
      };
    }
  }

  /**
   * Clear conversation history (for testing or reset)
   */
  clearHistory() {
    this.conversationHistory = [
      { role: 'system', content: this.systemPrompt }
    ];
    logger.info('PAI Assistant conversation history cleared');
  }

  /**
   * Get current conversation stats
   */
  getStats() {
    return {
      conversationLength: this.conversationHistory.length - 1, // Exclude system message
      systemPromptLength: this.systemPrompt.length,
      model: this.model,
      initialized: new Date().toISOString(),
    };
  }

  /**
   * Test the search function directly
   */
  async testSearch(params) {
    logger.info('Testing search function directly', { params });
    return await messageSearchService.searchMessages(params);
  }
}

module.exports = SimplifiedPaiAssistant;