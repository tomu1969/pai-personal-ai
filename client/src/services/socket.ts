import { io, Socket } from 'socket.io-client';
import { Message, TypingIndicator } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected, reusing existing connection');
      return this.socket;
    }

    console.log('🔌 Creating new socket connection to localhost:3000');
    this.socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.setupEventHandlers();
    console.log('🔌 Socket event handlers set up');
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscribers.clear();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Message events
    this.socket.on('new_message', (data: { conversationId: string; message: Message }) => {
      console.log('🔌 Received new_message event', {
        conversationId: data.conversationId,
        messageId: data.message?.id,
        sender: data.message?.sender,
        contentLength: data.message?.content?.length,
        timestamp: new Date().toISOString()
      });
      this.emit('new_message', data);
    });

    this.socket.on('message_status_update', (data: {
      conversationId: string;
      messageId: string;
      status: string;
      updatedAt: string;
    }) => {
      this.emit('message_status_update', data);
    });

    // Conversation events
    this.socket.on('conversation_updated', (data: {
      conversationId: string;
      updates?: any;
      lastMessage?: Message;
      lastMessageAt?: string;
      updatedAt: string;
    }) => {
      this.emit('conversation_updated', data);
    });

    // Typing events
    this.socket.on('typing_indicator', (data: TypingIndicator) => {
      this.emit('typing_indicator', data);
    });

    this.socket.on('user_typing', (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      this.emit('user_typing', data);
    });

    // System events
    this.socket.on('system_notification', (data: {
      type: string;
      message: string;
      timestamp: string;
    }) => {
      this.emit('system_notification', data);
    });

    // Subscription confirmation
    this.socket.on('subscription_confirmed', (data: {
      conversationId: string;
      roomSize: number;
      timestamp: string;
    }) => {
      console.log('🔌 Subscription confirmed by server', {
        conversationId: data.conversationId,
        roomSize: data.roomSize,
        timestamp: data.timestamp,
        clientTimestamp: new Date().toISOString()
      });
    });
  }

  // Subscribe to conversation updates
  subscribeToConversation(conversationId: string) {
    if (this.socket) {
      console.log('🔌 Emitting subscribe_conversation event', {
        conversationId,
        socketConnected: this.socket.connected,
        socketId: this.socket.id,
        timestamp: new Date().toISOString()
      });
      this.socket.emit('subscribe_conversation', conversationId);
      
      // Add a confirmation check
      setTimeout(() => {
        console.log('🔌 Subscription confirmation check', {
          conversationId,
          socketConnected: this.socket?.connected,
          timestamp: new Date().toISOString()
        });
      }, 200);
    } else {
      console.error('🔌 Cannot subscribe - socket not connected', { conversationId });
    }
  }

  // Unsubscribe from conversation updates
  unsubscribeFromConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('unsubscribe_conversation', conversationId);
    }
  }

  // Send typing indicators
  startTyping(conversationId: string) {
    if (this.socket) {
      this.socket.emit('typing_start', conversationId);
    }
  }

  stopTyping(conversationId: string) {
    if (this.socket) {
      this.socket.emit('typing_stop', conversationId);
    }
  }

  // Event subscription system
  on(event: string, callback: (data: any) => void) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventSubscribers = this.subscribers.get(event);
      if (eventSubscribers) {
        eventSubscribers.delete(callback);
        if (eventSubscribers.size === 0) {
          this.subscribers.delete(event);
        }
      }
    };
  }

  private emit(event: string, data: any) {
    const eventSubscribers = this.subscribers.get(event);
    if (eventSubscribers) {
      eventSubscribers.forEach(callback => callback(data));
    }
  }

  isConnected() {
    const connected = this.socket?.connected || false;
    console.log('🔌 isConnected() called, returning:', connected);
    return connected;
  }

  getConnectionStatus() {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'connecting';
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;