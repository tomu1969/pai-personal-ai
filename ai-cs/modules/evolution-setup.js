/**
 * @file evolution-setup.js
 * @description Evolution API setup module for CS Ticket Monitor instance
 * @module ai-cs/modules/evolution-setup
 * @requires ../../src/services/whatsapp/evolutionMultiInstance
 * @requires ../../src/utils/logger
 * @exports CSEvolutionSetup
 * @author PAI System - CS Module
 * @since November 2025
 */

const evolutionMultiInstance = require('../../src/services/whatsapp/evolutionMultiInstance');
const logger = require('../../src/utils/logger');

/**
 * CS Ticket Monitor Evolution API setup and management
 * Handles registration, status checking, and QR code retrieval for CS instance
 * 
 * @class CSEvolutionSetup
 * @example
 * const csSetup = require('./evolution-setup');
 * await csSetup.registerCSInstance();
 * const status = await csSetup.getConnectionStatus();
 */
class CSEvolutionSetup {
  constructor() {
    this.instanceAlias = 'cs-ticket-monitor';
    this.instanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';
    this.webhookUrl = process.env.CS_WEBHOOK_URL || 'http://localhost:3000/webhook/cs-tickets';
    this.registered = false;
  }

  /**
   * Register CS instance with Evolution Multi-Instance service
   * Configures instance for WhatsApp group monitoring
   * 
   * @param {Object} evolutionService - Optional custom evolution service instance
   * @returns {Promise<Object>} Registration result with success status and instance details
   * @example
   * const result = await csSetup.registerCSInstance();
   * // Returns: { success: true, instanceId: 'cs-ticket-monitor', error?: string }
   */
  async registerCSInstance(evolutionService = null) {
    try {
      const service = evolutionService || evolutionMultiInstance;

      // Ensure the multi-instance service is initialized
      if (!service.initialized) {
        await service.initialize();
      }

      logger.info('Registering CS Ticket Monitor instance', {
        instanceAlias: this.instanceAlias,
        instanceId: this.instanceId,
        webhookUrl: this.webhookUrl
      });

      // Configure CS instance - IMPORTANT: ignoreGroups: false to receive group messages
      const instanceConfig = {
        instanceId: this.instanceId,
        apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: process.env.EVOLUTION_API_KEY || 'pai_evolution_api_key_2025',
        webhookUrl: this.webhookUrl,
        webhookPath: '/webhook/cs-tickets',
        description: 'CS Ticket Monitor - WhatsApp Group Monitoring',
        assistantType: 'cs-ticket-monitor',
        ignoreGroups: false  // CRITICAL: Must be false to receive group messages
      };

      // Register instance with the multi-instance service
      await service.registerInstance(this.instanceAlias, instanceConfig);

      this.registered = true;

      logger.info('CS Ticket Monitor instance registered successfully', {
        instanceAlias: this.instanceAlias,
        instanceId: this.instanceId,
        groupMonitoring: true
      });

      return {
        success: true,
        instanceId: this.instanceId,
        alias: this.instanceAlias,
        groupMonitoring: true
      };

    } catch (error) {
      logger.error('Failed to register CS instance', {
        instanceAlias: this.instanceAlias,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        instanceId: this.instanceId,
        error: error.message
      };
    }
  }

  /**
   * Get connection status for CS instance
   * Checks if WhatsApp is connected and ready to monitor groups
   * 
   * @param {string} instanceId - Optional specific instance ID to check
   * @returns {Promise<Object>} Connection status with connected boolean and QR code if needed
   * @example
   * const status = await csSetup.getConnectionStatus();
   * // Returns: { connected: true, qrCode?: string, instanceState?: string }
   */
  async getConnectionStatus(instanceId = null) {
    try {
      const targetInstanceId = instanceId || this.instanceId;

      if (!this.registered) {
        await this.registerCSInstance();
      }

      logger.debug('Checking CS instance connection status', {
        instanceAlias: this.instanceAlias,
        instanceId: targetInstanceId
      });

      const status = await evolutionMultiInstance.getConnectionStatus(this.instanceAlias);

      logger.info('CS instance connection status retrieved', {
        instanceAlias: this.instanceAlias,
        connected: status.connected,
        state: status.status?.state || 'unknown'
      });

      return {
        connected: status.connected,
        instanceState: status.status?.state,
        instanceData: status.status,
        qrCode: null // QR code retrieved separately if needed
      };

    } catch (error) {
      logger.error('Failed to get CS instance connection status', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get QR code for CS instance connection
   * Retrieves QR code data for WhatsApp linking
   * 
   * @returns {Promise<Object>} QR code data with base64 image or code string
   * @example
   * const qrData = await csSetup.getQRCode();
   * // Returns: { qrCode: 'base64...', connectUrl: 'http://...', error?: string }
   */
  async getQRCode() {
    try {
      if (!this.registered) {
        await this.registerCSInstance();
      }

      logger.info('Retrieving QR code for CS instance', {
        instanceAlias: this.instanceAlias,
        instanceId: this.instanceId
      });

      const qrData = await evolutionMultiInstance.getQRCode(this.instanceAlias);

      return {
        qrCode: qrData.qrCode,
        connectUrl: qrData.connectUrl,
        instanceId: qrData.instanceId
      };

    } catch (error) {
      logger.error('Failed to get QR code for CS instance', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        qrCode: null,
        error: error.message
      };
    }
  }

  /**
   * Reset CS instance when connection issues occur
   * Recreates instance to resolve QR code limits or connection problems
   * 
   * @param {string} instanceId - Optional specific instance ID to reset
   * @returns {Promise<Object>} Reset result with success status
   * @example
   * const result = await csSetup.resetInstance();
   * // Returns: { success: true, newQRRequired: true }
   */
  async resetInstance(instanceId = null) {
    try {
      const targetInstanceId = instanceId || this.instanceId;

      logger.warn('Resetting CS instance due to connection issues', {
        instanceAlias: this.instanceAlias,
        instanceId: targetInstanceId,
        reason: 'manual_reset_requested'
      });

      if (!this.registered) {
        await this.registerCSInstance();
      }

      // Use the multi-instance service to reset
      const resetResult = await evolutionMultiInstance.resetInstanceOnQRLimit(this.instanceAlias);

      logger.info('CS instance reset completed', {
        instanceAlias: this.instanceAlias,
        instanceId: targetInstanceId,
        resetSuccess: !!resetResult
      });

      return {
        success: true,
        newQRRequired: true,
        instanceId: targetInstanceId
      };

    } catch (error) {
      logger.error('Failed to reset CS instance', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create Evolution API instance if it doesn't exist
   * Handles initial instance creation with proper configuration
   * 
   * @returns {Promise<Object>} Creation result
   */
  async createInstance() {
    try {
      if (!this.registered) {
        await this.registerCSInstance();
      }

      logger.info('Creating CS Evolution API instance', {
        instanceAlias: this.instanceAlias,
        instanceId: this.instanceId
      });

      // Create instance with group monitoring enabled
      const createResult = await evolutionMultiInstance.createInstance(this.instanceAlias, {
        ignoreGroups: false  // CRITICAL: Enable group message reception
      });

      logger.info('CS Evolution API instance created', {
        instanceAlias: this.instanceAlias,
        success: !!createResult.instance
      });

      return {
        success: true,
        instance: createResult.instance,
        instanceId: this.instanceId
      };

    } catch (error) {
      if (error.response?.status === 409) {
        logger.info('CS Evolution API instance already exists', {
          instanceAlias: this.instanceAlias,
          instanceId: this.instanceId
        });
        return {
          success: true,
          instance: { instanceName: this.instanceId },
          alreadyExists: true
        };
      }

      logger.error('Failed to create CS Evolution API instance', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set webhook configuration for CS instance
   * Configures webhook to receive group messages and connection updates
   * 
   * @returns {Promise<Object>} Webhook setup result
   */
  async setWebhook() {
    try {
      if (!this.registered) {
        await this.registerCSInstance();
      }

      logger.info('Setting webhook for CS instance', {
        instanceAlias: this.instanceAlias,
        webhookUrl: this.webhookUrl
      });

      // Set webhook with specific events for CS monitoring
      await evolutionMultiInstance.setWebhook(this.instanceAlias, [
        'MESSAGES_UPSERT',    // New messages (including group messages)
        'CONNECTION_UPDATE'   // Connection status changes
      ]);

      logger.info('Webhook configured for CS instance', {
        instanceAlias: this.instanceAlias,
        webhookUrl: this.webhookUrl,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
      });

      return {
        success: true,
        webhookUrl: this.webhookUrl
      };

    } catch (error) {
      logger.error('Failed to set webhook for CS instance', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get CS instance statistics and health info
   * 
   * @returns {Promise<Object>} Instance stats including connection status
   */
  async getInstanceStats() {
    try {
      const status = await this.getConnectionStatus();
      const stats = await evolutionMultiInstance.getServiceStats();

      return {
        instanceAlias: this.instanceAlias,
        instanceId: this.instanceId,
        registered: this.registered,
        connected: status.connected,
        groupMonitoring: true,
        webhookUrl: this.webhookUrl,
        evolutionServiceStats: stats.instances[this.instanceAlias] || null
      };

    } catch (error) {
      logger.error('Failed to get CS instance stats', {
        instanceAlias: this.instanceAlias,
        error: error.message
      });

      return {
        instanceAlias: this.instanceAlias,
        error: error.message
      };
    }
  }
}

// Export singleton instance for easy use
module.exports = new CSEvolutionSetup();