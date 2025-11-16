/**
 * @file groups-manager.js
 * @description WhatsApp Groups Manager for CS Ticket System
 * @module ai-cs/modules/groups-manager
 * @requires sequelize
 * @requires ../src/utils/logger
 * @exports GroupsManager
 * @author PAI System - CS Module (Group Management)
 * @since November 2025
 */

const { Sequelize, DataTypes } = require('sequelize');
const logger = require('../../src/utils/logger');

/**
 * CS Monitored Groups Model
 * Sequelize model for tracking WhatsApp groups and their monitoring status
 */
let CSMonitoredGroup;

/**
 * WhatsApp Groups Manager
 * Handles discovery, tracking, and selection of WhatsApp groups for CS monitoring
 * 
 * @class GroupsManager
 */
class GroupsManager {
  constructor() {
    this.initialized = false;
    this.sequelize = null;
    this.defaultInstanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';
  }

  /**
   * Initialize the Groups Manager with database connection
   * 
   * @param {Object} sequelize - Sequelize database instance
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(sequelize) {
    try {
      this.sequelize = sequelize;

      // Define the CSMonitoredGroup model
      CSMonitoredGroup = sequelize.define('CSMonitoredGroup', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        group_id: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          comment: 'WhatsApp group ID (e.g., 123456789@g.us)'
        },
        group_name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Human-readable group name'
        },
        is_monitored: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether this group is being monitored for CS tickets'
        },
        instance_id: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: this.defaultInstanceId,
          comment: 'Evolution API instance ID'
        },
        first_seen: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          comment: 'When this group was first detected'
        },
        last_activity: {
          type: DataTypes.DATE,
          comment: 'Last time a message was seen from this group'
        }
      }, {
        tableName: 'cs_monitored_groups',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['group_id'] },
          { fields: ['instance_id'] },
          { fields: ['is_monitored'] }
        ]
      });

      this.initialized = true;
      logger.info('Groups Manager initialized successfully', {
        defaultInstanceId: this.defaultInstanceId
      });

      return {
        success: true,
        message: 'Groups Manager initialized'
      };

    } catch (error) {
      logger.error('Failed to initialize Groups Manager', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register a WhatsApp group (auto-discovery from incoming messages)
   * Updates last_activity if group exists, creates new record if not
   * 
   * @param {string} groupId - WhatsApp group ID (e.g., 123456789@g.us)
   * @param {string} groupName - Human-readable group name
   * @param {string} instanceId - Evolution API instance ID
   * @returns {Promise<Object>} Registration result
   */
  async registerGroup(groupId, groupName, instanceId = this.defaultInstanceId) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      const now = new Date();

      // Try to find existing group
      const [group, created] = await CSMonitoredGroup.findOrCreate({
        where: { group_id: groupId },
        defaults: {
          group_id: groupId,
          group_name: groupName,
          instance_id: instanceId,
          first_seen: now,
          last_activity: now,
          is_monitored: false // Default to not monitored
        }
      });

      if (!created) {
        // Update existing group
        await group.update({
          group_name: groupName, // Update name in case it changed
          last_activity: now,
          instance_id: instanceId
        });

        logger.debug('Updated existing group registration', {
          groupId,
          groupName,
          isMonitored: group.is_monitored
        });
      } else {
        logger.info('Registered new WhatsApp group', {
          groupId,
          groupName,
          instanceId,
          isMonitored: false
        });
      }

