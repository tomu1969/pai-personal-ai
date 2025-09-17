const PaiMortgageService = require('../../assistants/pai-mortgage/service');
const logger = require('../../utils/logger');

/**
 * PAI Mortgage WhatsApp Service
 * Handles WhatsApp messages for PAI Mortgage instance
 */
class PaiMortgageWhatsAppService {
  constructor() {
    this.paiMortgage = null;
    this.conversationHistory = new Map(); // Per-user conversation history
    this.initialized = false;
  }

  /**
   * Initialize the PAI Mortgage service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.paiMortgage = new PaiMortgageService();
      await this.paiMortgage.initialize();
      this.initialized = true;

      logger.info('PAI Mortgage WhatsApp service initialized');
    } catch (error) {
      logger.error('Failed to initialize PAI Mortgage WhatsApp service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message for PAI Mortgage
   */
  async processWhatsAppMessage(parsedMessage) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { phone, content, pushName } = parsedMessage;
      const userKey = this.getUserKey(phone, pushName);

      logger.info('Processing PAI Mortgage WhatsApp message', {
        userKey,
        phone,
        messageLength: content.length
      });

      // Get or create user conversation context
      let userContext = this.conversationHistory.get(userKey);
      if (!userContext) {
        userContext = {
          phone,
          pushName,
          messageHistory: [],
          lastActivity: new Date(),
          qualificationData: {},
          preferredLoanType: null,
        };
        this.conversationHistory.set(userKey, userContext);

        logger.info('Created new PAI Mortgage conversation', {
          userKey,
          phone,
          userName: pushName
        });
      }

      // Update conversation context
      userContext.messageHistory.push({
        content,
        timestamp: new Date(),
        type: 'user'
      });
      userContext.lastActivity = new Date();

      // Process the message using PAI Mortgage service
      const result = await this.paiMortgage.processQuery(content, {
        conversationId: userKey,
        contactId: phone,
        userContext,
        source: 'whatsapp',
      });

