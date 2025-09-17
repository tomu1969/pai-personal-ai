const axios = require('axios');
const evolutionMultiInstance = require('../../src/services/whatsapp/evolutionMultiInstance');

// Mock axios for controlled testing
jest.mock('axios');
const mockedAxios = axios;

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock config
jest.mock('../../src/config', () => ({
  evolution: {
    apiUrl: 'http://localhost:8090',
    apiKey: 'test-api-key',
    instanceId: 'test-main',
    webhookUrl: 'http://localhost:3000/webhook',
    paiAssistantInstanceId: 'test-pai-assistant',
    paiAssistantWebhookUrl: 'http://localhost:3000/webhook/pai-assistant',
    paiMortgageInstanceId: 'test-pai-mortgage',
    paiMortgageWebhookUrl: 'http://localhost:3000/webhook/pai-mortgage',
  },
  server: {
    host: 'localhost',
    port: 3000
  }
}));

describe('Evolution Multi-Instance Integration Tests', () => {
  let mockAxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn()
        }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('Service Initialization', () => {
    it('should initialize all three instances', async () => {
      await evolutionMultiInstance.initialize();
      
      expect(evolutionMultiInstance.initialized).toBe(true);
      expect(evolutionMultiInstance.instances.size).toBe(3);
      expect(evolutionMultiInstance.instances.has('main')).toBe(true);
      expect(evolutionMultiInstance.instances.has('pai-assistant')).toBe(true);
      expect(evolutionMultiInstance.instances.has('pai-mortgage')).toBe(true);
    });

    it('should register instances with correct configurations', async () => {
      await evolutionMultiInstance.initialize();
      
      const mainConfig = evolutionMultiInstance.getInstanceConfig('main');
      const assistantConfig = evolutionMultiInstance.getInstanceConfig('pai-assistant');
      const mortgageConfig = evolutionMultiInstance.getInstanceConfig('pai-mortgage');
      
      expect(mainConfig.instanceId).toBe('test-main');
      expect(mainConfig.assistantType).toBe('pai_responder');
      expect(assistantConfig.instanceId).toBe('test-pai-assistant');
      expect(assistantConfig.assistantType).toBe('pai-assistant');
      expect(mortgageConfig.instanceId).toBe('test-pai-mortgage');
      expect(mortgageConfig.assistantType).toBe('pai-mortgage');
    });
  });

  describe('Instance Creation', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should create Evolution API instance successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          instance: {
            instanceName: 'test-pai-mortgage'
          }
        }
      });

      const result = await evolutionMultiInstance.createInstance('pai-mortgage');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', {
        instanceName: 'test-pai-mortgage',
        token: 'test-api-key',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhookUrl: 'http://localhost:3000/webhook/pai-mortgage',
        webhookEvents: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        reject_call: true,
        msg_call: 'This is an AI assistant line. Please send text messages only.',
        groups_ignore: true,
        always_online: false,
        read_messages: false,
        read_status: false,
        sync_full_history: false
      });
      
      expect(result.instance.instanceName).toBe('test-pai-mortgage');
    });

    it('should handle instance already exists error', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { status: 409 }
      });

      const result = await evolutionMultiInstance.createInstance('pai-mortgage');
      
      expect(result.instance.instanceName).toBe('test-pai-mortgage');
    });

    it('should propagate other creation errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { status: 500 },
        message: 'Server error'
      });

      await expect(evolutionMultiInstance.createInstance('pai-mortgage'))
        .rejects.toThrow();
    });
  });

  describe('Instance Deletion', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should delete Evolution API instance successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: {
          status: 'SUCCESS',
          error: false,
          response: { message: 'Instance deleted' }
        }
      });

      const result = await evolutionMultiInstance.deleteInstance('pai-mortgage');
      
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/instance/delete/test-pai-mortgage');
      expect(result.status).toBe('SUCCESS');
    });

    it('should handle deletion errors', async () => {
      mockAxiosInstance.delete.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Instance not found'
      });

      await expect(evolutionMultiInstance.deleteInstance('pai-mortgage'))
        .rejects.toThrow('Instance not found');
    });
  });

  describe('Instance Recreation', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should recreate instance successfully', async () => {
      // Mock deletion
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { status: 'SUCCESS' }
      });

      // Mock creation
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          instance: { instanceName: 'test-pai-mortgage' }
        }
      });

      // Mock webhook setting
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await evolutionMultiInstance.recreateInstance('pai-mortgage');
      
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/instance/delete/test-pai-mortgage');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', expect.any(Object));
      expect(result.instance.instanceName).toBe('test-pai-mortgage');
    });

    it('should handle deletion failure gracefully', async () => {
      // Mock deletion failure
      mockAxiosInstance.delete.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Instance not found'
      });

      // Mock successful creation
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          instance: { instanceName: 'test-pai-mortgage' }
        }
      });

      // Mock webhook setting
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await evolutionMultiInstance.recreateInstance('pai-mortgage');
      
      expect(result.instance.instanceName).toBe('test-pai-mortgage');
    });
  });

  describe('QR Code Limit Reset', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should detect QR code limit errors', () => {
      const qrError = new Error('QR code limit reached, please login again');
      const otherError = new Error('Network timeout');
      
      expect(evolutionMultiInstance.isQRCodeLimitError(qrError)).toBe(true);
      expect(evolutionMultiInstance.isQRCodeLimitError(otherError)).toBe(false);
    });

    it('should reset instance on QR code limit', async () => {
      // Mock deletion and creation for recreation
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { status: 'SUCCESS' }
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          instance: { instanceName: 'test-pai-mortgage' }
        }
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await evolutionMultiInstance.resetInstanceOnQRLimit('pai-mortgage');
      
      expect(result.instance.instanceName).toBe('test-pai-mortgage');
    });
  });

  describe('Connection Status', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should get connection status successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          instance: {
            state: 'open',
            connectionStatus: 'open'
          }
        }
      });

      const status = await evolutionMultiInstance.getConnectionStatus('pai-mortgage');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/instance/connectionState/test-pai-mortgage');
      expect(status.connected).toBe(true);
      expect(status.status.state).toBe('open');
    });

    it('should handle connection status errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Instance not found'
      });

      await expect(evolutionMultiInstance.getConnectionStatus('pai-mortgage'))
        .rejects.toThrow('Instance not found');
    });
  });

  describe('QR Code Generation', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should get QR code successfully', async () => {
      const mockQRData = {
        qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        code: 'qr-code-string'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockQRData
      });

      const result = await evolutionMultiInstance.getQRCode('pai-mortgage');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/instance/connect/test-pai-mortgage');
      expect(result.qrCode).toEqual(mockQRData);
      expect(result.alias).toBe('pai-mortgage');
    });
  });

  describe('Webhook Configuration', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should set webhook configuration successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      await evolutionMultiInstance.setWebhook('pai-mortgage');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/webhook/set/test-pai-mortgage', {
        enabled: true,
        url: 'http://localhost:3000/webhook/pai-mortgage',
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
      });
    });

    it('should handle webhook configuration errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: { status: 400 },
        message: 'Invalid webhook configuration'
      });

      await expect(evolutionMultiInstance.setWebhook('pai-mortgage'))
        .rejects.toThrow();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should send message via specific instance', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          key: { id: 'msg-123' },
          status: 'success'
        }
      });

      const result = await evolutionMultiInstance.sendMessage(
        'pai-mortgage',
        '1234567890',
        'Test mortgage message'
      );
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/message/sendText/test-pai-mortgage', {
        number: '1234567890',
        text: 'Test mortgage message'
      });
      
      expect(result.key.id).toBe('msg-123');
    });
  });

  describe('Service Statistics', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should get service statistics for all instances', async () => {
      // Mock connection status for all instances
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { instance: { state: 'open' } }
        })
        .mockResolvedValueOnce({
          data: { instance: { state: 'close' } }
        })
        .mockResolvedValueOnce({
          data: { instance: { state: 'connecting' } }
        });

      const stats = await evolutionMultiInstance.getServiceStats();
      
      expect(stats.initialized).toBe(true);
      expect(stats.instanceCount).toBe(3);
      expect(stats.instances.main).toBeDefined();
      expect(stats.instances['pai-assistant']).toBeDefined();
      expect(stats.instances['pai-mortgage']).toBeDefined();
    });

    it('should handle individual instance errors in statistics', async () => {
      // Mock one successful and one failing status check
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { instance: { state: 'open' } }
        })
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({
          data: { instance: { state: 'close' } }
        });

      const stats = await evolutionMultiInstance.getServiceStats();
      
      expect(stats.instances['pai-assistant'].error).toContain('Connection failed');
    });
  });

  describe('Webhook Path Routing', () => {
    beforeEach(async () => {
      await evolutionMultiInstance.initialize();
    });

    it('should find instance by webhook path', () => {
      const result = evolutionMultiInstance.getInstanceByWebhookPath('/webhook/pai-mortgage');
      
      expect(result).toBeDefined();
      expect(result.alias).toBe('pai-mortgage');
      expect(result.config.webhookPath).toBe('/webhook/pai-mortgage');
    });

    it('should return null for non-existent webhook path', () => {
      const result = evolutionMultiInstance.getInstanceByWebhookPath('/webhook/nonexistent');
      
      expect(result).toBeNull();
    });
  });
});