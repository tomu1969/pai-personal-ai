const SimplifiedPaiAssistant = require('../../assistants/pai-assistant-simplified');
const messageSearchService = require('../database/messageSearch');
const logger = require('../../utils/logger');

/**
 * PAI Assistant WhatsApp Service
 * Handles WhatsApp messages for PAI Assistant instance
 */
class PaiAssistantWhatsAppService {
  constructor() {
    this.paiAssistant = null;
    this.conversationHistory = new Map(); // Per-user conversation history
    this.initialized = false;
  }

  /**
   * Initialize the PAI Assistant service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.paiAssistant = new SimplifiedPaiAssistant();
      this.initialized = true;

      logger.info('PAI Assistant WhatsApp service initialized');
    } catch (error) {
      logger.error('Failed to initialize PAI Assistant WhatsApp service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message for PAI Assistant
   */
  async processWhatsAppMessage(parsedMessage) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { phone, content, pushName } = parsedMessage;
      const userKey = this.getUserKey(phone, pushName);

      logger.info('Processing PAI Assistant WhatsApp message', {
        userKey,
        phone,
        messageLength: content.length
      });

      // Get or create user conversation context
      let userAssistant = this.conversationHistory.get(userKey);
      if (!userAssistant) {
        userAssistant = new SimplifiedPaiAssistant();
        this.conversationHistory.set(userKey, userAssistant);

        logger.info('Created new PAI Assistant conversation', {
          userKey,
          phone,
          userName: pushName
        });
      }

      // Process the message using SimplifiedPaiAssistant
      const result = await userAssistant.processMessage(content);

