#!/usr/bin/env node

/**
 * WhatsApp Connection Test Suite
 * Tests Evolution API connectivity and WhatsApp integration
 */

const axios = require('axios');
const chalk = require('chalk');

// Configuration from environment
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'ai-pbx-key-2024';
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID || 'aipbx';
const APP_API_URL = 'http://localhost:3000';

// Create axios client
const evolutionClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

const appClient = axios.create({
  baseURL: APP_API_URL,
  timeout: 10000
});

// Test results
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run a test
async function runTest(name, testFn) {
  console.log(chalk.blue(`\nRunning: ${name}`));
  try {
    const result = await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed', result });
    console.log(chalk.green(`✓ ${name}`));
    if (result) {
      console.log(chalk.gray(`  Result: ${JSON.stringify(result, null, 2).substring(0, 200)}`));
    }
    return result;
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    console.log(chalk.red(`✗ ${name}`));
    console.log(chalk.red(`  Error: ${error.message}`));
    throw error;
  }
}

// Test Suite
async function runTests() {
  console.log(chalk.cyan('\n==========================================='));
  console.log(chalk.cyan('WhatsApp Connection Test Suite'));
  console.log(chalk.cyan('==========================================='));
  console.log(chalk.gray(`Evolution API: ${EVOLUTION_API_URL}`));
  console.log(chalk.gray(`Instance ID: ${EVOLUTION_INSTANCE_ID}`));
  console.log(chalk.gray(`App API: ${APP_API_URL}`));

  // Test 1: Evolution API Health
  await runTest('Evolution API is accessible', async () => {
    const response = await evolutionClient.get('/');
    return response.status === 200;
  }).catch(() => {});

  // Test 2: List Instances
  const instances = await runTest('Can list Evolution instances', async () => {
    const response = await evolutionClient.get('/instance/fetchInstances');
    return response.data;
  }).catch(() => []);

  // Test 3: Check specific instance
  const instanceExists = await runTest('Instance "aipbx" exists', async () => {
    const instanceList = Array.isArray(instances) ? instances : [];
    const instance = instanceList.find(i => i.name === EVOLUTION_INSTANCE_ID);
    if (!instance) throw new Error('Instance not found');
    return instance;
  }).catch(() => null);

  // Test 4: Instance connection status
  let connectionStatus = null;
  if (instanceExists) {
    connectionStatus = await runTest('Check instance connection status', async () => {
      const response = await evolutionClient.get(`/instance/connectionState/${EVOLUTION_INSTANCE_ID}`);
      return response.data;
    }).catch(() => null);
  }

  // Test 5: Get QR Code if not connected
  if (connectionStatus && connectionStatus.state !== 'open') {
    await runTest('Get QR code for connection', async () => {
      const response = await evolutionClient.get(`/instance/connect/${EVOLUTION_INSTANCE_ID}`);
      const hasQR = !!(response.data.code || response.data.pairingCode);
      if (!hasQR) throw new Error('No QR code available');
      return {
        hasQRCode: !!response.data.code,
        hasPairingCode: !!response.data.pairingCode,
        pairingCode: response.data.pairingCode
      };
    }).catch(() => null);
  }

  // Test 6: App backend health
  await runTest('App backend is running', async () => {
    const response = await appClient.get('/health');
    return response.data;
  }).catch(() => null);

  // Test 7: App WhatsApp status endpoint
  const appWhatsAppStatus = await runTest('App WhatsApp status endpoint', async () => {
    const response = await appClient.get('/api/whatsapp/status');
    return response.data;
  }).catch(() => null);

  // Test 8: Webhook configuration
  await runTest('Check webhook configuration', async () => {
    const response = await evolutionClient.get(`/webhook/${EVOLUTION_INSTANCE_ID}`);
    return response.data;
  }).catch(() => null);

  // Test 9: Set webhook if not configured
  if (!appWhatsAppStatus || !appWhatsAppStatus.webhookConfigured) {
    await runTest('Configure webhook', async () => {
      const webhookUrl = 'http://host.docker.internal:3000/webhook';
      const response = await evolutionClient.post(`/webhook/set/${EVOLUTION_INSTANCE_ID}`, {
        url: webhookUrl,
        webhook_by_events: true,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'MESSAGES_SET',
          'SEND_MESSAGE'
        ]
      });
      return response.data;
    }).catch(() => null);
  }

  // Test 10: Test message sending (only if connected)
  if (connectionStatus && connectionStatus.state === 'open') {
    await runTest('Test message sending capability', async () => {
      // This is a dry run - we're just checking if the endpoint is available
      try {
        await evolutionClient.post(`/message/sendText/${EVOLUTION_INSTANCE_ID}`, {
          number: '1234567890',  // Dummy number for validation
          text: 'Test message'
        });
      } catch (error) {
        // We expect this to fail with a validation error, not a 404
        if (error.response && error.response.status === 400) {
          return { endpointAvailable: true, error: 'Invalid number (expected)' };
        }
        throw error;
      }
    }).catch(() => null);
  }

  // Print summary
  console.log(chalk.cyan('\n==========================================='));
  console.log(chalk.cyan('Test Summary'));
  console.log(chalk.cyan('==========================================='));
  console.log(chalk.green(`Passed: ${testResults.passed}`));
  console.log(chalk.red(`Failed: ${testResults.failed}`));
  
  // Connection status summary
  console.log(chalk.cyan('\n==========================================='));
  console.log(chalk.cyan('Connection Status'));
  console.log(chalk.cyan('==========================================='));
  
  if (connectionStatus) {
    const isConnected = connectionStatus.state === 'open';
    console.log(`WhatsApp Status: ${isConnected ? chalk.green('Connected') : chalk.yellow('Not Connected')}`);
    console.log(`Instance State: ${connectionStatus.state}`);
    
    if (!isConnected) {
      console.log(chalk.yellow('\nTo connect WhatsApp:'));
      console.log('1. The QR code has been generated');
      console.log('2. Open WhatsApp on your phone');
      console.log('3. Go to Settings > Linked Devices');
      console.log('4. Scan the QR code displayed above or use the pairing code');
      console.log('5. Run this test again to verify connection');
    }
  } else {
    console.log(chalk.red('Could not determine WhatsApp connection status'));
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('\nFatal error running tests:'), error);
  process.exit(1);
});