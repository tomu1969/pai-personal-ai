const { OpenAI } = require('openai');
const BaseAssistant = require('../shared/base-assistant');
const { PaiMortgage } = require('../../models');
const { ASSISTANT_TYPES, RESPONSE_FORMATS } = require('../shared/types');
const logger = require('../../utils/logger');

class PaiMortgageService extends BaseAssistant {
  constructor() {
    super('PAI Mortgage', 'pai_mortgage.md');
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4o-mini';
    this.currentConfig = null;
  }

  /**
   * Get PAI Mortgage configuration from database
   */
  async getConfig() {
    if (!this.currentConfig) {
      const [mortgage] = await PaiMortgage.findOrCreate({
        where: {},
        defaults: {
          enabled: true,
          ownerName: process.env.OWNER_NAME || 'Owner',
          assistantName: 'PAI Mortgage',
          mortgageSettings: {
            maxLoanAmount: 1000000,
            minCreditScore: 580,
            maxDTIRatio: 43,
            supportedLoanTypes: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
            includeCategories: ['qualification', 'rates', 'documents', 'process', 'calculations'],
            enableCalculators: true,
            enablePrequalification: true,
            rateAlerts: false,
          },
          querySettings: {
            defaultLimit: 50,
            maxLimit: 200,
            enableTimeframeFallback: true,
            defaultSearchDepth: 'week',
            mortgageSpecific: true,
          },
        },
      });
      this.currentConfig = mortgage;
    }
    return this.currentConfig;
  }

