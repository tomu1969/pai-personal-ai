/**
 * @file ticket-detector.js
 * @description OpenAI-powered customer service ticket detection and analysis module
 * @module ai-cs/modules/ticket-detector
 * @requires ../../src/services/ai/openai - OpenAI API service
 * @requires ../../src/utils/logger - Logging utility
 * @exports detectTicket, detectStatusUpdate, generateFollowUpMessage
 * @author CS Ticket System
 * @since November 2025
 */

const openai = require('../../src/services/ai/openai');
const logger = require('../../src/utils/logger');

/**
 * Customer Service Ticket Detection Module
 * 
 * Provides AI-powered analysis of WhatsApp messages to:
 * - Detect customer service tickets automatically
 * - Extract ticket metadata (customer, issue, priority, category)
 * - Identify status updates for existing tickets
 * - Generate follow-up messages for stale tickets
 * 
 * Features:
 * - Uses GPT-4o-mini for cost-efficient processing
 * - Multi-language support with auto-detection
 * - Structured JSON responses for reliable parsing
 * - Graceful error handling with fallbacks
 * - 5-second timeout for real-time performance
 * 
 * @example
 * const ticketDetector = require('./ticket-detector');
 * const result = await ticketDetector.detectTicket('I cannot login to my account', 'John Smith');
 */

/**
 * Main ticket detection function
 * Analyzes WhatsApp message content to determine if it represents a customer service ticket
 * 
 * @param {string} messageText - The WhatsApp message content to analyze
 * @param {string} senderName - Name of the message sender
 * @param {object} options - Optional configuration
 * @param {string} options.groupName - Name of the WhatsApp group (optional)
 * @param {string} options.language - Expected language (auto-detected if not provided)
 * @returns {Promise<object>} Ticket detection result
 * @returns {boolean} returns.isTicket - Whether the message represents a ticket
 * @returns {object} returns.ticketData - Extracted ticket information (if isTicket is true)
 * @returns {string} returns.ticketData.customer - Customer name
 * @returns {string} returns.ticketData.issue - Brief description of the issue
 * @returns {string} returns.ticketData.priority - Priority level: 'low' | 'medium' | 'high'
 * @returns {string} returns.ticketData.category - Issue category: 'technical' | 'billing' | 'general' | 'other'
 * 
 * @example
 * const result = await detectTicket('Help! I cannot access my account #12345', 'Maria Garcia');
 * // Returns: {
 * //   isTicket: true,
 * //   ticketData: {
 * //     customer: 'Maria Garcia',
 * //     issue: 'Cannot access account #12345',
 * //     priority: 'high',
 * //     category: 'technical'
 * //   }
 * // }
 */
async function detectTicket(messageText, senderName, options = {}) {
  if (!messageText || typeof messageText !== 'string') {
    logger.warn('Invalid message text provided to ticket detector', { messageText, senderName });
    return { isTicket: false };
  }

  if (!openai.isEnabled()) {
    logger.warn('OpenAI service not available for ticket detection');
    return { isTicket: false };
  }

  try {
    logger.debug('Analyzing message for ticket detection', {
      messageLength: messageText.length,
      senderName,
      groupName: options.groupName
    });

    // Build the ticket detection prompt
    const systemPrompt = buildTicketDetectionPrompt();
    const userPrompt = formatTicketDetectionInput(messageText, senderName, options);

    // Call OpenAI API with timeout
    const response = await Promise.race([
      callOpenAIForTicketDetection(systemPrompt, userPrompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ticket detection timeout')), 5000)
      )
    ]);

    // Parse and validate the response
    const result = parseTicketDetectionResponse(response);
    
    logger.info('Ticket detection completed', {
      senderName,
      isTicket: result.isTicket,
      priority: result.ticketData?.priority,
      category: result.ticketData?.category
    });

    return result;

  } catch (error) {
    logger.error('Ticket detection failed', {
      error: error.message,
      senderName,
      messageLength: messageText.length
    });

    // Return safe fallback
    return { isTicket: false };
  }
}

/**
 * Detect status updates for existing tickets
 * Analyzes messages that might contain updates to previously logged tickets
 * 
 * @param {string} messageText - Message content to analyze
 * @param {string} ticketId - Optional ticket ID being referenced
 * @param {object} options - Optional configuration
 * @returns {Promise<object>} Status update detection result
 * @returns {boolean} returns.isUpdate - Whether the message contains a status update
 * @returns {string} returns.newStatus - New status: 'in_progress' | 'resolved' | 'escalated'
 * @returns {string} returns.updateNotes - Additional notes about the update
 * @returns {string} returns.ticketId - Ticket ID being updated (extracted or provided)
 * 
 * @example
 * const result = await detectStatusUpdate('Ticket T123 has been resolved', 'T123');
 * // Returns: {
 * //   isUpdate: true,
 * //   newStatus: 'resolved',
 * //   updateNotes: 'Issue has been resolved',
 * //   ticketId: 'T123'
 * // }
 */
