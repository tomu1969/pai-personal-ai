const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
const paiMortgageWhatsApp = require('../services/ai/paiMortgageWhatsApp');
const logger = require('../utils/logger');

/**
 * PAI Mortgage Controller
 * Handles API endpoints for PAI Mortgage management
 */

/**
 * Get PAI Mortgage QR Code
 */
const getPaiMortgageQR = async (req, res) => {
  try {
    logger.info('PAI Mortgage QR code requested');
    
    // Initialize multi-instance service if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const qrResult = await evolutionMultiInstance.getQRCode('pai-mortgage');
    
    return res.json({
      success: true,
      instanceId: qrResult.instanceId,
      alias: qrResult.alias,
      qrCode: qrResult.qrCode,
      connectUrl: qrResult.connectUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Mortgage QR code', {
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
 * Get PAI Mortgage connection status
 */
const getPaiMortgageStatus = async (req, res) => {
  try {
    logger.info('PAI Mortgage status requested');
    
    // Initialize multi-instance service if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const statusResult = await evolutionMultiInstance.getConnectionStatus('pai-mortgage');
    
    return res.json({
      success: true,
      instanceId: statusResult.instanceId,
      alias: statusResult.alias,
      status: statusResult.status,
      connected: statusResult.connected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Mortgage status', {
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
 * Get PAI Mortgage service statistics
 */
const getPaiMortgageStats = async (req, res) => {
  try {
    logger.info('PAI Mortgage service stats requested');
    
    // Initialize services if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }
    
    await paiMortgageWhatsApp.initialize();
    
    const multiInstanceStats = await evolutionMultiInstance.getServiceStats();
    const conversationStats = paiMortgageWhatsApp.getConversationStats();
    
    return res.json({
      success: true,
      multiInstance: multiInstanceStats,
      conversations: conversationStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get PAI Mortgage stats', {
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
 * Test PAI Mortgage message processing
 */
const testPaiMortgage = async (req, res) => {
  try {
    const { message = 'I want to buy a $400,000 house with 20% down', phone = '+1234567890', pushName = 'Test User' } = req.body;
    
    logger.info('Testing PAI Mortgage with message', {
      message: message.substring(0, 50),
      phone,
      pushName
    });
    
    await paiMortgageWhatsApp.initialize();
    
    const mockMessage = {
      phone,
      content: message,
      pushName,
      messageId: `test_${Date.now()}`,
      messageType: 'conversation'
    };
    
    const result = await paiMortgageWhatsApp.processMessageWithCommands(mockMessage);
    
    return res.json({
      success: true,
      testMessage: mockMessage,
      result: {
        success: result.success,
        response: result.response,
        intent: result.intent,
        entities: result.entities,
        tokensUsed: result.tokensUsed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('PAI Mortgage test failed', {
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
 * Send test message via PAI Mortgage instance
 */
const sendTestMessage = async (req, res) => {
  try {
    const { phone, message = '🏠 Test message from PAI Mortgage! Ready to help with your home loan needs.' } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Sending test message via PAI Mortgage', {
      phone,
      messageLength: message.length
    });
    
    await evolutionMultiInstance.initialize();
    
    const sendResult = await evolutionMultiInstance.sendMessage('pai-mortgage', phone, message);
    
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
    
    logger.info('Clearing PAI Mortgage conversation', {
      phone,
      pushName: pushName || 'unknown'
    });
    
    await paiMortgageWhatsApp.initialize();
    
    const cleared = paiMortgageWhatsApp.clearUserConversation(phone, pushName);
    
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

/**
 * Get qualification report for a user
 */
const getQualificationReport = async (req, res) => {
  try {
    const { phone, pushName } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('Getting qualification report', {
      phone,
      pushName: pushName || 'unknown'
    });
    
    await paiMortgageWhatsApp.initialize();
    
    const userKey = paiMortgageWhatsApp.getUserKey(phone, pushName);
    const stats = paiMortgageWhatsApp.getConversationStats();
    const userConversation = stats.conversations.find(conv => conv.userKey === userKey);
    
    if (!userConversation) {
      return res.json({
        success: true,
        hasConversation: false,
        message: 'No conversation found for this user',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.json({
      success: true,
      hasConversation: true,
      qualificationData: userConversation.qualificationData,
      completeness: userConversation.completeness,
      messageCount: userConversation.messageCount,
      lastActivity: userConversation.lastActivity,
      preferredLoanType: userConversation.preferredLoanType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get qualification report', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get qualification report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get current mortgage rates (mock data for demo)
 */
const getCurrentRates = async (req, res) => {
  try {
    logger.info('Current mortgage rates requested');
    
    // Mock rate data - in production this would come from a rates API
    const mockRates = {
      conventional: {
        '30-year-fixed': { rate: 7.25, apr: 7.35, points: 0.5 },
        '15-year-fixed': { rate: 6.85, apr: 6.95, points: 0.5 },
        '5-1-arm': { rate: 6.95, apr: 7.25, points: 0.25 }
      },
      fha: {
        '30-year-fixed': { rate: 7.15, apr: 7.45, points: 0.25 },
        '15-year-fixed': { rate: 6.75, apr: 7.05, points: 0.25 }
      },
      va: {
        '30-year-fixed': { rate: 7.05, apr: 7.15, points: 0 },
        '15-year-fixed': { rate: 6.65, apr: 6.75, points: 0 }
      },
      jumbo: {
        '30-year-fixed': { rate: 7.45, apr: 7.55, points: 0.75 },
        '15-year-fixed': { rate: 7.05, apr: 7.15, points: 0.75 }
      }
    };
    
    return res.json({
      success: true,
      rates: mockRates,
      lastUpdated: new Date().toISOString(),
      disclaimer: 'Rates are for demonstration purposes and may not reflect current market rates',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get current rates', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get rates',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getPaiMortgageQR,
  getPaiMortgageStatus,
  getPaiMortgageStats,
  testPaiMortgage,
  sendTestMessage,
  clearUserConversation,
  getQualificationReport,
  getCurrentRates
};