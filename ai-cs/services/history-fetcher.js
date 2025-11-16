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
   * Fetch and transform messages from multiple groups
   * 
   * @param {Array} groups - Array of group objects with groupId and groupName
   * @param {Object} options - Additional options
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
            groupId: group.groupId
          });

          const fetchResult = await this.fetchGroupMessages(group.groupId, options);
          
          if (fetchResult.success) {
            // Transform messages to our format
            const transformedMessages = fetchResult.messages.map(msg => 
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