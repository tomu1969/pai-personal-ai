/**
 * Chat Container - UI Components
 * Creates chat interface components that sit alongside the chess board
 * WITHOUT modifying the existing board HTML or CSS
 */

class ChatContainer {
  constructor() {
    this.containerId = null;
    this.messageStreamId = null;
    this.inputId = null;
    this.headerId = null;
    this.drawerId = null;
    
    this.messages = [];
    this.messageMetadata = new Map();
    this.eventListeners = new Map();
    
    this.isInitialized = false;
    this.isDrawerExpanded = false;
    this.connectionStatus = false;
    this.typingIndicatorVisible = false;
    this.typingTimeout = null;
    
    this.callbacks = {
      onMessageSend: [],
      onDrawerToggle: []
    };

    this._setupResponsiveHandler();
  }

  /**
   * Create main chat container
   * @param {string} parentId - ID of parent element (default: 'game-container')
   * @returns {string} Container ID
   */
  createChatContainer(parentId = 'game-container') {
    console.log('[CONTAINER] 🏗️ Creating chat container...');
    console.log('[CONTAINER] 📍 Looking for parent element with ID:', parentId);
    
    const document = typeof window !== 'undefined' ? window.document : global.document;
    console.log('[CONTAINER] 📄 Document available?', document ? '✅ YES' : '❌ NO');
    
    const parent = document.getElementById(parentId);
    console.log('[CONTAINER] 📍 Parent element found?', parent ? '✅ YES' : '❌ NO');
    if (parent) {
      console.log('[CONTAINER] 📍 Parent element details:', {
        id: parent.id,
        className: parent.className,
        tagName: parent.tagName,
        innerHTML: parent.innerHTML.substring(0, 100) + '...'
      });
    }
    
    if (!parent) {
      console.error('[CONTAINER] ❌ Parent container', parentId, 'not found');
      console.log('[CONTAINER] 🔍 Available elements with IDs:', 
        Array.from(document.querySelectorAll('[id]')).map(el => el.id)
      );
      return null;
    }

    console.log('[CONTAINER] 🎨 Creating new div element...');
    const container = document.createElement('div');
    this.containerId = `chat-container-${Date.now()}`;
    container.id = this.containerId;
    container.className = 'chat-container';
    console.log('[CONTAINER] 🆔 Generated container ID:', this.containerId);
    console.log('[CONTAINER] 🎨 Container className set to:', container.className);
    
    // Apply layout based on viewport
    console.log('[CONTAINER] 📱 Applying responsive layout...');
    this.updateResponsiveLayout(container);
    console.log('[CONTAINER] 📱 Final container className:', container.className);
    
    console.log('[CONTAINER] 📌 Appending container to parent...');
    parent.appendChild(container);
    this.isInitialized = true;
    console.log('[CONTAINER] ✅ Container created and appended successfully');
    console.log('[CONTAINER] 🏁 isInitialized set to:', this.isInitialized);
    
    // Verify container was added
    const verification = document.getElementById(this.containerId);
    console.log('[CONTAINER] 🔍 Verification - container exists in DOM?', verification ? '✅ YES' : '❌ NO');
    if (verification) {
      console.log('[CONTAINER] 🔍 Verification - container parent is:', verification.parentElement?.id);
    }
    
    return this.containerId;
  }

  /**
   * Create chat header with persona info
   * @param {string} personaName - Name of the AI persona
   * @param {boolean} isOnline - Connection status
   * @returns {string} Header ID
   */
  createChatHeader(personaName = 'Assistant', isOnline = false) {
    console.log('[CONTAINER] 📋 Creating chat header...');
    console.log('[CONTAINER] 👤 Persona name:', personaName);
    console.log('[CONTAINER] 🔌 Online status:', isOnline);
    console.log('[CONTAINER] 🏁 Is initialized?', this.isInitialized);
    
    if (!this.isInitialized) {
      console.error('[CONTAINER] ❌ Cannot create header - container not initialized');
      return null;
    }

    const document = typeof window !== 'undefined' ? window.document : global.document;
    console.log('[CONTAINER] 🔍 Looking for container with ID:', this.containerId);
    const container = document.getElementById(this.containerId);
    console.log('[CONTAINER] 📦 Container found for header?', container ? '✅ YES' : '❌ NO');
    
    if (!container) {
      console.error('[CONTAINER] ❌ Container not found for header creation');
      return null;
    }
    
    console.log('[CONTAINER] 🎨 Creating header element...');
    const header = document.createElement('div');
    this.headerId = `chat-header-${Date.now()}`;
    header.id = this.headerId;
    header.className = `chat-header ${isOnline ? 'online' : 'offline'}`;
    console.log('[CONTAINER] 🆔 Header ID:', this.headerId);
    console.log('[CONTAINER] 🎨 Header className:', header.className);
    
    const statusText = isOnline ? 'Online' : 'Offline';
    header.innerHTML = `
      <div class="persona-name">${personaName}</div>
      <div class="connection-status-container">
        <div class="status-dot ${isOnline ? 'online' : 'offline'}"></div>
        <div class="connection-status">${statusText}</div>
      </div>
    `;
    console.log('[CONTAINER] 📝 Header HTML content set');
    
    console.log('[CONTAINER] 📌 Appending header to container...');
    container.appendChild(header);
    this.connectionStatus = isOnline;
    console.log('[CONTAINER] ✅ Header created and appended successfully');
    
    return this.headerId;
  }

