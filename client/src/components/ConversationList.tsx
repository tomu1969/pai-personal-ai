import React, { useState } from 'react';
import { 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  PowerIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Conversation } from '../types';
import { 
  formatMessageTime, 
  getContactInitials, 
  formatPhoneNumber, 
  truncateText,
  getPriorityColor,
  classNames
} from '../utils';

interface Props {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onToggleAssistant: (conversationId: string, enabled: boolean) => void;
  onOpenSettings: () => void;
  globalAssistantEnabled: boolean;
  onToggleGlobalAssistant: (enabled: boolean) => void;
}

const ConversationList: React.FC<Props> = ({
  conversations,
  selectedConversation,
  onConversationSelect,
  onToggleAssistant,
  onOpenSettings,
  globalAssistantEnabled,
  onToggleGlobalAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'individual'>('all');

  const filteredConversations = conversations.filter(conversation => {
    // First apply tab filter
    const contact = conversation.contact;
    if (activeTab === 'groups' && !contact.isGroup && !contact.phone.includes('@g.us')) return false;
    if (activeTab === 'individual' && (contact.isGroup || contact.phone.includes('@g.us'))) return false;
    
    // Then apply search filter
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      conversation.messages?.[0]?.content?.toLowerCase().includes(query)
    );
  });

  const getLastMessage = (conversation: Conversation) => {
    const lastMessage = conversation.messages?.[0];
    if (!lastMessage) return 'No messages';
    
    const prefix = lastMessage.sender === 'assistant' ? 'You: ' : '';
    let content = lastMessage.content;
    
    // Handle different message types
    if (lastMessage.messageType === 'audio') {
      content = '🎵 Audio message';
    } else if (lastMessage.messageType === 'image') {
      content = '📷 Photo';
    } else if (lastMessage.messageType === 'video') {
      content = '📹 Video';
    } else if (lastMessage.messageType === 'document') {
      content = '📄 Document';
    } else if (lastMessage.messageType === 'reaction') {
      content = '👍 Reaction';
    }
    
    return prefix + truncateText(content, 50);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-default">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-text-primary flex items-center">
            <ChatBubbleLeftRightIcon className="h-6 w-6 mr-2" />
            Conversations
          </h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onToggleGlobalAssistant(!globalAssistantEnabled)}
              className={classNames(
                'p-2 rounded-full transition-colors',
                globalAssistantEnabled
                  ? 'text-whatsapp-green-500 hover:text-whatsapp-green-600 hover:bg-green-100'
                  : 'text-text-secondary hover:text-text-primary hover:bg-chat-hover'
              )}
              title={`Assistant ${globalAssistantEnabled ? 'Enabled' : 'Disabled'} - Click to ${globalAssistantEnabled ? 'disable' : 'enable'}`}
            >
              <PowerIcon className={classNames(
                "h-5 w-5 transition-transform",
                globalAssistantEnabled ? "text-whatsapp-green-500" : "text-text-secondary"
              )} />
            </button>
            <button 
              onClick={onOpenSettings}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full transition-colors"
              title="Assistant Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div className="text-sm text-text-secondary">
              {filteredConversations.length} of {conversations.length}
            </div>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-chat-bg border border-border-default rounded-lg text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-whatsapp-green-500 focus:border-transparent"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-chat-bg rounded-lg p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={classNames(
              'flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-whatsapp-green-500 text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-chat-hover'
            )}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
            All
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={classNames(
              'flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'groups'
                ? 'bg-whatsapp-green-500 text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-chat-hover'
            )}
          >
            <UserGroupIcon className="h-4 w-4 mr-1" />
            Groups
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={classNames(
              'flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'individual'
                ? 'bg-whatsapp-green-500 text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-chat-hover'
            )}
          >
            <UserIcon className="h-4 w-4 mr-1" />
            Individual
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-secondary">
            <UserIcon className="h-8 w-8 mb-2" />
            {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const contact = conversation.contact;
            const isSelected = selectedConversation?.id === conversation.id;
            const hasUnread = conversation.unreadCount > 0;
            const isAssistant = contact.phone === 'assistant@system' || conversation.id === '00000000-0000-0000-0000-000000000001';

            return (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation)}
                className={classNames(
                  'conversation-item border-b border-border-default/50',
                  isSelected && 'bg-chat-hover',
                  'hover:bg-chat-hover',
                  isAssistant && 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-l-4 border-l-blue-400'
                )}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className={classNames(
                      "w-12 h-12 rounded-full flex items-center justify-center text-white font-medium",
                      isAssistant 
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600" 
                        : "bg-gray-600"
                    )}>
                      {contact.profilePicture ? (
                        <img
                          src={contact.profilePicture}
                          alt={contact.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : isAssistant ? (
                        <ChatBubbleLeftRightIcon className="h-6 w-6" />
                      ) : (
                        <span className="text-sm">
                          {getContactInitials(contact.name)}
                        </span>
                      )}
                    </div>
                    
                    {/* Assistant Status Indicator */}
                    <div
                      className={classNames(
                        'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-chat-panel flex items-center justify-center cursor-pointer hover:scale-110 transition-transform',
                        conversation.isAssistantEnabled 
                          ? 'bg-whatsapp-green-500 text-white' 
                          : 'bg-gray-500 text-gray-300'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAssistant(conversation.id, !conversation.isAssistantEnabled);
                      }}
                      title={`Assistant ${conversation.isAssistantEnabled ? 'enabled' : 'disabled'}`}
                    >
                      <PowerIcon className={classNames(
                        "h-3 w-3 transition-transform",
                        conversation.isAssistantEnabled ? "text-whatsapp-green-500" : "text-gray-300"
                      )} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className={classNames(
                          'font-medium truncate flex items-center',
                          hasUnread ? 'text-white' : 'text-text-primary'
                        )}>
                          {(contact.isGroup || contact.phone.includes('@g.us')) && (
                            <UserGroupIcon className="h-4 w-4 mr-1 text-text-secondary" />
                          )}
                          {contact.name || formatPhoneNumber(contact.phone)}
                        </h3>
                        
                        {/* Priority Indicator */}
                        {conversation.priority !== 'medium' && (
                          <span className={classNames(
                            'text-xs px-1.5 py-0.5 rounded-full uppercase font-medium',
                            getPriorityColor(conversation.priority),
                            'bg-opacity-20'
                          )}>
                            {conversation.priority}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-text-secondary">
                          {formatMessageTime(conversation.lastMessageAt)}
                        </span>
                        
                        {hasUnread && (
                          <span className="bg-whatsapp-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className={classNames(
                        'text-sm truncate',
                        hasUnread ? 'text-text-primary' : 'text-text-secondary'
                      )}>
                        {getLastMessage(conversation)}
                      </p>
                      
                      {/* Category Badge */}
                      {conversation.category !== 'other' && (
                        <span className="text-xs text-text-secondary bg-chat-bg px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                          {conversation.category}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {conversation.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {conversation.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-text-secondary bg-chat-bg px-1.5 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                        {conversation.tags.length > 2 && (
                          <span className="text-xs text-text-secondary">
                            +{conversation.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;