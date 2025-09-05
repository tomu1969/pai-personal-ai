/**
 * @file assistantAI.js
 * @description Core AI assistant service for intent parsing, response generation, and conversation analysis
 * @module services/ai/assistantAI
 * @requires openai - OpenAI API client
 * @requires ../utils/logger - Logging utility
 * @requires ../config - Application configuration
 * @exports AssistantAI
 * @author PAI System
 * @since September 2025
 */

const { OpenAI } = require('openai');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Core AI assistant service for intelligent message processing
 * Handles intent parsing, response generation, and conversation analysis
 * 
 * Features:
 * - Natural language intent parsing using OpenAI GPT
 * - Database query parameter extraction
 * - Contextual response generation
 * - Conversation summarization
 * - Fallback responses when AI is unavailable
 * 
 * @class AssistantAI
 * @example
 * const aiService = require('./services/ai/assistantAI');
 * const result = await aiService.processMessage('show me messages from today');
 */
class AssistantAI {
  /**
   * Initialize AI assistant service with OpenAI client
   * @constructor
   */
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
   * Analyzes natural language messages to extract intent and structured parameters
   * 
   * @param {string} userMessage - The user's natural language message
   * @param {object} context - Additional context for parsing
   * @returns {Promise<object>} Parsed intent with confidence, entities, and parameters
   * @example
   * const result = await aiService.parseIntent('show me messages from today');
   * // Returns: { intent: 'message_query', entities: { timeframe: {...} }, confidence: 0.9 }
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

CRITICAL TIMEFRAME PARSING RULES (MUST FOLLOW EXACTLY):
- ANY mention of "today" → {"value": 0, "unit": "days", "relative": "today"} - NOT "past"!
- ANY mention of "yesterday" → {"value": 1, "unit": "days", "relative": "yesterday"} - NOT "past"!
- "last X minutes/hours/days" → {"value": X, "unit": "minutes/hours/days", "relative": "past"}
- Do NOT use "relative": "past" for "today" or "yesterday" - use the exact relative values!

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
- timeframe: {value: number, unit: "minutes|hours|days|weeks", relative: "past|future|today|yesterday"}
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
}

IMPORTANT TIMEFRAME EXAMPLES:
- "messages from today": {"value": 0, "unit": "days", "relative": "today"}
- "messages from yesterday": {"value": 1, "unit": "days", "relative": "yesterday"} 
- "messages from last hour": {"value": 1, "unit": "hours", "relative": "past"}
- "messages from last 30 minutes": {"value": 30, "unit": "minutes", "relative": "past"}
`;

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
   * Converts natural language time expressions to standardized objects
   * 
   * @param {string} timeframe - Natural language time expression
   * @returns {object} Structured timeframe with value, unit, and relative properties
   * @example
   * parseTimeframe('last 30 minutes') // Returns: { value: 30, unit: 'minutes', relative: 'past' }
   * parseTimeframe('today') // Returns: { value: 0, unit: 'days', relative: 'today' }
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
   * Used when OpenAI API is unavailable or fails
   * 
   * @param {string} userMessage - The user's message to analyze
   * @returns {object} Basic intent classification with limited confidence
   * @private
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
   * Creates contextual responses using OpenAI or fallback to static responses
   * 
   * @param {string} intent - Parsed intent from parseIntent()
   * @param {object} parameters - Extracted parameters for the intent
   * @param {string} userMessage - Original user message
   * @param {object} context - Additional context including database results, system prompt, etc.
   * @returns {Promise<string>} Generated response message
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
            console.log('🔍 [AI SUMMARY] Processing summary request with database results');
            console.log('📊 [AI SUMMARY] Raw messages received:', context.messages.length);
            console.log('🎯 [AI SUMMARY] Intent detected:', intent);
            console.log('📝 [AI SUMMARY] User message:', userMessage);
            
            // Create system prompt with explicit format instructions
            systemPrompt = `${configuredSystemPrompt}

IMPORTANT CONVERSATION SUMMARY FORMAT:
When providing conversation summaries, you MUST use this exact format for each conversation:

*[DD/MM/YY, HH:MM–HH:MM] ContactName:* Brief action or topic (max 10-15 words)

Examples:
- *[03/09/25, 14:30–15:45] John Smith:* Discussed project timeline
- *[03/09/25, 16:00–16:15] Mary Johnson:* Confirmed meeting tomorrow

