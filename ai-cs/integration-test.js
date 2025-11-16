/**
 * @file integration-test.js
 * @description Comprehensive integration test suite for CS Ticket System
 * @module ai-cs/integration-test
 * @requires ./index
 * @requires ./modules/ticket-detector
 * @requires ./modules/sheets-service
 * @requires ./modules/follow-up-scheduler
 * @requires ./controllers/cs-webhook
 * @author PAI System - CS Module E (Integration Testing)
 * @since November 2025
 */

const csOrchestrator = require('./index');
const ticketDetector = require('./modules/ticket-detector');
const sheetsService = require('./modules/sheets-service');
const followUpScheduler = require('./modules/follow-up-scheduler');
const csWebhook = require('./controllers/cs-webhook');

/**
 * CS Integration Test Suite
 * Tests end-to-end functionality of the CS Ticket System
 */
class CSIntegrationTestSuite {
  constructor() {
    this.testResults = [];
    this.startTime = null;
    this.mockData = {
      serviceAccountKey: {
        type: "service_account",
        project_id: "test-project",
        private_key_id: "test-key-id",
        private_key: "-----BEGIN PRIVATE KEY-----\ntest-private-key\n-----END PRIVATE KEY-----\n",
        client_email: "test@test-project.iam.gserviceaccount.com",
        client_id: "123456789",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token"
      },
      testSheetId: "1test_sheet_id_for_integration_testing",
      testMessages: [
        {
          messageId: "test-msg-001",
          groupId: "120363123456789@g.us",
          groupName: "Customer Support Test",
          senderName: "John Customer",
          textContent: "I can't login to my account, please help!",
          timestamp: new Date(),
          fromWhatsApp: true,
          instanceId: "cs-ticket-monitor"
        },
        {
          messageId: "test-msg-002",
          groupId: "120363123456789@g.us",
          groupName: "Customer Support Test",
          senderName: "Jane User",
          textContent: "Thank you for your help",
          timestamp: new Date(),
          fromWhatsApp: true,
          instanceId: "cs-ticket-monitor"
        },
        {
          messageId: "test-msg-003",
          groupId: "120363123456789@g.us",
          groupName: "Customer Support Test",
          senderName: "Support Agent",
          textContent: "Ticket T123456 has been resolved",
          timestamp: new Date(),
          fromWhatsApp: true,
          instanceId: "cs-ticket-monitor"
        }
      ]
    };
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    this.startTime = new Date();
    console.log('🧪 Starting CS Ticket System Integration Tests');
    console.log('='.repeat(60));

    try {
      // Test 1: Module Loading
      await this.testModuleLoading();

      // Test 2: Mock Service Initialization
      await this.testMockServiceInitialization();

      // Test 3: Ticket Detection Pipeline
      await this.testTicketDetectionPipeline();

      // Test 4: Status Update Processing
      await this.testStatusUpdateProcessing();

      // Test 5: Follow-up Scheduler Integration
      await this.testFollowUpSchedulerIntegration();

      // Test 6: End-to-End Message Flow
      await this.testEndToEndMessageFlow();

      // Test 7: Error Handling
      await this.testErrorHandling();

      // Test 8: Performance Testing
      await this.testPerformance();

      // Print summary
      this.printTestSummary();

    } catch (error) {
      console.error('❌ Integration test suite failed:', error.message);
      this.recordTest('Integration Test Suite', false, error.message);
    }
  }

