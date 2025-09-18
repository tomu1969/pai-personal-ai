/**
 * @file messageProcessor.js
 * @description Core message processing pipeline for WhatsApp messages
 * @module services/whatsapp/messageProcessor
 * @requires ./assistant - Assistant service for response generation
 * @requires ./conversation - Conversation management service
 * @requires ./filters - Message filtering and analysis
 * @requires ./groupService - WhatsApp group handling
 * @requires ./assistantMessageHandler - PAI Assistant message processing
 * @requires ./ai - AI service integration
 * @requires ./whatsapp-assistant - WhatsApp-specific AI assistant
 * @requires ./whatsapp - Core WhatsApp service
 * @requires ../models - Database models
 * @requires ../utils/logger - Logging utility
 * @exports MessageProcessorService
 * @author PAI System
 * @since September 2025
 */

const assistantService = require('../assistant');
const conversationService = require('../utils/conversation');
const filterService = require('../utils/filters');
const groupService = require('../utils/groupService');
const assistantMessageHandler = require('../assistantMessageHandler');
const aiService = require('../ai/assistantAI');
const newAIService = require('../ai');
const whatsappAssistant = require('../ai/whatsapp-assistant');
const WhatsAppService = require('./whatsapp');
const evolutionMultiInstance = require('./evolutionMultiInstance');
const { Message } = require('../../models');
const logger = require('../../utils/logger');

/**
 * Core message processing pipeline for WhatsApp messages
 * Orchestrates message analysis, filtering, AI processing, and response generation
 * 
 * Features:
 * - Multi-stage message processing pipeline
 * - Assistant conversation detection and handling
 * - Message filtering and spam detection
 * - AI-powered response generation
 * - Queue-based processing for high throughput
 * - Error handling and recovery
 * 
 * @class MessageProcessorService
 * @example
 * const processor = new MessageProcessorService();
 * const result = await processor.processMessage(webhookMessage);
 */
class MessageProcessorService {
  /**
   * Initialize message processor with WhatsApp service and processing queue
   * @constructor
   * @param {object} options - Configuration options
   * @param {object} options.whatsappService - Optional WhatsApp service instance
   * @param {string} options.instanceAlias - Evolution instance alias for routing
   */
  constructor(options = {}) {
    this.whatsappService = options.whatsappService || new WhatsAppService();
    this.instanceAlias = options.instanceAlias || 'main';
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Main message processing pipeline
   * Handles all incoming WhatsApp messages through multi-stage processing
   * 
   * @param {object} parsedMessage - Parsed message from webhook containing:
   *   @param {string} parsedMessage.messageId - Unique message ID
   *   @param {string} parsedMessage.phone - Sender phone number
   *   @param {string} parsedMessage.content - Message content
   *   @param {string} parsedMessage.messageType - Type of message (text, image, etc.)
   *   @param {number} parsedMessage.timestamp - Message timestamp
   * @returns {Promise<object>} Processing results with success status and actions taken
   */
  async processMessage(parsedMessage) {
    const processingId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting message processing', {
      processingId,
      messageId: parsedMessage.messageId,
      phone: parsedMessage.phone,
      messageType: parsedMessage.messageType,
    });

    logger.debug('DEBUG: processMessage called with content', {
      processingId,
      content: parsedMessage.content,
      messageType: parsedMessage.messageType,
    });