async function detectStatusUpdate(messageText, ticketId = null, options = {}) {
  if (!messageText || typeof messageText !== 'string') {
    logger.warn('Invalid message text provided to status update detector', { messageText, ticketId });
    return { isUpdate: false };
  }

  if (!openai.isEnabled()) {
    logger.warn('OpenAI service not available for status update detection');
    return { isUpdate: false };
  }

  try {
    logger.debug('Analyzing message for status update', {
      messageLength: messageText.length,
      ticketId
    });

    // Build the status update detection prompt
    const systemPrompt = buildStatusUpdatePrompt();
    const userPrompt = formatStatusUpdateInput(messageText, ticketId, options);

    // Call OpenAI API with timeout
    const response = await Promise.race([
      callOpenAIForStatusUpdate(systemPrompt, userPrompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Status update detection timeout')), 5000)
      )
    ]);

    // Parse and validate the response
    const result = parseStatusUpdateResponse(response);
    
    logger.info('Status update detection completed', {
      ticketId,
      isUpdate: result.isUpdate,
      newStatus: result.newStatus
    });

    return result;

  } catch (error) {
    logger.error('Status update detection failed', {
      error: error.message,
      ticketId,
      messageLength: messageText.length
    });

    // Return safe fallback
    return { isUpdate: false };
  }
}

/**
 * Generate follow-up message for stale tickets
 * Creates contextual follow-up messages to send to WhatsApp groups for tickets that haven't been updated
 * 
 * @param {object} ticket - Ticket information
 * @param {string} ticket.id - Ticket ID
 * @param {string} ticket.customer - Customer name
 * @param {string} ticket.issue - Issue description
 * @param {string} ticket.priority - Ticket priority
 * @param {string} ticket.groupName - WhatsApp group name
 * @param {Date} ticket.createdAt - When ticket was created
 * @param {object} options - Optional configuration
 * @param {string} options.language - Preferred language for follow-up
 * @param {number} options.hoursStale - How many hours the ticket has been stale
 * @returns {string} Generated follow-up message
 * 
 * @example
 * const message = generateFollowUpMessage({
 *   id: 'T123',
 *   customer: 'John Smith', 
 *   issue: 'Cannot access account',
 *   priority: 'high',
 *   groupName: 'Customer Support',
 *   createdAt: new Date('2024-11-02T10:00:00Z')
 * });
 * // Returns: "Hi team, ticket T123 from John Smith (Cannot access account) is still open after 2 hours. Can someone please provide an update? Priority: high"
 */
function generateFollowUpMessage(ticket, options = {}) {
  if (!ticket || !ticket.id || !ticket.customer || !ticket.issue) {
    logger.warn('Invalid ticket data provided for follow-up generation', { ticket });
    return 'There is an open customer service ticket that needs attention.';
  }

  try {
    const language = options.language || detectLanguageFromTicket(ticket);
    const hoursStale = options.hoursStale || calculateHoursStale(ticket.createdAt);
    
    logger.debug('Generating follow-up message', {
      ticketId: ticket.id,
      customer: ticket.customer,
      language,
      hoursStale
    });

    if (language === 'spanish') {
      return generateSpanishFollowUp(ticket, hoursStale);
    } else {
      return generateEnglishFollowUp(ticket, hoursStale);
    }

  } catch (error) {
    logger.error('Follow-up message generation failed', {
      error: error.message,
      ticketId: ticket.id
    });

    // Return safe fallback
    return `Ticket ${ticket.id} from ${ticket.customer} needs attention.`;
  }
}

// Helper Functions

/**
 * Build the system prompt for ticket detection
 */
function buildTicketDetectionPrompt() {
  return `You are a CS ticket detector. Analyze WhatsApp messages to determine if they represent customer service tickets.

Look for: complaints, issues, problems, requests for help, bug reports, technical difficulties, billing questions, account problems, or any request for assistance.

DO NOT consider these as tickets: casual greetings, thank you messages, confirmations, small talk, or general conversation.

Return ONLY valid JSON in this exact format:
{
  "isTicket": boolean,
  "customer": "extracted customer name or sender name",
  "issue": "brief description of the problem (max 100 chars)",
  "priority": "low/medium/high based on urgency indicators",
  "category": "technical/billing/general/other"
}

Priority guidelines:
- HIGH: urgent language, system down, cannot access, critical business impact
- MEDIUM: problems affecting work, account issues, moderate urgency
- LOW: general questions, minor issues, feature requests

Category guidelines:
- technical: login issues, system errors, app problems, technical bugs
- billing: payment issues, invoice questions, account charges
- general: general inquiries, information requests, policy questions
- other: anything that doesn't fit the above categories`;
}

/**
 * Build the system prompt for status update detection
 */
function buildStatusUpdatePrompt() {
  return `You are a ticket status update detector. Analyze messages to determine if they contain updates about existing customer service tickets.

Look for: status changes, progress updates, resolution notifications, escalation notices, or any communication about ticket progress.

Return ONLY valid JSON in this exact format:
{
  "isUpdate": boolean,
  "newStatus": "in_progress/resolved/escalated",
  "updateNotes": "brief description of the update",
  "ticketId": "extracted ticket ID or null"
}

Status guidelines:
- in_progress: work has started, team is investigating, progress being made
- resolved: issue fixed, problem solved, customer satisfied
- escalated: passed to higher level, requires manager attention, complex issue

Ticket ID extraction: Look for patterns like "T123", "ticket 123", "#123", or similar identifiers.`;
}

