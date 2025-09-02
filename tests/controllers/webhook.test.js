const request = require('supertest');
const express = require('express');

// Mock the WhatsApp service before requiring the controller
const mockWhatsAppService = {
  validateWebhookSignature: jest.fn(),
  parseWebhookMessage: jest.fn(),
  getWebhook: jest.fn(),
  getInstanceStatus: jest.fn(),
  setWebhook: jest.fn(),
};

jest.mock('../../src/services/whatsapp', () => {
  return jest.fn().mockImplementation(() => mockWhatsAppService);
});

const webhookRoutes = require('../../src/routes/webhook');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Webhook Controller', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/webhook', webhookRoutes);

    // Reset mocks
    jest.clearAllMocks();
    
    // Set default return values
    mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);
  });

  describe('POST /webhook', () => {
    it('should handle valid webhook with message upsert', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);
      mockWhatsAppService.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-123',
        phone: '1234567890',
        content: 'Hello, world!',
        messageType: 'conversation',
      });

      const webhookData = {
        event: 'messages.upsert',
        data: [{
          key: {
            id: 'msg-123',
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: 'Hello, world!',
          },
        }],
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockWhatsAppService.validateWebhookSignature).toHaveBeenCalled();
    });

    it('should reject invalid webhook signature', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(false);

      const webhookData = {
        event: 'messages.upsert',
        data: [],
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', 'invalid-signature')
        .send(webhookData)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid signature' });
    });

    it('should handle connection update events', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);

      const webhookData = {
        event: 'connection.update',
        data: {
          connection: 'open',
          lastDisconnect: null,
        },
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should handle unknown events gracefully', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);

      const webhookData = {
        event: 'unknown.event',
        data: { some: 'data' },
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should handle processing errors', async () => {
      mockWhatsAppService.validateWebhookSignature.mockImplementation(() => {
        throw new Error('Signature validation failed');
      });

      const webhookData = {
        event: 'messages.upsert',
        data: [],
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /webhook/status', () => {
    it('should return webhook and instance status', async () => {
      const mockWebhookConfig = {
        webhook: {
          url: 'https://example.com/webhook',
          events: ['messages.upsert'],
        },
      };
      const mockInstanceStatus = {
        state: 'open',
      };

      mockWhatsAppService.getWebhook.mockResolvedValue(mockWebhookConfig);
      mockWhatsAppService.getInstanceStatus.mockResolvedValue(mockInstanceStatus);

      const response = await request(app)
        .get('/webhook/status')
        .expect(200);

      expect(response.body).toEqual({
        webhook: mockWebhookConfig,
        instance: mockInstanceStatus,
        configured: true,
        connected: true,
      });
    });

    it('should handle errors when getting status', async () => {
      mockWhatsAppService.getWebhook.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/webhook/status')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to get webhook status');
    });
  });

  describe('POST /webhook/setup', () => {
    it('should setup webhook with valid data', async () => {
      const mockResult = { success: true, id: 'webhook-123' };
      mockWhatsAppService.setWebhook.mockResolvedValue(mockResult);

      const setupData = {
        webhookUrl: 'https://example.com/webhook',
        events: ['messages.upsert', 'messages.update'],
      };

      const response = await request(app)
        .post('/webhook/setup')
        .send(setupData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        result: mockResult,
      });
      expect(mockWhatsAppService.setWebhook).toHaveBeenCalledWith(
        setupData.webhookUrl,
        setupData.events,
      );
    });

    it.skip('should validate webhook URL format', async () => {
      const setupData = {
        webhookUrl: 'not-a-valid-url',
      };

      const response = await request(app)
        .post('/webhook/setup')
        .send(setupData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle setup errors', async () => {
      mockWhatsAppService.setWebhook.mockRejectedValue(new Error('Setup failed'));

      const setupData = {
        webhookUrl: 'https://example.com/webhook',
      };

      const response = await request(app)
        .post('/webhook/setup')
        .send(setupData)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to setup webhook');
    });
  });

  describe('POST /webhook/test', () => {
    it('should handle test webhook requests', async () => {
      const testData = { test: 'data' };

      const response = await request(app)
        .post('/webhook/test')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook test successful',
        body: testData,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Message Processing', () => {
    it('should skip messages from self', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);
      mockWhatsAppService.parseWebhookMessage.mockReturnValue(null); // Indicates self message

      const webhookData = {
        event: 'messages.upsert',
        data: [{
          key: {
            id: 'msg-123',
            fromMe: true, // This would cause parseWebhookMessage to return null
          },
        }],
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should handle invalid message data gracefully', async () => {
      mockWhatsAppService.validateWebhookSignature.mockReturnValue(true);

      const webhookData = {
        event: 'messages.upsert',
        data: 'invalid-data', // Should be an array
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });
});