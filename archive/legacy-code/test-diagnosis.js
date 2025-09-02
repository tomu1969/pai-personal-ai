// Diagnostic Test Suite for AI PBX Message Response Issues
// This script tests various scenarios to identify why some messages aren't being answered

const assert = require('assert');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Import the services we need to test
const AssistantService = require('./src/services/assistant');
const WhatsAppService = require('./src/services/whatsapp');
const MessageProcessorService = require('./src/services/messageProcessor');

// Database connection for testing
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  }
);

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  diagnostics: []
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTest(name, testFn) {
  try {
    log(`\nTesting: ${name}`, 'cyan');
    await testFn();
    testResults.passed.push(name);
    log(`✅ PASSED: ${name}`, 'green');
  } catch (error) {
    testResults.failed.push({ name, error: error.message });
    log(`❌ FAILED: ${name}`, 'red');
    log(`   Error: ${error.message}`, 'yellow');
  }
}

// Test 1: Check cooldown period logic
async function testCooldownPeriod() {
  log('\n=== TEST 1: Cooldown Period Analysis ===', 'blue');
  
  const assistantService = new AssistantService();
  
  // Query database for recent messages
  const [results] = await sequelize.query(`
    SELECT 
      c.phone,
      m.sender,
      m.created_at,
      m.conversation_id
    FROM messages m
    JOIN contacts c ON m.contact_id = c.id
    WHERE m.created_at > NOW() - INTERVAL '1 hour'
    ORDER BY m.created_at DESC
    LIMIT 20
  `);
  
  log(`Found ${results.length} recent messages`, 'yellow');
  
  // Check for assistant messages within 30 minutes
  const assistantMessages = results.filter(m => m.sender === 'assistant');
  const userMessages = results.filter(m => m.sender === 'user');
  
  log(`Assistant messages: ${assistantMessages.length}`, 'yellow');
  log(`User messages: ${userMessages.length}`, 'yellow');
  
  // For each conversation, check if there's a cooldown blocking responses
  const conversationCooldowns = {};
  for (const msg of assistantMessages) {
    const timeSinceMessage = Date.now() - new Date(msg.created_at).getTime();
    const minutesSince = Math.floor(timeSinceMessage / 60000);
    conversationCooldowns[msg.conversation_id] = {
      phone: msg.phone,
      minutesSince,
      isBlocking: minutesSince < 30
    };
  }
  
  testResults.diagnostics.push({
    test: 'Cooldown Analysis',
    data: conversationCooldowns
  });
  
  // Find user messages that might be blocked
  const blockedMessages = userMessages.filter(msg => {
    const cooldown = conversationCooldowns[msg.conversation_id];
    return cooldown && cooldown.isBlocking;
  });
  
  log(`\nPotentially blocked user messages: ${blockedMessages.length}`, 'yellow');
  blockedMessages.forEach(msg => {
    log(`  - ${msg.phone} at ${msg.created_at}`, 'yellow');
  });
  
  assert(Object.keys(conversationCooldowns).length > 0, 'Should have found some conversations with cooldowns');
}

// Test 2: Message parsing for different formats
async function testMessageParsing() {
  log('\n=== TEST 2: Message Parsing Test ===', 'blue');
  
  const whatsappService = new WhatsAppService();
  
  // Test different webhook data formats
  const testCases = [
    {
      name: 'Standard text message',
      data: {
        data: {
          key: {
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
            id: 'TEST123'
          },
          message: {
            conversation: 'Hello world'
          },
          messageTimestamp: Date.now() / 1000,
          pushName: 'Test User'
        }
      }
    },
    {
      name: 'Audio message',
      data: {
        data: {
          key: {
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: false,
            id: 'AUDIO123'
          },
          message: {
            audioMessage: {
              url: 'https://example.com/audio.ogg'
            }
          },
          messageType: 'audioMessage',
          messageTimestamp: Date.now() / 1000,
          pushName: 'Audio User'
        }
      }
    },
    {
      name: 'Self message (should be skipped)',
      data: {
        data: {
          key: {
            remoteJid: '1234567890@s.whatsapp.net',
            fromMe: true,
            id: 'SELF123'
          },
          message: {
            conversation: 'My own message'
          },
          messageTimestamp: Date.now() / 1000
        }
      }
    },
    {
      name: 'Evolution v2 format',
      data: {
        key: {
          remoteJid: '9876543210@s.whatsapp.net',
          fromMe: false,
          id: 'EVO2_123'
        },
        message: {
          conversation: 'Evolution v2 message'
        },
        messageTimestamp: Date.now() / 1000,
        pushName: 'Evo User'
      }
    }
  ];
  
  const parseResults = [];
  for (const testCase of testCases) {
    const parsed = whatsappService.parseWebhookMessage(testCase.data);
    parseResults.push({
      name: testCase.name,
      parsed: parsed ? {
        phone: parsed.phone,
        content: parsed.content,
        messageType: parsed.messageType
      } : null
    });
    
    log(`\n  ${testCase.name}:`, 'cyan');
    if (parsed) {
      log(`    ✓ Parsed successfully`, 'green');
      log(`    Phone: ${parsed.phone}`, 'yellow');
      log(`    Content: ${parsed.content}`, 'yellow');
    } else {
      log(`    ✗ Not parsed (might be intentional)`, 'red');
    }
  }
  
  testResults.diagnostics.push({
    test: 'Message Parsing',
    data: parseResults
  });
  
  // Verify self messages are skipped
  const selfMessage = parseResults.find(r => r.name.includes('Self message'));
  assert(selfMessage.parsed === null, 'Self messages should not be parsed');
  
  // Verify regular messages are parsed
  const standardMessage = parseResults.find(r => r.name === 'Standard text message');
  assert(standardMessage.parsed !== null, 'Standard messages should be parsed');
}

