/**
 * @file evolution-db-service.js
 * @description Direct PostgreSQL connection to Evolution API database for group data access
 * @module ai-cs/services/evolution-db-service
 * @requires pg
 * @requires ../../src/utils/logger
 * @exports EvolutionDatabaseService
 * @author PAI System - CS Module (Evolution DB Integration)
 * @since November 2025
 */

const { Pool } = require('pg');
const logger = require('../../src/utils/logger');

/**
 * Evolution Database Service
 * Provides direct access to Evolution API's PostgreSQL database for group operations
 * Bypasses Evolution API timeout limitations by querying the database directly
 * 
 * @class EvolutionDatabaseService
 */
class EvolutionDatabaseService {
  constructor() {
    this.pool = null;
    this.initialized = false;
    
    // Evolution database configuration from docker-compose.yml
    this.config = {
      host: 'localhost',
      port: 5433, // Evolution PostgreSQL port
      database: 'evolution_db',
      user: 'evolution',
      password: 'evolution123',
      max: 10, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: false
    };
    
    this.searchStats = {
      totalQueries: 0,
      totalResults: 0,
      averageResponseTimeMs: 0,
      lastQueryTime: null
    };
  }

  /**
   * Initialize the Evolution database connection
   * 
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      if (this.initialized) {
        return { success: true, message: 'Already initialized' };
      }

      // Create connection pool
      this.pool = new Pool(this.config);
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.initialized = true;

      logger.info('Evolution Database Service initialized successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        maxConnections: this.config.max
      });

      return {
        success: true,
        message: 'Evolution Database Service initialized'
      };

    } catch (error) {
      logger.error('Evolution Database Service initialization failed', {
        error: error.message,
        code: error.code,
        host: this.config.host,
        port: this.config.port
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search groups in Evolution's group_metadata table
   * 
   * @param {string} searchTerm - Search term for group names
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results (default: 50)
   * @param {boolean} options.activeOnly - Only active groups (default: true)
   * @param {string} options.searchType - Search type: 'exact', 'prefix', 'contains', 'fulltext'
   * @returns {Promise<Object>} Search results
   */
  async searchGroups(searchTerm, options = {}) {
    if (!this.initialized) {
      throw new Error('Evolution Database Service not initialized');
    }

    const startTime = Date.now();
    const {
      limit = 50,
      activeOnly = true,
      searchType = 'auto'
    } = options;

    try {
      const searchTermLower = searchTerm.toLowerCase();
      let query, queryParams;

      // Determine search type automatically if 'auto'
      const actualSearchType = searchType === 'auto' ? 
        (searchTermLower.length <= 2 ? 'prefix' : 'contains') : 
        searchType;

      switch (actualSearchType) {
        case 'exact':
          query = `
            SELECT 
              id, group_id, name, description, profile_picture,
              created_by, created_at_whatsapp, participants,
              metadata, last_synced, source, is_active,
              created_at, updated_at,
              1.0 as relevance
            FROM group_metadata
            WHERE LOWER(name) = $1
            ${activeOnly ? 'AND is_active = true' : ''}
            ORDER BY created_at DESC
            LIMIT $2
          `;
          queryParams = [searchTermLower, limit];
          break;

        case 'prefix':
          query = `
            SELECT 
              id, group_id, name, description, profile_picture,
              created_by, created_at_whatsapp, participants,
              metadata, last_synced, source, is_active,
              created_at, updated_at,
              CASE 
                WHEN LOWER(name) = $1 THEN 1.0
                WHEN LOWER(name) LIKE $3 THEN 0.8
                ELSE 0.6
              END as relevance
            FROM group_metadata
            WHERE (LOWER(name) LIKE $3 OR LOWER(name) = $1)
            ${activeOnly ? 'AND is_active = true' : ''}
            ORDER BY relevance DESC, created_at DESC
            LIMIT $2
          `;
          queryParams = [searchTermLower, limit, `${searchTermLower}%`];
          break;

        case 'contains':
          query = `
            SELECT 
              id, group_id, name, description, profile_picture,
              created_by, created_at_whatsapp, participants,
              metadata, last_synced, source, is_active,
              created_at, updated_at,
              CASE 
                WHEN LOWER(name) = $1 THEN 1.0
                WHEN LOWER(name) LIKE $3 THEN 0.8
                WHEN LOWER(name) LIKE $4 THEN 0.6
                ELSE 0.4
              END as relevance
            FROM group_metadata
            WHERE (
              LOWER(name) LIKE $4 OR 
              LOWER(name) LIKE $3 OR 
              LOWER(name) = $1 OR
              LOWER(description) LIKE $4
            )
            ${activeOnly ? 'AND is_active = true' : ''}
            ORDER BY relevance DESC, created_at DESC
            LIMIT $2
          `;
          queryParams = [searchTermLower, limit, `${searchTermLower}%`, `%${searchTermLower}%`];
          break;

        case 'fulltext':
          query = `
            SELECT 
              id, group_id, name, description, profile_picture,
              created_by, created_at_whatsapp, participants,
              metadata, last_synced, source, is_active,
              created_at, updated_at,
              ts_rank(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')), 
                      plainto_tsquery('english', $1)) as relevance
            FROM group_metadata
            WHERE to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) 
                  @@ plainto_tsquery('english', $1)
            ${activeOnly ? 'AND is_active = true' : ''}
            ORDER BY relevance DESC, created_at DESC
            LIMIT $2
          `;
          queryParams = [searchTerm, limit];
          break;

        default:
          throw new Error(`Invalid search type: ${actualSearchType}`);
      }

      logger.debug('Executing Evolution DB group search query', {
        searchTerm,
        searchType: actualSearchType,
        activeOnly,
        limit,
        queryLength: query.length
      });

      const result = await this.pool.query(query, queryParams);
      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      // Update statistics
      this.searchStats.totalQueries++;
      this.searchStats.totalResults += result.rows.length;
      this.searchStats.lastQueryTime = new Date().toISOString();
      this.searchStats.averageResponseTimeMs = 
        (this.searchStats.averageResponseTimeMs * (this.searchStats.totalQueries - 1) + responseTimeMs) / 
        this.searchStats.totalQueries;

      logger.info('Evolution DB group search completed', {
        searchTerm,
        searchType: actualSearchType,
        resultsFound: result.rows.length,
        searchTimeMs: responseTimeMs,
        topResults: result.rows.slice(0, 3).map(row => ({
          name: row.name,
          relevance: parseFloat(row.relevance).toFixed(2),
          id: row.group_id
        }))
      });

      return {
        success: true,
        groups: result.rows,
        searchTerm,
        searchType: actualSearchType,
        searchTimeMs: responseTimeMs,
        summary: {
          totalResults: result.rows.length,
          limit,
          searchOptions: {
            activeOnly,
            searchType: actualSearchType
          }
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Evolution DB group search failed', {
        searchTerm,
        error: error.message,
        searchTimeMs: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Get group count statistics from Evolution database
   * 
   * @returns {Promise<Object>} Group statistics
   */
  async getGroupStats() {
    if (!this.initialized) {
      throw new Error('Evolution Database Service not initialized');
    }

    try {
      const query = `
        SELECT 
          COUNT(*) as total_groups,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_groups,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_groups,
          MAX(created_at) as latest_group,
          MIN(created_at) as oldest_group,
          COUNT(CASE WHEN last_synced IS NOT NULL THEN 1 END) as synced_groups
        FROM group_metadata
      `;

      const result = await this.pool.query(query);
      const stats = result.rows[0];

      return {
        success: true,
        statistics: {
          totalGroups: parseInt(stats.total_groups),
          activeGroups: parseInt(stats.active_groups),
          inactiveGroups: parseInt(stats.inactive_groups),
          syncedGroups: parseInt(stats.synced_groups),
          latestGroup: stats.latest_group,
          oldestGroup: stats.oldest_group
        },
        searchStats: this.searchStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Evolution DB group stats failed', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get a specific group by ID from Evolution database
   * 
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<Object>} Group details
   */
  async getGroupById(groupId) {
    if (!this.initialized) {
      throw new Error('Evolution Database Service not initialized');
    }

    try {
      const query = `
        SELECT 
          id, group_id, name, description, profile_picture,
          created_by, created_at_whatsapp, participants,
          metadata, last_synced, source, is_active,
          created_at, updated_at
        FROM group_metadata
        WHERE group_id = $1
      `;

      const result = await this.pool.query(query, [groupId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Group not found',
          groupId
        };
      }

      return {
        success: true,
        group: result.rows[0],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Evolution DB get group failed', {
        groupId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Force sync a specific group from WhatsApp to Evolution database
   * This method would typically trigger a webhook or API call to refresh group data
   * 
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<Object>} Sync result
   */
  async syncGroupById(groupId) {
    // This would be implemented to trigger Evolution API to refresh a specific group
    // For now, it's a placeholder for future implementation
    logger.info('Group sync requested (placeholder)', { groupId });
    
    return {
      success: false,
      error: 'Group sync not yet implemented',
      groupId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Close the database connection pool
   * 
   * @returns {Promise<void>}
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.initialized = false;
      logger.info('Evolution Database Service connection closed');
    }
  }

  /**
   * Get service health status
   * 
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      if (!this.initialized) {
        return {
          healthy: false,
          error: 'Service not initialized',
          timestamp: new Date().toISOString()
        };
      }

      // Test database connectivity
      const result = await this.pool.query('SELECT 1 as test');
      
      return {
        healthy: true,
        initialized: this.initialized,
        connectionPool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        },
        searchStats: this.searchStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const evolutionDbService = new EvolutionDatabaseService();

module.exports = {
  initialize: evolutionDbService.initialize.bind(evolutionDbService),
  searchGroups: evolutionDbService.searchGroups.bind(evolutionDbService),
  getGroupStats: evolutionDbService.getGroupStats.bind(evolutionDbService),
  getGroupById: evolutionDbService.getGroupById.bind(evolutionDbService),
  syncGroupById: evolutionDbService.syncGroupById.bind(evolutionDbService),
  getHealthStatus: evolutionDbService.getHealthStatus.bind(evolutionDbService),
  close: evolutionDbService.close.bind(evolutionDbService)
};