      return {
        success: true,
        group: {
          id: group.id,
          groupId: group.group_id,
          groupName: group.group_name,
          isMonitored: group.is_monitored,
          instanceId: group.instance_id,
          firstSeen: group.first_seen,
          lastActivity: group.last_activity
        },
        created
      };

    } catch (error) {
      logger.error('Failed to register WhatsApp group', {
        groupId,
        groupName,
        instanceId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all registered WhatsApp groups
   * 
   * @param {string} instanceId - Filter by instance ID (optional)
   * @returns {Promise<Object>} List of groups
   */
  async getAllGroups(instanceId = null) {
    logger.debug('getAllGroups called', {
      instanceId,
      initialized: this.initialized,
      hasSequelize: !!this.sequelize,
      hasCSMonitoredGroup: !!CSMonitoredGroup
    });

    try {
      logger.debug('Checking if Groups Manager is initialized');
      
      if (!this.initialized) {
        logger.error('Groups Manager not initialized', {
          initialized: this.initialized,
          sequelize: !!this.sequelize,
          model: !!CSMonitoredGroup,
          defaultInstanceId: this.defaultInstanceId
        });
        throw new Error('Groups Manager not initialized');
      }

      logger.debug('Groups Manager is initialized, proceeding with query');

      const whereClause = instanceId ? { instance_id: instanceId } : {};
      logger.debug('Database query parameters', {
        whereClause,
        modelAvailable: !!CSMonitoredGroup,
        tableName: CSMonitoredGroup?.tableName
      });

      logger.debug('Executing database query to find all groups');
      const groups = await CSMonitoredGroup.findAll({
        where: whereClause,
        order: [
          ['is_monitored', 'DESC'], // Monitored groups first
          ['last_activity', 'DESC'], // Most recent activity first
          ['group_name', 'ASC'] // Then alphabetically
        ]
      });

      logger.debug('Database query completed', {
        rawGroupsCount: groups?.length || 0,
        firstGroupSample: groups?.length > 0 ? {
          id: groups[0].id,
          group_id: groups[0].group_id,
          group_name: groups[0].group_name,
          is_monitored: groups[0].is_monitored
        } : null
      });

      const groupList = groups.map(group => ({
        id: group.id,
        groupId: group.group_id,
        groupName: group.group_name,
        isMonitored: group.is_monitored,
        instanceId: group.instance_id,
        firstSeen: group.first_seen,
        lastActivity: group.last_activity,
        createdAt: group.created_at,
        updatedAt: group.updated_at
      }));

      logger.info('Groups mapping completed', {
        totalGroups: groupList.length,
        monitoredGroups: groupList.filter(g => g.isMonitored).length,
        instanceId,
        sampleGroup: groupList.length > 0 ? groupList[0] : null
      });

      const result = {
        success: true,
        groups: groupList,
        summary: {
          total: groupList.length,
          monitored: groupList.filter(g => g.isMonitored).length,
          unmonitored: groupList.filter(g => !g.isMonitored).length
        }
      };

      logger.info('getAllGroups returning success result', {
        success: result.success,
        groupsCount: result.groups.length,
        summary: result.summary
      });

      return result;

    } catch (error) {
      logger.error('Failed to get all groups - detailed error', {
        instanceId,
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
        initialized: this.initialized,
        sequelize: !!this.sequelize,
        modelDefined: !!CSMonitoredGroup
      });

      const errorResult = {
        success: false,
        error: error.message,
        groups: [],
        debugInfo: {
          initialized: this.initialized,
          hasSequelize: !!this.sequelize,
          hasModel: !!CSMonitoredGroup,
          errorType: error.name
        }
      };

      logger.error('getAllGroups returning error result', errorResult);

      return errorResult;
    }
  }

  /**
   * Get only monitored WhatsApp groups (for webhook filtering)
   * 
   * @param {string} instanceId - Filter by instance ID (optional)
   * @returns {Promise<Array<string>>} Array of monitored group IDs
   */
  async getMonitoredGroupIds(instanceId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      const whereClause = { 
        is_monitored: true,
        ...(instanceId && { instance_id: instanceId })
      };

      const groups = await CSMonitoredGroup.findAll({
        where: whereClause,
        attributes: ['group_id']
      });

      const groupIds = groups.map(group => group.group_id);

      logger.debug('Retrieved monitored group IDs', {
        count: groupIds.length,
        instanceId,
        groupIds: groupIds.slice(0, 5) // Log first 5 for debugging
      });

      return groupIds;

    } catch (error) {
      logger.error('Failed to get monitored group IDs', {
        instanceId,
        error: error.message
      });

      return [];
    }
  }

  /**
   * Toggle monitoring status for a WhatsApp group
   * 
   * @param {string} groupId - WhatsApp group ID
   * @param {boolean} isMonitored - New monitoring status
   * @returns {Promise<Object>} Toggle result
   */
  async toggleGroupMonitoring(groupId, isMonitored) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      const group = await CSMonitoredGroup.findOne({
        where: { group_id: groupId }
      });

      if (!group) {
        return {
          success: false,
          error: 'Group not found'
        };
      }

      await group.update({
        is_monitored: isMonitored
      });

      logger.info('Toggled group monitoring status', {
        groupId,
        groupName: group.group_name,
        oldStatus: !isMonitored,
        newStatus: isMonitored
      });

      return {
        success: true,
        group: {
          id: group.id,
          groupId: group.group_id,
          groupName: group.group_name,
          isMonitored: group.is_monitored,
          instanceId: group.instance_id
        }
      };

    } catch (error) {
      logger.error('Failed to toggle group monitoring', {
        groupId,
        isMonitored,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a group is being monitored (for webhook filtering)
   * 
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<boolean>} True if group is monitored
   */
  async isGroupMonitored(groupId) {
    try {
      if (!this.initialized) {
        logger.warn('Groups Manager not initialized, allowing all groups');
        return true; // Default to allowing all groups if not initialized
      }

      const group = await CSMonitoredGroup.findOne({
        where: { 
          group_id: groupId,
          is_monitored: true
        }
      });

      return !!group;

    } catch (error) {
      logger.error('Failed to check if group is monitored', {
        groupId,
        error: error.message
      });

      // On error, default to allowing the group to prevent message loss
      return true;
    }
  }

  /**
   * Bulk update monitoring status for multiple groups
   * 
   * @param {Array<Object>} updates - Array of {groupId, isMonitored} objects
   * @returns {Promise<Object>} Bulk update result
   */
  async bulkUpdateMonitoring(updates) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      const results = {
        successful: [],
        failed: []
      };

      for (const update of updates) {
        const result = await this.toggleGroupMonitoring(update.groupId, update.isMonitored);
        
        if (result.success) {
          results.successful.push({
            groupId: update.groupId,
            isMonitored: update.isMonitored
          });
        } else {
          results.failed.push({
            groupId: update.groupId,
            error: result.error
          });
        }
      }

      logger.info('Bulk monitoring update completed', {
        total: updates.length,
        successful: results.successful.length,
        failed: results.failed.length
      });

      return {
        success: true,
        results,
        summary: {
          total: updates.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      };

    } catch (error) {
      logger.error('Failed to bulk update monitoring', {
        error: error.message,
        updatesCount: updates?.length || 0
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Discover and sync WhatsApp groups from Evolution API
   * Fetches all groups from the connected WhatsApp instance and registers them
   * 
   * @param {Object} evolutionService - Evolution service instance
   * @param {string} instanceId - WhatsApp instance ID
   * @returns {Promise<Object>} Discovery result with statistics
   */
  async discoverGroups(evolutionService, instanceId = null) {
    try {
      const targetInstanceId = instanceId || this.defaultInstanceId;
      logger.info('Starting group discovery', { instanceId: targetInstanceId });

      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      // Evolution service not needed since we make direct API calls

      // Fetch all groups from Evolution API
      let chats = [];
      try {
        const axios = require('axios');
        const config = require('../../src/config');
        
        // First try to fetch groups specifically using the correct v2.3.6 endpoint
        try {
          const groupsUrl = `${config.evolution.apiUrl}/group/fetchAllGroups/${targetInstanceId}`;
          logger.info('Attempting to fetch groups from Evolution API', {
            url: groupsUrl,
            instanceId: targetInstanceId,
            apiKey: config.evolution.apiKey ? 'present' : 'missing'
          });
          
          const groupsResponse = await axios.get(groupsUrl, {
            headers: { 
              'apikey': config.evolution.apiKey,
              'Content-Type': 'application/json'
            },
            params: {
              getParticipants: false // We only need group info, not participants
            },
            timeout: 30000 // 30 second timeout
          });
          
          logger.info('Evolution API fetchAllGroups response', {
            status: groupsResponse.status,
            dataType: typeof groupsResponse.data,
            dataLength: Array.isArray(groupsResponse.data) ? groupsResponse.data.length : 'not array',
            rawDataSample: JSON.stringify(groupsResponse.data).substring(0, 200),
            instanceId: targetInstanceId
          });
          
          chats = groupsResponse.data || [];
          logger.info('Fetched groups from Evolution API using fetchAllGroups endpoint', { 
            totalGroups: chats.length,
            instanceId: targetInstanceId 
          });
        } catch (groupsError) {
          logger.warn('fetchAllGroups endpoint failed, trying findChats with GET method', {
            error: groupsError.message,
            statusCode: groupsError.response?.status,
            responseData: groupsError.response?.data,
            instanceId: targetInstanceId
          });
          
          // Fallback to findChats endpoint with correct GET method
          const chatsUrl = `${config.evolution.apiUrl}/chat/findChats/${targetInstanceId}`;
          logger.debug('Attempting fallback to findChats endpoint', {
            url: chatsUrl,
            instanceId: targetInstanceId
          });
          
          const chatsResponse = await axios.get(chatsUrl, {
            headers: { 
              'apikey': config.evolution.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          });
          
          logger.debug('Evolution API findChats response', {
            status: chatsResponse.status,
            dataType: typeof chatsResponse.data,
            dataLength: Array.isArray(chatsResponse.data) ? chatsResponse.data.length : 'not array',
            rawDataSample: JSON.stringify(chatsResponse.data).substring(0, 200),
            instanceId: targetInstanceId
          });
          
          const allChats = chatsResponse.data || [];
          // Filter for groups only (IDs ending with @g.us)
          chats = allChats.filter(chat => chat.id && chat.id.endsWith('@g.us'));
          
          logger.info('Fetched chats from Evolution API and filtered for groups', { 
            totalChats: allChats.length,
            totalGroups: chats.length,
            groupSample: chats.slice(0, 3).map(c => ({ id: c.id, name: c.name || c.subject })),
            instanceId: targetInstanceId 
          });
        }
      } catch (error) {
        logger.error('Failed to fetch groups from Evolution API', {
          error: error.message,
          instanceId: targetInstanceId
        });
        throw new Error(`Failed to fetch chats: ${error.message}`);
      }

      // Filter for groups only
      const groups = chats.filter(chat => 
        chat.id && 
        chat.id.includes('@g.us') && // WhatsApp group ID format
        chat.name // Has a group name
      );

      logger.info('Filtered groups from chats', {
        totalChats: chats.length,
        groupsFound: groups.length,
        instanceId: targetInstanceId
      });

      // Register each discovered group
      let newGroups = 0;
      let updatedGroups = 0;
      let errors = [];

      for (const group of groups) {
        try {
          const existingGroup = await CSMonitoredGroup.findOne({
            where: { group_id: group.id }
          });

          if (existingGroup) {
            // Update existing group
            await existingGroup.update({
              group_name: group.name || existingGroup.group_name,
              last_activity: new Date(),
              updated_at: new Date()
            });
            updatedGroups++;
            logger.debug('Updated existing group', {
              groupId: group.id,
              groupName: group.name
            });
          } else {
            // Create new group
            await CSMonitoredGroup.create({
              group_id: group.id,
              group_name: group.name || 'Unknown Group',
              is_monitored: false, // Default to not monitored
              instance_id: targetInstanceId,
              first_seen: new Date(),
              last_activity: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            });
            newGroups++;
            logger.debug('Registered new group', {
              groupId: group.id,
              groupName: group.name
            });
          }
        } catch (error) {
          logger.error('Failed to register group', {
            groupId: group.id,
            groupName: group.name,
            error: error.message
          });
          errors.push({
            groupId: group.id,
            groupName: group.name,
            error: error.message
          });
        }
      }

      const result = {
        success: true,
        instanceId: targetInstanceId,
        statistics: {
          totalChatsFound: chats.length,
          groupsFound: groups.length,
          newGroups,
          updatedGroups,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      };

      logger.info('Group discovery completed', result);
      return result;

    } catch (error) {
      logger.error('Group discovery failed', {
        error: error.message,
        instanceId: instanceId || this.defaultInstanceId
      });

      return {
        success: false,
        error: error.message,
        instanceId: instanceId || this.defaultInstanceId
      };
    }
  }

  /**
   * Advanced search groups using PostgreSQL full-text search and LIKE queries
   * Efficiently searches through thousands of groups using database-level indexes
   * 
   * @param {string} searchTerm - Text to search for in group names
   * @param {Object} options - Search options
   * @param {string} options.instanceId - Filter by specific instance
   * @param {boolean} options.monitoredOnly - Only search monitored groups
   * @param {number} options.limit - Maximum results to return (default: 50)
   * @param {string} options.searchType - 'fulltext', 'like', or 'auto' (default: 'auto')
   * @returns {Promise<Object>} Search results
   */
  async searchGroups(searchTerm, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new Error('Search term must be at least 2 characters');
      }

      const {
        instanceId = null,
        monitoredOnly = false,
        limit = 50,
        searchType = 'auto'
      } = options;

      const cleanSearchTerm = searchTerm.trim();
      let searchQuery;
      let replacements = [];
      
      // Build WHERE clause for filtering
      let whereConditions = [];
      if (instanceId) {
        whereConditions.push('instance_id = ?');
        replacements.push(instanceId);
      }
      if (monitoredOnly) {
        whereConditions.push('is_monitored = true');
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Determine search strategy
      const useFullText = searchType === 'fulltext' || 
        (searchType === 'auto' && cleanSearchTerm.split(' ').length > 1);

      if (useFullText) {
        // Use PostgreSQL full-text search for multi-word queries
        const tsQuery = cleanSearchTerm
          .split(/\s+/)
          .map(word => word.trim())
          .filter(word => word.length > 0)
          .join(' & ');

        searchQuery = `
          SELECT id, group_id, group_name, is_monitored, instance_id, 
                 first_seen, last_activity, created_at, updated_at,
                 ts_rank(search_vector, to_tsquery('english', ?)) as relevance
          FROM cs_monitored_groups
          ${whereClause}
          ${whereConditions.length > 0 ? 'AND' : 'WHERE'} search_vector @@ to_tsquery('english', ?)
          ORDER BY relevance DESC, is_monitored DESC, group_name ASC
          LIMIT ?
        `;
        replacements.push(tsQuery, tsQuery, limit);
      } else {
        // Use case-insensitive LIKE search for single words or exact matching
        const likePattern = `%${cleanSearchTerm.toLowerCase()}%`;
        searchQuery = `
          SELECT id, group_id, group_name, is_monitored, instance_id,
                 first_seen, last_activity, created_at, updated_at,
                 CASE 
                   WHEN LOWER(group_name) = ? THEN 1.0
                   WHEN LOWER(group_name) LIKE ? THEN 0.8
                   WHEN LOWER(group_name) LIKE ? THEN 0.6
                   ELSE 0.4
                 END as relevance
          FROM cs_monitored_groups
          ${whereClause}
          ${whereConditions.length > 0 ? 'AND' : 'WHERE'} LOWER(group_name) LIKE ?
          ORDER BY relevance DESC, is_monitored DESC, group_name ASC
          LIMIT ?
        `;
        const exactMatch = cleanSearchTerm.toLowerCase();
        const startsWithPattern = `${exactMatch}%`;
        replacements.push(exactMatch, startsWithPattern, likePattern, likePattern, limit);
      }

      logger.debug('Executing group search query', {
        searchTerm: cleanSearchTerm,
        searchType: useFullText ? 'fulltext' : 'like',
        instanceId,
        monitoredOnly,
        limit,
        queryLength: searchQuery.length
      });

      const startTime = Date.now();
      const results = await this.sequelize.query(searchQuery, {
        replacements,
        type: this.sequelize.QueryTypes.SELECT
      });
      const searchTime = Date.now() - startTime;

      // Transform results to match expected format
      const groups = results.map(row => ({
        id: row.id,
        groupId: row.group_id,
        groupName: row.group_name,
        isMonitored: row.is_monitored,
        instanceId: row.instance_id,
        firstSeen: row.first_seen,
        lastActivity: row.last_activity,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        relevance: parseFloat(row.relevance || 0)
      }));

      logger.info('Group search completed successfully', {
        searchTerm: cleanSearchTerm,
        searchType: useFullText ? 'fulltext' : 'like',
        resultsFound: groups.length,
        searchTimeMs: searchTime,
        topResults: groups.slice(0, 3).map(g => ({
          name: g.groupName,
          relevance: g.relevance
        }))
      });

      return {
        success: true,
        groups,
        searchTerm: cleanSearchTerm,
        searchType: useFullText ? 'fulltext' : 'like',
        searchTimeMs: searchTime,
        summary: {
          resultsFound: groups.length,
          limit,
          searchOptions: options
        }
      };

    } catch (error) {
      logger.error('Group search failed', {
        searchTerm,
        options,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        searchTerm,
        groups: []
      };
    }
  }

  /**
   * Get search suggestions based on partial input
   * Useful for autocomplete functionality
   * 
   * @param {string} partialTerm - Partial search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of suggested group names
   */
  async getSearchSuggestions(partialTerm, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      if (!partialTerm || partialTerm.trim().length < 1) {
        return [];
      }

      const { limit = 10, instanceId = null } = options;
      const cleanTerm = partialTerm.trim().toLowerCase();
      
      let whereConditions = ['LOWER(group_name) LIKE ?'];
      let replacements = [`${cleanTerm}%`]; // Prefix matching

      if (instanceId) {
        whereConditions.push('instance_id = ?');
        replacements.push(instanceId);
      }

      const query = `
        SELECT DISTINCT group_name
        FROM cs_monitored_groups
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE WHEN LOWER(group_name) LIKE ? THEN 1 ELSE 2 END,
          LENGTH(group_name),
          group_name
        LIMIT ?
      `;
      
      replacements.push(`${cleanTerm}%`, limit);

      const results = await this.sequelize.query(query, {
        replacements,
        type: this.sequelize.QueryTypes.SELECT
      });

      return results.map(row => row.group_name);

    } catch (error) {
      logger.error('Failed to get search suggestions', {
        partialTerm,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get search performance statistics
   * 
   * @returns {Promise<Object>} Performance statistics
   */
  async getSearchStats() {
    try {
      if (!this.initialized) {
        throw new Error('Groups Manager not initialized');
      }

      const stats = await this.sequelize.query(`
        SELECT 
          COUNT(*) as total_groups,
          COUNT(CASE WHEN is_monitored = true THEN 1 END) as monitored_groups,
          COUNT(CASE WHEN search_vector IS NOT NULL THEN 1 END) as indexed_groups,
          COUNT(DISTINCT instance_id) as instances,
          AVG(LENGTH(group_name)) as avg_name_length,
          MIN(created_at) as oldest_group,
          MAX(created_at) as newest_group
        FROM cs_monitored_groups
      `, {
        type: this.sequelize.QueryTypes.SELECT
      });

      return {
        success: true,
        stats: stats[0],
        indexHealth: {
          fullyIndexed: stats[0].indexed_groups === stats[0].total_groups,
          indexCoverage: stats[0].total_groups > 0 
            ? (stats[0].indexed_groups / stats[0].total_groups * 100).toFixed(1)
            : 0
        }
      };

    } catch (error) {
      logger.error('Failed to get search stats', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get health status of Groups Manager
   * 
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    return {
      initialized: this.initialized,
      defaultInstanceId: this.defaultInstanceId,
      databaseConnected: !!this.sequelize,
      modelReady: !!CSMonitoredGroup
    };
  }
}

// Export singleton instance
const groupsManager = new GroupsManager();

module.exports = {
  initialize: groupsManager.initialize.bind(groupsManager),
  registerGroup: groupsManager.registerGroup.bind(groupsManager),
  getAllGroups: groupsManager.getAllGroups.bind(groupsManager),
  getMonitoredGroupIds: groupsManager.getMonitoredGroupIds.bind(groupsManager),
  toggleGroupMonitoring: groupsManager.toggleGroupMonitoring.bind(groupsManager),
  isGroupMonitored: groupsManager.isGroupMonitored.bind(groupsManager),
  bulkUpdateMonitoring: groupsManager.bulkUpdateMonitoring.bind(groupsManager),
  discoverGroups: groupsManager.discoverGroups.bind(groupsManager),
  searchGroups: groupsManager.searchGroups.bind(groupsManager),
  getSearchSuggestions: groupsManager.getSearchSuggestions.bind(groupsManager),
  getSearchStats: groupsManager.getSearchStats.bind(groupsManager),
  getHealthStatus: groupsManager.getHealthStatus.bind(groupsManager)
};