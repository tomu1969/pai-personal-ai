#!/usr/bin/env node

/**
 * End-to-end test for PAI assistant
 * Tests the complete flow from webhook to response
 */

const axios = require('axios');
const logger = require('./src/utils/logger');
const config = require('./src/config');

// Suppress verbose logging
logger.transports.forEach(t => t.level = 'error');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Evolution API configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'ai-pbx-key-2024';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_ID || 'aipbx';

// Test phone number (this should be a valid WhatsApp number)
const TEST_PHONE = '573122663099';

async function checkEvolutionConnection() {
  console.log(`\n${colors.cyan}1️⃣  Checking Evolution API Connection${colors.reset}`);
  
  try {
    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { 'apikey': EVOLUTION_API_KEY }
      }
    );
    
    const isConnected = response.data?.instance?.state === 'open';
    
    if (isConnected) {
      console.log(`  ${colors.green}✅ WhatsApp connected${colors.reset}`);
      console.log(`  Instance: ${response.data.instance.instanceName}`);
      return true;
    } else {
      console.log(`  ${colors.red}❌ WhatsApp NOT connected${colors.reset}`);
      console.log(`  State: ${response.data?.instance?.state || 'unknown'}`);
      return false;
    }
  } catch (error) {
    console.log(`  ${colors.red}❌ Failed to connect to Evolution API${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function checkWebhookConfiguration() {
  console.log(`\n${colors.cyan}2️⃣  Checking Webhook Configuration${colors.reset}`);
  
  try {
    const response = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`,
      {
        headers: { 'apikey': EVOLUTION_API_KEY }
      }
    );
    
    const webhook = response.data;
    console.log(`  URL: ${webhook.url}`);
    console.log(`  Enabled: ${webhook.enabled ? '✅' : '❌'}`);
    console.log(`  Events by path: ${webhook.webhookByEvents ? '✅' : '❌'}`);
    console.log(`  Events: ${webhook.events?.join(', ') || 'none'}`);
    
    // Check if webhook URL is correct
    const expectedUrl = 'http://192.168.68.167:3000/webhook';
    if (webhook.url !== expectedUrl) {
      console.log(`  ${colors.yellow}⚠️  Webhook URL might be incorrect${colors.reset}`);
      console.log(`  Expected: ${expectedUrl}`);
    }
    
    return webhook.enabled;
  } catch (error) {
    console.log(`  ${colors.red}❌ Failed to get webhook config${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function testBackendHealth() {
  console.log(`\n${colors.cyan}3️⃣  Testing Backend Health${colors.reset}`);
  
  try {
    // Test API health
    const response = await axios.get('http://localhost:3000/api/health');
    console.log(`  ${colors.green}✅ Backend API is running${colors.reset}`);
    
    // Test WhatsApp status endpoint
    const statusResponse = await axios.get('http://localhost:3000/api/whatsapp/status');
    console.log(`  WhatsApp status: ${statusResponse.data.connected ? '✅ Connected' : '❌ Disconnected'}`);
    
    // Test assistant status
    const assistantResponse = await axios.get('http://localhost:3000/api/assistant/status');
    console.log(`  Assistant enabled: ${assistantResponse.data.enabled ? '✅' : '❌'}`);
    
    return true;
  } catch (error) {
    console.log(`  ${colors.red}❌ Backend health check failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function simulateWebhookMessage(messageText, phone = TEST_PHONE, senderName = 'Test User') {
  console.log(`\n${colors.cyan}4️⃣  Simulating WhatsApp Message via Webhook${colors.reset}`);
  console.log(`  From: ${senderName} (${phone})`);
  console.log(`  Message: "${messageText}"`);
  
  // Create Evolution API v2 webhook payload
  const webhookPayload = {
    event: 'messages.upsert',
    instance: EVOLUTION_INSTANCE,
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: `TEST_${Date.now()}`
      },
      pushName: senderName,
      message: {
        conversation: messageText,
        messageContextInfo: {
          messageSecret: Buffer.from(Math.random().toString()).toString('base64')
        }
      },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000),
      instanceId: '0c25df1d-4e46-4db4-9805-8b4f77bc6a99',
      source: 'web'
    },
    destination: 'http://192.168.68.167:3000/webhook',
    date_time: new Date().toISOString(),
    sender: `${phone}@s.whatsapp.net`,
    server_url: EVOLUTION_API_URL,
    apikey: EVOLUTION_API_KEY
  };

  try {
    // Send to the webhook endpoint that Evolution API v2 uses
    const response = await axios.post(
      'http://localhost:3000/webhook/messages-upsert',
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'test-signature'
        }
      }
    );
    
    console.log(`  ${colors.green}✅ Webhook accepted message${colors.reset}`);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return true;
  } catch (error) {
    console.log(`  ${colors.red}❌ Webhook failed${colors.reset}`);
    console.log(`  Error: ${error.response?.data || error.message}`);
    return false;
  }
}

