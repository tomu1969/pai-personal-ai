// const { validate } = require('../middleware/validation');
const WhatsAppService = require('../services/whatsapp/whatsapp');
const logger = require('../utils/logger');

const whatsappService = new WhatsAppService();

/**
 * Handle incoming webhooks from Evolution API
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
    const rawBody = JSON.stringify(req.body);

    // Validate webhook signature if configured
    if (!whatsappService.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature', {
        signature,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Evolution API v2 sends to specific endpoints, not with event field
    let { event } = req.body;
    let { data } = req.body;

    // If no event field, determine from URL path
    if (!event && req.path) {
      const pathParts = req.path.split('/');
      const endpoint = pathParts[pathParts.length - 1];

      // Map endpoint to event name
      const eventMap = {
        'messages-upsert': 'messages.upsert',
        'messages-update': 'messages.update',
        'messages-delete': 'messages.delete',
        'chats-update': 'chats.update',
        'contacts-update': 'contacts.update',
        'presence-update': 'presence.update',
        'connection-update': 'connection.update',
        'send-message': 'send.message',
      };

      event = eventMap[endpoint] || endpoint;
      data = req.body; // In v2, the entire body is the data
    }

    logger.info('Webhook received', {
      event,
      path: req.path,
      dataKeys: data ? Object.keys(data) : [],
      bodyKeys: Object.keys(req.body),
      ip: req.ip,
    });

    // Log full body for debugging Evolution v2
    logger.debug('Webhook body', {
      path: req.path,
      body: JSON.stringify(req.body).substring(0, 500),
    });

    // Check if this is a PAI Assistant instance message that should be routed specially
    if (req.body.instance === 'pai-assistant') {
      logger.info('Routing PAI Assistant message to multi-instance handler', {
        event,
        instance: req.body.instance
      });
      
      // Import and route to PAI Assistant handler
      const webhookMultiInstance = require('./webhookMultiInstance');
      return await webhookMultiInstance.handlePaiAssistantWebhook(req, res);
    }

    // Handle different types of webhook events
    switch (event) {
      case 'messages.upsert':
        // eslint-disable-next-line no-use-before-define
        await handleMessageUpsert(data);
        break;
      case 'messages.update':
        // eslint-disable-next-line no-use-before-define
        await handleMessageUpdate(data);
        break;
      case 'connection.update':
        // eslint-disable-next-line no-use-before-define
        await handleConnectionUpdate(data);
        break;
      default:
        logger.debug('Unhandled webhook event', { event, data });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle new or updated messages
 * @param {object} data - Message data from webhook
 */
const handleMessageUpsert = async (data) => {
  try {
    // Evolution API v2 sends data as object, not array
    // Convert to array format for consistent processing
    let messages = data;
    if (!Array.isArray(data)) {
      if (!data || typeof data !== 'object') {
        logger.warn('Invalid message upsert data', { data });
        return;
      }
      messages = [data]; // Wrap single message in array
    }

    // Process messages sequentially to avoid overwhelming the system
    await messages.reduce(async (prevPromise, messageData) => {
      await prevPromise;

      const parsedMessage = whatsappService.parseWebhookMessage({ data: messageData });

      if (!parsedMessage) {
        logger.debug('Skipping invalid or self message', { messageData });
        return;
      }

      logger.info('Processing incoming message', {
        phone: parsedMessage.phone,
        messageType: parsedMessage.messageType,
        contentLength: parsedMessage.content.length,
        pushName: parsedMessage.pushName,
      });

      // TODO: Process the message through the assistant system
      // This will be implemented in the next phase
      // eslint-disable-next-line no-use-before-define
      await processIncomingMessage(parsedMessage);
    }, Promise.resolve());
  } catch (error) {
    logger.error('Error processing message upsert', {
      error: error.message,
      data,
    });
  }
};

/**
 * Handle message status updates (delivered, read, etc.)
 * @param {object} data - Message update data
 */
