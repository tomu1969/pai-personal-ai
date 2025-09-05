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
        instanceId: config.instanceId
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