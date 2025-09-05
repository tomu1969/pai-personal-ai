#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SimplifiedPaiAssistant = require('../src/assistants/pai-assistant-simplified');
const messageSearchService = require('../src/services/messageSearch');
const searchParameterParser = require('../src/services/searchParameterParser');
const logger = require('../src/utils/logger');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

class SimplifiedPaiTestSuite {
  constructor() {
    this.assistant = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
    };
  }

  async runAllTests() {
    console.log(`${colors.bright}🧪 Simplified PAI Assistant Test Suite${colors.reset}\n`);

    try {
      // Test 1: Search Parameter Parser
      await this.testSearchParameterParser();
      
      // Test 2: Message Search Service  
      await this.testMessageSearchService();
      
      // Test 3: Assistant Initialization
      await this.testAssistantInitialization();
      
      // Test 4: Function Calling
      await this.testFunctionCalling();
      
      // Test 5: Conversation Flow
      await this.testConversationFlow();

      // Test Summary
      this.showTestSummary();

    } catch (error) {
      console.error(`${colors.red}❌ Test suite failed:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  async testSearchParameterParser() {
    console.log(`${colors.blue}1. Testing Search Parameter Parser${colors.reset}`);
    
    const testCases = [
      {
        name: 'Valid today parameters',
        params: { start_date: 'today', end_date: 'today' },
        shouldPass: true,
      },
      {
        name: 'Valid date range',
        params: { 
          start_date: '2024-09-01', 
          end_date: '2024-09-02',
          start_time: '09:00',
          end_time: '17:00',
          sender: 'Laura',
          keywords: ['meeting', 'urgent'],
          limit: 25,
        },
        shouldPass: true,
      },
      {
        name: 'Invalid date format',
        params: { start_date: '2024/09/01', end_date: 'today' },
        shouldPass: false,
      },
      {
        name: 'Invalid time format',
        params: { 
          start_date: 'today', 
          end_date: 'today',
          start_time: '25:00',
        },
        shouldPass: false,
      },
      {
        name: 'Missing required parameters',
        params: { sender: 'Laura' },
        shouldPass: false,
      },
    ];

    for (const testCase of testCases) {
      try {
        const result = searchParameterParser.validateAndNormalize(testCase.params);
        
        if (result.valid === testCase.shouldPass) {
          this.testPassed(`   ✓ ${testCase.name}`);
        } else {
          this.testFailed(`   ✗ ${testCase.name}`, 
            `Expected valid=${testCase.shouldPass}, got valid=${result.valid}`);
        }
        
      } catch (error) {
        this.testFailed(`   ✗ ${testCase.name}`, error.message);
      }
    }

    // Test examples generation
    try {
      const examples = searchParameterParser.generateExamples();
      if (examples && examples.length > 0) {
        this.testPassed('   ✓ Generate examples');
      } else {
        this.testFailed('   ✗ Generate examples', 'No examples generated');
      }
    } catch (error) {
      this.testFailed('   ✗ Generate examples', error.message);
    }

    console.log();
  }

  async testMessageSearchService() {
    console.log(`${colors.blue}2. Testing Message Search Service${colors.reset}`);

    // Test basic search functionality
    const testParams = {
      start_date: 'today',
      end_date: 'today',
      limit: 5,
    };

    try {
      const result = await messageSearchService.searchMessages(testParams);
      
      if (result.success !== undefined) {
        this.testPassed('   ✓ Search service response structure');
      } else {
        this.testFailed('   ✗ Search service response structure', 'Missing success field');
      }

      if (Array.isArray(result.messages)) {
        this.testPassed('   ✓ Messages array returned');
      } else {
        this.testFailed('   ✗ Messages array returned', 'Messages is not an array');
      }

      if (result.metadata && typeof result.metadata === 'object') {
        this.testPassed('   ✓ Metadata included');
      } else {
        this.testFailed('   ✗ Metadata included', 'Missing or invalid metadata');
      }

    } catch (error) {
      this.testFailed('   ✗ Basic search functionality', error.message);
    }

    // Test formatting
    try {
      const mockSearchResult = {
        success: true,
        messages: [
          {
            senderName: 'Test User',
            startTime: new Date(),
            endTime: new Date(),
            summary: 'Test message content',
          },
        ],
      };

      const formatted = messageSearchService.formatResults(mockSearchResult);
      if (typeof formatted === 'string' && formatted.includes('Test User')) {
        this.testPassed('   ✓ Result formatting');
      } else {
        this.testFailed('   ✗ Result formatting', 'Formatted result invalid');
      }

    } catch (error) {
      this.testFailed('   ✗ Result formatting', error.message);
    }

    // Test statistics
    try {
      const stats = await messageSearchService.getSearchStats('today');
      if (stats && typeof stats.totalMessages === 'number') {
        this.testPassed('   ✓ Search statistics');
      } else {
        this.testFailed('   ✗ Search statistics', 'Invalid stats structure');
      }
    } catch (error) {
      this.testFailed('   ✗ Search statistics', error.message);
    }

    console.log();
  }

  async testAssistantInitialization() {
    console.log(`${colors.blue}3. Testing Assistant Initialization${colors.reset}`);

    try {
      this.assistant = new SimplifiedPaiAssistant();
      this.testPassed('   ✓ Assistant creation');
    } catch (error) {
      this.testFailed('   ✗ Assistant creation', error.message);
      return;
    }

    // Test system prompt loading
    if (this.assistant.systemPrompt && this.assistant.systemPrompt.length > 0) {
      this.testPassed('   ✓ System prompt loaded');
    } else {
      this.testFailed('   ✗ System prompt loaded', 'System prompt is empty');
    }

    // Test OpenAI client
    if (this.assistant.client) {
      this.testPassed('   ✓ OpenAI client initialized');
    } else {
      this.testFailed('   ✗ OpenAI client initialized', 'OpenAI client not found');
    }

    // Test function definition
    try {
      const functionDef = this.assistant.getFunctionDefinition();
      if (functionDef && functionDef.name === 'search_messages') {
        this.testPassed('   ✓ Function definition');
      } else {
        this.testFailed('   ✗ Function definition', 'Invalid function definition');
      }
    } catch (error) {
      this.testFailed('   ✗ Function definition', error.message);
    }

    // Test stats
    try {
      const stats = this.assistant.getStats();
      if (stats && stats.model) {
        this.testPassed('   ✓ Assistant statistics');
      } else {
        this.testFailed('   ✗ Assistant statistics', 'Invalid stats');
      }
    } catch (error) {
      this.testFailed('   ✗ Assistant statistics', error.message);
    }

    console.log();
  }

  async testFunctionCalling() {
    console.log(`${colors.blue}4. Testing Function Calling (requires OpenAI API)${colors.reset}`);

    if (!process.env.OPENAI_API_KEY) {
      console.log(`   ${colors.yellow}⚠ Skipping function calling tests (no OpenAI API key)${colors.reset}`);
      console.log();
      return;
    }

    if (!this.assistant) {
      console.log(`   ${colors.red}✗ Cannot test function calling (assistant not initialized)${colors.reset}`);
      console.log();
      return;
    }

    // Test direct search function
    try {
      const searchResult = await this.assistant.testSearch({
        start_date: 'today',
        end_date: 'today',
        limit: 3,
      });

      if (searchResult && searchResult.success !== undefined) {
        this.testPassed('   ✓ Direct search function');
      } else {
        this.testFailed('   ✗ Direct search function', 'Invalid search result');
      }
    } catch (error) {
      this.testFailed('   ✗ Direct search function', error.message);
    }

    // Test message processing (this uses OpenAI API)
    try {
      console.log(`   ${colors.dim}   Testing with OpenAI API (this may take a moment)...${colors.reset}`);
      
      const result = await this.assistant.processMessage("What messages did I receive today?");
      
      if (result && result.success !== undefined) {
        this.testPassed('   ✓ Message processing');
        
        if (result.type === 'search_results') {
          this.testPassed('   ✓ Function calling triggered');
        } else {
          console.log(`   ${colors.yellow}⚠ Function calling not triggered (response type: ${result.type})${colors.reset}`);
        }
      } else {
        this.testFailed('   ✗ Message processing', 'Invalid response structure');
      }

    } catch (error) {
      this.testFailed('   ✗ Message processing', error.message);
    }

    console.log();
  }

  async testConversationFlow() {
    console.log(`${colors.blue}5. Testing Conversation Flow${colors.reset}`);

    if (!process.env.OPENAI_API_KEY || !this.assistant) {
      console.log(`   ${colors.yellow}⚠ Skipping conversation tests (no API key or assistant)${colors.reset}`);
      console.log();
      return;
    }

    // Clear history for clean test
    this.assistant.clearHistory();

    const testMessages = [
      "Hello PAI",
      "What messages did I get today?", 
      "Thank you",
    ];

    for (let i = 0; i < testMessages.length; i++) {
      try {
        console.log(`   ${colors.dim}   Processing: "${testMessages[i]}"${colors.reset}`);
        
        const result = await this.assistant.processMessage(testMessages[i]);
        
        if (result && result.success !== undefined) {
          this.testPassed(`   ✓ Message ${i + 1} processed`);
        } else {
          this.testFailed(`   ✗ Message ${i + 1} processed`, 'Invalid response');
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        this.testFailed(`   ✗ Message ${i + 1} processed`, error.message);
      }
    }

    // Test history management
    const stats = this.assistant.getStats();
    if (stats.conversationLength >= 3) {
      this.testPassed('   ✓ Conversation history maintained');
    } else {
      this.testFailed('   ✗ Conversation history maintained', 
        `Expected >=3 messages, got ${stats.conversationLength}`);
    }

    // Test history clearing
    this.assistant.clearHistory();
    const clearedStats = this.assistant.getStats();
    if (clearedStats.conversationLength === 0) {
      this.testPassed('   ✓ History clearing');
    } else {
      this.testFailed('   ✗ History clearing', 'History not cleared properly');
    }

    console.log();
  }

  testPassed(message) {
    console.log(`${colors.green}${message}${colors.reset}`);
    this.testResults.passed++;
    this.testResults.total++;
  }

  testFailed(message, reason = '') {
    console.log(`${colors.red}${message}${colors.reset}`);
    if (reason) {
      console.log(`${colors.dim}     Reason: ${reason}${colors.reset}`);
    }
    this.testResults.failed++;
    this.testResults.total++;
  }

  showTestSummary() {
    console.log(`${colors.bright}📊 Test Results Summary${colors.reset}`);
    console.log(`${colors.bright}═══════════════════════${colors.reset}`);
    console.log(`${colors.green}Passed: ${this.testResults.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.testResults.failed}${colors.reset}`);
    console.log(`${colors.blue}Total:  ${this.testResults.total}${colors.reset}`);

    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    console.log(`${colors.bright}Success Rate: ${successRate}%${colors.reset}`);

    if (this.testResults.failed === 0) {
      console.log(`\n${colors.green}🎉 All tests passed! The simplified PAI Assistant is working correctly.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠ Some tests failed. Please review the output above.${colors.reset}`);
    }

    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`${colors.dim}1. Try the CLI: node pai-assistant-cli.js${colors.reset}`);
    console.log(`${colors.dim}2. Test searches with: "What messages did I get today?"${colors.reset}`);
    console.log(`${colors.dim}3. Use the modular search service independently${colors.reset}`);
    console.log();
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new SimplifiedPaiTestSuite();
  testSuite.runAllTests().catch((error) => {
    console.error('Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = SimplifiedPaiTestSuite;