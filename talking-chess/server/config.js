/**
 * Server Configuration - Talking Chess Chat Mentor
 * Loads and validates environment variables
 */

require('dotenv').config({ path: '../.env' });

/**
 * Validates that required environment variables are set
 * @param {string} varName - Environment variable name
 * @param {*} value - Environment variable value
 * @throws {Error} If required variable is missing
 */
function validateRequired(varName, value) {
  if (!value) {
    throw new Error(`${varName} is required`);
  }
}

// Load and validate configuration
const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  
  // AI Provider Configuration
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  
  // Chat Configuration
  maxChatHistory: parseInt(process.env.MAX_CHAT_HISTORY) || 10,
  responseTimeoutMs: parseInt(process.env.RESPONSE_TIMEOUT_MS) || 5000,
  
  // Security
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3333',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required environment variables
if (config.nodeEnv !== 'test') {
  validateRequired('OPENAI_API_KEY', config.openaiApiKey);
}

module.exports = config;