  /**
   * Create scrollable message stream
   * @returns {string} Stream ID
   */
  createMessageStream() {
    console.log('[CONTAINER] 💬 Creating message stream...');
    console.log('[CONTAINER] 🏁 Is initialized?', this.isInitialized);
    
    if (!this.isInitialized) {
      console.error('[CONTAINER] ❌ Cannot create message stream - container not initialized');
      return null;
    }

    const document = typeof window !== 'undefined' ? window.document : global.document;
    console.log('[CONTAINER] 🔍 Looking for container with ID:', this.containerId);
    const container = document.getElementById(this.containerId);
    console.log('[CONTAINER] 📦 Container found for stream?', container ? '✅ YES' : '❌ NO');
    
    if (!container) {
      console.error('[CONTAINER] ❌ Container not found for message stream creation');
      return null;
    }
    
    console.log('[CONTAINER] 🎨 Creating stream element...');
    const stream = document.createElement('div');
    this.messageStreamId = `message-stream-${Date.now()}`;
    stream.id = this.messageStreamId;
    stream.className = 'message-stream';
    stream.style.overflowY = 'auto';
    stream.style.flex = '1';
    stream.style.padding = '10px';
    stream.style.wordWrap = 'break-word';
    console.log('[CONTAINER] 🆔 Stream ID:', this.messageStreamId);
    console.log('[CONTAINER] 🎨 Stream styles applied');
    
    console.log('[CONTAINER] 📌 Appending stream to container...');
    container.appendChild(stream);
    console.log('[CONTAINER] ✅ Message stream created and appended successfully');
    
    return this.messageStreamId;
  }

