/**
 * @file group-indexer.js
 * @description Group Indexer Service for CS Ticket System
 * @module ai-cs/modules/group-indexer
 * @requires axios
 * @requires ../src/utils/logger
 * @exports GroupIndexer
 * @author PAI System - CS Module (Group Indexing)
 * @since November 2025
 */

const axios = require('axios');
const logger = require('../../src/utils/logger');

/**
 * Group Indexer Service
 * Handles periodic fetching and indexing of WhatsApp groups from Evolution API
 * Efficiently manages thousands of groups with batch processing and error recovery
 * 
 * @class GroupIndexer
 */
class GroupIndexer {
  constructor() {
    this.initialized = false;
    this.groupsManager = null;
    this.isIndexing = false;
    this.lastIndexTime = null;
    this.indexingStats = {
      totalRuns: 0,
      successfulRuns: 0,
      lastRunDuration: 0,
      groupsProcessed: 0,
      errorCount: 0
    };
    
    // Configuration from environment
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.defaultInstanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';
    this.batchSize = parseInt(process.env.GROUP_INDEX_BATCH_SIZE || '50');
    this.maxRetries = parseInt(process.env.GROUP_INDEX_MAX_RETRIES || '3');
  }

  /**
   * Initialize the Group Indexer
   * 
   * @param {Object} groupsManager - Groups Manager instance
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(groupsManager) {
    try {
      if (!groupsManager) {
        throw new Error('Groups Manager instance is required');
      }

      this.groupsManager = groupsManager;
      this.initialized = true;

      logger.info('Group Indexer initialized successfully', {
        evolutionApiUrl: this.evolutionApiUrl,
        defaultInstanceId: this.defaultInstanceId,
        batchSize: this.batchSize,
        maxRetries: this.maxRetries
      });

      return {
        success: true,
        message: 'Group Indexer initialized'
      };

    } catch (error) {
      logger.error('Group Indexer initialization failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch all groups from Evolution API for a specific instance
   * 
   * @param {string} instanceId - Evolution API instance ID
   * @returns {Promise<Array>} Array of groups
   */
  async fetchGroupsFromEvolution(instanceId = null) {
    try {
      const targetInstanceId = instanceId || this.defaultInstanceId;
      
      logger.debug('Fetching groups from Evolution API', {
        instanceId: targetInstanceId,
        evolutionApiUrl: this.evolutionApiUrl
      });

      const url = `${this.evolutionApiUrl}/group/fetchAllGroups/${targetInstanceId}`;
      const headers = {
        'apikey': this.apiKey,
        'Content-Type': 'application/json'
      };

      // Add query parameters for group fetching
      const params = {
        getParticipants: false // Don't fetch participants for performance
      };

      logger.debug('Making Evolution API request', {
        url,
        params,
        hasApiKey: !!this.apiKey
      });

      const response = await axios.get(url, {
        headers,
        params,
        timeout: 300000 // 300 second timeout for very large group lists (2k+ groups)
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(`Invalid response format from Evolution API: ${typeof response.data}`);
      }

      const groups = response.data.map(group => ({
        groupId: group.id,
        groupName: group.subject || 'Unnamed Group',
        size: group.size || 0,
        creation: group.creation || null,
        instanceId: targetInstanceId
      }));

      logger.info('Successfully fetched groups from Evolution API', {
        instanceId: targetInstanceId,
        groupsCount: groups.length,
        sampleGroups: groups.slice(0, 3).map(g => ({ 
          id: g.groupId, 
          name: g.groupName 
        }))
      });

      return groups;

    } catch (error) {
      logger.error('Failed to fetch groups from Evolution API', {
        instanceId: instanceId || this.defaultInstanceId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Index groups in batches to avoid overwhelming the database
   * 
   * @param {Array} groups - Groups to index
   * @returns {Promise<Object>} Indexing results
   */
  async indexGroupsBatch(groups) {
    try {
      if (!this.groupsManager) {
        throw new Error('Groups Manager not available');
      }

      let successCount = 0;
      let errorCount = 0;
      let updatedCount = 0;
      const errors = [];

      // Process groups in batches to avoid overwhelming the database
      for (let i = 0; i < groups.length; i += this.batchSize) {
        const batch = groups.slice(i, i + this.batchSize);
        
        logger.debug('Processing group batch', {
          batchNumber: Math.floor(i / this.batchSize) + 1,
          batchSize: batch.length,
          totalGroups: groups.length
        });

        for (const group of batch) {
          try {
            const registerResult = await this.groupsManager.registerGroup(
              group.groupId,
              group.groupName,
              false, // Default to not monitored
              group.instanceId
            );

            if (registerResult.success) {
              if (registerResult.action === 'created') {
                successCount++;
              } else if (registerResult.action === 'updated') {
                updatedCount++;
              }
            } else {
              errorCount++;
              errors.push({
                groupId: group.groupId,
                error: registerResult.error
              });
            }

          } catch (registerError) {
            errorCount++;
            errors.push({
              groupId: group.groupId,
              error: registerError.message
            });
            
            logger.error('Failed to register individual group', {
              groupId: group.groupId,
              groupName: group.groupName,
              error: registerError.message
            });
          }
        }

        // Small delay between batches to prevent overwhelming the database
        if (i + this.batchSize < groups.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const result = {
        totalGroups: groups.length,
        successCount,
        updatedCount,
        errorCount,
        errors: errorCount > 0 ? errors.slice(0, 10) : [] // Limit error details
      };

      logger.info('Group batch indexing completed', result);
      return result;

    } catch (error) {
      logger.error('Group batch indexing failed', {
        error: error.message,
        groupsCount: groups.length
      });

      throw error;
    }
  }

  /**
   * Perform a full index of all groups
   * 
   * @param {Object} options - Indexing options
   * @param {string} options.instanceId - Specific instance to index
   * @param {boolean} options.forceRefresh - Force refresh of all groups
   * @returns {Promise<Object>} Full indexing results
   */
  async performFullIndex(options = {}) {
    if (this.isIndexing) {
      logger.warn('Indexing already in progress, skipping new index request');
      return {
        success: false,
        error: 'Indexing already in progress',
        isIndexing: true
      };
    }

    this.isIndexing = true;
    const startTime = Date.now();
    
    try {
      const { instanceId = null, forceRefresh = false } = options;
      
      logger.info('Starting full group index', {
        instanceId: instanceId || this.defaultInstanceId,
        forceRefresh,
        timestamp: new Date().toISOString()
      });

      this.indexingStats.totalRuns++;

      // Step 1: Fetch groups from Evolution API
      const groups = await this.fetchGroupsFromEvolution(instanceId);

      if (groups.length === 0) {
        logger.warn('No groups found in Evolution API', {
          instanceId: instanceId || this.defaultInstanceId
        });
      }

      // Step 2: Index groups in batches
      const indexResult = await this.indexGroupsBatch(groups);

      // Step 3: Update statistics
      const duration = Date.now() - startTime;
      this.lastIndexTime = new Date();
      this.indexingStats.lastRunDuration = duration;
      this.indexingStats.groupsProcessed += indexResult.totalGroups;

      if (indexResult.errorCount === 0) {
        this.indexingStats.successfulRuns++;
      } else {
        this.indexingStats.errorCount += indexResult.errorCount;
      }

      const result = {
        success: true,
        message: 'Full group index completed successfully',
        instanceId: instanceId || this.defaultInstanceId,
        durationMs: duration,
        statistics: {
          groupsFound: groups.length,
          groupsCreated: indexResult.successCount,
          groupsUpdated: indexResult.updatedCount,
          errors: indexResult.errorCount
        },
        indexingStats: { ...this.indexingStats },
        timestamp: this.lastIndexTime.toISOString()
      };

      logger.info('Full group index completed', result);
      return result;

    } catch (error) {
      this.indexingStats.errorCount++;
      
      logger.error('Full group index failed', {
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
      this.isIndexing = false;
    }
  }

  /**
   * Get indexing status and statistics
   * 
   * @returns {Object} Current indexing status
   */
  getIndexingStatus() {
    return {
      initialized: this.initialized,
      isIndexing: this.isIndexing,
      lastIndexTime: this.lastIndexTime,
      statistics: { ...this.indexingStats },
      configuration: {
        evolutionApiUrl: this.evolutionApiUrl,
        defaultInstanceId: this.defaultInstanceId,
        batchSize: this.batchSize,
        maxRetries: this.maxRetries
      }
    };
  }

  /**
   * Schedule periodic indexing (if needed for future implementation)
   * 
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Object} Scheduling result
   */
  schedulePeriodicIndexing(intervalMinutes = 30) {
    logger.info('Periodic indexing would be scheduled', {
      intervalMinutes,
      note: 'This is a placeholder for future cron/scheduler implementation'
    });

    return {
      success: true,
      message: 'Periodic indexing scheduling placeholder',
      intervalMinutes
    };
  }
}

// Export singleton instance
const groupIndexer = new GroupIndexer();

module.exports = {
  initialize: groupIndexer.initialize.bind(groupIndexer),
  fetchGroupsFromEvolution: groupIndexer.fetchGroupsFromEvolution.bind(groupIndexer),
  indexGroupsBatch: groupIndexer.indexGroupsBatch.bind(groupIndexer),
  performFullIndex: groupIndexer.performFullIndex.bind(groupIndexer),
  getIndexingStatus: groupIndexer.getIndexingStatus.bind(groupIndexer),
  schedulePeriodicIndexing: groupIndexer.schedulePeriodicIndexing.bind(groupIndexer)
};