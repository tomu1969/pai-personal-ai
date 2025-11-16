#!/usr/bin/env node

/**
 * @file test-runner.js
 * @description Quick test runner for CS Ticket System
 * @module ai-cs/test-runner
 * @author PAI System - CS Module E (Testing)
 * @since November 2025
 */

const CSIntegrationTestSuite = require('./integration-test');

console.log('🚀 CS Ticket System - Quick Test Runner');
console.log('======================================\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`Node.js Version: ${nodeVersion}`);

// Check environment variables
console.log('\n📋 Environment Check:');
console.log(`- CS_INSTANCE_ID: ${process.env.CS_INSTANCE_ID || 'NOT SET'}`);
console.log(`- CS_SHEET_ID: ${process.env.CS_SHEET_ID ? 'SET' : 'NOT SET'}`);
console.log(`- GOOGLE_SERVICE_ACCOUNT_KEY: ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT SET'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);

// Run tests
async function runQuickTests() {
  try {
    const testSuite = new CSIntegrationTestSuite();
    await testSuite.runAllTests();
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'quick':
    console.log('\n🏃‍♂️ Running quick tests only...\n');
    // Run basic tests
    break;
  case 'full':
    console.log('\n🔬 Running full integration test suite...\n');
    runQuickTests();
    break;
  case 'help':
    console.log('\n📖 CS Test Runner Commands:');
    console.log('  node test-runner.js quick  - Run basic functionality tests');
    console.log('  node test-runner.js full   - Run complete integration test suite');
    console.log('  node test-runner.js help   - Show this help message');
    break;
  default:
    console.log('\n🔬 Running full integration test suite...\n');
    runQuickTests();
    break;
}