async function checkMessageLogs() {
  console.log(`\n${colors.cyan}5️⃣  Checking Message Processing Logs${colors.reset}`);
  
  // Read recent logs to see if message was processed
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('tail -n 50 logs/combined.log | grep -E "Processing incoming message|PAI|assistant" | tail -n 10', (error, stdout) => {
      if (stdout) {
        console.log(`  Recent processing logs:`);
        const lines = stdout.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          if (line.includes('error') || line.includes('failed')) {
            console.log(`  ${colors.red}❌ ${line}${colors.reset}`);
          } else if (line.includes('success') || line.includes('sent')) {
            console.log(`  ${colors.green}✅ ${line}${colors.reset}`);
          } else {
            console.log(`  📝 ${line}`);
          }
        });
      } else {
        console.log(`  No recent processing logs found`);
      }
      resolve(true);
    });
  });
}

async function sendRealWhatsAppMessage() {
  console.log(`\n${colors.cyan}6️⃣  Sending Real WhatsApp Message${colors.reset}`);
  
  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: '573182601111', // Send to self to test
        text: 'Test message - PAI should respond to this'
      },
      {
        headers: { 'apikey': EVOLUTION_API_KEY }
      }
    );
    
    console.log(`  ${colors.green}✅ Message sent via Evolution API${colors.reset}`);
    console.log(`  Message ID: ${response.data?.key?.id}`);
    
    // Wait for potential response
    console.log(`  Waiting for PAI response...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error) {
    console.log(`  ${colors.red}❌ Failed to send message${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function testConversationFlow() {
  console.log(`\n${colors.cyan}7️⃣  Testing Full Conversation Flow${colors.reset}`);
  
  // Test the exact failing conversation
  console.log(`\n  ${colors.yellow}Testing problematic conversation:${colors.reset}`);
  
  // Message 1: Hola
  await simulateWebhookMessage('Hola', '573122663099', 'Personal AI');
  
  // Message 2: Necesito hablar con Tomás
  await simulateWebhookMessage('Necesito hablar con Tomás', '573122663099', 'Personal AI');
  
  return true;
}

async function runCompleteE2ETest() {
  console.log(`${colors.bright}${colors.cyan}🚀 Complete End-to-End Test for PAI Assistant${colors.reset}`);
  console.log('═'.repeat(50));
  
  const results = {
    evolutionConnected: false,
    webhookConfigured: false,
    backendHealthy: false,
    webhookWorking: false,
    messagesProcessed: false,
    realMessageSent: false,
    conversationFlowTested: false
  };
  
  // Run all tests
  results.evolutionConnected = await checkEvolutionConnection();
  results.webhookConfigured = await checkWebhookConfiguration();
  results.backendHealthy = await testBackendHealth();
  results.webhookWorking = await simulateWebhookMessage('Test message from e2e test');
  await checkMessageLogs();
  results.realMessageSent = await sendRealWhatsAppMessage();
  results.conversationFlowTested = await testConversationFlow();
  
  // Summary
  console.log(`\n${colors.bright}${colors.cyan}📊 Test Summary${colors.reset}`);
  console.log('═'.repeat(50));
  
  let allPassed = true;
  for (const [test, passed] of Object.entries(results)) {
    const status = passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${test}: ${status}`);
    if (!passed) allPassed = false;
  }
  
  console.log('═'.repeat(50));
  
  if (allPassed) {
    console.log(`${colors.green}${colors.bright}✅ All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}❌ Some tests failed. See details above.${colors.reset}`);
    
    // Provide troubleshooting advice
    console.log(`\n${colors.yellow}🔧 Troubleshooting:${colors.reset}`);
    
    if (!results.evolutionConnected) {
      console.log('• WhatsApp is not connected. Scan QR code in Evolution API');
    }
    if (!results.webhookConfigured) {
      console.log('• Webhook is not properly configured. Check Evolution API settings');
    }
    if (!results.backendHealthy) {
      console.log('• Backend service is not running properly. Check logs and database connection');
    }
    if (!results.webhookWorking) {
      console.log('• Webhook is not processing messages. Check webhook URL and routing');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run the complete test
runCompleteE2ETest().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});