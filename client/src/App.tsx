import React, { useEffect, useState } from 'react';
import ConversationList from './components/ConversationList';
import MessageView from './components/MessageView';
import AssistantSettings from './components/AssistantSettings';
import { chatApi, whatsappApi, assistantApi } from './services/api';
import { socketService } from './services/socket';
import { Conversation, Message, TypingIndicator } from './types';

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [globalAssistantEnabled, setGlobalAssistantEnabled] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState<Map<string, { sender: string; isTyping: boolean }>>(new Map());

  // Load conversations and assistant status on mount
  useEffect(() => {
    console.log('🚀 App useEffect: Starting initialization...');
    loadConversations();
    loadAssistantStatus();
    
    // Connect to socket
    console.log('🔌 Connecting to WebSocket...');
    socketService.connect();
    
    // Check connection state periodically (workaround for race condition)
    const checkConnection = () => {
      const connected = socketService.isConnected();
      console.log('🔍 Checking connection state:', connected);
      setIsConnected(connected);
    };
    
    // Initial check
    setTimeout(checkConnection, 100);
    
    // Periodic check for the first few seconds
    const intervalId = setInterval(checkConnection, 500);
    setTimeout(() => clearInterval(intervalId), 5000);

    // Subscribe to connection events
    const unsubscribeConnect = socketService.on('connect', () => {
      console.log('✅ WebSocket connected - updating state');
      setIsConnected(true);
    });

    const unsubscribeDisconnect = socketService.on('disconnect', () => {
      console.log('❌ WebSocket disconnected - updating state');
      setIsConnected(false);
    });

    // Subscribe to new messages
    const unsubscribeNewMessage = socketService.on('new_message', (data: {
      conversationId: string;
      message: Message;
    }) => {
      handleNewMessage(data.conversationId, data.message);
    });

    // Subscribe to conversation updates
    const unsubscribeConversationUpdate = socketService.on('conversation_updated', (data: {
      conversationId: string;
      updates?: any;
      lastMessage?: Message;
      lastMessageAt?: string;
    }) => {
      handleConversationUpdate(data);
    });

    // Subscribe to typing indicators
    const unsubscribeTypingIndicator = socketService.on('typing_indicator', (data: TypingIndicator) => {
      handleTypingIndicator(data);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeNewMessage();
      unsubscribeConversationUpdate();
      unsubscribeTypingIndicator();
      socketService.disconnect();
    };
  }, []);

  // Check WhatsApp connection status periodically
  useEffect(() => {
    const checkWhatsAppStatus = async () => {
      try {
        const status = await whatsappApi.getConnectionStatus();
        console.log('📱 WhatsApp status:', status);
        setWhatsappConnected(status.connected);
      } catch (error) {
        console.error('❌ Failed to check WhatsApp status:', error);
        setWhatsappConnected(false);
      }
    };

    // Initial check
    checkWhatsAppStatus();

    // Poll every 5 seconds
    const intervalId = setInterval(checkWhatsAppStatus, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      const isAssistantConversation = selectedConversation.id === '00000000-0000-0000-0000-000000000001';
      
      console.log('🔄 Conversation selected:', {
        conversationId: selectedConversation.id,
        name: selectedConversation.contact.name,
        isAssistantConversation
      });

      // CRITICAL: Subscribe to WebSocket room BEFORE loading messages to prevent race condition
      console.log('🔌 Subscribing to conversation WebSocket room BEFORE loading messages');
      socketService.subscribeToConversation(selectedConversation.id);
      
      // Use async function inside useEffect
      const loadMessagesAfterSubscription = async () => {
        // Small delay to ensure subscription is processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('📨 Loading messages after subscription is established');
        loadMessages(selectedConversation.id);
      };
      
      loadMessagesAfterSubscription();

      return () => {
        console.log('🔌 Unsubscribing from conversation WebSocket room');
        socketService.unsubscribeFromConversation(selectedConversation.id);
      };
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      console.log('📋 Loading conversations...');
      setLoading(true);
      const response = await chatApi.getConversations({ limit: 50 });
      console.log('📋 Conversations loaded:', response.conversations.length, 'items');
      setConversations(response.conversations);
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssistantStatus = async () => {
    try {
      const status = await assistantApi.getStatus();
      setGlobalAssistantEnabled(status.enabled);
      console.log('🤖 Assistant status loaded:', status.enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('❌ Failed to load assistant status:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const response = await chatApi.getConversationMessages(conversationId, { limit: 50 });
      setMessages(response.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewMessage = (conversationId: string, message: Message) => {
    // Special logging for Assistant conversation
    const isAssistantConversation = conversationId === '00000000-0000-0000-0000-000000000001';
    
    console.log('📨 WebSocket new_message received:', {
      conversationId,
      messageId: message.id,
      sender: message.sender,
      content: message.content.substring(0, 100),
      selectedConversationId: selectedConversation?.id,
      isAssistantConversation,
      willUpdateUI: selectedConversation?.id === conversationId
    });

    // Add message to current conversation if it matches
    if (selectedConversation?.id === conversationId) {
      console.log('📨 Adding message to current conversation UI');
      setMessages(prev => [...prev, message]);
    } else {
      console.log('📨 Message not for current conversation, updating conversation list only');
    }

    // Update conversation list
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessageAt: message.createdAt,
            messageCount: conv.messageCount + 1,
            unreadCount: selectedConversation?.id === conversationId ? 
              conv.unreadCount : conv.unreadCount + 1
          };
        }
        return conv;
      }).sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      )
    );
  };

  const handleConversationUpdate = (data: {
    conversationId: string;
    updates?: any;
    lastMessage?: Message;
    lastMessageAt?: string;
  }) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === data.conversationId) {
          return {
            ...conv,
            ...data.updates,
            ...(data.lastMessageAt && { lastMessageAt: data.lastMessageAt })
          };
        }
        return conv;
      })
    );
  };

  const handleTypingIndicator = (data: TypingIndicator) => {
    setTypingIndicators(prev => {
      const newMap = new Map(prev);
      if (data.isTyping) {
        newMap.set(data.conversationId, { sender: data.sender, isTyping: true });
      } else {
        newMap.delete(data.conversationId);
      }
      return newMap;
    });
  };

  const handleSendMessage = async (content: string): Promise<void> => {
    if (!selectedConversation) return;

    try {
      const response = await chatApi.sendMessage(selectedConversation.id, { content });
      // Message will be added via socket event
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark as read
    if (conversation.unreadCount > 0) {
      chatApi.markConversationAsRead(conversation.id).catch(console.error);
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv
        )
      );
    }
  };

  const handleToggleAssistant = async (conversationId: string, enabled: boolean) => {
    try {
      await chatApi.updateConversation(conversationId, { isAssistantEnabled: enabled });
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, isAssistantEnabled: enabled } : conv
        )
      );

      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => 
          prev ? { ...prev, isAssistantEnabled: enabled } : null
        );
      }
    } catch (error) {
      console.error('Failed to update assistant setting:', error);
    }
  };

  const handleSaveSettings = async (config: any) => {
    try {
      await assistantApi.updateConfig(config);
      console.log('Assistant configuration updated successfully');
    } catch (error) {
      console.error('Failed to update assistant configuration:', error);
      throw error;
    }
  };

  const handleToggleGlobalAssistant = async (enabled: boolean) => {
    try {
      console.log(`🤖 Toggling assistant: ${enabled ? 'enabling' : 'disabling'}`);
      await assistantApi.toggle(enabled);
      setGlobalAssistantEnabled(enabled);
      console.log(`✅ Assistant ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('❌ Failed to toggle assistant:', error);
      // Revert the state if the API call fails
      setGlobalAssistantEnabled(!enabled);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-chat-bg flex items-center justify-center">
        <div className="text-text-primary text-lg">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-chat-bg flex overflow-hidden">
      {/* Debug Connection State */}
      <div className="fixed top-2 right-2 z-50 bg-black bg-opacity-75 text-white p-2 rounded text-xs">
        WhatsApp: {whatsappConnected ? '🟢 Connected' : '🔴 Disconnected'}
        <br />
        Socket: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      {/* Connection Status - Small indicator */}
      {!whatsappConnected && (
        <div className="fixed top-2 left-2 z-40 bg-red-600 text-white px-3 py-1 rounded text-xs">
          📱 Disconnected
        </div>
      )}

      {/* Conversation List */}
      <div className="w-1/3 border-r border-border-default bg-chat-panel flex flex-col">
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onConversationSelect={handleConversationSelect}
          onToggleAssistant={handleToggleAssistant}
          onOpenSettings={() => setShowSettings(true)}
          globalAssistantEnabled={globalAssistantEnabled}
          onToggleGlobalAssistant={handleToggleGlobalAssistant}
        />
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <MessageView
            conversation={selectedConversation}
            messages={messages}
            loading={loadingMessages}
            onSendMessage={handleSendMessage}
            isConnected={whatsappConnected}
            typingIndicator={typingIndicators.get(selectedConversation.id)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-chat-bg">
            <div className="text-center text-text-secondary">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl mb-2">AI PBX Chat Interface</h2>
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Assistant Settings Modal */}
      <AssistantSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;