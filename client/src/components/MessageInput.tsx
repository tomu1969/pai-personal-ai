import React, { useState, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import { classNames } from '../utils';

interface Props {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<Props> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type a message...",
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = async () => {
    if (!message.trim() || sending || disabled) return;

    try {
      setSending(true);
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = () => {
    // Simple emoji insertion for now
    const emoji = '😊';
    setMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="bg-chat-panel border-t border-border-default p-4">
      <div className="flex items-end space-x-3">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={handleEmojiClick}
          disabled={disabled}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaceSmileIcon className="h-6 w-6" />
        </button>

        {/* Message Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || sending}
            rows={1}
            className={classNames(
              'w-full px-4 py-3 pr-12 rounded-lg resize-none',
              'bg-chat-bg border border-border-default text-text-primary placeholder-text-secondary',
              'focus:outline-none focus:ring-2 focus:ring-whatsapp-green-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'scrollbar-thin'
            )}
            style={{ minHeight: '48px' }}
          />

          {/* Character count for long messages */}
          {message.length > 1000 && (
            <div className="absolute bottom-1 right-14 text-xs text-text-secondary bg-chat-panel px-2 py-1 rounded">
              {message.length}/4096
            </div>
          )}
        </div>

        {/* Attachment Button */}
        <button
          type="button"
          disabled={disabled}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperClipIcon className="h-6 w-6" />
        </button>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          className={classNames(
            'p-3 rounded-full transition-all duration-200',
            message.trim() && !sending && !disabled
              ? 'bg-whatsapp-green-500 text-white hover:bg-whatsapp-green-600 hover:scale-105'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          )}
        >
          {sending ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Quick Actions (Optional) */}
      {message.trim() && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 hover:bg-chat-hover rounded"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageInput;