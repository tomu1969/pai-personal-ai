const { Message } = require('../models');
const logger = require('../utils/logger');
const messageRetrieval = require('./messageRetrieval');
const assistantAI = require('./assistantAI');
const assistantService = require('./assistant');

class AssistantMessageHandler {
  constructor() {
    this.ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';
    this.ASSISTANT_CONTACT_ID = '00000000-0000-0000-0000-000000000001';
  }

  /**
   * Process a message sent to the Assistant conversation
   * @param {string} content - User's message content
   * @param {string} conversationId - Should be the Assistant conversation ID
   * @param {function} broadcastTyping - Function to broadcast typing indicator
   * @param {function} broadcastMessage - Function to broadcast new message
   */
  async processAssistantMessage(content, conversationId, broadcastTyping, broadcastMessage) {
    if (conversationId !== this.ASSISTANT_CONVERSATION_ID) {
      logger.warn('processAssistantMessage called with non-assistant conversation', { conversationId });
      return;
    }

    logger.info('Processing Assistant message', { content: content.substring(0, 100) });

    // Start typing indicator
    broadcastTyping(conversationId, true, 'assistant');

    try {
      // Get assistant configuration from database
      const assistantConfig = await assistantService.getStatus();
      
      logger.debug('ASSISTANT HANDLER: Starting AI processing', {
        content: content.substring(0, 100),
        conversationId,
        assistantName: assistantConfig.assistantName,
        ownerName: assistantConfig.ownerName,
      });

      // Use AI to parse intent and generate response with configuration
      const aiResult = await assistantAI.processMessage(content, {
        conversationId,
        contactId: this.ASSISTANT_CONTACT_ID,
        systemPrompt: assistantConfig.systemPrompt,
        ownerName: assistantConfig.ownerName,
        assistantName: assistantConfig.assistantName,
      });

      logger.debug('ASSISTANT HANDLER: AI processing completed', {
        success: true,
        hasResult: !!aiResult,
      });

      logger.info('AI processed message', {
        intent: aiResult.intent,
        confidence: aiResult.confidence,
        parameters: aiResult.parameters,
        reasoning: aiResult.reasoning,
        tokensUsed: aiResult.tokensUsed,
      });

      let responseContent;

      // Handle different intents based on extracted entities
      if (['message_query', 'contact_query', 'conversation_query', 'summary'].includes(aiResult.intent) && aiResult.confidence > 0.5) {
        logger.info('Processing AI-detected database query request', {
          intent: aiResult.intent,
          entities: aiResult.entities,
          confidence: aiResult.confidence,
        });

        try {
          // Use entity extraction and database query system
          const retrievalResult = await messageRetrieval.retrieveMessages(
            aiResult.intent,
            aiResult.entities,
            {
              conversationId,
              contactId: this.ASSISTANT_CONTACT_ID,
              includeAssistantMessages: false, // Exclude assistant messages unless specifically requested
            },
          );

          if (retrievalResult.success) {
            // Generate AI response with actual database results
            const responseWithData = await assistantAI.generateResponse(
              aiResult.intent,
              aiResult.entities,
              content,
              {
                ...retrievalResult,
                originalUserMessage: content,
              },
            );
            responseContent = responseWithData;
          } else {
            // Handle query errors or validation issues
            responseContent = `I encountered an issue with your request: ${retrievalResult.error}\n\n${retrievalResult.details ? retrievalResult.details.join(', ') : ''}\n\nCould you please rephrase your question or be more specific?`;
          }
        } catch (retrievalError) {
          logger.error('Database query failed, using AI response', {
            error: retrievalError.message,
            intent: aiResult.intent,
            entities: aiResult.entities,
            aiResponse: aiResult.response,
          });
          responseContent = aiResult.response;
        }
      } else if (aiResult.intent === 'clarification_needed') {
        // Handle cases where AI needs more information - use PAI's configured response
        const clarificationResponse = await assistantAI.generateResponse(
          'conversation',
          {},
          content,
          {
            systemPrompt: assistantConfig.systemPrompt,
            ownerName: assistantConfig.ownerName,
            assistantName: assistantConfig.assistantName,
          },
        );
        responseContent = clarificationResponse;
      } else {
        // Use AI-generated response for help, conversation, or low-confidence requests
        responseContent = aiResult.response;
      }

      // Stop typing indicator
      broadcastTyping(conversationId, false, 'assistant');

      // Create Assistant's response message
      const assistantMessage = await Message.create({
        messageId: `assistant_${Date.now()}`,
        conversationId: this.ASSISTANT_CONVERSATION_ID,
        contactId: this.ASSISTANT_CONTACT_ID,
        content: responseContent,
        messageType: 'text',
        sender: 'assistant',
        isRead: false, // User hasn't read it yet
        metadata: {
          generatedBy: 'assistant_message_handler',
          responseType: aiResult.intent,
          aiConfidence: aiResult.confidence,
          aiParameters: aiResult.parameters,
          aiReasoning: aiResult.reasoning,
          tokensUsed: aiResult.tokensUsed,
          originalMessage: content.substring(0, 200),
        },
      });

      // Fetch the message with contact info for broadcasting
      const messageWithContact = await Message.findByPk(assistantMessage.id, {
        include: [{
          model: require('../models').Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'profilePicture'],
        }],
      });

      // Broadcast the Assistant's response
      broadcastMessage(conversationId, messageWithContact);

      logger.info('Assistant response sent', {
        responseLength: responseContent.length,
        messageId: assistantMessage.id,
      });
    } catch (error) {
      logger.error('ASSISTANT HANDLER: Failed to process Assistant message', {
        error: error.message,
        stack: error.stack,
        content: content.substring(0, 100),
        conversationId,
      });

      // Stop typing indicator on error
      broadcastTyping(conversationId, false, 'assistant');

      // Send error response
      const errorMessage = await Message.create({
        messageId: `assistant_error_${Date.now()}`,
        conversationId: this.ASSISTANT_CONVERSATION_ID,
        contactId: this.ASSISTANT_CONTACT_ID,
        content: '❌ **Error Processing Request**\n\nI encountered an error while processing your request. Please try again later.',
        messageType: 'text',
        sender: 'assistant',
        isRead: false,
        metadata: {
          generatedBy: 'assistant_message_handler',
          responseType: 'error',
          error: error.message,
        },
      });

      const errorMessageWithContact = await Message.findByPk(errorMessage.id, {
        include: [{
          model: require('../models').Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'profilePicture'],
        }],
      });

