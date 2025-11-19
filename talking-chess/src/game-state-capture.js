/**
 * Game State Capture Module
 * Captures current chess game state and formats it for AI backend
 */

class GameStateCapture {
  constructor() {
    console.log('[GAMESTATE] 🏗️ GameStateCapture constructor called');
  }

  /**
   * Capture current state from global objects (new architecture)
   * @returns {Object} Complete game state
   */
  captureCurrentState() {
    console.log('[GAMESTATE] 📊 Capturing current game state...');
    
    const globalScope = typeof window !== 'undefined' ? window : global;
    console.log('[GAMESTATE] 🌐 Global scope type:', typeof window !== 'undefined' ? 'window' : 'global');
    
    // Check availability of global objects
    const gameAvailable = typeof globalScope.game === 'object' && globalScope.game !== null;
    console.log('[GAMESTATE] 🎮 Game object available?', gameAvailable ? '✅ YES' : '❌ NO');
    
    if (!gameAvailable) {
      console.error('[GAMESTATE] ❌ Game object not available');
      return null;
    }

    try {
      const game = globalScope.game;
      console.log('[GAMESTATE] 🔄 Extracting state from game object...');
      
      const state = {
        fen: game.fen(),
        pgn: game.pgn(),
        turn: game.turn(),
        inCheck: game.in_check(),
        isGameOver: game.game_over(),
        timestamp: new Date().toISOString()
      };

      console.log('[GAMESTATE] ✅ Game state captured successfully:', {
        hasFen: !!state.fen,
        turn: state.turn,
        inCheck: state.inCheck,
        isGameOver: state.isGameOver
      });

      return state;
    } catch (error) {
      console.error('[GAMESTATE] ❌ Error capturing game state:', error);
      console.error('[GAMESTATE] ❌ Error stack:', error.stack);
      return null;
    }
  }

  /**
   * Get all legal moves in the current position
   * @returns {Array} Array of legal moves with from, to, san notation
   */
  getLegalMoves() {
    console.log('[GAMESTATE] 🎯 Getting legal moves...');
    
    const globalScope = typeof window !== 'undefined' ? window : global;
    const gameAvailable = typeof globalScope.game === 'object' && globalScope.game !== null;
    
    if (!gameAvailable) {
      console.log('[GAMESTATE] ⚠️ Game object not available - returning empty moves array');
      return [];
    }

    try {
      const game = globalScope.game;
      const moves = game.moves({ verbose: true });
      
      const legalMoves = moves.map(move => ({
        from: move.from,
        to: move.to,
        san: move.san,
        piece: move.piece,
        captured: move.captured || null,
        promotion: move.promotion || null
      }));
      
      console.log('[GAMESTATE] 🎯 Legal moves captured:', legalMoves.length, 'moves');
      return legalMoves;
    } catch (error) {
      console.error('[GAMESTATE] ❌ Error getting legal moves:', error);
      return [];
    }
  }

  /**
   * Get engine evaluation from global engine object
   * @returns {Object} Engine evaluation
   */
  getEngineEvaluation() {
    console.log('[GAMESTATE] 🤖 Getting engine evaluation...');
    
    const globalScope = typeof window !== 'undefined' ? window : global;
    const engineAvailable = typeof globalScope.engine === 'object' && globalScope.engine !== null;
    console.log('[GAMESTATE] 🤖 Engine object available?', engineAvailable ? '✅ YES' : '❌ NO');
    
    if (!engineAvailable) {
      console.log('[GAMESTATE] ⚠️ Engine not available - returning default evaluation');
      return {
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      };
    }

    try {
      const engine = globalScope.engine;
      const evaluation = engine.currentEvaluation;
      console.log('[GAMESTATE] 📊 Engine evaluation:', evaluation ? 'EXISTS' : 'NULL');
      
      if (!evaluation) {
        console.log('[GAMESTATE] ⚠️ No current evaluation - returning defaults');
        return {
          score: null,
          bestMove: null,
          depth: 0,
          mate: null
        };
      }

      const result = {
        score: evaluation.score,
        bestMove: evaluation.bestMove,
        depth: evaluation.depth || 0,
        mate: evaluation.mate
      };
      
      console.log('[GAMESTATE] ✅ Engine evaluation captured:', {
        hasScore: result.score !== null,
        hasBestMove: !!result.bestMove,
        depth: result.depth
      });

      return result;
    } catch (error) {
      console.error('[GAMESTATE] ❌ Error getting engine evaluation:', error);
      return {
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      };
    }
  }

