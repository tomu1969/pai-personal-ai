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
      console.log('🔬 [TRANSLATOR MODEL] Initializing chess mentor system...');
      
      // Merge configuration
      this.config = { ...this.config, ...options };

      // Initialize components for deterministic analysis
      this.gameStateCapture = new GameStateCapture();
      this.gameTriggers = new GameTriggers();
      this.chatHistory = new ChatHistory();
      this.chatWrapper = new ChatWrapper();
      this.chatContainer = new ChatContainer();
      
      this.chatHistory.setMaxMessages(this.config.maxChatHistory);
      
      this.isInitialized = true;
      console.log('✅ [TRANSLATOR MODEL] System initialized - ready for deterministic analysis');
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
    console.log('🔌 [TRANSLATOR MODEL] Connecting to chess game for deterministic analysis...');
    
    if (!this.isInitialized) {
      console.error('❌ [TRANSLATOR MODEL] System not initialized');
      throw new Error('Chess mentor not initialized. Call initialize() first.');
    }

    try {
      // Create chat UI
      const chatContainerId = this.chatContainer.createChatContainer(parentContainerId);
      if (!chatContainerId) {
        throw new Error('Failed to create chat container');
      }

      // Set up chat components
      this.chatContainer.createChatHeader(this.config.personaName, false);
      this.chatContainer.createMessageStream();
      this.chatContainer.createMessageInput();
      this.chatWrapper.setupMoveListener();
      this._setupEventHandlers();
      this._addInitialGreeting();
      
      this.isConnected = true;
      this.chatContainer.updateConnectionStatus(true);
      
      console.log('✅ [TRANSLATOR MODEL] Connected - ready to translate chess analysis');
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
      const legalMoves = this.gameStateCapture.getLegalMoves();
      const chatHistory = this.chatHistory.getRecentHistory(this.config.maxChatHistory);
      
      // Get current AI ELO from the UI (same value used for chess engine difficulty)
      const aiEloElement = document.getElementById('ai-elo');
      const currentAiElo = aiEloElement ? parseInt(aiEloElement.value) || 1500 : 1500;
      
      const gameContext = {
        fen: gameState.fen,
        pgn: gameState.pgn,
        lastMove: gameState.lastMove,
        userElo: currentAiElo,  // Use AI's ELO setting as user's skill level for Irina
        personaName: this.config.personaName,
        engineEval: evaluation,
        legalMoves: legalMoves,
        chatHistory: chatHistory,
        userMessage: message
      };

      console.log('🔬 [TRANSLATOR MODEL] Raw data being sent to reasoning engine:');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📡 FEN Position:', gameContext.fen);
      console.log('📡 Legal Moves (for moveReasoning analyzer):', legalMoves.map(m => m.san).join(', '));
      console.log('📡 Move Count:', legalMoves.length);
      console.log('📡 User ELO:', gameContext.userElo);
      console.log('📡 User Message:', gameContext.userMessage);
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎯 This data will be processed by deterministic analyzers:');
      console.log('   • boardRadar.js → BOARD_REALITY facts');
      console.log('   • safetyCheck.js → SAFETY_ALERT warnings');
      console.log('   • moveReasoning.js → STRATEGIC_ANALYSIS of legal moves');
      console.log('🔄 Analyzers will compute chess facts → LLM translates to natural language');
      console.log('═══════════════════════════════════════════════════════');
      
      // Add loading indicator
      const loadingId = this.chatContainer.addMessage('assistant', `${this.config.personaName} is analyzing...`);
      
      // Call backend API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gameContext),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // Remove loading indicator
        this.chatContainer.removeMessage(loadingId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.success && data.message) {
          // Log what the LLM translated from deterministic analysis
          console.log('✨ [TRANSLATOR MODEL] LLM Response received:');
          console.log('   • Processing Time:', data.processingTimeMs + 'ms');
          console.log('   • Response Length:', data.message.length, 'characters');
          console.log('   • Response Preview:', data.message.substring(0, 150) + '...');
          console.log('   • Translation Complete: Deterministic facts → Natural language');
          
          // Add AI response to chat
          this.chatHistory.addMessage('assistant', data.message);
          this.chatContainer.addMessage('assistant', data.message);
          this.lastResponseTime = Date.now();
        } else {
          throw new Error('Invalid response from backend');
        }
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Remove loading indicator
        this.chatContainer.removeMessage(loadingId);
        
        console.error('Error processing user message:', fetchError);
        console.error('Game context that failed:', gameContext);
        
        let errorMessage = "I'm having trouble understanding right now. Could you rephrase your question?";
        
        if (fetchError.name === 'AbortError') {
          errorMessage = "The request timed out. Please try again.";
          console.error('Request timeout after 10 seconds');
        } else if (fetchError.message.includes('Failed to fetch')) {
          errorMessage = "Can't connect to the chess analysis server. Please check your connection.";
          console.error('Network error - likely CORS or server down:', fetchError);
        }
        
        // Provide fallback response
        this.chatHistory.addMessage('assistant', errorMessage);
        this.chatContainer.addMessage('assistant', errorMessage);
      }
    } catch (error) {
      console.error('Unexpected error in _processUserMessage:', error);
      
      // Provide fallback response for any other errors
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