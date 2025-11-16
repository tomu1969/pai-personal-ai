/**
 * Jest Test Setup
 * Global configuration for all test files
 */

// Fix for TextEncoder/TextDecoder in Jest environment
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Extend Jest matchers
expect.extend({
  toBeValidChessPosition(received) {
    const fenRegex = /^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s[bw]\s(-|K?Q?k?q?)\s(-|[a-h][36])\s\d+\s\d+$/;
    const pass = fenRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid chess position`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid chess position`,
        pass: false,
      };
    }
  },
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // uncomment to ignore a specific log level
  // log: jest.fn(),
  debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock localStorage for browser-like environment
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Global test constants
global.TEST_CONSTANTS = {
  STARTING_FEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  DEFAULT_ELO: 1500,
  MIN_ELO: 800,
  MAX_ELO: 3000,
  BOARD_SIZE: 400
};