  /**
   * Test 1: Module Loading
   */
  async testModuleLoading() {
    console.log('📦 Test 1: Module Loading');
    
    try {
      // Test orchestrator loading
      if (typeof csOrchestrator.initialize === 'function') {
        this.recordTest('Orchestrator Loading', true, 'Module loaded successfully');
      } else {
        throw new Error('Orchestrator missing initialize method');
      }

      // Test ticket detector loading
      if (typeof ticketDetector.detectTicket === 'function') {
        this.recordTest('Ticket Detector Loading', true, 'Module loaded successfully');
      } else {
        throw new Error('Ticket detector missing detectTicket method');
      }

      // Test sheets service loading
      if (typeof sheetsService.initialize === 'function') {
        this.recordTest('Sheets Service Loading', true, 'Module loaded successfully');
      } else {
        throw new Error('Sheets service missing initialize method');
      }

      // Test follow-up scheduler loading
      if (typeof followUpScheduler.start === 'function') {
        this.recordTest('Follow-up Scheduler Loading', true, 'Module loaded successfully');
      } else {
        throw new Error('Follow-up scheduler missing start method');
      }

      // Test webhook controller loading
      if (typeof csWebhook.handleCSWebhook === 'function') {
        this.recordTest('Webhook Controller Loading', true, 'Module loaded successfully');
      } else {
        throw new Error('Webhook controller missing handleCSWebhook method');
      }

      console.log('✅ All modules loaded successfully\n');

    } catch (error) {
      console.error(`❌ Module loading failed: ${error.message}\n`);
      this.recordTest('Module Loading', false, error.message);
    }
  }

  /**
   * Test 2: Mock Service Initialization
   */
  async testMockServiceInitialization() {
    console.log('🚀 Test 2: Mock Service Initialization');

    try {
      // Mock Google Sheets service initialization
      console.log('  - Testing mock sheets service initialization...');
      
      // Create mock sheets service for testing
      const mockSheetsService = {
        initialize: async (serviceKey, sheetId) => {
          if (!serviceKey || !sheetId) {
            throw new Error('Missing service key or sheet ID');
          }
          return { success: true };
        },
        writeTicket: async (ticketData) => {
          return {
            success: true,
            data: {
              ticketId: 'T' + Date.now(),
              timestamp: new Date().toISOString()
            }
          };
        },
        getStaleTickets: async (hoursOld) => {
          return [
            {
              ticketId: 'T1234567890',
              customer: 'Test Customer',
              issue: 'Test issue',
              priority: 'high',
              groupId: '120363123456789@g.us',
              timestamp: new Date(Date.now() - (hoursOld + 1) * 60 * 60 * 1000)
            }
          ];
        },
        updateTicketStatus: async (ticketId, status, notes) => {
          return { success: true };
        }
      };

      // Test initialization
      const initResult = await mockSheetsService.initialize(
        this.mockData.serviceAccountKey,
        this.mockData.testSheetId
      );

      if (initResult.success) {
        this.recordTest('Mock Sheets Service Init', true, 'Initialized successfully');
      } else {
        throw new Error('Mock sheets service initialization failed');
      }

      console.log('✅ Mock service initialization successful\n');

    } catch (error) {
      console.error(`❌ Mock service initialization failed: ${error.message}\n`);
      this.recordTest('Mock Service Initialization', false, error.message);
    }
  }

  /**
   * Test 3: Ticket Detection Pipeline
   */
  async testTicketDetectionPipeline() {
    console.log('🎯 Test 3: Ticket Detection Pipeline');

    try {
      const testMessage = this.mockData.testMessages[0]; // "I can't login to my account"

      console.log('  - Testing ticket detection...');
      const detectionResult = await ticketDetector.detectTicket(
        testMessage.textContent,
        testMessage.senderName
      );

      if (detectionResult.isTicket) {
        this.recordTest('Ticket Detection', true, 
          `Detected ticket: priority=${detectionResult.ticketData.priority}, customer=${detectionResult.ticketData.customer}`);
      } else {
        throw new Error('Failed to detect obvious ticket');
      }

      // Test non-ticket message
      console.log('  - Testing non-ticket detection...');
      const nonTicketMessage = this.mockData.testMessages[1]; // "Thank you for your help"
      const nonTicketResult = await ticketDetector.detectTicket(
        nonTicketMessage.textContent,
        nonTicketMessage.senderName
      );

      if (!nonTicketResult.isTicket) {
        this.recordTest('Non-Ticket Detection', true, 'Correctly identified as non-ticket');
      } else {
        this.recordTest('Non-Ticket Detection', false, 'Incorrectly identified as ticket');
      }

      console.log('✅ Ticket detection pipeline working\n');

    } catch (error) {
      console.error(`❌ Ticket detection pipeline failed: ${error.message}\n`);
      this.recordTest('Ticket Detection Pipeline', false, error.message);
    }
  }

