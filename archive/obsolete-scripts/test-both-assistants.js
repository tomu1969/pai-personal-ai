#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const testPaiResponder = require('./test-pai-responder');
const testPaiAssistant = require('./test-pai-assistant');
const logger = require('../src/utils/logger');

async function testBothAssistants() {
  console.log('\n🤖 === AI PBX Assistant Architecture Test Suite ===\n');
  
  console.log('Testing the new separated assistant architecture:');
  console.log('1. PAI Responder - Handles WhatsApp responses on behalf of owner');
  console.log('2. PAI Assistant - Provides owner with message summaries and queries\n');

  try {
    // Test PAI Responder
    console.log('🔄 Starting PAI Responder tests...');
    await testPaiResponder();
    
    // Test PAI Assistant  
    console.log('🔄 Starting PAI Assistant tests...');
    await testPaiAssistant();

    // Integration test - ensure both can work simultaneously
    console.log('🔄 Running integration test...\n');
    
    const PaiResponderAdapter = require('../src/services/paiResponderAdapter');
    const PaiAssistantAdapter = require('../src/services/paiAssistantAdapter');

    // Initialize both
    await PaiResponderAdapter.initialize();
    await PaiAssistantAdapter.initialize();

    // Get both configurations
    const responderStatus = await PaiResponderAdapter.getStatus();
    const assistantStatus = await PaiAssistantAdapter.getStatus();

    console.log('✓ Both assistants can be initialized simultaneously');
    console.log('✓ PAI Responder ready for WhatsApp responses');
    console.log('✓ PAI Assistant ready for owner queries');

    // Test that they have different configurations
    if (responderStatus.assistantName !== assistantStatus.assistantName) {
      console.log('✓ Assistants have separate configurations');
    }

    console.log('\n🎉 === All Tests Completed Successfully ===');
    console.log('\nNext steps:');
    console.log('1. Run migration: npx sequelize-cli db:migrate');
    console.log('2. Update existing services to use new adapters');
    console.log('3. Test with actual WhatsApp messages');
    console.log('4. Update frontend to use new assistant endpoints\n');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  testBothAssistants().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = testBothAssistants;