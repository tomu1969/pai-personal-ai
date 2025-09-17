// Mock OpenAI first
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock models module
const mockPaiMortgage = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn()
};

jest.mock('../../src/models', () => ({
  PaiMortgage: mockPaiMortgage
}));

const PaiMortgageService = require('../../src/assistants/pai-mortgage/service');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock config
jest.mock('../../src/config', () => ({
  openai: {
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo'
  }
}));

describe('PAI Mortgage Service', () => {
  let service;

  beforeEach(() => {
    service = new PaiMortgageService();
    jest.clearAllMocks();
  });

  describe('Entity Extraction', () => {
    it('should extract loan amount from message', () => {
      const message = "I want to borrow $350,000 for a house";
      const entities = service.extractEntities(message);
      
      expect(entities.loanAmount).toContain('350000');
      expect(entities.loanAmount).toContain('$350,000');
    });

    it('should extract income information', () => {
      const message = "My annual income is $75,000 and my monthly income is $6,250";
      const entities = service.extractEntities(message);
      
      expect(entities.income).toContain('$75,000');
      expect(entities.income).toContain('$6,250');
    });

    it('should extract credit score', () => {
      const message = "My credit score is 720";
      const entities = service.extractEntities(message);
      
      expect(entities.creditScore).toContain('720');
    });

    it('should extract debt information', () => {
      const message = "I have $500 monthly debt and $15,000 total debt";
      const entities = service.extractEntities(message);
      
      expect(entities.debt).toContain('$500');
      expect(entities.debt).toContain('$15,000');
    });

    it('should extract property value', () => {
      const message = "The house costs $400,000 and is valued at $410,000";
      const entities = service.extractEntities(message);
      
      expect(entities.propertyValue).toContain('$400,000');
      expect(entities.propertyValue).toContain('$410,000');
    });

    it('should identify loan program mentions', () => {
      const fhaMessage = "I want an FHA loan";
      const vaMessage = "Do I qualify for a VA loan?";
      const conventionalMessage = "Tell me about conventional mortgages";
      
      const fhaEntities = service.extractEntities(fhaMessage);
      const vaEntities = service.extractEntities(vaMessage);
      const conventionalEntities = service.extractEntities(conventionalMessage);
      
      expect(fhaEntities.loanPrograms).toContain('FHA');
      expect(vaEntities.loanPrograms).toContain('VA');
      expect(conventionalEntities.loanPrograms).toContain('conventional');
    });

    it('should extract employment information', () => {
      const message = "I work at ABC Company for 5 years as self-employed";
      const entities = service.extractEntities(message);
      
      expect(entities.employment).toContain('ABC Company');
      expect(entities.employment).toContain('5 years');
      expect(entities.employment).toContain('self-employed');
    });
  });

  describe('Mortgage Calculations', () => {
    it('should calculate LTV ratio correctly', () => {
      const ltv = service.calculateLTV(300000, 400000);
      expect(ltv).toBe(75);
    });

    it('should calculate DTI ratio correctly', () => {
      const dti = service.calculateDTI(6000, 2000);
      expect(dti).toBe(33.33);
    });

    it('should estimate monthly payment', () => {
      const payment = service.estimateMonthlyPayment(300000, 6.5, 30);
      expect(payment).toBeCloseTo(1896, 0); // Approximate value
    });

    it('should handle zero values gracefully', () => {
      const ltv = service.calculateLTV(0, 100000);
      const dti = service.calculateDTI(5000, 0);
      
      expect(ltv).toBe(0);
      expect(dti).toBe(0);
    });
  });

  describe('Intent Classification', () => {
    it('should classify mortgage application intent', () => {
      const message = "I want to apply for a mortgage";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('mortgage_application');
    });

    it('should classify qualification inquiry', () => {
      const message = "Do I qualify for a loan?";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('qualification_check');
    });

    it('should classify rate inquiry', () => {
      const message = "What are current mortgage rates?";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('rate_inquiry');
    });

    it('should classify document questions', () => {
      const message = "What documents do I need?";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('documents_required');
    });

    it('should classify calculation requests', () => {
      const message = "Calculate my monthly payment";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('payment_calculation');
    });

    it('should classify prequalification', () => {
      const message = "Can you prequalify me?";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('prequalification');
    });

    it('should handle general inquiries', () => {
      const message = "Tell me about mortgages";
      const intent = service.classifyIntent(message);
      expect(intent).toBe('general_inquiry');
    });
  });

  describe('Response Generation', () => {
    beforeEach(() => {
      mockPaiMortgage.findOne.mockResolvedValue({
        id: 1,
        assistantName: 'PAI Mortgage',
        ownerName: 'Test Owner',
        language: 'en',
        mortgageSettings: {
          maxLoanAmount: 1000000,
          minCreditScore: 580,
          maxDTIRatio: 43,
          supportedLoanTypes: ['conventional', 'fha', 'va', 'usda', 'jumbo']
        }
      });
    });

    it('should generate response using OpenAI', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'I can help you with your mortgage application. Based on your information, you may qualify for several loan programs.'
          }
        }],
        usage: {
          total_tokens: 150
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await service.generateResponse(
        'I want to apply for a mortgage',
        'mortgage_application',
        { loanAmount: ['$300,000'] },
        'John Doe',
        'en'
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe(mockResponse.choices[0].message.content);
      expect(result.tokensUsed).toBe(150);
      expect(result.intent).toBe('mortgage_application');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await service.generateResponse(
        'Test message',
        'general_inquiry',
        {},
        'Test User',
        'en'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });

    it('should include entities in prompt context', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response with entities' } }],
        usage: { total_tokens: 100 }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const entities = {
        loanAmount: ['$350,000'],
        creditScore: ['720'],
        income: ['$75,000']
      };

      await service.generateResponse(
        'I earn $75,000 and want a $350,000 loan with 720 credit score',
        'qualification_check',
        entities,
        'Test User',
        'en'
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;
      
      expect(prompt).toContain('$350,000');
      expect(prompt).toContain('720');
      expect(prompt).toContain('$75,000');
    });
  });

  describe('Bilingual Support', () => {
    it('should detect Spanish language', () => {
      const spanishMessage = "Quiero solicitar una hipoteca";
      const language = service.detectLanguage(spanishMessage);
      expect(language).toBe('es');
    });

    it('should detect English language', () => {
      const englishMessage = "I want to apply for a mortgage";
      const language = service.detectLanguage(englishMessage);
      expect(language).toBe('en');
    });

    it('should default to English for unclear language', () => {
      const unclearMessage = "123 test $$$";
      const language = service.detectLanguage(unclearMessage);
      expect(language).toBe('en');
    });
  });

  describe('Mortgage Settings', () => {
    it('should get default mortgage settings', () => {
      const settings = service.getDefaultMortgageSettings();
      
      expect(settings.maxLoanAmount).toBe(1000000);
      expect(settings.minCreditScore).toBe(580);
      expect(settings.maxDTIRatio).toBe(43);
      expect(settings.supportedLoanTypes).toContain('conventional');
      expect(settings.supportedLoanTypes).toContain('fha');
      expect(settings.supportedLoanTypes).toContain('va');
    });

    it('should validate loan amount against settings', () => {
      const settings = { maxLoanAmount: 500000 };
      
      const validAmount = service.validateLoanAmount(400000, settings);
      const invalidAmount = service.validateLoanAmount(600000, settings);
      
      expect(validAmount.valid).toBe(true);
      expect(invalidAmount.valid).toBe(false);
      expect(invalidAmount.reason).toContain('exceeds maximum');
    });

    it('should validate credit score against settings', () => {
      const settings = { minCreditScore: 600 };
      
      const validScore = service.validateCreditScore(650, settings);
      const invalidScore = service.validateCreditScore(550, settings);
      
      expect(validScore.valid).toBe(true);
      expect(invalidScore.valid).toBe(false);
      expect(invalidScore.reason).toContain('below minimum');
    });

    it('should validate DTI ratio against settings', () => {
      const settings = { maxDTIRatio: 43 };
      
      const validDTI = service.validateDTIRatio(35, settings);
      const invalidDTI = service.validateDTIRatio(50, settings);
      
      expect(validDTI.valid).toBe(true);
      expect(invalidDTI.valid).toBe(false);
      expect(invalidDTI.reason).toContain('exceeds maximum');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockPaiMortgage.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.generateResponse(
        'Test message',
        'general_inquiry',
        {},
        'Test User',
        'en'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle missing configuration gracefully', async () => {
      mockPaiMortgage.findOne.mockResolvedValue(null);

      const result = await service.generateResponse(
        'Test message',
        'general_inquiry',
        {},
        'Test User',
        'en'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PAI Mortgage configuration not found');
    });

    it('should validate required parameters', () => {
      expect(() => service.calculateLTV(null, 100000)).toThrow();
      expect(() => service.calculateDTI(5000, null)).toThrow();
      expect(() => service.estimateMonthlyPayment(null, 6.5, 30)).toThrow();
    });
  });
});