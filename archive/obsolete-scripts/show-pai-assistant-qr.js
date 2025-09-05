#!/usr/bin/env node

require('dotenv').config({ override: true });

const evolutionMultiInstance = require('../src/services/evolutionMultiInstance');
const logger = require('../src/utils/logger');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * PAI Assistant QR Code Display Tool
 */
class PaiAssistantQRDisplay {
  constructor() {
    this.instanceAlias = 'pai_assistant';
  }

  async initialize() {
    try {
      await evolutionMultiInstance.initialize();
      log('✅ Multi-instance service initialized', 'green');
      return true;
    } catch (error) {
      log(`❌ Failed to initialize: ${error.message}`, 'red');
      return false;
    }
  }

  async showQRCode() {
    try {
      log('📱 Getting QR Code for PAI Assistant...', 'yellow');
      
      const qrResult = await evolutionMultiInstance.getQRCode(this.instanceAlias);

      if (qrResult.qrCode.base64 || qrResult.qrCode.qr) {
        log('✅ QR Code available!', 'green');
        log('', 'reset');
        
        this.displayConnectionInstructions(qrResult);
        return qrResult;
      } else {
        log('⚠️  No QR code available. Instance might already be connected.', 'yellow');
        await this.checkConnectionStatus();
        return null;
      }
    } catch (error) {
      log(`❌ Failed to get QR code: ${error.message}`, 'red');
      throw error;
    }
  }

  displayConnectionInstructions(qrResult) {
    log('📱 Connect PAI Assistant WhatsApp Line:', 'cyan');
    log('═══════════════════════════════════════════', 'cyan');
    log('', 'reset');
    
    log('⚠️  IMPORTANT: Use a different phone/WhatsApp account!', 'red');
    log('   • This should NOT be your main WhatsApp line', 'red');
    log('   • Use a separate device or WhatsApp Business', 'red');
    log('', 'reset');
    
    log('🔗 Connection Steps:', 'blue');
    log('1. Open WhatsApp on the dedicated PAI Assistant device', 'blue');
    log('2. Tap Menu (⋮) or Settings', 'blue');
    log('3. Tap "Linked Devices" or "WhatsApp Web"', 'blue');
    log('4. Tap "Link a Device"', 'blue');
    log('5. Scan the QR code at the URL below:', 'blue');
    log('', 'reset');
    
    log('🌐 QR Code URL:', 'magenta');
    log(`   ${qrResult.connectUrl}`, 'bold');
    log('', 'reset');
    
    log('📋 Instance Information:', 'cyan');
    log(`   Instance ID: ${qrResult.instanceId}`, 'blue');
    log(`   Alias: ${qrResult.alias}`, 'blue');
    log('', 'reset');
  }

  async checkConnectionStatus() {
    try {
      log('🔍 Checking connection status...', 'yellow');
      
      const status = await evolutionMultiInstance.getConnectionStatus(this.instanceAlias);
      
      log('📊 Connection Status:', 'blue');
      log(`   State: ${status.status.state}`, 'blue');
      log(`   Connected: ${status.connected ? 'Yes' : 'No'}`, status.connected ? 'green' : 'red');
      
      if (status.connected) {
        log('✅ PAI Assistant is connected and ready!', 'green');
        await this.showConnectedInfo();
      } else {
        log('⏳ PAI Assistant is not connected yet', 'yellow');
      }
      
      return status.connected;
    } catch (error) {
      log(`❌ Failed to check status: ${error.message}`, 'red');
      return false;
    }
  }

  async showConnectedInfo() {
    try {
      const instanceConfig = evolutionMultiInstance.getInstanceConfig(this.instanceAlias);
      
      log('', 'reset');
      log('🎉 PAI Assistant Line is Active!', 'green');
      log('═══════════════════════════════════════', 'green');
      log('', 'reset');
      
      log('📱 Users can now message PAI Assistant at this WhatsApp number', 'blue');
      log('💬 Example queries they can send:', 'blue');
      log('   • "What messages did I get today?"', 'dim');
      log('   • "Show me messages from John yesterday"', 'dim');
      log('   • "Messages containing \'meeting\' from this week"', 'dim');
      log('   • "help" - for more commands', 'dim');
      log('', 'reset');
      
      log('🔧 Technical Details:', 'cyan');
      log(`   Webhook: ${instanceConfig.webhookUrl}`, 'blue');
      log(`   Instance: ${instanceConfig.instanceId}`, 'blue');
      log(`   Type: ${instanceConfig.assistantType}`, 'blue');
      log('', 'reset');
      
    } catch (error) {
      log(`❌ Failed to show connected info: ${error.message}`, 'red');
    }
  }

  async monitorConnection() {
    log('👁️  Monitoring connection status...', 'yellow');
    log('   (Press Ctrl+C to exit)', 'dim');
    log('', 'reset');
    
    let lastState = null;
    
    const monitor = setInterval(async () => {
      try {
        const status = await evolutionMultiInstance.getConnectionStatus(this.instanceAlias);
        const currentState = status.status.state;
        
        if (currentState !== lastState) {
          const timestamp = new Date().toLocaleTimeString();
          log(`[${timestamp}] State changed: ${lastState || 'unknown'} → ${currentState}`, currentState === 'open' ? 'green' : 'yellow');
          
          if (currentState === 'open' && lastState !== 'open') {
            log('🎉 PAI Assistant is now connected!', 'green');
            await this.showConnectedInfo();
          } else if (currentState !== 'open' && lastState === 'open') {
            log('⚠️  PAI Assistant connection lost', 'red');
          }
          
          lastState = currentState;
        }
      } catch (error) {
        log(`Monitor error: ${error.message}`, 'red');
      }
    }, 5000); // Check every 5 seconds
    
    return monitor;
  }

  async showServiceStats() {
    try {
      const stats = await evolutionMultiInstance.getServiceStats();
      
      log('📊 Multi-Instance Service Stats:', 'cyan');
      log('══════════════════════════════════', 'cyan');
      log(`Initialized: ${stats.initialized}`, 'blue');
      log(`Total Instances: ${stats.instanceCount}`, 'blue');
      log('', 'reset');
      
      Object.entries(stats.instances).forEach(([alias, instanceStats]) => {
        log(`${alias}:`, 'blue');
        log(`  Instance ID: ${instanceStats.instanceId || 'Unknown'}`, 'dim');
        log(`  Assistant Type: ${instanceStats.assistantType || 'Unknown'}`, 'dim');
        log(`  Connected: ${instanceStats.connected ? 'Yes' : 'No'}`, instanceStats.connected ? 'green' : 'red');
        log(`  State: ${instanceStats.state || 'Unknown'}`, 'dim');
        log(`  Webhook: ${instanceStats.webhookPath || 'Unknown'}`, 'dim');
        log('', 'reset');
      });
    } catch (error) {
      log(`❌ Failed to get service stats: ${error.message}`, 'red');
    }
  }
}

async function main() {
  const qrDisplay = new PaiAssistantQRDisplay();
  
  log('📱 PAI Assistant QR Code Display', 'bold');
  log('════════════════════════════════════', 'blue');
  log('', 'reset');
  
  try {
    if (!await qrDisplay.initialize()) {
      process.exit(1);
    }

    const args = process.argv.slice(2);
    
    if (args.includes('--status')) {
      await qrDisplay.checkConnectionStatus();
      return;
    }
    
    if (args.includes('--stats')) {
      await qrDisplay.showServiceStats();
      return;
    }
    
    if (args.includes('--monitor')) {
      const monitor = await qrDisplay.monitorConnection();
      
      // Handle Ctrl+C
      process.on('SIGINT', () => {
        clearInterval(monitor);
        log('\n👋 Monitoring stopped', 'yellow');
        process.exit(0);
      });
      
      return; // Keep running
    }
    
    // Default: show QR code or connection status
    const qrResult = await qrDisplay.showQRCode();
    
    if (!qrResult) {
      // No QR code available, check if connected
      const connected = await qrDisplay.checkConnectionStatus();
      
      if (!connected) {
        log('', 'reset');
        log('💡 Try these options:', 'yellow');
        log('   • Run setup again: node scripts/setup-pai-assistant-line.js', 'dim');
        log('   • Check logs for connection issues', 'dim');
        log('   • Ensure Evolution API is running', 'dim');
      }
    }
    
    log('', 'reset');
    log('🛠️  Available Commands:', 'cyan');
    log('   --status     Check connection status', 'dim');
    log('   --monitor    Monitor connection changes', 'dim');
    log('   --stats      Show service statistics', 'dim');
    log('', 'reset');

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Goodbye!', 'yellow');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = PaiAssistantQRDisplay;