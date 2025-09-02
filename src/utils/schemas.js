const { Joi } = require('../middleware/validation');

const webhookSetupSchema = Joi.object({
  webhookUrl: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).optional().default(['messages.upsert']),
});

const assistantToggleSchema = Joi.object({
  enabled: Joi.boolean().required(),
});

const sendMessageSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  message: Joi.string().min(1).max(4096).required(),
  options: Joi.object().optional(),
});

const conversationQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'waiting', 'resolved', 'escalated', 'archived').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  category: Joi.string().valid('inquiry', 'support', 'sales', 'personal', 'spam', 'other').optional(),
  limit: Joi.number().integer().min(1).max(100)
    .optional()
    .default(20),
  offset: Joi.number().integer().min(0).optional()
    .default(0),
  contactId: Joi.string().uuid().optional(),
});

const summaryQuerySchema = Joi.object({
  period: Joi.string().valid('hour', 'day', 'week', 'month').optional().default('day'),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  status: Joi.string().valid('active', 'waiting', 'resolved', 'escalated', 'archived').optional(),
});

const contactUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  category: Joi.string().valid('personal', 'business', 'spam', 'unknown').optional(),
  isBlocked: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

const conversationUpdateSchema = Joi.object({
  status: Joi.string().valid('active', 'waiting', 'resolved', 'escalated', 'archived').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  category: Joi.string().valid('inquiry', 'support', 'sales', 'personal', 'spam', 'other').optional(),
  summary: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  isAssistantEnabled: Joi.boolean().optional(),
});

module.exports = {
  webhookSetupSchema,
  assistantToggleSchema,
  sendMessageSchema,
  conversationQuerySchema,
  summaryQuerySchema,
  contactUpdateSchema,
  conversationUpdateSchema,
};
