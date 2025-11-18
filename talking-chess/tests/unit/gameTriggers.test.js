/**
 * Game Triggers System Tests - TDD Phase 2.4
 * Tests automatic detection of game events and mentor response triggers
 */

const GameTriggers = require('../../src/game-triggers');

describe('Game Triggers System', () => {
  let gameTriggers;
  let mockStockfishEngine;
  let mockChatHistory;

  beforeEach(() => {
    gameTriggers = new GameTriggers();
    
    // Mock Stockfish Engine
    mockStockfishEngine = {
      currentEvaluation: {
        score: 0.2,
        bestMove: 'Nf3',
        depth: 15,
        mate: null
      },
      previousEvaluation: {
        score: 0.8,
        bestMove: 'e4',
        depth: 15,
        mate: null
      }
    };

    // Mock Chat History
    mockChatHistory = {
      addMessage: jest.fn(),
      getRecentHistory: jest.fn(() => []),
      getMessagesBySender: jest.fn(() => [])
    };
  });

  describe('Blunder Detection', () => {
    test('should detect significant evaluation drop (blunder)', () => {
      const gameContext = {
        fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        lastMove: 'Bc4',
        userElo: 1200
      };

      // Simulate a blunder: evaluation dropped from +0.8 to -2.0
      mockStockfishEngine.previousEvaluation = { score: 0.8, bestMove: 'Nf3' };
      mockStockfishEngine.currentEvaluation = { score: -2.0, bestMove: 'Nxe4' };

      const trigger = gameTriggers.checkBlunderTrigger(
        mockStockfishEngine.currentEvaluation,
        mockStockfishEngine.previousEvaluation,
        gameContext
      );

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('blunder');
      expect(trigger.severity).toBe('major'); // 2.8 point drop
      expect(trigger.message).toContain('significant drop');
      expect(trigger.shouldTrigger).toBe(true);
    });

    test('should not trigger on small evaluation changes', () => {
      const gameContext = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        lastMove: 'e4',
        userElo: 1500
      };

      // Small change: +0.3 to +0.1
      mockStockfishEngine.previousEvaluation = { score: 0.3, bestMove: 'e4' };
      mockStockfishEngine.currentEvaluation = { score: 0.1, bestMove: 'e5' };

      const trigger = gameTriggers.checkBlunderTrigger(
        mockStockfishEngine.currentEvaluation,
        mockStockfishEngine.previousEvaluation,
        gameContext
      );

      expect(trigger).toBeNull();
    });

    test('should adjust blunder threshold based on user ELO', () => {
      const beginnerContext = { userElo: 800 };
      const expertContext = { userElo: 2200 };

      // 1.5 point drop
      const currentEval = { score: -0.5 };
      const previousEval = { score: 1.0 };

      const beginnerTrigger = gameTriggers.checkBlunderTrigger(currentEval, previousEval, beginnerContext);
      const expertTrigger = gameTriggers.checkBlunderTrigger(currentEval, previousEval, expertContext);

      // Beginners need larger drops to trigger (more forgiving)
      expect(beginnerTrigger).toBeNull(); // 1.5 not enough for beginner
      expect(expertTrigger).toBeDefined(); // 1.5 is enough for expert
      expect(expertTrigger.type).toBe('blunder');
    });

    test('should categorize blunder severity correctly', () => {
      const context = { userElo: 1500 };

      // Minor blunder (1.7 point drop - above 1.5 threshold but below 2.0)
      const minorTrigger = gameTriggers.checkBlunderTrigger(
        { score: 0.3 }, { score: 2.0 }, context
      );

      // Major blunder (3.0 point drop)
      const majorTrigger = gameTriggers.checkBlunderTrigger(
        { score: -1.0 }, { score: 2.0 }, context
      );

      expect(minorTrigger.severity).toBe('minor');
      expect(majorTrigger.severity).toBe('major');
    });
  });

  describe('Missed Opportunity Detection', () => {
    test('should detect missed forced mate', () => {
      const gameContext = {
        fen: 'r1bqk2r/pppp1Qpp/2n2n2/2b1p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
        lastMove: 'Qf7+',
        userElo: 1400
      };

      // Engine found mate in 2, but player made different move
      mockStockfishEngine.currentEvaluation = {
        score: 2.5,
        bestMove: 'Qxe8#',
        mate: 2
      };

      const playerMove = 'Nf3'; // Player didn't see the mate

      const trigger = gameTriggers.checkMissedOpportunity(
        mockStockfishEngine.currentEvaluation,
        playerMove,
        gameContext
      );

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('missed_mate');
      expect(trigger.opportunityType).toBe('forced_mate');
      expect(trigger.mateInMoves).toBe(2);
      expect(trigger.shouldTrigger).toBe(true);
    });

    test('should detect missed tactical opportunities', () => {
      const gameContext = {
        fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 0 5',
        lastMove: 'Nf3',
        userElo: 1200
      };

      // Engine found a strong tactical shot (+2.5), player played normal move
      mockStockfishEngine.currentEvaluation = {
        score: 2.5,
        bestMove: 'Nxd4', // Tactical shot
        mate: null
      };

      const playerMove = 'Be7'; // Safe but misses tactic
      const previousScore = 0.2;

      const trigger = gameTriggers.checkMissedOpportunity(
        mockStockfishEngine.currentEvaluation,
        playerMove,
        gameContext,
        previousScore
      );

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('missed_tactic');
      expect(trigger.opportunityType).toBe('tactical_shot');
      expect(trigger.evaluationGain).toBeCloseTo(2.3); // 2.5 - 0.2
    });

    test('should not trigger for normal positional moves', () => {
      const gameContext = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        lastMove: 'e4',
        userElo: 1500
      };

      // Normal opening position, small advantage
      mockStockfishEngine.currentEvaluation = {
        score: 0.3,
        bestMove: 'e5',
        mate: null
      };

      const playerMove = 'Nf6'; // Also reasonable
      const previousScore = 0.0;

      const trigger = gameTriggers.checkMissedOpportunity(
        mockStockfishEngine.currentEvaluation,
        playerMove,
        gameContext,
        previousScore
      );

      expect(trigger).toBeNull();
    });
  });

  describe('Opening Theory Detection', () => {
    test('should recognize common openings and trigger commentary', () => {
      const gameContext = {
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        lastMove: 'Bb5',
        userElo: 1300
      };

      const trigger = gameTriggers.checkOpeningTrigger(gameContext);

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('opening_theory');
      expect(trigger.openingName).toBe('Ruy Lopez');
      expect(trigger.openingPhase).toBe('opening');
      expect(trigger.shouldTrigger).toBe(true);
      expect(trigger.commentary).toContain('Spanish Opening');
    });

    test('should provide opening principles for unknown openings', () => {
      const gameContext = {
        pgn: '1. h3 h6 2. g3 g6',
        fen: 'rnbqkbnr/1ppppp1p/6p1/8/8/6PP/PPPPPPP1/RNBQKBNR w KQkq - 0 3',
        lastMove: 'g6',
        userElo: 900
      };

      const trigger = gameTriggers.checkOpeningTrigger(gameContext);

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('opening_principles');
      expect(trigger.openingName).toBe('Unusual Opening');
      expect(trigger.advice).toContain('development');
      expect(trigger.advice).toContain('center control');
    });

    test('should not trigger in middlegame/endgame', () => {
      const gameContext = {
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4',
        fen: 'r1bq1rk1/2p1bppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1 b - - 0 10',
        lastMove: 'd4',
        userElo: 1500
      };

      const trigger = gameTriggers.checkOpeningTrigger(gameContext);

      expect(trigger).toBeNull(); // Too many moves, past opening phase
    });
  });

  describe('Position Assessment Triggers', () => {
    test('should trigger on dangerous king positions', () => {
      const gameContext = {
        fen: 'r2qk2r/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/3P1N2/PPP2PPP/RN1QK2R w KQkq - 4 8',
        lastMove: 'Bg4',
        userElo: 1100
      };

      // Exposed king with pieces aimed at it
      const trigger = gameTriggers.checkPositionTrigger(gameContext);

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('king_safety');
      expect(trigger.concern).toBe('exposed_king');
      expect(trigger.advice).toContain('king safety');
      expect(trigger.shouldTrigger).toBe(true);
    });

    test('should trigger on hanging pieces', () => {
      const gameContext = {
        fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5',
        lastMove: 'dxc4', // Captures pawn, but knight hangs
        userElo: 800
      };

      const trigger = gameTriggers.checkPositionTrigger(gameContext);

      expect(trigger).toBeDefined();
      expect(trigger.type).toBe('hanging_pieces');
      expect(trigger.pieceType).toContain('knight');
      expect(trigger.advice).toContain('undefended');
    });

    test('should not trigger for normal positions', () => {
      const gameContext = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        lastMove: 'e4',
        userElo: 1500
      };

      const trigger = gameTriggers.checkPositionTrigger(gameContext);

      expect(trigger).toBeNull();
    });
  });

  describe('Trigger Processing and Response Generation', () => {
    test('should process multiple triggers and prioritize by importance', () => {
      const triggers = [
        { type: 'opening_theory', priority: 2, shouldTrigger: true },
        { type: 'blunder', severity: 'major', priority: 1, shouldTrigger: true },
        { type: 'king_safety', priority: 3, shouldTrigger: true }
      ];

      const prioritizedTriggers = gameTriggers.prioritizeTriggers(triggers);

      expect(prioritizedTriggers[0].type).toBe('blunder'); // Highest priority
      expect(prioritizedTriggers[1].type).toBe('opening_theory');
      expect(prioritizedTriggers[2].type).toBe('king_safety');
    });

    test('should generate appropriate mentor response for triggers', () => {
      const blunderTrigger = {
        type: 'blunder',
        severity: 'major',
        shouldTrigger: true,
        userElo: 1200
      };

      const response = gameTriggers.generateMentorResponse(blunderTrigger);

      expect(response).toBeDefined();
      expect(response.shouldRespond).toBe(true);
      expect(response.message).toContain('Hmm');
      expect(response.tone).toBe('stern_but_encouraging');
      expect(response.questionType).toBe('socratic'); // Should ask questions, not give answers
    });

    test('should avoid spam by checking recent responses', () => {
      // Mock recent blunder warning
      mockChatHistory.getRecentHistory.mockReturnValue([
        { sender: 'assistant', message: 'Be careful with your pieces!', timestamp: new Date().toISOString() }
      ]);

      const blunderTrigger = {
        type: 'blunder',
        severity: 'minor',
        shouldTrigger: true,
        userElo: 1500
      };

      const response = gameTriggers.generateMentorResponse(blunderTrigger, mockChatHistory);

      expect(response.shouldRespond).toBe(false); // Should not spam
      expect(response.reason).toBe('recent_similar_response');
    });

    test('should adapt response complexity to user ELO', () => {
      const trigger = {
        type: 'missed_tactic',
        shouldTrigger: true
      };

      const beginnerResponse = gameTriggers.generateMentorResponse({
        ...trigger,
        userElo: 800
      });

      const expertResponse = gameTriggers.generateMentorResponse({
        ...trigger,
        userElo: 2000
      });

      expect(beginnerResponse.complexity).toBe('basic');
      expect(beginnerResponse.message).toContain('Look for');
      
      expect(expertResponse.complexity).toBe('advanced');
      expect(expertResponse.message).toContain('Consider');
    });
  });

  describe('Integration with Game State', () => {
    test('should analyze complete game context and return appropriate triggers', () => {
      const gameState = {
        fen: 'r1bqk2r/pppp1Qpp/2n2n2/2b1p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
        pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7+',
        lastMove: 'Qxf7+',
        userElo: 1000,
        engineEval: { score: -5.0, bestMove: 'Kxf7', mate: null },
        previousEval: { score: 0.2 }
      };

      const allTriggers = gameTriggers.analyzeGameState(gameState);

      expect(allTriggers).toBeInstanceOf(Array);
      expect(allTriggers.length).toBeGreaterThan(0);
      
      // Should detect the blunder (Scholar's mate failed)
      const blunderTrigger = allTriggers.find(t => t.type === 'blunder');
      expect(blunderTrigger).toBeDefined();
      expect(blunderTrigger.severity).toBe('major');
    });

    test('should return empty array for normal positions', () => {
      const normalGameState = {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        pgn: '1. e4 e5',
        lastMove: 'e5',
        userElo: 1500,
        engineEval: { score: 0.1, bestMove: 'Nf3' },
        previousEval: { score: 0.2 }
      };

      const triggers = gameTriggers.analyzeGameState(normalGameState);
      
      expect(triggers).toBeInstanceOf(Array);
      expect(triggers).toHaveLength(0); // No triggers for normal play
    });
  });

  describe('Configuration and Customization', () => {
    test('should allow configuration of trigger thresholds', () => {
      const customConfig = {
        blunderThresholds: {
          beginner: 3.0,   // More forgiving
          intermediate: 1.5,
          advanced: 1.0    // Less forgiving
        },
        responseFrequency: 'low' // Less chatty
      };

      gameTriggers.configure(customConfig);

      const config = gameTriggers.getConfig();
      expect(config.blunderThresholds.beginner).toBe(3.0);
      expect(config.responseFrequency).toBe('low');
    });

    test('should enable/disable specific trigger types', () => {
      gameTriggers.configure({
        enabledTriggers: ['blunder', 'missed_mate'], // Disable opening theory
        disabledTriggers: ['opening_theory', 'king_safety']
      });

      const config = gameTriggers.getConfig();
      expect(config.enabledTriggers).toContain('blunder');
      expect(config.disabledTriggers).toContain('opening_theory');
    });
  });
});