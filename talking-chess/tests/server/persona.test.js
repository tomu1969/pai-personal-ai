/**
 * Persona System Tests - TDD Phase 1.3
 * Tests AI persona configuration and Socratic method responses
 */

describe('Persona System', () => {
  let personaInjector;
  let irinaPersona;

  beforeEach(() => {
    // Clear require cache for fresh modules
    delete require.cache[require.resolve('../../server/modules/personaInjector')];
    delete require.cache[require.resolve('../../server/personas/irina')];
    
    personaInjector = require('../../server/modules/personaInjector');
    irinaPersona = require('../../server/personas/irina');
  });

  describe('Irina Persona Configuration', () => {
    test('should have required persona properties', () => {
      expect(irinaPersona).toHaveProperty('name', 'Irina');
      expect(irinaPersona).toHaveProperty('origin');
      expect(irinaPersona).toHaveProperty('tone');
      expect(irinaPersona).toHaveProperty('philosophy');
    });

    test('should have correct persona characteristics', () => {
      expect(irinaPersona.name).toBe('Irina');
      expect(irinaPersona.origin).toContain('Russian Chess School');
      expect(irinaPersona.tone).toContain('Direct');
      expect(irinaPersona.tone).toContain('intellectual');
    });

    test('should have ELO-based instruction templates', () => {
      expect(irinaPersona).toHaveProperty('instructions');
      expect(irinaPersona.instructions).toHaveProperty('lowElo');
      expect(irinaPersona.instructions).toHaveProperty('midElo');
      expect(irinaPersona.instructions).toHaveProperty('highElo');
    });

    test('should have typing indicator template', () => {
      expect(irinaPersona).toHaveProperty('typingIndicator');
      expect(irinaPersona.typingIndicator).toContain('{personaName}');
    });
  });

  describe('Persona Injection', () => {
    test('should inject persona into system prompt', () => {
      const context = {
        userElo: 1500,
        personaName: 'Irina',
        engineEval: { score: 0.2, bestMove: 'Nf3' }
      };

      const prompt = personaInjector.injectPersona(context);

      expect(prompt).toContain('Irina');
      expect(prompt).toContain('1500');
      expect(prompt).toContain('Socratic method');
      expect(prompt).toContain('never explicitly state the best move');
    });

    test('should select appropriate instructions by ELO', () => {
      const lowEloContext = { userElo: 900, personaName: 'Irina' };
      const midEloContext = { userElo: 1500, personaName: 'Irina' };
      const highEloContext = { userElo: 2100, personaName: 'Irina' };

      const lowPrompt = personaInjector.injectPersona(lowEloContext);
      const midPrompt = personaInjector.injectPersona(midEloContext);
      const highPrompt = personaInjector.injectPersona(highEloContext);

      expect(lowPrompt).toContain('hanging your pieces');
      expect(midPrompt).toContain('positional concepts');
      expect(highPrompt).toContain('prophylaxis');
    });

    test('should include engine evaluation in prompt', () => {
      const context = {
        userElo: 1500,
        personaName: 'Irina',
        engineEval: {
          score: -0.7,
          bestMove: 'Qh5+'
        }
      };

      const prompt = personaInjector.injectPersona(context);

      expect(prompt).toContain('-0.7');
      expect(prompt).toContain('Qh5+');
    });

    test('should handle missing persona gracefully', () => {
      const context = {
        userElo: 1500,
        personaName: 'NonExistent'
      };

      expect(() => {
        personaInjector.injectPersona(context);
      }).toThrow('Persona NonExistent not found');
    });
  });

  describe('Socratic Method Validation', () => {
    test('should validate response follows Socratic method', () => {
      const goodResponses = [
        'Have you considered your king safety?',
        'What do you notice about your opponent\'s last move?',
        'Which piece seems out of place?'
      ];

      const badResponses = [
        'Move your queen to h5.',
        'Play Nf3 immediately.',
        'The best move is castling.'
      ];

      goodResponses.forEach(response => {
        expect(personaInjector.validateSocraticResponse(response)).toBe(true);
      });

      badResponses.forEach(response => {
        expect(personaInjector.validateSocraticResponse(response)).toBe(false);
      });
    });

    test('should detect explicit move suggestions', () => {
      const explicitMoves = [
        'Play e4',
        'Move the knight to f3',
        'Castle kingside now',
        'Take with the queen'
      ];

      explicitMoves.forEach(move => {
        expect(personaInjector.containsExplicitMove(move)).toBe(true);
      });
    });

    test('should allow educational discussions about moves', () => {
      const educationalMoves = [
        'The knight on f3 is well-placed because...',
        'Castling would be natural here, but consider...',
        'Your queen on d1 has potential, but what if...'
      ];

      educationalMoves.forEach(discussion => {
        expect(personaInjector.containsExplicitMove(discussion)).toBe(false);
      });
    });
  });

  describe('Response Quality', () => {
    test('should ensure responses have educational value', () => {
      const response = 'Think about your weakest piece. How can you improve its position?';
      
      const quality = personaInjector.assessResponseQuality(response);
      
      expect(quality.isEducational).toBe(true);
      expect(quality.isSocratic).toBe(true);
      expect(quality.hasExplicitMove).toBe(false);
      expect(quality.score).toBeGreaterThan(0.7);
    });

    test('should rate poor responses lower', () => {
      const poorResponse = 'Just move.';
      
      const quality = personaInjector.assessResponseQuality(poorResponse);
      
      expect(quality.isEducational).toBe(false);
      expect(quality.score).toBeLessThan(0.3);
    });

    test('should identify thought-provoking questions', () => {
      const questions = [
        'What is your opponent threatening?',
        'How would you defend this position?',
        'Which piece needs improvement most?'
      ];

      questions.forEach(question => {
        const quality = personaInjector.assessResponseQuality(question);
        expect(quality.isSocratic).toBe(true);
      });
    });
  });
});