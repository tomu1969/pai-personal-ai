/**
 * @file systemController.js
 * @description System management controller for PAI application
 * @module controllers/systemController
 * @requires ../services/startup/systemInitializer
 * @requires ../utils/logger
 * @author PAI System
 * @since September 2025
 */

const logger = require('../utils/logger');

/**
 * Get comprehensive system status
 */
const getSystemStatus = async (req, res) => {
  try {
    if (!req.app.locals.systemInitializer) {
      return res.status(503).json({
        error: 'System initializer not available',
        message: 'System may not be fully initialized'
      });
    }

    const systemHealth = await req.app.locals.systemInitializer.healthCheck();
    
    res.json({
      status: 'success',
      data: systemHealth
    });
    
  } catch (error) {
    logger.error('Failed to get system status', { error: error.message });
    res.status(500).json({
      error: 'Failed to get system status',
      message: error.message
    });
  }
};

/**
 * Reinitialize specific instance
 */
const reinitializeInstance = async (req, res) => {
  try {
    const { alias } = req.params;
    
    if (!req.app.locals.systemInitializer) {
      return res.status(503).json({
        error: 'System initializer not available'
      });
    }

    if (!['main', 'pai-assistant', 'pai-mortgage'].includes(alias)) {
      return res.status(400).json({
        error: 'Invalid instance alias',
        message: 'Must be one of: main, pai-assistant, pai-mortgage'
      });
    }

    logger.info(`Manual reinitializing instance: ${alias}`);
    
    await req.app.locals.systemInitializer.reinitializeInstance(alias);
    
    res.json({
      status: 'success',
      message: `Instance ${alias} reinitialized successfully`
    });
    
  } catch (error) {
    logger.error('Failed to reinitialize instance', { 
      alias: req.params.alias,
      error: error.message 
    });
    
    res.status(500).json({
      error: 'Failed to reinitialize instance',
      message: error.message
    });
  }
};

/**
 * Reinitialize entire system
 */
const reinitializeSystem = async (req, res) => {
  try {
    if (!req.app.locals.systemInitializer) {
      return res.status(503).json({
        error: 'System initializer not available'
      });
    }

    logger.info('Manual system reinitialization requested');
    
    // Reset the initializer
    req.app.locals.systemInitializer.initialized = false;
    req.app.locals.systemInitializer.retryCount = 0;
    
    // Reinitialize
    await req.app.locals.systemInitializer.initialize();
    
    res.json({
      status: 'success',
      message: 'System reinitialized successfully'
    });
    
  } catch (error) {
    logger.error('Failed to reinitialize system', { error: error.message });
    
    res.status(500).json({
      error: 'Failed to reinitialize system',
      message: error.message
    });
  }
};

/**
 * Get PAI Mortgage specific status and diagnostics
 */
const getPaiMortgageStatus = async (req, res) => {
  try {
    if (!req.app.locals.systemInitializer) {
      return res.status(503).json({
        error: 'System initializer not available'
      });
    }

    const evolutionService = req.app.locals.systemInitializer.evolutionService;
    
    // Get comprehensive PAI Mortgage status
    const status = await evolutionService.getConnectionStatus('pai-mortgage');
    const instance = evolutionService.getInstance('pai-mortgage');
    const config = evolutionService.getInstanceConfig('pai-mortgage');
    
    // Check webhook configuration
    let webhookStatus = null;
    try {
      const webhookResponse = await instance.client.get(`/webhook/find/${config.instanceId}`);
      webhookStatus = webhookResponse.data;
    } catch (error) {
      webhookStatus = { error: error.message };
    }
    
    res.json({
      status: 'success',
      data: {
        instance: {
          alias: 'pai-mortgage',
          instanceId: config.instanceId,
          state: status.status?.state,
          connected: status.connected
        },
        webhook: webhookStatus,
        config: {
          webhookUrl: config.webhookUrl,
          apiUrl: config.apiUrl
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Failed to get PAI Mortgage status', { error: error.message });
    
    res.status(500).json({
      error: 'Failed to get PAI Mortgage status',
      message: error.message
    });
  }
};

module.exports = {
  getSystemStatus,
  reinitializeInstance,
  reinitializeSystem,
  getPaiMortgageStatus
};