export interface Contact {
  id: string;
  name: string;
  phone: string;
  profilePicture: string | null;
  isBlocked: boolean;
  isGroup: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  content: string;
  sender: 'user' | 'assistant';
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'reaction';
  mediaUrl?: string;
  mediaType?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface Conversation {
  id: string;
  contactId: string;
  status: 'active' | 'waiting' | 'resolved' | 'escalated' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'inquiry' | 'support' | 'sales' | 'personal' | 'spam' | 'other';
  summary?: string;
  context: Record<string, any>;
  tags: string[];
  lastMessageAt: string;
  messageCount: number;
  isAssistantEnabled: boolean;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  messages?: Message[];
  unreadCount: number;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ConversationMessagesResponse {
  conversation: {
    id: string;
    status: string;
    isAssistantEnabled: boolean;
    contact: Contact;
  };
  messages: Message[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SendMessageRequest {
  content: string;
  messageType?: string;
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
}

export interface TypingIndicator {
  conversationId: string;
  sender: 'user' | 'assistant';
  isTyping: boolean;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  unreadConversations: number;
  messagesToday: number;
  assistantEnabledConversations: number;
}

export interface SearchMessagesResponse {
  messages: Message[];
  query: string;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}