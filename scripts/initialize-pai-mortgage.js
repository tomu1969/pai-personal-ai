#!/usr/bin/env node

/**
 * @file initialize-pai-mortgage.js
 * @description One-command initialization script for PAI Mortgage system
 * @author PAI System
 * @since September 2025
 */

const axios = require('axios');
const logger = require('../src/utils/logger');

const API_BASE = 'http://localhost:3000/api';
const EVOLUTION_BASE = 'http://localhost:8080';
const API_KEY = 'pai_evolution_api_key_2025';

/**
 * Main initialization function
 */
async function initializePaiMortgage() {
  console.log('🚀 PAI Mortgage System Initialization\n');
  
  try {
    // Step 1: Check if backend is running
    console.log('1️⃣ Checking backend server...');
    await checkBackendHealth();
    console.log('✅ Backend server is running\n');

    // Step 2: Check Evolution API
    console.log('2️⃣ Checking Evolution API...');
    await checkEvolutionAPI();
    console.log('✅ Evolution API is accessible\n');

    // Step 3: Initialize system
    console.log('3️⃣ Initializing PAI system...');
    await initializeSystem();
    console.log('✅ System initialized successfully\n');

    // Step 4: Check PAI Mortgage instance
    console.log('4️⃣ Verifying PAI Mortgage instance...');
    const status = await checkPaiMortgageStatus();
    console.log('✅ PAI Mortgage instance ready\n');

    // Step 5: Display connection instructions
    displayConnectionInstructions(status);

    console.log('🎉 PAI Mortgage system is ready!\n');
    console.log('Next steps:');
    console.log('- Visit http://localhost:3000/qr-mortgage to connect your WhatsApp device');
    console.log('- Send a test message to verify everything works');
    console.log('- Check system status at http://localhost:3000/api/system/status');

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Make sure Evolution API is running: docker ps');
    console.log('- Check backend server: npm start');
    console.log('- Verify database connection');
    process.exit(1);
  }
}

/**
 * Check backend health
 */
async function checkBackendHealth() {
  try {
    const response = await axios.get(`${API_BASE}/../health`, { timeout: 5000 });
    if (response.data.status !== 'OK') {
      throw new Error('Backend health check failed');
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Backend server is not running. Please start with: npm start');
    }
    throw error;
  }
}

/**
 * Check Evolution API
 */
async function checkEvolutionAPI() {
  try {
    // Try to access a basic endpoint that exists
    const response = await axios.get(`${EVOLUTION_BASE}/`, {
      headers: { 'apikey': API_KEY },
      timeout: 5000
    });
    // If we get here, Evolution API is accessible
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Evolution API is not running. Please start Docker containers.');
    }
    // If we get 404 or similar, API is running but endpoint doesn't exist - that's ok
    if (error.response && error.response.status < 500) {
      // API is running, just endpoint doesn't exist
      return;
    }
    throw error;
  }
}

/**
 * Initialize system
 */
async function initializeSystem() {
  try {
    const response = await axios.post(`${API_BASE}/system/reinitialize`, {}, {
      timeout: 30000 // 30 seconds for initialization
    });
    
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'System initialization failed');
    }
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`System initialization failed: ${error.response.data.message}`);
    }
    throw error;
  }
}

/**
 * Check PAI Mortgage specific status
 */
async function checkPaiMortgageStatus() {
  try {
    const response = await axios.get(`${API_BASE}/system/pai-mortgage/diagnostics`);
    
    if (response.data.status !== 'success') {
      throw new Error('PAI Mortgage diagnostics failed');
    }
    
    const data = response.data.data;
    console.log(`   Instance ID: ${data.instance.instanceId}`);
    console.log(`   Connection State: ${data.instance.state || 'Not connected'}`);
    console.log(`   Webhook Status: ${data.webhook?.enabled ? 'Configured' : 'Not configured'}`);
    
    return data;
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`PAI Mortgage check failed: ${error.response.data.message}`);
    }
    throw error;
  }
}

/**
 * Display connection instructions
 */
function displayConnectionInstructions(status) {
  console.log('📱 WhatsApp Connection Instructions:');
  console.log('─'.repeat(50));
  
  if (status.instance.state === 'open') {
    console.log('✅ WhatsApp device is already connected');
  } else {
    console.log('📋 To connect your WhatsApp device:');
    console.log('   1. Visit: http://localhost:3000/qr-mortgage');
    console.log('   2. Scan the QR code with your WhatsApp device');
    console.log('   3. Wait for connection to be established');
  }
  
  console.log('');
  console.log('🔧 System Endpoints:');
  console.log(`   • Health Check: http://localhost:3000/health`);
  console.log(`   • System Status: http://localhost:3000/api/system/status`);
  console.log(`   • PAI Mortgage Diagnostics: http://localhost:3000/api/system/pai-mortgage/diagnostics`);
  console.log('');
}

// Run the initialization
if (require.main === module) {
  initializePaiMortgage();
}

module.exports = { initializePaiMortgage };