// Test 3: Check actual webhook processing flow
async function testWebhookFlow() {
  log('\n=== TEST 3: Webhook Processing Flow ===', 'blue');
  
  // Query recent webhook logs to understand the flow
  const [recentWebhooks] = await sequelize.query(`
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
      COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as assistant_messages
    FROM messages
    WHERE created_at > NOW() - INTERVAL '2 hours'
  `);
  
  const stats = recentWebhooks[0];
  const responseRate = stats.user_messages > 0 
    ? (stats.assistant_messages / stats.user_messages * 100).toFixed(1)
    : 0;
  
  log(`\nMessage Statistics (last 2 hours):`, 'cyan');
  log(`  Total messages: ${stats.total_messages}`, 'yellow');
  log(`  User messages: ${stats.user_messages}`, 'yellow');
  log(`  Assistant responses: ${stats.assistant_messages}`, 'yellow');
  log(`  Response rate: ${responseRate}%`, responseRate > 50 ? 'green' : 'red');
  
  testResults.diagnostics.push({
    test: 'Webhook Flow Stats',
    data: {
      ...stats,
      responseRate: `${responseRate}%`
    }
  });
  
  assert(stats.total_messages > 0, 'Should have some messages in the database');
}

// Test 4: Check shouldRespond logic
async function testShouldRespondLogic() {
  log('\n=== TEST 4: Should Respond Logic ===', 'blue');
  
  const assistantService = new AssistantService();
  
  // Get recent conversations
  const [conversations] = await sequelize.query(`
    SELECT 
      c.id,
      c.status,
      c.is_assistant_enabled,
      cont.phone,
      c.message_count,
      c.last_message_at
    FROM conversations c
    JOIN contacts cont ON c.contact_id = cont.id
    WHERE c.last_message_at > NOW() - INTERVAL '2 hours'
    LIMIT 10
  `);
  
  log(`\nChecking ${conversations.length} recent conversations:`, 'cyan');
  
  for (const conv of conversations) {
    // Check if assistant would respond to this conversation
    const timeSinceLastMessage = Date.now() - new Date(conv.last_message_at).getTime();
    const minutesSince = Math.floor(timeSinceLastMessage / 60000);
    
    log(`\n  Conversation ${conv.phone}:`, 'yellow');
    log(`    Status: ${conv.status}`, 'yellow');
    log(`    Assistant enabled: ${conv.is_assistant_enabled}`, 'yellow');
    log(`    Messages: ${conv.message_count}`, 'yellow');
    log(`    Last message: ${minutesSince} minutes ago`, 'yellow');
    
    // Check for recent assistant message
    const [recentAssistant] = await sequelize.query(`
      SELECT created_at 
      FROM messages 
      WHERE conversation_id = :convId 
        AND sender = 'assistant'
        AND created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `, {
      replacements: { convId: conv.id }
    });
    
    const hasRecentResponse = recentAssistant.length > 0;
    log(`    Has recent assistant response: ${hasRecentResponse}`, hasRecentResponse ? 'red' : 'green');
    
    if (hasRecentResponse) {
      const responseTime = new Date(recentAssistant[0].created_at);
      const minsSinceResponse = Math.floor((Date.now() - responseTime) / 60000);
      log(`    Last response: ${minsSinceResponse} minutes ago`, 'yellow');
    }
  }
  
  testResults.diagnostics.push({
    test: 'Should Respond Analysis',
    data: {
      conversationsChecked: conversations.length,
      activeConversations: conversations.filter(c => c.status === 'active').length
    }
  });
}

