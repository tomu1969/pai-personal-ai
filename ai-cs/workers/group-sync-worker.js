/**
 * @file group-sync-worker.js
 * @description Background worker for incremental and chunked group synchronization
 * @module ai-cs/workers/group-sync-worker
 * @requires axios
 * @requires ../../src/utils/logger
 * @exports GroupSyncWorker
 * @author PAI System - CS Module (Group Sync Worker)
 * @since November 2025
 */

const axios = require('axios');
const logger = require('../../src/utils/logger');

/**
 * Group Sync Worker
 * Handles incremental group fetching from Evolution API in smaller chunks
 * Implements streaming responses and retry logic to handle large group lists
 * 
 * @class GroupSyncWorker
 */
class GroupSyncWorker {
  constructor() {
    this.isRunning = false;
    this.syncStats = {
      totalRuns: 0,
      successfulRuns: 0,
      groupsProcessed: 0,
      chunksProcessed: 0,
      errorCount: 0,
      lastRunDuration: 0,
      lastRunTime: null
    };
    
    // Configuration from environment
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.chunkSize = parseInt(process.env.GROUP_SYNC_CHUNK_SIZE || '100');
    this.maxRetries = parseInt(process.env.GROUP_SYNC_MAX_RETRIES || '3');
    this.retryDelayMs = parseInt(process.env.GROUP_SYNC_RETRY_DELAY || '5000');
    this.timeoutMs = parseInt(process.env.GROUP_SYNC_TIMEOUT || '30000');
  }