Rules:
1. Use single asterisks around timestamp and contact name: *[timestamp] Name:*
2. Keep summaries under 15 words - focus on main action/topic only
3. Don't include assistant responses or details like "(assistant)"
4. Use active voice and action verbs (asked, shared, confirmed, discussed)
5. Each conversation on a new line with double line breaks between them`;

            console.log('📋 [AI SUMMARY] System prompt prepared with format instructions');

            // Prepare data for AI processing
            const messageData = {
              total_messages: context.messages.length,
              messages: context.messages.map(msg => ({
                contact: msg.contact?.name || 'Unknown',
                content: msg.content.substring(0, 200), // Limit content length
                createdAt: msg.createdAt,
                sender: msg.sender
              })),
              timeframe: parameters.timeframe || context.timeframe || 'last few hours',
              request_type: intent
            };

            console.log('🔧 [AI SUMMARY] Prepared message data for AI:', {
              messageCount: messageData.messages.length,
              timeframe: messageData.timeframe,
              firstFewContacts: messageData.messages.slice(0, 3).map(m => m.contact)
            });

            const completion = await this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Please analyze these messages and provide a conversation summary following the exact format specified: ${JSON.stringify(messageData)}` },
              ],
              temperature: 0.3,
              max_tokens: 800,
            });

            responseMessage = completion.choices[0].message.content;
            
            console.log('✅ [AI SUMMARY] AI response generated');
            console.log('📤 [AI SUMMARY] Final response:', responseMessage.substring(0, 200) + '...');
          } else {
            console.log('❌ [AI SUMMARY] No database results found');
            const timeValue = parameters.timeframe?.value || 5;
            const timeUnit = parameters.timeframe?.unit || 'hours';
            responseMessage = `No conversations found in the last ${timeValue} ${timeUnit}.`;
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
   * Main entry point for processing user messages with full AI pipeline
   * 
   * @param {string} userMessage - The user's natural language message
   * @param {object} context - Processing context including:
   *   @param {string} context.systemPrompt - AI system prompt for personality
   *   @param {string} context.ownerName - Owner's name for personalization
   *   @param {string} context.assistantName - Assistant's name
   *   @param {Array} context.messages - Database query results
   *   @param {Array} context.contacts - Contact search results
   *   @param {Array} context.conversations - Conversation search results
   * @returns {Promise<object>} Complete processing result with intent, response, and metadata
   * @example
   * const result = await aiService.processMessage('show me today\'s messages', {
   *   systemPrompt: 'You are PAI assistant',
   *   ownerName: 'John',
   *   messages: [...] // from database
   * });
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
    console.log('🔄 [GROUP MESSAGES] Starting conversation grouping');
    console.log('📥 [GROUP MESSAGES] Input messages:', messages?.length || 0);
    
    if (!messages || messages.length === 0) {
      console.log('❌ [GROUP MESSAGES] No messages to group');
      return [];
    }

    // Sort messages by contact and timestamp
    const sortedMessages = messages.sort((a, b) => {
      const contactCompare = (a.contact?.name || 'Unknown').localeCompare(b.contact?.name || 'Unknown');
      if (contactCompare !== 0) return contactCompare;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    console.log('📋 [GROUP MESSAGES] Messages sorted by contact and time');
    console.log('👥 [GROUP MESSAGES] Unique contacts found:', 
      [...new Set(sortedMessages.map(m => m.contact?.name || 'Unknown'))]);

    const conversations = [];
    let currentConversation = null;
    const CONVERSATION_GAP_MINUTES = 30; // Group messages within 30 minutes

    for (const message of sortedMessages) {
      const messageTime = new Date(message.createdAt);
      const contactName = message.contact?.name || 'Unknown';
      const contactId = message.contact?.id || message.contactId;

      console.log(`📨 [GROUP MESSAGES] Processing message from ${contactName} at ${messageTime.toISOString()}`);

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
          console.log(`✅ [GROUP MESSAGES] Finalized conversation with ${currentConversation.contactName}: ${currentConversation.messages.length} messages`);
        }

        // Start new conversation
        currentConversation = {
          contactName,
          contactId,
          startTime: messageTime,
          endTime: messageTime,
          messages: [message],
        };
        console.log(`🆕 [GROUP MESSAGES] Started new conversation with ${contactName}`);
      } else {
        // Add to existing conversation
        currentConversation.endTime = messageTime;
        currentConversation.messages.push(message);
        console.log(`➕ [GROUP MESSAGES] Added message to existing conversation with ${contactName} (${currentConversation.messages.length} total)`);
      }
    }

    // Don't forget the last conversation
    if (currentConversation) {
      currentConversation.summary = this.generateConversationSummary(currentConversation.messages);
      conversations.push(currentConversation);
      console.log(`🏁 [GROUP MESSAGES] Finalized last conversation with ${currentConversation.contactName}: ${currentConversation.messages.length} messages`);
    }

    // Sort conversations chronologically
    const sortedConversations = conversations.sort((a, b) => a.startTime - b.startTime);
    
    console.log('📊 [GROUP MESSAGES] Final conversation groups:', sortedConversations.length);
    console.log('📈 [GROUP MESSAGES] Conversations by contact:', 
      sortedConversations.map(c => `${c.contactName} (${c.messages.length} msgs)`));
    
    return sortedConversations;
  }

  /**
   * Generate summary text for a conversation (30-50 tokens)
   */
  generateConversationSummary(messages, _maxTokens = 40) {
    console.log('💬 [SUMMARY GENERATION] Generating summary for conversation');
    console.log('📨 [SUMMARY GENERATION] Total messages:', messages?.length || 0);
    
    if (!messages || messages.length === 0) {
      console.log('❌ [SUMMARY GENERATION] No messages to summarize');
      return 'No activity';
    }
    
    // Extract key content from messages
    const contents = messages
      .filter(msg => msg.sender === 'user' && msg.content && msg.content.trim())
      .map(msg => msg.content.trim())
      .slice(0, 5); // Limit to first 5 messages for token efficiency

    console.log('📝 [SUMMARY GENERATION] User messages extracted:', contents.length);
    console.log('💭 [SUMMARY GENERATION] Message contents preview:', contents.map(c => c.substring(0, 50) + '...'));

    if (contents.length === 0) {
      console.log('⚠️ [SUMMARY GENERATION] No user messages found, using fallback');
      return 'Sent messages';
    }

    // Simple summarization logic
    if (contents.length === 1) {
      const content = contents[0];
      console.log('1️⃣ [SUMMARY GENERATION] Single message summary');
      if (content.length <= 120) {
        console.log('✂️ [SUMMARY GENERATION] Short message, using directly:', content);
        return content; // Short enough to use directly
      }
      const truncated = content.substring(0, 100) + '...';
      console.log('✂️ [SUMMARY GENERATION] Long message truncated:', truncated);
      return truncated; // Truncate long single message
    }

    // Multiple messages - create summary
    const allText = contents.join(' ').toLowerCase();
    console.log('🔍 [SUMMARY GENERATION] Multiple messages, analyzing patterns');
    console.log('🔤 [SUMMARY GENERATION] Combined text preview:', allText.substring(0, 100) + '...');
    
    // Detect common patterns
    if (allText.includes('meeting') || allText.includes('reunion')) {
      console.log('📅 [SUMMARY GENERATION] Pattern detected: Meeting');
      return 'Discussed meeting arrangements and scheduling';
    }
    if (allText.includes('call') || allText.includes('llamar')) {
      console.log('📞 [SUMMARY GENERATION] Pattern detected: Call');
      return 'Requested phone call and coordinated timing';  
    }
    if (allText.includes('document') || allText.includes('archivo') || allText.includes('send')) {
      console.log('📄 [SUMMARY GENERATION] Pattern detected: Document');
      return 'Shared documents and discussed file transfer';
    }
    if (allText.includes('dinner') || allText.includes('lunch') || allText.includes('cena') || allText.includes('almuerzo')) {
      console.log('🍽️ [SUMMARY GENERATION] Pattern detected: Meal');
      return 'Made dinner/lunch plans and coordinated location';
    }
    if (allText.includes('confirm') || allText.includes('confirmar')) {
      console.log('✅ [SUMMARY GENERATION] Pattern detected: Confirmation');
      return 'Requested confirmation and follow-up details';
    }

    // Default: use first message as base
    const firstMessage = contents[0];
    console.log('🔄 [SUMMARY GENERATION] No pattern matched, using first message as base');
    if (firstMessage.length <= 80) {
      console.log('📝 [SUMMARY GENERATION] Short first message, using directly:', firstMessage);
      return firstMessage;
    }
    
    // Truncate but try to end at word boundary
    const truncated = firstMessage.substring(0, 70);
    const lastSpace = truncated.lastIndexOf(' ');
    const finalSummary = (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '...';
    console.log('✂️ [SUMMARY GENERATION] First message truncated:', finalSummary);
    return finalSummary;
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
