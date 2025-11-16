/**
 * @file index.js
 * @description Main orchestrator for CS Ticket System - Module E Integration
 * @module ai-cs
 * @requires ./modules/evolution-setup
 * @requires ./modules/ticket-detector
 * @requires ./modules/sheets-service
 * @requires ./modules/follow-up-scheduler
 * @requires ../src/services/whatsapp/evolutionMultiInstance
 * @requires ../src/utils/logger
 * @exports initialize, shutdown, getHealthStatus, sendGroupMessage
 * @author PAI System - CS Module E (Integration & Orchestration)
 * @since November 2025
 */

const logger = require('../src/utils/logger');
const evolutionSetup = require('./modules/evolution-setup');
const ticketDetector = require('./modules/ticket-detector');
const SheetsService = require('./modules/sheets-service');
const followUpScheduler = require('./modules/follow-up-scheduler');
const groupsManager = require('./modules/groups-manager');

/**
 * CS Ticket System Orchestrator
 * Manages integration between all CS modules and provides centralized control
 * 
 * @class CSTicketOrchestrator
 */
class CSTicketOrchestrator {
  constructor() {
    this.initialized = false;
    this.services = {
      evolution: null,
      ticketDetector: null,
      sheetsService: null,
      followUpScheduler: null,
      groupsManager: null
    };
    this.config = {
      instanceId: process.env.CS_INSTANCE_ID || 'cs-ticket-monitor',
      webhookUrl: process.env.CS_WEBHOOK_URL || 'http://localhost:3000/webhook/cs-tickets',
      checkIntervalMinutes: parseInt(process.env.CS_CHECK_INTERVAL_MINUTES) || 30,
      staleThresholdHours: parseInt(process.env.CS_STALE_THRESHOLD_HOURS) || 2,
      sheetId: process.env.CS_SHEET_ID,
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    };
    this.stats = {
      startTime: null,
      messagesProcessed: 0,
      ticketsCreated: 0,
      followUpsSent: 0,
      errors: 0
    };
  }

