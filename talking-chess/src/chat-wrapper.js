/**
 * Chat Wrapper - Non-Invasive Chess Integration
 * Provides read-only access to chess game state and event listening
 * WITHOUT modifying the existing chess implementation
 */

class ChatWrapper {
  constructor() {
    this.moveListeners = new Set();
    this.stateListeners = new Set();
    this.evaluationListeners = new Set();
    this.readOnlyMode = true;
    this.originalFunctions = new Map();
    this.isInitialized = false;
  }

  /**
   * Check if chess game is available in global scope
   * @returns {boolean}
   */
  isChessGameAvailable() {
    console.log('[WRAPPER] 🔍 Checking if chess game is available...');
    const isAvailable = typeof window !== 'undefined' ? 
      (typeof window.game === 'object' && window.game !== null) :
      (typeof global.game === 'object' && global.game !== null);
    
    console.log('[WRAPPER] 🎮 Chess game available?', isAvailable ? '✅ YES' : '❌ NO');
    if (typeof window !== 'undefined') {
      console.log('[WRAPPER] 🎮 window.game type:', typeof window.game);
      console.log('[WRAPPER] 🎮 window.game value:', window.game);
    }
    
    return isAvailable;
  }

  /**
   * Check if engine is available in global scope
   * @returns {boolean}
   */
  isEngineAvailable() {
    console.log('[WRAPPER] 🔍 Checking if engine is available...');
    const isAvailable = typeof window !== 'undefined' ?
      (typeof window.engine === 'object' && window.engine !== null) :
      (typeof global.engine === 'object' && global.engine !== null);
    
    console.log('[WRAPPER] 🤖 Engine available?', isAvailable ? '✅ YES' : '❌ NO');
    if (typeof window !== 'undefined') {
      console.log('[WRAPPER] 🤖 window.engine type:', typeof window.engine);
      console.log('[WRAPPER] 🤖 window.engine value:', window.engine);
    }
    
    return isAvailable;
  }

  /**
   * Check if wrapper is in read-only mode
   * @returns {boolean}
   */
  isReadOnlyMode() {
    return this.readOnlyMode;
  }

  /**
   * Check if wrapper can modify chess state (always false for safety)
   * @returns {boolean}
   */
  canModifyChessState() {
    return false; // Always false to prevent accidental modifications
  }

  /**
   * Get reference to global game object
   * @private
   */
  _getGame() {
    return typeof window !== 'undefined' ? window.game : global.game;
  }

  /**
   * Get reference to global engine object
   * @private
   */
  _getEngine() {
    return typeof window !== 'undefined' ? window.engine : global.engine;
  }

  /**
   * Get current game state (read-only)
   * @returns {Object|null} Game state or null if unavailable
   */
  getCurrentGameState() {
    console.log('[WRAPPER] 📊 Getting current game state...');
    
    if (!this.isChessGameAvailable()) {
      console.log('[WRAPPER] ❌ Chess game not available - returning null');
      return null;
    }

    const game = this._getGame();
    console.log('[WRAPPER] 🎮 Retrieved game object:', game ? 'EXISTS' : 'NULL');
    
    try {
      console.log('[WRAPPER] 🔄 Extracting game state...');
      const gameState = {
        fen: game.fen(),
        pgn: game.pgn(),
        turn: game.turn(),
        inCheck: game.in_check(),
        isGameOver: game.game_over(),
        timestamp: new Date().toISOString()
      };
      console.log('[WRAPPER] ✅ Game state extracted successfully:', {
        hasfen: !!gameState.fen,
        turn: gameState.turn,
        inCheck: gameState.inCheck,
        isGameOver: gameState.isGameOver
      });
      return gameState;
    } catch (error) {
      console.error('[WRAPPER] ❌ Error reading game state:', error);
      console.error('[WRAPPER] ❌ Error stack:', error.stack);
      return null;
    }
  }

  /**
   * Get current engine evaluation (read-only)
   * @returns {Object} Evaluation object
   */
  getCurrentEvaluation() {
    if (!this.isEngineAvailable()) {
      return {
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      };
    }

    const engine = this._getEngine();
    const evaluation = engine.currentEvaluation;

    if (!evaluation) {
      return {
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      };
    }

    // Return copy to prevent modifications
    return {
      score: evaluation.score,
      bestMove: evaluation.bestMove,
      depth: evaluation.depth || 0,
      mate: evaluation.mate
    };
  }