  /**
   * Add message to the stream
   * @param {string} sender - 'user' or 'assistant'
   * @param {string} message - Message content
   * @param {Object} options - Options including autoScroll and metadata
   * @returns {string} Message ID
   */
  addMessage(sender, message, options = {}) {
    if (!message || message.trim() === '') {
      return null; // Don't add empty messages
    }

    const document = typeof window !== 'undefined' ? window.document : global.document;
    const stream = document.getElementById(this.messageStreamId);
    if (!stream) return null;

    const messageEl = document.createElement('div');
    const messageId = `message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    messageEl.id = messageId;
    messageEl.className = `message ${sender}-message`;
    messageEl.style.wordWrap = 'break-word';
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageEl.innerHTML = `
      <div class="message-content">${message}</div>
      <div class="message-timestamp">${timestamp}</div>
    `;
    
    stream.appendChild(messageEl);
    this.messages.push({ id: messageId, sender, message, timestamp: new Date() });
    
    // Store metadata if provided
    if (options.context) {
      this.messageMetadata.set(messageId, options);
    }
    
    // Auto-scroll if requested (default: true)
    if (options.autoScroll !== false) {
      this.scrollToBottom();
    }
    
    return messageId;
  }

  /**
   * Remove a message from the chat
   * @param {string} messageId - ID of message to remove
   * @returns {boolean} - True if message was removed
   */
  removeMessage(messageId) {
    if (!messageId) return false;

    const document = typeof window !== 'undefined' ? window.document : global.document;
    const messageEl = document.getElementById(messageId);
    
    if (messageEl) {
      messageEl.remove();
    }
    
    // Remove from messages array
    const index = this.messages.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.messages.splice(index, 1);
    }
    
    // Remove metadata if exists
    if (this.messageMetadata.has(messageId)) {
      this.messageMetadata.delete(messageId);
    }
    
    return true;
  }

  /**
   * Create message input with send button
   * @returns {string} Input ID
   */
  createMessageInput() {
    console.log('[CONTAINER] ⌨️ Creating message input...');
    console.log('[CONTAINER] 🏁 Is initialized?', this.isInitialized);
    
    if (!this.isInitialized) {
      console.error('[CONTAINER] ❌ Cannot create message input - container not initialized');
      return null;
    }

    const document = typeof window !== 'undefined' ? window.document : global.document;
    console.log('[CONTAINER] 🔍 Looking for container with ID:', this.containerId);
    const container = document.getElementById(this.containerId);
    console.log('[CONTAINER] 📦 Container found for input?', container ? '✅ YES' : '❌ NO');
    
    if (!container) {
      console.error('[CONTAINER] ❌ Container not found for message input creation');
      return null;
    }
    
    console.log('[CONTAINER] 🎨 Creating input elements...');
    const inputContainer = document.createElement('div');
    inputContainer.className = 'message-input-container';
    console.log('[CONTAINER] 📦 Input container created');
    
    const input = document.createElement('textarea');
    this.inputId = `message-input-${Date.now()}`;
    input.id = this.inputId;
    input.rows = 1;
    input.className = 'message-input';
    input.placeholder = 'Type your message...';
    console.log('[CONTAINER] 🆔 Input ID:', this.inputId);
    console.log('[CONTAINER] ⌨️ Textarea element created');
    
    const button = document.createElement('button');
    button.className = 'send-button';
    button.textContent = 'Send';
    console.log('[CONTAINER] 🔘 Send button created');
    
    // Event listeners
    console.log('[CONTAINER] 👂 Adding event listeners...');
    
    // Auto-resize functionality
    const autoResize = () => {
      input.style.height = 'auto';
      const newHeight = Math.min(input.scrollHeight, 150); // Max 6 rows (~150px)
      input.style.height = newHeight + 'px';
    };
    
    input.addEventListener('input', autoResize);
    
    // Set initial height
    setTimeout(() => autoResize(), 0);
    
    // Enter to send, Shift+Enter for new line
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendCurrentMessage();
      }
    });
    
    button.addEventListener('click', () => {
      this.sendCurrentMessage();
    });
    console.log('[CONTAINER] ✅ Event listeners attached');
    
    console.log('[CONTAINER] 📌 Assembling input components...');
    inputContainer.appendChild(input);
    inputContainer.appendChild(button);
    container.appendChild(inputContainer);
    console.log('[CONTAINER] ✅ Message input created and appended successfully');
    
    return this.inputId;
  }

  /**
   * Send current message in input
   */
  sendCurrentMessage() {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const input = document.getElementById(this.inputId);
    if (!input) return;

    const message = input.value.trim();
    if (message) {
      this.callbacks.onMessageSend.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in message send callback:', error);
        }
      });
      
      input.value = '';
      
      // Reset textarea height after clearing
      input.style.height = 'auto';
      input.style.height = '36px'; // Reset to min height
    }
  }

  /**
   * Show typing indicator
   * @param {string} personaName - Name to show in indicator
   * @param {number} timeout - Auto-hide timeout in ms
   */
  showTypingIndicator(personaName = 'Assistant', timeout = 0) {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const stream = document.getElementById(this.messageStreamId);
    if (!stream) return;

    // Remove existing indicator
    this.hideTypingIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `<em>${personaName} is typing...</em>`;
    
    stream.appendChild(indicator);
    this.typingIndicatorVisible = true;
    this.scrollToBottom();
    
    if (timeout > 0) {
      this.typingTimeout = setTimeout(() => {
        this.hideTypingIndicator();
      }, timeout);
    }
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const indicator = document.getElementById('typing-indicator');
    
    if (indicator) {
      indicator.remove();
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    this.typingIndicatorVisible = false;
  }

  /**
   * Create mobile drawer (collapsible chat)
   * @returns {string} Drawer ID
   */
  createMobileDrawer() {
    if (!this.isInitialized) return null;

    const document = typeof window !== 'undefined' ? window.document : global.document;
    const container = document.getElementById(this.containerId);
    
    container.className += ' chat-drawer collapsed';
    this.drawerId = this.containerId;
    this.isDrawerExpanded = false;
    
    // Add tap to expand functionality
    container.addEventListener('click', (e) => {
      if (!this.isDrawerExpanded && e.target.closest('.message-input-container')) {
        return; // Don't toggle when clicking input
      }
      this.toggleDrawer();
    });
    
    return this.drawerId;
  }

  /**
   * Toggle mobile drawer
   */
  toggleDrawer() {
    if (!this.drawerId) return;

    const document = typeof window !== 'undefined' ? window.document : global.document;
    const drawer = document.getElementById(this.drawerId);
    
    this.isDrawerExpanded = !this.isDrawerExpanded;
    
    if (this.isDrawerExpanded) {
      drawer.className = drawer.className.replace('collapsed', 'expanded');
    } else {
      drawer.className = drawer.className.replace('expanded', 'collapsed');
    }
    
    this.callbacks.onDrawerToggle.forEach(callback => {
      try {
        callback(this.isDrawerExpanded);
      } catch (error) {
        console.error('Error in drawer toggle callback:', error);
      }
    });
  }

  /**
   * Update responsive layout
   */
  updateResponsiveLayout(container = null) {
    if (!container && !this.isInitialized) return;

    const document = typeof window !== 'undefined' ? window.document : 
                    (typeof global !== 'undefined' && global && global.document ? global.document : null);
    const element = container || document.getElementById(this.containerId);
    
    const isMobile = this.isMobileView();
    
    if (isMobile) {
      element.className = element.className.replace('desktop-layout', '').trim();
      element.className += ' mobile-layout';
    } else {
      element.className = element.className.replace('mobile-layout', '').trim();
      element.className += ' desktop-layout';
    }
  }

  /**
   * Check if current viewport is mobile
   * @returns {boolean}
   */
  isMobileView() {
    const globalWindow = typeof window !== 'undefined' ? window : 
                        (typeof global !== 'undefined' && global && global.window ? global.window : { innerWidth: 1024 });
    return globalWindow.innerWidth < 768;
  }

  /**
   * Scroll message stream to bottom
   */
  scrollToBottom() {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const stream = document.getElementById(this.messageStreamId);
    if (stream) {
      stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
    }
  }

  /**
   * Update connection status
   * @param {boolean} isOnline
   */
  updateConnectionStatus(isOnline) {
    this.connectionStatus = isOnline;
    
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const header = document.getElementById(this.headerId);
    
    if (header) {
      header.className = header.className.replace(/\b(online|offline)\b/g, '');
      header.className += ` ${isOnline ? 'online' : 'offline'}`;
      
      const statusEl = header.querySelector('.connection-status');
      if (statusEl) {
        statusEl.textContent = isOnline ? 'Online' : 'Offline';
      }
    }
  }

  /**
   * Set input enabled/disabled state
   * @param {boolean} enabled
   */
  setInputEnabled(enabled) {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const input = document.getElementById(this.inputId);
    if (input) {
      input.disabled = !enabled;
    }
  }

  /**
   * Subscribe to message send events
   * @param {Function} callback
   */
  onMessageSend(callback) {
    this.callbacks.onMessageSend.push(callback);
  }

  /**
   * Subscribe to drawer toggle events
   * @param {Function} callback
   */
  onDrawerToggle(callback) {
    this.callbacks.onDrawerToggle.push(callback);
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const stream = document.getElementById(this.messageStreamId);
    if (stream) {
      stream.innerHTML = '';
    }
    this.messages = [];
    this.messageMetadata.clear();
  }

  /**
   * Get message metadata
   * @param {string} messageId
   * @returns {Object}
   */
  getMessageMetadata(messageId) {
    return this.messageMetadata.get(messageId) || {};
  }

  // Getter methods for testing
  getIsInitialized() { return this.isInitialized; }
  getConnectionStatus() { return this.connectionStatus; }
  isTypingIndicatorVisible() { return this.typingIndicatorVisible; }
  getMessageCount() { return this.messages.length; }

  /**
   * Get container statistics
   * @returns {Object}
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      messageCount: this.messages.length,
      isMobile: this.isMobileView(),
      isDrawerExpanded: this.isDrawerExpanded,
      connectionStatus: this.connectionStatus,
      typingVisible: this.typingIndicatorVisible
    };
  }

  /**
   * Setup responsive window resize handler
   * @private
   */
  _setupResponsiveHandler() {
    const globalWindow = typeof window !== 'undefined' ? window : 
                        (typeof global !== 'undefined' && global && global.window ? global.window : null);
    
    if (globalWindow) {
      globalWindow.addEventListener('resize', () => {
        this.updateResponsiveLayout();
      });
    }
  }

  /**
   * Cleanup and destroy container
   */
  destroy() {
    // Clear timeouts
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Remove DOM elements
    const document = typeof window !== 'undefined' ? window.document : global.document;
    const container = document.getElementById(this.containerId);
    if (container) {
      container.remove();
    }

    // Clear data
    this.messages = [];
    this.messageMetadata.clear();
    this.callbacks.onMessageSend = [];
    this.callbacks.onDrawerToggle = [];
    
    this.isInitialized = false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatContainer;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.ChatContainer = ChatContainer;
}