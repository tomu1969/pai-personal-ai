import React, { useState, useRef, useEffect } from 'react';
import {
  PhoneIcon,
  EllipsisVerticalIcon,
  BoltIcon,
  BoltSlashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { Conversation, Message } from '../types';
import { 
  formatMessageTime, 
  getContactInitials, 
  formatPhoneNumber,
  classNames,
  extractUrls,
  isValidUrl
} from '../utils';
import MessageInput from './MessageInput';

interface Props {
  conversation: Conversation;
  messages: Message[];
  loading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  isConnected: boolean;
  typingIndicator?: { sender: string; isTyping: boolean };
}

const MessageView: React.FC<Props> = ({
  conversation,
  messages,
  loading,
  onSendMessage,
  isConnected,
  typingIndicator,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contact = conversation.contact;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderMessageContent = (message: Message) => {
    let content = message.content;

    // Handle different message types
    if (message.messageType === 'audio') {
      return (
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🎵</span>
          <span>Audio message</span>
        </div>
      );
    }

    if (message.messageType === 'image') {
      return (
        <div className="space-y-2">
          {message.mediaUrl && (
            <img 
              src={message.mediaUrl} 
              alt="Shared image" 
              className="max-w-xs rounded-lg"
            />
          )}
          {content && <p>{content}</p>}
        </div>
      );
    }

    if (message.messageType === 'video') {
      return (
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📹</span>
          <span>{content || 'Video message'}</span>
        </div>
      );
    }

    if (message.messageType === 'document') {
      return (
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📄</span>
          <span>{content || 'Document'}</span>
        </div>
      );
    }

    if (message.messageType === 'reaction') {
      return (
        <div className="flex items-center space-x-2">
          <span className="text-2xl">👍</span>
          <span className="text-sm text-gray-300">Reacted to a message</span>
        </div>
      );
    }

    // Handle URLs in text messages
    const urls = extractUrls(content);
    if (urls.length > 0) {
      let processedContent = content;
      urls.forEach(url => {
        processedContent = processedContent.replace(
          url,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-300 underline hover:text-blue-200">${url}</a>`
        );
      });
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: processedContent }}
          className="break-words"
        />
      );
    }

    return <p className="break-words whitespace-pre-wrap">{content}</p>;
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (dateString === today) return 'Today';
    if (dateString === yesterday) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full bg-chat-bg">
      {/* Header */}
      <div className="bg-chat-panel border-b border-border-default p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
            {contact.profilePicture ? (
              <img
                src={contact.profilePicture}
                alt={contact.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm">
                {getContactInitials(contact.name)}
              </span>
            )}
          </div>

          {/* Contact Info */}
          <div className="flex-1">
            <h2 className="font-medium text-text-primary">
              {contact.name || formatPhoneNumber(contact.phone)}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <span>{formatPhoneNumber(contact.phone)}</span>
              {conversation.messageCount > 0 && (
                <>
                  <span>•</span>
                  <span>{conversation.messageCount} messages</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Assistant Toggle */}
          <button
            onClick={() => {/* Will be handled by parent */}}
            className={classNames(
              'p-2 rounded-full transition-colors',
              conversation.isAssistantEnabled
                ? 'bg-whatsapp-green-500 text-white hover:bg-whatsapp-green-600'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            )}
            title={`Assistant ${conversation.isAssistantEnabled ? 'enabled' : 'disabled'}`}
          >
            {conversation.isAssistantEnabled ? (
              <BoltIcon className="h-5 w-5" />
            ) : (
              <BoltSlashIcon className="h-5 w-5" />
            )}
          </button>


          <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full">
            <PhoneIcon className="h-5 w-5" />
          </button>

          <button 
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full"
            onClick={() => setShowDetails(!showDetails)}
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-text-secondary">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-secondary">
            <div className="text-6xl mb-4">💬</div>
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation!</p>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dayMessages]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex justify-center mb-4">
                <span className="bg-chat-panel px-3 py-1 rounded-lg text-sm text-text-secondary">
                  {formatDateHeader(date)}
                </span>
              </div>

              {/* Messages for this date */}
              <div className="space-y-2">
                {dayMessages.map((message, index) => {
                  const isOutgoing = message.sender === 'assistant';
                  const prevMessage = index > 0 ? dayMessages[index - 1] : null;
                  const nextMessage = index < dayMessages.length - 1 ? dayMessages[index + 1] : null;
                  const isConsecutive = prevMessage?.sender === message.sender;
                  const isLastInGroup = !nextMessage || nextMessage.sender !== message.sender;

                  return (
                    <div
                      key={message.id}
                      className={classNames(
                        'flex',
                        isOutgoing ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={classNames(
                          'message-bubble',
                          isOutgoing ? 'outgoing' : 'incoming',
                          !isConsecutive && 'mt-2'
                        )}
                      >
                        {/* Message Content */}
                        <div>{renderMessageContent(message)}</div>

                        {/* Message Footer */}
                        <div className={classNames(
                          'flex items-center justify-between mt-1 text-xs',
                          isOutgoing ? 'text-gray-200' : 'text-text-secondary'
                        )}>
                          <span>{formatMessageTime(message.createdAt)}</span>
                          
                          {isOutgoing && (
                            <div className="ml-2 flex items-center">
                              {/* Read receipt indicators */}
                              <span className="text-blue-300">✓✓</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        
        {/* Typing indicator */}
        {typingIndicator?.isTyping && (
          <div className="flex justify-start">
            <div className="message-bubble incoming bg-gray-600 text-white">
              <div className="flex items-center space-x-1">
                <span className="text-sm">
                  {typingIndicator.sender === 'assistant' ? 'Assistant' : contact.name || 'User'} is typing
                </span>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput 
        onSendMessage={onSendMessage}
        disabled={!isConnected}
        placeholder={
          !isConnected 
            ? "Connecting..." 
            : `Message ${contact.name || formatPhoneNumber(contact.phone)}`
        }
      />

      {/* Details Panel (if needed) */}
      {showDetails && (
        <div className="absolute top-0 right-0 w-80 h-full bg-chat-panel border-l border-border-default p-4">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            Conversation Details
          </h3>
          
          <div className="space-y-4 text-sm">
            <div>
              <label className="text-text-secondary">Status:</label>
              <p className="text-text-primary capitalize">{conversation.status}</p>
            </div>
            
            <div>
              <label className="text-text-secondary">Priority:</label>
              <p className="text-text-primary capitalize">{conversation.priority}</p>
            </div>
            
            <div>
              <label className="text-text-secondary">Category:</label>
              <p className="text-text-primary capitalize">{conversation.category}</p>
            </div>
            
            {conversation.tags.length > 0 && (
              <div>
                <label className="text-text-secondary">Tags:</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {conversation.tags.map(tag => (
                    <span key={tag} className="bg-chat-bg px-2 py-1 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageView;