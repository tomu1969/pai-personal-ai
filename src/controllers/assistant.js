const express = require('express');
const assistantService = require('../services/assistant');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Get assistant configuration
 * GET /api/assistant/config
 */
router.get('/config', async (req, res) => {
  try {
    const status = await assistantService.getStatus();

    res.json({
      id: status.id,
      enabled: status.enabled,
      ownerName: status.ownerName,
      assistantName: status.assistantName || 'AI Assistant',
      systemPrompt: status.systemPrompt || 'You are a helpful AI assistant acting as a personal assistant for the owner. You help filter and respond to messages professionally and courteously. Always be polite, concise, and helpful.',
      autoResponseTemplate: status.autoResponseTemplate,
      messageTypePreferences: status.messageTypePreferences || {
        allMessages: true,
        individualMessages: true,
        groupMessages: true,
        reactions: true,
        distributionLists: true,
      },
      settings: status.settings,
    });
  } catch (error) {
    logger.error('Failed to get assistant configuration', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to get assistant configuration',
      message: error.message,
    });
  }
});

/**
 * Update assistant configuration
 * PUT /api/assistant/config
 */
router.put('/config', async (req, res) => {
  try {
    const {
      assistantName, autoResponseTemplate, systemPrompt, ownerName, messageTypePreferences, settings,
    } = req.body;

    // Validate required fields
    if (!assistantName && !autoResponseTemplate && !systemPrompt && !ownerName && !messageTypePreferences && !settings) {
      return res.status(400).json({
        error: 'At least one field must be provided for update',
      });
    }

    const updatedAssistant = await assistantService.updateConfig({
      assistantName,
      autoResponseTemplate,
      systemPrompt,
      ownerName,
      messageTypePreferences,
      settings,
    });

    logger.info('Assistant configuration updated via API', {
      assistantId: updatedAssistant.id,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      id: updatedAssistant.id,
      enabled: updatedAssistant.enabled,
      ownerName: updatedAssistant.ownerName,
      assistantName: updatedAssistant.assistantName,
      systemPrompt: updatedAssistant.systemPrompt,
      autoResponseTemplate: updatedAssistant.autoResponseTemplate,
      messageTypePreferences: updatedAssistant.messageTypePreferences,
      settings: updatedAssistant.settings,
      updatedAt: updatedAssistant.updatedAt,
    });
  } catch (error) {
    logger.error('Failed to update assistant configuration', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
    });

    res.status(500).json({
      error: 'Failed to update assistant configuration',
      message: error.message,
    });
  }
});

/**
 * Get assistant status
 * GET /api/assistant/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await assistantService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get assistant status', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to get assistant status',
      message: error.message,
    });
  }
});

/**
 * Toggle assistant on/off
 * POST /api/assistant/toggle
 */
router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled field must be a boolean',
      });
    }

    const result = await assistantService.toggle(enabled);

    logger.info('Assistant toggled via API', {
      enabled,
      result,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to toggle assistant', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
    });

    res.status(500).json({
      error: 'Failed to toggle assistant',
      message: error.message,
    });
  }
});

/**
 * Get assistant metrics
 * GET /api/assistant/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const metrics = await assistantService.getMetrics(timeRange);

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get assistant metrics', {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });

    res.status(500).json({
      error: 'Failed to get assistant metrics',
      message: error.message,
    });
  }
});

/**
 * Reset assistant statistics
 * POST /api/assistant/reset-stats
 */
router.post('/reset-stats', async (req, res) => {
  try {
    const result = await assistantService.resetStatistics();

    logger.info('Assistant statistics reset via API', {
      assistantId: result.id,
    });

    res.json({
      message: 'Assistant statistics reset successfully',
      assistant: {
        id: result.id,
        messagesProcessed: result.messagesProcessed,
        lastActivity: result.lastActivity,
      },
    });
  } catch (error) {
    logger.error('Failed to reset assistant statistics', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to reset assistant statistics',
      message: error.message,
    });
  }
});

module.exports = router;
