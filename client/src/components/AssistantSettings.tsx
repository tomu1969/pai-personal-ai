import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  CommandLineIcon,
  CheckIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  PhoneIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { classNames } from '../utils';
import WhatsAppConnection from './WhatsAppConnection';

interface MessageTypePreferences {
  allMessages: boolean;
  individualMessages: boolean;
  groupMessages: boolean;
  reactions: boolean;
  distributionLists: boolean;
}

interface AssistantConfig {
  id: string;
  assistantName: string;
  autoResponseTemplate: string;
  systemPrompt: string;
  ownerName: string;
  messageTypePreferences: MessageTypePreferences;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Partial<AssistantConfig>) => Promise<void>;
}

type Tab = 'assistant' | 'connection' | 'messageTypes';

const AssistantSettings: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AssistantConfig>({
    id: '',
    assistantName: '',
    autoResponseTemplate: '',
    systemPrompt: '',
    ownerName: '',
    messageTypePreferences: {
      allMessages: true,
      individualMessages: true,
      groupMessages: true,
      reactions: true,
      distributionLists: true,
    },
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Load current configuration when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assistant/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        throw new Error('Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to load assistant configuration:', error);
      setErrors({ general: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!config.assistantName.trim()) {
      newErrors.assistantName = 'Assistant name is required';
    }


    if (!config.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        assistantName: config.assistantName,
        systemPrompt: config.systemPrompt,
        ownerName: config.ownerName,
        messageTypePreferences: config.messageTypePreferences,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setErrors({ general: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof AssistantConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMessageTypeChange = (type: keyof MessageTypePreferences, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      messageTypePreferences: {
        ...prev.messageTypePreferences,
        [type]: checked,
      },
    }));

    // If "All Messages" is unchecked, uncheck all other types
    if (type === 'allMessages' && !checked) {
      setConfig(prev => ({
        ...prev,
        messageTypePreferences: {
          allMessages: false,
          individualMessages: false,
          groupMessages: false,
          reactions: false,
          distributionLists: false,
        },
      }));
    }
    
    // If "All Messages" is checked, check all other types
    if (type === 'allMessages' && checked) {
      setConfig(prev => ({
        ...prev,
        messageTypePreferences: {
          allMessages: true,
          individualMessages: true,
          groupMessages: true,
          reactions: true,
          distributionLists: true,
        },
      }));
    }

    // If any specific type is unchecked, uncheck "All Messages"
    if (type !== 'allMessages' && !checked) {
      setConfig(prev => ({
        ...prev,
        messageTypePreferences: {
          ...prev.messageTypePreferences,
          [type]: false,
          allMessages: false,
        },
      }));
    }

    // If all specific types are checked, check "All Messages"
    if (type !== 'allMessages' && checked) {
      const currentPrefs = config.messageTypePreferences;
      const allSpecificTypesChecked = 
        (type === 'individualMessages' || currentPrefs.individualMessages) &&
        (type === 'groupMessages' || currentPrefs.groupMessages) &&
        (type === 'reactions' || currentPrefs.reactions) &&
        (type === 'distributionLists' || currentPrefs.distributionLists);

      if (allSpecificTypesChecked) {
        setConfig(prev => ({
          ...prev,
          messageTypePreferences: {
            ...prev.messageTypePreferences,
            [type]: true,
            allMessages: true,
          },
        }));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-chat-panel rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-border-default">
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="text-xl font-semibold text-text-primary">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-chat-hover rounded-full"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('assistant')}
              className={classNames(
                'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'assistant'
                  ? 'border-whatsapp-green-500 text-whatsapp-green-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
              )}
            >
              <CogIcon className="h-4 w-4" />
              <span>Assistant</span>
            </button>
            
            <button
              onClick={() => setActiveTab('connection')}
              className={classNames(
                'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'connection'
                  ? 'border-whatsapp-green-500 text-whatsapp-green-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
              )}
            >
              <PhoneIcon className="h-4 w-4" />
              <span>WhatsApp</span>
            </button>
            
            <button
              onClick={() => setActiveTab('messageTypes')}
              className={classNames(
                'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'messageTypes'
                  ? 'border-whatsapp-green-500 text-whatsapp-green-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
              )}
            >
              <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4" />
              <span>Message Types</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {errors.general && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
              {errors.general}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-text-secondary">Loading configuration...</div>
            </div>
          ) : (
            <>
              {/* Assistant Tab */}
              {activeTab === 'assistant' && (
                <>
                  {/* Assistant Name */}
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-text-primary mb-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Assistant Name</span>
                    </label>
                    <input
                      type="text"
                      value={config.assistantName}
                      onChange={(e) => handleInputChange('assistantName', e.target.value)}
                      placeholder="Enter assistant name (e.g., AI Assistant)"
                      className={classNames(
                        'w-full px-3 py-2 bg-chat-bg border rounded-lg text-text-primary placeholder-text-secondary',
                        'focus:outline-none focus:ring-2 focus:ring-whatsapp-green-500 focus:border-transparent',
                        errors.assistantName ? 'border-red-500' : 'border-border-default'
                      )}
                    />
                    {errors.assistantName && (
                      <p className="mt-1 text-sm text-red-400">{errors.assistantName}</p>
                    )}
                  </div>


                  {/* System Prompt */}
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-text-primary mb-2">
                      <CommandLineIcon className="h-4 w-4" />
                      <span>System Prompt</span>
                    </label>
                    <textarea
                      value={config.systemPrompt}
                      onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                      placeholder="Enter the system prompt that defines how the assistant should behave..."
                      rows={6}
                      className={classNames(
                        'w-full px-3 py-2 bg-chat-bg border rounded-lg text-text-primary placeholder-text-secondary',
                        'focus:outline-none focus:ring-2 focus:ring-whatsapp-green-500 focus:border-transparent resize-none',
                        errors.systemPrompt ? 'border-red-500' : 'border-border-default'
                      )}
                    />
                    {errors.systemPrompt && (
                      <p className="mt-1 text-sm text-red-400">{errors.systemPrompt}</p>
                    )}
                    <p className="mt-1 text-xs text-text-secondary">
                      This defines the assistant's personality, role, and behavior guidelines.
                    </p>
                  </div>

                  {/* Owner Name (Optional) */}
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-text-primary mb-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Owner Name <span className="text-text-secondary">(Optional)</span></span>
                    </label>
                    <input
                      type="text"
                      value={config.ownerName}
                      onChange={(e) => handleInputChange('ownerName', e.target.value)}
                      placeholder="Enter owner name for personalization"
                      className="w-full px-3 py-2 bg-chat-bg border border-border-default rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-whatsapp-green-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-text-secondary">
                      Used in the greeting message template variable {'{{owner_name}}'}
                    </p>
                  </div>
                </>
              )}

              {/* WhatsApp Connection Tab */}
              {activeTab === 'connection' && (
                <WhatsAppConnection />
              )}

              {/* Message Types Tab */}
              {activeTab === 'messageTypes' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Message Types to Respond To</h3>
                    <p className="text-text-secondary text-sm">
                      Choose which types of WhatsApp messages the assistant should respond to automatically.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {/* All Messages */}
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.messageTypePreferences.allMessages}
                        onChange={(e) => handleMessageTypeChange('allMessages', e.target.checked)}
                        className="h-4 w-4 text-whatsapp-green-600 bg-chat-bg border-border-default rounded focus:ring-whatsapp-green-500 focus:ring-2"
                      />
                      <div>
                        <span className="text-text-primary font-medium">All Messages</span>
                        <p className="text-xs text-text-secondary">Respond to all types of messages</p>
                      </div>
                    </label>

                    <div className="ml-7 space-y-2">
                      {/* Individual Messages */}
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.messageTypePreferences.individualMessages}
                          onChange={(e) => handleMessageTypeChange('individualMessages', e.target.checked)}
                          className="h-4 w-4 text-whatsapp-green-600 bg-chat-bg border-border-default rounded focus:ring-whatsapp-green-500 focus:ring-2"
                        />
                        <div>
                          <span className="text-text-primary">Individual Messages</span>
                          <p className="text-xs text-text-secondary">Direct messages from individual contacts</p>
                        </div>
                      </label>

                      {/* Group Messages */}
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.messageTypePreferences.groupMessages}
                          onChange={(e) => handleMessageTypeChange('groupMessages', e.target.checked)}
                          className="h-4 w-4 text-whatsapp-green-600 bg-chat-bg border-border-default rounded focus:ring-whatsapp-green-500 focus:ring-2"
                        />
                        <div>
                          <span className="text-text-primary">Group Messages</span>
                          <p className="text-xs text-text-secondary">Messages in group chats</p>
                        </div>
                      </label>

                      {/* Reactions */}
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.messageTypePreferences.reactions}
                          onChange={(e) => handleMessageTypeChange('reactions', e.target.checked)}
                          className="h-4 w-4 text-whatsapp-green-600 bg-chat-bg border-border-default rounded focus:ring-whatsapp-green-500 focus:ring-2"
                        />
                        <div>
                          <span className="text-text-primary">Reactions</span>
                          <p className="text-xs text-text-secondary">Emoji reactions (👍, ❤️, etc.)</p>
                        </div>
                      </label>

                      {/* Distribution Lists */}
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.messageTypePreferences.distributionLists}
                          onChange={(e) => handleMessageTypeChange('distributionLists', e.target.checked)}
                          className="h-4 w-4 text-whatsapp-green-600 bg-chat-bg border-border-default rounded focus:ring-whatsapp-green-500 focus:ring-2"
                        />
                        <div>
                          <span className="text-text-primary">Distribution Lists</span>
                          <p className="text-xs text-text-secondary">Messages sent to broadcast lists</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeTab !== 'connection' && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-border-default">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:bg-chat-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-whatsapp-green-600 hover:bg-whatsapp-green-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantSettings;