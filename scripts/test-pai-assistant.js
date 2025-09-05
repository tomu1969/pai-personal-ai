#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PaiAssistantAdapter = require('../src/services/paiAssistantAdapter');
const logger = require('../src/utils/logger');

async function testPaiAssistant() {
  console.log('\n=== PAI Assistant Test ===\n');

  try {
    // Test initialization
    console.log('1. Testing initialization...');
    await PaiAssistantAdapter.initialize();
    console.log('✓ PAI Assistant initialized successfully');

    // Test configuration
    console.log('\n2. Testing configuration...');
    const status = await PaiAssistantAdapter.getStatus();
    console.log('✓ Configuration loaded:', {
      enabled: status.enabled,
      assistantName: status.assistantName,
      ownerName: status.ownerName,
      queriesProcessed: status.queriesProcessed,
    });

    // Test enabled check
    console.log('\n3. Testing enabled check...');
    const isEnabled = await PaiAssistantAdapter.isEnabled();
    console.log('✓ Enabled status:', isEnabled);

    if (isEnabled) {
      // Test intent parsing
      console.log('\n4. Testing intent parsing...');
      const testQuery = "what messages have I received today";
      
      const intentResult = await PaiAssistantAdapter.parseIntent(testQuery, {
        conversationId: '00000000-0000-0000-0000-000000000001',
      });

      if (intentResult.success) {
        console.log('✓ Intent parsed successfully');
        console.log('Intent:', intentResult.intent);
        console.log('Entities:', JSON.stringify(intentResult.entities, null, 2));
        console.log('Confidence:', intentResult.confidence);
      } else {
        console.log('✗ Intent parsing failed:', intentResult.error);
      }

      // Test response generation
      console.log('\n5. Testing response generation...');
      const responseResult = await PaiAssistantAdapter.generateResponse(
        testQuery,
        intentResult.intent || 'message_query',
        intentResult.entities || {},
        {
          messages: [
            {
              id: 'test-1',
              content: 'Test message 1',
              createdAt: new Date(),
              contact: { name: 'Test User', phone: '+1234567890' },
            },
            {
              id: 'test-2', 
              content: 'Test message 2',
              createdAt: new Date(),
              contact: { name: 'Test User', phone: '+1234567890' },
            }
          ],
          metadata: { totalMessages: 2 }
        }
      );

      if (responseResult.success) {
        console.log('✓ Response generated successfully');
        console.log('Response:', responseResult.responseMessage.substring(0, 200) + '...');
        console.log('Tokens used:', responseResult.tokensUsed);
      } else {
        console.log('✗ Response generation failed:', responseResult.error);
      }

      // Test complete query processing
      console.log('\n6. Testing complete query processing...');
      const testQueries = [
        "what messages have I received today",
        "summarize my messages from yesterday",
        "who sent me messages in the last hour",
      ];

      for (const query of testQueries) {
        console.log(`\n   Testing: "${query}"`);
        
        // Simulate the assistant message handler
        let responseReceived = false;
        const mockBroadcastMessage = (conversationId, message) => {
          console.log(`   ✓ Response broadcasted: ${message.content.substring(0, 100)}...`);
          responseReceived = true;
        };

        const mockBroadcastTyping = (conversationId, isTyping, sender) => {
          if (isTyping) {
            console.log(`   ○ Typing indicator started...`);
          } else {
            console.log(`   ○ Typing indicator stopped`);
          }
        };

        await PaiAssistantAdapter.processAssistantMessage(
          query,
          '00000000-0000-0000-0000-000000000001',
          mockBroadcastTyping,
          mockBroadcastMessage
        );

        if (responseReceived) {
          console.log('   ✓ Query processed successfully');
        } else {
          console.log('   ○ No response received (may be normal for some queries)');
        }
      }

      // Test statistics
      console.log('\n7. Testing statistics...');
      const stats = await PaiAssistantAdapter.getStats();
      if (stats) {
        console.log('✓ Statistics retrieved:', {
          enabled: stats.enabled,
          queriesProcessed: stats.queriesProcessed,
          lastActivity: stats.lastActivity,
          assistantType: stats.assistantType,
        });
      }

    } else {
      console.log('○ PAI Assistant is disabled, skipping query tests');
    }

    console.log('\n=== PAI Assistant Test Completed Successfully ===\n');

  } catch (error) {
    console.error('\n✗ PAI Assistant Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPaiAssistant().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = testPaiAssistant;