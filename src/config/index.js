require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY,
    instanceId: process.env.EVOLUTION_INSTANCE_ID,
    webhookUrl: process.env.WEBHOOK_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
  assistant: {
    defaultStatus: process.env.DEFAULT_ASSISTANT_STATUS === 'true',
    autoResponseTemplate: process.env.AUTO_RESPONSE_TEMPLATE
      || 'Hi! This is {{owner_name}}\'s personal assistant. I\'m currently helping filter messages. '
      + 'What do you need assistance with?',
    ownerName: process.env.OWNER_NAME || 'Assistant Owner',
    summaryIntervalHours: parseInt(process.env.SUMMARY_INTERVAL_HOURS, 10) || 6,
  },
};

module.exports = config;
