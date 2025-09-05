/**
 * Shared types and constants for assistants
 */

const ASSISTANT_TYPES = {
  PAI_RESPONDER: 'pai_responder',
  PAI_ASSISTANT: 'pai_assistant',
};

const MESSAGE_TYPES = {
  TEXT: 'conversation',
  EXTENDED_TEXT: 'extendedTextMessage',
  IMAGE: 'imageMessage',
  DOCUMENT: 'documentMessage',
  AUDIO: 'audioMessage',
  VIDEO: 'videoMessage',
  STICKER: 'stickerMessage',
  LOCATION: 'locationMessage',
  CONTACT: 'contactMessage',
  REACTION: 'reactionMessage',
};

const RESPONSE_FORMATS = {
  CHRONOLOGICAL: 'chronological',
  DETAILED: 'detailed',
  SUMMARY: 'summary',
};

const PRIORITIES = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const CATEGORIES = {
  PERSONAL: 'personal',
  BUSINESS: 'business',
  SUPPORT: 'support',
  SALES: 'sales',
  INQUIRY: 'inquiry',
  SPAM: 'spam',
};

const TIMEFRAME_UNITS = {
  MINUTES: 'minutes',
  HOURS: 'hours',
  DAYS: 'days',
  WEEKS: 'weeks',
  MONTHS: 'months',
};

const RELATIVE_TIMES = {
  NOW: 'now',
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  PAST: 'past',
  FUTURE: 'future',
};

module.exports = {
  ASSISTANT_TYPES,
  MESSAGE_TYPES,
  RESPONSE_FORMATS,
  PRIORITIES,
  CATEGORIES,
  TIMEFRAME_UNITS,
  RELATIVE_TIMES,
};