const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const config = require('../config');

class AssistantAI {
  constructor() {
    // Check if OpenAI API key is properly configured
    if (config.openai.apiKey && !config.openai.apiKey.includes('your-')) {
      try {
        this.openai = new OpenAI({
          apiKey: config.openai.apiKey,
        });
        this.model = config.openai.model;
        this.aiEnabled = true;
        logger.info('AssistantAI initialized with OpenAI API');
      } catch (error) {
        logger.warn('Failed to initialize OpenAI client, using fallback mode', { error: error.message });
        this.aiEnabled = false;
      }
    } else {
      logger.info('OpenAI API key not configured, using fallback mode');
      this.aiEnabled = false;
    }
  }

  /**
   * Parse user intent using AI instead of regex patterns
   */
  async parseIntent(userMessage, context = {}) {
    // If AI is not available, use fallback immediately
    if (!this.aiEnabled) {
      logger.debug('Using fallback intent parsing (AI disabled)');
      return this.fallbackIntentParsing(userMessage);
    }
    
    try {
      const systemPrompt = `You are an intelligent assistant that analyzes user messages to extract intent and structured parameters for database queries.

Your job is to classify user messages and extract detailed entities to enable precise database searches.

AVAILABLE INTENTS:
1. "message_query" - User wants to search/filter messages
   - Extract: timeframe, sender, content_filter, message_type, group_filter
   - Examples: "messages from last 30 minutes", "images from yesterday", "messages containing 'urgent'"
   
2. "contact_query" - User wants to find contacts/groups
   - Extract: name, phone, group, time_filter
   - Examples: "who messaged me today", "contacts in group X"
   
3. "conversation_query" - User wants to search conversations
   - Extract: timeframe, priority, status, category
   - Examples: "active conversations", "high priority chats"
   
4. "summary" - User wants a structured summary/report
   - Extract: timeframe, scope, format, filters
   - Examples: "summary of today's messages", "report on urgent items"
   
5. "clarification_needed" - Missing critical parameters
   - Use when the query is too vague or ambiguous
   
6. "help" - User needs assistance
   - No parameters needed
   
7. "conversation" - General chat
   - No parameters needed

ENTITY EXTRACTION:
- timeframe: {value: number, unit: "minutes|hours|days|weeks", relative: "past|future"}
- sender: {type: "specific|group|assistant|user", name: string}
- content_filter: {keywords: [string], exclude: [string]}
- message_type: ["text", "image", "audio", "video", "document"]
- group_filter: {include: boolean, names: [string]}
- priority: ["urgent", "high", "medium", "low"]

RESPONSE FORMAT (JSON only):
{
  "intent": "message_query" | "contact_query" | "conversation_query" | "summary" | "clarification_needed" | "help" | "conversation",
  "confidence": 0.1 to 1.0,
  "entities": {
    "timeframe": {"value": 30, "unit": "minutes", "relative": "past"},
    "sender": null,
    "content_filter": {"keywords": ["urgent"], "exclude": []},
    "message_type": ["text", "image"],
    "group_filter": null,
    "priority": null
  },
  "missing_params": ["scope", "format"],
  "clarification_question": "string (if clarification_needed)",
  "reasoning": "brief explanation of analysis"
}`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      const parsed = JSON.parse(response);

      logger.debug('AI intent parsing result', {
        userMessage,
        intent: parsed.intent,
        confidence: parsed.confidence,
        parameters: parsed.parameters,
        reasoning: parsed.reasoning,
        tokensUsed: completion.usage.total_tokens,
      });

      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        entities: parsed.entities || {},
        parameters: parsed.parameters || parsed.entities || {}, // Backward compatibility
        missing_params: parsed.missing_params || [],
        clarification_question: parsed.clarification_question,
        reasoning: parsed.reasoning,
        tokensUsed: completion.usage.total_tokens,
      };
    } catch (error) {
      logger.error('Failed to parse intent with AI', {
        error: error.message,
        userMessage,
        stack: error.stack,
      });

      // Fallback to simple keyword matching if AI fails
      return this.fallbackIntentParsing(userMessage);
    }
  }

  /**
   * Parse timeframe string to structured format
   */
  parseTimeframe(timeframe) {
    const timeframeLower = timeframe.toLowerCase();

    if (timeframeLower.includes('30 min') || timeframeLower.includes('30 minutes') || timeframeLower.includes('half hour')) {
      return { value: 30, unit: 'minutes', relative: 'past' };
    } if (timeframeLower.includes('hour')) {
      return { value: 1, unit: 'hours', relative: 'past' };
    } if (timeframeLower.includes('today')) {
      return { value: 0, unit: 'days', relative: 'today' };
    } if (timeframeLower.includes('yesterday')) {
      return { value: 1, unit: 'days', relative: 'past' };
    }

    return { value: 24, unit: 'hours', relative: 'past' }; // Default
  }

  /**
   * Fallback intent parsing using simple keyword matching
   */
  fallbackIntentParsing(userMessage) {
    const message = userMessage.toLowerCase();

    // Summary keywords
    if (message.includes('summar') || message.includes('resume')
        || message.includes('what happened') || message.includes('catch me up')
        || message.includes('brief') || message.includes('overview')) {
      // Extract timeframe
      let timeframe = 'today';
      if (message.includes('30 min') || message.includes('30 minutes')) {
        timeframe = 'last 30 minutes';
      } else if (message.includes('hour')) {
        timeframe = 'last hour';
      } else if (message.includes('yesterday')) {
        timeframe = 'yesterday';
      }

      return {
        intent: 'message_query',
        confidence: 0.7,
        entities: {
          timeframe: this.parseTimeframe(timeframe),
        },
        parameters: { timeframe }, // Backward compatibility
        missing_params: [],
        reasoning: 'Fallback keyword matching detected message query request',
        tokensUsed: 0,
      };
    }

    // Help keywords
    if (message.includes('help') || message.includes('how to')
        || message.includes('what can you do') || message.includes('commands')) {
      return {
        intent: 'help',
        confidence: 0.8,
        entities: {},
        parameters: {},
        missing_params: [],
        reasoning: 'Fallback keyword matching detected help request',
        tokensUsed: 0,
      };
    }

    // Default to conversation
    return {
      intent: 'conversation',
      confidence: 0.5,
      entities: {},
      parameters: {},
      missing_params: [],
      reasoning: 'Fallback default - general conversation',
      tokensUsed: 0,
    };
  }

  /**
   * Generate a response based on the parsed intent
   */
  async generateResponse(intent, parameters, userMessage, context = {}) {
    // If AI is not available, use simple fallback responses
    if (!this.aiEnabled) {
      return this.generateSimpleFallbackResponse(intent, userMessage, context);
    }
    
    try {
      // Use configured system prompt for general conversation
      const configuredSystemPrompt = this.currentConfig?.systemPrompt || 
        context.systemPrompt || 
        'You are a helpful AI assistant';
      
      let systemPrompt = '';
      let responseMessage = '';

      // Check if we have database results in context
      const hasDbResults = context.messages || context.contacts || context.conversations || context.summary;

      switch (intent) {
        case 'message_query':
        case 'summary':
          if (hasDbResults && context.messages) {
            // Group messages into conversations for proper formatting
            const conversationSummaries = this.groupMessagesByConversation(context.messages);
            
            // Prepare formatted conversation data for AI
            const conversationData = conversationSummaries.map(conv => ({
              timestamp: this.formatConversationTimestamp(conv.startTime, conv.endTime),
              contact: conv.contactName,
              summary: conv.summary,
              messageCount: conv.messages.length
            }));

            // Generate the formatted conversation list directly without additional AI processing
            if (conversationData.length > 0) {
              responseMessage = conversationData.map(conv => 
                `${conv.timestamp} ${conv.contact}: ${conv.summary}`
              ).join('\n\n');
            } else {
              const timeValue = parameters.timeframe?.value || 5;
              const timeUnit = parameters.timeframe?.unit || 'hours';
              responseMessage = `No conversations found in the last ${timeValue} ${timeUnit}.`;
            }
          } else {
            responseMessage = `I searched for messages but didn't find any matching your criteria. Could you try:

🔍 **Being more specific about:**
• Time period ("last hour", "today", "yesterday")
• Contact names or message content
• Message types (images, documents, etc.)

💡 **Example queries:**
• "messages from today"
• "images from John yesterday"
• "messages containing urgent"`;
          }
          break;

        case 'contact_query':
          if (hasDbResults && context.contacts) {
            systemPrompt = 'You are analyzing contact data from a WhatsApp system. Provide a clear, helpful summary of the contacts found.';

            const contactData = {
              total_contacts: context.contacts.length,
              contacts: context.contacts.slice(0, 10),
              messages: context.messages ? context.messages.slice(0, 5) : [],
            };

            const completion = await this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this contact data: ${JSON.stringify(contactData)}` },
              ],
              temperature: 0.3,
              max_tokens: 400,
            });

            responseMessage = completion.choices[0].message.content;
          } else {
            // No contacts found - use configured system prompt to respond as PAI
            systemPrompt = configuredSystemPrompt;

            const completion = await this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
              ],
              temperature: 0.7,
              max_tokens: 300,
            });

            responseMessage = completion.choices[0].message.content;
          }
          break;

        case 'conversation_query':
          if (hasDbResults && context.conversations) {
            responseMessage = `📱 **Found ${context.conversations.length} conversations**\n\n${context.conversations.map((conv) => `• **${conv.contact?.name || 'Unknown'}** (${conv.contact?.phone})\n  Status: ${conv.status}, Priority: ${conv.priority}\n  Last message: ${conv.lastMessageAt}`).join('\n\n')}`;
          } else {
            responseMessage = `No conversations found matching your criteria. Try:

💬 **Search by:**
• Priority level ("high priority conversations")
• Status ("active conversations")
• Time period ("recent conversations")`;
          }
          break;

        case 'help':
          responseMessage = `👋 **I'm your intelligent WhatsApp assistant!**

I can help you find and analyze your messages using natural language. Here's what I can do:

🔍 **Search Messages:**
• "messages from today"
• "images from John yesterday" 
• "messages containing urgent"
• "what did Sarah send last week?"

👥 **Find Contacts:**
• "who messaged me today?"
• "show me group conversations"
• "contacts named Mike"

📊 **Get Summaries:**
• "summary of today's messages"
• "what happened while I was away?"
• "urgent messages from this week"

💡 Just ask naturally - I'll understand what you're looking for!`;
          break;

        case 'conversation':
        default:
          // Use the configured system prompt from the database
          systemPrompt = configuredSystemPrompt;

          const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 300,
          });

          responseMessage = completion.choices[0].message.content;
          break;
      }

      logger.info('AI response generated', {
        intent,
        hasDbResults,
        responseLength: responseMessage.length,
        userMessage: `${userMessage.substring(0, 50)}...`,
      });

      return responseMessage;
    } catch (error) {
      logger.error('Failed to generate AI response', {
        error: error.message,
        intent,
        parameters,
        userMessage,
        hasDbResults: !!(context.messages || context.contacts || context.conversations),
      });

      // Fallback response
      return 'I apologize, but I\'m having trouble processing your request right now. Please try again, or feel free to ask me something else!';
    }
  }

  /**
   * Complete intent parsing and response generation in one call
   */
  async processMessage(userMessage, context = {}) {
    try {
      // Store configuration for use throughout processing
      this.currentConfig = {
        systemPrompt: context.systemPrompt || 'You are a helpful AI assistant',
        ownerName: context.ownerName || 'the owner',
        assistantName: context.assistantName || 'PAI',
      };

      // Parse intent
      const intentResult = await this.parseIntent(userMessage, context);

      // Generate response
      const response = await this.generateResponse(
        intentResult.intent,
        intentResult.parameters,
        userMessage,
        context,
      );

      return {
        ...intentResult,
        response,
        success: true,
      };
    } catch (error) {
      logger.error('Failed to process message with AI', {
        error: error.message,
        userMessage,
        stack: error.stack,
      });

      return {
        intent: 'conversation',
        confidence: 0.3,
        entities: {},
        parameters: {},
        missing_params: [],
        reasoning: 'Error fallback',
        response: 'I\'m having trouble understanding your request. Could you please try rephrasing it?',
        success: false,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Generate simple fallback responses when OpenAI is not available
   */
  generateSimpleFallbackResponse(intent, _userMessage, context = {}) {
    const greetings = ['Hello', 'Hi there', 'Hey', 'Greetings'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    // Use configured names or fallback defaults
    const assistantName = this.currentConfig?.assistantName || context.assistantName || 'PAI';
    const ownerName = this.currentConfig?.ownerName || context.ownerName || 'the owner';
    
    switch (intent) {
      case 'summary':
        return `${greeting}! I understand you're asking for a summary. I'd be happy to help, but I need an OpenAI API key to provide detailed summaries. For now, you can check your recent conversations in the chat interface.`;
      
      case 'message_query':
        return `${greeting}! You're asking about messages. While I'd love to search through your messages for you, I need an OpenAI API key configured to do that intelligently. You can browse your conversations manually in the chat interface.`;
      
      case 'help':
        return `${greeting}! I'm ${assistantName}, ${ownerName}'s Personal AI assistant. I can help you with:
        
📱 **Message Management**: Search and filter your WhatsApp messages
📊 **Summaries**: Get summaries of your conversations  
👥 **Contact Info**: Find information about your contacts
🔍 **Conversation Search**: Find specific chats and conversations

*Note: I need an OpenAI API key to provide intelligent responses. For now, I can provide basic help and information.*`;
      
      case 'conversation':
      default:
        const responses = [
          `${greeting}! I'm ${assistantName}, ${ownerName}'s personal AI assistant. I'm currently running in demo mode without OpenAI integration. How can I help you today?`,
          `${greeting}! I'm here to help! I'm currently in fallback mode since no OpenAI API key is configured. What would you like to know?`,
          `${greeting}! I'm ${assistantName}, ready to assist you. I'm working in basic mode right now. What can I do for you?`,
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  /**
   * Group messages by contact and time windows for conversation summary format
   */
  groupMessagesByConversation(messages) {
    if (!messages || messages.length === 0) return [];

    // Sort messages by contact and timestamp
    const sortedMessages = messages.sort((a, b) => {
      const contactCompare = (a.contact?.name || 'Unknown').localeCompare(b.contact?.name || 'Unknown');
      if (contactCompare !== 0) return contactCompare;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const conversations = [];
    let currentConversation = null;
    const CONVERSATION_GAP_MINUTES = 30; // Group messages within 30 minutes

    for (const message of sortedMessages) {
      const messageTime = new Date(message.createdAt);
      const contactName = message.contact?.name || 'Unknown';
      const contactId = message.contact?.id || message.contactId;

      // Start new conversation if:
      // 1. First message
      // 2. Different contact
      // 3. Time gap > 30 minutes
      const shouldStartNew = !currentConversation ||
        currentConversation.contactId !== contactId ||
        (messageTime - currentConversation.endTime) > (CONVERSATION_GAP_MINUTES * 60 * 1000);

      if (shouldStartNew) {
        // Finalize previous conversation
        if (currentConversation) {
          currentConversation.summary = this.generateConversationSummary(currentConversation.messages);
          conversations.push(currentConversation);
        }

        // Start new conversation
        currentConversation = {
          contactName,
          contactId,
          startTime: messageTime,
          endTime: messageTime,
          messages: [message],
        };
      } else {
        // Add to existing conversation
        currentConversation.endTime = messageTime;
        currentConversation.messages.push(message);
      }
    }

    // Don't forget the last conversation
    if (currentConversation) {
      currentConversation.summary = this.generateConversationSummary(currentConversation.messages);
      conversations.push(currentConversation);
    }

    // Sort conversations chronologically
    return conversations.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Generate summary text for a conversation (30-50 tokens)
   */
  generateConversationSummary(messages, _maxTokens = 40) {
    if (!messages || messages.length === 0) return 'No activity';
    
    // Extract key content from messages
    const contents = messages
      .filter(msg => msg.sender === 'user' && msg.content && msg.content.trim())
      .map(msg => msg.content.trim())
      .slice(0, 5); // Limit to first 5 messages for token efficiency

    if (contents.length === 0) return 'Sent messages';

    // Simple summarization logic
    if (contents.length === 1) {
      const content = contents[0];
      if (content.length <= 120) return content; // Short enough to use directly
      return content.substring(0, 100) + '...'; // Truncate long single message
    }

    // Multiple messages - create summary
    const allText = contents.join(' ').toLowerCase();
    
    // Detect common patterns
    if (allText.includes('meeting') || allText.includes('reunion')) {
      return 'Discussed meeting arrangements and scheduling';
    }
    if (allText.includes('call') || allText.includes('llamar')) {
      return 'Requested phone call and coordinated timing';  
    }
    if (allText.includes('document') || allText.includes('archivo') || allText.includes('send')) {
      return 'Shared documents and discussed file transfer';
    }
    if (allText.includes('dinner') || allText.includes('lunch') || allText.includes('cena') || allText.includes('almuerzo')) {
      return 'Made dinner/lunch plans and coordinated location';
    }
    if (allText.includes('confirm') || allText.includes('confirmar')) {
      return 'Requested confirmation and follow-up details';
    }

    // Default: use first message as base
    const firstMessage = contents[0];
    if (firstMessage.length <= 80) {
      return firstMessage;
    }
    
    // Truncate but try to end at word boundary
    const truncated = firstMessage.substring(0, 70);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  /**
   * Format date for summary: DD/MM/YY
   */
  formatDateForSummary(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }

  /**
   * Format time for summary: HH:MM
   */
  formatTimeForSummary(date) {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Format time range: HH:MM–HH:MM (same day) or full timestamp if different days
   */
  formatTimeRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startTime = this.formatTimeForSummary(start);
    const endTime = this.formatTimeForSummary(end);
    
    // If same time (single message), just show one timestamp
    if (startTime === endTime) {
      return startTime;
    }
    
    return `${startTime}–${endTime}`;
  }

  /**
   * Format full conversation timestamp: [DD/MM/YY, HH:MM–HH:MM]
   */
  formatConversationTimestamp(startDate, endDate) {
    const dateStr = this.formatDateForSummary(startDate);
    const timeRange = this.formatTimeRange(startDate, endDate);
    return `[${dateStr}, ${timeRange}]`;
  }
}

// Export singleton instance
module.exports = new AssistantAI();
