/**
 * Chat Wrapper Tests - TDD Phase 3.1
 * Tests non-invasive chat integration that preserves chess functionality
 */

const ChatWrapper = require('../../src/chat-wrapper');

describe('Chat Wrapper - Non-Invasive Integration', () => {
  let chatWrapper;
  let mockGame;
  let mockEngine;

  beforeEach(() => {
    // Mock the global chess game object (as it exists in chess-v2.js)
    mockGame = {
      fen: jest.fn(() => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      pgn: jest.fn(() => ''),
      turn: jest.fn(() => 'w'),
      in_check: jest.fn(() => false),
      game_over: jest.fn(() => false),
      get: jest.fn(() => ({ type: 'p', color: 'w' })),
      move: jest.fn(() => ({ san: 'e4', from: 'e2', to: 'e4' })),
      moves: jest.fn(() => ['e4', 'e3', 'Nf3'])
    };

    // Mock the global engine object
    mockEngine = {
      currentEvaluation: {
        score: 0.2,
        bestMove: 'e4',
        depth: 15,
        mate: null
      }
    };

    // Mock global variables as they exist in chess-v2.js
    global.game = mockGame;
    global.engine = mockEngine;
    global.isPlayerTurn = true;
    global.selectedSquare = null;

    chatWrapper = new ChatWrapper();
  });

  describe('Initialization Safety', () => {
    test('should initialize without affecting existing game state', () => {
      expect(mockGame.fen).not.toHaveBeenCalled();
      expect(mockGame.pgn).not.toHaveBeenCalled();
      expect(global.isPlayerTurn).toBe(true);
      expect(global.selectedSquare).toBe(null);
    });

    test('should detect chess game availability', () => {
      expect(chatWrapper.isChessGameAvailable()).toBe(true);
      
      // Test when game is not available
      global.game = null;
      expect(chatWrapper.isChessGameAvailable()).toBe(false);
    });

    test('should detect engine availability', () => {
      expect(chatWrapper.isEngineAvailable()).toBe(true);
      
      // Test when engine is not available
      global.engine = null;
      expect(chatWrapper.isEngineAvailable()).toBe(false);
    });

    test('should initialize in read-only mode by default', () => {
      expect(chatWrapper.isReadOnlyMode()).toBe(true);
      expect(chatWrapper.canModifyChessState()).toBe(false);
    });
  });

  describe('Game State Reading (Non-Invasive)', () => {
    test('should read current game state without modification', () => {
      const gameState = chatWrapper.getCurrentGameState();

      expect(gameState).toHaveProperty('fen');
      expect(gameState).toHaveProperty('pgn');
      expect(gameState).toHaveProperty('turn');
      expect(gameState).toHaveProperty('inCheck');
      expect(gameState).toHaveProperty('isGameOver');

      // Verify we only read, never modify
      expect(mockGame.fen).toHaveBeenCalledTimes(1);
      expect(mockGame.pgn).toHaveBeenCalledTimes(1);
      expect(mockGame.turn).toHaveBeenCalledTimes(1);
      expect(mockGame.in_check).toHaveBeenCalledTimes(1);
      expect(mockGame.game_over).toHaveBeenCalledTimes(1);
    });

    test('should handle missing game gracefully', () => {
      global.game = null;
      
      const gameState = chatWrapper.getCurrentGameState();
      
      expect(gameState).toBeNull();
    });

    test('should read engine evaluation without modification', () => {
      const evaluation = chatWrapper.getCurrentEvaluation();

      expect(evaluation).toEqual({
        score: 0.2,
        bestMove: 'e4',
        depth: 15,
        mate: null
      });

      // Should not modify engine state
      expect(global.engine.currentEvaluation.score).toBe(0.2);
    });
  });

  describe('Event Listener Setup', () => {
    test('should set up move listeners without breaking existing functionality', () => {
      const originalMakeMove = jest.fn();
      global.makeMove = originalMakeMove;

      chatWrapper.setupMoveListener();

      // Test that wrapper doesn't break original function
      expect(typeof global.makeMove).toBe('function');
      expect(global.makeMove).not.toBe(originalMakeMove); // Should be wrapped
    });

    test('should preserve original function behavior when wrapped', () => {
      const originalMakeMove = jest.fn(() => 'original_result');
      global.makeMove = originalMakeMove;

      chatWrapper.setupMoveListener();
      const result = global.makeMove('e2', 'e4');

      expect(originalMakeMove).toHaveBeenCalledWith('e2', 'e4');
      expect(result).toBe('original_result');
    });

    test('should call event callbacks after move completion', () => {
      const originalMakeMove = jest.fn(() => true);
      const moveCallback = jest.fn();
      
      global.makeMove = originalMakeMove;
      chatWrapper.onMove(moveCallback);
      chatWrapper.setupMoveListener();

      global.makeMove('e2', 'e4');

      expect(originalMakeMove).toHaveBeenCalledWith('e2', 'e4');
      expect(moveCallback).toHaveBeenCalledWith({
        from: 'e2',
        to: 'e4',
        gameState: expect.any(Object),
        evaluation: expect.any(Object),
        timestamp: expect.any(String)
      });
    });

    test('should handle missing original function gracefully', () => {
      global.makeMove = undefined;
      
      expect(() => chatWrapper.setupMoveListener()).not.toThrow();
      expect(typeof global.makeMove).toBe('function'); // Should create safe fallback
    });
  });

  describe('Event Subscription System', () => {
    test('should allow subscribing to move events', () => {
      const callback = jest.fn();
      const unsubscribe = chatWrapper.onMove(callback);

      expect(typeof unsubscribe).toBe('function');
      expect(chatWrapper.getMoveListenerCount()).toBe(1);
    });

    test('should allow unsubscribing from move events', () => {
      const callback = jest.fn();
      const unsubscribe = chatWrapper.onMove(callback);

      unsubscribe();
      expect(chatWrapper.getMoveListenerCount()).toBe(0);
    });

    test('should support multiple move event subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      chatWrapper.onMove(callback1);
      chatWrapper.onMove(callback2);
      const unsubscribe3 = chatWrapper.onMove(callback3);

      expect(chatWrapper.getMoveListenerCount()).toBe(3);

      unsubscribe3();
      expect(chatWrapper.getMoveListenerCount()).toBe(2);
    });

    test('should allow subscribing to game state changes', () => {
      const callback = jest.fn();
      const unsubscribe = chatWrapper.onGameStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
      expect(chatWrapper.getStateListenerCount()).toBe(1);
    });

    test('should allow subscribing to engine evaluation updates', () => {
      const callback = jest.fn();
      const unsubscribe = chatWrapper.onEvaluationUpdate(callback);

      expect(typeof unsubscribe).toBe('function');
      expect(chatWrapper.getEvaluationListenerCount()).toBe(1);
    });
  });

  describe('Safe Mode Operations', () => {
    test('should operate in safe mode when chess game is not ready', () => {
      global.game = null;
      const safeChatWrapper = new ChatWrapper();

      expect(safeChatWrapper.isChessGameAvailable()).toBe(false);
      expect(safeChatWrapper.getCurrentGameState()).toBeNull();
      expect(() => safeChatWrapper.setupMoveListener()).not.toThrow();
    });

    test('should provide fallback data when engine is unavailable', () => {
      global.engine = null;
      
      const evaluation = chatWrapper.getCurrentEvaluation();
      
      expect(evaluation).toEqual({
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      });
    });

    test('should cleanup listeners on destroy', () => {
      const moveCallback = jest.fn();
      const stateCallback = jest.fn();
      
      chatWrapper.onMove(moveCallback);
      chatWrapper.onGameStateChange(stateCallback);
      
      expect(chatWrapper.getMoveListenerCount()).toBe(1);
      expect(chatWrapper.getStateListenerCount()).toBe(1);
      
      chatWrapper.destroy();
      
      expect(chatWrapper.getMoveListenerCount()).toBe(0);
      expect(chatWrapper.getStateListenerCount()).toBe(0);
    });
  });

  describe('Integration Verification', () => {
    test('should maintain chess game performance', () => {
      const originalMakeMove = jest.fn(() => true);
      global.makeMove = originalMakeMove;
      
      const startTime = Date.now();
      
      chatWrapper.setupMoveListener();
      
      // Make 100 moves to test performance impact
      for (let i = 0; i < 100; i++) {
        global.makeMove('e2', 'e4');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(originalMakeMove).toHaveBeenCalledTimes(100);
    });

    test('should not interfere with canvas rendering', () => {
      // Mock canvas globals that exist in chess-v2.js
      global.canvas = { addEventListener: jest.fn() };
      global.renderBoard = jest.fn();
      
      chatWrapper.setupMoveListener();
      
      // Verify we didn't modify canvas or rendering
      expect(global.canvas.addEventListener).not.toHaveBeenCalled();
      expect(global.renderBoard).not.toHaveBeenCalled();
    });

    test('should preserve all chess global variables', () => {
      const originalGlobals = {
        isPlayerTurn: global.isPlayerTurn,
        selectedSquare: global.selectedSquare,
        legalMoves: global.legalMoves
      };
      
      chatWrapper.setupMoveListener();
      
      expect(global.isPlayerTurn).toBe(originalGlobals.isPlayerTurn);
      expect(global.selectedSquare).toBe(originalGlobals.selectedSquare);
      expect(global.legalMoves).toBe(originalGlobals.legalMoves);
    });
  });
});