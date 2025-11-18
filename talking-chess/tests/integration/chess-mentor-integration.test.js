/**
 * Chess Mentor Integration Tests
 * Tests the complete integration of all modules working together
 */

const ChessMentorIntegration = require('../../src/chess-mentor-integration');

// Mock dependencies
jest.mock('../../src/chat-wrapper');
jest.mock('../../src/chat-container');
jest.mock('../../src/game-state-capture');
jest.mock('../../src/game-triggers');
jest.mock('../../src/chat-history');

const ChatWrapper = require('../../src/chat-wrapper');
const ChatContainer = require('../../src/chat-container');
const GameStateCapture = require('../../src/game-state-capture');
const GameTriggers = require('../../src/game-triggers');
const ChatHistory = require('../../src/chat-history');

describe('Chess Mentor Integration', () => {
  let mentor;
  let mockWrapper;
  let mockContainer;
  let mockStateCapture;
  let mockTriggers;
  let mockHistory;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up mock instances
    mockWrapper = {
      setupMoveListener: jest.fn(),
      onMove: jest.fn(),
      destroy: jest.fn(),
      getStats: jest.fn(() => ({ initialized: true }))
    };

    mockContainer = {
      createChatContainer: jest.fn(() => 'chat-container-123'),
      createChatHeader: jest.fn(),
      createMessageStream: jest.fn(),
      createMessageInput: jest.fn(),
      updateConnectionStatus: jest.fn(),
      addMessage: jest.fn(),
      showTypingIndicator: jest.fn(),
      hideTypingIndicator: jest.fn(),
      onMessageSend: jest.fn(),
      onDrawerToggle: jest.fn(),
      destroy: jest.fn(),
      getStats: jest.fn(() => ({ messageCount: 0 }))
    };

    mockStateCapture = {
      captureGameState: jest.fn(),
      formatContextPayload: jest.fn()
    };

    mockTriggers = {
      analyzeGameState: jest.fn(() => []),
      prioritizeTriggers: jest.fn(() => []),
      generateMentorResponse: jest.fn()
    };

    mockHistory = {
      addMessage: jest.fn(() => 'msg_123'),
      setMaxMessages: jest.fn(),
      getMemoryStats: jest.fn(() => ({ totalMessages: 0 }))
    };

    // Mock constructors
    ChatWrapper.mockImplementation(() => mockWrapper);
    ChatContainer.mockImplementation(() => mockContainer);
    GameStateCapture.mockImplementation(() => mockStateCapture);
    GameTriggers.mockImplementation(() => mockTriggers);
    ChatHistory.mockImplementation(() => mockHistory);

    mentor = new ChessMentorIntegration();
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const result = await mentor.initialize();

      expect(result).toBe(true);
      expect(mentor.isInitialized).toBe(true);
      expect(mockHistory.setMaxMessages).toHaveBeenCalledWith(50);
    });

    test('should initialize with custom config', async () => {
      const config = {
        personaName: 'Kasparov',
        userElo: 2000,
        maxChatHistory: 100
      };

      const result = await mentor.initialize(config);

      expect(result).toBe(true);
      expect(mentor.config.personaName).toBe('Kasparov');
      expect(mentor.config.userElo).toBe(2000);
      expect(mockHistory.setMaxMessages).toHaveBeenCalledWith(100);
    });

    test('should handle initialization errors', async () => {
      ChatWrapper.mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = await mentor.initialize();

      expect(result).toBe(false);
      expect(mentor.isInitialized).toBe(false);
    });
  });

  describe('Connection to Chess Game', () => {
    beforeEach(async () => {
      await mentor.initialize();
    });

    test('should connect successfully with default container', () => {
      const result = mentor.connect();

      expect(result).toBe(true);
      expect(mentor.isConnected).toBe(true);
      expect(mockContainer.createChatContainer).toHaveBeenCalledWith('game-container');
      expect(mockWrapper.setupMoveListener).toHaveBeenCalled();
    });

    test('should connect with custom container', () => {
      const result = mentor.connect('custom-container');

      expect(result).toBe(true);
      expect(mockContainer.createChatContainer).toHaveBeenCalledWith('custom-container');
    });

    test('should fail to connect without initialization', () => {
      const uninitializedMentor = new ChessMentorIntegration();

      expect(() => uninitializedMentor.connect()).toThrow();
    });

    test('should handle connection errors', () => {
      mockContainer.createChatContainer.mockReturnValue(null);

      const result = mentor.connect();

      expect(result).toBe(false);
      expect(mentor.isConnected).toBe(false);
    });
  });

  describe('Event Handling Setup', () => {
    beforeEach(async () => {
      await mentor.initialize();
      mentor.connect();
    });

    test('should set up move event handler', () => {
      expect(mockWrapper.onMove).toHaveBeenCalled();

      // Get the move handler function
      const moveHandler = mockWrapper.onMove.mock.calls[0][0];
      expect(typeof moveHandler).toBe('function');
    });

    test('should set up chat message handler', () => {
      expect(mockContainer.onMessageSend).toHaveBeenCalled();

      // Get the message handler function
      const messageHandler = mockContainer.onMessageSend.mock.calls[0][0];
      expect(typeof messageHandler).toBe('function');
    });

    test('should set up drawer toggle handler', () => {
      expect(mockContainer.onDrawerToggle).toHaveBeenCalled();
    });
  });

  describe('Move Processing', () => {
    beforeEach(async () => {
      await mentor.initialize();
      mentor.connect();
    });

    test('should process moves without triggers', () => {
      const moveData = {
        from: 'e2',
        to: 'e4',
        gameState: { fen: 'test-fen' },
        evaluation: { score: 0.2 }
      };

      mockTriggers.analyzeGameState.mockReturnValue([]);

      // Get and call the move handler
      const moveHandler = mockWrapper.onMove.mock.calls[0][0];
      moveHandler(moveData);

      expect(mockTriggers.analyzeGameState).toHaveBeenCalled();
    });

    test('should generate mentor response for blunder', (done) => {
      const moveData = {
        from: 'e2',
        to: 'e4',
        gameState: { fen: 'test-fen' },
        evaluation: { score: -2.0 }
      };

      const blunderTrigger = {
        type: 'blunder',
        severity: 'major',
        shouldTrigger: true,
        priority: 1
      };

      const mentorResponse = {
        shouldRespond: true,
        message: 'That was a serious mistake!'
      };

      mockTriggers.analyzeGameState.mockReturnValue([blunderTrigger]);
      mockTriggers.prioritizeTriggers.mockReturnValue([blunderTrigger]);
      mockTriggers.generateMentorResponse.mockReturnValue(mentorResponse);

      // Get and call the move handler
      const moveHandler = mockWrapper.onMove.mock.calls[0][0];
      moveHandler(moveData);

      // Check that typing indicator is shown
      setTimeout(() => {
        expect(mockContainer.showTypingIndicator).toHaveBeenCalledWith('Irina', 2000);
        done();
      }, 1100);
    });

    test('should respect rate limiting', () => {
      const moveData = {
        from: 'e2',
        to: 'e4',
        gameState: { fen: 'test-fen' },
        evaluation: { score: 0.2 }
      };

      mentor.lastResponseTime = Date.now(); // Set recent response

      // Get and call the move handler
      const moveHandler = mockWrapper.onMove.mock.calls[0][0];
      moveHandler(moveData);

      // Should not analyze triggers due to rate limiting
      expect(mockTriggers.analyzeGameState).not.toHaveBeenCalled();
    });
  });

  describe('User Message Handling', () => {
    beforeEach(async () => {
      await mentor.initialize();
      mentor.connect();
    });

    test('should process user messages', () => {
      mentor.sendUserMessage('What do you think of this move?');

      expect(mockHistory.addMessage).toHaveBeenCalledWith('user', 'What do you think of this move?');
      expect(mockContainer.addMessage).toHaveBeenCalledWith('user', 'What do you think of this move?');
    });

    test('should ignore empty messages', () => {
      mentor.sendUserMessage('   ');

      expect(mockHistory.addMessage).not.toHaveBeenCalled();
      expect(mockContainer.addMessage).not.toHaveBeenCalled();
    });

    test('should handle messages when not connected', () => {
      mentor.isConnected = false;

      mentor.sendUserMessage('Test message');

      expect(mockHistory.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await mentor.initialize();
    });

    test('should return current config', () => {
      const config = mentor.getConfig();

      expect(config).toHaveProperty('personaName', 'Irina');
      expect(config).toHaveProperty('userElo', 1500);
      expect(config).toHaveProperty('enableAutoResponses', true);
    });

    test('should update configuration', () => {
      mentor.updateConfig({
        personaName: 'Magnus',
        userElo: 2800
      });

      expect(mentor.config.personaName).toBe('Magnus');
      expect(mentor.config.userElo).toBe(2800);
      expect(mentor.config.enableAutoResponses).toBe(true); // Should preserve other settings
    });
  });

  describe('Statistics and Status', () => {
    beforeEach(async () => {
      await mentor.initialize();
      mentor.connect();
    });

    test('should provide comprehensive stats', () => {
      const stats = mentor.getStats();

      expect(stats).toHaveProperty('integration');
      expect(stats).toHaveProperty('chatHistory');
      expect(stats).toHaveProperty('chatContainer');
      expect(stats).toHaveProperty('chatWrapper');

      expect(stats.integration.initialized).toBe(true);
      expect(stats.integration.connected).toBe(true);
    });
  });

  describe('Cleanup and Disconnection', () => {
    beforeEach(async () => {
      await mentor.initialize();
      mentor.connect();
    });

    test('should disconnect cleanly', () => {
      mentor.disconnect();

      expect(mockWrapper.destroy).toHaveBeenCalled();
      expect(mockContainer.destroy).toHaveBeenCalled();
      expect(mentor.isConnected).toBe(false);
    });

    test('should handle disconnect when components are null', () => {
      mentor.chatWrapper = null;
      mentor.chatContainer = null;

      expect(() => mentor.disconnect()).not.toThrow();
    });
  });
});