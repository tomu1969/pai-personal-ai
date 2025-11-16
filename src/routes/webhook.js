const express = require('express');
const { validate } = require('../middleware/validation');
const { webhookSetupSchema } = require('../utils/schemas');
const webhookController = require('../controllers/webhook');
const webhookMultiInstance = require('../controllers/webhookMultiInstance');
const csWebhook = require('../../ai-cs/controllers/cs-webhook');

const router = express.Router();

// Multi-instance webhook endpoints
router.post('/main', webhookMultiInstance.handleMainWebhook);
router.post('/pai-assistant', webhookMultiInstance.handlePaiAssistantWebhook);
router.post('/pai-mortgage', webhookMultiInstance.handlePaiMortgageWebhook);
router.post('/cs-tickets', csWebhook.handleCSWebhook);
router.post('/cs-tickets/bulk', csWebhook.handleBulkProcessing);

// GET endpoints for webhook health checks (Evolution API tests these)
router.get('/main', (req, res) => res.json({ status: 'ok', webhook: 'main' }));
router.get('/pai-assistant', (req, res) => res.json({ status: 'ok', webhook: 'pai-assistant' }));
router.get('/pai-mortgage', (req, res) => res.json({ status: 'ok', webhook: 'pai-mortgage' }));
router.get('/cs-tickets', (req, res) => res.json({ status: 'ok', webhook: 'cs-tickets', groupMonitoring: true }));

// PAI Assistant specific event endpoints (webhookByEvents: true)
router.post('/pai-assistant/messages-upsert', webhookMultiInstance.handlePaiAssistantWebhook);
router.post('/pai-assistant/connection-update', webhookMultiInstance.handlePaiAssistantWebhook);

// PAI Mortgage specific event endpoints (webhookByEvents: true)
router.post('/pai-mortgage/messages-upsert', webhookMultiInstance.handlePaiMortgageWebhook);
router.post('/pai-mortgage/connection-update', webhookMultiInstance.handlePaiMortgageWebhook);

// CS Ticket Monitor specific event endpoints (webhookByEvents: true)
router.post('/cs-tickets/messages-upsert', csWebhook.handleCSWebhook);
router.post('/cs-tickets/connection-update', csWebhook.handleCSWebhook);

// Main webhook endpoint for Evolution API (backward compatibility)
router.post('/', webhookController.handleWebhook);

// Evolution API v2 specific webhook endpoints (main instance only)
router.post('/messages-upsert', (req, res, next) => {
  // Check if this is from a specific instance
  const instance = req.body?.instance;
  if (instance === 'pai-assistant') {
    return webhookMultiInstance.handlePaiAssistantWebhook(req, res);
  } else if (instance === 'pai-mortgage-fresh') {
    return webhookMultiInstance.handlePaiMortgageWebhook(req, res);
  }
  // Default to main handler
  return webhookController.handleWebhook(req, res);
});
router.post('/messages-update', (req, res, next) => {
  const instance = req.body?.instance;
  if (instance === 'pai-assistant') {
    return webhookMultiInstance.handlePaiAssistantWebhook(req, res);
  } else if (instance === 'pai-mortgage-fresh') {
    return webhookMultiInstance.handlePaiMortgageWebhook(req, res);
  }
  return webhookController.handleWebhook(req, res);
});
router.post('/messages-delete', webhookController.handleWebhook);
router.post('/chats-update', (req, res, next) => {
  const instance = req.body?.instance;
  if (instance === 'pai-assistant') {
    return webhookMultiInstance.handlePaiAssistantWebhook(req, res);
  } else if (instance === 'pai-mortgage-fresh') {
    return webhookMultiInstance.handlePaiMortgageWebhook(req, res);
  }
  return webhookController.handleWebhook(req, res);
});
router.post('/contacts-update', webhookController.handleWebhook);
router.post('/presence-update', webhookController.handleWebhook);
router.post('/connection-update', (req, res, next) => {
  const instance = req.body?.instance;
  if (instance === 'pai-assistant') {
    return webhookMultiInstance.handlePaiAssistantWebhook(req, res);
  } else if (instance === 'pai-mortgage-fresh') {
    return webhookMultiInstance.handlePaiMortgageWebhook(req, res);
  }
  return webhookController.handleWebhook(req, res);
});
router.post('/send-message', (req, res, next) => {
  const instance = req.body?.instance;
  if (instance === 'pai-assistant') {
    return webhookMultiInstance.handlePaiAssistantWebhook(req, res);
  } else if (instance === 'pai-mortgage-fresh') {
    return webhookMultiInstance.handlePaiMortgageWebhook(req, res);
  }
  return webhookController.handleWebhook(req, res);
});
router.post('/qrcode-updated', webhookController.handleWebhook);
router.post('/messages-set', webhookController.handleWebhook);
router.post('/chats-set', webhookController.handleWebhook);
router.post('/contacts-set', webhookController.handleWebhook);

// Webhook management endpoints
router.get('/status', webhookController.getWebhookStatus);
router.get('/multi-instance/status', webhookMultiInstance.getMultiInstanceStatus);
router.post('/setup', validate(webhookSetupSchema), webhookController.setupWebhook);
router.post('/test', webhookController.testWebhook);

module.exports = router;