      if (result.success) {
        // Store response in conversation history
        userContext.messageHistory.push({
          content: result.response,
          timestamp: new Date(),
          type: 'assistant',
          intent: result.intent,
          entities: result.entities
        });

        // Update qualification data if extracted
        if (result.entities) {
          this.updateQualificationData(userContext, result.entities);
        }

        // Format response for WhatsApp
        const formattedResponse = this.formatResponseForWhatsApp(result, content, userContext);
        
        logger.info('PAI Mortgage processed WhatsApp message successfully', {
          userKey,
          intent: result.intent,
          responseLength: formattedResponse.length,
          tokensUsed: result.tokensUsed
        });

        return {
          success: true,
          response: formattedResponse,
          intent: result.intent,
          entities: result.entities,
          metadata: result.metadata,
          tokensUsed: result.tokensUsed
        };
      } else {
        const errorResponse = this.formatErrorForWhatsApp(result.error, content);
        
        logger.warn('PAI Mortgage failed to process message', {
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
      logger.error('PAI Mortgage WhatsApp processing error', {
        phone: parsedMessage.phone,
        error: error.message,
        stack: error.stack
      });

      return {
        success: true,
        response: "I'm sorry, I encountered an error processing your mortgage inquiry. Please try again or contact our support team.",
        messageType: 'system_error'
      };
    }
  }

  /**
   * Update user qualification data from extracted entities
   */
  updateQualificationData(userContext, entities) {
    if (entities.loanAmount) {
      userContext.qualificationData.loanAmount = entities.loanAmount;
    }
    if (entities.creditScore) {
      userContext.qualificationData.creditScore = entities.creditScore;
    }
    if (entities.income) {
      userContext.qualificationData.income = entities.income;
    }
    if (entities.dtiRatio) {
      userContext.qualificationData.dtiRatio = entities.dtiRatio;
    }
    if (entities.downPayment) {
      userContext.qualificationData.downPayment = entities.downPayment;
    }
    if (entities.loanType) {
      userContext.preferredLoanType = entities.loanType;
    }
    if (entities.property) {
      userContext.qualificationData.propertyType = entities.property.type;
      userContext.qualificationData.propertyValue = entities.property.value;
    }
  }

  /**
   * Format PAI Mortgage response for WhatsApp display
   */
  formatResponseForWhatsApp(result, originalMessage, userContext) {
    const { response, intent, entities, metadata } = result;

    // Add appropriate emojis and formatting based on intent
    let formattedMessage = '';

    switch (intent) {
      case 'mortgage_qualification':
        formattedMessage += `🏠 *Mortgage Qualification Assessment*\n\n`;
        formattedMessage += response;
        if (metadata && metadata.qualificationScore) {
          formattedMessage += `\n\n📊 Qualification Score: ${metadata.qualificationScore}%`;
        }
        break;

      case 'rate_inquiry':
        formattedMessage += `📈 *Current Mortgage Rates*\n\n`;
        formattedMessage += response;
        break;

      case 'document_checklist':
        formattedMessage += `📋 *Document Checklist*\n\n`;
        formattedMessage += response;
        break;

      case 'mortgage_calculation':
        formattedMessage += `🧮 *Mortgage Calculator*\n\n`;
        formattedMessage += response;
        break;

      case 'loan_comparison':
        formattedMessage += `⚖️ *Loan Comparison*\n\n`;
        formattedMessage += response;
        break;

      case 'process_explanation':
        formattedMessage += `🔄 *Mortgage Process*\n\n`;
        formattedMessage += response;
        break;

      case 'prequalification':
        formattedMessage += `✅ *Pre-Qualification*\n\n`;
        formattedMessage += response;
        if (metadata && metadata.prequalificationAmount) {
          formattedMessage += `\n\n💰 Pre-qualified Amount: $${metadata.prequalificationAmount.toLocaleString()}`;
        }
        break;

      default:
        formattedMessage = response;
    }

    // Add next steps if user has incomplete qualification data
    const missingData = this.getMissingQualificationData(userContext);
    if (missingData.length > 0 && ['mortgage_qualification', 'prequalification'].includes(intent)) {
      formattedMessage += `\n\n💡 *To complete your assessment, I still need:*\n`;
      missingData.forEach(item => {
        formattedMessage += `• ${item}\n`;
      });
    }

    // Add PAI Mortgage signature
    formattedMessage += '\n\n_PAI Mortgage Assistant_';

    return formattedMessage;
  }

  /**
   * Get missing qualification data for a user
   */
  getMissingQualificationData(userContext) {
    const missing = [];
    const data = userContext.qualificationData;

    if (!data.creditScore) missing.push('Credit score');
    if (!data.income) missing.push('Annual income');
    if (!data.loanAmount && !data.propertyValue) missing.push('Loan amount or property value');
    if (!data.downPayment) missing.push('Down payment amount');
    if (!data.dtiRatio && !data.monthlyDebts) missing.push('Monthly debt obligations');

    return missing;
  }

  /**
   * Format error message for WhatsApp
   */
  formatErrorForWhatsApp(error, originalMessage) {
    let formattedError = `❌ *Sorry, I couldn't process your mortgage request*\n\n`;

    // Provide helpful error messages based on error type
    if (error.includes('credit score')) {
      formattedError += `It looks like there was an issue with the credit score. Please provide:\n• A number between 300-850\n• Example: "My credit score is 720"`;
    } else if (error.includes('income') || error.includes('salary')) {
      formattedError += `I need your annual income information. Please try:\n• "My annual income is $75,000"\n• "I make $6,000 per month"\n• "My salary is 80k"`;
    } else if (error.includes('loan amount') || error.includes('property')) {
      formattedError += `Please specify the loan amount or property value:\n• "I need a $400,000 loan"\n• "The house costs $500,000"\n• "Looking for a 350k mortgage"`;
    } else {
      formattedError += `Please try rephrasing your request. Examples:\n• "I want to buy a $400,000 house with 20% down"\n• "What's my qualification with 720 credit score and $80k income?"\n• "Show me current mortgage rates for conventional loans"`;
    }

    formattedError += '\n\n_PAI Mortgage Assistant_';
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
      logger.info('Cleared PAI Mortgage conversation history', {
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

    for (const [userKey, context] of this.conversationHistory.entries()) {
      stats.conversations.push({
        userKey,
        phone: context.phone,
        pushName: context.pushName,
        messageCount: context.messageHistory.length,
        lastActivity: context.lastActivity,
        qualificationData: context.qualificationData,
        preferredLoanType: context.preferredLoanType,
        completeness: this.getQualificationCompleteness(context)
      });
    }

    return stats;
  }

  /**
   * Get qualification data completeness percentage
   */
  getQualificationCompleteness(userContext) {
    const data = userContext.qualificationData;
    const required = ['creditScore', 'income', 'loanAmount', 'downPayment'];
    const provided = required.filter(field => data[field]).length;
    return Math.round((provided / required.length) * 100);
  }

  /**
   * Clean up old conversation histories (run periodically)
   */
  cleanupOldConversations(maxAgeHours = 72) { // Keep mortgage conversations longer
    const cutoff = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    let cleaned = 0;

    for (const [userKey, context] of this.conversationHistory.entries()) {
      if (context.lastActivity < cutoff) {
        this.conversationHistory.delete(userKey);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old PAI Mortgage conversations', {
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
          response: '🔄 *Conversation Reset*\n\nYour mortgage conversation history has been cleared. You can start fresh with your qualification!\n\n_PAI Mortgage Assistant_',
          messageType: 'command'
        };

      case 'help':
      case '/help':
        const helpMessage = `🏠 *PAI Mortgage Assistant Help*\n\nI can help you with mortgage qualification, rates, and guidance. Try asking:\n\n💰 *Qualification:*\n• "I want to buy a $400,000 house with 20% down"\n• "What can I qualify for with 720 credit score?"\n• "My income is $80k, what's my loan limit?"\n\n📊 *Information:*\n• "What are current mortgage rates?"\n• "Compare FHA vs conventional loans"\n• "What documents do I need?"\n• "Explain the mortgage process"\n\n🧮 *Calculations:*\n• "Calculate payment for $300k at 7% interest"\n• "How much house can I afford?"\n\n⚙️ *Commands:*\n• *help* - Show this help\n• *reset* - Clear conversation history\n• *status* - Show qualification progress\n\n_PAI Mortgage Assistant_`;
        
        return {
          success: true,
          response: helpMessage,
          messageType: 'help'
        };

      case 'status':
      case '/status':
        const stats = this.getConversationStats();
        const userKey = this.getUserKey(phone, pushName);
        const userContext = this.conversationHistory.get(userKey);
        
        let statusMessage = `📊 *PAI Mortgage Status*\n\n✅ Service: Online\n👥 Active conversations: ${stats.activeConversations}\n`;
        
        if (userContext) {
          const completeness = this.getQualificationCompleteness(userContext);
          const missing = this.getMissingQualificationData(userContext);
          
          statusMessage += `💬 Your qualification: ${completeness}% complete\n`;
          statusMessage += `📋 Messages exchanged: ${userContext.messageHistory.length}\n`;
          
          if (missing.length > 0) {
            statusMessage += `\n📝 *Still needed:*\n`;
            missing.forEach(item => {
              statusMessage += `• ${item}\n`;
            });
          } else {
            statusMessage += `\n🎉 Qualification data complete!`;
          }
        } else {
          statusMessage += `💬 Your conversation: New`;
        }
        
        statusMessage += '\n\n_PAI Mortgage Assistant_';
        
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

    // Process as normal PAI Mortgage query
    return await this.processWhatsAppMessage(parsedMessage);
  }
}

// Export singleton instance
module.exports = new PaiMortgageWhatsAppService();