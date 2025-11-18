/**
 * Chess Mentor Integration
 * Connects the ChatWrapper, ChatContainer, and Phase 2 modules
 * to create a complete conversational chess mentor experience
 */

class ChessMentorIntegration {
  constructor() {
    this.chatWrapper = null;
    this.chatContainer = null;
    this.gameStateCapture = null;
    this.gameTriggers = null;
    this.chatHistory = null;
    
    this.isInitialized = false;
    this.isConnected = false;
    
    // Configuration
    this.config = {
      personaName: 'Irina',
      userElo: 1500,
      enableAutoResponses: true,
      responseDelay: 1000, // ms delay before auto-response
      maxChatHistory: 50,
      mentorTone: 'encouraging'
    };
    
    // State tracking
    this.previousEvaluation = null;
    this.lastResponseTime = 0;
    this.responseThreshold = 3000; // Minimum time between auto-responses
  }

  /**
   * Initialize the chess mentor system
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    try {
      console.log('[MENTOR] 🚀 Starting chess mentor initialization...');
      console.log('[MENTOR] 📝 Input options:', options);
      
      // Merge configuration
      this.config = { ...this.config, ...options };
      console.log('[MENTOR] ⚙️ Merged config:', this.config);

      // Initialize Phase 2 modules
      console.log('[MENTOR] 🎮 Creating GameStateCapture...');
      this.gameStateCapture = new GameStateCapture();
      console.log('[MENTOR] 🎮 GameStateCapture created');
      
      console.log('[MENTOR] 🎯 Creating GameTriggers...');
      this.gameTriggers = new GameTriggers();
      console.log('[MENTOR] 🎯 GameTriggers created');
      
      console.log('[MENTOR] 💬 Creating ChatHistory...');
      this.chatHistory = new ChatHistory();
      console.log('[MENTOR] 💬 ChatHistory created');
      
      // Initialize chat components
      console.log('[MENTOR] 🔗 Creating ChatWrapper...');
      this.chatWrapper = new ChatWrapper();
      console.log('[MENTOR] 🔗 ChatWrapper created');
      
      console.log('[MENTOR] 📦 Creating ChatContainer...');
      this.chatContainer = new ChatContainer();
      console.log('[MENTOR] 📦 ChatContainer created');
      
      // Set up chat history limit
      console.log('[MENTOR] 📊 Setting chat history limit to:', this.config.maxChatHistory);
      this.chatHistory.setMaxMessages(this.config.maxChatHistory);
      
      this.isInitialized = true;
      console.log('[MENTOR] ✅ Chess mentor integration initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[MENTOR] ❌ Failed to initialize chess mentor:', error);
      console.error('[MENTOR] ❌ Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Connect to the live chess game
   * @param {string} parentContainerId - ID of container to attach chat UI
   * @returns {boolean} Success status
   */
  connect(parentContainerId = 'game-container') {
    console.log('[MENTOR] 🔌 Starting connection to chess game...');
    console.log('[MENTOR] 📍 Parent container ID:', parentContainerId);
    console.log('[MENTOR] 🔍 Is initialized?', this.isInitialized);
    
    if (!this.isInitialized) {
      console.error('[MENTOR] ❌ Chess mentor not initialized. Call initialize() first.');
      throw new Error('Chess mentor not initialized. Call initialize() first.');
    }

    try {
      // Check if parent container exists
      const parentElement = document.getElementById(parentContainerId);
      console.log('[MENTOR] 📍 Parent element found?', parentElement ? '✅ YES' : '❌ NO');
      if (parentElement) {
        console.log('[MENTOR] 📍 Parent element details:', {
          id: parentElement.id,
          className: parentElement.className,
          innerHTML: parentElement.innerHTML.substring(0, 100) + '...'
        });
      }

      // Create chat UI
      console.log('[MENTOR] 📦 Creating chat container...');
      const chatContainerId = this.chatContainer.createChatContainer(parentContainerId);
      console.log('[MENTOR] 📦 Chat container ID returned:', chatContainerId);
      
      if (!chatContainerId) {
        throw new Error('Failed to create chat container');
      }

      // Set up chat components
      console.log('[MENTOR] 📋 Creating chat header with persona:', this.config.personaName);
      this.chatContainer.createChatHeader(this.config.personaName, false);
      
      console.log('[MENTOR] 💬 Creating message stream...');
      this.chatContainer.createMessageStream();
      
      console.log('[MENTOR] ⌨️ Creating message input...');
      this.chatContainer.createMessageInput();

      // Connect to chess game events
      console.log('[MENTOR] 🔗 Setting up move listener...');
      this.chatWrapper.setupMoveListener();
      
      // Set up event handlers
      console.log('[MENTOR] 🎛️ Setting up event handlers...');
      this._setupEventHandlers();
      
      // Add initial greeting
      console.log('[MENTOR] 👋 Adding initial greeting...');
      this._addInitialGreeting();
      
      this.isConnected = true;
      
      // Update connection status in UI
      console.log('[MENTOR] 🟢 Updating connection status to online...');
      this.chatContainer.updateConnectionStatus(true);
      
      console.log('[MENTOR] ✅ Chess mentor connected to game successfully');
      return true;
      
    } catch (error) {
      console.error('[MENTOR] ❌ Failed to connect chess mentor:', error);
      console.error('[MENTOR] ❌ Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Disconnect from the chess game
   */
  disconnect() {
    if (this.chatWrapper) {
      this.chatWrapper.destroy();
    }
    
    if (this.chatContainer) {
      this.chatContainer.destroy();
    }
    
    this.isConnected = false;
    console.log('Chess mentor disconnected');
  }

  /**
   * Send a user message manually
   * @param {string} message - User message
   */
  sendUserMessage(message) {
    if (!this.isConnected || !message.trim()) {
      return;
    }

    // Add user message to history and UI
    const messageId = this.chatHistory.addMessage('user', message);
    this.chatContainer.addMessage('user', message);
    
    // Process the message and potentially respond
    this._processUserMessage(message);
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update persona name in UI if changed
    if (newConfig.personaName && this.chatContainer) {
      this.chatContainer.updateConnectionStatus(this.isConnected);
    }
  }

  /**
   * Get chat statistics
   * @returns {Object} Chat statistics
   */
  getStats() {
    return {
      integration: {
        initialized: this.isInitialized,
        connected: this.isConnected,
        lastResponseTime: this.lastResponseTime
      },
      chatHistory: this.chatHistory ? this.chatHistory.getMemoryStats() : null,
      chatContainer: this.chatContainer ? this.chatContainer.getStats() : null,
      chatWrapper: this.chatWrapper ? this.chatWrapper.getStats() : null
    };
  }

  /**
   * Set up event handlers for chess game and chat interactions
   * @private
   */
  _setupEventHandlers() {
    // Handle chess moves
    this.chatWrapper.onMove((moveData) => {
      this._handleMove(moveData);
    });

    // Handle user chat input
    this.chatContainer.onMessageSend((message) => {
      this.sendUserMessage(message);
    });

    // Handle mobile drawer events
    this.chatContainer.onDrawerToggle((isExpanded) => {
      console.log('Chat drawer toggled:', isExpanded);
    });
  }

  /**
   * Handle a chess move and potentially generate mentor response
   * @private
   */
  async _handleMove(moveData) {
    try {
      const { from, to, gameState, evaluation } = moveData;
      
      console.log('Move detected:', { from, to });
      
      // Skip if auto-responses are disabled
      if (!this.config.enableAutoResponses) {
        return;
      }

      // Rate limiting - don't spam responses
      const now = Date.now();
      if (now - this.lastResponseTime < this.responseThreshold) {
        return;
      }

      // Capture complete game state for analysis
      const completeGameState = this._buildCompleteGameState(gameState, evaluation);
      
      // Analyze for triggers
      const triggers = this.gameTriggers.analyzeGameState(completeGameState);
      
      if (triggers.length > 0) {
        // Prioritize triggers and select the most important
        const prioritizedTriggers = this.gameTriggers.prioritizeTriggers(triggers);
        const topTrigger = prioritizedTriggers[0];
        
        // Generate mentor response
        const response = this.gameTriggers.generateMentorResponse(topTrigger, this.chatHistory);
        
        if (response.shouldRespond) {
          // Delay the response to feel more natural
          setTimeout(() => {
            this._sendMentorResponse(response.message);
          }, this.config.responseDelay);
        }
      }

      // Update state for next comparison
      this.previousEvaluation = evaluation;
      
    } catch (error) {
      console.error('Error handling move:', error);
    }
  }

  /**
   * Process user message and potentially respond
   * @private
   */
  async _processUserMessage(message) {
    try {
      // Build game context for AI
      const gameState = this.gameStateCapture.captureCurrentState();
      const evaluation = this.gameStateCapture.getEngineEvaluation();
      const chatHistory = this.chatHistory.getRecentHistory(this.config.maxChatHistory);
      
      const gameContext = {
        fen: gameState.fen,
        pgn: gameState.pgn,
        lastMove: gameState.lastMove,
        userElo: this.config.userElo,
        personaName: this.config.personaName,
        engineEval: evaluation,
        chatHistory: chatHistory,
        userMessage: message
      };

      console.log('Sending request to AI backend:', gameContext);
      
      // Add loading indicator
      const loadingId = this.chatContainer.addMessage('assistant', `${this.config.personaName} is analyzing...`);
      
      // Call backend API
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameContext)
      });

      // Remove loading indicator
      this.chatContainer.removeMessage(loadingId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.message) {
        // Add AI response to chat
        this.chatHistory.addMessage('assistant', data.message);
        this.chatContainer.addMessage('assistant', data.message);
        this.lastResponseTime = Date.now();
        
        console.log(`${this.config.personaName} responded in ${data.processingTimeMs}ms`);
      } else {
        throw new Error('Invalid response from backend');
      }
      
    } catch (error) {
      console.error('Error processing user message:', error);
      
      // Provide fallback response
      const fallbackMessage = "I'm having trouble understanding right now. Could you rephrase your question?";
      this.chatHistory.addMessage('assistant', fallbackMessage);
      this.chatContainer.addMessage('assistant', fallbackMessage);
    }
  }

