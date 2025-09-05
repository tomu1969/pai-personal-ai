#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PaiResponderAdapter = require('../src/services/paiResponderAdapter');
const logger = require('../src/utils/logger');

async function testPaiResponder() {
  console.log('\n=== PAI Responder Test ===\n');

  try {
    // Test initialization
    console.log('1. Testing initialization...');
    await PaiResponderAdapter.initialize();
    console.log('✓ PAI Responder initialized successfully');

    // Test configuration
    console.log('\n2. Testing configuration...');
    const status = await PaiResponderAdapter.getStatus();
    console.log('✓ Configuration loaded:', {
      enabled: status.enabled,
      assistantName: status.assistantName,
      ownerName: status.ownerName,
    });

    // Test enabled check
    console.log('\n3. Testing enabled check...');
    const isEnabled = await PaiResponderAdapter.isEnabled();
    console.log('✓ Enabled status:', isEnabled);

    if (isEnabled) {
      // Test message processing
      console.log('\n4. Testing message processing...');
      const testMessage = "Hello, I need help with something";
      const testPhone = "+1234567890";
      const testSender = { pushName: "Test User" };

      const response = await PaiResponderAdapter.processMessage(
        testMessage,
        testPhone,
        status,
        testSender
      );

      if (response && response.success) {
        console.log('✓ Message processed successfully');
        console.log('Response:', response.response.substring(0, 100) + '...');
        console.log('Tokens used:', response.tokensUsed);
        console.log('Assistant type:', response.assistantType);
      } else if (response && !response.success) {
        console.log('✗ Message processing failed:', response.error);
      } else {
        console.log('○ No response (responder may be disabled)');
      }

      // Test conversation history
      console.log('\n5. Testing conversation history...');
      const response2 = await PaiResponderAdapter.processMessage(
        "Can you tell me more about that?",
        testPhone,
        status,
        testSender
      );

      if (response2 && response2.success) {
        console.log('✓ Follow-up message processed');
        console.log('Response:', response2.response.substring(0, 100) + '...');
      }

      // Clear conversation history for cleanup
      console.log('\n6. Cleaning up...');
      PaiResponderAdapter.clearConversationHistory(testPhone);
      console.log('✓ Conversation history cleared');

    } else {
      console.log('○ PAI Responder is disabled, skipping message tests');
    }

    console.log('\n=== PAI Responder Test Completed Successfully ===\n');

  } catch (error) {
    console.error('\n✗ PAI Responder Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPaiResponder().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = testPaiResponder;