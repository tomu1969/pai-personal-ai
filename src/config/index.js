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
    // PAI Assistant instance configuration
    paiAssistantInstanceId: process.env.PAI_ASSISTANT_INSTANCE_ID || 'pai-assistant',
    paiAssistantWebhookUrl: process.env.PAI_ASSISTANT_WEBHOOK_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}/webhook/pai-assistant`,
    // PAI Mortgage instance configuration
    paiMortgageInstanceId: process.env.PAI_MORTGAGE_INSTANCE_ID || 'pai-mortgage-fresh',
    paiMortgageWebhookUrl: process.env.PAI_MORTGAGE_WEBHOOK_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}/webhook/pai-mortgage`,
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
      || 'Hola {{contact_name}}! Soy PAI, el asistente personal de {{owner_name}}. '
      + '¿En qué puedo ayudarte hoy?',
    ownerName: process.env.OWNER_NAME || 'Assistant Owner',
    summaryIntervalHours: parseInt(process.env.SUMMARY_INTERVAL_HOURS, 10) || 6,
  },
};

module.exports = config;
