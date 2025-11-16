/**
 * @file cs-webhook.js
 * @description Webhook controller for CS Ticket Monitor instance
 * @module ai-cs/controllers/cs-webhook
 * @requires ../../src/utils/logger
 * @exports handleCSWebhook, processGroupMessage, getCSWebhookStatus
 * @author PAI System - CS Module
 * @since November 2025
 */

const logger = require('../../src/utils/logger');

/**
 * CS Ticket Monitor webhook handler
 * Processes incoming WhatsApp messages from groups to detect customer service tickets
 * 
 * @class CSWebhookController
 */
class CSWebhookController {
  constructor() {
    this.instanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';
    this.processedMessages = new Set(); // Prevent duplicate processing
  }

  /**
   * Main webhook handler for CS Ticket Monitor
   * Processes incoming Evolution API webhooks for group messages
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} Response indicating webhook processing status
   */
  async handleCSWebhook(req, res) {
    try {
      const { body } = req;
      const { event, instance, data } = body;

      logger.info('CS Webhook received', {
        event,
        instance,
        hasData: !!data,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      });

      // Validate webhook payload
      if (!event || !instance || !data) {
        logger.warn('Invalid CS webhook payload', {
          missingFields: {
            event: !event,
            instance: !instance,
            data: !data
          },
          body
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook payload',
          required: ['event', 'instance', 'data']
        });
      }

      // Verify this is for our CS instance
      if (instance !== this.instanceId) {
        logger.debug('CS webhook for different instance, ignoring', {
          receivedInstance: instance,
          expectedInstance: this.instanceId
        });
        return res.status(200).json({
          success: true,
          message: 'Instance mismatch, ignored'
        });
      }

      // Process different webhook events
      let processingResult = { success: true, processed: false };

      switch (event) {
        case 'messages.upsert':
        case 'MESSAGES_UPSERT':
          processingResult = await this.processMessageUpsert(data);
          break;

        case 'connection.update':
        case 'CONNECTION_UPDATE':
          processingResult = await this.processConnectionUpdate(data);
          break;

        default:
          logger.debug('CS webhook event not handled', {
            event,
            instance,
            availableEvents: ['messages.upsert', 'connection.update']
          });
          processingResult = { success: true, processed: false, reason: 'Event not handled' };
      }

      logger.info('CS webhook processing completed', {
        event,
        instance,
        processingResult
      });

      return res.status(200).json({
        success: true,
        event,
        instance,
        processingResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to process CS webhook', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });

      return res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Process incoming WhatsApp messages
   * Filters for group messages and prepares for ticket detection
   * 
   * @param {Object} data - Message data from Evolution API
   * @returns {Object} Processing result
   */
  async processMessageUpsert(data) {
    try {
      if (!data.messages || !Array.isArray(data.messages)) {
        logger.debug('No messages in upsert data', { data });
        return { success: true, processed: false, reason: 'No messages' };
      }

      let processedCount = 0;
      const results = [];

      for (const message of data.messages) {
        try {
          const result = await this.processGroupMessage(message);
          results.push(result);
          if (result.processed) processedCount++;
        } catch (messageError) {
          logger.error('Failed to process individual message', {
            messageId: message.key?.id,
            error: messageError.message
          });
          results.push({
            processed: false,
            error: messageError.message,
            messageId: message.key?.id
          });
        }
      }

      logger.info('CS message batch processing completed', {
        totalMessages: data.messages.length,
        processedCount,
        results: results.length
      });

      return {
        success: true,
        processed: processedCount > 0,
        totalMessages: data.messages.length,
        processedCount,
        results
      };

    } catch (error) {
      logger.error('Failed to process message upsert', {
        error: error.message,
        dataKeys: Object.keys(data || {})
      });
      return {
        success: false,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Process individual WhatsApp group message
   * Checks if message is from a group and extracts relevant information
   * 
   * @param {Object} message - Individual message object
   * @returns {Object} Processing result with group message details
   */
  async processGroupMessage(message) {
    try {
      const { key, message: messageContent, pushName, messageTimestamp } = message;
      const { remoteJid, fromMe, id } = key || {};

      // Skip if no remote JID or message ID
      if (!remoteJid || !id) {
        return {
          processed: false,
          reason: 'Missing remoteJid or message ID',
          messageId: id
        };
      }

      // Skip duplicate messages
      if (this.processedMessages.has(id)) {
        logger.debug('Duplicate message skipped', { messageId: id });
        return {
          processed: false,
          reason: 'Duplicate message',
          messageId: id
        };
      }

      // Check if this is a group message (ends with @g.us)
      const isGroupMessage = remoteJid.endsWith('@g.us');
      if (!isGroupMessage) {
        logger.debug('Skipping non-group message', {
          messageId: id,
          remoteJid,
          fromMe
        });
        return {
          processed: false,
          reason: 'Not a group message',
          messageId: id
        };
      }

      // Check if group is being monitored for CS tickets
      const groupsManager = require('../modules/groups-manager');
      const isMonitored = await groupsManager.isGroupMonitored(remoteJid);
      
      if (!isMonitored) {
        logger.debug('Skipping unmonitored group', {
          messageId: id,
          groupId: remoteJid,
          reason: 'Group not selected for CS monitoring'
        });
        return {
          processed: false,
          reason: 'Group not monitored for CS tickets',
          messageId: id,
          groupId: remoteJid
        };
      }

      // Skip messages sent by us (fromMe: true)
      if (fromMe) {
        logger.debug('Skipping outgoing message', {
          messageId: id,
          remoteJid
        });
        return {
          processed: false,
          reason: 'Outgoing message',
          messageId: id
        };
      }

      // Extract text content from message
      const textContent = this.extractTextFromMessage(messageContent);
      if (!textContent || textContent.trim().length === 0) {
        logger.debug('No text content found in message', {
          messageId: id,
          messageType: typeof messageContent
        });
        return {
          processed: false,
          reason: 'No text content',
          messageId: id
        };
      }

      // Mark as processed to prevent duplicates
      this.processedMessages.add(id);

      // Extract group information
      const groupId = remoteJid;
      const groupName = this.extractGroupName(message, remoteJid);
      const senderName = pushName || 'Unknown';
      const timestamp = messageTimestamp ? new Date(messageTimestamp * 1000) : new Date();

      // Auto-register this group for future selection (if not already registered)
      try {
        const groupsManager = require('../modules/groups-manager');
        await groupsManager.registerGroup(groupId, groupName, this.instanceId);
      } catch (registerError) {
        logger.warn('Failed to auto-register group', {
          groupId,
          groupName,
          error: registerError.message
        });
        // Continue processing even if registration fails
      }

      // Log the group message for Module B (Ticket Detection)
      logger.info('Group message detected for CS processing', {
        messageId: id,
        groupId,
        groupName,
        senderName,
        textLength: textContent.length,
        timestamp: timestamp.toISOString(),
        preview: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '')
      });

      // Prepare message data for orchestrator processing
      const messageData = {
        messageId: id,
        groupId,
        groupName,
        senderName,
        textContent,
        timestamp,
        fromWhatsApp: true,
        instanceId: this.instanceId
      };

      // Process message through CS orchestrator
      const processingResult = await this.processWithOrchestrator(messageData);

      return {
        processed: true,
        messageId: id,
        groupId,
        groupName,
        senderName,
        textLength: textContent.length,
        timestamp: timestamp.toISOString(),
        orchestratorResult: processingResult
      };

    } catch (error) {
      logger.error('Failed to process group message', {
        messageId: message?.key?.id,
        error: error.message
      });
      return {
        processed: false,
        error: error.message,
        messageId: message?.key?.id
      };
    }
  }

  /**
   * Extract text content from WhatsApp message object
   * Handles different message types (conversation, extendedTextMessage, etc.)
   * 
   * @param {Object} messageContent - Message content object
   * @returns {string} Extracted text content
   */
  extractTextFromMessage(messageContent) {
    if (!messageContent) return '';

    // Direct conversation text
    if (messageContent.conversation) {
      return messageContent.conversation;
    }

    // Extended text message
    if (messageContent.extendedTextMessage?.text) {
      return messageContent.extendedTextMessage.text;
    }

    // Image with caption
    if (messageContent.imageMessage?.caption) {
      return messageContent.imageMessage.caption;
    }

    // Video with caption
    if (messageContent.videoMessage?.caption) {
      return messageContent.videoMessage.caption;
    }

    // Document with caption
    if (messageContent.documentMessage?.caption) {
      return messageContent.documentMessage.caption;
    }

    // List message
    if (messageContent.listMessage?.description) {
      return messageContent.listMessage.description;
    }

    // Button response
    if (messageContent.buttonsResponseMessage?.selectedDisplayText) {
      return messageContent.buttonsResponseMessage.selectedDisplayText;
    }

    // Template button reply
    if (messageContent.templateButtonReplyMessage?.selectedDisplayText) {
      return messageContent.templateButtonReplyMessage.selectedDisplayText;
    }

    logger.debug('No text content found in message', {
      messageKeys: Object.keys(messageContent),
      messageType: typeof messageContent
    });

    return '';
  }

  /**
   * Extract group name from message or generate from group ID
   * 
   * @param {Object} message - Full message object
   * @param {string} groupId - WhatsApp group ID
   * @returns {string} Group name or fallback
   */
  extractGroupName(message, groupId) {
    // Try to get group name from message metadata
    if (message.groupMetadata?.subject) {
      return message.groupMetadata.subject;
    }

    // Try from pushName for group notifications
    if (message.pushName && !message.pushName.includes('@')) {
      return message.pushName;
    }

    // Fallback: generate readable name from group ID
    const groupNumber = groupId.split('@')[0];
    return `Group-${groupNumber.substring(0, 8)}`;
  }

  /**
   * Process group message with CS orchestrator
   * Integrates with ticket detection, sheets service, and follow-up scheduler
   * 
   * @param {Object} messageData - Processed message data
   * @returns {Promise<Object>} Processing result
   */
  async processWithOrchestrator(messageData) {
    try {
      // Lazy load orchestrator to avoid circular dependencies
      const csOrchestrator = require('../index');
      
      logger.debug('Processing message with CS orchestrator', {
        messageId: messageData.messageId,
        groupName: messageData.groupName,
        senderName: messageData.senderName
      });

      // Process as potential ticket
      const ticketResult = await csOrchestrator.processTicketMessage(messageData);
      
      // If not a ticket, check for status update
      if (!ticketResult.processed) {
        const statusResult = await csOrchestrator.processStatusUpdate(messageData);
        
        if (statusResult.processed) {
          logger.info('Status update processed', {
            messageId: messageData.messageId,
            newStatus: statusResult.newStatus
          });
          return statusResult;
        }
      } else {
        logger.info('Ticket processed successfully', {
          messageId: messageData.messageId,
          ticketId: ticketResult.ticketId,
          customer: ticketResult.customer,
          priority: ticketResult.priority
        });
        return ticketResult;
      }

      // Neither ticket nor status update
      return {
        success: true,
        processed: false,
        reason: 'Not a ticket or status update',
        messageId: messageData.messageId
      };

    } catch (error) {
      logger.error('Failed to process message with orchestrator', {
        messageId: messageData.messageId,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        messageId: messageData.messageId
      };
    }
  }

  /**
   * Process connection status updates
   * Logs WhatsApp connection changes for monitoring
   * 
   * @param {Object} data - Connection update data
   * @returns {Object} Processing result
   */
  async processConnectionUpdate(data) {
    try {
      const { state, statusReason } = data;

      logger.info('CS instance connection update', {
        state,
        statusReason,
        instanceId: this.instanceId,
        timestamp: new Date().toISOString()
      });

      // Handle different connection states
      switch (state) {
        case 'open':
          logger.info('CS Ticket Monitor connected and ready', {
            instanceId: this.instanceId,
            groupMonitoring: true
          });
          break;

        case 'close':
          logger.warn('CS Ticket Monitor disconnected', {
            instanceId: this.instanceId,
            statusReason
          });
          break;

        case 'connecting':
          logger.info('CS Ticket Monitor connecting', {
            instanceId: this.instanceId
          });
          break;

        default:
          logger.debug('CS connection state change', {
            state,
            statusReason,
            instanceId: this.instanceId
          });
      }

      return {
        success: true,
        processed: true,
        state,
        statusReason
      };

    } catch (error) {
      logger.error('Failed to process connection update', {
        error: error.message,
        data
      });
      return {
        success: false,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Process bulk historical messages for ticket extraction
   * Accepts an array of historical messages and processes them for tickets
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} Bulk processing result
   */
  async handleBulkProcessing(req, res) {
    try {
      const { messages, groupId, groupName, sourceType = 'historical' } = req.body;

      logger.info('Bulk processing request received', {
        messagesCount: messages?.length || 0,
        groupId,
        groupName,
        sourceType,
        timestamp: new Date().toISOString()
      });

      // Validate request
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Messages array is required and cannot be empty',
          timestamp: new Date().toISOString()
        });
      }

      if (!groupId || !groupName) {
        return res.status(400).json({
          success: false,
          error: 'Group ID and group name are required',
          timestamp: new Date().toISOString()
        });
      }

      // Process messages in batches
      const processingResult = await this.processBulkMessages({
        messages,
        groupId,
        groupName,
        sourceType,
        instanceId: this.instanceId
      });

      logger.info('Bulk processing completed', {
        totalMessages: processingResult.totalMessages,
        ticketsCreated: processingResult.ticketsCreated,
        duplicatesSkipped: processingResult.duplicatesSkipped,
        errors: processingResult.errors
      });

      return res.status(200).json({
        success: true,
        ...processingResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Bulk processing failed', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Bulk processing failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Process bulk messages for ticket detection
   * 
   * @param {Object} bulkData - Bulk processing data
   * @returns {Promise<Object>} Processing results
   */
  async processBulkMessages(bulkData) {
    const { messages, groupId, groupName, sourceType, instanceId } = bulkData;
    const results = {
      totalMessages: messages.length,
      processedMessages: 0,
      ticketsCreated: 0,
      duplicatesSkipped: 0,
      errors: 0,
      tickets: [],
      errorMessages: []
    };

    // Register group if not already registered
    try {
      const groupsManager = require('../modules/groups-manager');
      await groupsManager.registerGroup(groupId, groupName, instanceId);
      logger.debug('Group registered for bulk processing', { groupId, groupName });
    } catch (registerError) {
      logger.warn('Failed to register group during bulk processing', {
        groupId,
        groupName,
        error: registerError.message
      });
    }

    // Process each message
    for (let i = 0; i < messages.length; i++) {
      try {
        const message = messages[i];
        const messageData = this.formatHistoricalMessage(message, groupId, groupName, sourceType);
        
        // Check for duplicate content to avoid creating duplicate tickets
        const isDuplicate = await this.checkDuplicateTicket(messageData.textContent, groupId);
        if (isDuplicate) {
          results.duplicatesSkipped++;
          logger.debug('Skipping duplicate message', {
            messageIndex: i,
            preview: messageData.textContent.substring(0, 50)
          });
          continue;
        }

        // Process message through orchestrator
        const processingResult = await this.processWithOrchestrator(messageData);
        
        if (processingResult.success && processingResult.ticketCreated) {
          results.ticketsCreated++;
          results.tickets.push({
            ticketId: processingResult.ticketId,
            customer: processingResult.customerName,
            priority: processingResult.priority,
            category: processingResult.category,
            messageIndex: i
          });
          logger.info('Historical ticket created', {
            ticketId: processingResult.ticketId,
            customer: processingResult.customerName,
            messageIndex: i
          });
        }

        results.processedMessages++;

      } catch (messageError) {
        results.errors++;
        results.errorMessages.push({
          messageIndex: i,
          error: messageError.message
        });
        logger.error('Failed to process bulk message', {
          messageIndex: i,
          error: messageError.message
        });
      }
    }

    return results;
  }

  /**
   * Format historical message for processing
   * 
   * @param {Object} message - Historical message data
   * @param {string} groupId - Group ID
   * @param {string} groupName - Group name
   * @param {string} sourceType - Source type (historical/manual/etc)
   * @returns {Object} Formatted message data
   */
  formatHistoricalMessage(message, groupId, groupName, sourceType) {
    const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
    const messageId = message.id || `BULK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      messageId,
      groupId,
      groupName,
      senderName: message.senderName || message.pushName || 'Historical User',
      textContent: message.textContent || message.content || message.message || '',
      timestamp,
      fromWhatsApp: sourceType === 'whatsapp',
      instanceId: this.instanceId,
      sourceType,
      isHistorical: true
    };
  }

  /**
   * Check if a ticket already exists for similar content
   * Simple duplicate detection based on content similarity
   * 
   * @param {string} textContent - Message content
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} True if duplicate found
   */
  async checkDuplicateTicket(textContent, groupId) {
    try {
      // Simple approach: check if we've seen very similar content in the last 7 days
      const contentHash = this.generateContentHash(textContent);
      const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Check against processed messages cache
      const cacheKey = `${groupId}:${contentHash}`;
      if (this.processedMessages.has(cacheKey)) {
        return true;
      }

      // For now, use a simple approach - in production, you might want to:
      // 1. Store processed content hashes in database
      // 2. Use more sophisticated similarity detection
      // 3. Check against Google Sheets for existing tickets
      
      this.processedMessages.add(cacheKey);
      return false;

    } catch (error) {
      logger.warn('Failed to check duplicate ticket', {
        error: error.message,
        textLength: textContent?.length || 0
      });
      return false; // Don't skip on error
    }
  }

  /**
   * Generate a simple hash for content comparison
   * 
   * @param {string} content - Message content
   * @returns {string} Content hash
   */
  generateContentHash(content) {
    // Simple hash based on normalized content
    const normalized = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get webhook status and statistics
   * 
   * @returns {Object} Webhook status information
   */
  getCSWebhookStatus() {
    try {
      // Try to get orchestrator health status
      const csOrchestrator = require('../index');
      const orchestratorHealth = csOrchestrator.getHealthStatus();
      
      return {
        instanceId: this.instanceId,
        webhookPath: '/webhook/cs-tickets',
        groupMonitoring: true,
        processedMessagesCount: this.processedMessages.size,
        uptime: process.uptime(),
        ready: true,
        orchestratorIntegrated: true,
        orchestratorHealth: orchestratorHealth,
        modules: {
          ticketDetection: orchestratorHealth.services.ticketDetector ? 'active' : 'pending',
          sheetsIntegration: orchestratorHealth.services.sheetsService ? 'active' : 'pending',
          followUpScheduler: orchestratorHealth.services.followUpScheduler ? 'active' : 'pending',
          evolution: orchestratorHealth.services.evolution ? 'active' : 'pending'
        }
      };
    } catch (error) {
      // Fallback if orchestrator not available
      return {
        instanceId: this.instanceId,
        webhookPath: '/webhook/cs-tickets',
        groupMonitoring: true,
        processedMessagesCount: this.processedMessages.size,
        uptime: process.uptime(),
        ready: true,
        orchestratorIntegrated: false,
        orchestratorError: error.message,
        modules: {
          ticketDetection: 'pending',
          sheetsIntegration: 'pending',
          followUpScheduler: 'pending',
          evolution: 'pending'
        }
      };
    }
  }

  /**
   * Clear processed messages cache (for testing/maintenance)
   */
  clearProcessedMessages() {
    const clearedCount = this.processedMessages.size;
    this.processedMessages.clear();
    logger.info('Cleared processed messages cache', {
      clearedCount,
      instanceId: this.instanceId
    });
    return { clearedCount };
  }
}

// Export singleton instance
const csWebhookController = new CSWebhookController();

module.exports = {
  handleCSWebhook: csWebhookController.handleCSWebhook.bind(csWebhookController),
  handleBulkProcessing: csWebhookController.handleBulkProcessing.bind(csWebhookController),
  processBulkMessages: csWebhookController.processBulkMessages.bind(csWebhookController),
  processGroupMessage: csWebhookController.processGroupMessage.bind(csWebhookController),
  getCSWebhookStatus: csWebhookController.getCSWebhookStatus.bind(csWebhookController),
  clearProcessedMessages: csWebhookController.clearProcessedMessages.bind(csWebhookController)
};