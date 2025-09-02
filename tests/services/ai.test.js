const axios = require('axios');
const aiService = require('../../src/services/ai');
const config = require('../../src/config');

jest.mock('axios');
jest.mock('../../src/config', () => ({
  openai: {
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo',
  },
}));

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset aiService state
    aiService.apiKey = config.openai.apiKey;
    aiService.model = config.openai.model;
    aiService.enabled = !!aiService.apiKey;
    
    if (aiService.enabled) {
      aiService.client = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          Authorization: `Bearer ${aiService.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
  });

  describe('constructor', () => {
    it('should initialize with API key and enable service', () => {
      expect(aiService.apiKey).toBe('test-api-key');
      expect(aiService.model).toBe('gpt-3.5-turbo');
      expect(aiService.enabled).toBe(true);
      expect(aiService.client).toBeDefined();
    });
  });

  describe('isEnabled', () => {
    it('should return true when API key is configured', () => {
      expect(aiService.isEnabled()).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      aiService.enabled = false;
      expect(aiService.isEnabled()).toBe(false);
    });
  });

  describe('analyzeMessage', () => {
    const mockAnalysisResponse = {
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              category: 'business',
              priority: 'high',
              sentiment: 'neutral',
              intent: 'request',
              summary: 'User requesting meeting',
              confidence: 0.9,
              recommendedActions: ['schedule_meeting'],
              entities: [{ type: 'date', value: 'tomorrow' }],
            }),
          },
        }],
        usage: { total_tokens: 150 },
      },
    };

    it('should analyze message when AI is enabled', async () => {
      aiService.client.post = jest.fn().mockResolvedValue(mockAnalysisResponse);

      const result = await aiService.analyzeMessage('Can we schedule a meeting tomorrow?', {
        senderName: 'John',
        conversationHistory: false,
      });

      expect(result).toEqual({
        category: 'business',
        priority: 'high',
        sentiment: 'neutral',
        intent: 'request',
        summary: 'User requesting meeting',
        confidence: 0.9,
        recommendedActions: ['schedule_meeting'],
        entities: [{ type: 'date', value: 'tomorrow' }],
        aiProcessed: true,
      });

      expect(aiService.client.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('AI assistant specialized in analyzing WhatsApp messages'),
          },
          {
            role: 'user',
            content: expect.stringContaining('Can we schedule a meeting tomorrow?'),
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
    });

    it('should return default response when AI is disabled', async () => {
      aiService.enabled = false;

      const result = await aiService.analyzeMessage('Test message');

      expect(result).toEqual({
        category: null,
        priority: null,
        sentiment: null,
        summary: null,
        intent: null,
        entities: [],
        confidence: 0,
        aiProcessed: false,
      });
    });

    it('should handle API errors gracefully', async () => {
      aiService.client.post = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await aiService.analyzeMessage('Test message');

      expect(result).toEqual({
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
    });

    it('should handle empty AI response', async () => {
      aiService.client.post = jest.fn().mockResolvedValue({
        data: { choices: [] },
      });

      const result = await aiService.analyzeMessage('Test message');

      expect(result.aiProcessed).toBe(false);
      expect(result.error).toBe('Empty response from AI service');
    });
  });

  describe('generateResponse', () => {
    const mockResponseData = {
      data: {
        choices: [{
          message: {
            content: 'Hi John! This is Test Owner\'s personal assistant. I\'ll make sure they get your message.',
          },
        }],
        usage: { total_tokens: 75 },
      },
    };

    it('should generate response when AI is enabled', async () => {
      aiService.client.post = jest.fn().mockResolvedValue(mockResponseData);

      const result = await aiService.generateResponse('Hi, can you help me?', {
        ownerName: 'Test Owner',
        senderName: 'John',
        isFirstMessage: true,
      });

      expect(result).toBe('Hi John! This is Test Owner\'s personal assistant. I\'ll make sure they get your message.');
      expect(aiService.client.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('professional personal assistant for Test Owner'),
          },
          {
            role: 'user',
            content: expect.stringContaining('Hi, can you help me?'),
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });
    });

    it('should return null when AI is disabled', async () => {
      aiService.enabled = false;

      const result = await aiService.generateResponse('Test message');

      expect(result).toBeNull();
    });

    it('should handle API errors and return null', async () => {
      aiService.client.post = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await aiService.generateResponse('Test message');

      expect(result).toBeNull();
    });

    it('should handle empty response', async () => {
      aiService.client.post = jest.fn().mockResolvedValue({
        data: { choices: [] },
      });

      const result = await aiService.generateResponse('Test message');

      expect(result).toBeNull();
    });
  });

  describe('summarizeConversation', () => {
    const mockMessages = [
      { sender: 'user', content: 'Hi, I need help with my order' },
      { sender: 'assistant', content: 'I can help with that. What\'s your order number?' },
      { sender: 'user', content: 'Order #12345' },
    ];

    const mockSummaryResponse = {
      data: {
        choices: [{
          message: {
            content: 'User contacted about order #12345 needing assistance. Assistant offered help and requested order number. Status: In progress.',
          },
        }],
        usage: { total_tokens: 120 },
      },
    };

    it('should summarize conversation when AI is enabled', async () => {
      aiService.client.post = jest.fn().mockResolvedValue(mockSummaryResponse);

      const result = await aiService.summarizeConversation(mockMessages);

      expect(result).toBe('User contacted about order #12345 needing assistance. Assistant offered help and requested order number. Status: In progress.');
      expect(aiService.client.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('creates concise, accurate summaries'),
          },
          {
            role: 'user',
            content: expect.stringContaining('user: Hi, I need help with my order'),
          },
        ],
        temperature: 0.3,
        max_tokens: 250,
      });
    });

    it('should return null when AI is disabled', async () => {
      aiService.enabled = false;

      const result = await aiService.summarizeConversation(mockMessages);

      expect(result).toBeNull();
    });

    it('should return null for empty messages', async () => {
      const result = await aiService.summarizeConversation([]);

      expect(result).toBeNull();
    });

    it('should handle API errors and return null', async () => {
      aiService.client.post = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await aiService.summarizeConversation(mockMessages);

      expect(result).toBeNull();
    });
  });

  describe('extractEntities', () => {
    const mockEntityResponse = {
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              entities: [
                { type: 'person', value: 'John Smith', confidence: 0.9 },
                { type: 'date', value: 'tomorrow', confidence: 0.8 },
                { type: 'phone', value: '+1-555-123-4567', confidence: 0.95 },
              ],
            }),
          },
        }],
      },
    };

    it('should extract entities when AI is enabled', async () => {
      aiService.client.post = jest.fn().mockResolvedValue(mockEntityResponse);

      const result = await aiService.extractEntities('Call John Smith at +1-555-123-4567 tomorrow');

      expect(result).toEqual({
        entities: [
          { type: 'person', value: 'John Smith', confidence: 0.9 },
          { type: 'date', value: 'tomorrow', confidence: 0.8 },
          { type: 'phone', value: '+1-555-123-4567', confidence: 0.95 },
        ],
        aiProcessed: true,
      });

      expect(aiService.client.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('AI specialized in named entity recognition'),
          },
          {
            role: 'user',
            content: expect.stringContaining('Call John Smith at +1-555-123-4567 tomorrow'),
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });
    });

    it('should return empty entities when AI is disabled', async () => {
      aiService.enabled = false;

      const result = await aiService.extractEntities('Test message');

      expect(result).toEqual({
        entities: [],
        aiProcessed: false,
      });
    });

    it('should handle API errors gracefully', async () => {
      aiService.client.post = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await aiService.extractEntities('Test message');

      expect(result).toEqual({
        entities: [],
        aiProcessed: false,
      });
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = '{"category": "business", "priority": "high"}';
      const result = aiService.parseAIResponse(jsonResponse);

      expect(result).toEqual({
        category: 'business',
        priority: 'high',
      });
    });

    it('should extract JSON from mixed content', () => {
      const mixedResponse = 'Here is the analysis: {"category": "business", "priority": "high"} Hope this helps!';
      const result = aiService.parseAIResponse(mixedResponse);

      expect(result).toEqual({
        category: 'business',
        priority: 'high',
      });
    });

    it('should return default structure for invalid JSON', () => {
      const invalidResponse = 'This is not JSON at all';
      const result = aiService.parseAIResponse(invalidResponse);

      expect(result).toEqual({
        category: 'other',
        priority: 'medium',
        sentiment: 'neutral',
        summary: 'Unable to parse AI analysis',
        intent: 'other',
        entities: [],
        confidence: 0.3,
      });
    });
  });

  describe('buildAnalysisPrompt', () => {
    it('should build comprehensive analysis prompt', () => {
      const content = 'Can we schedule a meeting?';
      const context = {
        senderName: 'John',
        conversationHistory: true,
        timeOfDay: 'morning',
      };

      const prompt = aiService.buildAnalysisPrompt(content, context);

      expect(prompt).toContain('Can we schedule a meeting?');
      expect(prompt).toContain('Sender: John');
      expect(prompt).toContain('ongoing conversation');
      expect(prompt).toContain('Time: morning');
      expect(prompt).toContain('JSON format');
    });

    it('should handle minimal context', () => {
      const prompt = aiService.buildAnalysisPrompt('Test message', {});

      expect(prompt).toContain('Test message');
      expect(prompt).toContain('new conversation');
    });
  });

  describe('buildResponsePrompt', () => {
    it('should build response generation prompt', () => {
      const messageContent = 'Hi, can you help me?';
      const context = {
        ownerName: 'Test Owner',
        senderName: 'John',
        isFirstMessage: true,
      };

      const prompt = aiService.buildResponsePrompt(messageContent, context);

      expect(prompt).toContain('Hi, can you help me?');
      expect(prompt).toContain('Test Owner');
      expect(prompt).toContain('John');
      expect(prompt).toContain('first message');
      expect(prompt).toContain('personal assistant');
    });

    it('should use defaults for missing context', () => {
      const prompt = aiService.buildResponsePrompt('Test message', {});

      expect(prompt).toContain('the owner');
      expect(prompt).toContain('there');
      expect(prompt).toContain('ongoing conversation');
    });
  });

  describe('getServiceStats', () => {
    it('should return service statistics', async () => {
      const stats = await aiService.getServiceStats();

      expect(stats).toEqual({
        enabled: true,
        model: 'gpt-3.5-turbo',
        apiKeyConfigured: true,
      });
    });

    it('should show disabled status when no API key', async () => {
      aiService.enabled = false;
      aiService.apiKey = null;

      const stats = await aiService.getServiceStats();

      expect(stats.enabled).toBe(false);
      expect(stats.apiKeyConfigured).toBe(false);
    });
  });

  describe('testConnection', () => {
    const mockTestResponse = {
      data: {
        choices: [{
          message: {
            content: 'AI service is working',
          },
        }],
        usage: { total_tokens: 10 },
      },
    };

    it('should test connection successfully', async () => {
      aiService.client.post = jest.fn().mockResolvedValue(mockTestResponse);

      const result = await aiService.testConnection();

      expect(result).toEqual({
        success: true,
        model: 'gpt-3.5-turbo',
        response: 'AI service is working',
        tokensUsed: 10,
      });

      expect(aiService.client.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: 'Hello, please respond with "AI service is working"',
        }],
        max_tokens: 20,
      });
    });

    it('should return error when AI is disabled', async () => {
      aiService.enabled = false;

      const result = await aiService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'AI service not configured',
      });
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      error.response = { status: 401 };
      aiService.client.post = jest.fn().mockRejectedValue(error);

      const result = await aiService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'Connection failed',
        status: 401,
      });
    });
  });
});