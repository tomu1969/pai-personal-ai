const axios = require('axios');
const WhatsAppService = require('../../src/services/whatsapp/whatsapp');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock config
jest.mock('../../src/config', () => ({
  evolution: {
    apiUrl: 'http://localhost:8080',
    apiKey: 'test-api-key',
    instanceId: 'test-instance',
    webhookSecret: 'test-secret',
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('WhatsAppService', () => {
  let whatsappService;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockClient);
    whatsappService = new WhatsAppService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key',
        },
        timeout: 30000,
      });
    });

    it('should set up response interceptors', () => {
      expect(mockClient.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const mockResponse = {
        data: {
          key: { id: 'message-123' },
        },
      };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await whatsappService.sendMessage('1234567890', 'Hello World');

      expect(mockClient.post).toHaveBeenCalledWith('/message/sendText/test-instance', {
        number: '1234567890',
        textMessage: {
          text: 'Hello World',
        },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle send message errors', async () => {
      const mockError = new Error('Network error');
      mockError.response = { status: 500 };
      mockClient.post.mockRejectedValue(mockError);

      await expect(whatsappService.sendMessage('1234567890', 'Hello'))
        .rejects.toThrow('Failed to send message: Network error');
    });

    it('should include additional options in payload', async () => {
      const mockResponse = { data: {} };
      mockClient.post.mockResolvedValue(mockResponse);

      const options = { quoted: { key: 'some-key' } };
      await whatsappService.sendMessage('1234567890', 'Hello', options);

      expect(mockClient.post).toHaveBeenCalledWith('/message/sendText/test-instance', {
        number: '1234567890',
        textMessage: {
          text: 'Hello',
        },
        quoted: { key: 'some-key' },
      });
    });
  });

  describe('sendMedia', () => {
    it('should send media message successfully', async () => {
      const mockResponse = {
        data: {
          key: { id: 'media-123' },
        },
      };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await whatsappService.sendMedia(
        '1234567890',
        'https://example.com/image.jpg',
        'image',
        'Test caption',
      );

      expect(mockClient.post).toHaveBeenCalledWith('/message/sendMedia/test-instance', {
        number: '1234567890',
        mediaMessage: {
          mediatype: 'image',
          media: 'https://example.com/image.jpg',
          caption: 'Test caption',
        },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should send media without caption', async () => {
      const mockResponse = { data: {} };
      mockClient.post.mockResolvedValue(mockResponse);

      await whatsappService.sendMedia('1234567890', 'https://example.com/doc.pdf', 'document');

      expect(mockClient.post).toHaveBeenCalledWith('/message/sendMedia/test-instance', {
        number: '1234567890',
        mediaMessage: {
          mediatype: 'document',
          media: 'https://example.com/doc.pdf',
        },
      });
    });
  });

  describe('setWebhook', () => {
    it('should set webhook successfully', async () => {
      const mockResponse = { data: { success: true } };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await whatsappService.setWebhook('https://example.com/webhook');

      expect(mockClient.post).toHaveBeenCalledWith('/webhook/set/test-instance', {
        webhook: {
          url: 'https://example.com/webhook',
          events: ['messages.upsert'],
        },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should set webhook with custom events', async () => {
      const mockResponse = { data: { success: true } };
      mockClient.post.mockResolvedValue(mockResponse);

      const events = ['messages.upsert', 'messages.update'];
      await whatsappService.setWebhook('https://example.com/webhook', events);

      expect(mockClient.post).toHaveBeenCalledWith('/webhook/set/test-instance', {
        webhook: {
          url: 'https://example.com/webhook',
          events,
        },
      });
    });
  });

  describe('getWebhook', () => {
    it('should get webhook configuration', async () => {
      const mockResponse = {
        data: {
          webhook: {
            url: 'https://example.com/webhook',
            events: ['messages.upsert'],
          },
        },
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await whatsappService.getWebhook();

      expect(mockClient.get).toHaveBeenCalledWith('/webhook/find/test-instance');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('checkPhoneNumber', () => {
    it('should return true for registered number', async () => {
      const mockResponse = {
        data: [{
          jid: '1234567890@s.whatsapp.net',
          exists: true,
        }],
      };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await whatsappService.checkPhoneNumber('1234567890');

      expect(mockClient.post).toHaveBeenCalledWith('/chat/whatsappNumbers/test-instance', {
        numbers: ['1234567890'],
      });
      expect(result).toBe(true);
    });

    it('should return false for unregistered number', async () => {
      const mockResponse = {
        data: [{
          jid: '1234567890@s.whatsapp.net',
          exists: false,
        }],
      };
      mockClient.post.mockResolvedValue(mockResponse);

      const result = await whatsappService.checkPhoneNumber('1234567890');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockClient.post.mockRejectedValue(new Error('Network error'));

      const result = await whatsappService.checkPhoneNumber('1234567890');
      expect(result).toBe(false);
    });
  });

  describe('parseWebhookMessage', () => {
    it('should parse text message correctly', () => {
      const webhookData = {
        data: {
          key: {
            id: 'msg-123',
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
          },
          messageType: 'conversation',
          message: {
            conversation: 'Hello, world!',
          },
          messageTimestamp: 1640000000,
          pushName: 'John Doe',
        },
      };

      const result = whatsappService.parseWebhookMessage(webhookData);

      expect(result).toEqual({
        messageId: 'msg-123',
        phone: '1234567890',
        content: 'Hello, world!',
        messageType: 'conversation',
        mediaUrl: null,
        mediaType: null,
        timestamp: 1640000000,
        pushName: 'John Doe',
        key: webhookData.data.key,
      });
    });

    it('should parse image message correctly', () => {
      const webhookData = {
        data: {
          key: {
            id: 'img-123',
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
          },
          messageType: 'imageMessage',
          message: {
            imageMessage: {
              caption: 'Nice photo!',
              url: 'https://example.com/image.jpg',
            },
          },
          messageTimestamp: 1640000000,
        },
      };

      const result = whatsappService.parseWebhookMessage(webhookData);

      expect(result).toEqual({
        messageId: 'img-123',
        phone: '1234567890',
        content: 'Nice photo!',
        messageType: 'imageMessage',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
        timestamp: 1640000000,
        pushName: null,
        key: webhookData.data.key,
      });
    });

    it('should return null for messages from self', () => {
      const webhookData = {
        data: {
          key: {
            id: 'msg-123',
            fromMe: true,
          },
        },
      };

      const result = whatsappService.parseWebhookMessage(webhookData);
      expect(result).toBeNull();
    });

    it('should return null for invalid webhook data', () => {
      const webhookData = { data: {} };
      const result = whatsappService.parseWebhookMessage(webhookData);
      expect(result).toBeNull();
    });

    it('should handle unsupported message types', () => {
      const webhookData = {
        data: {
          key: {
            id: 'msg-123',
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
          },
          messageType: 'unknownType',
          messageTimestamp: 1640000000,
        },
      };

      const result = whatsappService.parseWebhookMessage(webhookData);

      expect(result.content).toBe('Unsupported message type: unknownType');
      expect(result.messageType).toBe('unknownType');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = 'test payload';
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      const result = whatsappService.validateWebhookSignature(payload, `sha256=${expectedSignature}`);
      expect(result).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const payload = 'test payload';
      const wrongSignature = 'sha256=wrongsignature';

      const result = whatsappService.validateWebhookSignature(payload, wrongSignature);
      expect(result).toBe(false);
    });
  });
});