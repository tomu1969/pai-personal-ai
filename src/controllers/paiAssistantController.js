const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
const paiAssistantWhatsApp = require('../services/ai/paiAssistantWhatsApp');
const logger = require('../utils/logger');

/**
 * PAI Assistant Controller
 * Handles API endpoints for PAI Assistant management
 */

/**
 * Get PAI Assistant QR Code
 */
const getPaiAssistantQR = async (req, res) => {
  try {
    logger.info('PAI Assistant QR code requested');
    
    // Initialize multi-instance service if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const qrResult = await evolutionMultiInstance.getQRCode('pai-assistant');
    
    return res.json({
      success: true,
      instanceId: qrResult.instanceId,
      alias: qrResult.alias,
      qrCode: qrResult.qrCode,
      connectUrl: qrResult.connectUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Assistant QR code', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get QR code',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get PAI Assistant connection status
 */
const getPaiAssistantStatus = async (req, res) => {
  try {
    logger.info('PAI Assistant status requested');
    
    // Initialize multi-instance service if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const statusResult = await evolutionMultiInstance.getConnectionStatus('pai-assistant');
    
    return res.json({
      success: true,
      instanceId: statusResult.instanceId,
      alias: statusResult.alias,
      status: statusResult.status,
      connected: statusResult.connected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Assistant status', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get PAI Assistant service statistics
 */
const getPaiAssistantStats = async (req, res) => {
  try {
    logger.info('PAI Assistant service stats requested');
    
    // Initialize services if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }
    
    await paiAssistantWhatsApp.initialize();
    
    const multiInstanceStats = await evolutionMultiInstance.getServiceStats();
    const conversationStats = paiAssistantWhatsApp.getConversationStats();
    
    return res.json({
      success: true,
      multiInstance: multiInstanceStats,
      conversations: conversationStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Assistant stats', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test PAI Assistant message processing
 */
const testPaiAssistant = async (req, res) => {
  try {
    const { message = 'help', phone = '+1234567890', pushName = 'Test User' } = req.body;
    
    logger.info('Testing PAI Assistant with message', {
      message: message.substring(0, 50),
      phone,
      pushName
    });
    
    await paiAssistantWhatsApp.initialize();
    
    const mockMessage = {
      phone,
      content: message,
      pushName,
      messageId: `test_${Date.now()}`,
      messageType: 'conversation'
    };
    
    const result = await paiAssistantWhatsApp.processMessageWithCommands(mockMessage);
    
    return res.json({
      success: true,
      testMessage: mockMessage,
      result: {
        success: result.success,
        response: result.response,
        messageType: result.messageType,
        tokensUsed: result.tokensUsed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('PAI Assistant test failed', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Send test message via PAI Assistant instance
 */
const sendTestMessage = async (req, res) => {
  try {
    const { phone, message = '🤖 Test message from PAI Assistant! The system is working correctly.' } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Sending test message via PAI Assistant', {
      phone,
      messageLength: message.length
    });
    
    await evolutionMultiInstance.initialize();
    
    const sendResult = await evolutionMultiInstance.sendMessage('pai-assistant', phone, message);
    
    return res.json({
      success: true,
      phone,
      message,
      sendResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to send test message', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Clear conversation history for a user
 */
const clearUserConversation = async (req, res) => {
  try {
    const { phone, pushName } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Clearing PAI Assistant conversation', {
      phone,
      pushName: pushName || 'unknown'
    });
    
    await paiAssistantWhatsApp.initialize();
    
    const cleared = paiAssistantWhatsApp.clearUserConversation(phone, pushName);
    
    return res.json({
      success: true,
      cleared,
      phone,
      pushName: pushName || 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to clear conversation', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to clear conversation',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getPaiAssistantQR,
  getPaiAssistantStatus,
  getPaiAssistantStats,
  testPaiAssistant,
  sendTestMessage,
  clearUserConversation
};