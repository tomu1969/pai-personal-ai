/**
 * Game State Capture Tests - TDD Phase 2.2
 * Tests the captureGameState() function that packages FEN, PGN, and Engine data
 */

const GameStateCapture = require('../../src/game-state-capture');

describe('Game State Capture', () => {
  let mockStockfishEngine;
  let mockChessGame;
  let gameStateCapture;

  beforeEach(() => {
    // Mock Stockfish Engine
    mockStockfishEngine = {
      currentEvaluation: {
        score: 0.3,
        bestMove: 'e2e4',
        depth: 15,
        mate: null
      },
      getStatus: jest.fn(() => ({
        ready: true,
        thinking: false,
        config: { skillLevel: 15 }
      }))
    };

    // Mock Chess Game (representing the existing chess-v2.js)
    mockChessGame = {
      getFEN: jest.fn(() => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
      getPGN: jest.fn(() => '1. e4'),
      getLastMove: jest.fn(() => 'e2e4'),
      getGameState: jest.fn(() => ({
        turn: 'b',
        inCheck: false,
        isGameOver: false,
        isCheckmate: false,
        isDraw: false
      })),
      getMoveHistory: jest.fn(() => [
        { from: 'e2', to: 'e4', piece: 'p', san: 'e4', lan: 'e2e4' }
      ])
    };

    // Create gameStateCapture instance
    gameStateCapture = new GameStateCapture();
  });

  describe('Basic Game State Capture', () => {
    test('should capture complete game state with all required fields', () => {
      const userElo = 1200;
      const personaName = 'Irina';

      const result = gameStateCapture.captureGameState(
        mockStockfishEngine, 
        mockChessGame, 
        userElo, 
        personaName
      );

      expect(result).toHaveProperty('fen');
      expect(result).toHaveProperty('pgn');
      expect(result).toHaveProperty('lastMove');
      expect(result).toHaveProperty('gameState');
      expect(result).toHaveProperty('userElo', 1200);
      expect(result).toHaveProperty('personaName', 'Irina');
      expect(result).toHaveProperty('engineEval');
      expect(result).toHaveProperty('engineStatus');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('moveCount');
      expect(result).toHaveProperty('recentMoves');
    });

    test('should validate FEN format in captured state', () => {
      const validState = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        pgn: '1. e4',
        userElo: 1200,
        personaName: 'Irina'
      };

      const invalidState = {
        fen: 'invalid-fen',
        pgn: '1. e4',
        userElo: 1200,
        personaName: 'Irina'
      };

      expect(gameStateCapture.validateGameState(validState).isValid).toBe(true);
      expect(gameStateCapture.validateGameState(invalidState).isValid).toBe(false);
    });

    test('should handle missing engine evaluation gracefully', () => {
      const engineWithoutEval = {
        currentEvaluation: null,
        getStatus: () => ({ ready: true, thinking: false })
      };

      const result = gameStateCapture.captureGameState(
        engineWithoutEval, 
        mockChessGame, 
        1500, 
        'Irina'
      );

      expect(result.engineEval).toEqual({
        score: null,
        bestMove: null,
        depth: 0,
        mate: null
      });
    });
  });

  describe('Context Payload Formatting', () => {
    test('should format payload for AI backend with chat history', () => {
      const chatHistory = [
        { sender: 'user', message: 'What should I do here?', timestamp: '2023-01-01T12:00:00Z' },
        { sender: 'assistant', message: 'Look at your king safety.', timestamp: '2023-01-01T12:01:00Z' }
      ];

      const gameState = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        pgn: '1. e4',
        lastMove: 'e2e4',
        userElo: 1400,
        personaName: 'Irina',
        engineEval: { score: 0.2, bestMove: 'e7e5' }
      };


      const userMessage = 'Is this position good for me?';
      const payload = gameStateCapture.formatContextPayload(gameState, chatHistory, userMessage);

      expect(payload).toHaveProperty('fen');
      expect(payload).toHaveProperty('pgn');
      expect(payload).toHaveProperty('chatHistory');
      expect(payload).toHaveProperty('userMessage', userMessage);
      expect(payload.chatHistory).toHaveLength(2);
      expect(payload.chatHistory[0].sender).toBe('user');
    });

    test('should limit chat history to last 4 messages', () => {
      const longChatHistory = [
        { sender: 'user', message: 'Message 1' },
        { sender: 'assistant', message: 'Response 1' },
        { sender: 'user', message: 'Message 2' },
        { sender: 'assistant', message: 'Response 2' },
        { sender: 'user', message: 'Message 3' },
        { sender: 'assistant', message: 'Response 3' },
        { sender: 'user', message: 'Message 4' },
        { sender: 'assistant', message: 'Response 4' }
      ];

      const gameState = {
        fen: 'test-fen',
        pgn: 'test-pgn',
        userElo: 1400,
        personaName: 'Irina',
        engineEval: { score: 0.2 }
      };

      const payload = gameStateCapture.formatContextPayload(gameState, longChatHistory, 'test message');

      expect(payload.chatHistory).toHaveLength(4);
      expect(payload.chatHistory[0].message).toBe('Message 3');
      expect(payload.chatHistory[3].message).toBe('Response 4');
    });

    test('should handle empty chat history', () => {
      const gameState = {
        fen: 'test-fen',
        pgn: 'test-pgn',
        userElo: 1400,
        personaName: 'Irina',
        engineEval: { score: 0.2 }
      };

      const payload = gameStateCapture.formatContextPayload(gameState, null, 'test message');

      expect(payload.chatHistory).toEqual([]);
    });
  });

  describe('Recent Move History Extraction', () => {
    test('should extract last 5 moves for context', () => {
      const fullMoveHistory = [
        { san: 'e4', lan: 'e2e4', piece: 'p' },
        { san: 'e5', lan: 'e7e5', piece: 'p' },
        { san: 'Nf3', lan: 'g1f3', piece: 'n' },
        { san: 'Nc6', lan: 'b8c6', piece: 'n' },
        { san: 'Bb5', lan: 'f1b5', piece: 'b' },
        { san: 'a6', lan: 'a7a6', piece: 'p' },
        { san: 'Ba4', lan: 'b5a4', piece: 'b' }
      ];

      const recentMoves = gameStateCapture.extractRecentHistory(fullMoveHistory);

      expect(recentMoves).toHaveLength(5);
      expect(recentMoves[0].san).toBe('Nf3');
      expect(recentMoves[4].san).toBe('Ba4');
    });

    test('should handle short move history', () => {
      const shortHistory = [
        { san: 'e4', lan: 'e2e4' },
        { san: 'e5', lan: 'e7e5' }
      ];

      const result = gameStateCapture.extractRecentHistory(shortHistory);

      expect(result).toHaveLength(2);
      expect(result).toEqual(shortHistory);
    });
  });

  describe('Error Handling', () => {
    test('should handle engine not ready state', () => {
      const notReadyEngine = {
        currentEvaluation: null,
        getStatus: () => ({ ready: false, thinking: false })
      };


      expect(() => {
        gameStateCapture.captureGameState(notReadyEngine, mockChessGame, 1500, 'Irina');
      }).toThrow('Engine not ready for state capture');
    });

    test('should handle invalid user ELO values', () => {

      expect(() => {
        gameStateCapture.captureGameState(mockStockfishEngine, mockChessGame, 'invalid', 'Irina');
      }).toThrow('Invalid ELO rating');

      expect(() => {
        gameStateCapture.captureGameState(mockStockfishEngine, mockChessGame, 500, 'Irina');
      }).toThrow('Invalid ELO rating');
    });

    test('should handle missing persona name', () => {

      expect(() => {
        gameStateCapture.captureGameState(mockStockfishEngine, mockChessGame, 1500, null);
      }).toThrow('Persona name is required');
    });
  });

  describe('Performance and Memory', () => {
    test('should complete state capture within reasonable time', () => {
      const startTime = Date.now();

      const result = gameStateCapture.captureGameState(
        mockStockfishEngine, 
        mockChessGame, 
        1500, 
        'Irina'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(result).toBeDefined();
    });

    test('should not modify original game or engine objects', () => {
      const originalFEN = mockChessGame.getFEN();
      const originalEval = { ...mockStockfishEngine.currentEvaluation };


      gameStateCapture.captureGameState(mockStockfishEngine, mockChessGame, 1500, 'Irina');

      // Original objects should be unchanged
      expect(mockChessGame.getFEN()).toBe(originalFEN);
      expect(mockStockfishEngine.currentEvaluation).toEqual(originalEval);
    });
  });
});