/**
 * Format input for ticket detection
 */
function formatTicketDetectionInput(messageText, senderName, options) {
  return `Message: "${messageText}"
Sender: ${senderName}
${options.groupName ? `Group: ${options.groupName}` : ''}

Analyze this message and return the JSON response.`;
}

/**
 * Format input for status update detection
 */
function formatStatusUpdateInput(messageText, ticketId, options) {
  return `Message: "${messageText}"
${ticketId ? `Related Ticket: ${ticketId}` : ''}

Analyze this message for ticket status updates and return the JSON response.`;
}

/**
 * Call OpenAI API for ticket detection
 */
async function callOpenAIForTicketDetection(systemPrompt, userPrompt) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  // Use the existing OpenAI service's client directly
  const response = await openai.client.post('/chat/completions', {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.1, // Low temperature for consistent structured output
    max_completion_tokens: 150,
    response_format: { type: 'json_object' }
  });

  return response.data.choices[0]?.message?.content;
}

/**
 * Call OpenAI API for status update detection
 */
async function callOpenAIForStatusUpdate(systemPrompt, userPrompt) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const response = await openai.client.post('/chat/completions', {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.1,
    max_completion_tokens: 100,
    response_format: { type: 'json_object' }
  });

  return response.data.choices[0]?.message?.content;
}

/**
 * Parse and validate ticket detection response
 */
function parseTicketDetectionResponse(response) {
  try {
    const parsed = JSON.parse(response);
    
    // Validate required fields
    if (typeof parsed.isTicket !== 'boolean') {
      throw new Error('Invalid isTicket field');
    }

    if (!parsed.isTicket) {
      return { isTicket: false };
    }

    // Validate ticket data
    const ticketData = {
      customer: String(parsed.customer || 'Unknown'),
      issue: String(parsed.issue || 'Issue description not available').substring(0, 100),
      priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
      category: ['technical', 'billing', 'general', 'other'].includes(parsed.category) ? parsed.category : 'other'
    };

    return {
      isTicket: true,
      ticketData
    };

  } catch (error) {
    logger.error('Failed to parse ticket detection response', { error: error.message, response });
    return { isTicket: false };
  }
}

/**
 * Parse and validate status update response
 */
function parseStatusUpdateResponse(response) {
  try {
    const parsed = JSON.parse(response);
    
    if (typeof parsed.isUpdate !== 'boolean') {
      throw new Error('Invalid isUpdate field');
    }

    if (!parsed.isUpdate) {
      return { isUpdate: false };
    }

    return {
      isUpdate: true,
      newStatus: ['in_progress', 'resolved', 'escalated'].includes(parsed.newStatus) ? parsed.newStatus : 'in_progress',
      updateNotes: String(parsed.updateNotes || '').substring(0, 200),
      ticketId: parsed.ticketId || null
    };

  } catch (error) {
    logger.error('Failed to parse status update response', { error: error.message, response });
    return { isUpdate: false };
  }
}

/**
 * Detect language from ticket data
 */
function detectLanguageFromTicket(ticket) {
  const content = `${ticket.issue} ${ticket.customer}`.toLowerCase();
  const spanishIndicators = /[ñáéíóúü¿¡]|hola|gracias|problema|ayuda|error|cuenta|acceso/i;
  return spanishIndicators.test(content) ? 'spanish' : 'english';
}

/**
 * Calculate hours since ticket creation
 */
function calculateHoursStale(createdAt) {
  if (!createdAt) return 0;
  const now = new Date();
  const created = new Date(createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60));
}

/**
 * Generate English follow-up message
 */
function generateEnglishFollowUp(ticket, hoursStale) {
  const priorityText = ticket.priority === 'high' ? ' 🔴 HIGH PRIORITY' : '';
  const timeText = hoursStale > 1 ? `${hoursStale} hours` : 'over an hour';
  
  return `Hi team, ticket ${ticket.id} from ${ticket.customer} (${ticket.issue}) is still open after ${timeText}. Can someone please provide an update?${priorityText}`;
}

/**
 * Generate Spanish follow-up message
 */
function generateSpanishFollowUp(ticket, hoursStale) {
  const priorityText = ticket.priority === 'high' ? ' 🔴 ALTA PRIORIDAD' : '';
  const timeText = hoursStale > 1 ? `${hoursStale} horas` : 'más de una hora';
  
  return `Hola equipo, el ticket ${ticket.id} de ${ticket.customer} (${ticket.issue}) sigue abierto después de ${timeText}. ¿Alguien puede proporcionar una actualización?${priorityText}`;
}

// Export the main functions
module.exports = {
  detectTicket,
  detectStatusUpdate,
  generateFollowUpMessage
};