const handleMessageUpdate = async (data) => {
  try {
    logger.debug('Message update received', { data });
    // TODO: Update message status in database
  } catch (error) {
    logger.error('Error processing message update', {
      error: error.message,
      data,
    });
  }
};

/**
 * Handle connection status updates
 * @param {object} data - Connection data
 */
const handleConnectionUpdate = async (data) => {
  try {
    logger.info('Connection update received', {
      connection: data.connection,
      lastDisconnect: data.lastDisconnect,
    });

    // TODO: Update instance connection status in database
    // This can be used to show connection status in admin panel
  } catch (error) {
    logger.error('Error processing connection update', {
      error: error.message,
      data,
    });
  }
};

/**
 * Process incoming message through the assistant system
 * @param {object} message - Parsed message object
 */
const processIncomingMessage = async (message) => {
  try {
    // eslint-disable-next-line global-require
    const messageProcessor = require('../services/whatsapp/messageProcessor');

    logger.info('Processing message through assistant system', {
      messageId: message.messageId,
      phone: message.phone,
      messageType: message.messageType,
      contentPreview: message.content.substring(0, 50),
    });

    // Process message through the complete pipeline
    const result = await messageProcessor.processMessage(message);

    if (result.processed) {
      logger.info('Message processing completed successfully', {
        messageId: message.messageId,
        conversationId: result.conversation?.id,
        responseSent: result.response?.sent,
        priority: result.message?.analysis?.priority,
        category: result.message?.analysis?.category,
      });

      // Broadcast new message to real-time subscribers
      if (result.message && result.conversation?.id) {
        const realtimeService = require('../services/utils/realtime');
        realtimeService.broadcastNewMessage(result.conversation.id, result.message);
      }
    } else {
      logger.debug('Message processing skipped', {
        messageId: message.messageId,
        reason: result.reason,
      });
    }

    return result;
  } catch (error) {
    logger.error('Error processing message through assistant', {
      error: error.message,
      stack: error.stack,
      messageId: message.messageId,
      phone: message.phone,
    });

    return {
      processed: false,
      reason: 'processing_error',
      error: error.message,
    };
  }
};

/**
 * Get webhook configuration status
 */
const getWebhookStatus = async (req, res) => {
  try {
    const webhookConfig = await whatsappService.getWebhook();
    const instanceStatus = await whatsappService.getInstanceStatus();

    return res.json({
      webhook: webhookConfig,
      instance: instanceStatus,
      configured: !!webhookConfig.webhook?.url,
      connected: instanceStatus.state === 'open',
    });
  } catch (error) {
    logger.error('Error getting webhook status', {
      error: error.message,
    });
    return res.status(500).json({
      error: 'Failed to get webhook status',
      message: error.message,
    });
  }
};

/**
 * Set up webhook configuration
 */
const setupWebhook = async (req, res) => {
  try {
    const { webhookUrl, events } = req.body;

    const result = await whatsappService.setWebhook(webhookUrl, events);

    logger.info('Webhook setup completed', {
      webhookUrl,
      events: events || ['messages.upsert'],
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error('Error setting up webhook', {
      error: error.message,
      body: req.body,
    });
    return res.status(500).json({
      error: 'Failed to setup webhook',
      message: error.message,
    });
  }
};

/**
 * Test webhook endpoint - useful for debugging
 */
const testWebhook = async (req, res) => {
  try {
    logger.info('Webhook test endpoint called', {
      body: req.body,
      headers: req.headers,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: 'Webhook test successful',
      timestamp: new Date().toISOString(),
      body: req.body,
    });
  } catch (error) {
    logger.error('Webhook test error', {
      error: error.message,
    });
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  handleWebhook,
  getWebhookStatus,
  setupWebhook,
  testWebhook,
  // Export for testing
  handleMessageUpsert,
  handleMessageUpdate,
  handleConnectionUpdate,
  processIncomingMessage,
};
