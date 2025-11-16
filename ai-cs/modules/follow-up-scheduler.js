/**
 * Follow-up Scheduler Module
 * 
 * Monitors Google Sheets for stale tickets and sends follow-up messages
 * to WhatsApp groups at configurable intervals.
 * 
 * Features:
 * - Configurable check intervals (default: 30 minutes)
 * - Configurable stale threshold (default: 2 hours)
 * - Prevents duplicate follow-ups using Last Updated field
 * - Graceful error handling and recovery
 * - Manual trigger for testing
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Active scheduler instances
 * @type {Map<string, NodeJS.Timeout>}
 */
const activeSchedulers = new Map();

/**
 * Follow-up Scheduler Module
 */
module.exports = {
  /**
   * Start the follow-up scheduler
   * @param {Object} config - Scheduler configuration
   * @param {number} config.intervalMinutes - How often to check for stale tickets (default: 30)
   * @param {number} config.staleThresholdHours - Hours after which tickets are considered stale (default: 2)
   * @param {Function} config.sheetsService - Google Sheets service instance
   * @param {Function} config.messageSender - WhatsApp message sender function
   * @param {Function} [config.logger] - Optional logger function
   * @returns {Object} schedulerInstance with id and stop method
   */
  start(config) {
    const {
      intervalMinutes = 30,
      staleThresholdHours = 2,
      sheetsService,
      messageSender,
      logger = console.log
    } = config;

    if (!sheetsService || !messageSender) {
      throw new Error('sheetsService and messageSender are required');
    }

    const schedulerId = uuidv4();
    
    logger(`[Follow-up Scheduler] Starting scheduler ${schedulerId} with ${intervalMinutes}min interval, ${staleThresholdHours}h stale threshold`);

    // Process stale tickets immediately on start
    this.processStaleTickets(sheetsService, messageSender, staleThresholdHours, logger)
      .catch(error => logger(`[Follow-up Scheduler] Initial processing error: ${error.message}`));

    // Set up recurring scheduler
    const intervalId = setInterval(async () => {
      try {
        await this.processStaleTickets(sheetsService, messageSender, staleThresholdHours, logger);
      } catch (error) {
        logger(`[Follow-up Scheduler] Scheduled processing error: ${error.message}`);
      }
    }, intervalMinutes * 60 * 1000);

    // Store the interval for cleanup
    activeSchedulers.set(schedulerId, intervalId);

    const schedulerInstance = {
      id: schedulerId,
      intervalMinutes,
      staleThresholdHours,
      startTime: new Date().toISOString(),
      stop: () => this.stop(schedulerId, logger)
    };

    return schedulerInstance;
  },

  /**
   * Stop a specific scheduler instance
   * @param {string} schedulerId - The scheduler ID to stop
   * @param {Function} [logger] - Optional logger function
   * @returns {boolean} True if stopped successfully
   */
  stop(schedulerId, logger = console.log) {
    const intervalId = activeSchedulers.get(schedulerId);
    
    if (!intervalId) {
      logger(`[Follow-up Scheduler] Scheduler ${schedulerId} not found`);
      return false;
    }

    clearInterval(intervalId);
    activeSchedulers.delete(schedulerId);
    
    logger(`[Follow-up Scheduler] Stopped scheduler ${schedulerId}`);
    return true;
  },

  /**
   * Stop all active schedulers
   * @param {Function} [logger] - Optional logger function
   * @returns {number} Number of schedulers stopped
   */
  stopAll(logger = console.log) {
    const count = activeSchedulers.size;
    
    for (const [schedulerId, intervalId] of activeSchedulers) {
      clearInterval(intervalId);
      logger(`[Follow-up Scheduler] Stopped scheduler ${schedulerId}`);
    }
    
    activeSchedulers.clear();
    return count;
  },

  /**
   * Process stale tickets - core business logic
   * @param {Object} sheetsService - Google Sheets service instance
   * @param {Function} messageSender - WhatsApp message sender function
   * @param {number} [staleThresholdHours=2] - Hours after which tickets are stale
   * @param {Function} [logger] - Optional logger function
   * @returns {Promise<Object>} Processing results
   */
  async processStaleTickets(sheetsService, messageSender, staleThresholdHours = 2, logger = console.log) {
    const startTime = Date.now();
    const results = {
      processed: 0,
      errors: [],
      staleTickets: [],
      followUpsSent: 0
    };

    try {
      logger('[Follow-up Scheduler] Starting stale ticket processing...');

      // Get stale tickets from Google Sheets
      const staleTickets = await sheetsService.getStaleTickets(staleThresholdHours);
      results.staleTickets = staleTickets;

      logger(`[Follow-up Scheduler] Found ${staleTickets.length} stale tickets`);

      if (staleTickets.length === 0) {
        logger('[Follow-up Scheduler] No stale tickets found');
        return results;
      }

      // Process each stale ticket
      for (const ticket of staleTickets) {
        try {
          results.processed++;

          // Check if follow-up was already sent recently (within last hour)
          const lastUpdated = new Date(ticket.lastUpdated || ticket.timestamp);
          const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
          
          if (lastUpdated > oneHourAgo) {
            logger(`[Follow-up Scheduler] Skipping ticket ${ticket.ticketId} - follow-up sent recently`);
            continue;
          }

          // Generate follow-up message
          const followUpMessage = this.generateFollowUpMessage(ticket);

          // Send follow-up message to WhatsApp group
          const messageResult = await messageSender({
            groupId: ticket.groupId,
            message: followUpMessage,
            ticketId: ticket.ticketId
          });

          if (messageResult.success) {
            // Update Last Updated field in Google Sheets
            await sheetsService.updateTicketStatus(
              ticket.ticketId,
              ticket.status || 'open', // Keep existing status
              `Follow-up sent at ${new Date().toISOString()}`
            );

            results.followUpsSent++;
            logger(`[Follow-up Scheduler] Sent follow-up for ticket ${ticket.ticketId}`);
          } else {
            throw new Error(`Failed to send message: ${messageResult.error}`);
          }

        } catch (error) {
          const errorMsg = `Ticket ${ticket.ticketId}: ${error.message}`;
          results.errors.push(errorMsg);
          logger(`[Follow-up Scheduler] Error processing ticket: ${errorMsg}`);
        }
      }

      const duration = Date.now() - startTime;
      logger(`[Follow-up Scheduler] Completed processing in ${duration}ms. Sent ${results.followUpsSent} follow-ups.`);

    } catch (error) {
      const errorMsg = `Failed to get stale tickets: ${error.message}`;
      results.errors.push(errorMsg);
      logger(`[Follow-up Scheduler] Critical error: ${errorMsg}`);
    }

    return results;
  },

  /**
   * Generate follow-up message for a stale ticket
   * @param {Object} ticket - Ticket object from Google Sheets
   * @param {string} ticket.ticketId - Unique ticket identifier
   * @param {string} ticket.customer - Customer name
   * @param {string} ticket.issue - Issue description
   * @param {string} ticket.priority - Ticket priority (low/medium/high)
   * @param {string} ticket.timestamp - When ticket was created
   * @returns {string} Follow-up message text
   */
  generateFollowUpMessage(ticket) {
    const { ticketId, customer, issue, priority } = ticket;
    
    // Calculate how long the ticket has been open
    const createdTime = new Date(ticket.timestamp);
    const hoursOpen = Math.floor((Date.now() - createdTime.getTime()) / (1000 * 60 * 60));
    
    // Priority-based message urgency
    const urgencyText = {
      high: '🔴 URGENT',
      medium: '🟡 FOLLOW-UP',
      low: '🟢 REMINDER'
    }[priority?.toLowerCase()] || '🟡 FOLLOW-UP';

    // Customer-specific addressing
    const customerText = customer && customer !== 'Unknown' 
      ? ` for ${customer}` 
      : '';

    const message = `${urgencyText} - Ticket ${ticketId}

📋 Issue${customerText}: ${issue}
⏰ Open for: ${hoursOpen} hours
🆔 Ticket ID: ${ticketId}

Please provide an update on the status of this ticket. Reply with:
• "T${ticketId} in progress" if working on it
• "T${ticketId} resolved" if completed
• "T${ticketId} escalated" if needs escalation

Thank you! 🙏`;

    return message;
  },

  /**
   * Manual trigger for testing specific ticket follow-up
   * @param {string} ticketId - Ticket ID to send follow-up for
   * @param {Function} messageSender - WhatsApp message sender function
   * @param {Object} sheetsService - Google Sheets service instance
   * @param {Function} [logger] - Optional logger function
   * @returns {Promise<Object>} Trigger result
   */
  async triggerFollowUp(ticketId, messageSender, sheetsService, logger = console.log) {
    try {
      logger(`[Follow-up Scheduler] Manual trigger for ticket ${ticketId}`);

      // Get ticket details from sheets
      const openTickets = await sheetsService.getOpenTickets();
      const ticket = openTickets.find(t => t.ticketId === ticketId);

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found or not open`);
      }

      // Generate and send follow-up message
      const followUpMessage = this.generateFollowUpMessage(ticket);
      
      const messageResult = await messageSender({
        groupId: ticket.groupId,
        message: followUpMessage,
        ticketId: ticket.ticketId
      });

      if (messageResult.success) {
        // Update Last Updated field
        await sheetsService.updateTicketStatus(
          ticket.ticketId,
          ticket.status || 'open',
          `Manual follow-up sent at ${new Date().toISOString()}`
        );

        logger(`[Follow-up Scheduler] Manual follow-up sent for ticket ${ticketId}`);
        return { success: true, ticketId, message: followUpMessage };
      } else {
        throw new Error(`Failed to send message: ${messageResult.error}`);
      }

    } catch (error) {
      logger(`[Follow-up Scheduler] Manual trigger error: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get status of all active schedulers
   * @returns {Array} Array of scheduler status objects
   */
  getActiveSchedulers() {
    return Array.from(activeSchedulers.keys()).map(id => ({
      id,
      active: true,
      startTime: new Date().toISOString() // This would be stored per scheduler in real implementation
    }));
  },

  /**
   * Health check for the scheduler module
   * @returns {Object} Health status
   */
  healthCheck() {
    return {
      module: 'follow-up-scheduler',
      status: 'healthy',
      activeSchedulers: activeSchedulers.size,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
  }
};