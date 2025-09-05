/**
 * @file whatsapp.js
 * @description Core WhatsApp service for Evolution API integration
 * @module services/whatsapp/whatsapp
 * @requires axios
 * @requires ../config
 * @requires ../utils/logger
 * @exports WhatsAppService
 * @author PAI System
 * @since September 2025
 */

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * WhatsApp service for Evolution API integration
 * Handles message sending, receiving, and connection management
 * Supports both PAI Responder (main line) and PAI Assistant (query line)
 * 
 * @class WhatsAppService
 * @example
 * const whatsapp = new WhatsAppService();
 * await whatsapp.sendMessage('1234567890@s.whatsapp.net', 'Hello!');
 */
class WhatsAppService {
  constructor(customConfig = null) {
    const evolutionConfig = customConfig?.evolution || config.evolution;
    this.baseURL = evolutionConfig.apiUrl;
    this.apiKey = evolutionConfig.apiKey;
    this.instanceId = evolutionConfig.instanceId;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      timeout: 30000,
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Evolution API Response', {
          method: response.config.method,
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('Evolution API Error', {
          method: error.config?.method,
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Send text message to a contact
   * @param {string} phone - Phone number with country code
   * @param {string} message - Text message to send
   * @param {object} options - Additional options
   * @returns {Promise<object>} Response from Evolution API
   */
  async sendMessage(phone, message, options = {}) {
    try {
      // Evolution API v2 format
      const payload = {
        number: phone,
        text: message,
        ...options,
      };

      const response = await this.client.post(
        `/message/sendText/${this.instanceId}`,
        payload,
      );

      logger.info('Message sent successfully', {
        phone,
        messageLength: message.length,
        messageId: response.data?.key?.id,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send message', {
        phone,
        message: error.message,
        status: error.response?.status,
      });
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send media message (image, document, etc.)
   * @param {string} phone - Phone number with country code
   * @param {string} mediaUrl - URL of the media to send
   * @param {string} mediaType - Type of media (image, document, audio, video)
   * @param {string} caption - Optional caption for media
   * @returns {Promise<object>} Response from Evolution API
   */
  async sendMedia(phone, mediaUrl, mediaType = 'image', caption = '') {
    try {
      const payload = {
        number: phone,
        mediaMessage: {
          mediatype: mediaType,
          media: mediaUrl,
          ...(caption && { caption }),
        },
      };

      const response = await this.client.post(
        `/message/sendMedia/${this.instanceId}`,
        payload,
      );

      logger.info('Media message sent successfully', {
        phone,
        mediaType,
        mediaUrl,
        messageId: response.data?.key?.id,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send media message', {
        phone,
        mediaType,
        mediaUrl,
        message: error.message,
      });
      throw new Error(`Failed to send media: ${error.message}`);
    }
  }

  /**
   * Set webhook URL for receiving messages
   * @param {string} webhookUrl - URL to receive webhook events
   * @param {object} events - Events to subscribe to
   * @returns {Promise<object>} Response from Evolution API
   */
  async setWebhook(webhookUrl, events = ['messages.upsert']) {
    try {
      const payload = {
        webhook: {
          url: webhookUrl,
          events,
        },
      };

      const response = await this.client.post(
        `/webhook/set/${this.instanceId}`,
        payload,
      );

      logger.info('Webhook set successfully', {
        webhookUrl,
        events,
        instanceId: this.instanceId,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to set webhook', {
        webhookUrl,
        message: error.message,
      });
      throw new Error(`Failed to set webhook: ${error.message}`);
    }
  }

  /**
   * Get webhook configuration
   * @returns {Promise<object>} Current webhook configuration
   */
  async getWebhook() {
    try {
      const response = await this.client.get(`/webhook/find/${this.instanceId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get webhook config', {
        message: error.message,
      });
      throw new Error(`Failed to get webhook: ${error.message}`);
    }
  }

  /**
   * Get instance status
   * @returns {Promise<object>} Instance status information
   */
  async getInstanceStatus() {
    try {
      const response = await this.client.get(`/instance/connectionState/${this.instanceId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get instance status', {
        message: error.message,
      });
      throw new Error(`Failed to get instance status: ${error.message}`);
    }
  }

  /**
   * Check if a phone number is registered on WhatsApp
   * @param {string} phone - Phone number to check
   * @returns {Promise<boolean>} True if registered
   */
  async checkPhoneNumber(phone) {
    try {
      const response = await this.client.post(`/chat/whatsappNumbers/${this.instanceId}`, {
        numbers: [phone],
      });

      const result = response.data?.[0];
      return result?.exists === true;
    } catch (error) {
      logger.error('Failed to check phone number', {
        phone,
        message: error.message,
      });
      return false;
    }
  }

  /**
   * Mark message as read
   * @param {string} messageKey - Message key from webhook
   * @returns {Promise<object>} Response from Evolution API
   */
  async markAsRead(messageKey) {
    try {
      const response = await this.client.put(`/chat/markMessageAsRead/${this.instanceId}`, {
        read: {
          key: messageKey,
        },
      });

      logger.debug('Message marked as read', { messageKey });
      return response.data;
    } catch (error) {
      logger.error('Failed to mark message as read', {
        messageKey,
        message: error.message,
      });
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Get QR code for connecting WhatsApp
   * @returns {Promise<object>} QR code data
   */
  async getQRCode() {
    try {
      const response = await this.client.get(`/instance/connect/${this.instanceId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get QR code', {
        message: error.message,
      });
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }

  /**
   * Send presence update (typing, recording, etc.)
   * @param {string} phone - Phone number
   * @param {string} presence - Presence type (composing, recording, paused)
   * @returns {Promise<object>} Response from Evolution API
   */
  async updatePresence(phone, presence = 'composing') {
    try {
      const response = await this.client.put(`/chat/presence/${this.instanceId}`, {
        number: phone,
        presence,
      });

      logger.debug('Presence updated', { phone, presence });
      return response.data;
    } catch (error) {
      logger.error('Failed to update presence', {
        phone,
        presence,
        message: error.message,
      });
      throw new Error(`Failed to update presence: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature (if webhook secret is configured)
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Signature from header
   * @returns {boolean} True if signature is valid
   */
  validateWebhookSignature(payload, signature) {
    // Evolution API doesn't send signed webhooks, so we skip validation
    logger.debug('Webhook signature validation skipped for Evolution API');
    return true;

    // Original code kept for reference if needed in future
    /*
    if (!this.webhookSecret && !config.evolution.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping signature validation');
      return true;
    }
    */

    try {
      // eslint-disable-next-line global-require
      const crypto = require('crypto');
      const secret = this.webhookSecret || config.evolution.webhookSecret;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      logger.error('Failed to validate webhook signature', {
        message: error.message,
      });
      return false;
    }
  }

  /**
   * Parse incoming webhook message
   * @param {object} webhookData - Raw webhook data
   * @returns {object|null} Parsed message data or null if not a valid message
   */
  parseWebhookMessage(webhookData) {
    // Method uses instance context
    const serviceLogger = this.baseURL ? logger : logger;
    try {
      if (!webhookData.data || !webhookData.data.key) {
        return null;
      }

      const message = webhookData.data;
      const messageKey = message.key;

      // Skip messages from our own instance
      if (messageKey.fromMe) {
        return null;
      }

      const messageType = message.messageType || 'text';
      let content = '';
      let mediaUrl = null;
      let mediaType = null;

      // Extract content based on message type
      switch (messageType) {
        case 'conversation':
        case 'extendedTextMessage':
          content = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
          break;
        case 'imageMessage':
          content = message.message?.imageMessage?.caption || '';
          mediaUrl = message.message?.imageMessage?.url;
          mediaType = 'image';
          break;
        case 'audioMessage':
          content = 'Audio message';
          mediaUrl = message.message?.audioMessage?.url;
          mediaType = 'audio';
          break;
        case 'videoMessage':
          content = message.message?.videoMessage?.caption || 'Video message';
          mediaUrl = message.message?.videoMessage?.url;
          mediaType = 'video';
          break;
        case 'documentMessage':
          content = message.message?.documentMessage?.title || 'Document';
          mediaUrl = message.message?.documentMessage?.url;
          mediaType = 'document';
          break;
        default:
          content = `Unsupported message type: ${messageType}`;
      }

      // Determine if this is a group message and extract proper contact info
      const fullRemoteJid = messageKey.remoteJid;
      const isGroupMessage = fullRemoteJid.includes('@g.us');
      const phone = fullRemoteJid.replace('@s.whatsapp.net', '');

      // Extract group name if available in the webhook data
      let groupName = null;
      if (isGroupMessage) {
        // The pushName in group messages is actually the participant name
        // Group name might be in different places depending on Evolution API version
        groupName = message.groupSubject || message.groupName || webhookData.groupSubject || null;

        // Log what we found for debugging
        if (groupName) {
          serviceLogger.debug('Found group name in webhook data', {
            groupId: fullRemoteJid,
            groupName,
          });
        }
      }

      // For group messages, we'll use the group ID as phone and let the message processor
      // handle fetching the actual group name if not provided
      return {
        messageId: messageKey.id,
        phone,
        content,
        messageType,
        mediaUrl,
        mediaType,
        timestamp: message.messageTimestamp || Date.now(),
        pushName: message.pushName || null,
        key: messageKey,
        isGroupMessage,
        participantJid: isGroupMessage ? messageKey.participant : null,
        groupName,
      };
    } catch (error) {
      serviceLogger.error('Failed to parse webhook message', {
        error: error.message,
        webhookData,
      });
      return null;
    }
  }

  /**
   * Fetch all chats from Evolution API
   * @returns {Promise<Array>} List of chats
   */
  async fetchAllChats() {
    try {
      // Try different endpoints based on Evolution API version
      const endpoints = [
        `/chat/findChats/${this.instanceId}`,
        `/chat/fetchChats/${this.instanceId}`,
        `/chats/${this.instanceId}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint);
          if (response.data) {
            logger.debug('Fetched all chats from Evolution API', {
              endpoint,
              chatCount: response.data?.length || 0,
            });
            return response.data || [];
          }
        } catch (err) {
          // Try next endpoint
          continue;
        }
      }

      // If all endpoints fail, return empty array
      logger.warn('Could not fetch chats from any Evolution API endpoint');
      return [];
    } catch (error) {
      logger.error('Failed to fetch chats from Evolution API', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Fetch all contacts from Evolution API
   * @returns {Promise<Array>} List of contacts
   */
  async fetchAllContacts() {
    try {
      const response = await this.client.get(`/chat/findContacts/${this.instanceId}`);
      logger.debug('Fetched all contacts from Evolution API', {
        contactCount: response.data?.length || 0,
      });
      return response.data || [];
    } catch (error) {
      logger.error('Failed to fetch contacts from Evolution API', {
        error: error.message,
      });
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
  }

  /**
   * Fetch group information from Evolution API
   * @param {string} groupId - Group ID (phone number)
   * @returns {Promise<object>} Group information
   */
  async fetchGroupInfo(groupId) {
    try {
      const response = await this.client.get(`/group/participants/${this.instanceId}`, {
        params: { groupJid: groupId },
      });
      logger.debug('Fetched group info from Evolution API', {
        groupId,
        participantCount: response.data?.participants?.length || 0,
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch group info from Evolution API', {
        groupId,
        error: error.message,
      });
      throw new Error(`Failed to fetch group info: ${error.message}`);
    }
  }

  /**
   * Fetch group name from Evolution API chat list
   * @param {string} groupId - Group ID with @g.us suffix
   * @returns {Promise<string>} Group name or null
   */
  async fetchGroupName(groupId) {
    try {
      // For now, since Evolution API v2 doesn't expose group metadata easily,
      // we'll need to rely on storing group names when we sync chats
      // or when we receive messages with group information

      // Try to get from cached chats first
      const chats = await this.fetchAllChats();
      const groupChat = chats.find((chat) => chat.id === groupId);

      if (groupChat && (groupChat.name || groupChat.subject)) {
        const groupName = groupChat.name || groupChat.subject;
        logger.debug('Found group name from chat list', {
          groupId,
          groupName,
        });
        return groupName;
      }

      // Return a fallback name based on the group ID
      // Extract a readable part from the group ID if possible
      const idParts = groupId.split('-');
      if (idParts.length > 1) {
        // For groups like "573108952363-1412634308@g.us", use the first part
        return `Group ${idParts[0].substring(0, 6)}...`;
      }

      logger.warn('Could not fetch group name, using fallback', { groupId });
      return 'Group Chat';
    } catch (error) {
      logger.error('Failed to fetch group name', {
        groupId,
        error: error.message,
      });
      return 'Group Chat';
    }
  }

  /**
   * Sync all chats with the database
   * @returns {Promise<object>} Sync results
   */
  async syncChatsWithDatabase() {
    try {
      const chats = await this.fetchAllChats();
      const conversationService = require('./conversation');

      let syncedCount = 0;
      let updatedCount = 0;

      for (const chat of chats) {
        try {
          // Determine if it's a group
          const isGroup = chat.id?.includes('@g.us') || false;
          const phone = chat.id;
          const name = chat.name || chat.pushName || chat.subject || (isGroup ? 'Group Chat' : phone);

          // Create or update contact
          const contact = await conversationService.findOrCreateContact(phone, {
            name,
            isGroup,
            metadata: {
              lastSyncAt: new Date(),
              evolutionChatData: chat,
            },
          });

          // Create conversation if it has messages
          if (chat.unreadCount || chat.lastMessageTimestamp) {
            await conversationService.findOrCreateConversation(contact.id, {
              priority: 'medium',
              category: isGroup ? 'other' : 'personal',
            });
            syncedCount++;
          }

          updatedCount++;
        } catch (chatError) {
          logger.error('Failed to sync individual chat', {
            chatId: chat.id,
            error: chatError.message,
          });
        }
      }

      logger.info('Chat sync completed', {
        totalChats: chats.length,
        syncedCount,
        updatedCount,
      });

      return {
        success: true,
        totalChats: chats.length,
        syncedCount,
        updatedCount,
      };
    } catch (error) {
      logger.error('Failed to sync chats with database', {
        error: error.message,
      });
      throw new Error(`Chat sync failed: ${error.message}`);
    }
  }
}

module.exports = WhatsAppService;
