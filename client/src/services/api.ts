import axios from 'axios';
import {
  ConversationsResponse,
  ConversationMessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  ConversationStats,
  SearchMessagesResponse,
} from '../types';

export interface AssistantConfig {
  id: string;
  enabled: boolean;
  ownerName: string;
  assistantName: string;
  systemPrompt: string;
  autoResponseTemplate: string;
  settings: Record<string, any>;
  updatedAt: string;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.debug('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.debug('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export const chatApi = {
  // Get conversations
  getConversations: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }): Promise<ConversationsResponse> =>
    api.get('/chat/', { params }).then((res) => res.data),

  // Get messages for a conversation
  getConversationMessages: (
    conversationId: string,
    params?: {
      limit?: number;
      offset?: number;
      before?: string;
    }
  ): Promise<ConversationMessagesResponse> =>
    api.get(`/chat/${conversationId}`, { params }).then((res) => res.data),

  // Send a message
  sendMessage: (
    conversationId: string,
    data: SendMessageRequest
  ): Promise<SendMessageResponse> =>
    api.post(`/chat/${conversationId}/messages`, data).then((res) => res.data),

  // Mark conversation as read
  markConversationAsRead: (conversationId: string): Promise<{ success: boolean }> =>
    api.patch(`/chat/${conversationId}/read`).then((res) => res.data),

  // Update conversation settings
  updateConversation: (
    conversationId: string,
    updates: {
      isAssistantEnabled?: boolean;
      status?: string;
    }
  ): Promise<{ success: boolean; conversation: any }> =>
    api.patch(`/chat/${conversationId}`, updates).then((res) => res.data),

  // Search messages
  searchMessages: (
    query: string,
    params?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<SearchMessagesResponse> =>
    api.get('/chat/search', { params: { q: query, ...params } }).then((res) => res.data),

  // Get conversation statistics
  getStats: (): Promise<ConversationStats> =>
    api.get('/chat/stats').then((res) => res.data),
};

export const assistantApi = {
  // Get assistant configuration
  getConfig: (): Promise<AssistantConfig> =>
    api.get('/assistant/config').then((res) => res.data),

  // Update assistant configuration
  updateConfig: (config: Partial<AssistantConfig>): Promise<AssistantConfig> =>
    api.put('/assistant/config', config).then((res) => res.data),

  // Get assistant status
  getStatus: (): Promise<any> =>
    api.get('/assistant/status').then((res) => res.data),

  // Toggle assistant on/off
  toggle: (enabled: boolean): Promise<{ success: boolean; enabled: boolean }> =>
    api.post('/assistant/toggle', { enabled }).then((res) => res.data),
};

// WhatsApp API
export const whatsappApi = {
  // Get WhatsApp connection status
  getConnectionStatus: (): Promise<{
    connected: boolean;
    state: string;
    instanceId: string | null;
    error?: string;
    timestamp: string;
  }> =>
    api.get('/whatsapp/status').then((res) => res.data),

  // Get QR code for WhatsApp connection
  getQRCode: (): Promise<{
    connected: boolean;
    qrCode?: string;
    qrCodeUrl?: string;
    instanceId?: string;
    message?: string;
    error?: string;
    timestamp: string;
  }> =>
    api.get('/whatsapp/qrcode').then((res) => res.data),
};

export default api;