  /**
   * Build complete game state for trigger analysis
   * @private
   */
  _buildCompleteGameState(gameState, evaluation) {
    return {
      ...gameState,
      userElo: this.config.userElo,
      personaName: this.config.personaName,
      engineEval: evaluation,
      previousEval: this.previousEvaluation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send a mentor response to the chat
   * @private
   */
  _sendMentorResponse(message) {
    if (!this.isConnected || !message) {
      return;
    }

    try {
      // Show typing indicator
      this.chatContainer.showTypingIndicator(this.config.personaName, 2000);
      
      // Add to history
      this.chatHistory.addMessage('assistant', message);
      
      // Display in chat UI after short delay
      setTimeout(() => {
        this.chatContainer.hideTypingIndicator();
        this.chatContainer.addMessage('assistant', message, {
          context: { type: 'auto_response' }
        });
        
        this.lastResponseTime = Date.now();
      }, 1500);
      
    } catch (error) {
      console.error('Error sending mentor response:', error);
    }
  }

  /**
   * Add initial greeting message
   * @private
   */
  _addInitialGreeting() {
    const greeting = `Hello! I'm ${this.config.personaName}, your chess mentor. I'll help analyze your game and provide guidance. Good luck!`;
    
    // Add to history
    this.chatHistory.addMessage('assistant', greeting);
    
    // Display in chat UI
    setTimeout(() => {
      this.chatContainer.addMessage('assistant', greeting, {
        context: { type: 'greeting' }
      });
    }, 500);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChessMentorIntegration;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.ChessMentorIntegration = ChessMentorIntegration;
}