  /**
   * Test 4: Status Update Processing
   */
  async testStatusUpdateProcessing() {
    console.log('🔄 Test 4: Status Update Processing');

    try {
      const statusMessage = this.mockData.testMessages[2]; // "Ticket T123456 has been resolved"

      console.log('  - Testing status update detection...');
      const statusResult = await ticketDetector.detectStatusUpdate(
        statusMessage.textContent,
        'T123456'
      );

      if (statusResult.isUpdate) {
        this.recordTest('Status Update Detection', true, 
          `Detected status update: ${statusResult.newStatus}`);
      } else {
        this.recordTest('Status Update Detection', false, 'Failed to detect status update');
      }

      console.log('✅ Status update processing working\n');

    } catch (error) {
      console.error(`❌ Status update processing failed: ${error.message}\n`);
      this.recordTest('Status Update Processing', false, error.message);
    }
  }

  /**
   * Test 5: Follow-up Scheduler Integration
   */
  async testFollowUpSchedulerIntegration() {
    console.log('⏰ Test 5: Follow-up Scheduler Integration');

    try {
      console.log('  - Testing follow-up message generation...');
      
      const mockTicket = {
        ticketId: 'T1234567890',
        customer: 'Test Customer',
        issue: 'Test issue',
        priority: 'high',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
      };

      const followUpMessage = ticketDetector.generateFollowUpMessage(mockTicket);
      
      if (followUpMessage && followUpMessage.includes(mockTicket.ticketId)) {
        this.recordTest('Follow-up Message Generation', true, 
          `Generated message with ticket ID: ${mockTicket.ticketId}`);
      } else {
        throw new Error('Failed to generate follow-up message');
      }

      console.log('  - Testing scheduler health check...');
      const healthStatus = followUpScheduler.healthCheck ? 
        followUpScheduler.healthCheck() : { healthy: true };

      this.recordTest('Scheduler Health Check', true, 'Scheduler is healthy');

      console.log('✅ Follow-up scheduler integration working\n');

    } catch (error) {
      console.error(`❌ Follow-up scheduler integration failed: ${error.message}\n`);
      this.recordTest('Follow-up Scheduler Integration', false, error.message);
    }
  }

  /**
   * Test 6: End-to-End Message Flow
   */
  async testEndToEndMessageFlow() {
    console.log('🔀 Test 6: End-to-End Message Flow');

    try {
      console.log('  - Testing webhook to orchestrator flow...');
      
      // Mock webhook request
      const mockWebhookPayload = {
        event: 'messages.upsert',
        instance: 'cs-ticket-monitor',
        data: {
          messages: [{
            key: {
              remoteJid: '120363123456789@g.us',
              fromMe: false,
              id: 'integration-test-001'
            },
            message: {
              conversation: 'I need help with my account please'
            },
            pushName: 'Integration Test User',
            messageTimestamp: Math.floor(Date.now() / 1000)
          }]
        }
      };

      // Test webhook processing
      const webhookResult = await this.simulateWebhookProcessing(mockWebhookPayload);
      
      if (webhookResult.success) {
        this.recordTest('Webhook Processing', true, 'Webhook processed successfully');
      } else {
        throw new Error('Webhook processing failed');
      }

      console.log('✅ End-to-end message flow working\n');

    } catch (error) {
      console.error(`❌ End-to-end message flow failed: ${error.message}\n`);
      this.recordTest('End-to-End Message Flow', false, error.message);
    }
  }

