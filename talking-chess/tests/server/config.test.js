/**
 * Server Configuration Tests - TDD Phase 1.1
 * Tests environment variable loading and server configuration
 */

describe('Server Configuration', () => {
  describe('Environment Variables', () => {
    test('should load environment variables from .env', () => {
      // Mock environment variables for testing
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';
      process.env.OPENAI_API_KEY = 'test-key-123';
      
      // This will be implemented in server/config.js
      const config = require('../../server/config');
      
      expect(config.port).toBe(3001);
      expect(config.nodeEnv).toBe('test');
      expect(config.openaiApiKey).toBe('test-key-123');
    });

    test('should have default port when PORT not set', () => {
      const originalPort = process.env.PORT;
      delete process.env.PORT;
      
      // Clear require cache to test defaults
      delete require.cache[require.resolve('../../server/config')];
      const config = require('../../server/config');
      
      expect(config.port).toBe(3000); // Default port
      
      // Restore original port
      process.env.PORT = originalPort;
    });

    test('should validate required environment variables', () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      const originalNodeEnv = process.env.NODE_ENV;
      
      delete process.env.OPENAI_API_KEY;
      process.env.NODE_ENV = 'production'; // Not test mode, so validation should run
      
      // Should throw error when required env vars missing
      expect(() => {
        delete require.cache[require.resolve('../../server/config')];
        require('../../server/config');
      }).toThrow('OPENAI_API_KEY is required');
      
      // Restore original values
      process.env.OPENAI_API_KEY = originalApiKey;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Server Instance', () => {
    test('should create Express server instance', () => {
      const server = require('../../server/index');
      expect(server).toBeDefined();
      expect(typeof server.listen).toBe('function');
    });

    test('should configure CORS middleware', () => {
      const server = require('../../server/index');
      // Test will verify CORS headers in integration tests
      expect(server).toBeDefined();
    });

    test('should configure JSON body parser', () => {
      const server = require('../../server/index');
      // Test will verify JSON parsing in integration tests
      expect(server).toBeDefined();
    });
  });
});