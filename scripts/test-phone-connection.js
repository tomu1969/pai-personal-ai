#!/usr/bin/env node

const axios = require('axios');
const config = require('../src/config');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'ai-pbx-evolution-key-2024';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_ID || 'ai-pbx-instance';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create Evolution API client
const evolutionAPI = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

async function testEvolutionAPIConnection() {
  try {
    log('🔍 Testing Evolution API connection...', 'yellow');
    const response = await evolutionAPI.get('/');
    log('✅ Evolution API is accessible', 'green');
    return true;
  } catch (error) {
    log(`❌ Evolution API connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function createInstance() {
  try {
    log(`🔄 Creating WhatsApp instance: ${INSTANCE_NAME}...`, 'yellow');
    
    const payload = {
      instanceName: INSTANCE_NAME,
      token: EVOLUTION_API_KEY,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhookUrl: `http://localhost:3000/webhook`,
      webhookEvents: ['APPLICATION_STARTUP', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      reject_call: true,
      msg_call: 'This number is for text messages only. Please send a message instead.',
      groups_ignore: true,
      always_online: false,
      read_messages: false,
      read_status: false,
      sync_full_history: false
    };

    const response = await evolutionAPI.post('/instance/create', payload);
    
    log('✅ WhatsApp instance created successfully!', 'green');
    log(`📱 Instance ID: ${response.data.instance?.instanceName}`, 'blue');
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      log('⚠️  Instance already exists, continuing...', 'yellow');
      return { instance: { instanceName: INSTANCE_NAME } };
    }
    log(`❌ Failed to create instance: ${error.message}`, 'red');
    throw error;
  }
}

async function getQRCode() {
  try {
    log('📱 Getting QR Code for WhatsApp connection...', 'yellow');
    
    const response = await evolutionAPI.get(`/instance/connect/${INSTANCE_NAME}`);
    
    if (response.data.base64) {
      log('✅ QR Code generated!', 'green');
      log('📱 Open WhatsApp on your phone:', 'blue');
      log('   1. Tap Menu (3 dots) > Linked Devices', 'blue');
      log('   2. Tap "Link a Device"', 'blue');
      log('   3. Scan the QR code at: http://localhost:8080/instance/connect/' + INSTANCE_NAME, 'blue');
      log('', 'reset');
      log('🌐 Or open this URL in your browser:', 'yellow');
      log(`   http://localhost:8080/instance/connect/${INSTANCE_NAME}`, 'bold');
      
      return response.data;
    } else {
      log('⚠️  No QR code available. Instance might already be connected.', 'yellow');
      return null;
    }
  } catch (error) {
    log(`❌ Failed to get QR code: ${error.message}`, 'red');
    throw error;
  }
}

async function checkInstanceStatus() {
  try {
    log('🔍 Checking instance connection status...', 'yellow');
    
    const response = await evolutionAPI.get(`/instance/connectionState/${INSTANCE_NAME}`);
    const status = response.data.instance;
    
    log(`📊 Instance Status:`, 'blue');
    log(`   State: ${status.state}`, 'blue');
    log(`   Instance: ${status.instanceName}`, 'blue');
    
    if (status.state === 'open') {
      log('✅ WhatsApp is connected and ready!', 'green');
      return true;
    } else {
      log('⏳ WhatsApp is not yet connected. Please scan the QR code.', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Failed to check instance status: ${error.message}`, 'red');
    return false;
  }
}

async function testWebhook() {
  try {
    log('🔄 Testing webhook configuration...', 'yellow');
    
    const response = await evolutionAPI.get(`/webhook/find/${INSTANCE_NAME}`);
    const webhook = response.data;
    
    if (webhook.webhook) {
      log('✅ Webhook configured:', 'green');
      log(`   URL: ${webhook.webhook.url}`, 'blue');
      log(`   Events: ${webhook.webhook.events?.join(', ')}`, 'blue');
    } else {
      log('⚠️  No webhook configured', 'yellow');
    }
    
    return webhook;
  } catch (error) {
    log(`❌ Failed to check webhook: ${error.message}`, 'red');
    return null;
  }
}

async function testAIPBXConnection() {
  try {
    log('🔍 Testing AI PBX connection...', 'yellow');
    const response = await axios.get('http://localhost:3000/health');
    log('✅ AI PBX is running and healthy', 'green');
    
    // Test assistant status
    const statusResponse = await axios.get('http://localhost:3000/api/assistant/status');
    log('📊 Assistant Status:', 'blue');
    log(`   Enabled: ${statusResponse.data.enabled}`, 'blue');
    log(`   Messages Processed: ${statusResponse.data.messagesProcessed}`, 'blue');
    
    return true;
  } catch (error) {
    log(`❌ AI PBX connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function sendTestMessage(phoneNumber) {
  try {
    log(`📤 Sending test message to ${phoneNumber}...`, 'yellow');
    
    const payload = {
      number: phoneNumber,
      textMessage: {
        text: '🤖 Test message from AI PBX! Your assistant is working correctly.'
      }
    };

    const response = await evolutionAPI.post(`/message/sendText/${INSTANCE_NAME}`, payload);
    
    if (response.data.key?.id) {
      log('✅ Test message sent successfully!', 'green');
      log(`   Message ID: ${response.data.key.id}`, 'blue');
      return response.data;
    } else {
      log('⚠️  Message may not have been sent properly', 'yellow');
      return response.data;
    }
  } catch (error) {
    log(`❌ Failed to send test message: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  log('🚀 AI PBX Phone Connection Test', 'bold');
  log('===================================', 'blue');
  
  try {
    // Test Evolution API
    if (!await testEvolutionAPIConnection()) {
      process.exit(1);
    }

    // Test AI PBX
    if (!await testAIPBXConnection()) {
      process.exit(1);
    }

    // Create instance
    await createInstance();

    // Get QR Code
    await getQRCode();

    // Check webhook
    await testWebhook();

    log('', 'reset');
    log('🎯 Connection Setup Complete!', 'green');
    log('', 'reset');
    log('📱 Next Steps:', 'yellow');
    log('1. Scan the QR code to connect your WhatsApp', 'blue');
    log('2. Once connected, send a message to your WhatsApp number', 'blue');
    log('3. The AI assistant should automatically respond', 'blue');
    log('4. Check logs in the AI PBX console for message processing', 'blue');
    log('', 'reset');
    log('🔧 Useful Commands:', 'yellow');
    log('   Check status: node scripts/test-phone-connection.js --status', 'blue');
    log('   Send test: node scripts/test-phone-connection.js --test +1234567890', 'blue');

    // Handle command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--status')) {
      await checkInstanceStatus();
    }
    
    const testIndex = args.indexOf('--test');
    if (testIndex !== -1 && args[testIndex + 1]) {
      const phoneNumber = args[testIndex + 1];
      await sendTestMessage(phoneNumber);
    }

  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}