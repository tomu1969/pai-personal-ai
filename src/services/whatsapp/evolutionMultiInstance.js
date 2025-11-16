/**
 * @file evolutionMultiInstance.js
 * @description Multi-instance Evolution API manager for dual WhatsApp line setup
 * @module services/whatsapp/evolutionMultiInstance
 * @requires ./whatsapp
 * @requires ../config
 * @requires ../utils/logger
 * @exports EvolutionMultiInstanceService
 * @author PAI System
 * @since September 2025
 */

const WhatsAppService = require('./whatsapp');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Multi-instance Evolution API manager
 * Manages separate WhatsApp instances for PAI Responder and PAI Assistant
 * 
 * Architecture:
 * - PAI Responder: Main WhatsApp line for auto-responses (instance: 'main')
 * - PAI Assistant: Secondary line for message queries (instance: 'pai-assistant')
 * 
 * @class EvolutionMultiInstanceService
 * @example
 * const multiInstance = new EvolutionMultiInstanceService();
 * await multiInstance.initialize();
 * const qr = await multiInstance.getQRCode('pai-assistant');
 */
class EvolutionMultiInstanceService {
  constructor() {
    this.instances = new Map();
    this.instanceConfigs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the service with default instances
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Register main instance (PAI Responder)
      logger.debug('Registering main instance with config', {
        instanceId: config.evolution.instanceId,
        apiUrl: config.evolution.apiUrl,
        webhookUrl: config.evolution.webhookUrl
      });
      
      await this.registerInstance('main', {
        instanceId: config.evolution.instanceId,
        apiUrl: config.evolution.apiUrl,
        apiKey: config.evolution.apiKey,
        webhookUrl: config.evolution.webhookUrl,
        webhookPath: '/webhook',
        description: 'PAI Responder - Main WhatsApp Line',
        assistantType: 'pai_responder'
      });

      // Register PAI Assistant instance
      await this.registerInstance('pai-assistant', {
        instanceId: config.evolution.paiAssistantInstanceId || 'pai-assistant',
        apiUrl: config.evolution.apiUrl,
        apiKey: config.evolution.apiKey,
        webhookUrl: config.evolution.paiAssistantWebhookUrl || `${config.server.host}:${config.server.port}/webhook/pai-assistant`,
        webhookPath: '/webhook/pai-assistant',
        description: 'PAI Assistant - Query Interface Line',
        assistantType: 'pai-assistant'
      });


      // Register CS Ticket Monitor instance
      await this.registerInstance('cs-ticket-monitor', {
        instanceId: process.env.CS_INSTANCE_ID || 'cs-monitor',
        apiUrl: config.evolution.apiUrl,
        apiKey: config.evolution.apiKey,
        webhookUrl: process.env.CS_WEBHOOK_URL || `${config.server.host}:${config.server.port}/webhook/cs-tickets`,
        webhookPath: '/webhook/cs-tickets',
        description: 'CS Ticket Monitor - WhatsApp Group Monitoring',
        assistantType: 'cs-ticket-monitor',
        ignoreGroups: false  // CRITICAL: Enable group message reception
      });

      this.initialized = true;
      logger.info('Multi-instance Evolution service initialized', {
        instances: Array.from(this.instances.keys()),
        instanceCount: this.instances.size
      });

    } catch (error) {
      logger.error('Failed to initialize multi-instance service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register a new Evolution API instance
   */
  async registerInstance(alias, instanceConfig) {
    try {
      // Validate required config
      const required = ['instanceId', 'apiUrl', 'apiKey', 'webhookUrl', 'assistantType'];
      const missing = required.filter(key => !instanceConfig[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required config: ${missing.join(', ')}`);
      }

      // Create WhatsApp service instance with custom config
      const customConfig = {
        evolution: {
          apiUrl: instanceConfig.apiUrl,
          apiKey: instanceConfig.apiKey,
          instanceId: instanceConfig.instanceId,
          webhookUrl: instanceConfig.webhookUrl
        }
      };

      const whatsappService = new WhatsAppService(customConfig);
      
      // Store instance and config
      this.instances.set(alias, whatsappService);
      this.instanceConfigs.set(alias, instanceConfig);

      logger.info('Evolution instance registered', {
        alias,
        instanceId: instanceConfig.instanceId,
        assistantType: instanceConfig.assistantType,
        webhookPath: instanceConfig.webhookPath
      });

      return whatsappService;
    } catch (error) {
      logger.error('Failed to register instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get WhatsApp service for specific instance
   */
  getInstance(alias) {
    if (!this.initialized) {
      throw new Error('Multi-instance service not initialized. Call initialize() first.');
    }

    const instance = this.instances.get(alias);
    if (!instance) {
      throw new Error(`Instance '${alias}' not found. Available: ${Array.from(this.instances.keys()).join(', ')}`);
    }

    return instance;
  }

  /**
   * Get instance configuration
   */
  getInstanceConfig(alias) {
    const config = this.instanceConfigs.get(alias);
    if (!config) {
      throw new Error(`Instance config '${alias}' not found`);
    }
    return config;
  }

  /**
   * Get all registered instances
   */
  getAllInstances() {
    return Array.from(this.instances.entries()).map(([alias, service]) => ({
      alias,
      config: this.instanceConfigs.get(alias),
      service
    }));
  }

  /**
   * Create a new Evolution API instance
   */
  async createInstance(alias, instanceConfig) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      logger.info('Creating Evolution API instance', {
        alias,
        instanceId: config.instanceId
      });

      const payload = {
        instanceName: config.instanceId,
        token: config.apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhookUrl: config.webhookUrl,
        webhookEvents: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        reject_call: true,
        msg_call: 'This is an AI assistant line. Please send text messages only.',
        groups_ignore: instanceConfig?.ignoreGroups !== false, // Default: ignore groups
        always_online: false,
        read_messages: false,
        read_status: false,
        sync_full_history: false
      };

      // Create instance using the WhatsApp service's client
      const response = await instance.client.post('/instance/create', payload);

      logger.info('Evolution API instance created', {
        alias,
        instanceId: config.instanceId,
        success: !!response.data.instance
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        logger.info('Evolution API instance already exists', {
          alias,
          instanceId: this.getInstanceConfig(alias).instanceId
        });
        return { instance: { instanceName: this.getInstanceConfig(alias).instanceId } };
      }
      
      logger.error('Failed to create Evolution API instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get QR code for instance connection
   */
  async getQRCode(alias) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      logger.info('Getting QR code for instance', {
        alias,
        instanceId: config.instanceId,
        apiUrl: config.apiUrl,
        fullUrl: `${config.apiUrl}/instance/connect/${config.instanceId}`
      });

      const response = await instance.client.get(`/instance/connect/${config.instanceId}`);
      
      return {
        alias,
        instanceId: config.instanceId,
        qrCode: response.data,
        connectUrl: `${config.apiUrl}/instance/connect/${config.instanceId}`
      };
    } catch (error) {
      logger.error('Failed to get QR code', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check connection status for instance
   */
  async getConnectionStatus(alias) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      const response = await instance.client.get(`/instance/connectionState/${config.instanceId}`);
      
      return {
        alias,
        instanceId: config.instanceId,
        status: response.data.instance,
        connected: response.data.instance.state === 'open'
      };
    } catch (error) {
      logger.error('Failed to get connection status', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set webhook for instance
   */
  async setWebhook(alias, events = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      await instance.setWebhook(config.webhookUrl, events);

      logger.info('Webhook set for instance', {
        alias,
        instanceId: config.instanceId,
        webhookUrl: config.webhookUrl,
        events
      });
    } catch (error) {
      logger.error('Failed to set webhook for instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get instance by webhook path
   */
  getInstanceByWebhookPath(webhookPath) {
    for (const [alias, config] of this.instanceConfigs.entries()) {
      if (config.webhookPath === webhookPath) {
        return {
          alias,
          instance: this.instances.get(alias),
          config
        };
      }
    }
    return null;
  }

  /**
   * Send message using specific instance
   */
  async sendMessage(alias, phone, message, options = {}) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      logger.info('Sending message via instance', {
        alias,
        instanceId: config.instanceId,
        phone,
        messageLength: message.length
      });

      return await instance.sendMessage(phone, message, options);
    } catch (error) {
      logger.error('Failed to send message via instance', {
        alias,
        phone,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete Evolution API instance
   */
  async deleteInstance(alias) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      logger.info('Deleting Evolution API instance', {
        alias,
        instanceId: config.instanceId
      });

      const response = await instance.client.delete(`/instance/delete/${config.instanceId}`);

      logger.info('Evolution API instance deleted', {
        alias,
        instanceId: config.instanceId,
        success: response.data.status === 'SUCCESS'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to delete Evolution API instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Recreate Evolution API instance (delete and create new)
   */
  async recreateInstance(alias, instanceConfig = {}) {
    try {
      logger.info('Recreating Evolution API instance', {
        alias,
        instanceId: this.getInstanceConfig(alias).instanceId
      });

      // Delete existing instance
      try {
        await this.deleteInstance(alias);
        
        // Wait a moment for deletion to process
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (deleteError) {
        logger.warn('Instance deletion failed (may not exist)', {
          alias,
          error: deleteError.message
        });
      }

      // Create new instance
      const createResult = await this.createInstance(alias, instanceConfig);

      // Set webhook
      await this.setWebhook(alias);

      logger.info('Evolution API instance recreated successfully', {
        alias,
        instanceId: this.getInstanceConfig(alias).instanceId
      });

      return createResult;
    } catch (error) {
      logger.error('Failed to recreate Evolution API instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reset instance when QR code limit is reached
   */
  async resetInstanceOnQRLimit(alias) {
    try {
      logger.info('Resetting instance due to QR code limit', {
        alias,
        instanceId: this.getInstanceConfig(alias).instanceId
      });

      // Recreate the instance
      const result = await this.recreateInstance(alias);

      logger.info('Instance reset completed for QR limit issue', {
        alias,
        instanceId: this.getInstanceConfig(alias).instanceId
      });

      return result;
    } catch (error) {
      logger.error('Failed to reset instance for QR limit', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if error is QR code limit related
   */
  isQRCodeLimitError(error) {
    if (!error) return false;
    
    const errorMessage = error.message || '';
    const errorResponse = error.response?.data?.message || '';
    
    return errorMessage.includes('QR code limit') || 
           errorMessage.includes('qr limit') ||
           errorResponse.includes('QR code limit') ||
           errorResponse.includes('qr limit');
  }

  /**
   * Check if connection is unstable (rapid cycling)
   */
  isConnectionUnstable(statusReason) {
    return statusReason === 440 || statusReason === 428 || statusReason === 503;
  }

  /**
   * Track connection failures for an instance
   */
  trackConnectionFailure(alias) {
    if (!this.connectionFailures) {
      this.connectionFailures = new Map();
    }
    
    const failures = this.connectionFailures.get(alias) || { count: 0, lastFailure: null };
    failures.count++;
    failures.lastFailure = Date.now();
    this.connectionFailures.set(alias, failures);
    
    logger.warn('Connection failure tracked', {
      alias,
      failureCount: failures.count,
      lastFailure: new Date(failures.lastFailure).toISOString()
    });
    
    return failures.count;
  }

  /**
   * Reset connection failure tracking
   */
  resetConnectionFailures(alias) {
    if (this.connectionFailures) {
      this.connectionFailures.delete(alias);
      logger.info('Connection failure tracking reset', { alias });
    }
  }

  /**
   * Logout instance to clear corrupted session
   */
  async logoutInstance(alias) {
    try {
      const instance = this.getInstance(alias);
      const config = this.getInstanceConfig(alias);

      logger.info('Logging out instance to clear corrupted session', {
        alias,
        instanceId: config.instanceId
      });

      const response = await instance.client.delete(`/instance/logout/${config.instanceId}`);

      logger.info('Instance logout completed', {
        alias,
        instanceId: config.instanceId,
        success: response.status < 400
      });

      // Reset failure tracking after successful logout
      this.resetConnectionFailures(alias);

      return response.data;
    } catch (error) {
      logger.error('Failed to logout instance', {
        alias,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle connection instability with automatic recovery
   */
  async handleConnectionInstability(alias, statusReason) {
    try {
      if (!this.isConnectionUnstable(statusReason)) {
        return false;
      }

      const failureCount = this.trackConnectionFailure(alias);
      
      logger.warn('Connection instability detected', {
        alias,
        statusReason,
        failureCount,
        statusMap: {
          440: 'timeout',
          428: 'precondition_required', 
          503: 'service_unavailable'
        }[statusReason] || 'unknown'
      });

      // Special handling for statusReason 428 (precondition_required)
      if (statusReason === 428 && failureCount >= 5) {
        const config = this.getInstanceConfig(alias);
        logger.warn('StatusReason 428 persistent - attempting instance recreation', {
          alias,
          instanceId: config.instanceId,
          failureCount,
          action: 'recreate_instance'
        });

        try {
          await this.recreateInstance(alias);
          logger.info('Instance recreated due to persistent 428 errors', {
            alias,
            instanceId: config.instanceId
          });
          return true;
        } catch (recreateError) {
          logger.error('Failed to recreate instance for 428 error', {
            alias,
            error: recreateError.message
          });
        }
      }

      // After 3 failures in rapid succession, logout to clear session
      if (failureCount >= 3) {
        const config = this.getInstanceConfig(alias);
        const failures = this.connectionFailures.get(alias);
        
        // Only logout if failures are within the last 30 seconds (rapid cycling)
        const timeSinceFirstFailure = Date.now() - (failures.lastFailure - ((failureCount - 1) * 1000));
        
        if (timeSinceFirstFailure < 30000) {
          logger.warn('Rapid connection cycling detected, initiating logout', {
            alias,
            instanceId: config.instanceId,
            failureCount,
            timeSinceFirstFailure: `${Math.round(timeSinceFirstFailure / 1000)}s`
          });

          await this.logoutInstance(alias);
          return true;
        } else {
          // Reset if failures are spread over time (not rapid cycling)
          this.resetConnectionFailures(alias);
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to handle connection instability', {
        alias,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats() {
    const stats = {
      initialized: this.initialized,
      instanceCount: this.instances.size,
      instances: {}
    };

    for (const [alias, instance] of this.instances.entries()) {
      try {
        const config = this.instanceConfigs.get(alias);
        const status = await this.getConnectionStatus(alias);
        
        stats.instances[alias] = {
          instanceId: config.instanceId,
          assistantType: config.assistantType,
          connected: status.connected,
          state: status.status.state,
          webhookPath: config.webhookPath
        };
      } catch (error) {
        stats.instances[alias] = {
          error: error.message
        };
      }
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new EvolutionMultiInstanceService();