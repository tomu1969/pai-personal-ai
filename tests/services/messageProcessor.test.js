const messageProcessor = require('../../src/services/messageProcessor');
const assistantService = require('../../src/services/assistant');
const filterService = require('../../src/services/filters');
const aiService = require('../../src/services/ai');
const conversationService = require('../../src/services/conversation');
const whatsappService = require('../../src/services/whatsapp');

// Mock all services
jest.mock('../../src/services/assistant');
jest.mock('../../src/services/filters');
jest.mock('../../src/services/ai');
jest.mock('../../src/services/conversation');
jest.mock('../../src/services/whatsapp');

describe('MessageProcessorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processMessage', () => {
    const mockMessage = {
      messageId: 'msg-1',
      phone: '+1234567890',
      content: 'Hello, I need help with my order',
      messageType: 'text',
      pushName: 'John Doe',
      timestamp: Date.now(),
    };

    const mockBasicAnalysis = {
      category: 'support',
      priority: 'medium',
      sentiment: 'neutral',
      isSpam: false,
      containsUrgentKeywords: false,
      messageType: 'request',
      language: 'english',
      wordCount: 7,
      confidence: 0.7,
      extractedInfo: {},
      flags: [],
    };

    const mockContact = {
      id: 'contact-1',
      phone: '+1234567890',
      name: 'John Doe',
      isBlocked: false,
    };

    const mockConversation = {
      id: 'conv-1',
      contactId: 'contact-1',
      status: 'active',
      category: 'support',
      priority: 'medium',
      isAssistantEnabled: true,
    };

    const mockStoredMessage = {
      id: 'stored-msg-1',
      messageId: 'msg-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      content: 'Hello, I need help with my order',
    };

    beforeEach(() => {
      filterService.analyzeMessage.mockReturnValue(mockBasicAnalysis);
      conversationService.findOrCreateContact.mockResolvedValue(mockContact);
      conversationService.findOrCreateConversation.mockResolvedValue(mockConversation);
      conversationService.storeMessage.mockResolvedValue(mockStoredMessage);
      conversationService.updateConversationStats.mockResolvedValue();
      assistantService.isEnabled.mockResolvedValue(true);
      assistantService.shouldRespond.mockResolvedValue(true);
      assistantService.generateAutoResponse.mockResolvedValue('Thanks for your message! I\'ll help you shortly.');
      assistantService.incrementMessageCount.mockResolvedValue();
      aiService.isEnabled.mockReturnValue(true);
      aiService.analyzeMessage.mockResolvedValue({
        category: 'support',
        priority: 'high',
        sentiment: 'neutral',
        intent: 'request_help',
        summary: 'User needs help with order',
        confidence: 0.9,
        aiProcessed: true,
      });
      whatsappService.sendMessage.mockResolvedValue({ success: true, messageId: 'sent-msg-1' });
    });

    it('should process message through complete pipeline successfully', async () => {
      const result = await messageProcessor.processMessage(mockMessage);

      expect(result).toEqual({
        processed: true,
        message: mockStoredMessage,
        conversation: mockConversation,
        contact: mockContact,
        analysis: expect.objectContaining({
          basic: mockBasicAnalysis,
          ai: expect.objectContaining({
            category: 'support',
            priority: 'high',
            aiProcessed: true,
          }),
          final: expect.objectContaining({
            category: 'support',
            priority: 'high',
            confidence: expect.any(Number),
          }),
        }),
        response: {
          sent: true,
          messageId: 'sent-msg-1',
          content: 'Thanks for your message! I\'ll help you shortly.',
        },
        stats: {
          processingTime: expect.any(Number),
          stepsCompleted: 12,
          aiUsed: true,
          responseSent: true,
        },
      });

      expect(filterService.analyzeMessage).toHaveBeenCalledWith(mockMessage.content, {
        senderName: mockMessage.pushName,
        phone: mockMessage.phone,
        messageType: mockMessage.messageType,
        timestamp: mockMessage.timestamp,
      });

      expect(conversationService.findOrCreateContact).toHaveBeenCalledWith(mockMessage.phone, {
        name: mockMessage.pushName,
      });

      expect(conversationService.storeMessage).toHaveBeenCalled();
      expect(assistantService.incrementMessageCount).toHaveBeenCalled();
      expect(whatsappService.sendMessage).toHaveBeenCalled();
    });

    it('should skip processing for spam messages', async () => {
      filterService.analyzeMessage.mockReturnValue({
        ...mockBasicAnalysis,
        isSpam: true,
        category: 'spam',
      });

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result).toEqual({
        processed: false,
        reason: 'spam_detected',
        message: mockStoredMessage,
        conversation: mockConversation,
        contact: mockContact,
        analysis: expect.any(Object),
      });

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip processing for blocked contacts', async () => {
      conversationService.findOrCreateContact.mockResolvedValue({
        ...mockContact,
        isBlocked: true,
      });

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result).toEqual({
        processed: false,
        reason: 'contact_blocked',
        message: mockStoredMessage,
        conversation: mockConversation,
        contact: expect.objectContaining({ isBlocked: true }),
        analysis: expect.any(Object),
      });

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should skip response when assistant should not respond', async () => {
      assistantService.shouldRespond.mockResolvedValue(false);

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.processed).toBe(true);
      expect(result.response).toEqual({
        sent: false,
        reason: 'assistant_should_not_respond',
      });

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle AI service unavailable gracefully', async () => {
      aiService.isEnabled.mockReturnValue(false);

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.processed).toBe(true);
      expect(result.analysis.ai).toEqual({
        category: null,
        priority: null,
        sentiment: null,
        summary: null,
        intent: null,
        entities: [],
        confidence: 0,
        aiProcessed: false,
      });
      expect(result.analysis.final.confidence).toBeLessThan(1);
    });

    it('should fall back to template response when AI response generation fails', async () => {
      assistantService.generateAutoResponse.mockResolvedValue(null);
      assistantService.generateAutoResponse.mockResolvedValue('Hi there! I\'m the assistant.');

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.response.sent).toBe(true);
      expect(result.response.content).toBe('Hi there! I\'m the assistant.');
    });

    it('should handle response sending failures', async () => {
      whatsappService.sendMessage.mockResolvedValue({ success: false, error: 'Network error' });

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.response).toEqual({
        sent: false,
        error: 'Network error',
        content: expect.any(String),
      });
    });

    it('should handle processing errors gracefully', async () => {
      const error = new Error('Database error');
      conversationService.storeMessage.mockRejectedValue(error);

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result).toEqual({
        processed: false,
        reason: 'processing_error',
        error: 'Database error',
        step: 'store_message',
      });
    });

    it('should process urgent messages with higher priority', async () => {
      const urgentAnalysis = {
        ...mockBasicAnalysis,
        priority: 'urgent',
        containsUrgentKeywords: true,
        category: 'urgent',
      };

      filterService.analyzeMessage.mockReturnValue(urgentAnalysis);

      const result = await messageProcessor.processMessage({
        ...mockMessage,
        content: 'URGENT! System is down, need immediate help!',
      });

      expect(result.processed).toBe(true);
      expect(result.analysis.basic.priority).toBe('urgent');
      expect(result.analysis.basic.containsUrgentKeywords).toBe(true);
    });

    it('should handle messages without AI enhancement when AI fails', async () => {
      aiService.analyzeMessage.mockResolvedValue({
        category: null,
        priority: null,
        sentiment: null,
        summary: null,
        intent: null,
        entities: [],
        confidence: 0,
        aiProcessed: false,
        error: 'API Error',
      });

      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.processed).toBe(true);
      expect(result.analysis.ai.aiProcessed).toBe(false);
      expect(result.analysis.ai.error).toBe('API Error');
      // Should still process with basic analysis
      expect(result.analysis.final.category).toBe(mockBasicAnalysis.category);
    });

    it('should track processing statistics correctly', async () => {
      const result = await messageProcessor.processMessage(mockMessage);

      expect(result.stats).toEqual({
        processingTime: expect.any(Number),
        stepsCompleted: 12,
        aiUsed: true,
        responseSent: true,
      });

      expect(result.stats.processingTime).toBeGreaterThan(0);
    });

    it('should handle different message types', async () => {
      const imageMessage = {
        ...mockMessage,
        messageType: 'image',
        content: 'Check this image',
        media: { url: 'https://example.com/image.jpg' },
      };

      const result = await messageProcessor.processMessage(imageMessage);

      expect(result.processed).toBe(true);
      expect(conversationService.storeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'image',
          media: { url: 'https://example.com/image.jpg' },
        }),
        expect.any(Object)
      );
    });
  });

  describe('combineAnalyses', () => {
    const basicAnalysis = {
      category: 'support',
      priority: 'medium',
      sentiment: 'neutral',
      confidence: 0.7,
    };

    const aiAnalysis = {
      category: 'business',
      priority: 'high',
      sentiment: 'positive',
      confidence: 0.9,
      aiProcessed: true,
    };

    it('should prefer AI analysis when available and confident', () => {
      const result = messageProcessor.combineAnalyses(basicAnalysis, aiAnalysis);

      expect(result).toEqual({
        category: 'business',
        priority: 'high',
        sentiment: 'positive',
        confidence: 0.9,
        source: 'ai_enhanced',
      });
    });

    it('should use basic analysis when AI confidence is low', () => {
      const lowConfidenceAI = { ...aiAnalysis, confidence: 0.3 };
      const result = messageProcessor.combineAnalyses(basicAnalysis, lowConfidenceAI);

      expect(result).toEqual({
        category: 'support',
        priority: 'medium',
        sentiment: 'neutral',
        confidence: 0.7,
        source: 'basic_rules',
      });
    });

    it('should use basic analysis when AI is not available', () => {
      const noAI = { aiProcessed: false, confidence: 0 };
      const result = messageProcessor.combineAnalyses(basicAnalysis, noAI);

      expect(result).toEqual({
        category: 'support',
        priority: 'medium',
        sentiment: 'neutral',
        confidence: 0.7,
        source: 'basic_rules',
      });
    });
  });

  describe('shouldSkipProcessing', () => {
    it('should skip spam messages', () => {
      const analysis = { isSpam: true };
      const result = messageProcessor.shouldSkipProcessing(analysis, {}, {});

      expect(result).toEqual({
        skip: true,
        reason: 'spam_detected',
      });
    });

    it('should skip blocked contacts', () => {
      const contact = { isBlocked: true };
      const result = messageProcessor.shouldSkipProcessing({}, contact, {});

      expect(result).toEqual({
        skip: true,
        reason: 'contact_blocked',
      });
    });

    it('should not skip normal messages', () => {
      const result = messageProcessor.shouldSkipProcessing(
        { isSpam: false },
        { isBlocked: false },
        {}
      );

      expect(result).toEqual({
        skip: false,
      });
    });
  });

  describe('generateResponseContent', () => {
    beforeEach(() => {
      aiService.isEnabled.mockReturnValue(true);
      aiService.generateResponse.mockResolvedValue('AI generated response');
      assistantService.generateAutoResponse.mockResolvedValue('Template response');
    });

    it('should use AI response when available', async () => {
      const result = await messageProcessor.generateResponseContent(
        'Test message',
        { name: 'John' },
        { category: 'support' }
      );

      expect(result).toBe('AI generated response');
      expect(aiService.generateResponse).toHaveBeenCalledWith('Test message', {
        contactName: 'John',
        category: 'support',
        isFirstMessage: expect.any(Boolean),
      });
    });

    it('should fall back to template when AI fails', async () => {
      aiService.generateResponse.mockResolvedValue(null);

      const result = await messageProcessor.generateResponseContent(
        'Test message',
        { name: 'John' },
        { category: 'support' }
      );

      expect(result).toBe('Template response');
      expect(assistantService.generateAutoResponse).toHaveBeenCalledWith('John');
    });

    it('should use template when AI is disabled', async () => {
      aiService.isEnabled.mockReturnValue(false);

      const result = await messageProcessor.generateResponseContent(
        'Test message',
        { name: 'John' },
        { category: 'support' }
      );

      expect(result).toBe('Template response');
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', () => {
      const stats = messageProcessor.getProcessingStats();

      expect(stats).toEqual({
        version: '1.0.0',
        totalSteps: 12,
        services: {
          filter: true,
          ai: expect.any(Boolean),
          assistant: true,
          conversation: true,
          whatsapp: true,
        },
      });
    });
  });
});