  /**
   * Set up move listener using proxy pattern (non-invasive)
   */
  setupMoveListener() {
    console.log('[WRAPPER] 🔗 Setting up move listener...');
    const globalScope = typeof window !== 'undefined' ? window : global;
    console.log('[WRAPPER] 🌐 Global scope type:', typeof window !== 'undefined' ? 'window' : 'global');
    
    // Check if makeMove exists
    console.log('[WRAPPER] 🔍 Checking for makeMove function...');
    console.log('[WRAPPER] 🔍 makeMove type:', typeof globalScope.makeMove);
    console.log('[WRAPPER] 🔍 makeMove exists?', typeof globalScope.makeMove === 'function' ? '✅ YES' : '❌ NO');
    
    if (typeof globalScope.makeMove !== 'function') {
      console.warn('[WRAPPER] ⚠️ Original makeMove function not available - creating fallback');
      // Create safe fallback if original doesn't exist
      globalScope.makeMove = () => {
        console.warn('Original makeMove function not available');
        return false;
      };
      console.log('[WRAPPER] 🔄 Fallback makeMove function created');
      return;
    }

    // Save original function if not already saved
    console.log('[WRAPPER] 💾 Checking if original function already saved...');
    if (!this.originalFunctions.has('makeMove')) {
      console.log('[WRAPPER] 💾 Saving original makeMove function');
      this.originalFunctions.set('makeMove', globalScope.makeMove);
    } else {
      console.log('[WRAPPER] ✅ Original makeMove already saved');
    }

    const originalMakeMove = this.originalFunctions.get('makeMove');
    const chatWrapper = this;
    console.log('[WRAPPER] 🔧 Preparing to wrap makeMove function...');

    // Wrap the function
    globalScope.makeMove = function(from, to) {
      console.log('[WRAPPER] 🎯 makeMove called with:', { from, to });
      
      // Call original function first
      const result = originalMakeMove.call(this, from, to);
      console.log('[WRAPPER] 🎯 Original makeMove result:', result);
      
      // Only trigger our events if the move was successful
      if (result) {
        console.log('[WRAPPER] ✅ Move successful - triggering events');
        chatWrapper._triggerMoveEvent(from, to);
        chatWrapper._triggerStateChangeEvent();
      } else {
        console.log('[WRAPPER] ❌ Move failed - not triggering events');
      }
      
      return result;
    };

    this.isInitialized = true;
    console.log('[WRAPPER] ✅ Move listener setup completed');
    console.log('[WRAPPER] 🏁 isInitialized set to:', this.isInitialized);
  }

  /**
   * Trigger move event for all listeners
   * @private
   */
  _triggerMoveEvent(from, to) {
    const gameState = this.getCurrentGameState();
    const evaluation = this.getCurrentEvaluation();

    const moveData = {
      from: from,
      to: to,
      gameState: gameState,
      evaluation: evaluation,
      timestamp: new Date().toISOString()
    };

    this.moveListeners.forEach(callback => {
      try {
        callback(moveData);
      } catch (error) {
        console.error('Error in move listener:', error);
      }
    });
  }

  /**
   * Trigger state change event for all listeners
   * @private
   */
  _triggerStateChangeEvent() {
    const gameState = this.getCurrentGameState();

    this.stateListeners.forEach(callback => {
      try {
        callback(gameState);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Subscribe to move events
   * @param {Function} callback - Function to call when move occurs
   * @returns {Function} Unsubscribe function
   */
  onMove(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.moveListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.moveListeners.delete(callback);
    };
  }

  /**
   * Subscribe to game state changes
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  onGameStateChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.stateListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * Subscribe to evaluation updates
   * @param {Function} callback - Function to call when evaluation changes
   * @returns {Function} Unsubscribe function
   */
  onEvaluationUpdate(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.evaluationListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.evaluationListeners.delete(callback);
    };
  }

  /**
   * Get number of move listeners (for testing)
   * @returns {number}
   */
  getMoveListenerCount() {
    return this.moveListeners.size;
  }

  /**
   * Get number of state listeners (for testing)
   * @returns {number}
   */
  getStateListenerCount() {
    return this.stateListeners.size;
  }

  /**
   * Get number of evaluation listeners (for testing)
   * @returns {number}
   */
  getEvaluationListenerCount() {
    return this.evaluationListeners.size;
  }

  /**
   * Restore original functions and cleanup
   */
  destroy() {
    // Clear all listeners
    this.moveListeners.clear();
    this.stateListeners.clear();
    this.evaluationListeners.clear();

    // Restore original functions
    const globalScope = typeof window !== 'undefined' ? window : global;
    
    this.originalFunctions.forEach((originalFunction, functionName) => {
      if (globalScope[functionName]) {
        globalScope[functionName] = originalFunction;
      }
    });

    this.originalFunctions.clear();
    this.isInitialized = false;
  }

  /**
   * Get wrapper statistics
   * @returns {Object}
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      readOnlyMode: this.readOnlyMode,
      chessAvailable: this.isChessGameAvailable(),
      engineAvailable: this.isEngineAvailable(),
      moveListeners: this.moveListeners.size,
      stateListeners: this.stateListeners.size,
      evaluationListeners: this.evaluationListeners.size
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatWrapper;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.ChatWrapper = ChatWrapper;
}