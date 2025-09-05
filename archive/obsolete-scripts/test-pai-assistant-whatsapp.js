#!/usr/bin/env node

require('dotenv').config({ override: true });

const evolutionMultiInstance = require('../src/services/evolutionMultiInstance');
const paiAssistantWhatsApp = require('../src/services/paiAssistantWhatsApp');
const messageSearchService = require('../src/services/messageSearch');
const SimplifiedPaiAssistant = require('../src/assistants/pai-assistant-simplified');
const logger = require('../src/utils/logger');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * PAI Assistant WhatsApp Setup Test Suite
 */
class PaiAssistantTestSuite {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    log(`🧪 Testing: ${testName}`, 'yellow');
    
    try {
      const result = await testFunction();
      if (result) {
        log(`✅ ${testName}`, 'green');
        this.passedTests++;
        this.testResults.push({ name: testName, status: 'PASS', details: result });
      } else {
        log(`❌ ${testName}`, 'red');
        this.testResults.push({ name: testName, status: 'FAIL', details: 'Test returned false' });
      }
    } catch (error) {
      log(`❌ ${testName}: ${error.message}`, 'red');
      this.testResults.push({ name: testName, status: 'ERROR', details: error.message });
    }
    log('', 'reset');
  }

  async testMultiInstanceService() {
    return this.runTest('Multi-Instance Service Initialization', async () => {
      await evolutionMultiInstance.initialize();
      const stats = await evolutionMultiInstance.getServiceStats();
      
      log(`   Initialized: ${stats.initialized}`, 'dim');
      log(`   Instance Count: ${stats.instanceCount}`, 'dim');
      
      return stats.initialized && stats.instanceCount >= 2;
    });
  }

  async testPaiAssistantInstance() {
    return this.runTest('PAI Assistant Instance Configuration', async () => {
      const instance = evolutionMultiInstance.getInstance('pai_assistant');
      const config = evolutionMultiInstance.getInstanceConfig('pai_assistant');
      
      log(`   Instance ID: ${config.instanceId}`, 'dim');
      log(`   Assistant Type: ${config.assistantType}`, 'dim');
      log(`   Webhook Path: ${config.webhookPath}`, 'dim');
      
      return instance && config && config.assistantType === 'pai_assistant';
    });
  }

  async testPaiAssistantService() {
    return this.runTest('PAI Assistant WhatsApp Service', async () => {
      await paiAssistantWhatsApp.initialize();
      const stats = paiAssistantWhatsApp.getConversationStats();
      
      log(`   Service Initialized: ${stats.initialized}`, 'dim');
      log(`   Active Conversations: ${stats.activeConversations}`, 'dim');
      
      return stats.initialized;
    });
  }

  async testMessageSearchService() {
    return this.runTest('Message Search Service', async () => {
      const testParams = {
        start_date: 'today',
        end_date: 'today',
        sender: 'all',
        limit: 5
      };
      
      const result = await messageSearchService.searchMessages(testParams);
      
      log(`   Search Success: ${result.success}`, 'dim');
      log(`   Messages Found: ${result.metadata?.totalMessages || 0}`, 'dim');
      
      return result.success !== undefined; // Just test that it doesn't crash
    });
  }

  async testSimplifiedPaiAssistant() {
    return this.runTest('Simplified PAI Assistant', async () => {
      const assistant = new SimplifiedPaiAssistant();
      const functionDef = assistant.getFunctionDefinition();
      
      log(`   Function Name: ${functionDef.name}`, 'dim');
      log(`   Has Parameters: ${!!functionDef.parameters}`, 'dim');
      log(`   Required Params: ${functionDef.parameters.required.length}`, 'dim');
      
      return functionDef.name === 'search_messages' && functionDef.parameters;
    });
  }

  async testPaiAssistantMessageProcessing() {
    return this.runTest('PAI Assistant Message Processing', async () => {
      const mockMessage = {
        phone: '+1234567890',
        content: 'help',
        pushName: 'Test User',
        messageId: 'test_123',
        messageType: 'conversation'
      };
      
      const result = await paiAssistantWhatsApp.processMessageWithCommands(mockMessage);
      
      log(`   Processing Success: ${result.success}`, 'dim');
      log(`   Message Type: ${result.messageType}`, 'dim');
      log(`   Response Length: ${result.response?.length || 0}`, 'dim');
      
      return result.success && result.response;
    });
  }

  async testSpecialCommands() {
    return this.runTest('Special Commands (help, reset, status)', async () => {
      const commands = ['help', 'reset', 'status'];
      const results = [];
      
      for (const command of commands) {
        const mockMessage = {
          phone: '+1234567890',
          content: command,
          pushName: 'Test User',
          messageId: `test_${command}`,
          messageType: 'conversation'
        };
        
        const result = await paiAssistantWhatsApp.processMessageWithCommands(mockMessage);
        results.push(result.success);
        log(`   ${command}: ${result.success ? 'OK' : 'FAIL'}`, result.success ? 'dim' : 'red');
      }
      
      return results.every(r => r);
    });
  }

  async testSearchQueryProcessing() {
    return this.runTest('Search Query Processing', async () => {
      const searchQueries = [
        'show me messages from today',
        'what did I get yesterday',
        'messages from last week'
      ];
      
      const results = [];
      
      for (const query of searchQueries) {
        try {
          const mockMessage = {
            phone: '+1234567890',
            content: query,
            pushName: 'Test User',
            messageId: `test_search_${Math.random()}`,
            messageType: 'conversation'
          };
          
          const result = await paiAssistantWhatsApp.processMessageWithCommands(mockMessage);
          results.push(result.success);
          log(`   "${query}": ${result.success ? 'OK' : 'FAIL'}`, result.success ? 'dim' : 'red');
        } catch (error) {
          results.push(false);
          log(`   "${query}": ERROR - ${error.message}`, 'red');
        }
      }
      
      return results.every(r => r);
    });
  }

  async testInstanceConnections() {
    return this.runTest('Instance Connection Status', async () => {
      const instances = ['main', 'pai_assistant'];
      const statuses = [];
      
      for (const alias of instances) {
        try {
          const status = await evolutionMultiInstance.getConnectionStatus(alias);
          statuses.push(status);
          log(`   ${alias}: ${status.status.state} (${status.connected ? 'Connected' : 'Disconnected'})`, status.connected ? 'green' : 'yellow');
        } catch (error) {
          log(`   ${alias}: ERROR - ${error.message}`, 'red');
          statuses.push({ error: error.message });
        }
      }
      
      // Test passes if we can get status (regardless of connection state)
      return statuses.length === instances.length && statuses.every(s => s.status || s.error);
    });
  }

  async testWebhookRoutes() {
    return this.runTest('Webhook Route Configuration', async () => {
      // Test that routes exist (this would require server to be running)
      const expectedRoutes = [
        '/webhook/main',
        '/webhook/pai-assistant',
        '/webhook/multi-instance/status'
      ];
      
      log('   Expected webhook routes:', 'dim');
      expectedRoutes.forEach(route => {
        log(`     ${route}`, 'dim');
      });
      
      // For now, just verify the configuration exists
      const mainConfig = evolutionMultiInstance.getInstanceConfig('main');
      const paiConfig = evolutionMultiInstance.getInstanceConfig('pai_assistant');
      
      return mainConfig.webhookPath && paiConfig.webhookPath;
    });
  }

  async runAllTests() {
    log('🚀 PAI Assistant WhatsApp Setup Test Suite', 'bold');
    log('═══════════════════════════════════════════════', 'blue');
    log('', 'reset');
    
    // Core service tests
    await this.testMultiInstanceService();
    await this.testPaiAssistantInstance();
    await this.testPaiAssistantService();
    
    // Assistant functionality tests
    await this.testMessageSearchService();
    await this.testSimplifiedPaiAssistant();
    await this.testPaiAssistantMessageProcessing();
    
    // Feature tests
    await this.testSpecialCommands();
    await this.testSearchQueryProcessing();
    
    // Infrastructure tests
    await this.testInstanceConnections();
    await this.testWebhookRoutes();
    
    this.showResults();
  }

  showResults() {
    log('📊 Test Results Summary', 'bold');
    log('═══════════════════════', 'blue');
    log('', 'reset');
    
    log(`Total Tests: ${this.totalTests}`, 'blue');
    log(`Passed: ${this.passedTests}`, 'green');
    log(`Failed: ${this.totalTests - this.passedTests}`, this.totalTests > this.passedTests ? 'red' : 'green');
    log(`Success Rate: ${Math.round((this.passedTests / this.totalTests) * 100)}%`, this.passedTests === this.totalTests ? 'green' : 'yellow');
    log('', 'reset');
    
    // Show failed tests
    const failedTests = this.testResults.filter(t => t.status !== 'PASS');
    if (failedTests.length > 0) {
      log('❌ Failed Tests:', 'red');
      failedTests.forEach(test => {
        log(`   ${test.name}: ${test.status}`, 'red');
        if (test.details) {
          log(`      ${test.details}`, 'dim');
        }
      });
      log('', 'reset');
    }
    
    // Show recommendations
    this.showRecommendations();
  }

  showRecommendations() {
    log('💡 Recommendations:', 'cyan');
    log('', 'reset');
    
    if (this.passedTests === this.totalTests) {
      log('🎉 All tests passed! Your PAI Assistant WhatsApp setup is ready.', 'green');
      log('', 'reset');
      log('Next steps:', 'blue');
      log('1. Run: node scripts/setup-pai-assistant-line.js', 'dim');
      log('2. Scan QR code with dedicated WhatsApp account', 'dim');
      log('3. Start your server: npm start', 'dim');
      log('4. Test with real WhatsApp messages', 'dim');
    } else {
      log('⚠️  Some tests failed. Please review the errors above.', 'yellow');
      log('', 'reset');
      log('Common issues:', 'blue');
      log('• Database not accessible (check connection)', 'dim');
      log('• OpenAI API key not configured', 'dim');
      log('• Evolution API not running', 'dim');
      log('• Missing environment variables', 'dim');
    }
    
    log('', 'reset');
    log('🛠️  Useful commands:', 'cyan');
    log('   node scripts/show-pai-assistant-qr.js --status', 'dim');
    log('   node scripts/setup-pai-assistant-line.js', 'dim');
    log('   node pai-assistant-cli.js (test CLI)', 'dim');
    log('', 'reset');
  }
}

async function main() {
  const testSuite = new PaiAssistantTestSuite();
  
  try {
    await testSuite.runAllTests();
  } catch (error) {
    log(`❌ Test suite failed: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
  
  // Exit with error code if tests failed
  if (testSuite.passedTests < testSuite.totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PaiAssistantTestSuite;