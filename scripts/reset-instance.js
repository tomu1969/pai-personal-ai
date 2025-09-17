#!/usr/bin/env node

/**
 * @file reset-instance.js
 * @description Utility script to reset Evolution API instances
 * @usage node scripts/reset-instance.js <instance-alias>
 * @example node scripts/reset-instance.js pai-mortgage
 * @author PAI System
 * @since September 2025
 */

require('dotenv').config();
const evolutionMultiInstance = require('../src/services/whatsapp/evolutionMultiInstance');
const logger = require('../src/utils/logger');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function resetInstance(alias) {
  try {
    console.log(`${colors.cyan}🔄 Resetting Evolution API instance: ${alias}${colors.reset}`);
    
    // Initialize the multi-instance service
    await evolutionMultiInstance.initialize();
    
    // Check if instance exists
    try {
      const config = evolutionMultiInstance.getInstanceConfig(alias);
      console.log(`${colors.blue}📋 Instance configuration:${colors.reset}`);
      console.log(`   Instance ID: ${config.instanceId}`);
      console.log(`   Assistant Type: ${config.assistantType}`);
      console.log(`   Webhook URL: ${config.webhookUrl}`);
    } catch (error) {
      throw new Error(`Instance '${alias}' not found. Available instances: ${getAvailableInstances().join(', ')}`);
    }
    
    // Get current status
    console.log(`${colors.yellow}🔍 Checking current status...${colors.reset}`);
    try {
      const status = await evolutionMultiInstance.getConnectionStatus(alias);
      console.log(`   Current state: ${status.status.state}`);
      console.log(`   Connected: ${status.connected ? 'Yes' : 'No'}`);
    } catch (error) {
      console.log(`   Status check failed: ${error.message}`);
    }
    
    // Reset instance
    console.log(`${colors.magenta}⚡ Recreating instance...${colors.reset}`);
    const result = await evolutionMultiInstance.recreateInstance(alias);
    
    console.log(`${colors.green}✅ Instance reset completed successfully!${colors.reset}`);
    console.log(`   New instance created: ${result.instance?.instanceName || 'Unknown'}`);
    
    // Check new status
    console.log(`${colors.yellow}🔍 Verifying new instance...${colors.reset}`);
    try {
      const newStatus = await evolutionMultiInstance.getConnectionStatus(alias);
      console.log(`   New state: ${newStatus.status.state}`);
      console.log(`   Connected: ${newStatus.connected ? 'Yes' : 'No'}`);
      
      if (newStatus.status.state === 'close') {
        console.log(`${colors.blue}📱 Instance is ready for QR code connection.${colors.reset}`);
        console.log(`   Use the QR endpoint to connect your WhatsApp device.`);
      }
    } catch (error) {
      console.log(`   Status verification failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Failed to reset instance:${colors.reset}`, error.message);
    process.exit(1);
  }
}

async function listInstances() {
  try {
    await evolutionMultiInstance.initialize();
    const stats = await evolutionMultiInstance.getServiceStats();
    
    console.log(`${colors.cyan}📋 Available instances:${colors.reset}`);
    Object.entries(stats.instances).forEach(([alias, info]) => {
      const status = info.error ? 'ERROR' : info.state;
      const color = status === 'open' ? colors.green : 
                   status === 'close' ? colors.yellow : 
                   status === 'ERROR' ? colors.red : colors.reset;
      
      console.log(`   ${color}${alias}${colors.reset} (${info.instanceId}) - ${status}`);
      if (info.error) {
        console.log(`     Error: ${info.error}`);
      }
    });
  } catch (error) {
    console.error(`${colors.red}❌ Failed to list instances:${colors.reset}`, error.message);
    process.exit(1);
  }
}

function getAvailableInstances() {
  return ['main', 'pai-assistant', 'pai-mortgage'];
}

function showUsage() {
  console.log(`${colors.cyan}Evolution API Instance Reset Utility${colors.reset}`);
  console.log('');
  console.log('Usage:');
  console.log(`  ${colors.green}node scripts/reset-instance.js <instance-alias>${colors.reset}`);
  console.log(`  ${colors.green}node scripts/reset-instance.js --list${colors.reset}`);
  console.log('');
  console.log('Available instances:');
  getAvailableInstances().forEach(alias => {
    console.log(`  - ${alias}`);
  });
  console.log('');
  console.log('Examples:');
  console.log(`  ${colors.yellow}node scripts/reset-instance.js pai-mortgage${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/reset-instance.js pai-assistant${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/reset-instance.js --list${colors.reset}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showUsage();
    process.exit(1);
  }
  
  const command = args[0];
  
  switch (command) {
    case '--help':
    case '-h':
      showUsage();
      break;
      
    case '--list':
    case '-l':
      await listInstances();
      break;
      
    default:
      if (!getAvailableInstances().includes(command)) {
        console.error(`${colors.red}❌ Unknown instance: ${command}${colors.reset}`);
        showUsage();
        process.exit(1);
      }
      await resetInstance(command);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Operation cancelled${colors.reset}`);
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}❌ Unhandled rejection:${colors.reset}`, reason);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error(`${colors.red}❌ Script failed:${colors.reset}`, error.message);
  process.exit(1);
});