  /**
   * Parse user intent and extract mortgage-specific entities
   * @param {string} userMessage - The user's message
   * @param {object} context - Additional context
   */
  async parseIntent(userMessage, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      // Use mortgage-specific prompting for intent parsing
      logger.info('PAI Mortgage parsing intent', {
        messageLength: userMessage.length,
        context,
      });

      // Enhanced mortgage-specific intent parsing
      const mortgageEntities = this.extractMortgageEntities(userMessage);
      
      const result = await this.analyzeUserQuery(userMessage, {
        ...context,
        assistantConfig: config,
        mortgageEntities,
        systemPrompt: this.personalizePrompt({
          ownerName: config.ownerName,
          assistantName: config.assistantName,
        }),
      });

      // Update activity tracking
      await this.updateActivity();

      return {
        ...result,
        assistantType: ASSISTANT_TYPES.PAI_MORTGAGE,
        mortgageEntities,
      };

    } catch (error) {
      logger.error('PAI Mortgage failed to parse intent', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract mortgage-specific entities from user message
   * @param {string} userMessage - User's message
   */
  extractMortgageEntities(userMessage) {
    const message = userMessage.toLowerCase();
    const entities = {};

    // Extract loan amount
    const loanAmountMatch = message.match(/(\$?[\d,]+(?:\.\d{2})?)\s*(?:loan|mortgage|borrow)/);
    if (loanAmountMatch) {
      entities.loanAmount = parseFloat(loanAmountMatch[1].replace(/[$,]/g, ''));
    }

    // Extract credit score
    const creditScoreMatch = message.match(/credit\s*score\s*(?:is|of|:)?\s*(\d{3})/);
    if (creditScoreMatch) {
      entities.creditScore = parseInt(creditScoreMatch[1]);
    }

    // Extract DTI ratio
    const dtiMatch = message.match(/(?:dti|debt.to.income)\s*(?:ratio)?\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)\s*%?/);
    if (dtiMatch) {
      entities.dtiRatio = parseFloat(dtiMatch[1]);
    }

    // Extract loan type
    const loanTypes = ['conventional', 'fha', 'va', 'usda', 'jumbo'];
    for (const type of loanTypes) {
      if (message.includes(type)) {
        entities.loanType = type;
        break;
      }
    }

    // Extract down payment
    const downPaymentMatch = message.match(/down\s*payment\s*(?:of|is)?\s*(\$?[\d,]+(?:\.\d{2})?|(\d+(?:\.\d+)?)\s*%)/);
    if (downPaymentMatch) {
      if (downPaymentMatch[1].includes('%')) {
        entities.downPaymentPercent = parseFloat(downPaymentMatch[2]);
      } else {
        entities.downPaymentAmount = parseFloat(downPaymentMatch[1].replace(/[$,]/g, ''));
      }
    }

    return entities;
  }

  /**
   * Analyze user query with mortgage focus
   * @param {string} userMessage - User's message
   * @param {object} context - Context including mortgage entities
   */
  async analyzeUserQuery(userMessage, context = {}) {
    try {
      const prompt = `You are PAI Mortgage, an expert mortgage advisor assistant. Analyze this user query and classify the intent:

User Query: "${userMessage}"

Mortgage Context:
- Max Loan Amount: $${context.assistantConfig?.mortgageSettings?.maxLoanAmount || 1000000}
- Min Credit Score: ${context.assistantConfig?.mortgageSettings?.minCreditScore || 580}
- Max DTI Ratio: ${context.assistantConfig?.mortgageSettings?.maxDTIRatio || 43}%
- Supported Loan Types: ${context.assistantConfig?.mortgageSettings?.supportedLoanTypes?.join(', ') || 'conventional, fha, va, usda, jumbo'}

Detected Entities: ${JSON.stringify(context.mortgageEntities || {})}

Classify the intent as one of:
- qualification_check: User wants to check if they qualify for a mortgage
- rate_inquiry: User asking about current mortgage rates
- calculation_request: User needs help with mortgage calculations
- document_checklist: User needs list of required documents
- loan_comparison: User wants to compare loan types
- process_explanation: User wants to understand the mortgage process
- prequalification: User wants to get pre-qualified
- general_mortgage: General mortgage-related question

Respond with JSON format:
{
  "intent": "intent_name",
  "confidence": 0.95,
  "entities": {...extracted entities...},
  "reasoning": "Brief explanation of classification",
  "mortgageSpecific": true
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      // Clean the response content to extract JSON
      let content = response.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(content);
      return {
        ...result,
        tokensUsed: response.usage.total_tokens,
        success: true
      };

    } catch (error) {
      logger.error('Failed to analyze mortgage query', { error: error.message });
      return {
        intent: 'general_mortgage',
        confidence: 0.5,
        entities: context.mortgageEntities || {},
        reasoning: 'Fallback classification due to parsing error',
        mortgageSpecific: true,
        success: true
      };
    }
  }

  /**
   * Generate mortgage-specific AI response
   * @param {string} userMessage - Original user message
   * @param {string} intent - Parsed intent
   * @param {object} entities - Extracted entities
   * @param {object} context - Additional context
   */
  async generateResponse(userMessage, intent, entities, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      logger.info('PAI Mortgage generating response', {
        intent,
        entities,
      });

      // Generate mortgage-specific response based on intent
      let responseMessage;
      
      switch (intent) {
        case 'qualification_check':
          responseMessage = await this.generateQualificationResponse(entities, context);
          break;
        case 'rate_inquiry':
          responseMessage = await this.generateRateResponse(entities, context);
          break;
        case 'calculation_request':
          responseMessage = await this.generateCalculationResponse(entities, context);
          break;
        case 'document_checklist':
          responseMessage = await this.generateDocumentResponse(entities, context);
          break;
        case 'loan_comparison':
          responseMessage = await this.generateComparisonResponse(entities, context);
          break;
        case 'process_explanation':
          responseMessage = await this.generateProcessResponse(entities, context);
          break;
        case 'prequalification':
          responseMessage = await this.generatePrequalificationResponse(entities, context);
          break;
        default:
          responseMessage = await this.generateGeneralMortgageResponse(userMessage, entities, context);
      }

      // Update activity tracking
      await this.updateActivity();

      return {
        responseMessage,
        assistantType: ASSISTANT_TYPES.PAI_MORTGAGE,
        intent,
        success: true
      };

    } catch (error) {
      logger.error('PAI Mortgage failed to generate response', {
        intent,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Generate qualification response
   */
  async generateQualificationResponse(entities, context) {
    const config = await this.getConfig();
    const settings = config.mortgageSettings;
    
    let response = `Based on your information, let me help you understand your mortgage qualification:\n\n`;
    
    if (entities.creditScore) {
      if (entities.creditScore >= settings.minCreditScore) {
        response += `✅ **Credit Score (${entities.creditScore})**: Meets minimum requirements\n`;
      } else {
        response += `❌ **Credit Score (${entities.creditScore})**: Below minimum ${settings.minCreditScore}\n`;
      }
    }
    
    if (entities.dtiRatio) {
      if (entities.dtiRatio <= settings.maxDTIRatio) {
        response += `✅ **DTI Ratio (${entities.dtiRatio}%)**: Within acceptable range\n`;
      } else {
        response += `❌ **DTI Ratio (${entities.dtiRatio}%)**: Above maximum ${settings.maxDTIRatio}%\n`;
      }
    }
    
    response += `\nTo provide a complete qualification assessment, I'd need:\n`;
    response += `• Credit score (current: ${entities.creditScore || 'not provided'})\n`;
    response += `• Monthly income and debt payments\n`;
    response += `• Down payment amount\n`;
    response += `• Desired loan amount\n\n`;
    response += `Would you like me to walk you through each of these factors?`;
    
    return response;
  }

  /**
   * Generate rate response
   */
  async generateRateResponse(entities, context) {
    return `Current mortgage rates vary based on several factors:\n\n` +
           `**Typical Rate Ranges (as of ${new Date().toLocaleDateString()}):**\n` +
           `• 30-year fixed: 6.5% - 7.5%\n` +
           `• 15-year fixed: 6.0% - 7.0%\n` +
           `• 5/1 ARM: 5.5% - 6.5%\n\n` +
           `**Your rate depends on:**\n` +
           `• Credit score\n` +
           `• Down payment amount\n` +
           `• Loan-to-value ratio\n` +
           `• Debt-to-income ratio\n` +
           `• Loan type (conventional, FHA, VA, etc.)\n\n` +
           `Would you like me to help estimate your specific rate based on your profile?`;
  }

  /**
   * Generate calculation response
   */
  async generateCalculationResponse(entities, context) {
    let response = `I can help you with various mortgage calculations:\n\n`;
    
    if (entities.loanAmount && entities.downPaymentAmount) {
      const ltv = ((entities.loanAmount - entities.downPaymentAmount) / entities.loanAmount * 100).toFixed(1);
      response += `**Your Loan Details:**\n`;
      response += `• Loan Amount: $${entities.loanAmount.toLocaleString()}\n`;
      response += `• Down Payment: $${entities.downPaymentAmount.toLocaleString()}\n`;
      response += `• Loan-to-Value: ${ltv}%\n\n`;
    }
    
    response += `**Available Calculators:**\n`;
    response += `• Monthly payment calculator\n`;
    response += `• Affordability calculator\n`;
    response += `• Refinance calculator\n`;
    response += `• PMI calculator\n`;
    response += `• Amortization schedule\n\n`;
    response += `Which calculation would you like me to help you with?`;
    
    return response;
  }

  /**
   * Generate document checklist response
   */
  async generateDocumentResponse(entities, context) {
    return `Here's your mortgage document checklist:\n\n` +
           `**Required Documents:**\n` +
           `📄 **Income Verification:**\n` +
           `• Last 2 pay stubs\n` +
           `• W-2 forms (2 years)\n` +
           `• Tax returns (2 years)\n` +
           `• Employment verification letter\n\n` +
           `📄 **Asset Documentation:**\n` +
           `• Bank statements (2-3 months)\n` +
           `• Investment account statements\n` +
           `• Retirement account statements\n\n` +
           `📄 **Credit & Debt:**\n` +
           `• Credit report authorization\n` +
           `• Debt statements (credit cards, loans)\n\n` +
           `📄 **Property Documents:**\n` +
           `• Purchase agreement\n` +
           `• Appraisal (ordered by lender)\n` +
           `• Home insurance quote\n\n` +
           `${entities.loanType === 'va' ? '📄 **VA-Specific:**\n• Certificate of Eligibility\n• DD-214\n\n' : ''}` +
           `Would you like me to explain any of these documents in detail?`;
  }

  /**
   * Generate loan comparison response
   */
  async generateComparisonResponse(entities, context) {
    return `Here's a comparison of common loan types:\n\n` +
           `**Conventional Loans:**\n` +
           `• Down payment: 3-20%\n` +
           `• Credit score: 620+\n` +
           `• No upfront mortgage insurance if 20% down\n\n` +
           `**FHA Loans:**\n` +
           `• Down payment: 3.5%\n` +
           `• Credit score: 580+\n` +
           `• Mortgage insurance required\n\n` +
           `**VA Loans:**\n` +
           `• Down payment: 0%\n` +
           `• No mortgage insurance\n` +
           `• Veterans and eligible service members only\n\n` +
           `**USDA Loans:**\n` +
           `• Down payment: 0%\n` +
           `• Rural and suburban areas only\n` +
           `• Income limits apply\n\n` +
           `Based on your situation${entities.creditScore ? ` (credit score: ${entities.creditScore})` : ''}, ` +
           `which loan type interests you most?`;
  }

  /**
   * Generate process explanation response
   */
  async generateProcessResponse(entities, context) {
    return `Here's the mortgage process step-by-step:\n\n` +
           `**1. Pre-qualification (15 minutes)**\n` +
           `• Quick financial review\n` +
           `• Estimated loan amount\n\n` +
           `**2. Pre-approval (3-10 days)**\n` +
           `• Full application and documentation\n` +
           `• Credit check and verification\n` +
           `• Conditional loan commitment\n\n` +
           `**3. House hunting**\n` +
           `• Shop within your budget\n` +
           `• Pre-approval letter helps with offers\n\n` +
           `**4. Purchase agreement**\n` +
           `• Make offer with financing contingency\n` +
           `• Submit to lender immediately\n\n` +
           `**5. Processing (30-45 days)**\n` +
           `• Appraisal and title work\n` +
           `• Final underwriting review\n` +
           `• Clear any conditions\n\n` +
           `**6. Closing**\n` +
           `• Final walkthrough\n` +
           `• Sign documents\n` +
           `• Get keys!\n\n` +
           `What stage are you currently in?`;
  }

  /**
   * Generate prequalification response
   */
  async generatePrequalificationResponse(entities, context) {
    return `Let's get you pre-qualified! I'll need some basic information:\n\n` +
           `**Income Information:**\n` +
           `• Annual gross income\n` +
           `• Employment status and length\n\n` +
           `**Monthly Debts:**\n` +
           `• Credit card payments\n` +
           `• Auto loans\n` +
           `• Student loans\n` +
           `• Other monthly obligations\n\n` +
           `**Assets:**\n` +
           `• Available down payment\n` +
           `• Emergency fund\n\n` +
           `**Credit Information:**\n` +
           `• Approximate credit score\n\n` +
           `**Property Preferences:**\n` +
           `• Desired purchase price range\n` +
           `• Location/area\n\n` +
           `You can share this information, and I'll help estimate your qualification. ` +
           `Would you like to start with your income information?`;
  }

  /**
   * Generate general mortgage response
   */
  async generateGeneralMortgageResponse(userMessage, entities, context) {
    const prompt = `You are PAI Mortgage, an expert mortgage advisor. Provide a helpful, accurate response to this mortgage question:

Question: "${userMessage}"

Context: ${JSON.stringify(entities)}

Provide a comprehensive but concise answer focusing on mortgage qualification, rates, process, or calculations as appropriate. Always offer to help with next steps.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });

    return response.choices[0].message.content;
  }

  /**
   * Process a complete mortgage query
   * @param {string} userMessage - The user's query
   * @param {object} context - Additional context
   */
  async processQuery(userMessage, context = {}) {
    try {
      await this.ensureInitialized();
      const config = await this.getConfig();

      if (!config.enabled) {
        logger.debug('PAI Mortgage is disabled');
        return {
          success: false,
          reason: 'assistant_disabled',
        };
      }

      // Step 1: Parse intent and extract entities
      const intentResult = await this.parseIntent(userMessage, context);
      
      if (!intentResult.success) {
        return intentResult;
      }

      // Step 2: Generate mortgage-specific response
      const responseResult = await this.generateResponse(
        userMessage,
        intentResult.intent,
        intentResult.entities,
        {
          assistantConfig: config,
          ...context
        }
      );

      return {
        success: true,
        intent: intentResult.intent,
        entities: intentResult.entities,
        confidence: intentResult.confidence,
        response: responseResult.responseMessage,
        tokensUsed: (intentResult.tokensUsed || 0) + (responseResult.tokensUsed || 0),
        assistantType: ASSISTANT_TYPES.PAI_MORTGAGE,
        mortgageSpecific: true,
      };

    } catch (error) {
      logger.error('PAI Mortgage failed to process query', {
        userMessage: userMessage.substring(0, 100),
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        assistantType: ASSISTANT_TYPES.PAI_MORTGAGE,
      };
    }
  }

  /**
   * Update activity tracking
   */
  async updateActivity() {
    try {
      await PaiMortgage.increment('qualificationsProcessed', { where: {} });
      await PaiMortgage.update(
        { lastActivity: new Date() },
        { where: {} }
      );
    } catch (error) {
      logger.error('Failed to update PAI Mortgage activity', {
        error: error.message,
      });
    }
  }

  /**
   * Ensure the assistant is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this;
  }

  /**
   * Get assistant statistics
   */
  async getStats() {
    try {
      const config = await this.getConfig();
      return {
        enabled: config.enabled,
        qualificationsProcessed: config.qualificationsProcessed,
        lastActivity: config.lastActivity,
        mortgageSettings: config.mortgageSettings,
        querySettings: config.querySettings,
        assistantType: ASSISTANT_TYPES.PAI_MORTGAGE,
      };
    } catch (error) {
      logger.error('Failed to get PAI Mortgage stats', {
        error: error.message,
      });
      return null;
    }
  }
}

module.exports = PaiMortgageService;