      if (result.success) {
        // Format response for WhatsApp
        const formattedResponse = this.formatResponseForWhatsApp(result, content);
        
        logger.info('PAI Assistant processed WhatsApp message successfully', {
          userKey,
          messageType: result.type,
          responseLength: formattedResponse.length,
          tokensUsed: result.tokensUsed
        });

        return {
          success: true,
          response: formattedResponse,
          messageType: result.type,
          metadata: result.metadata,
          tokensUsed: result.tokensUsed
        };
      } else {
        const errorResponse = this.formatErrorForWhatsApp(result.error, content);
        
        logger.warn('PAI Assistant failed to process message', {
          userKey,
          error: result.error,
          message: result.message
        });

        return {
          success: true, // Still send response to user
          response: errorResponse,
          messageType: 'error'
        };
      }

    } catch (error) {
      logger.error('PAI Assistant WhatsApp processing error', {
        phone: parsedMessage.phone,
        error: error.message,
        stack: error.stack
      });

      return {
        success: true,
        response: "I'm sorry, I encountered an error processing your request. Please try again or rephrase your query.",
        messageType: 'system_error'
      };
    }
  }

  /**
   * Format PAI Assistant response for WhatsApp display
   */
  formatResponseForWhatsApp(result, originalMessage) {
    const { message, type, metadata } = result;

    // Add header for different message types
    let formattedMessage = '';

    switch (type) {
      case 'search_results':
        if (metadata && metadata.totalMessages > 0) {
          formattedMessage += `📱 *Message Search Results*\n\n`;
          formattedMessage += message;
          formattedMessage += `\n\n📊 Found: ${metadata.totalMessages} messages`;
          if (metadata.groupedConversations) {
            formattedMessage += `, ${metadata.groupedConversations} conversations`;
          }
        } else {
          formattedMessage = `📱 *No Messages Found*\n\nNo messages match your search criteria. Try:\n• Different contact name\n• Different time period\n• Broader keywords`;
        }
        break;

      case 'conversation':
        formattedMessage = `💬 ${message}`;
        break;

      default:
        formattedMessage = message;
    }

    // Add PAI signature at the end
    formattedMessage += '\n\n_PAI Assistant_';

    return formattedMessage;
  }

  /**
   * Format error message for WhatsApp
   */
  formatErrorForWhatsApp(error, originalMessage) {
    let formattedError = `❌ *Sorry, I couldn't process your request*\n\n`;

    // Provide helpful error messages based on error type
    if (error.includes('date')) {
      formattedError += `It looks like there was an issue with the date in your request. Please try:\n• "messages from today"\n• "messages from yesterday"\n• "messages from 2 days ago"\n• "messages from last week"`;
    } else if (error.includes('contact') || error.includes('sender')) {
      formattedError += `I couldn't find that contact. Please check the name or try:\n• Using partial names\n• "messages from all contacts"\n• Different spelling`;
    } else {
      formattedError += `Please try rephrasing your request. Examples:\n• "What messages did I get today?"\n• "Show me messages from John yesterday"\n• "Messages containing 'meeting' from this week"`;
    }

    formattedError += '\n\n_PAI Assistant_';
    return formattedError;
  }

  /**
   * Generate unique key for user conversation tracking
   */
  getUserKey(phone, pushName) {
    // Use phone as primary key, with pushName as fallback identifier
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const userName = pushName || 'unknown';
    return `${cleanPhone}_${userName.replace(/\s+/g, '_')}`;
  }

  /**
   * Clear conversation history for a user
   */
  clearUserConversation(phone, pushName) {
    const userKey = this.getUserKey(phone, pushName);
    if (this.conversationHistory.has(userKey)) {
      this.conversationHistory.delete(userKey);
      logger.info('Cleared PAI Assistant conversation history', {
        userKey,
        phone,
        userName: pushName
      });
      return true;
    }
    return false;
  }

  /**
   * Get conversation statistics
   */
  getConversationStats() {
    const stats = {
      initialized: this.initialized,
      activeConversations: this.conversationHistory.size,
      conversations: []
    };

    for (const [userKey, assistant] of this.conversationHistory.entries()) {
      const assistantStats = assistant.getStats();
      stats.conversations.push({
        userKey,
        ...assistantStats
      });
    }

    return stats;
  }

  /**
   * Clean up old conversation histories (run periodically)
   */
  cleanupOldConversations(maxAgeHours = 24) {
    const cutoff = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleaned = 0;

    for (const [userKey, assistant] of this.conversationHistory.entries()) {
      const stats = assistant.getStats();
      const lastActivity = new Date(stats.initialized);
      
      if (lastActivity < cutoff) {
        this.conversationHistory.delete(userKey);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old PAI Assistant conversations', {
        cleaned,
        remaining: this.conversationHistory.size,
        maxAgeHours
      });
    }

    return cleaned;
  }

  /**
   * Handle special commands (reset, help, etc.)
   */
  async handleSpecialCommands(content, phone, pushName) {
    const lowerContent = content.toLowerCase().trim();

    switch (lowerContent) {
      case 'reset':
      case '/reset':
        this.clearUserConversation(phone, pushName);
        return {
          success: true,
          response: '🔄 *Conversation Reset*\n\nYour conversation history has been cleared. You can start fresh!\n\n_PAI Assistant_',
          messageType: 'command'
        };

      case 'help':
      case '/help':
        const helpMessage = `🤖 *PAI Assistant Help*\n\nI can help you search and summarize your WhatsApp messages. Try asking:\n\n📱 *Message Queries:*\n• "What messages did I get today?"\n• "Show me messages from John yesterday"\n• "Messages containing 'meeting' from this week"\n• "Messages from last 2 hours"\n\n⚙️ *Commands:*\n• *help* - Show this help\n• *reset* - Clear conversation history\n• *status* - Show my current status\n\n_PAI Assistant_`;
        
        return {
          success: true,
          response: helpMessage,
          messageType: 'help'
        };

      case 'status':
      case '/status':
        const stats = this.getConversationStats();
        const userKey = this.getUserKey(phone, pushName);
        const hasConversation = this.conversationHistory.has(userKey);
        
        const statusMessage = `📊 *PAI Assistant Status*\n\n✅ Service: Online\n👥 Active conversations: ${stats.activeConversations}\n💬 Your conversation: ${hasConversation ? 'Active' : 'New'}\n\n_PAI Assistant_`;
        
        return {
          success: true,
          response: statusMessage,
          messageType: 'status'
        };

      default:
        return null; // Not a special command
    }
  }

  /**
   * Process message with special command handling
   */
  async processMessageWithCommands(parsedMessage) {
    const { content, phone, pushName } = parsedMessage;

    // Check for special commands first
    const commandResult = await this.handleSpecialCommands(content, phone, pushName);
    if (commandResult) {
      return commandResult;
    }

    // Process as normal PAI Assistant query
    return await this.processWhatsAppMessage(parsedMessage);
  }
}

// Export singleton instance
module.exports = new PaiAssistantWhatsAppService();