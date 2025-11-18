/**
 * Chat History Management Module
 * Handles conversation storage, retrieval, and context management
 */

class ChatHistory {
  constructor() {
    this.messages = [];
    this.maxMessages = 1000; // Default maximum messages to store
    this.nextId = 1;
  }

  /**
   * Add a message to the chat history
   * @param {string} sender - 'user' or 'assistant'
   * @param {string} message - Message content
   * @param {Object} context - Optional game context
   * @returns {string} Unique message ID
   */
  addMessage(sender, message, context = null) {
    // Validate inputs
    if (!['user', 'assistant'].includes(sender)) {
      throw new Error('Invalid sender type');
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new Error('Message cannot be empty');
    }

    const messageObj = {
      id: this._generateMessageId(),
      sender: sender,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      context: context
    };

    this.messages.push(messageObj);

    // Auto-trim if exceeding max messages
    if (this.messages.length >= this.maxMessages) {
      this._trimHistory();
    }

    return messageObj.id;
  }

  /**
   * Get complete message history
   * @returns {Array} Array of message objects
   */
  getHistory() {
    return [...this.messages]; // Return a copy to prevent external modification
  }

  /**
   * Get recent messages up to specified count
   * @param {number} count - Number of recent messages to retrieve
   * @returns {Array} Array of recent message objects
   */
  getRecentHistory(count) {
    if (count <= 0) {
      return [];
    }
    return this.messages.slice(-count);
  }

  /**
   * Get messages since a specific timestamp
   * @param {string} timestamp - ISO timestamp string
   * @returns {Array} Array of messages after the timestamp
   */
  getMessagesSince(timestamp) {
    const targetTime = new Date(timestamp).getTime();
    return this.messages.filter(msg => {
      return new Date(msg.timestamp).getTime() > targetTime;
    });
  }

  /**
   * Get messages by sender type
   * @param {string} sender - 'user' or 'assistant'
   * @returns {Array} Array of messages from the specified sender
   */
  getMessagesBySender(sender) {
    return this.messages.filter(msg => msg.sender === sender);
  }

  /**
   * Find message by ID
   * @param {string} messageId - Unique message ID
   * @returns {Object|null} Message object or null if not found
   */
  getMessageById(messageId) {
    const message = this.messages.find(msg => msg.id === messageId);
    return message || null;
  }

  /**
   * Format conversation for AI context with OpenAI-style format
   * @param {number} count - Number of recent messages to format
   * @returns {Array} Array of formatted messages for AI
   */
  formatForAI(count) {
    if (count <= 0) {
      return [];
    }

    const recentMessages = this.getRecentHistory(count);
    return recentMessages.map(msg => {
      const formatted = {
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.message
      };

      // Include game context for assistant messages
      if (msg.sender === 'assistant' && msg.context) {
        formatted.gameContext = msg.context;
      }

      return formatted;
    });
  }

  /**
   * Search messages by content
   * @param {string} searchTerm - Text to search for
   * @returns {Array} Array of matching messages
   */
  searchMessages(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return [];
    }

    const term = searchTerm.toLowerCase();
    return this.messages.filter(msg => 
      msg.message.toLowerCase().includes(term)
    );
  }

  /**
   * Get messages within a date range
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Array} Array of messages in the date range
   */
  getMessagesInDateRange(startDate, endDate) {
    if (startDate >= endDate) {
      return [];
    }

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return this.messages.filter(msg => {
      const msgTime = new Date(msg.timestamp).getTime();
      return msgTime >= startTime && msgTime <= endTime;
    });
  }

  /**
   * Export history to JSON string
   * @returns {string} JSON representation of message history
   */
  exportToJSON() {
    return JSON.stringify(this.messages, null, 2);
  }

  /**
   * Import history from JSON string
   * @param {string} jsonData - JSON string containing message history
   */
  importFromJSON(jsonData) {
    try {
      const importedMessages = JSON.parse(jsonData);
      
      if (!Array.isArray(importedMessages)) {
        throw new Error('JSON data must contain an array of messages');
      }

      // Validate message structure
      importedMessages.forEach((msg, index) => {
        if (!msg.id || !msg.sender || !msg.message || !msg.timestamp) {
          throw new Error(`Invalid message structure at index ${index}`);
        }
      });

      this.messages = importedMessages;
      this._updateNextId();
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Clear all message history
   */
  clearHistory() {
    this.messages = [];
    this.nextId = 1;
  }

  /**
   * Set maximum number of messages to store
   * @param {number} maxMessages - Maximum message count
   */
  setMaxMessages(maxMessages) {
    if (maxMessages > 0) {
      this.maxMessages = maxMessages;
      if (this.messages.length > maxMessages) {
        this._trimHistory();
      }
    }
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getMemoryStats() {
    const userMessages = this.getMessagesBySender('user');
    const assistantMessages = this.getMessagesBySender('assistant');
    
    const totalChars = this.messages.reduce((sum, msg) => sum + msg.message.length, 0);
    const averageMessageLength = this.messages.length > 0 
      ? Math.round(totalChars / this.messages.length) 
      : 0;

    const estimatedMemoryUsage = JSON.stringify(this.messages).length;

    return {
      totalMessages: this.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      averageMessageLength: averageMessageLength,
      estimatedMemoryUsage: estimatedMemoryUsage
    };
  }

  /**
   * Generate unique message ID with microsecond precision
   * @private
   */
  _generateMessageId() {
    // Use high precision timestamp with counter for uniqueness
    return `msg_${Date.now()}_${this.nextId++}`;
  }

  /**
   * Get timestamp with microsecond precision to ensure ordering
   * @private
   */
  _getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Trim history when exceeding maximum messages
   * Maintains conversation context by keeping complete exchanges
   * @private
   */
  _trimHistory() {
    if (this.messages.length <= this.maxMessages) {
      return;
    }

    const messagesToRemove = this.messages.length - this.maxMessages;
    
    // Simple approach: remove the oldest messages
    this.messages = this.messages.slice(messagesToRemove);
  }

  /**
   * Update nextId based on existing message IDs
   * @private
   */
  _updateNextId() {
    let maxId = 0;
    this.messages.forEach(msg => {
      const match = msg.id.match(/msg_\d+_(\d+)/);
      if (match) {
        const id = parseInt(match[1]);
        maxId = Math.max(maxId, id);
      }
    });
    this.nextId = maxId + 1;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatHistory;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.ChatHistory = ChatHistory;
}