const express = require('express');
const { validate } = require('../middleware/validation');
const { webhookSetupSchema } = require('../utils/schemas');
const webhookController = require('../controllers/webhook');
const webhookMultiInstance = require('../controllers/webhookMultiInstance');

const router = express.Router();

// Multi-instance webhook endpoints
router.post('/main', webhookMultiInstance.handleMainWebhook);
router.post('/pai-assistant', webhookMultiInstance.handlePaiAssistantWebhook);
router.post('/pai-mortgage', webhookMultiInstance.handlePaiMortgageWebhook);

// GET endpoints for webhook health checks (Evolution API tests these)
router.get('/main', (req, res) => res.json({ status: 'ok', webhook: 'main' }));
router.get('/pai-assistant', (req, res) => res.json({ status: 'ok', webhook: 'pai-assistant' }));
router.get('/pai-mortgage', (req, res) => res.json({ status: 'ok', webhook: 'pai-mortgage' }));

// PAI Assistant specific event endpoints (webhookByEvents: true)
router.post('/pai-assistant/messages-upsert', webhookMultiInstance.handlePaiAssistantWebhook);
router.post('/pai-assistant/connection-update', webhookMultiInstance.handlePaiAssistantWebhook);

// PAI Mortgage specific event endpoints (webhookByEvents: true)
router.post('/pai-mortgage/messages-upsert', webhookMultiInstance.handlePaiMortgageWebhook);
router.post('/pai-mortgage/connection-update', webhookMultiInstance.handlePaiMortgageWebhook);

// Main webhook endpoint for Evolution API (backward compatibility)
router.post('/', webhookController.handleWebhook);

// Evolution API v2 specific webhook endpoints
router.post('/messages-upsert', webhookController.handleWebhook);
router.post('/messages-update', webhookController.handleWebhook);
router.post('/messages-delete', webhookController.handleWebhook);
router.post('/chats-update', webhookController.handleWebhook);
router.post('/contacts-update', webhookController.handleWebhook);
router.post('/presence-update', webhookController.handleWebhook);
router.post('/connection-update', webhookController.handleWebhook);
router.post('/send-message', webhookController.handleWebhook);
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
