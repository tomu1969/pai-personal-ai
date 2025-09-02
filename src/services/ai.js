const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    // Explicitly use the correct API key
    this.apiKey = process.env.OPENAI_API_KEY || config.openai.apiKey;

    // Require API key from environment variables
    if (!this.apiKey || this.apiKey.includes('your-api')) {
      logger.warn('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
      this.enabled = false;
      return;
    }

    this.model = config.openai.model || 'gpt-3.5-turbo';
    this.enabled = !!this.apiKey;

    // Log API key status for debugging
    logger.info('AI Service initialized', {
      enabled: this.enabled,
      keyPresent: !!this.apiKey,
      keyStart: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'none',
      model: this.model,
    });

    if (this.enabled) {
      this.client = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
  }

  /**
   * Check if AI service is available
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Analyze message using AI for enhanced categorization and understanding
   * @param {string} content - Message content
   * @param {object} context - Additional context (sender, conversation history, etc.)
   * @returns {object} AI analysis results
   */
  async analyzeMessage(content, context = {}) {
    if (!this.enabled) {
      logger.debug('AI service not enabled, skipping AI analysis');
      return {
        category: null,
        priority: null,
        sentiment: null,
        summary: null,
        intent: null,
        entities: [],
        confidence: 0,
        aiProcessed: false,
      };
    }

    try {
      const prompt = this.buildAnalysisPrompt(content, context);

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in analyzing WhatsApp messages for a personal assistant service. Provide accurate, structured analysis in JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const aiResponse = response.data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('Empty response from AI service');
      }

      const analysis = this.parseAIResponse(aiResponse);
      analysis.aiProcessed = true;

      logger.info('Message analyzed by AI', {
        category: analysis.category,
        priority: analysis.priority,
        confidence: analysis.confidence,
        tokensUsed: response.data.usage?.total_tokens,
      });

      return analysis;
    } catch (error) {
      logger.warn('AI analysis failed, using fallback', {
        error: error.message,
        status: error.response?.status,
        contentLength: content.length,
      });

      // Return intelligent fallback analysis
      const lowerContent = content.toLowerCase();
      const isQuestion = lowerContent.includes('?')
                        || lowerContent.includes('help')
                        || lowerContent.includes('can you');

      return {
        category: 'other', // Changed from 'general' to match database enum
        priority: isQuestion ? 'high' : 'medium',
        sentiment: 'neutral',
        summary: content.substring(0, 50),
        intent: isQuestion ? 'question' : 'statement',
        entities: [],
        confidence: 0.5,
        aiProcessed: false,
        fallbackUsed: true,
      };
    }
  }

  /**
   * Generate intelligent, contextual auto-response based on message content
   * @param {string} messageContent - Original message content
   * @param {object} context - Context information
   * @returns {string} Generated response
   */
  async generateResponse(messageContent, context = {}) {
    if (!this.enabled) {
      return null;
    }

    try {
      const prompt = this.buildContextualResponsePrompt(messageContent, context);

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.buildContextualSystemPrompt(context),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8, // Increased for more varied responses
        max_tokens: 250, // Slightly increased for more detailed responses
      });

      const generatedResponse = response.data.choices[0]?.message?.content;

      if (!generatedResponse) {
        throw new Error('Empty AI response received');
      }

      logger.info('AI contextual response generated', {
        originalLength: messageContent.length,
        responseLength: generatedResponse.length,
        tokensUsed: response.data.usage?.total_tokens,
        category: context.analysis?.category,
        priority: context.analysis?.priority,
        sentiment: context.analysis?.sentiment,
      });

      return generatedResponse.trim();
    } catch (error) {
      logger.error('AI response generation failed completely', {
        error: error.message,
        contentLength: messageContent.length,
        context: {
          senderName: context.senderName,
          category: context.analysis?.category,
          priority: context.analysis?.priority,
        },
      });

      // Return null to indicate failure - let the caller handle fallback
      return null;
    }
  }

  /**
   * Summarize conversation for reporting
   * @param {Array} messages - Array of messages in conversation
   * @param {object} context - Additional context
   * @returns {string} Conversation summary
   */
  async summarizeConversation(messages, context = {}) {
    if (!this.enabled || !messages.length) {
      return null;
    }

    try {
      const conversationText = messages
        .map((msg) => `${msg.sender}: ${msg.content}`)
        .join('\n');

      const prompt = `Please provide a concise summary of this conversation:

${conversationText}

Summary should include:
- Main topic/purpose
- Key points discussed  
- Current status
- Any action items or follow-ups needed
- Urgency level

Keep the summary under 200 words.`;

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that creates concise, accurate summaries of conversations for a personal assistant service.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 250,
      });

      const summary = response.data.choices[0]?.message?.content;

      if (summary) {
        logger.info('Conversation summarized', {
          messageCount: messages.length,
          summaryLength: summary.length,
          tokensUsed: response.data.usage?.total_tokens,
        });
      }

      return summary?.trim() || null;
    } catch (error) {
      logger.error('Failed to summarize conversation', {
        error: error.message,
        messageCount: messages.length,
      });
      return null;
    }
  }

  /**
   * Extract entities and important information from message
   * @param {string} content - Message content
   * @returns {object} Extracted entities
   */
  async extractEntities(content) {
    if (!this.enabled) {
      return { entities: [], aiProcessed: false };
    }

    try {
      const prompt = `Extract important entities and information from this message. Return as JSON:

Message: "${content}"

Please identify and extract:
- Person names
- Company names
- Locations
- Dates and times
- Phone numbers
- Email addresses
- Products/services mentioned
- Important keywords

Return in format:
{
  "entities": [
    {"type": "person", "value": "John Smith", "confidence": 0.9},
    {"type": "date", "value": "tomorrow", "confidence": 0.8}
  ]
}`;

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI specialized in named entity recognition. Return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const aiResponse = response.data.choices[0]?.message?.content;
      const parsed = this.parseAIResponse(aiResponse);

      return {
        entities: parsed.entities || [],
        aiProcessed: true,
      };
    } catch (error) {
      logger.error('Failed to extract entities', {
        error: error.message,
        contentLength: content.length,
      });

      return { entities: [], aiProcessed: false };
    }
  }

  /**
   * Build backend system prompt (handles all logic through natural language)
   */
  buildSystemPrompt(context) {
    const ownerName = context.ownerName || 'the owner';
    const senderName = context.senderName || 'the sender';
    const recentMessages = context.recentMessages || '';

    return `You are PAI (Personal AI), ${ownerName}'s intelligent personal assistant managing WhatsApp communications.

CORE IDENTITY:
- You are always PAI, never change your identity
- You serve as intermediary between contacts and ${ownerName}
- Always identify yourself clearly when appropriate

DECISION MAKING (analyze each message):
🟢 RESPOND when:
- Greetings or introductions (identify as PAI)
- Questions directed at assistant or owner
- Invitations or requests for ${ownerName} (acknowledge and relay)
- Direct conversation with the assistant
- Follow-ups to previous assistant responses

🔴 DON'T RESPOND when:
- Replies to someone else's message (not directed at you)
- Conversations between others where you're not involved
- Acknowledgments like "ok", "thanks" after you've already helped

RESPONSE STYLE:
- ALWAYS identify yourself as PAI in responses when appropriate
- First interaction: "Hola ${senderName}! Soy PAI, el asistente personal de ${ownerName}..."
- For invitations: "Hola ${senderName}, soy PAI. Le voy a avisar a ${ownerName} sobre [invitation details]"
- For questions: "Soy PAI, el asistente de ${ownerName}. [answer the question]"
- Always use sender's name when greeting
- Be warm, professional, and clear about your intermediary role
- Speak naturally - no templates or robotic responses

CURRENT CONTEXT:
- Contact: ${senderName}
- Recent conversation: ${recentMessages}

${context.ownerSystemPrompt ? `OWNER'S ADDITIONAL INSTRUCTIONS:\n${context.ownerSystemPrompt}` : ''}

Analyze this message and respond appropriately based on the above guidelines.`;
  }

  /**
   * Build contextual system prompt (now uses the dual-prompt architecture)
   */
  buildContextualSystemPrompt(context) {
    // Always use the new system prompt architecture
    return this.buildSystemPrompt(context);
  }

  /**
   * Build contextual response prompt with rich context
   */
  buildContextualResponsePrompt(messageContent, context) {
    const senderName = context.senderName || 'the sender';
    const ownerName = context.ownerName || 'the owner';
    const analysis = context.analysis || {};

    return `RESPOND AS PAI to this WhatsApp message:

FROM: ${senderName}
MESSAGE: "${messageContent}"
TIME: ${new Date().toLocaleString()}

MESSAGE ANALYSIS:
- Intent: ${analysis.intent || 'unknown'}
- Sentiment: ${analysis.sentiment || 'neutral'}
- Requires Response: ${analysis.requiresResponse}
- Reason: ${analysis.responseReason}

RESPONSE CONTEXT:
${context.isFirstMessage ? '- This is their first message to you - identify yourself as PAI' : '- Ongoing conversation'}
${context.recentMessages ? `- Recent context: ${context.recentMessages}` : ''}

Generate your response following the system guidelines above. Be natural, personal, and remember you are PAI serving as ${ownerName}'s assistant.`;
  }

  /**
   * Build analysis prompt for message understanding
   */
  buildAnalysisPrompt(content, context) {
    const ownerName = context.ownerName || 'the owner';
    const senderName = context.senderName || 'the sender';
    const recentMessages = context.recentMessages || '';

    return `As PAI, ${ownerName}'s personal AI assistant, analyze this WhatsApp message to determine how to respond:

MESSAGE: "${content}"
FROM: ${senderName}
RECENT CONTEXT: ${recentMessages}

Provide analysis in JSON format:
{
  "category": "business|personal|support|sales|spam|inquiry|other",
  "priority": "urgent|high|medium|low", 
  "sentiment": "positive|negative|neutral",
  "intent": "question|request|complaint|information|greeting|gratitude|invitation|reply_to_others|other",
  "summary": "brief summary of message content",
  "confidence": 0.0-1.0,
  "requiresResponse": true|false,
  "responseReason": "greeting|direct_question|invitation_for_owner|reply_to_others|standalone_comment|conversation_continuation",
  "recommendedActions": ["respond_with_identity", "relay_to_owner", "no_response_needed"]
}

DECISION LOGIC (use natural understanding, not rigid rules):
- "Hola" from new contact → requiresResponse: true, reason: "greeting"
- "Cenamos hoy?" → requiresResponse: true, reason: "invitation_for_owner"  
- "Sin duda" after someone else spoke → requiresResponse: false, reason: "reply_to_others"
- Questions about ${ownerName} → requiresResponse: true, reason: "direct_question"

Focus on conversational context and natural language understanding.`;
  }

  /**
   * Build response generation prompt
   */
  buildResponsePrompt(messageContent, context) {
    const ownerName = context.ownerName || 'the owner';
    const senderName = context.senderName || 'there';

    return `Generate a professional auto-response for this WhatsApp message:

Original message: "${messageContent}"

Context:
- You are the personal assistant for ${ownerName}
- Sender's name: ${senderName}
- This is ${context.isFirstMessage ? 'the first message from this contact' : 'an ongoing conversation'}

The response should:
1. Be professional but friendly
2. Acknowledge their message
3. Explain you're ${ownerName}'s personal assistant
4. Ask for any additional details if the request is unclear
5. Indicate when they can expect a response from ${ownerName}
6. Be concise (under 100 words)

Generate the response:`;
  }

  /**
   * Parse AI response and handle JSON parsing safely
   */
  parseAIResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, try parsing the whole response
      return JSON.parse(response);
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON', {
        response: response.substring(0, 200),
        error: error.message,
      });

      // Return default structure if parsing fails
      return {
        category: 'other',
        priority: 'medium',
        sentiment: 'neutral',
        summary: 'Unable to parse AI analysis',
        intent: 'other',
        entities: [],
        confidence: 0.3,
      };
    }
  }

  /**
   * Get AI service statistics
   */
  async getServiceStats() {
    return {
      enabled: this.enabled,
      model: this.model,
      apiKeyConfigured: !!this.apiKey,
      // Note: OpenAI doesn't provide usage stats via API without additional setup
      // In production, you might want to track usage in your database
    };
  }

  /**
   * Test AI connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'AI service not configured' };
    }

    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Hello, please respond with "AI service is working"',
          },
        ],
        max_tokens: 20,
      });

      const content = response.data.choices[0]?.message?.content;

      return {
        success: true,
        model: this.model,
        response: content,
        tokensUsed: response.data.usage?.total_tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
      };
    }
  }
}

// Export singleton instance
module.exports = new AIService();
