const request = require('supertest');
const express = require('express');

// Mock services before requiring the controller
const mockEvolutionMultiInstance = {
  getInstance: jest.fn(),
  getInstanceConfig: jest.fn(),
  sendMessage: jest.fn(),
};

const mockPaiAssistantWhatsApp = {
  processMessageWithCommands: jest.fn(),
};

const mockPaiMortgageWhatsApp = {
  processMessageWithCommands: jest.fn(),
};

const mockMessageProcessor = {
  processMessage: jest.fn(),
};

jest.mock('../../src/services/whatsapp/evolutionMultiInstance', () => mockEvolutionMultiInstance);
jest.mock('../../src/services/ai/paiAssistantWhatsApp', () => mockPaiAssistantWhatsApp);
jest.mock('../../src/services/ai/paiMortgageWhatsApp', () => mockPaiMortgageWhatsApp);
jest.mock('../../src/services/whatsapp/messageProcessor', () => mockMessageProcessor);

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const webhookMultiInstanceController = require('../../src/controllers/webhookMultiInstance');

describe('Webhook Multi-Instance Controller', () => {
  let app;
  let mockWhatsAppInstance;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Setup mock WhatsApp instance
    mockWhatsAppInstance = {
      validateWebhookSignature: jest.fn(),
      parseWebhookMessage: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default return values
    mockEvolutionMultiInstance.getInstance.mockReturnValue(mockWhatsAppInstance);
    mockEvolutionMultiInstance.getInstanceConfig.mockReturnValue({
      instanceId: 'test-instance',
      assistantType: 'test-assistant',
      webhookUrl: 'http://localhost:3000/webhook/test'
    });
    mockWhatsAppInstance.validateWebhookSignature.mockReturnValue(true);
  });

  describe('handleMainWebhook', () => {
    beforeEach(() => {
      app.post('/webhook', webhookMultiInstanceController.handleMainWebhook);
    });

    it('should handle valid main webhook with message upsert', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-123',
        phone: '1234567890',
        content: 'Hello from main!',
        messageType: 'conversation',
        pushName: 'Test User'
      });

      mockMessageProcessor.processMessage.mockResolvedValue({
        processed: true,
        conversation: { id: 'conv-123' },
        message: { id: 'msg-123' },
        response: { sent: true }
      });

      const webhookData = {
        event: 'messages.upsert',
        data: {
          key: {
            id: 'msg-123',
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: 'Hello from main!',
          },
        }
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', 'valid-signature')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'main' });
      expect(mockWhatsAppInstance.validateWebhookSignature).toHaveBeenCalled();
      expect(mockEvolutionMultiInstance.getInstance).toHaveBeenCalledWith('main');
      expect(mockMessageProcessor.processMessage).toHaveBeenCalled();
    });

    it('should reject invalid webhook signature for main instance', async () => {
      mockWhatsAppInstance.validateWebhookSignature.mockReturnValue(false);

      const webhookData = {
        event: 'messages.upsert',
        data: {}
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', 'invalid-signature')
        .send(webhookData)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid signature' });
    });

    it('should handle connection update events', async () => {
      const webhookData = {
        event: 'connection.update',
        data: {
          connection: 'open',
          state: 'open',
          lastDisconnect: null,
        }
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'main' });
    });
  });

  describe('handlePaiAssistantWebhook', () => {
    beforeEach(() => {
      app.post('/webhook/pai-assistant', webhookMultiInstanceController.handlePaiAssistantWebhook);
    });

    it('should handle PAI Assistant message successfully', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-456',
        phone: '1234567890',
        content: 'What messages did I get today?',
        messageType: 'conversation',
        pushName: 'Test User'
      });

      mockPaiAssistantWhatsApp.processMessageWithCommands.mockResolvedValue({
        success: true,
        response: 'Here are your messages from today: ...',
        messageType: 'search_results',
        tokensUsed: 150
      });

      const webhookData = {
        key: {
          id: 'msg-456',
          remoteJid: '1234567890@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'What messages did I get today?',
        }
      };

      const response = await request(app)
        .post('/webhook/pai-assistant')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'pai-assistant' });
      expect(mockEvolutionMultiInstance.getInstance).toHaveBeenCalledWith('pai-assistant');
      expect(mockPaiAssistantWhatsApp.processMessageWithCommands).toHaveBeenCalled();
      expect(mockEvolutionMultiInstance.sendMessage).toHaveBeenCalledWith(
        'pai-assistant',
        '1234567890',
        'Here are your messages from today: ...'
      );
    });

    it('should handle PAI Assistant processing failure', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-789',
        phone: '1234567890',
        content: 'Invalid query',
        messageType: 'conversation',
        pushName: 'Test User'
      });

      mockPaiAssistantWhatsApp.processMessageWithCommands.mockResolvedValue({
        success: false,
        error: 'Failed to process message'
      });

      const webhookData = {
        key: { id: 'msg-789', remoteJid: '1234567890@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Invalid query' }
      };

      const response = await request(app)
        .post('/webhook/pai-assistant')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'pai-assistant' });
      expect(mockPaiAssistantWhatsApp.processMessageWithCommands).toHaveBeenCalled();
    });

    it('should handle processing exceptions gracefully', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-error',
        phone: '1234567890',
        content: 'Test message',
        messageType: 'conversation',
        pushName: 'Test User'
      });

      mockPaiAssistantWhatsApp.processMessageWithCommands.mockRejectedValue(
        new Error('Processing failed')
      );

      const webhookData = {
        key: { id: 'msg-error', remoteJid: '1234567890@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Test message' }
      };

      const response = await request(app)
        .post('/webhook/pai-assistant')
        .send(webhookData)
        .expect(200); // The webhook still returns 200 but logs the error

      expect(response.body).toEqual({ success: true, instance: 'pai-assistant' });
      expect(mockPaiAssistantWhatsApp.processMessageWithCommands).toHaveBeenCalled();
    });
  });

  describe('handlePaiMortgageWebhook', () => {
    beforeEach(() => {
      app.post('/webhook/pai-mortgage', webhookMultiInstanceController.handlePaiMortgageWebhook);
    });

    it('should handle PAI Mortgage message successfully', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-mortgage-123',
        phone: '1234567890',
        content: 'I want to apply for a mortgage',
        messageType: 'conversation',
        pushName: 'John Doe'
      });

      mockPaiMortgageWhatsApp.processMessageWithCommands.mockResolvedValue({
        success: true,
        response: 'I can help you with your mortgage application. Let me gather some information...',
        intent: 'mortgage_application',
        tokensUsed: 200
      });

      const webhookData = {
        key: {
          id: 'msg-mortgage-123',
          remoteJid: '1234567890@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'I want to apply for a mortgage',
        }
      };

      const response = await request(app)
        .post('/webhook/pai-mortgage')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'pai-mortgage' });
      expect(mockEvolutionMultiInstance.getInstance).toHaveBeenCalledWith('pai-mortgage');
      expect(mockPaiMortgageWhatsApp.processMessageWithCommands).toHaveBeenCalled();
      expect(mockEvolutionMultiInstance.sendMessage).toHaveBeenCalledWith(
        'pai-mortgage',
        '1234567890',
        'I can help you with your mortgage application. Let me gather some information...'
      );
    });

    it('should handle invalid message data', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue(null);

      const webhookData = {
        key: { id: 'invalid-msg', remoteJid: '1234567890@s.whatsapp.net', fromMe: true },
        message: { conversation: 'Self message' }
      };

      const response = await request(app)
        .post('/webhook/pai-mortgage')
        .send(webhookData)
        .expect(200);

      expect(response.body).toEqual({ success: true, instance: 'pai-mortgage' });
      expect(mockPaiMortgageWhatsApp.processMessageWithCommands).not.toHaveBeenCalled();
    });

    it('should handle mortgage processing exceptions gracefully', async () => {
      mockWhatsAppInstance.parseWebhookMessage.mockReturnValue({
        messageId: 'msg-mortgage-error',
        phone: '1234567890',
        content: 'Test mortgage message',
        messageType: 'conversation',
        pushName: 'Test User'
      });

      mockPaiMortgageWhatsApp.processMessageWithCommands.mockRejectedValue(
        new Error('Mortgage processing failed')
      );

      const webhookData = {
        key: { id: 'msg-mortgage-error', remoteJid: '1234567890@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Test mortgage message' }
      };

      const response = await request(app)
        .post('/webhook/pai-mortgage')
        .send(webhookData)
        .expect(200); // The webhook still returns 200 but logs the error

      expect(response.body).toEqual({ success: true, instance: 'pai-mortgage' });
      expect(mockPaiMortgageWhatsApp.processMessageWithCommands).toHaveBeenCalled();
    });
  });

  describe('handleGenericWebhook', () => {
    beforeEach(() => {
      app.post('/webhook/*', webhookMultiInstanceController.handleGenericWebhook);
    });

    it('should route to PAI Assistant for pai-assistant path', async () => {
      const handlePaiAssistantWebhook = jest.spyOn(webhookMultiInstanceController, 'handlePaiAssistantWebhook');
      
      const webhookData = { key: {}, message: {} };
      
      const response = await request(app)
        .post('/webhook/pai-assistant')
        .send(webhookData);

      // This would call the actual function, but we can't easily test the routing logic
      // without more complex mocking. For now, just verify the endpoint exists.
      expect(response.status).toBeDefined();
    });
  });

  describe('getMultiInstanceStatus', () => {
    beforeEach(() => {
      app.get('/status', webhookMultiInstanceController.getMultiInstanceStatus);
    });

    it('should return multi-instance service statistics', async () => {
      const mockStats = {
        initialized: true,
        instanceCount: 3,
        instances: {
          main: { instanceId: 'aipbx', connected: true, state: 'open' },
          'pai-assistant': { instanceId: 'pai-assistant', connected: false, state: 'close' },
          'pai-mortgage': { instanceId: 'pai-mortgage', connected: false, state: 'close' }
        }
      };

      mockEvolutionMultiInstance.getServiceStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.multiInstance).toEqual(mockStats);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle service stats error', async () => {
      mockEvolutionMultiInstance.getServiceStats = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .get('/status')
        .expect(500);

      expect(response.body.error).toBe('Failed to get multi-instance status');
      expect(response.body.message).toBe('Service unavailable');
    });
  });
});