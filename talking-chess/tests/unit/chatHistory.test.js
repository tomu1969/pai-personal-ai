/**
 * Chat History Management Tests - TDD Phase 2.3
 * Tests chat storage, retrieval, and conversation context management
 */

const ChatHistory = require('../../src/chat-history');

describe('Chat History Management', () => {
  let chatHistory;

  beforeEach(() => {
    chatHistory = new ChatHistory();
  });

  describe('Message Storage', () => {
    test('should add user message with timestamp', () => {
      const message = 'What should I do in this position?';
      const messageId = chatHistory.addMessage('user', message);

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');

      const history = chatHistory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('id', messageId);
      expect(history[0]).toHaveProperty('sender', 'user');
      expect(history[0]).toHaveProperty('message', message);
      expect(history[0]).toHaveProperty('timestamp');
      expect(new Date(history[0].timestamp)).toBeInstanceOf(Date);
    });

    test('should add assistant message with context', () => {
      const message = 'Look at your king safety. What do you notice about your position?';
      const context = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        engineEval: { score: 0.3, bestMove: 'e7e5' },
        userElo: 1400
      };

      const messageId = chatHistory.addMessage('assistant', message, context);
      const history = chatHistory.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('sender', 'assistant');
      expect(history[0]).toHaveProperty('message', message);
      expect(history[0]).toHaveProperty('context', context);
    });

    test('should generate unique message IDs', () => {
      const id1 = chatHistory.addMessage('user', 'Message 1');
      const id2 = chatHistory.addMessage('user', 'Message 2');
      const id3 = chatHistory.addMessage('assistant', 'Response 1');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('should maintain message order', () => {
      chatHistory.addMessage('user', 'First message');
      chatHistory.addMessage('assistant', 'First response');
      chatHistory.addMessage('user', 'Second message');
      chatHistory.addMessage('assistant', 'Second response');

      const history = chatHistory.getHistory();
      expect(history).toHaveLength(4);
      expect(history[0].message).toBe('First message');
      expect(history[1].message).toBe('First response');
      expect(history[2].message).toBe('Second message');
      expect(history[3].message).toBe('Second response');
    });
  });

  describe('History Retrieval', () => {
    beforeEach(() => {
      // Add some test messages
      chatHistory.addMessage('user', 'Hello, Irina');
      chatHistory.addMessage('assistant', 'Hello! I am here to help you improve your chess.');
      chatHistory.addMessage('user', 'What opening should I play?');
      chatHistory.addMessage('assistant', 'What kind of positions do you enjoy playing?');
      chatHistory.addMessage('user', 'I like tactical positions');
      chatHistory.addMessage('assistant', 'Consider the King\'s Indian Defense for dynamic play.');
    });

    test('should retrieve complete history', () => {
      const history = chatHistory.getHistory();
      expect(history).toHaveLength(6);
    });

    test('should retrieve limited number of recent messages', () => {
      const recentHistory = chatHistory.getRecentHistory(4);
      expect(recentHistory).toHaveLength(4);
      expect(recentHistory[0].message).toBe('What opening should I play?');
      expect(recentHistory[3].message).toBe('Consider the King\'s Indian Defense for dynamic play.');
    });

    test('should retrieve messages since specific timestamp', () => {
      // Test with a timestamp from way in the past - should get all messages
      const pastTimestamp = '2020-01-01T00:00:00.000Z';
      const messagesSinceStart = chatHistory.getMessagesSince(pastTimestamp);
      expect(messagesSinceStart).toHaveLength(6); // Should get all 6 messages

      // Test with a future timestamp - should get no messages  
      const futureTimestamp = '2030-01-01T00:00:00.000Z';
      const messagesSinceFuture = chatHistory.getMessagesSince(futureTimestamp);
      expect(messagesSinceFuture).toHaveLength(0);
    });

    test('should retrieve messages by sender', () => {
      const userMessages = chatHistory.getMessagesBySender('user');
      const assistantMessages = chatHistory.getMessagesBySender('assistant');

      expect(userMessages).toHaveLength(3);
      expect(assistantMessages).toHaveLength(3);

      expect(userMessages[0].message).toBe('Hello, Irina');
      expect(assistantMessages[0].message).toBe('Hello! I am here to help you improve your chess.');
    });

    test('should find message by ID', () => {
      const history = chatHistory.getHistory();
      const messageId = history[2].id;

      const foundMessage = chatHistory.getMessageById(messageId);
      expect(foundMessage).toBeDefined();
      expect(foundMessage.message).toBe('What opening should I play?');
    });

    test('should return null for non-existent message ID', () => {
      const foundMessage = chatHistory.getMessageById('non-existent-id');
      expect(foundMessage).toBeNull();
    });
  });

  describe('Context Management', () => {
    test('should format conversation for AI context', () => {
      chatHistory.addMessage('user', 'Is this move good?', {
        fen: 'test-fen',
        lastMove: 'e2e4'
      });
      chatHistory.addMessage('assistant', 'What do you think about king safety?');

      const context = chatHistory.formatForAI(2);

      expect(context).toBeInstanceOf(Array);
      expect(context).toHaveLength(2);
      expect(context[0]).toHaveProperty('role', 'user');
      expect(context[0]).toHaveProperty('content', 'Is this move good?');
      expect(context[1]).toHaveProperty('role', 'assistant');
      expect(context[1]).toHaveProperty('content', 'What do you think about king safety?');
    });

    test('should include game context in formatted messages', () => {
      const gameContext = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        engineEval: { score: 0.3, bestMove: 'e7e5' }
      };

      chatHistory.addMessage('assistant', 'Good move!', gameContext);

      const formatted = chatHistory.formatForAI(1);
      expect(formatted[0]).toHaveProperty('gameContext', gameContext);
    });

    test('should limit formatted context to specified count', () => {
      for (let i = 0; i < 10; i++) {
        chatHistory.addMessage('user', `Message ${i}`);
      }

      const context = chatHistory.formatForAI(5);
      expect(context).toHaveLength(5);
      expect(context[0].content).toBe('Message 5');
      expect(context[4].content).toBe('Message 9');
    });
  });

  describe('History Persistence', () => {
    test('should export history to JSON format', () => {
      chatHistory.addMessage('user', 'Test message');
      chatHistory.addMessage('assistant', 'Test response');

      const exported = chatHistory.exportToJSON();
      const parsed = JSON.parse(exported);

      expect(parsed).toBeInstanceOf(Array);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('sender', 'user');
      expect(parsed[1]).toHaveProperty('sender', 'assistant');
    });

    test('should import history from JSON format', () => {
      const testData = JSON.stringify([
        {
          id: 'test-id-1',
          sender: 'user',
          message: 'Imported message',
          timestamp: '2023-01-01T12:00:00Z'
        },
        {
          id: 'test-id-2',
          sender: 'assistant',
          message: 'Imported response',
          timestamp: '2023-01-01T12:01:00Z'
        }
      ]);

      chatHistory.importFromJSON(testData);
      const history = chatHistory.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Imported message');
      expect(history[1].message).toBe('Imported response');
    });

    test('should handle invalid JSON import gracefully', () => {
      const invalidJSON = 'invalid json data';

      expect(() => {
        chatHistory.importFromJSON(invalidJSON);
      }).toThrow('Invalid JSON format');
    });

    test('should clear history', () => {
      chatHistory.addMessage('user', 'Test');
      chatHistory.addMessage('assistant', 'Response');

      expect(chatHistory.getHistory()).toHaveLength(2);

      chatHistory.clearHistory();

      expect(chatHistory.getHistory()).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    test('should auto-trim history when exceeding max size', () => {
      const maxMessages = 100;
      chatHistory.setMaxMessages(maxMessages);

      // Add more than max messages
      for (let i = 0; i < maxMessages + 20; i++) {
        chatHistory.addMessage('user', `Message ${i}`);
      }

      const history = chatHistory.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxMessages);
      expect(history[0].message).toBe('Message 20'); // First 20 should be trimmed
    });

    test('should maintain conversation context when trimming', () => {
      chatHistory.setMaxMessages(6);

      // Add 10 messages (5 user, 5 assistant alternating)
      for (let i = 0; i < 5; i++) {
        chatHistory.addMessage('user', `User message ${i}`);
        chatHistory.addMessage('assistant', `Assistant response ${i}`);
      }

      const history = chatHistory.getHistory();
      expect(history).toHaveLength(6); // Should keep only last 6

      // Should maintain user-assistant alternating pattern
      expect(history[0].sender).toBe('user');
      expect(history[1].sender).toBe('assistant');
      expect(history[0].message).toBe('User message 2');
      expect(history[5].message).toBe('Assistant response 4');
    });

    test('should get memory usage statistics', () => {
      chatHistory.addMessage('user', 'Test message');
      chatHistory.addMessage('assistant', 'Test response');

      const stats = chatHistory.getMemoryStats();

      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('userMessages');
      expect(stats).toHaveProperty('assistantMessages');
      expect(stats).toHaveProperty('averageMessageLength');
      expect(stats).toHaveProperty('estimatedMemoryUsage');

      expect(stats.totalMessages).toBe(2);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      chatHistory.addMessage('user', 'How do I improve my opening play?');
      chatHistory.addMessage('assistant', 'Focus on opening principles: development, center control, king safety.');
      chatHistory.addMessage('user', 'What about endgames?');
      chatHistory.addMessage('assistant', 'Endgame study is crucial for chess improvement.');
      chatHistory.addMessage('user', 'How do I analyze my games?');
      chatHistory.addMessage('assistant', 'Use an engine to find tactical mistakes and missed opportunities.');
    });

    test('should search messages by content', () => {
      const results = chatHistory.searchMessages('opening');
      expect(results).toHaveLength(2); // One user question, one assistant answer
      expect(results[0].message).toContain('opening');
      expect(results[1].message).toContain('opening');
    });

    test('should search with case insensitive matching', () => {
      const results = chatHistory.searchMessages('ENDGAME');
      expect(results).toHaveLength(2); // Question and answer about endgames
    });

    test('should return empty array when no matches found', () => {
      const results = chatHistory.searchMessages('nonexistent term');
      expect(results).toHaveLength(0);
    });

    test('should filter messages by date range', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      // All messages should be within the last minute
      const recent = chatHistory.getMessagesInDateRange(oneMinuteAgo, now);
      expect(recent).toHaveLength(6);

      // No messages should be from an hour ago
      const hourAgo = new Date(now.getTime() - 3600000);
      const old = chatHistory.getMessagesInDateRange(hourAgo, oneMinuteAgo);
      expect(old).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid sender types', () => {
      expect(() => {
        chatHistory.addMessage('invalid-sender', 'test message');
      }).toThrow('Invalid sender type');
    });

    test('should handle empty messages', () => {
      expect(() => {
        chatHistory.addMessage('user', '');
      }).toThrow('Message cannot be empty');

      expect(() => {
        chatHistory.addMessage('user', null);
      }).toThrow('Message cannot be empty');
    });

    test('should handle negative or zero limits gracefully', () => {
      chatHistory.addMessage('user', 'test');
      
      expect(chatHistory.getRecentHistory(0)).toHaveLength(0);
      expect(chatHistory.getRecentHistory(-5)).toHaveLength(0);
      expect(chatHistory.formatForAI(0)).toHaveLength(0);
    });

    test('should handle invalid date ranges', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 3600000);

      // Start date after end date should return empty array
      const results = chatHistory.getMessagesInDateRange(future, now);
      expect(results).toHaveLength(0);
    });
  });
});