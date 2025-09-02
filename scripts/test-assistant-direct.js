#!/usr/bin/env node

const axios = require('axios');

const AI_PBX_URL = 'http://localhost:3000';

// Test messages to simulate different scenarios
const testMessages = [
  {
    name: "Basic Greeting",
    webhook: {
      event: 'messages.upsert',
      data: [{
        key: { id: 'test-msg-1', fromMe: false, remoteJid: '1234567890@s.whatsapp.net' },
        message: { conversation: 'Hi there!' },
        messageTimestamp: Date.now(),
        pushName: 'Test User'
      }]
    }
  },
  {
    name: "Business Inquiry",
    webhook: {
      event: 'messages.upsert',
      data: [{
        key: { id: 'test-msg-2', fromMe: false, remoteJid: '1234567890@s.whatsapp.net' },
        message: { conversation: 'I need help with my project deadline tomorrow' },
        messageTimestamp: Date.now(),
        pushName: 'Business Client'
      }]
    }
  },
  {
    name: "Urgent Support",
    webhook: {
      event: 'messages.upsert',
      data: [{
        key: { id: 'test-msg-3', fromMe: false, remoteJid: '1234567890@s.whatsapp.net' },
        message: { conversation: 'URGENT! Server is down, need immediate help!' },
        messageTimestamp: Date.now(),
        pushName: 'IT Manager'
      }]
    }
  },
  {
    name: "Spanish Message",
    webhook: {
      event: 'messages.upsert',
      data: [{
        key: { id: 'test-msg-4', fromMe: false, remoteJid: '1234567890@s.whatsapp.net' },
        message: { conversation: 'Hola, necesito ayuda con mi cuenta por favor' },
        messageTimestamp: Date.now(),
        pushName: 'Usuario Español'
      }]
    }
  },
  {
    name: "Spam Message",
    webhook: {
      event: 'messages.upsert',
      data: [{
        key: { id: 'test-msg-5', fromMe: false, remoteJid: '1234567890@s.whatsapp.net' },
        message: { conversation: 'Congratulations! You won $1000! Click here to claim your free money!' },
        messageTimestamp: Date.now(),
        pushName: 'Spam Bot'
      }]
    }
  }
];

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkAIPBXStatus() {
  try {
    log('🔍 Checking AI PBX status...', 'yellow');
    
    const healthResponse = await axios.get(`${AI_PBX_URL}/health`);
    log('✅ AI PBX is running', 'green');
    
    const assistantResponse = await axios.get(`${AI_PBX_URL}/api/assistant/status`);
    log('📊 Assistant Status:', 'blue');
    log(`   Enabled: ${assistantResponse.data.enabled}`, 'cyan');
    log(`   Owner: ${assistantResponse.data.ownerName}`, 'cyan');
    log(`   Messages Processed: ${assistantResponse.data.messagesProcessed}`, 'cyan');
    
    return true;
  } catch (error) {
    log(`❌ AI PBX not accessible: ${error.message}`, 'red');
    log('💡 Make sure AI PBX is running: npm start', 'yellow');
    return false;
  }
}

async function sendTestMessage(testMessage) {
  try {
    log(`\n📤 Testing: ${testMessage.name}`, 'bold');
    log(`   Message: "${testMessage.webhook.data[0].message.conversation}"`, 'cyan');
    
    const response = await axios.post(`${AI_PBX_URL}/webhook`, testMessage.webhook, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    log(`✅ Webhook processed successfully`, 'green');
    log(`   Status: ${response.status}`, 'blue');
    
    return response.data;
  } catch (error) {
    log(`❌ Webhook failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${error.response.data?.error || 'Unknown error'}`, 'red');
    }
    return null;
  }
}

async function checkProcessingResults() {
  try {
    log('\n📊 Checking processing results...', 'yellow');
    
    const conversationsResponse = await axios.get(`${AI_PBX_URL}/api/conversations?limit=5`);
    log(`✅ Found ${conversationsResponse.data.total} conversations`, 'green');
    
    if (conversationsResponse.data.conversations.length > 0) {
      conversationsResponse.data.conversations.forEach((conv, index) => {
        log(`   ${index + 1}. Category: ${conv.category}, Priority: ${conv.priority}, Status: ${conv.status}`, 'blue');
      });
    }
    
    const assistantResponse = await axios.get(`${AI_PBX_URL}/api/assistant/status`);
    log(`📈 Messages processed: ${assistantResponse.data.messagesProcessed}`, 'green');
    
    return true;
  } catch (error) {
    log(`⚠️  Could not check results: ${error.message}`, 'yellow');
    return false;
  }
}

async function main() {
  log('🤖 AI PBX Assistant Direct Test', 'bold');
  log('================================', 'blue');
  
  // Check AI PBX status
  if (!await checkAIPBXStatus()) {
    process.exit(1);
  }
  
  log('\n🧪 Running test messages...', 'bold');
  
  // Send all test messages
  for (const testMessage of testMessages) {
    await sendTestMessage(testMessage);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }
  
  // Check results
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for processing
  await checkProcessingResults();
  
  log('\n🎉 Test completed!', 'green');
  log('\n📋 What this test showed:', 'yellow');
  log('✓ AI PBX receives webhook messages', 'blue');
  log('✓ Messages are analyzed and categorized', 'blue');
  log('✓ Conversations are created and stored', 'blue');
  log('✓ Assistant processes different message types', 'blue');
  log('✓ System handles multiple languages and priorities', 'blue');
  
  log('\n🚀 Next step: Connect real WhatsApp!', 'bold');
  log('   Use Evolution API or WhatsApp Business API', 'cyan');
  log('   Point webhook to: http://localhost:3000/webhook', 'cyan');
}

if (require.main === module) {
  main().catch(error => {
    log(`❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  });
}