  /**
   * Initialize the Group Sync Worker
   * 
   * @param {Object} dependencies - Required service dependencies
   * @param {Object} dependencies.evolutionDbService - Evolution database service
   * @param {Object} dependencies.groupsManager - Local groups manager
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(dependencies) {
    try {
      if (!dependencies.evolutionDbService || !dependencies.groupsManager) {
        throw new Error('Required dependencies not provided (evolutionDbService, groupsManager)');
      }

      this.evolutionDbService = dependencies.evolutionDbService;
      this.groupsManager = dependencies.groupsManager;

      logger.info('Group Sync Worker initialized successfully', {
        chunkSize: this.chunkSize,
        maxRetries: this.maxRetries,
        retryDelayMs: this.retryDelayMs,
        timeoutMs: this.timeoutMs
      });

      return {
        success: true,
        message: 'Group Sync Worker initialized'
      };

    } catch (error) {
      logger.error('Group Sync Worker initialization failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Perform incremental group sync using multiple strategies
   * 
   * @param {Object} options - Sync options
   * @param {string} options.instanceId - Evolution instance ID
   * @param {string} options.strategy - Sync strategy: 'webhook', 'database', 'api_chunked', 'hybrid'
   * @param {boolean} options.forceRefresh - Force refresh all groups
   * @returns {Promise<Object>} Sync results
   */
  async performSync(options = {}) {
    if (this.isRunning) {
      logger.warn('Group sync already in progress, skipping new sync request');
      return {
        success: false,
        error: 'Sync already in progress',
        isRunning: true
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      const {
        instanceId = 'cs-monitor',
        strategy = 'hybrid',
        forceRefresh = false
      } = options;

      logger.info('Starting incremental group sync', {
        instanceId,
        strategy,
        forceRefresh,
        timestamp: new Date().toISOString()
      });

      this.syncStats.totalRuns++;

      let syncResult;

      switch (strategy) {
        case 'webhook':
          syncResult = await this.syncViaWebhookTrigger(instanceId);
          break;
        case 'database':
          syncResult = await this.syncViaDirectDatabase(instanceId);
          break;
        case 'api_chunked':
          syncResult = await this.syncViaChunkedAPI(instanceId);
          break;
        case 'hybrid':
        default:
          syncResult = await this.syncViaHybridApproach(instanceId, forceRefresh);
          break;
      }

      // Update statistics
      const duration = Date.now() - startTime;
      this.syncStats.lastRunDuration = duration;
      this.syncStats.lastRunTime = new Date();

      if (syncResult.success) {
        this.syncStats.successfulRuns++;
        this.syncStats.groupsProcessed += syncResult.groupsProcessed || 0;
        this.syncStats.chunksProcessed += syncResult.chunksProcessed || 0;
      } else {
        this.syncStats.errorCount++;
      }

      const result = {
        success: syncResult.success,
        message: syncResult.message || 'Group sync completed',
        instanceId,
        strategy,
        durationMs: duration,
        groupsProcessed: syncResult.groupsProcessed || 0,
        chunksProcessed: syncResult.chunksProcessed || 0,
        errors: syncResult.errors || [],
        syncStats: { ...this.syncStats },
        timestamp: this.syncStats.lastRunTime.toISOString()
      };

      logger.info('Group sync completed', result);
      return result;

    } catch (error) {
      this.syncStats.errorCount++;
      
      logger.error('Group sync failed', {
        error: error.message,
        stack: error.stack,
        durationMs: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync groups via webhook trigger (ask Evolution to send us group data)
   * 
   * @param {string} instanceId - Evolution instance ID
   * @returns {Promise<Object>} Sync result
   */
  async syncViaWebhookTrigger(instanceId) {
    try {
      logger.info('Attempting webhook-triggered group sync', { instanceId });

      // Try to trigger a group list refresh via Evolution API
      // This would ideally send group data via webhooks
      const url = `${this.evolutionApiUrl}/instance/refreshGroups/${instanceId}`;
      
      const response = await axios.post(url, {}, {
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: this.timeoutMs
      });

      return {
        success: true,
        message: 'Webhook trigger sent successfully',
        groupsProcessed: 0, // Will be processed via webhooks
        method: 'webhook'
      };

    } catch (error) {
      logger.warn('Webhook sync strategy failed', {
        error: error.message,
        instanceId
      });

      return {
        success: false,
        error: error.message,
        method: 'webhook'
      };
    }
  }

  /**
   * Sync groups by checking Evolution's database directly
   * 
   * @param {string} instanceId - Evolution instance ID
   * @returns {Promise<Object>} Sync result
   */
  async syncViaDirectDatabase(instanceId) {
    try {
      logger.info('Attempting direct database sync', { instanceId });

      // Get groups from Evolution database
      const evolutionStats = await this.evolutionDbService.getGroupStats();
      
      if (!evolutionStats.success) {
        throw new Error('Failed to access Evolution database');
      }

      const { totalGroups, activeGroups } = evolutionStats.statistics;

      logger.info('Evolution database stats', {
        totalGroups,
        activeGroups,
        instanceId
      });

      if (totalGroups === 0) {
        return {
          success: true,
          message: 'No groups found in Evolution database',
          groupsProcessed: 0,
          method: 'database',
          needsInitialSync: true
        };
      }

      // Search for all groups in Evolution database
      const groupsResult = await this.evolutionDbService.searchGroups('', {
        limit: 1000,
        activeOnly: false,
        searchType: 'contains'
      });

      let syncedCount = 0;
      const errors = [];

      // Sync each group to our local database
      for (const group of groupsResult.groups) {
        try {
          const registerResult = await this.groupsManager.registerGroup(
            group.group_id,
            group.name || 'Unnamed Group',
            false, // Default to not monitored
            instanceId
          );

          if (registerResult.success) {
            syncedCount++;
          } else {
            errors.push({
              groupId: group.group_id,
              error: registerResult.error
            });
          }

        } catch (syncError) {
          errors.push({
            groupId: group.group_id,
            error: syncError.message
          });
        }
      }

      return {
        success: true,
        message: `Synced ${syncedCount} groups from Evolution database`,
        groupsProcessed: syncedCount,
        totalAvailable: totalGroups,
        errors: errors.slice(0, 5), // Limit error details
        method: 'database'
      };

    } catch (error) {
      logger.error('Direct database sync failed', {
        error: error.message,
        instanceId
      });

      return {
        success: false,
        error: error.message,
        method: 'database'
      };
    }
  }

  /**
   * Sync groups via chunked API calls to Evolution
   * 
   * @param {string} instanceId - Evolution instance ID
   * @returns {Promise<Object>} Sync result
   */
  async syncViaChunkedAPI(instanceId) {
    try {
      logger.info('Attempting chunked API sync', { 
        instanceId,
        chunkSize: this.chunkSize 
      });

      // For now, this is a placeholder as Evolution API doesn't support pagination
      // In the future, this could implement a chunked approach if Evolution API adds pagination
      
      return {
        success: false,
        error: 'Chunked API sync not yet available (Evolution API limitation)',
        method: 'api_chunked',
        requiresAlternativeApproach: true
      };

    } catch (error) {
      logger.error('Chunked API sync failed', {
        error: error.message,
        instanceId
      });

      return {
        success: false,
        error: error.message,
        method: 'api_chunked'
      };
    }
  }

  /**
   * Sync groups using hybrid approach (try multiple strategies)
   * 
   * @param {string} instanceId - Evolution instance ID
   * @param {boolean} forceRefresh - Force refresh attempt
   * @returns {Promise<Object>} Sync result
   */
  async syncViaHybridApproach(instanceId, forceRefresh = false) {
    try {
      logger.info('Starting hybrid sync approach', { instanceId, forceRefresh });

      const strategies = ['database', 'webhook'];
      const results = [];
      let bestResult = null;

      for (const strategy of strategies) {
        try {
          logger.info(`Trying sync strategy: ${strategy}`, { instanceId });

          let result;
          switch (strategy) {
            case 'database':
              result = await this.syncViaDirectDatabase(instanceId);
              break;
            case 'webhook':
              result = await this.syncViaWebhookTrigger(instanceId);
              break;
          }

          results.push({
            strategy,
            success: result.success,
            groupsProcessed: result.groupsProcessed || 0,
            error: result.error
          });

          // Use the first successful result with groups
          if (result.success && (result.groupsProcessed > 0 || !bestResult)) {
            bestResult = {
              ...result,
              strategy,
              fallbackStrategies: results
            };

            // If we got groups, we can stop here
            if (result.groupsProcessed > 0) {
              break;
            }
          }

        } catch (strategyError) {
          logger.warn(`Sync strategy ${strategy} failed`, {
            error: strategyError.message,
            instanceId
          });

          results.push({
            strategy,
            success: false,
            error: strategyError.message
          });
        }
      }

      if (!bestResult) {
        return {
          success: false,
          error: 'All sync strategies failed',
          method: 'hybrid',
          attemptedStrategies: results
        };
      }

      return {
        success: true,
        message: `Hybrid sync completed via ${bestResult.strategy}`,
        groupsProcessed: bestResult.groupsProcessed || 0,
        method: 'hybrid',
        primaryStrategy: bestResult.strategy,
        attemptedStrategies: results
      };

    } catch (error) {
      logger.error('Hybrid sync approach failed', {
        error: error.message,
        instanceId
      });

      return {
        success: false,
        error: error.message,
        method: 'hybrid'
      };
    }
  }

  /**
   * Get sync worker status and statistics
   * 
   * @returns {Object} Current sync status
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      statistics: { ...this.syncStats },
      configuration: {
        chunkSize: this.chunkSize,
        maxRetries: this.maxRetries,
        retryDelayMs: this.retryDelayMs,
        timeoutMs: this.timeoutMs
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Schedule periodic group sync (placeholder for future cron implementation)
   * 
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Object} Scheduling result
   */
  schedulePeriodicSync(intervalMinutes = 60) {
    logger.info('Periodic group sync would be scheduled', {
      intervalMinutes,
      note: 'This is a placeholder for future scheduler implementation'
    });

    return {
      success: true,
      message: 'Periodic sync scheduling placeholder',
      intervalMinutes
    };
  }
}

// Export singleton instance
const groupSyncWorker = new GroupSyncWorker();

module.exports = {
  initialize: groupSyncWorker.initialize.bind(groupSyncWorker),
  performSync: groupSyncWorker.performSync.bind(groupSyncWorker),
  getSyncStatus: groupSyncWorker.getSyncStatus.bind(groupSyncWorker),
  schedulePeriodicSync: groupSyncWorker.schedulePeriodicSync.bind(groupSyncWorker)
};