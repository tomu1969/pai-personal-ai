const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const config = require('../config');

class AssistantAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.openai.model;
  }

  /**
   * Parse user intent using AI instead of regex patterns
   */
  async parseIntent(userMessage, context = {}) {
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
    try {
      let systemPrompt = '';
      let responseMessage = '';

      // Check if we have database results in context
      const hasDbResults = context.messages || context.contacts || context.conversations || context.summary;

      switch (intent) {
        case 'message_query':
        case 'summary':
          if (hasDbResults && context.messages) {
            systemPrompt = `You are a helpful AI assistant analyzing WhatsApp message data. The user asked: "${userMessage}"

You have retrieved ${context.messages.length} messages from the database.

Provide a helpful, natural response analyzing this data. Include:
- Key insights or patterns
- Important messages or contacts
- Time-based analysis if relevant
- Clear, organized formatting with emojis

Keep the response conversational but informative. If there are many messages, provide a summary rather than listing everything.`;

            // Prepare message data for AI analysis
            const messageData = {
              total_messages: context.messages.length,
              metadata: context.metadata,
              messages: context.messages.slice(0, 20), // Limit to first 20 for token efficiency
              query_info: context.query_info,
            };

            const completion = await this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this message data: ${JSON.stringify(messageData)}` },
              ],
              temperature: 0.3,
              max_tokens: 500,
            });

            responseMessage = completion.choices[0].message.content;
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
            responseMessage = `I couldn't find any contacts matching your search. Try searching by:

👥 **Contact details:**
• Name ("contacts named John")
• Recent activity ("who messaged today")
• Group status ("show me groups")`;
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
          systemPrompt = 'You are a friendly and helpful AI assistant integrated into a WhatsApp management system. Respond naturally and helpfully.';

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
}

// Export singleton instance
module.exports = new AssistantAI();
