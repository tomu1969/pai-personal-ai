/**
 * Context Builder Tests - TDD Phase 1.2
 * Tests game context formatting and validation
 */

describe('Context Builder', () => {
  let contextBuilder;

  beforeEach(() => {
    // Clear require cache for fresh module
    delete require.cache[require.resolve('../../server/modules/contextBuilder')];
    contextBuilder = require('../../server/modules/contextBuilder');
  });

  describe('FEN Validation', () => {
    test('should validate correct starting FEN', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(contextBuilder.validateFEN(startingFen)).toBe(true);
    });

    test('should reject invalid FEN strings', () => {
      const invalidFens = [
        'invalid-fen',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', // Missing parts
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0', // Missing move number
        ''
      ];

      invalidFens.forEach(fen => {
        expect(contextBuilder.validateFEN(fen)).toBe(false);
      });
    });

    test('should handle FEN with valid pieces and positions', () => {
      const midGameFen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3';
      expect(contextBuilder.validateFEN(midGameFen)).toBe(true);
    });
  });

  describe('Game Context Formatting', () => {
    test('should format complete game context object', () => {
      const input = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        pgn: '1. e4',
        lastMove: 'e2e4',
        userElo: 1200,
        personaName: 'Irina',
        engineEval: {
          score: -0.2,
          bestMove: 'e7e5'
        },
        chatHistory: [
          { sender: 'user', message: 'Good morning!' },
          { sender: 'ai', message: 'Good morning! Ready for chess?' }
        ],
        userMessage: 'What should I focus on?'
      };

      const context = contextBuilder.formatGameContext(input);

      expect(context).toHaveProperty('fen', input.fen);
      expect(context).toHaveProperty('pgn', input.pgn);
      expect(context).toHaveProperty('lastMove', input.lastMove);
      expect(context).toHaveProperty('userElo', input.userElo);
      expect(context).toHaveProperty('personaName', input.personaName);
      expect(context).toHaveProperty('engineEval');
      expect(context).toHaveProperty('chatHistory');
      expect(context).toHaveProperty('userMessage', input.userMessage);
    });

    test('should handle minimal context', () => {
      const input = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        userMessage: 'Help!'
      };

      const context = contextBuilder.formatGameContext(input);

      expect(context.fen).toBe(input.fen);
      expect(context.userMessage).toBe('Help!');
      expect(context.userElo).toBe(1500); // Default ELO
      expect(context.personaName).toBe('Irina'); // Default persona
    });

    test('should validate required fields', () => {
      expect(() => {
        contextBuilder.formatGameContext({});
      }).toThrow('FEN is required');

      expect(() => {
        contextBuilder.formatGameContext({ fen: 'invalid' });
      }).toThrow('Invalid FEN format');
    });
  });

  describe('Prompt Context Building', () => {
    test('should build prompt context for AI', () => {
      const gameContext = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        pgn: '1. e4',
        lastMove: 'e2e4',
        userElo: 1400,
        personaName: 'Irina',
        engineEval: {
          score: -0.2,
          bestMove: 'e7e5'
        },
        userMessage: 'Is this a good opening move?'
      };

      const promptContext = contextBuilder.buildPromptContext(gameContext);

      expect(promptContext).toHaveProperty('systemPrompt');
      expect(promptContext).toHaveProperty('userMessage', 'Is this a good opening move?');
      expect(promptContext.systemPrompt).toContain('Irina');
      expect(promptContext.systemPrompt).toContain('1400');
      expect(promptContext.systemPrompt).toContain('-0.2');
      expect(promptContext.systemPrompt).toContain('e7e5');
    });

    test('should adjust advice complexity based on ELO', () => {
      const lowEloContext = { userElo: 800, personaName: 'Irina' };
      const highEloContext = { userElo: 2200, personaName: 'Irina' };

      const lowEloPrompt = contextBuilder.buildPromptContext(lowEloContext);
      const highEloPrompt = contextBuilder.buildPromptContext(highEloContext);

      expect(lowEloPrompt.systemPrompt).toContain('basic safety');
      expect(highEloPrompt.systemPrompt).toContain('prophylaxis');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty chat history', () => {
      const context = contextBuilder.formatGameContext({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        chatHistory: []
      });

      expect(context.chatHistory).toEqual([]);
    });

    test('should handle missing engine evaluation', () => {
      const context = contextBuilder.formatGameContext({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      });

      expect(context.engineEval).toEqual({
        score: 0.0,
        bestMove: null
      });
    });

    test('should truncate long chat history', () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        sender: i % 2 === 0 ? 'user' : 'ai',
        message: `Message ${i + 1}`
      }));

      const context = contextBuilder.formatGameContext({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        chatHistory: longHistory
      });

      expect(context.chatHistory).toHaveLength(10); // Max history
      expect(context.chatHistory[0].message).toBe('Message 6'); // Should keep last 10
    });
  });
});