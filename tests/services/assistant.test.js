const { Assistant, Contact, Conversation, Message } = require('../../src/models');
const assistantService = require('../../src/services/assistant');
const config = require('../../src/config');

// Mock the models
jest.mock('../../src/models', () => ({
  Assistant: {
    findOrCreate: jest.fn(),
  },
  Contact: {
    count: jest.fn(),
  },
  Conversation: {
    count: jest.fn(),
  },
  Message: {
    count: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  assistant: {
    defaultStatus: true,
    ownerName: 'Test Owner',
    autoResponseTemplate: 'Hi {{contact_name}}! This is {{owner_name}}\'s assistant.',
    summaryIntervalHours: 24,
  },
}));

describe('AssistantService', () => {
  let mockAssistant;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAssistant = {
      id: 'test-assistant-id',
      enabled: true,
      ownerName: 'Test Owner',
      autoResponseTemplate: 'Hi {{contact_name}}! This is {{owner_name}}\'s assistant.',
      messagesProcessed: 5,
      lastActivity: new Date('2024-01-01T10:00:00Z'),
      settings: { summaryIntervalHours: 24 },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      update: jest.fn(),
    };

    Assistant.findOrCreate.mockResolvedValue([mockAssistant]);
  });

  describe('initialize', () => {
    it('should initialize assistant with default configuration', async () => {
      const result = await assistantService.initialize();

      expect(Assistant.findOrCreate).toHaveBeenCalledWith({
        where: {},
        defaults: {
          enabled: config.assistant.defaultStatus,
          ownerName: config.assistant.ownerName,
          autoResponseTemplate: config.assistant.autoResponseTemplate,
          messagesProcessed: 0,
          settings: {
            summaryIntervalHours: config.assistant.summaryIntervalHours,
          },
        },
      });

      expect(result).toBe(mockAssistant);
      expect(assistantService.isInitialized).toBe(true);
      expect(assistantService.currentAssistant).toBe(mockAssistant);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database error');
      Assistant.findOrCreate.mockRejectedValue(error);

      await expect(assistantService.initialize()).rejects.toThrow('Database error');
    });
  });

  describe('ensureInitialized', () => {
    it('should initialize if not already initialized', async () => {
      assistantService.isInitialized = false;
      const initializeSpy = jest.spyOn(assistantService, 'initialize');

      const result = await assistantService.ensureInitialized();

      expect(initializeSpy).toHaveBeenCalled();
      expect(result).toBe(mockAssistant);
    });

    it('should return current assistant if already initialized', async () => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;

      const result = await assistantService.ensureInitialized();

      expect(result).toBe(mockAssistant);
    });
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
    });

    it('should return true when assistant is enabled', async () => {
      mockAssistant.enabled = true;

      const result = await assistantService.isEnabled();

      expect(result).toBe(true);
    });

    it('should return false when assistant is disabled', async () => {
      mockAssistant.enabled = false;

      const result = await assistantService.isEnabled();

      expect(result).toBe(false);
    });
  });

  describe('toggle', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
      mockAssistant.update.mockResolvedValue(mockAssistant);
    });

    it('should enable assistant and update last activity', async () => {
      const result = await assistantService.toggle(true);

      expect(mockAssistant.update).toHaveBeenCalledWith({
        enabled: true,
        lastActivity: expect.any(Date),
      });

      expect(result).toEqual({
        success: true,
        enabled: true,
        lastActivity: mockAssistant.lastActivity,
        messagesProcessed: 5,
      });
    });

    it('should disable assistant without updating last activity', async () => {
      const originalLastActivity = mockAssistant.lastActivity;
      
      const result = await assistantService.toggle(false);

      expect(mockAssistant.update).toHaveBeenCalledWith({
        enabled: false,
        lastActivity: originalLastActivity,
      });

      expect(result).toEqual({
        success: true,
        enabled: true,
        lastActivity: originalLastActivity,
        messagesProcessed: 5,
      });
    });

    it('should handle toggle errors', async () => {
      const error = new Error('Update failed');
      mockAssistant.update.mockRejectedValue(error);

      await expect(assistantService.toggle(true)).rejects.toThrow('Update failed');
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;

      Message.count.mockResolvedValue(10);
      Conversation.count.mockResolvedValue(3);
      Contact.count.mockResolvedValue(15);
    });

    it('should return complete assistant status with statistics', async () => {
      const result = await assistantService.getStatus();

      expect(result).toEqual({
        id: 'test-assistant-id',
        enabled: true,
        ownerName: 'Test Owner',
        lastActivity: mockAssistant.lastActivity,
        messagesProcessed: 5,
        settings: { summaryIntervalHours: 24 },
        statistics: {
          recentMessages: 10,
          activeConversations: 3,
          totalContacts: 15,
          uptime: expect.any(Number),
        },
        createdAt: mockAssistant.createdAt,
        updatedAt: mockAssistant.updatedAt,
      });

      expect(Message.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: expect.any(Date),
          },
          sender: 'user',
        },
      });
    });
  });

  describe('generateAutoResponse', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
    });

    it('should generate response with contact name', async () => {
      const result = await assistantService.generateAutoResponse('John');

      expect(result).toContain('John');
      expect(result).toContain('Test Owner');
      expect(result).not.toContain('{{contact_name}}');
      expect(result).not.toContain('{{owner_name}}');
    });

    it('should generate response without contact name', async () => {
      const result = await assistantService.generateAutoResponse();

      expect(result).toContain('there');
      expect(result).toContain('Test Owner');
    });

    it('should handle template generation errors', async () => {
      assistantService.currentAssistant = null;

      const result = await assistantService.generateAutoResponse('John');

      expect(result).toContain('Test Owner');
      expect(result).toContain('personal assistant');
    });
  });

  describe('shouldRespond', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
      mockAssistant.enabled = true;
    });

    const mockMessage = {
      id: 'msg-1',
      sender: 'user',
      content: 'Test message',
    };

    const mockContact = {
      id: 'contact-1',
      isBlocked: false,
    };

    const mockConversation = {
      id: 'conv-1',
      isAssistantEnabled: true,
    };

    it('should return false when assistant is disabled', async () => {
      mockAssistant.enabled = false;

      const result = await assistantService.shouldRespond(mockMessage, mockContact, mockConversation);

      expect(result).toBe(false);
    });

    it('should return false for system messages', async () => {
      const systemMessage = { ...mockMessage, sender: 'system' };

      const result = await assistantService.shouldRespond(systemMessage, mockContact, mockConversation);

      expect(result).toBe(false);
    });

    it('should return false for assistant messages', async () => {
      const assistantMessage = { ...mockMessage, sender: 'assistant' };

      const result = await assistantService.shouldRespond(assistantMessage, mockContact, mockConversation);

      expect(result).toBe(false);
    });

    it('should return false for blocked contacts', async () => {
      const blockedContact = { ...mockContact, isBlocked: true };

      const result = await assistantService.shouldRespond(mockMessage, blockedContact, mockConversation);

      expect(result).toBe(false);
    });

    it('should return false when assistant disabled for conversation', async () => {
      const disabledConversation = { ...mockConversation, isAssistantEnabled: false };

      const result = await assistantService.shouldRespond(mockMessage, mockContact, disabledConversation);

      expect(result).toBe(false);
    });

    it('should return false when recent assistant message exists', async () => {
      const recentDate = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      Message.findOne.mockResolvedValue({
        createdAt: recentDate,
      });

      const result = await assistantService.shouldRespond(mockMessage, mockContact, mockConversation);

      expect(result).toBe(false);
    });

    it('should return true when all conditions are met', async () => {
      Message.findOne.mockResolvedValue(null);

      const result = await assistantService.shouldRespond(mockMessage, mockContact, mockConversation);

      expect(result).toBe(true);
    });
  });

  describe('incrementMessageCount', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
      mockAssistant.update.mockResolvedValue(mockAssistant);
    });

    it('should increment message count and update last activity', async () => {
      await assistantService.incrementMessageCount();

      expect(mockAssistant.update).toHaveBeenCalledWith({
        messagesProcessed: 6,
        lastActivity: expect.any(Date),
      });
    });

    it('should handle increment errors gracefully', async () => {
      const error = new Error('Update failed');
      mockAssistant.update.mockRejectedValue(error);

      // Should not throw, just log error
      await expect(assistantService.incrementMessageCount()).resolves.toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;
      mockAssistant.update.mockResolvedValue(mockAssistant);
    });

    it('should update allowed configuration fields', async () => {
      const updates = {
        ownerName: 'New Owner',
        autoResponseTemplate: 'New template',
        settings: { newSetting: true },
        notAllowed: 'should be ignored',
      };

      const result = await assistantService.updateConfig(updates);

      expect(mockAssistant.update).toHaveBeenCalledWith({
        ownerName: 'New Owner',
        autoResponseTemplate: 'New template',
        settings: {
          summaryIntervalHours: 24,
          newSetting: true,
        },
      });

      expect(result).toBe(mockAssistant);
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      assistantService.isInitialized = true;
      assistantService.currentAssistant = mockAssistant;

      Message.count
        .mockResolvedValueOnce(20) // totalMessages
        .mockResolvedValueOnce(15) // assistantMessages
        .mockResolvedValueOnce(8); // uniqueContacts

      Conversation.count
        .mockResolvedValueOnce(5) // conversationsCreated
        .mockResolvedValueOnce(3); // conversationsResolved
    });

    it('should return metrics for 24h timeframe', async () => {
      const result = await assistantService.getMetrics('24h');

      expect(result).toEqual({
        timeRange: '24h',
        totalMessages: 20,
        assistantMessages: 15,
        uniqueContacts: 8,
        conversationsCreated: 5,
        conversationsResolved: 3,
        responseRate: 75.00,
        averageResponseTime: 0,
      });
    });

    it('should handle different time ranges', async () => {
      const result = await assistantService.getMetrics('7d');

      expect(result.timeRange).toBe('7d');
    });
  });
});