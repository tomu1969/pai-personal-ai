const express = require('express');
const { validate } = require('../middleware/validation');
const { webhookSetupSchema } = require('../utils/schemas');
const webhookController = require('../controllers/webhook');

const router = express.Router();

// Main webhook endpoint for Evolution API
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
router.post('/setup', validate(webhookSetupSchema), webhookController.setupWebhook);
router.post('/test', webhookController.testWebhook);

module.exports = router;