  /**
   * Capture complete game state including FEN, PGN, and engine evaluation
   * @param {Object} engine - Stockfish engine instance
   * @param {Object} game - Chess game instance
   * @param {number} userElo - User's ELO rating
   * @param {string} personaName - AI persona name
   * @returns {Object} Complete game state
   */
  captureGameState(engine, game, userElo, personaName) {
    console.log('[GAMESTATE] 📊 Capturing legacy game state...');
    console.log('[GAMESTATE] 🔍 Input parameters:', {
      hasEngine: !!engine,
      hasGame: !!game,
      userElo: userElo,
      personaName: personaName
    });
    
    // Validate inputs
    this._validateInputs(engine, game, userElo, personaName);

    const gameState = game.getGameState();
    const moveHistory = game.getMoveHistory();
    
    const state = {
      fen: game.getFEN(),
      pgn: game.getPGN(),
      lastMove: game.getLastMove(),
      gameState: gameState,
      userElo: userElo,
      personaName: personaName,
      engineEval: this._getEngineEvaluation(engine),
      engineStatus: engine.getStatus(),
      timestamp: new Date().toISOString(),
      moveCount: moveHistory.length,
      recentMoves: this.extractRecentHistory(moveHistory, 5)
    };

    console.log('[GAMESTATE] ✅ Legacy state captured, validating...');
    // Validate the captured state
    const validation = this.validateGameState(state);
    if (!validation.isValid) {
      console.error('[GAMESTATE] ❌ Invalid game state:', validation.errors);
      throw new Error(`Invalid game state: ${validation.errors.join(', ')}`);
    }

    console.log('[GAMESTATE] ✅ Legacy game state validation passed');
    return state;
  }

  /**
   * Validate game state structure and data
   * @param {Object} state - Game state object
   * @returns {Object} Validation result with isValid and errors
   */
  validateGameState(state) {
    const errors = [];

    // Validate FEN
    if (!state.fen || typeof state.fen !== 'string') {
      errors.push('Invalid FEN format');
    } else {
      const fenParts = state.fen.split(' ');
      if (fenParts.length !== 6) {
        errors.push('FEN must have 6 parts');
      }
    }

    // Validate PGN
    if (typeof state.pgn !== 'string') {
      errors.push('PGN must be a string');
    }

    // Validate ELO
    if (typeof state.userElo !== 'number' || state.userElo < 800 || state.userElo > 3000) {
      errors.push('User ELO must be between 800-3000');
    }

    // Validate persona name
    if (!state.personaName || typeof state.personaName !== 'string') {
      errors.push('Persona name is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Format game state and chat history into payload for AI backend
   * @param {Object} gameState - Captured game state
   * @param {Array} chatHistory - Array of chat messages
   * @param {string} userMessage - Current user message
   * @returns {Object} Formatted payload
   */
  formatContextPayload(gameState, chatHistory, userMessage) {
    return {
      fen: gameState.fen,
      pgn: gameState.pgn,
      lastMove: gameState.lastMove,
      userElo: gameState.userElo,
      personaName: gameState.personaName,
      engineEval: gameState.engineEval,
      chatHistory: this._limitChatHistory(chatHistory || []),
      userMessage: userMessage,
      timestamp: new Date().toISOString(),
      gameState: gameState.gameState,
      recentMoves: gameState.recentMoves
    };
  }

  /**
   * Extract recent move history for context
   * @param {Array} fullHistory - Complete move history
   * @param {number} count - Number of recent moves to extract
   * @returns {Array} Recent moves
   */
  extractRecentHistory(fullHistory, count = 5) {
    if (!Array.isArray(fullHistory)) {
      return [];
    }
    return fullHistory.slice(-count);
  }

  /**
   * Validate inputs for game state capture
   * @private
   */
  _validateInputs(engine, game, userElo, personaName) {
    if (!engine || typeof engine.getStatus !== 'function') {
      throw new Error('Invalid engine object');
    }

    if (!engine.getStatus().ready) {
      throw new Error('Engine not ready for state capture');
    }

    if (!game || typeof game.getFEN !== 'function') {
      throw new Error('Invalid game object');
    }

    if (typeof userElo !== 'number' || userElo < 800 || userElo > 3000) {
      throw new Error('Invalid ELO rating: must be between 800-3000');
    }

    if (!personaName || typeof personaName !== 'string') {
      throw new Error('Persona name is required');
    }
  }

  /**
   * Get engine evaluation with fallback for null values
   * @private
   */
  _getEngineEvaluation(engine) {
    const evaluation = engine.currentEvaluation;
    
    if (!evaluation) {
      return {
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      };
    }

    // Return a copy to avoid modifying the original
    return {
      score: evaluation.score,
      bestMove: evaluation.bestMove,
      depth: evaluation.depth || 0,
      mate: evaluation.mate
    };
  }

  /**
   * Limit chat history to last N messages for context
   * @private
   */
  _limitChatHistory(chatHistory, limit = 4) {
    if (!Array.isArray(chatHistory)) {
      return [];
    }
    return chatHistory.slice(-limit);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameStateCapture;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  window.GameStateCapture = GameStateCapture;
}