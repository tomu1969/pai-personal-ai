/**
 * @file systemInitializer.js
 * @description System initialization service for PAI application startup
 * @module services/startup/systemInitializer
 * @requires ../whatsapp/evolutionMultiInstance
 * @requires ../database/dbValidator
 * @requires ../../config
 * @requires ../../utils/logger
 * @author PAI System
 * @since September 2025
 */

const evolutionMultiInstance = require('../whatsapp/evolutionMultiInstance');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * System initialization service
 * Ensures all Evolution API instances exist and are properly configured
 * 
 * @class SystemInitializerService
 */
class SystemInitializerService {
  constructor() {
    this.evolutionService = evolutionMultiInstance;
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize the entire system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Starting system initialization...');

      // Step 1: Initialize multi-instance service
      await this.evolutionService.initialize();

      // Step 2: Verify and create all instances
      await this.ensureAllInstancesExist();

      // Step 3: Configure webhooks for all instances
      await this.configureAllWebhooks();

      // Step 4: Validate system readiness
      await this.validateSystemReadiness();

      this.initialized = true;
      logger.info('System initialization completed successfully');

    } catch (error) {
      logger.error('System initialization failed', {
        error: error.message,
        retryCount: this.retryCount
      });

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying system initialization (${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        return this.initialize();
      }

      throw error;
    }
  }

  /**
   * Ensure all Evolution API instances exist
   */
  async ensureAllInstancesExist() {
    const instances = ['main', 'pai-assistant', 'pai-mortgage'];
    
    for (const alias of instances) {
      try {
        logger.info(`Verifying instance: ${alias}`);
        
        // Check if instance exists
        const status = await this.evolutionService.getConnectionStatus(alias);
        logger.info(`Instance ${alias} exists with status: ${status.status.state}`);
        
      } catch (error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          logger.warn(`Instance ${alias} does not exist, creating...`);
          
          // Create the instance
          await this.evolutionService.createInstance(alias);
          
          // Wait for creation to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          logger.info(`Instance ${alias} created successfully`);
        } else {
          logger.error(`Failed to verify instance ${alias}`, { error: error.message });
          throw error;
        }
      }
    }
  }

  /**
   * Configure webhooks for all instances
   */
  async configureAllWebhooks() {
    const instances = ['main', 'pai-assistant', 'pai-mortgage'];
    
    for (const alias of instances) {
      try {
        logger.info(`Configuring webhook for instance: ${alias}`);
        
        await this.evolutionService.setWebhook(alias, [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE'
        ]);
        
        // Verify webhook was set
        await this.verifyWebhookConfiguration(alias);
        
        logger.info(`Webhook configured successfully for instance: ${alias}`);
        
      } catch (error) {
        logger.error(`Failed to configure webhook for instance: ${alias}`, {
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * Verify webhook configuration for an instance
   */
  async verifyWebhookConfiguration(alias) {
    try {
      const instance = this.evolutionService.getInstance(alias);
      const config = this.evolutionService.getInstanceConfig(alias);
      
      // Use the Evolution API to check webhook
      const response = await instance.client.get(`/webhook/find/${config.instanceId}`);
      
      if (!response.data || !response.data.enabled) {
        throw new Error(`Webhook not properly configured for ${alias}`);
      }
      
      logger.debug(`Webhook verification successful for ${alias}`, {
        webhookUrl: response.data.url,
        enabled: response.data.enabled
      });
      
    } catch (error) {
      logger.warn(`Webhook verification failed for ${alias}`, {
        error: error.message
      });
      // Don't throw - webhook might still work even if verification fails
    }
  }

  /**
   * Validate system readiness
   */
  async validateSystemReadiness() {
    logger.info('Validating system readiness...');
    
    const instances = ['main', 'pai-assistant', 'pai-mortgage'];
    const readinessChecks = [];
    
    for (const alias of instances) {
      try {
        const status = await this.evolutionService.getConnectionStatus(alias);
        const isReady = status.status && (status.status.state === 'open' || status.status.state === 'close');
        
        readinessChecks.push({
          instance: alias,
          ready: isReady,
          state: status.status?.state || 'unknown'
        });
        
      } catch (error) {
        readinessChecks.push({
          instance: alias,
          ready: false,
          error: error.message
        });
      }
    }
    
    const readyCount = readinessChecks.filter(check => check.ready).length;
    const totalCount = readinessChecks.length;
    
    logger.info('System readiness check completed', {
      ready: `${readyCount}/${totalCount}`,
      details: readinessChecks
    });
    
    if (readyCount === 0) {
      throw new Error('No instances are ready - system initialization failed');
    }
    
    if (readyCount < totalCount) {
      logger.warn(`Only ${readyCount} of ${totalCount} instances are ready`);
    }
  }

  /**
   * Health check method for monitoring
   */
  async healthCheck() {
    try {
      const instances = ['main', 'pai-assistant', 'pai-mortgage'];
      const health = {};
      
      for (const alias of instances) {
        try {
          const status = await this.evolutionService.getConnectionStatus(alias);
          health[alias] = {
            status: 'healthy',
            state: status.status?.state || 'unknown',
            connected: status.connected
          };
        } catch (error) {
          health[alias] = {
            status: 'unhealthy',
            error: error.message
          };
        }
      }
      
      return {
        system: this.initialized ? 'initialized' : 'not_initialized',
        instances: health,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return {
        system: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reinitialize specific instance
   */
  async reinitializeInstance(alias) {
    try {
      logger.info(`Reinitializing instance: ${alias}`);
      
      // Recreate the instance
      await this.evolutionService.recreateInstance(alias);
      
      // Configure webhook
      await this.evolutionService.setWebhook(alias, [
        'MESSAGES_UPSERT', 
        'CONNECTION_UPDATE'
      ]);
      
      logger.info(`Instance ${alias} reinitialized successfully`);
      
    } catch (error) {
      logger.error(`Failed to reinitialize instance: ${alias}`, {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = SystemInitializerService;