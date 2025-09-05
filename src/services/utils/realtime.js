const { Server } = require('socket.io');
const logger = require('../../utils/logger');

class RealtimeService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://your-domain.com']
          : true,
        credentials: true,
      },
      path: '/socket.io',
    });

    this.setupEventHandlers();
    logger.info('Real-time service initialized');
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug('Client connected to real-time service', {
        socketId: socket.id,
        clientIP: socket.handshake.address,
      });

      this.connectedClients.set(socket.id, {
        socket,
        subscribedConversations: new Set(),
        connectedAt: new Date(),
      });

      // Handle conversation subscription
      socket.on('subscribe_conversation', (conversationId) => {
        logger.info('WEBSOCKET: Received subscription request', {
          socketId: socket.id,
          conversationId,
          timestamp: new Date().toISOString(),
        });

        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.subscribedConversations.add(conversationId);
          socket.join(`conversation_${conversationId}`);

          // Check room size after joining
          const roomName = `conversation_${conversationId}`;
          const roomSize = this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

          // Special logging for Assistant conversation
          const isAssistantConversation = conversationId === '00000000-0000-0000-0000-000000000001';
          if (isAssistantConversation) {
            logger.info('WEBSOCKET: Client subscribed to Assistant conversation', {
              socketId: socket.id,
              conversationId,
              roomName,
              roomSize,
              totalSubscriptions: client.subscribedConversations.size,
              allRooms: Array.from(this.io.sockets.adapter.rooms.keys()),
            });
          }

          logger.debug('WEBSOCKET: Client subscribed to conversation', {
            socketId: socket.id,
            conversationId,
            isAssistantConversation,
            roomSize,
            totalSubscriptions: client.subscribedConversations.size,
          });

          // Send confirmation back to client
          socket.emit('subscription_confirmed', {
            conversationId,
            roomSize,
            timestamp: new Date().toISOString(),
          });
        } else {
          logger.error('WEBSOCKET: Subscription failed - client not found', {
            socketId: socket.id,
            conversationId,
          });
        }
      });

      // Handle conversation unsubscription
      socket.on('unsubscribe_conversation', (conversationId) => {
        const client = this.connectedClients.get(socket.id);
        if (client) {
          client.subscribedConversations.delete(conversationId);
          socket.leave(`conversation_${conversationId}`);

          logger.debug('Client unsubscribed from conversation', {
            socketId: socket.id,
            conversationId,
          });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId,
          userId: 'agent',
          isTyping: true,
        });
      });

      socket.on('typing_stop', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId,
          userId: 'agent',
          isTyping: false,
        });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.debug('Client disconnected from real-time service', {
          socketId: socket.id,
          reason,
        });
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket.IO error', {
          socketId: socket.id,
          error: error.message,
        });
      });
    });
  }

  /**
   * Broadcast new message to subscribers
   */
  broadcastNewMessage(conversationId, message) {
    if (!this.io) {
      logger.warn('Cannot broadcast message - Socket.IO not initialized');
      return;
    }

    // Special logging for Assistant conversation
    const isAssistantConversation = conversationId === '00000000-0000-0000-0000-000000000001';
    const roomName = `conversation_${conversationId}`;
    const roomSize = this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

    if (isAssistantConversation) {
      logger.info('Broadcasting to Assistant conversation', {
        conversationId,
        messageId: message.id,
        sender: message.sender,
        roomName,
        connectedClients: this.connectedClients.size,
        roomSubscribers: roomSize,
        allRooms: Array.from(this.io.sockets.adapter.rooms.keys()),
      });
    }

    this.io.to(`conversation_${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });

    // Also broadcast to general conversation list updates
    this.io.emit('conversation_updated', {
      conversationId,
      lastMessage: message,
      lastMessageAt: message.createdAt,
    });

    logger.debug('Message broadcasted to subscribers', {
      conversationId,
      messageId: message.id,
      sender: message.sender,
      isAssistantConversation,
    });
  }

  /**
   * Broadcast message status update (delivered, read)
   */
  broadcastMessageStatus(conversationId, messageId, status) {
    if (!this.io) return;

    this.io.to(`conversation_${conversationId}`).emit('message_status_update', {
      conversationId,
      messageId,
      status,
      updatedAt: new Date(),
    });

    logger.debug('Message status update broadcasted', {
      conversationId,
      messageId,
      status,
    });
  }

  /**
   * Broadcast conversation update (assistant toggle, status change)
   */
  broadcastConversationUpdate(conversationId, updates) {
    if (!this.io) return;

    this.io.to(`conversation_${conversationId}`).emit('conversation_updated', {
      conversationId,
      updates,
      updatedAt: new Date(),
    });

    logger.debug('Conversation update broadcasted', {
      conversationId,
      updates: Object.keys(updates),
    });
  }

  /**
   * Broadcast typing indicator
   */
  broadcastTypingIndicator(conversationId, isTyping, sender = 'user') {
    if (!this.io) return;

    this.io.to(`conversation_${conversationId}`).emit('typing_indicator', {
      conversationId,
      sender,
      isTyping,
    });
  }

  /**
   * Get real-time statistics
   */
  getStats() {
    const connectedCount = this.connectedClients.size;
    const subscriptions = Array.from(this.connectedClients.values())
      .reduce((total, client) => total + client.subscribedConversations.size, 0);

    return {
      connectedClients: connectedCount,
      totalSubscriptions: subscriptions,
      rooms: this.io ? this.io.sockets.adapter.rooms.size : 0,
    };
  }

  /**
   * Send system notification to all clients
   */
  broadcastSystemNotification(notification) {
    if (!this.io) return;

    this.io.emit('system_notification', {
      ...notification,
      timestamp: new Date(),
    });

    logger.info('System notification broadcasted', {
      type: notification.type,
      message: notification.message,
    });
  }

  /**
   * Close real-time service
   */
  close() {
    if (this.io) {
      this.io.close();
      logger.info('Real-time service closed');
    }
    this.connectedClients.clear();
  }
}

// Export singleton instance
module.exports = new RealtimeService();
