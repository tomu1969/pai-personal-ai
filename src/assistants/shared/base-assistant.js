const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class BaseAssistant {
  constructor(name, promptFile) {
    this.name = name;
    this.promptFile = promptFile;
    this.systemPrompt = null;
    this.isInitialized = false;
  }

  /**
   * Load system prompt from file or database
   * @param {object} config - Assistant configuration from database
   */
  async loadSystemPrompt(config = {}) {
    try {
      // Use custom prompt from database if available
      if (config.systemPrompt) {
        this.systemPrompt = config.systemPrompt;
        logger.debug(`Using custom system prompt from database for ${this.name}`);
        return;
      }

      // Fall back to prompt file
      const promptPath = path.join(__dirname, '../../../prompts', this.promptFile);
      if (fs.existsSync(promptPath)) {
        this.systemPrompt = fs.readFileSync(promptPath, 'utf8').trim();
        logger.debug(`Loaded system prompt from file ${this.promptFile} for ${this.name}`);
      } else {
        // Use basic fallback prompt
        this.systemPrompt = `You are ${this.name}, a helpful AI assistant.`;
        logger.warn(`No prompt file found at ${promptPath}, using fallback prompt for ${this.name}`);
      }
    } catch (error) {
      logger.error(`Failed to load system prompt for ${this.name}`, {
        error: error.message,
        promptFile: this.promptFile,
      });
      this.systemPrompt = `You are ${this.name}, a helpful AI assistant.`;
    }
  }

  /**
   * Replace template variables in prompt
   * @param {object} variables - Variables to replace
   */
  personalizePrompt(variables = {}) {
    if (!this.systemPrompt) return '';

    let personalizedPrompt = this.systemPrompt;

    // Common template variables
    const replacements = {
      '{{owner_name}}': variables.ownerName || 'the owner',
      '{{assistant_name}}': variables.assistantName || this.name,
      '{{current_date}}': new Date().toLocaleDateString(),
      '{{current_time}}': new Date().toLocaleTimeString(),
    };

    // Apply replacements
    Object.entries(replacements).forEach(([placeholder, value]) => {
      personalizedPrompt = personalizedPrompt.replace(new RegExp(placeholder, 'g'), value);
    });

    return personalizedPrompt;
  }

  /**
   * Update activity tracking
   */
  async updateActivity() {
    // Override in child classes to update specific models
    logger.debug(`Activity updated for ${this.name}`);
  }

  /**
   * Get configuration
   */
  async getConfig() {
    // Override in child classes to return specific model data
    throw new Error(`getConfig must be implemented in ${this.name} child class`);
  }

  /**
   * Check if assistant is enabled
   */
  async isEnabled() {
    try {
      const config = await this.getConfig();
      return config && config.enabled;
    } catch (error) {
      logger.error(`Failed to check if ${this.name} is enabled`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Initialize the assistant
   */
  async initialize() {
    try {
      const config = await this.getConfig();
      await this.loadSystemPrompt(config);
      this.isInitialized = true;
      
      logger.info(`${this.name} initialized successfully`, {
        enabled: config?.enabled,
        hasCustomPrompt: !!config?.systemPrompt,
      });
    } catch (error) {
      logger.error(`Failed to initialize ${this.name}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

module.exports = BaseAssistant;