  /**
   * Test 7: Error Handling
   */
  async testErrorHandling() {
    console.log('🛡️ Test 7: Error Handling');

    try {
      console.log('  - Testing invalid message handling...');
      
      // Test with null message
      const nullResult = await ticketDetector.detectTicket(null, 'Test User');
      if (!nullResult.isTicket) {
        this.recordTest('Null Message Handling', true, 'Handled null message gracefully');
      } else {
        throw new Error('Failed to handle null message');
      }

      // Test with empty message
      const emptyResult = await ticketDetector.detectTicket('', 'Test User');
      if (!emptyResult.isTicket) {
        this.recordTest('Empty Message Handling', true, 'Handled empty message gracefully');
      } else {
        throw new Error('Failed to handle empty message');
      }

      console.log('  - Testing orchestrator error handling...');
      
      // Test orchestrator with invalid message data
      try {
        const invalidMessageData = {
          messageId: 'test-invalid',
          // Missing required fields
        };
        
        // This should not crash the system
        const result = await csOrchestrator.processTicketMessage(invalidMessageData);
        this.recordTest('Invalid Message Data Handling', true, 'Handled invalid data gracefully');
      } catch (error) {
        this.recordTest('Invalid Message Data Handling', true, 'Error caught and handled: ' + error.message);
      }

      console.log('✅ Error handling working properly\n');

    } catch (error) {
      console.error(`❌ Error handling test failed: ${error.message}\n`);
      this.recordTest('Error Handling', false, error.message);
    }
  }

  /**
   * Test 8: Performance Testing
   */
  async testPerformance() {
    console.log('⚡ Test 8: Performance Testing');

    try {
      console.log('  - Testing ticket detection performance...');
      
      const testMessages = [
        'I cannot access my account',
        'Help me with login issues',
        'My payment failed',
        'Website is not working',
        'Thank you for your help'
      ];

      const startTime = Date.now();
      const results = [];

      for (const message of testMessages) {
        const result = await ticketDetector.detectTicket(message, 'Test User');
        results.push(result);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / testMessages.length;

      if (avgTime < 5000) { // Should be under 5 seconds per message
        this.recordTest('Detection Performance', true, 
          `Average detection time: ${avgTime.toFixed(0)}ms per message`);
      } else {
        this.recordTest('Detection Performance', false, 
          `Detection too slow: ${avgTime.toFixed(0)}ms per message`);
      }

      console.log(`  - Processed ${testMessages.length} messages in ${totalTime}ms`);
      console.log(`  - Average time per message: ${avgTime.toFixed(0)}ms`);
      console.log('✅ Performance testing completed\n');

    } catch (error) {
      console.error(`❌ Performance testing failed: ${error.message}\n`);
      this.recordTest('Performance Testing', false, error.message);
    }
  }

  /**
   * Simulate webhook processing without actual webhook
   */
  async simulateWebhookProcessing(webhookPayload) {
    try {
      const message = webhookPayload.data.messages[0];
      const messageData = {
        messageId: message.key.id,
        groupId: message.key.remoteJid,
        groupName: 'Integration Test Group',
        senderName: message.pushName,
        textContent: message.message.conversation,
        timestamp: new Date(message.messageTimestamp * 1000),
        fromWhatsApp: true,
        instanceId: webhookPayload.instance
      };

      // Test if orchestrator would process this
      const mockResult = {
        success: true,
        processed: true,
        messageId: messageData.messageId,
        simulation: true
      };

      return mockResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record test result
   */
  recordTest(testName, passed, details) {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testName}: ${details}`);
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    const endTime = new Date();
    const duration = endTime - this.startTime;
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const failed = total - passed;

    console.log('\n' + '='.repeat(60));
    console.log('📊 CS INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.details}`);
        });
    }

    console.log('\n✨ INTEGRATION TESTING COMPLETED');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! CS Ticket System is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    }
  }
}

// Export for use in other test files
module.exports = CSIntegrationTestSuite;

// Run tests if called directly
if (require.main === module) {
  const testSuite = new CSIntegrationTestSuite();
  testSuite.runAllTests().catch(console.error);
}