      broadcastMessage(conversationId, errorMessageWithContact);
    }
  }

  /**
   * Generate a helpful response for non-summary requests
   * @param {string} content - User's message content
   * @returns {string} Help response
   */
  generateHelpResponse(content) {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('help') || lowerContent.includes('what can you do')) {
      return `👋 **Hello! I'm your AI Assistant**

I can help you with the following:

📋 **Generate Summaries**
- Type "summary" to get a summary of recent messages
- Add time periods: "summary today", "summary last 3 hours", "summary this week"
- Available periods: today, yesterday, last hour, 2-24 hours, 2-7 days, this week

🔍 **Examples:**
- "summary today" - Messages from today
- "summary last 6 hours" - Recent activity
- "status update" - Current status report

💡 **Tips:**
- I understand English and Spanish commands
- Summaries are generated from your WhatsApp conversations
- Use specific time periods for better results

How can I help you today?`;
    }

    // Default response for unclear requests
    return `🤖 **I didn't quite understand that request**

I specialize in generating summaries of your WhatsApp conversations. Here are some things you can try:

📋 **For Summaries:**
- "summary" - Recent messages summary
- "summary today" - Today's messages
- "summary last 3 hours" - Recent activity

❓ **For Help:**
- "help" - Show available commands
- "what can you do" - List my capabilities

Would you like me to generate a summary or need help with something else?`;
  }
}

module.exports = new AssistantMessageHandler();