  /**
   * Initialize the CS Ticket System
   * Sets up all modules and starts the follow-up scheduler
   * 
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      logger.info('Starting CS Ticket System initialization', {
        instanceId: this.config.instanceId,
        config: {
          webhookUrl: this.config.webhookUrl,
          checkIntervalMinutes: this.config.checkIntervalMinutes,
          staleThresholdHours: this.config.staleThresholdHours,
          hasSheetId: !!this.config.sheetId,
          hasServiceAccount: !!this.config.serviceAccountKey
        }
      });

      // Validate required configuration
      const configErrors = this.validateConfiguration();
      if (configErrors.length > 0) {
        const error = new Error(`Configuration validation failed: ${configErrors.join(', ')}`);
        logger.error('CS initialization failed - configuration errors', {
          errors: configErrors,
          config: this.config
        });
        throw error;
      }

      // Initialize Google Sheets service
      logger.info('Initializing Google Sheets service');
      const sheetsService = new SheetsService();
      const initResult = await sheetsService.initialize(this.config.serviceAccountKey, this.config.sheetId);
      
      if (!initResult.success) {
        throw new Error(`Sheets service initialization failed: ${initResult.error}`);
      }
      
      this.services.sheetsService = sheetsService;
      logger.info('Google Sheets service initialized successfully');

      // Initialize Groups Manager with database connection
      logger.info('Initializing Groups Manager');
      const { sequelize } = require('../src/models');
      const groupsResult = await groupsManager.initialize(sequelize);
      
      if (!groupsResult.success) {
        throw new Error(`Groups Manager initialization failed: ${groupsResult.error}`);
      }
      
      this.services.groupsManager = groupsManager;
      logger.info('Groups Manager initialized successfully');

      // Initialize ticket detector (already loaded, just verify)
      this.services.ticketDetector = ticketDetector;
      logger.info('Ticket detector service loaded');

      // Register Evolution instance
      logger.info('Registering CS Evolution instance');
      const evolutionService = require('../src/services/whatsapp/evolutionMultiInstance');
      const evolutionResult = await evolutionSetup.registerCSInstance(evolutionService);
      if (!evolutionResult.success) {
        throw new Error(`Failed to register Evolution instance: ${evolutionResult.error}`);
      }
      this.services.evolution = evolutionService;
      logger.info('Evolution instance registered successfully', {
        instanceId: evolutionResult.instanceId
      });

      // Start follow-up scheduler
      logger.info('Starting follow-up scheduler');
      const schedulerConfig = {
        intervalMinutes: this.config.checkIntervalMinutes,
        staleThresholdHours: this.config.staleThresholdHours,
        sheetsService: this.services.sheetsService,
        messageSender: this.sendGroupMessage.bind(this),
        logger: logger.info
      };
      this.services.followUpScheduler = followUpScheduler.start(schedulerConfig);
      logger.info('Follow-up scheduler started', {
        intervalMinutes: this.config.checkIntervalMinutes,
        staleThresholdHours: this.config.staleThresholdHours
      });

      // Mark as initialized
      this.initialized = true;
      this.stats.startTime = new Date();

      logger.info('CS Ticket System initialization completed successfully', {
        instanceId: this.config.instanceId,
        startTime: this.stats.startTime.toISOString(),
        services: Object.keys(this.services).filter(key => this.services[key] !== null)
      });

      return {
        success: true,
        instanceId: this.config.instanceId,
        services: Object.keys(this.services).filter(key => this.services[key] !== null),
        startTime: this.stats.startTime.toISOString()
      };

    } catch (error) {
      logger.error('Failed to initialize CS Ticket System', {
        error: error.message,
        stack: error.stack,
        config: this.config
      });

      this.initialized = false;
      this.stats.errors++;

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process a detected ticket from the webhook
   * Main integration point for webhook → detector → sheets pipeline
   * 
   * @param {Object} messageData - Message data from webhook controller
   * @returns {Promise<Object>} Processing result
   */
  async processTicketMessage(messageData) {
    try {
      if (!this.initialized) {
        throw new Error('CS Ticket System not initialized');
      }

      this.stats.messagesProcessed++;
      
      logger.info('Processing potential ticket message', {
        messageId: messageData.messageId,
        groupName: messageData.groupName,
        senderName: messageData.senderName,
        textLength: messageData.textContent?.length || 0
      });

      // Step 1: Detect if this is a ticket
      const detectionResult = await this.services.ticketDetector.detectTicket(
        messageData.textContent,
        messageData.senderName,
        { groupName: messageData.groupName }
      );

      if (!detectionResult.isTicket) {
        logger.debug('Message is not a ticket', {
          messageId: messageData.messageId,
          reason: 'Not detected as ticket by AI'
        });
        return {
          success: true,
          processed: false,
          reason: 'Not a ticket',
          messageId: messageData.messageId
        };
      }

      logger.info('Ticket detected by AI', {
        messageId: messageData.messageId,
        customer: detectionResult.ticketData.customer,
        priority: detectionResult.ticketData.priority,
        category: detectionResult.ticketData.category
      });

      // Step 2: Write ticket to Google Sheets
      const ticketData = {
        customer: detectionResult.ticketData.customer,
        issue: detectionResult.ticketData.issue,
        priority: detectionResult.ticketData.priority,
        groupName: messageData.groupName,
        groupId: messageData.groupId,
        timestamp: messageData.timestamp,
        category: detectionResult.ticketData.category || 'general'
      };

      const writeResult = await this.services.sheetsService.writeTicket(ticketData);
      
      if (!writeResult.success) {
        throw new Error(`Failed to write ticket to sheets: ${writeResult.error}`);
      }

      this.stats.ticketsCreated++;

      logger.info('Ticket created successfully', {
        ticketId: writeResult.ticketId,
        messageId: messageData.messageId,
        customer: ticketData.customer,
        priority: ticketData.priority,
        groupName: ticketData.groupName
      });

      return {
        success: true,
        processed: true,
        ticketCreated: true,
        ticketId: writeResult.ticketId,
        customerName: ticketData.customer,
        priority: detectionResult.ticketData.priority,
        category: detectionResult.ticketData.category,
        messageId: messageData.messageId,
        timestamp: writeResult.timestamp
      };

    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to process ticket message', {
        messageId: messageData.messageId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        messageId: messageData.messageId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process a status update message
   * Handles messages that update existing ticket status
   * 
   * @param {Object} messageData - Message data from webhook
   * @returns {Promise<Object>} Processing result
   */
  async processStatusUpdate(messageData) {
    try {
      if (!this.initialized) {
        throw new Error('CS Ticket System not initialized');
      }

      logger.debug('Checking for status update', {
        messageId: messageData.messageId,
        textContent: messageData.textContent
      });

      // Detect status update
      const updateResult = await this.services.ticketDetector.detectStatusUpdate(
        messageData.textContent,
        null // ticketId will be extracted from message
      );

      if (!updateResult.isUpdate) {
        return {
          success: true,
          processed: false,
          reason: 'Not a status update',
          messageId: messageData.messageId
        };
      }

      logger.info('Status update detected', {
        messageId: messageData.messageId,
        newStatus: updateResult.newStatus,
        updateNotes: updateResult.updateNotes
      });

      // Extract ticket ID from message and update sheets
      // For now, this is a placeholder - Module B should provide ticket ID extraction
      
      return {
        success: true,
        processed: true,
        type: 'status_update',
        newStatus: updateResult.newStatus,
        messageId: messageData.messageId
      };

    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to process status update', {
        messageId: messageData.messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        messageId: messageData.messageId
      };
    }
  }

  /**
   * Send a message to a WhatsApp group (for follow-ups)
   * Integration point for follow-up scheduler → WhatsApp sender
   * 
   * @param {string} groupId - WhatsApp group ID
   * @param {string} message - Message to send
   * @returns {Promise<Object>} Send result
   */
  async sendGroupMessage(groupId, message) {
    try {
      if (!this.initialized || !this.services.evolution) {
        throw new Error('Evolution service not available');
      }

      logger.info('Sending group message', {
        groupId,
        messageLength: message.length,
        instanceId: this.config.instanceId
      });

      // Use Evolution multi-instance service to send message
      // CS instance is registered with alias 'cs-ticket-monitor'
      const sendResult = await this.services.evolution.sendMessage(
        'cs-ticket-monitor',
        groupId,
        message
      );

      if (sendResult.success) {
        this.stats.followUpsSent++;
        logger.info('Follow-up message sent successfully', {
          groupId,
          messageId: sendResult.messageId
        });
      }

      return sendResult;

    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to send group message', {
        groupId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get health status of all CS system components
   * 
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    return {
      initialized: this.initialized,
      uptime: Math.floor(uptime / 1000), // seconds
      instanceId: this.config.instanceId,
      services: {
        evolution: !!this.services.evolution,
        ticketDetector: !!this.services.ticketDetector,
        sheetsService: !!this.services.sheetsService,
        followUpScheduler: !!this.services.followUpScheduler,
        groupsManager: !!this.services.groupsManager
      },
      stats: {
        ...this.stats,
        startTime: this.stats.startTime?.toISOString()
      },
      config: {
        instanceId: this.config.instanceId,
        webhookUrl: this.config.webhookUrl,
        checkIntervalMinutes: this.config.checkIntervalMinutes,
        staleThresholdHours: this.config.staleThresholdHours,
        hasSheetId: !!this.config.sheetId,
        hasServiceAccount: !!this.config.serviceAccountKey
      }
    };
  }

  /**
   * Validate configuration before initialization
   * 
   * @returns {Array<string>} Array of configuration errors
   */
  validateConfiguration() {
    const errors = [];

    if (!this.config.sheetId) {
      errors.push('CS_SHEET_ID environment variable is required');
    }

    if (!this.config.serviceAccountKey) {
      errors.push('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required');
    } else {
      try {
        JSON.parse(this.config.serviceAccountKey);
      } catch (e) {
        errors.push('GOOGLE_SERVICE_ACCOUNT_KEY must be valid JSON');
      }
    }

    if (!this.config.instanceId) {
      errors.push('CS_INSTANCE_ID environment variable is required');
    }

    if (!this.config.webhookUrl) {
      errors.push('CS_WEBHOOK_URL environment variable is required');
    }

    return errors;
  }

  /**
   * Graceful shutdown of CS Ticket System
   * Stops scheduler and cleans up resources
   * 
   * @returns {Promise<Object>} Shutdown result
   */
  async shutdown() {
    try {
      logger.info('Shutting down CS Ticket System', {
        instanceId: this.config.instanceId
      });

      // Stop follow-up scheduler
      if (this.services.followUpScheduler) {
        followUpScheduler.stopAll();
        logger.info('Follow-up scheduler stopped');
      }

      // Reset services
      this.services = {
        evolution: null,
        ticketDetector: null,
        sheetsService: null,
        followUpScheduler: null,
        groupsManager: null
      };

      this.initialized = false;

      const finalStats = { ...this.stats };
      logger.info('CS Ticket System shutdown completed', {
        finalStats,
        instanceId: this.config.instanceId
      });

      return {
        success: true,
        finalStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error during CS system shutdown', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const csTicketOrchestrator = new CSTicketOrchestrator();

module.exports = {
  initialize: csTicketOrchestrator.initialize.bind(csTicketOrchestrator),
  processTicketMessage: csTicketOrchestrator.processTicketMessage.bind(csTicketOrchestrator),
  processStatusUpdate: csTicketOrchestrator.processStatusUpdate.bind(csTicketOrchestrator),
  sendGroupMessage: csTicketOrchestrator.sendGroupMessage.bind(csTicketOrchestrator),
  getHealthStatus: csTicketOrchestrator.getHealthStatus.bind(csTicketOrchestrator),
  isInitialized: () => csTicketOrchestrator.initialized,
  shutdown: csTicketOrchestrator.shutdown.bind(csTicketOrchestrator)
};