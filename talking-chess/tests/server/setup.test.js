/**
 * Server Setup Tests - TDD Phase 1.1
 * Tests server dependencies and basic configuration
 */

const fs = require('fs');
const path = require('path');

describe('Server Setup', () => {
  describe('Dependencies', () => {
    test('should have express dependency', () => {
      const packageJson = require('../../package.json');
      expect(
        packageJson.dependencies?.express || 
        packageJson.devDependencies?.express
      ).toBeDefined();
    });

    test('should have cors dependency', () => {
      const packageJson = require('../../package.json');
      expect(
        packageJson.dependencies?.cors || 
        packageJson.devDependencies?.cors
      ).toBeDefined();
    });

    test('should have dotenv dependency', () => {
      const packageJson = require('../../package.json');
      expect(
        packageJson.dependencies?.dotenv || 
        packageJson.devDependencies?.dotenv
      ).toBeDefined();
    });

    test('should have openai dependency', () => {
      const packageJson = require('../../package.json');
      expect(
        packageJson.dependencies?.openai || 
        packageJson.devDependencies?.openai
      ).toBeDefined();
    });
  });

  describe('Server Structure', () => {
    test('should have server directory', () => {
      const serverPath = path.join(__dirname, '../../server');
      expect(fs.existsSync(serverPath)).toBe(true);
    });

    test('should have server/index.js main file', () => {
      const serverIndexPath = path.join(__dirname, '../../server/index.js');
      expect(fs.existsSync(serverIndexPath)).toBe(true);
    });

    test('should have .env.example file', () => {
      const envExamplePath = path.join(__dirname, '../../.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    test('should have server routes directory', () => {
      const routesPath = path.join(__dirname, '../../server/routes');
      expect(fs.existsSync(routesPath)).toBe(true);
    });

    test('should have server modules directory', () => {
      const modulesPath = path.join(__dirname, '../../server/modules');
      expect(fs.existsSync(modulesPath)).toBe(true);
    });
  });
});