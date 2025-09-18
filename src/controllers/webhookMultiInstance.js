const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
const MessageProcessor = require('../services/whatsapp/messageProcessor');
const paiAssistantWhatsApp = require('../services/ai/paiAssistantWhatsApp');
const paiMortgageWhatsApp = require('../services/ai/paiMortgageWhatsApp');
const logger = require('../utils/logger');

/**
 * Multi-Instance Webhook Controller
 * Routes webhook requests to appropriate instance handlers
 */

/**
 * Handle main instance webhooks (PAI Responder)
 */
const handleMainWebhook = async (req, res) => {
  try {
    logger.info('Main instance webhook received', {
      path: req.path,
      ip: req.ip,
      bodyKeys: Object.keys(req.body)
    });

    // Get main instance
    const mainInstance = evolutionMultiInstance.getInstance('main');
    const instanceConfig = evolutionMultiInstance.getInstanceConfig('main');

    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!mainInstance.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature for main instance', {
        signature,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook events
    await processWebhookEvent(req.body, mainInstance, 'main');

    return res.status(200).json({ success: true, instance: 'main' });
  } catch (error) {
    logger.error('Main webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle PAI Assistant instance webhooks
 */
const handlePaiAssistantWebhook = async (req, res) => {
  try {
    logger.info('PAI Assistant webhook received', {
      path: req.path,
      ip: req.ip,
      bodyKeys: Object.keys(req.body)
    });

    // Get PAI Assistant instance
    const paiInstance = evolutionMultiInstance.getInstance('pai-assistant');
    const instanceConfig = evolutionMultiInstance.getInstanceConfig('pai-assistant');

    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!paiInstance.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature for PAI Assistant instance', {
        signature,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook events specifically for PAI Assistant
    await processPaiAssistantWebhook(req.body, paiInstance, 'pai-assistant');

    return res.status(200).json({ success: true, instance: 'pai-assistant' });
  } catch (error) {
    logger.error('PAI Assistant webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle PAI Mortgage instance webhooks
 */
const handlePaiMortgageWebhook = async (req, res) => {
  try {
    logger.info('PAI Mortgage webhook received', {
      path: req.path,
      ip: req.ip,
      bodyKeys: Object.keys(req.body)
    });

    // Get PAI Mortgage instance
    const paiInstance = evolutionMultiInstance.getInstance('pai-mortgage');
    const instanceConfig = evolutionMultiInstance.getInstanceConfig('pai-mortgage');

    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
    const rawBody = JSON.stringify(req.body);

    if (!paiInstance.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature for PAI Mortgage instance', {
        signature,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook events specifically for PAI Mortgage
    await processPaiMortgageWebhook(req.body, paiInstance, 'pai-mortgage');

    return res.status(200).json({ success: true, instance: 'pai-mortgage' });
  } catch (error) {
    logger.error('PAI Mortgage webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Process general webhook events
 */
async function processWebhookEvent(webhookData, whatsappInstance, instanceAlias) {
  try {
    // Extract event type
    let { event } = webhookData;
    let { data } = webhookData;

    // If no event field, determine from the webhook data structure
    if (!event && webhookData.key) {
      event = 'messages.upsert';
      data = webhookData;
    }

    logger.debug('Processing webhook event', {
      event,
      instance: instanceAlias,
      dataKeys: data ? Object.keys(data) : []
    });

    switch (event) {
      case 'messages.upsert':
        await handleMessageUpsert(data, whatsappInstance, instanceAlias);
        break;
      case 'messages.update':
        await handleMessageUpdate(data, whatsappInstance, instanceAlias);
        break;
      case 'connection.update':
        await handleConnectionUpdate(data, whatsappInstance, instanceAlias);
        break;
      default:
        // Try to detect message from structure
        if (webhookData.key && webhookData.message) {
          await handleMessageUpsert(webhookData, whatsappInstance, instanceAlias);
        } else {
          logger.debug('Unhandled webhook event', { 
            event, 
            instance: instanceAlias,
            webhookData 
          });
        }
    }
  } catch (error) {
    logger.error('Error processing webhook event', {
      error: error.message,
      instance: instanceAlias,
      webhookData
    });
  }
}

/**
 * Process PAI Assistant specific webhook events
 */
async function processPaiAssistantWebhook(webhookData, whatsappInstance, instanceAlias) {
  try {
    // For PAI Assistant, we primarily care about incoming messages
    let data = webhookData;
    
    // Handle different webhook formats
    if (webhookData.data) {
      data = webhookData.data;
    }

    // Check if this is a message event
    if (data.key && data.message) {
      await handlePaiAssistantMessage(data, whatsappInstance, instanceAlias);
    } else if (data.connection) {
      await handleConnectionUpdate(data, whatsappInstance, instanceAlias);
    } else {
      logger.debug('Unhandled PAI Assistant webhook event', { 
        instance: instanceAlias,
        dataKeys: Object.keys(data)
      });
    }
  } catch (error) {
    logger.error('Error processing PAI Assistant webhook', {
      error: error.message,
      instance: instanceAlias,
      webhookData
    });
  }
}

/**
 * Process PAI Mortgage specific webhook events
 */
async function processPaiMortgageWebhook(webhookData, whatsappInstance, instanceAlias) {
  try {
    // For PAI Mortgage, we primarily care about incoming messages and connection updates
    let data = webhookData;
    
    // Handle different webhook formats
    if (webhookData.data) {
      data = webhookData.data;
    }

    // Add detailed logging to see actual webhook structure
    logger.info('PAI Mortgage webhook data details', {
      instance: instanceAlias,
      dataKeys: Object.keys(data),
      fullData: data,
      hasConnection: !!data.connection,
      hasInstance: !!data.instance,
      hasState: !!data.state,
      hasStatusReason: !!data.statusReason
    });

    // Check if this is a message event
    if (data.key && data.message) {
      await handlePaiMortgageMessage(data, whatsappInstance, instanceAlias);
    } 
    // Check if this is a connection update (could be at root level or in data.connection)
    else if (data.connection || data.instance || data.state) {
      await handleConnectionUpdate(data, whatsappInstance, instanceAlias);
    } 
    else {
      logger.warn('Unhandled PAI Mortgage webhook event', { 
        instance: instanceAlias,
        dataKeys: Object.keys(data),
        fullData: data
      });
    }
  } catch (error) {
    logger.error('Error processing PAI Mortgage webhook', {
      error: error.message,
      instance: instanceAlias,
      webhookData
    });
  }
}

/**
 * Handle message upsert for main instance (PAI Responder)
 */
async function handleMessageUpsert(data, whatsappInstance, instanceAlias) {
  try {
    // Convert to array format for consistent processing
    let messages = Array.isArray(data) ? data : [data];

    for (const messageData of messages) {
      const parsedMessage = whatsappInstance.parseWebhookMessage({ data: messageData });

      if (!parsedMessage) {
        logger.debug('Skipping invalid or self message', { 
          instance: instanceAlias,
          messageData 
        });
        continue;
      }

      logger.info('Processing message through main instance', {
        instance: instanceAlias,
        phone: parsedMessage.phone,
        messageType: parsedMessage.messageType,
        contentLength: parsedMessage.content.length,
        pushName: parsedMessage.pushName,
      });

      // Process through the main message processor (PAI Responder)
      const mainMessageProcessor = new MessageProcessor({ instanceAlias: 'main' });
      const result = await mainMessageProcessor.processMessage(parsedMessage);

      if (result.processed) {
        logger.info('Main instance message processing completed', {
          instance: instanceAlias,
          messageId: parsedMessage.messageId,
          conversationId: result.conversation?.id,
          responseSent: result.response?.sent
        });

        // Broadcast to real-time subscribers
        if (result.message && result.conversation?.id) {
          const realtimeService = require('../services/utils/realtime');
          realtimeService.broadcastNewMessage(result.conversation.id, result.message);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing main instance message upsert', {
      error: error.message,
      instance: instanceAlias,
      data
    });
  }
}

/**
 * Handle message for PAI Assistant instance
 */
async function handlePaiAssistantMessage(messageData, whatsappInstance, instanceAlias) {
  try {
    const parsedMessage = whatsappInstance.parseWebhookMessage({ data: messageData });

    if (!parsedMessage) {
      logger.debug('Skipping invalid or self message for PAI Assistant', { 
        instance: instanceAlias,
        messageData 
      });
      return;
    }

    logger.info('Processing message through PAI Assistant', {
      instance: instanceAlias,
      phone: parsedMessage.phone,
      messageType: parsedMessage.messageType,
      contentLength: parsedMessage.content.length,
      pushName: parsedMessage.pushName,
    });

    // Process through PAI Assistant WhatsApp service
    const result = await paiAssistantWhatsApp.processMessageWithCommands(parsedMessage);

    if (result.success && result.response) {
      // Send response back via PAI Assistant instance
      await evolutionMultiInstance.sendMessage('pai-assistant', parsedMessage.phone, result.response);

      logger.info('PAI Assistant response sent successfully', {
        instance: instanceAlias,
        phone: parsedMessage.phone,
        messageType: result.messageType,
        responseLength: result.response.length,
        tokensUsed: result.tokensUsed
      });
    } else {
      logger.warn('PAI Assistant failed to process message', {
        instance: instanceAlias,
        phone: parsedMessage.phone,
        error: result.error || 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Error processing PAI Assistant message', {
      error: error.message,
      instance: instanceAlias,
      messageData
    });

    // Send error response to user
    try {
      await evolutionMultiInstance.sendMessage('pai-assistant', 
        parsedMessage?.phone, 
        "I'm sorry, I encountered an error processing your request. Please try again later.\n\n_PAI Assistant_"
      );
    } catch (sendError) {
      logger.error('Failed to send error response', {
        error: sendError.message
      });
    }
  }
}

/**
 * Handle message for PAI Mortgage instance
 */
async function handlePaiMortgageMessage(messageData, whatsappInstance, instanceAlias) {
  try {
    const parsedMessage = whatsappInstance.parseWebhookMessage({ data: messageData });

    if (!parsedMessage) {
      logger.debug('Skipping invalid or self message for PAI Mortgage', { 
        instance: instanceAlias,
        messageData 
      });
      return;
    }

    logger.info('Processing message through PAI Mortgage', {
      instance: instanceAlias,
      phone: parsedMessage.phone,
      messageType: parsedMessage.messageType,
      contentLength: parsedMessage.content.length,
      pushName: parsedMessage.pushName,
    });

    // Process through PAI Mortgage WhatsApp service
    const result = await paiMortgageWhatsApp.processMessageWithCommands(parsedMessage);

    if (result.success && result.response) {
      // Send response back via PAI Mortgage instance
      await evolutionMultiInstance.sendMessage('pai-mortgage', parsedMessage.phone, result.response);

      logger.info('PAI Mortgage response sent successfully', {
        instance: instanceAlias,
        phone: parsedMessage.phone,
        intent: result.intent,
        responseLength: result.response.length,
        tokensUsed: result.tokensUsed
      });
    } else {
      logger.warn('PAI Mortgage failed to process message', {
        instance: instanceAlias,
        phone: parsedMessage.phone,
        error: result.error || 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Error processing PAI Mortgage message', {
      error: error.message,
      instance: instanceAlias,
      messageData
    });

    // Send error response to user
    try {
      await evolutionMultiInstance.sendMessage('pai-mortgage', 
        parsedMessage?.phone, 
        "I'm sorry, I encountered an error processing your mortgage inquiry. Please try again later.\n\n_PAI Mortgage Assistant_"
      );
    } catch (sendError) {
      logger.error('Failed to send error response', {
        error: sendError.message
      });
    }
  }
}

/**
 * Handle message updates
 */
async function handleMessageUpdate(data, whatsappInstance, instanceAlias) {
  try {
    logger.debug('Message update received', { 
      instance: instanceAlias,
      data 
    });
    // TODO: Update message status in database if needed
  } catch (error) {
    logger.error('Error processing message update', {
      error: error.message,
      instance: instanceAlias,
      data
    });
  }
}

/**
 * Handle connection updates
 */
async function handleConnectionUpdate(data, whatsappInstance, instanceAlias) {
  try {
    logger.info('Connection update received', {
      instance: instanceAlias,
      connection: data.connection,
      state: data.state,
      statusReason: data.statusReason,
      lastDisconnect: data.lastDisconnect,
      fullData: data
    });

    // Enhanced logging for statusReason 428 (precondition_required)
    if (data.statusReason === 428) {
      logger.warn('StatusReason 428 detected - precondition_required', {
        instance: instanceAlias,
        state: data.state,
        statusReason: data.statusReason,
        troubleshooting: {
          description: 'This usually means WhatsApp requires device verification',
          commonCauses: ['QR code not scanned', 'Device authentication failed', 'WhatsApp session expired'],
          nextSteps: ['Ensure QR code is fresh', 'Try scanning with different device', 'Check WhatsApp app version']
        }
      });
    }

    // Handle connection instability for multi-instance setups
    if (data.state === 'close' && data.statusReason && instanceAlias !== 'main') {
      const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
      
      try {
        const handled = await evolutionMultiInstance.handleConnectionInstability(instanceAlias, data.statusReason);
        
        if (handled) {
          logger.info('Connection instability handled with logout', {
            instance: instanceAlias,
            statusReason: data.statusReason
          });
        }
      } catch (stabilityError) {
        logger.error('Failed to handle connection instability', {
          instance: instanceAlias,
          error: stabilityError.message
        });
      }
    }

    // Reset connection failure tracking on successful open state
    if (data.state === 'open' && instanceAlias !== 'main') {
      const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
      evolutionMultiInstance.resetConnectionFailures(instanceAlias);
      
      logger.info('🎉 WhatsApp device successfully connected!', {
        instance: instanceAlias,
        state: data.state,
        statusReason: data.statusReason,
        message: 'Instance is now ready to receive and send messages'
      });
    }

    // TODO: Update instance connection status in database
    // This can be used to show connection status in admin panel
  } catch (error) {
    logger.error('Error processing connection update', {
      error: error.message,
      instance: instanceAlias,
      data
    });
  }
}

/**
 * Generic webhook handler that routes to correct instance
 */
const handleGenericWebhook = async (req, res) => {
  try {
    const webhookPath = req.path;
    
    logger.debug('Generic webhook received', {
      path: webhookPath,
      ip: req.ip
    });

    // Route based on path
    if (webhookPath.includes('pai-assistant')) {
      return await handlePaiAssistantWebhook(req, res);
    } else if (webhookPath.includes('pai-mortgage')) {
      return await handlePaiMortgageWebhook(req, res);
    } else {
      return await handleMainWebhook(req, res);
    }
  } catch (error) {
    logger.error('Generic webhook routing error', {
      error: error.message,
      path: req.path
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get multi-instance webhook status
 */
const getMultiInstanceStatus = async (req, res) => {
  try {
    const stats = await evolutionMultiInstance.getServiceStats();
    
    return res.json({
      success: true,
      multiInstance: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting multi-instance status', {
      error: error.message,
    });
    return res.status(500).json({
      error: 'Failed to get multi-instance status',
      message: error.message,
    });
  }
};

module.exports = {
  handleMainWebhook,
  handlePaiAssistantWebhook,
  handlePaiMortgageWebhook,
  handleGenericWebhook,
  getMultiInstanceStatus,
  // Export for testing
  processWebhookEvent,
  processPaiAssistantWebhook,
  processPaiMortgageWebhook,
  handleMessageUpsert,
  handlePaiAssistantMessage,
  handlePaiMortgageMessage,
};