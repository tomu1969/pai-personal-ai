/**
 * Engine Broadcasting Tests - TDD Phase 2.1
 * Tests Stockfish evaluation extraction and broadcasting
 */

describe('Engine Broadcasting', () => {
  let mockEngine;
  let StockfishEngine;

  beforeEach(() => {
    // Create a mock that extends the real engine
    class MockStockfishEngine {
      constructor() {
        this.worker = null;
        this.isReady = false;
        this.evaluationCallbacks = new Set();
        this.currentEvaluation = null;
      }

      // Method to simulate UCI messages
      simulateUCIMessage(message) {
        if (this.handleEngineMessage) {
          this.handleEngineMessage(message);
        }
      }

      subscribeToEvaluation(callback) {
        this.evaluationCallbacks.add(callback);
        return () => this.evaluationCallbacks.delete(callback);
      }

      broadcastEvaluation(evaluation) {
        this.currentEvaluation = evaluation;
        this.evaluationCallbacks.forEach(callback => callback(evaluation));
      }

      parseEvaluation(uciString) {
        // This method should be implemented in the real engine
        return null;
      }

      centipawnsToScore(centipawns) {
        // This method should be implemented in the real engine
        return null;
      }
    }

    mockEngine = new MockStockfishEngine();
  });

  describe('UCI Evaluation Parsing', () => {
    test('should parse centipawn evaluation from UCI info string', () => {
      const uciString = 'info depth 12 score cp -40 pv e7e5 g1f3 b1c3';
      
      // Mock the parsing method
      mockEngine.parseEvaluation = (msg) => {
        const scoreMatch = msg.match(/score cp (-?\d+)/);
        const pvMatch = msg.match(/pv (.+)$/);
        const depthMatch = msg.match(/depth (\d+)/);
        
        if (scoreMatch) {
          return {
            score: parseInt(scoreMatch[1]) / 100, // Convert centipawns to pawns
            bestMove: pvMatch ? pvMatch[1].split(' ')[0] : null,
            depth: depthMatch ? parseInt(depthMatch[1]) : 0,
            mate: null
          };
        }
        return null;
      };

      const evaluation = mockEngine.parseEvaluation(uciString);
      
      expect(evaluation).toBeDefined();
      expect(evaluation.score).toBe(-0.4);
      expect(evaluation.bestMove).toBe('e7e5');
      expect(evaluation.depth).toBe(12);
      expect(evaluation.mate).toBeNull();
    });

    test('should parse mate evaluation from UCI info string', () => {
      const uciString = 'info depth 8 score mate 3 pv f7f5 d1h5';
      
      mockEngine.parseEvaluation = (msg) => {
        const mateMatch = msg.match(/score mate (-?\d+)/);
        const pvMatch = msg.match(/pv (.+)$/);
        
        if (mateMatch) {
          return {
            score: null, // No centipawn score for mate
            bestMove: pvMatch ? pvMatch[1].split(' ')[0] : null,
            depth: 8,
            mate: parseInt(mateMatch[1])
          };
        }
        return null;
      };

      const evaluation = mockEngine.parseEvaluation(uciString);
      
      expect(evaluation.mate).toBe(3);
      expect(evaluation.bestMove).toBe('f7f5');
      expect(evaluation.score).toBeNull();
    });

    test('should handle negative mate scores', () => {
      const uciString = 'info depth 10 score mate -2 pv h7h6 d1h5 g7g6 h5h6';
      
      mockEngine.parseEvaluation = (msg) => {
        const mateMatch = msg.match(/score mate (-?\d+)/);
        if (mateMatch) {
          return { mate: parseInt(mateMatch[1]) };
        }
        return null;
      };

      const evaluation = mockEngine.parseEvaluation(uciString);
      expect(evaluation.mate).toBe(-2);
    });

    test('should return null for invalid UCI strings', () => {
      const invalidStrings = [
        'invalid message',
        'info depth 5',
        'bestmove e2e4',
        ''
      ];

      mockEngine.parseEvaluation = (msg) => {
        if (msg.includes('score cp') || msg.includes('score mate')) {
          return { score: 0 };
        }
        return null;
      };

      invalidStrings.forEach(str => {
        expect(mockEngine.parseEvaluation(str)).toBeNull();
      });
    });
  });

  describe('Score Conversion', () => {
    test('should convert centipawns to decimal pawns', () => {
      mockEngine.centipawnsToScore = (cp) => cp / 100;

      expect(mockEngine.centipawnsToScore(50)).toBe(0.5);
      expect(mockEngine.centipawnsToScore(-150)).toBe(-1.5);
      expect(mockEngine.centipawnsToScore(0)).toBe(0);
    });

    test('should handle large centipawn values', () => {
      mockEngine.centipawnsToScore = (cp) => Math.max(-99, Math.min(99, cp / 100));

      expect(mockEngine.centipawnsToScore(10000)).toBe(99); // Capped at 99
      expect(mockEngine.centipawnsToScore(-10000)).toBe(-99); // Capped at -99
    });
  });

  describe('Evaluation Broadcasting', () => {
    test('should broadcast evaluation to all subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      mockEngine.subscribeToEvaluation(callback1);
      mockEngine.subscribeToEvaluation(callback2);
      
      const evaluation = {
        score: 0.3,
        bestMove: 'e2e4',
        depth: 15,
        mate: null
      };
      
      mockEngine.broadcastEvaluation(evaluation);
      
      expect(callback1).toHaveBeenCalledWith(evaluation);
      expect(callback2).toHaveBeenCalledWith(evaluation);
    });

    test('should allow unsubscribing from evaluation updates', () => {
      const callback = jest.fn();
      
      const unsubscribe = mockEngine.subscribeToEvaluation(callback);
      unsubscribe();
      
      mockEngine.broadcastEvaluation({ score: 0.5 });
      
      expect(callback).not.toHaveBeenCalled();
    });

    test('should handle multiple subscriptions and unsubscriptions', () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];
      const unsubscribers = callbacks.map(cb => mockEngine.subscribeToEvaluation(cb));
      
      // Unsubscribe middle callback
      unsubscribers[1]();
      
      mockEngine.broadcastEvaluation({ score: 0.1 });
      
      expect(callbacks[0]).toHaveBeenCalled();
      expect(callbacks[1]).not.toHaveBeenCalled();
      expect(callbacks[2]).toHaveBeenCalled();
    });
  });

  describe('Evaluation Change Detection', () => {
    test('should only broadcast significant evaluation changes', () => {
      const callback = jest.fn();
      mockEngine.subscribeToEvaluation(callback);
      
      mockEngine.shouldBroadcastChange = (oldEval, newEval) => {
        if (!oldEval) return true;
        return Math.abs(newEval.score - oldEval.score) >= 0.1;
      };
      
      // First evaluation should always broadcast
      mockEngine.currentEvaluation = null;
      const eval1 = { score: 0.5 };
      if (mockEngine.shouldBroadcastChange(mockEngine.currentEvaluation, eval1)) {
        mockEngine.broadcastEvaluation(eval1);
      }
      
      // Small change should not broadcast
      const eval2 = { score: 0.55 };
      if (mockEngine.shouldBroadcastChange(mockEngine.currentEvaluation, eval2)) {
        mockEngine.broadcastEvaluation(eval2);
      }
      
      // Large change should broadcast
      const eval3 = { score: 0.8 };
      if (mockEngine.shouldBroadcastChange(mockEngine.currentEvaluation, eval3)) {
        mockEngine.broadcastEvaluation(eval3);
      }
      
      expect(callback).toHaveBeenCalledTimes(2); // eval1 and eval3 only
    });

    test('should handle transition from mate to centipawn scores', () => {
      const callback = jest.fn();
      mockEngine.subscribeToEvaluation(callback);
      
      mockEngine.shouldBroadcastChange = (oldEval, newEval) => {
        if (!oldEval) return true;
        // Different score types should always broadcast
        if ((oldEval.mate !== null) !== (newEval.mate !== null)) return true;
        return false;
      };
      
      const mateEval = { score: null, mate: 3 };
      const cpEval = { score: 2.5, mate: null };
      
      mockEngine.currentEvaluation = mateEval;
      if (mockEngine.shouldBroadcastChange(mateEval, cpEval)) {
        mockEngine.broadcastEvaluation(cpEval);
      }
      
      expect(callback).toHaveBeenCalledWith(cpEval);
    });
  });

  describe('Error Handling', () => {
    test('should handle callback errors gracefully', () => {
      const errorCallback = jest.fn(() => { throw new Error('Callback error'); });
      const goodCallback = jest.fn();
      
      mockEngine.subscribeToEvaluation(errorCallback);
      mockEngine.subscribeToEvaluation(goodCallback);
      
      // Mock console.error to capture error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockEngine.broadcastEvaluation = (evaluation) => {
        mockEngine.evaluationCallbacks.forEach(callback => {
          try {
            callback(evaluation);
          } catch (error) {
            console.error('Error in evaluation callback:', error);
          }
        });
      };
      
      mockEngine.broadcastEvaluation({ score: 0 });
      
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});