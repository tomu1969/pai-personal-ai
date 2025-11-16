/**
 * @file history-fetcher.js
 * @description Service to fetch historical messages from WhatsApp groups via Evolution API
 * @module ai-cs/services/history-fetcher
 * @requires axios
 * @exports HistoryFetcher
 * @author PAI System - CS Module
 * @since November 2025
 */

const axios = require('axios');
const logger = require('../../src/utils/logger');

/**
 * History Fetcher Service
 * Fetches historical messages from WhatsApp groups using Evolution API
 * 
 * @class HistoryFetcher
 */
class HistoryFetcher {
  constructor() {
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.evolutionApiKey = process.env.EVOLUTION_API_KEY || 'pai_evolution_api_key_2025';
    this.instanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';
  }

  /**
   * Fetch all historical messages from a specific WhatsApp group
   * 
   * @param {string} groupId - WhatsApp group ID (remoteJid)
   * @param {Object} options - Additional options
   * @param {number} options.limit - Maximum number of messages to fetch
   * @returns {Promise<Object>} Messages data
   */
  async fetchGroupMessages(groupId, options = {}) {
    try {
      const { limit = 1000 } = options;

      logger.info('Fetching group messages from Evolution API', {
        groupId,
        instanceId: this.instanceId,
        limit
      });

      const response = await axios.post(
        `${this.evolutionApiUrl}/chat/findMessages/${this.instanceId}`,
        {
          where: {
            key: {
              remoteJid: groupId
            }
          },
          limit
        },
        {
          headers: {
            'apikey': this.evolutionApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const messagesData = response.data;
      
      logger.info('Evolution API messages fetched', {
        groupId,
        totalMessages: messagesData.messages?.total || 0,
        recordsReturned: messagesData.messages?.records?.length || 0
      });

      return {
        success: true,
        messages: messagesData.messages?.records || [],
        total: messagesData.messages?.total || 0,
        pages: messagesData.messages?.pages || 0,
        currentPage: messagesData.messages?.currentPage || 1
      };

    } catch (error) {
      logger.error('Failed to fetch group messages from Evolution API', {
        groupId,
        instanceId: this.instanceId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        messages: [],
        total: 0
      };
    }
  }

  /**
   * Transform Evolution API message format to our internal format
   * 
   * @param {Object} evolutionMessage - Raw message from Evolution API
   * @param {string} groupId - WhatsApp group ID
   * @param {string} groupName - WhatsApp group name
   * @returns {Object} Transformed message data
   */
  transformMessage(evolutionMessage, groupId, groupName) {
    try {
      // Extract message data from Evolution API format
      const messageData = evolutionMessage;
      const key = messageData.key || {};
      const message = messageData.message || {};
      
      // Get message content based on message type
      let textContent = '';
      let messageType = 'text';
      
      if (message.conversation) {
        textContent = message.conversation;
        messageType = 'text';
      } else if (message.extendedTextMessage?.text) {
        textContent = message.extendedTextMessage.text;
        messageType = 'text';
      } else if (message.imageMessage?.caption) {
        textContent = message.imageMessage.caption;
        messageType = 'image';
      } else if (message.documentMessage?.caption) {
        textContent = message.documentMessage.caption;
        messageType = 'document';
      } else if (message.audioMessage) {
        textContent = '[Audio Message]';
        messageType = 'audio';
      } else if (message.videoMessage?.caption) {
        textContent = message.videoMessage.caption;
        messageType = 'video';
      } else {
        textContent = '[Unsupported Message Type]';
        messageType = 'unknown';
      }

      // Extract sender information
      const senderJid = key.participant || key.remoteJid;
      const senderName = messageData.pushName || senderJid?.split('@')[0] || 'Unknown';
      
      // Generate unique message ID
      const messageId = `HIST_${key.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get timestamp
      const timestamp = messageData.messageTimestamp 
        ? new Date(parseInt(messageData.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      return {
        messageId,
        groupId,
        groupName,
        senderJid,
        senderName,
        textContent,
        messageType,
        timestamp,
        isFromMe: key.fromMe || false,
        rawData: messageData
      };

    } catch (error) {
      logger.error('Failed to transform Evolution message', {
        error: error.message,
        messageId: evolutionMessage?.key?.id
      });

      // Return a basic fallback message
      return {
        messageId: `HIST_ERROR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        groupId,
        groupName,
        senderJid: 'unknown',
        senderName: 'Unknown',
        textContent: '[Message Parse Error]',
        messageType: 'error',
        timestamp: new Date().toISOString(),
        isFromMe: false,
        rawData: evolutionMessage
      };
    }
  }

  /**
   * Force sync messages directly from WhatsApp for a specific group
   * Uses alternative Evolution API endpoints to fetch live messages
   * 
   * @param {string} groupId - WhatsApp group ID (remoteJid)
   * @param {Object} options - Additional options
   * @param {number} options.limit - Maximum number of messages to fetch (default: 500)
   * @returns {Promise<Object>} Messages data from WhatsApp
   */
  async forceSyncGroupMessages(groupId, options = {}) {
    try {
      const { limit = 500 } = options;

      logger.info('Force syncing group messages directly from WhatsApp', {
        groupId,
        instanceId: this.instanceId,
        limit
      });

      // Try multiple Evolution API endpoints for fetching messages
      const endpoints = [
        // Method 1: Use the same findMessages endpoint but with more aggressive parameters
        {
          method: 'POST',
          url: `${this.evolutionApiUrl}/chat/findMessages/${this.instanceId}`,
          data: {
            where: {
              key: {
                remoteJid: groupId
              }
            },
            limit: limit,
            offset: 0
          }
        },
        // Method 2: Try to get all messages without date filtering
        {
          method: 'POST',
          url: `${this.evolutionApiUrl}/chat/findMessages/${this.instanceId}`,
          data: {
            where: {
              key: {
                remoteJid: groupId
              },
              messageTimestamp: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
              }
            },
            limit: limit,
            offset: 0
          }
        },
        // Method 3: Try with minimal filtering
        {
          method: 'POST',
          url: `${this.evolutionApiUrl}/chat/findMessages/${this.instanceId}`,
          data: {
            where: {
              key: {
                remoteJid: groupId
              }
            },
            limit: Math.min(limit * 2, 1000), // Try with larger limit
            offset: 0
          }
        }
      ];

      let lastError = null;
      
      for (const endpoint of endpoints) {
        try {
          logger.debug(`Trying endpoint: ${endpoint.url}`, {
            method: endpoint.method,
            groupId
          });

          const response = await axios({
            method: endpoint.method,
            url: endpoint.url,
            data: endpoint.data,
            headers: {
              'apikey': this.evolutionApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 45000 // Longer timeout for WhatsApp sync
          });

          const messagesData = response.data;
          
          // Handle different response formats
          let messages = [];
          if (Array.isArray(messagesData)) {
            messages = messagesData;
          } else if (messagesData.messages) {
            messages = messagesData.messages;
          } else if (messagesData.data) {
            messages = messagesData.data;
          }

          logger.info('Force sync successful', {
            groupId,
            endpoint: endpoint.url,
            messagesFound: messages.length
          });

          return {
            success: true,
            messages: messages,
            total: messages.length,
            method: 'force_sync',
            endpoint: endpoint.url
          };

        } catch (endpointError) {
          lastError = endpointError;
          logger.warn(`Endpoint failed: ${endpoint.url}`, {
            error: endpointError.message,
            groupId
          });
          continue; // Try next endpoint
        }
      }

      // All endpoints failed
      throw lastError || new Error('All sync endpoints failed');

    } catch (error) {
      logger.error('Force sync failed for group', {
        groupId,
        instanceId: this.instanceId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        messages: [],
        total: 0,
        method: 'force_sync'
      };
    }
  }

  /**
   * Fetch messages with fallback strategy: try database first, then force sync
   * 
   * @param {string} groupId - WhatsApp group ID (remoteJid)
   * @param {Object} options - Additional options
   * @param {number} options.limit - Maximum number of messages to fetch
   * @param {boolean} options.forceSync - Skip database and force sync from WhatsApp
   * @returns {Promise<Object>} Messages data
   */
  async fetchGroupMessagesWithFallback(groupId, options = {}) {
    const { forceSync = false, limit = 500 } = options;

    try {
      // If not forcing sync, try database first
      if (!forceSync) {
        logger.info('Attempting database fetch first', { groupId });
        const dbResult = await this.fetchGroupMessages(groupId, { limit });
        
        if (dbResult.success && dbResult.messages.length > 0) {
          logger.info('Database fetch successful', {
            groupId,
            messagesFound: dbResult.messages.length
          });
          return { ...dbResult, method: 'database' };
        }
        
        logger.info('Database fetch returned no messages, trying force sync', {
          groupId,
          dbSuccess: dbResult.success,
          dbMessages: dbResult.messages.length
        });
      }

      // Fallback to force sync from WhatsApp
      logger.info('Attempting force sync from WhatsApp', { groupId });
      const syncResult = await this.forceSyncGroupMessages(groupId, { limit });
      
      if (syncResult.success) {
        logger.info('Force sync completed', {
          groupId,
          messagesFound: syncResult.messages.length,
          success: syncResult.success
        });
        return syncResult;
      }

      // Force sync failed
      return {
        success: false,
        error: syncResult.error || 'Force sync failed',
        messages: [],
        total: 0,
        method: 'force_sync_failed'
      };

    } catch (error) {
      logger.error('Fallback fetch strategy failed', {
        groupId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        messages: [],
        total: 0,
        method: 'error'
      };
    }
  }

  /**
   * Fetch and transform messages from multiple groups
   * 
   * @param {Array} groups - Array of group objects with groupId and groupName
   * @param {Object} options - Additional options
   * @param {boolean} options.forceSync - Force sync from WhatsApp instead of database
   * @returns {Promise<Object>} Combined results from all groups
   */
  async fetchAllGroupsHistory(groups, options = {}) {
    try {
      logger.info('Starting bulk history fetch for multiple groups', {
        groupCount: groups.length,
        instanceId: this.instanceId
      });

      const results = {
        success: true,
        groupsProcessed: 0,
        totalMessages: 0,
        groupResults: [],
        errors: []
      };

      // Process each group
      for (const group of groups) {
        try {
          logger.info(`Fetching history for group: ${group.groupName}`, {
            groupId: group.groupId,
            forceSync: options.forceSync
          });

          // Use fallback strategy: database first, then force sync
          const fetchResult = await this.fetchGroupMessagesWithFallback(group.groupId, options);
          
          if (fetchResult.success) {
            // Transform messages to our format (handle empty or missing messages array)
            const messages = Array.isArray(fetchResult.messages) ? fetchResult.messages : [];
            const transformedMessages = messages.map(msg => 
              this.transformMessage(msg, group.groupId, group.groupName)
            );

            results.groupResults.push({
              groupId: group.groupId,
              groupName: group.groupName,
              messagesProcessed: transformedMessages.length,
              messages: transformedMessages,
              success: true
            });

            results.totalMessages += transformedMessages.length;
            results.groupsProcessed++;

            logger.info(`Successfully processed group: ${group.groupName}`, {
              groupId: group.groupId,
              messagesFound: transformedMessages.length
            });

          } else {
            const errorMsg = `Failed to fetch messages for group ${group.groupName}: ${fetchResult.error}`;
            results.errors.push(errorMsg);
            
            results.groupResults.push({
              groupId: group.groupId,
              groupName: group.groupName,
              messagesProcessed: 0,
              messages: [],
              success: false,
              error: fetchResult.error
            });

            logger.warn(`Failed to fetch history for group: ${group.groupName}`, {
              groupId: group.groupId,
              error: fetchResult.error
            });
          }

        } catch (groupError) {
          const errorMsg = `Exception processing group ${group.groupName}: ${groupError.message}`;
          results.errors.push(errorMsg);
          
          logger.error('Exception processing individual group', {
            groupId: group.groupId,
            groupName: group.groupName,
            error: groupError.message
          });
        }
      }

      logger.info('Bulk history fetch completed', {
        groupsProcessed: results.groupsProcessed,
        totalGroups: groups.length,
        totalMessages: results.totalMessages,
        errors: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Failed to fetch history for multiple groups', {
        error: error.message,
        stack: error.stack,
        groupCount: groups.length
      });

      return {
        success: false,
        error: error.message,
        groupsProcessed: 0,
        totalMessages: 0,
        groupResults: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Get health status of the history fetcher service
   * 
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    return {
      service: 'HistoryFetcher',
      evolutionApiUrl: this.evolutionApiUrl,
      instanceId: this.instanceId,
      hasApiKey: !!this.evolutionApiKey,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new HistoryFetcher();