    try {
      // Step 1: Check if assistant is enabled
      const assistantEnabled = await assistantService.isEnabled();
      if (!assistantEnabled) {
        logger.debug('Assistant disabled, skipping processing', { processingId });
        return { processed: false, reason: 'assistant_disabled' };
      }

      // Step 1.1: Check if this is the Assistant conversation (high priority, handle immediately)
      const ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';
      const isAssistantConversation = parsedMessage.phone === 'assistant'
                                      || parsedMessage.conversationId === ASSISTANT_CONVERSATION_ID;

      if (isAssistantConversation) {
        logger.info('Assistant conversation message detected', {
          processingId,
          phone: parsedMessage.phone,
          content: parsedMessage.content.substring(0, 100),
        });

        try {
          // Use the new assistant message handler with entity extraction
          await assistantMessageHandler.processAssistantMessage(
            parsedMessage.content,
            ASSISTANT_CONVERSATION_ID,
            (conversationId, isTyping, sender = 'assistant') => {
              // Broadcast typing indicator through realtime service
              const realtimeService = require('./realtime');
              realtimeService.broadcastTypingIndicator(conversationId, {
                userId: sender,
                isTyping,
                timestamp: new Date().toISOString(),
              });
            },
            (conversationId, message) => {
              // Broadcast message through realtime service
              const realtimeService = require('./realtime');
              realtimeService.broadcastMessage(conversationId, message);
            },
          );

          logger.info('Assistant message processed successfully', {
            processingId,
            contentLength: parsedMessage.content.length,
          });

          return {
            processed: true,
            reason: 'assistant_conversation',
            phone: 'assistant',
            conversationId: ASSISTANT_CONVERSATION_ID,
          };
        } catch (assistantError) {
          logger.error('Failed to process assistant message', {
            processingId,
            error: assistantError.message,
            stack: assistantError.stack,
          });

          return { processed: true, reason: 'assistant_error', error: assistantError.message };
        }
      }

      // Check if message type should be processed based on assistant preferences
      const messageTypeCheck = await this.shouldProcessMessageType(parsedMessage);
      const assistantWillProcess = messageTypeCheck.shouldProcess;

      // Early return if message type is not allowed
      if (!assistantWillProcess) {
        logger.info('Message type not allowed by assistant preferences', {
          processingId,
          phone: parsedMessage.phone,
          reason: messageTypeCheck.reason,
        });
        return { processed: false, reason: messageTypeCheck.reason };
      }

      // Step 2: Basic message filtering
      const basicAnalysis = filterService.analyzeMessage(parsedMessage.content, {
        senderName: parsedMessage.pushName,
        messageType: parsedMessage.messageType,
        timestamp: parsedMessage.timestamp,
      });

      // Step 3: Check for spam early
      if (basicAnalysis.isSpam) {
        logger.warn('Spam message detected, skipping processing', {
          processingId,
          phone: parsedMessage.phone,
          spamReason: basicAnalysis.flags,
        });
        return { processed: false, reason: 'spam_detected', analysis: basicAnalysis };
      }

      // Step 4: Find or create contact with better name handling
      const contactInfo = {
        name: parsedMessage.pushName,
        metadata: { lastMessageType: parsedMessage.messageType },
      };

      // Check if this is a group message and handle group metadata
      const isGroup = parsedMessage.phone.includes('@g.us') || parsedMessage.isGroupMessage;

      if (isGroup) {
        // Handle group metadata through the group service
        try {
          // Update or create group metadata from webhook data
          const group = await groupService.updateFromWebhook(parsedMessage.phone, {
            groupSubject: parsedMessage.groupName,
            participantId: parsedMessage.participantJid,
            participantName: parsedMessage.pushName,
            messageData: parsedMessage,
          });

          // Get the best available group name
          const groupDisplayName = await groupService.getGroupDisplayName(parsedMessage.phone);

          contactInfo.name = groupDisplayName;
          contactInfo.isGroup = true;
          contactInfo.metadata.lastGroupNameSync = new Date();
          contactInfo.metadata.groupNameSource = 'group_service';
          contactInfo.metadata.groupMetadataId = group.id;

          logger.info('Updated group metadata from message', {
            groupId: parsedMessage.phone,
            groupName: contactInfo.name,
            participantName: parsedMessage.pushName,
            groupMetadataId: group.id,
          });
        } catch (error) {
          logger.error('Failed to update group metadata', {
            groupId: parsedMessage.phone,
            error: error.message,
          });

          // Fallback to basic group handling
          contactInfo.name = parsedMessage.groupName || 'Group Chat';
          contactInfo.isGroup = true;
          contactInfo.metadata.groupNameSource = 'fallback';
        }
      } else {
        // Try to fetch fresh contact info from WhatsApp if pushName is missing or generic
        if (!parsedMessage.pushName || this.isGenericContactName(parsedMessage.pushName)) {
          try {
            const whatsappContactInfo = await this.fetchContactInfoFromWhatsApp(parsedMessage.phone);
            if (whatsappContactInfo) {
              contactInfo.name = whatsappContactInfo.name || parsedMessage.pushName;
              contactInfo.profilePicture = whatsappContactInfo.profilePicture;
              contactInfo.metadata.lastWhatsAppSync = new Date();
            }
          } catch (error) {
            logger.debug('Failed to fetch contact info from WhatsApp', {
              phone: parsedMessage.phone,
              error: error.message,
            });
          }
        }
      }

      const contact = await conversationService.findOrCreateContact(parsedMessage.phone, contactInfo);

      // Step 5: Check if contact is blocked
      if (contact.isBlocked) {
        logger.info('Message from blocked contact, skipping', {
          processingId,
          contactId: contact.id,
          phone: contact.phone,
        });
        return { processed: false, reason: 'contact_blocked' };
      }

      // Skip complex analysis - keep it simple
      basicAnalysis.category = 'general';
      basicAnalysis.priority = 'medium';
      basicAnalysis.aiEnhanced = false;

      // Step 7: Update contact category and priority if needed
      await this.updateContactFromAnalysis(contact, basicAnalysis);

      // Step 8: Find or create conversation
      const conversation = await conversationService.findOrCreateConversation(contact.id, basicAnalysis);

      // Step 9: Save message to database
      const savedMessage = await conversationService.saveMessage(
        parsedMessage,
        contact.id,
        conversation.id,
        basicAnalysis,
      );

      // Step 10: Check if we should send auto-response (only if assistant will process this message type)
      let responseResult = null;
      if (assistantWillProcess) {
        // Use the new AI service for checking if should respond
        const context = {
          senderName: contact.name,
          conversationId: conversation.id,
          contactId: contact.id
        };
        const shouldRespond = await newAIService.shouldRespond(savedMessage.content, context);
        if (shouldRespond) {
          responseResult = await this.generateAndSendResponse(parsedMessage, contact, conversation, basicAnalysis);
        }
      }

      // Step 11: Update assistant statistics
      await assistantService.incrementMessageCount();

      // Step 12: Schedule summary generation for important conversations
      if (basicAnalysis.priority === 'urgent' || basicAnalysis.priority === 'high') {
        this.scheduleConversationSummary(conversation.id);
      }

      const result = {
        processed: true,
        processingId,
        contact: {
          id: contact.id,
          phone: contact.phone,
          name: contact.name,
        },
        conversation: {
          id: conversation.id,
          status: conversation.status,
          priority: conversation.priority,
          category: conversation.category,
        },
        message: {
          id: savedMessage.id,
          analysis: basicAnalysis,
        },
        response: responseResult,
        aiProcessed: true, // Using WhatsApp Assistant
        assistantProcessed: assistantWillProcess,
        messageTypeFilterReason: assistantWillProcess ? null : messageTypeCheck.reason,
      };

      logger.info('Message processing completed', {
        processingId,
        messageId: savedMessage.id,
        conversationId: conversation.id,
        responseSent: !!responseResult?.sent,
        assistantProcessed: assistantWillProcess,
        messageTypeFilter: assistantWillProcess ? null : messageTypeCheck.reason,
        priority: basicAnalysis.priority,
        category: basicAnalysis.category,
      });

      return result;
    } catch (error) {
      logger.error('Message processing failed', {
        processingId,
        messageId: parsedMessage.messageId,
        phone: parsedMessage.phone,
        error: error.message,
        stack: error.stack,
      });

      return {
        processed: false,
        reason: 'processing_error',
        error: error.message,
        processingId,
      };
    }
  }

  /**
   * Generate and send contextual auto-response
   */
  async generateAndSendResponse(parsedMessage, contact, conversation, analysis) {
    try {
      let responseText = null;

      // Ultra-simple AI response generation
      logger.debug('AI Service Check', { 
        isEnabled: await newAIService.isEnabled(),
        phone: contact.phone
      });
      
      if (await newAIService.isEnabled()) {
        const assistant = await assistantService.ensureInitialized();
        
        // Get recent conversation context for better responses (last 10 messages)
        const recentMessages = await Message.findAll({
          where: {
            conversationId: conversation.id,
          },
          order: [['createdAt', 'DESC']],
          limit: 10,
        });

        // Convert to proper format for AI context
        const messageHistory = recentMessages.reverse(); // Chronological order

        // Use new WhatsApp Assistant for AI responses
        logger.info('Using new WhatsApp Assistant for AI processing', {
          contactPhone: contact.phone,
          assistantName: assistant.assistantName,
        });

        responseText = await whatsappAssistant.processMessage(parsedMessage.content, contact.phone, {
          ownerName: assistant.ownerName,
          assistantName: assistant.assistantName,
          systemPrompt: assistant.systemPrompt,
          contactName: contact.name,
        });
      }

      // If AI fails, create a contextual fallback (no templates)
      if (!responseText) {
        responseText = this.generateContextualFallback(parsedMessage, contact, analysis);
      }

      // Send response via WhatsApp using the correct instance
      let sendResult;
      if (this.instanceAlias !== 'main') {
        // Use multi-instance service for non-main instances
        sendResult = await evolutionMultiInstance.sendMessage(this.instanceAlias, contact.phone, responseText);
        logger.info('Message sent via multi-instance service', {
          instance: this.instanceAlias,
          phone: contact.phone,
          responseLength: responseText.length
        });
      } else {
        // Use legacy WhatsApp service for main instance
        sendResult = await this.whatsappService.sendMessage(contact.phone, responseText);
      }

      // Save assistant response to database
      const assistantMessage = await conversationService.saveAssistantMessage(
        conversation.id,
        contact.id,
        responseText,
        {
          aiGenerated: true, // Using WhatsApp Assistant
          evolutionResponse: sendResult,
          triggerMessageId: parsedMessage.messageId,
        },
      );

      const wasAIGenerated = responseText !== this.generateContextualFallback(parsedMessage, contact, analysis);

      logger.info('Contextual auto-response sent successfully', {
        conversationId: conversation.id,
        phone: contact.phone,
        responseLength: responseText.length,
        messageId: assistantMessage.id,
        aiGenerated: wasAIGenerated,
        category: analysis.category,
        priority: analysis.priority,
      });

      return {
        sent: true,
        messageId: assistantMessage.id,
        content: responseText,
        aiGenerated: wasAIGenerated,
        evolutionMessageId: sendResult?.key?.id,
        contextual: true,
      };
    } catch (error) {
      logger.error('Failed to generate/send auto-response', {
        conversationId: conversation.id,
        phone: contact.phone,
        error: error.message,
      });

      return {
        sent: false,
        error: error.message,
      };
    }
  }

  /**
   * Update contact information based on message analysis
   */
  async updateContactFromAnalysis(contact, analysis) {
    try {
      const updates = {};

      // Update category if AI provided a more specific one
      if (analysis.category && analysis.category !== 'other' && contact.category === 'unknown') {
        updates.category = this.mapAnalysisCategoryToContact(analysis.category);
      }

      // Update priority if analysis indicates higher priority and AI confidence is high
      if (analysis.priority && analysis.confidence > 0.7) {
        const newPriority = this.determinePriorityLevel(analysis.priority, contact.priority);
        if (newPriority !== contact.priority) {
          updates.priority = newPriority;
        }
      }

      // Update last seen
      updates.lastSeen = new Date();

      // Update metadata with analysis insights
      updates.metadata = {
        ...contact.metadata,
        lastAnalysis: {
          category: analysis.category,
          priority: analysis.priority,
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          timestamp: new Date(),
        },
      };

      if (Object.keys(updates).length > 1) { // More than just lastSeen
        await contact.update(updates);

        logger.debug('Contact updated from message analysis', {
          contactId: contact.id,
          updates: Object.keys(updates),
        });
      }
    } catch (error) {
      logger.error('Failed to update contact from analysis', {
        contactId: contact.id,
        error: error.message,
      });
    }
  }

  /**
   * Schedule conversation summary generation (async)
   */
  scheduleConversationSummary(conversationId) {
    // Use setTimeout to avoid blocking the main processing
    setTimeout(async () => {
      try {
        await conversationService.generateConversationSummary(conversationId);
      } catch (error) {
        logger.error('Failed to generate scheduled conversation summary', {
          conversationId,
          error: error.message,
        });
      }
    }, 5000); // 5 second delay
  }

  /**
   * Process multiple messages in queue
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.debug('Starting queue processing', { queueLength: this.processingQueue.length });

    while (this.processingQueue.length > 0) {
      const message = this.processingQueue.shift();
      try {
        await this.processMessage(message);
      } catch (error) {
        logger.error('Queue processing error', {
          messageId: message.messageId,
          error: error.message,
        });
      }
    }

    this.isProcessing = false;
    logger.debug('Queue processing completed');
  }

  /**
   * Add message to processing queue
   */
  queueMessage(parsedMessage) {
    this.processingQueue.push(parsedMessage);

    // Start processing if not already running
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    const aiEnabled = await newAIService.isEnabled();
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      services: {
        assistant: assistantService.isInitialized,
        ai: aiEnabled,
        whatsapp: !!this.whatsappService,
      },
    };
  }

  /**
   * Helper: Map analysis category to contact category
   */
  mapAnalysisCategoryToContact(analysisCategory) {
    const categoryMap = {
      business: 'business',
      sales: 'business',
      support: 'business',
      personal: 'personal',
      spam: 'spam',
    };

    return categoryMap[analysisCategory] || 'unknown';
  }

  /**
   * Helper: Map analysis category to conversation category (different enum)
   */
  mapAnalysisCategoryToConversation(analysisCategory) {
    const categoryMap = {
      business: 'sales', // Map business -> sales (allowed enum)
      sales: 'sales',
      support: 'support',
      personal: 'personal',
      spam: 'spam',
      inquiry: 'inquiry',
    };

    return categoryMap[analysisCategory] || 'other';
  }

  /**
   * Check if message type should be processed based on assistant preferences
   */
  async shouldProcessMessageType(parsedMessage) {
    try {
      // Use the new AI service which gets PAI Responder preferences
      const assistantStatus = await newAIService.getStatus();
      const preferences = assistantStatus.messageTypePreferences || {
        allMessages: true,
        individualMessages: true,
        groupMessages: true,
        reactions: true,
        distributionLists: true,
      };

      // If allMessages is enabled, process everything
      if (preferences.allMessages) {
        return { shouldProcess: true, reason: 'all_messages_enabled' };
      }

      // Determine message source type from phone/remoteJid
      const { phone } = parsedMessage;
      const { messageType } = parsedMessage;

      // Check for group messages (remoteJid ends with @g.us)
      const isGroupMessage = phone.includes('@g.us') || phone.endsWith('-group');

      // Check for distribution lists (remoteJid contains @broadcast)
      const isDistributionList = phone.includes('@broadcast');

      // Check for reactions (messageType contains reaction)
      const isReaction = messageType && (
        messageType.includes('reaction')
        || messageType === 'reactionMessage'
        || messageType === 'protocolMessage'
      );

      // Individual messages are everything else
      const isIndividualMessage = !isGroupMessage && !isDistributionList;

      // Check preferences - reactions take priority over other types
      if (isReaction) {
        if (!preferences.reactions) {
          return { shouldProcess: false, reason: 'reactions_disabled' };
        }
        return { shouldProcess: true, reason: 'message_type_allowed' };
      }

      if (isDistributionList && !preferences.distributionLists) {
        return { shouldProcess: false, reason: 'distribution_lists_disabled' };
      }

      if (isGroupMessage && !preferences.groupMessages) {
        return { shouldProcess: false, reason: 'group_messages_disabled' };
      }

      if (isIndividualMessage && !preferences.individualMessages) {
        return { shouldProcess: false, reason: 'individual_messages_disabled' };
      }

      return { shouldProcess: true, reason: 'message_type_allowed' };
    } catch (error) {
      logger.error('Error checking message type preferences', {
        error: error.message,
        messageId: parsedMessage.messageId,
        messageType: parsedMessage.messageType,
        phone: parsedMessage.phone,
      });

      // Default to allowing processing if there's an error
      return { shouldProcess: true, reason: 'preference_check_error' };
    }
  }

  /**
   * Helper: Determine priority level considering both current and new priority
   */
  determinePriorityLevel(newPriority, currentPriority) {
    const priorityLevels = {
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4,
    };

    const currentLevel = priorityLevels[currentPriority] || 2;
    const newLevel = priorityLevels[newPriority] || 2;

    // Use higher priority, but don't downgrade from urgent
    if (currentPriority === 'urgent') {
      return 'urgent';
    }

    const maxLevel = Math.max(currentLevel, newLevel);
    return Object.keys(priorityLevels).find((key) => priorityLevels[key] === maxLevel) || 'medium';
  }

  /**
   * Generate contextual fallback response when AI fails
   */
  generateContextualFallback(parsedMessage, contact, analysis) {
    const contactName = contact.name || 'there';
    const priority = analysis.priority || 'medium';
    const category = analysis.category || 'general';
    const sentiment = analysis.sentiment || 'neutral';

    // Create varied contextual responses based on message properties
    const timeOfDay = new Date().getHours();
    const greeting = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';

    let response = `${greeting}, ${contactName}! `;

    // Adapt response based on category
    switch (category) {
      case 'urgent':
      case 'high':
        response += 'I understand this seems important. I\'ll make sure to get back to you quickly.';
        break;
      case 'business':
      case 'sales':
        response += 'Thanks for your business inquiry. I\'ll review this with my team and get back to you soon.';
        break;
      case 'support':
        response += 'I received your support request and will help you resolve this as soon as possible.';
        break;
      case 'personal':
        response += 'Thanks for reaching out! I\'ll pass this along and get back to you.';
        break;
      default:
        response += 'Thanks for your message! I\'ll review this and respond shortly.';
    }

    // Add sentiment-based variation
    if (sentiment === 'negative') {
      response += ' I understand your concerns and will make sure to address them promptly.';
    } else if (sentiment === 'positive') {
      response += ' I appreciate you reaching out!';
    }

    return response;
  }

  /**
   * Helper: Check if a contact name is generic or empty
   */
  isGenericContactName(name) {
    if (!name || typeof name !== 'string') return true;

    const lowerName = name.toLowerCase().trim();

    // Check for empty or whitespace-only names
    if (lowerName.length === 0) return true;

    // Check for generic names that WhatsApp might use
    const genericNames = [
      'whatsapp user',
      'user',
      'contact',
      'unknown',
      'unnamed',
      '+',
      'number',
    ];

    return genericNames.some((generic) => lowerName === generic || lowerName.startsWith(generic));
  }

  /**
   * Helper: Fetch contact information from WhatsApp Evolution API
   */
  async fetchContactInfoFromWhatsApp(phone) {
    try {
      // First try to get contact from Evolution API contacts
      const contacts = await this.whatsappService.fetchAllContacts();
      const matchingContact = contacts.find((contact) => {
        const contactPhone = contact.id?.replace('@s.whatsapp.net', '').replace('@g.us', '');
        return contactPhone === phone;
      });

      if (matchingContact) {
        return {
          name: matchingContact.name || matchingContact.pushName || matchingContact.notify || null,
          profilePicture: matchingContact.profilePictureUrl || null,
          isGroup: matchingContact.id?.includes('@g.us') || false,
        };
      }

      // If not found in contacts, try to get from chats
      const chats = await this.whatsappService.fetchAllChats();
      const matchingChat = chats.find((chat) => {
        const chatPhone = chat.id?.replace('@s.whatsapp.net', '').replace('@g.us', '');
        return chatPhone === phone;
      });

      if (matchingChat) {
        return {
          name: matchingChat.name || matchingChat.pushName || null,
          profilePicture: null, // Chats don't typically have profile pictures
          isGroup: matchingChat.id?.includes('@g.us') || false,
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch contact info from WhatsApp', {
        phone,
        error: error.message,
      });
      return null;
    }
  }
}

// Export singleton instance
module.exports = new MessageProcessorService();