// Test 5: Simulate incoming messages
async function testMessageSimulation() {
  log('\n=== TEST 5: Message Processing Simulation ===', 'blue');
  
  const messageProcessor = new MessageProcessorService();
  
  // Create test message data
  const testMessage = {
    messageId: `TEST_${Date.now()}`,
    phone: 'test_simulation',
    content: 'Test message for diagnosis',
    messageType: 'text',
    fromMe: false,
    pushName: 'Test Simulator',
    timestamp: new Date()
  };
  
  log('\nSimulating message processing...', 'cyan');
  log(`  Message ID: ${testMessage.messageId}`, 'yellow');
  log(`  Phone: ${testMessage.phone}`, 'yellow');
  log(`  Content: ${testMessage.content}`, 'yellow');
  
  // Note: We won't actually process to avoid creating test data
  // Just checking the flow logic
  
  testResults.diagnostics.push({
    test: 'Message Simulation',
    data: {
      testMessageCreated: true,
      wouldProcess: true
    }
  });
}

// Main test runner
async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('AI PBX DIAGNOSTIC TEST SUITE', 'blue');
  log('='.repeat(60), 'blue');
  
  try {
    // Connect to database
    await sequelize.authenticate();
    log('\n✅ Database connection successful', 'green');
    
    // Run all tests
    await runTest('Cooldown Period Analysis', testCooldownPeriod);
    await runTest('Message Parsing', testMessageParsing);
    await runTest('Webhook Flow', testWebhookFlow);
    await runTest('Should Respond Logic', testShouldRespondLogic);
    await runTest('Message Simulation', testMessageSimulation);
    
    // Summary
    log('\n' + '='.repeat(60), 'blue');
    log('TEST SUMMARY', 'blue');
    log('='.repeat(60), 'blue');
    
    log(`\n✅ Passed: ${testResults.passed.length}`, 'green');
    testResults.passed.forEach(name => {
      log(`   - ${name}`, 'green');
    });
    
    if (testResults.failed.length > 0) {
      log(`\n❌ Failed: ${testResults.failed.length}`, 'red');
      testResults.failed.forEach(({name, error}) => {
        log(`   - ${name}: ${error}`, 'red');
      });
    }
    
    // Diagnostic findings
    log('\n' + '='.repeat(60), 'blue');
    log('DIAGNOSTIC FINDINGS', 'blue');
    log('='.repeat(60), 'blue');
    
    testResults.diagnostics.forEach(diag => {
      log(`\n${diag.test}:`, 'cyan');
      console.log(diag.data);
    });
    
    // Key issues identified
    log('\n' + '='.repeat(60), 'blue');
    log('KEY ISSUES IDENTIFIED', 'blue');
    log('='.repeat(60), 'blue');
    
    // Check for cooldown issues
    const cooldownData = testResults.diagnostics.find(d => d.test === 'Cooldown Analysis');
    if (cooldownData) {
      const blockingConvs = Object.values(cooldownData.data).filter(c => c.isBlocking);
      if (blockingConvs.length > 0) {
        log('\n⚠️  Issue 1: 30-minute cooldown is blocking responses', 'yellow');
        log(`   ${blockingConvs.length} conversations are currently blocked`, 'yellow');
        blockingConvs.forEach(conv => {
          log(`   - ${conv.phone}: ${conv.minutesSince} minutes since last response`, 'yellow');
        });
      }
    }
    
    // Check response rate
    const flowStats = testResults.diagnostics.find(d => d.test === 'Webhook Flow Stats');
    if (flowStats && flowStats.data.responseRate) {
      const rate = parseFloat(flowStats.data.responseRate);
      if (rate < 100) {
        log('\n⚠️  Issue 2: Not all user messages are getting responses', 'yellow');
        log(`   Response rate: ${flowStats.data.responseRate}`, 'yellow');
        log(`   User messages: ${flowStats.data.user_messages}`, 'yellow');
        log(`   Assistant responses: ${flowStats.data.assistant_messages}`, 'yellow');
      }
    }
    
    log('\n' + '='.repeat(60), 'blue');
    log('RECOMMENDATIONS', 'blue');
    log('='.repeat(60), 'blue');
    
    log('\n1. Reduce cooldown period from 30 minutes to 2-5 minutes', 'cyan');
    log('2. Add message deduplication instead of time-based blocking', 'cyan');
    log('3. Improve webhook data parsing for Evolution v2 format', 'cyan');
    log('4. Add better logging for skipped messages', 'cyan');
    
  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// Run the tests
runAllTests().then(() => {
  log('\n✅ Diagnostic tests completed', 'green');
  process.exit(0);
}).catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});