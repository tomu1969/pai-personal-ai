#!/usr/bin/env node

require('dotenv').config({ override: true });

const evolutionMultiInstance = require('../src/services/evolutionMultiInstance');
const config = require('../src/config');
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
 * Setup PAI Assistant WhatsApp Line
 */
class PaiAssistantLineSetup {
  constructor() {
    this.instanceAlias = 'pai_assistant';
  }

  async initialize() {
    try {
      // Initialize multi-instance service
      await evolutionMultiInstance.initialize();
      
      log('✅ Multi-instance service initialized', 'green');
      return true;
    } catch (error) {
      log(`❌ Failed to initialize multi-instance service: ${error.message}`, 'red');
      return false;
    }
  }

  async createInstance() {
    try {
      log('🔄 Creating PAI Assistant Evolution API instance...', 'yellow');
      
      const result = await evolutionMultiInstance.createInstance(this.instanceAlias, {
        ignoreGroups: true // PAI Assistant should ignore group messages by default
      });

      if (result.instance) {
        log('✅ PAI Assistant instance created successfully!', 'green');
        log(`📱 Instance ID: ${result.instance.instanceName}`, 'blue');
      } else {
        log('⚠️  Instance creation returned unexpected result', 'yellow');
      }

      return result;
    } catch (error) {
      log(`❌ Failed to create PAI Assistant instance: ${error.message}`, 'red');
      throw error;
    }
  }

  async getQRCode() {
    try {
      log('📱 Getting QR Code for PAI Assistant connection...', 'yellow');
      
      const qrResult = await evolutionMultiInstance.getQRCode(this.instanceAlias);

      if (qrResult.qrCode.base64 || qrResult.qrCode.qr) {
        log('✅ QR Code generated for PAI Assistant!', 'green');
        log('', 'reset');
        log('📱 To connect PAI Assistant WhatsApp line:', 'cyan');
        log('   1. Use a different phone/WhatsApp account than your main line', 'blue');
        log('   2. Open WhatsApp on that device', 'blue');
        log('   3. Tap Menu (3 dots) > Linked Devices', 'blue');
        log('   4. Tap "Link a Device"', 'blue');
        log('   5. Scan the QR code at the URL below:', 'blue');
        log('', 'reset');
        log('🌐 QR Code URL:', 'magenta');
        log(`   ${qrResult.connectUrl}`, 'bold');
        log('', 'reset');
        
        return qrResult;
      } else {
        log('⚠️  No QR code available. Instance might already be connected.', 'yellow');
        return null;
      }
    } catch (error) {
      log(`❌ Failed to get QR code: ${error.message}`, 'red');
      throw error;
    }
  }

  async setupWebhook() {
    try {
      log('🔄 Setting up webhook for PAI Assistant...', 'yellow');
      
      await evolutionMultiInstance.setWebhook(this.instanceAlias, [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE'
      ]);

      const instanceConfig = evolutionMultiInstance.getInstanceConfig(this.instanceAlias);
      
      log('✅ Webhook configured for PAI Assistant!', 'green');
      log(`🔗 Webhook URL: ${instanceConfig.webhookUrl}`, 'blue');
      log('📡 Events: MESSAGES_UPSERT, CONNECTION_UPDATE', 'blue');

      return true;
    } catch (error) {
      log(`❌ Failed to setup webhook: ${error.message}`, 'red');
      throw error;
    }
  }

  async checkConnectionStatus() {
    try {
      log('🔍 Checking PAI Assistant connection status...', 'yellow');
      
      const status = await evolutionMultiInstance.getConnectionStatus(this.instanceAlias);
      
      log('📊 PAI Assistant Status:', 'blue');
      log(`   State: ${status.status.state}`, 'blue');
      log(`   Instance: ${status.instanceId}`, 'blue');
      log(`   Connected: ${status.connected ? 'Yes' : 'No'}`, status.connected ? 'green' : 'red');
      
      if (status.connected) {
        log('✅ PAI Assistant WhatsApp is connected and ready!', 'green');
        return true;
      } else {
        log('⏳ PAI Assistant WhatsApp is not yet connected. Please scan the QR code.', 'yellow');
        return false;
      }
    } catch (error) {
      log(`❌ Failed to check connection status: ${error.message}`, 'red');
      return false;
    }
  }

  async testPaiAssistantService() {
    try {
      log('🧪 Testing PAI Assistant service...', 'yellow');
      
      const paiAssistantWhatsApp = require('../src/services/paiAssistantWhatsApp');
      await paiAssistantWhatsApp.initialize();
      
      const stats = paiAssistantWhatsApp.getConversationStats();
      
      log('✅ PAI Assistant service is working!', 'green');
      log(`📊 Service initialized: ${stats.initialized}`, 'blue');
      log(`💬 Active conversations: ${stats.activeConversations}`, 'blue');
      
      return true;
    } catch (error) {
      log(`❌ PAI Assistant service test failed: ${error.message}`, 'red');
      return false;
    }
  }

  async showInstanceInfo() {
    try {
      const stats = await evolutionMultiInstance.getServiceStats();
      const paiConfig = evolutionMultiInstance.getInstanceConfig(this.instanceAlias);
      
      log('', 'reset');
      log('📋 PAI Assistant Instance Information:', 'cyan');
      log('════════════════════════════════════════', 'cyan');
      log(`Instance ID: ${paiConfig.instanceId}`, 'blue');
      log(`Assistant Type: ${paiConfig.assistantType}`, 'blue');
      log(`Webhook Path: ${paiConfig.webhookPath}`, 'blue');
      log(`Webhook URL: ${paiConfig.webhookUrl}`, 'blue');
      log(`Description: ${paiConfig.description}`, 'blue');
      
      if (stats.instances[this.instanceAlias]) {
        const instanceStats = stats.instances[this.instanceAlias];
        log(`Connection Status: ${instanceStats.connected ? 'Connected' : 'Disconnected'}`, instanceStats.connected ? 'green' : 'red');
        log(`State: ${instanceStats.state}`, 'blue');
      }
      
      log('', 'reset');
      
    } catch (error) {
      log(`❌ Failed to show instance info: ${error.message}`, 'red');
    }
  }

  async showUsageInstructions() {
    log('', 'reset');
    log('📖 How to Use PAI Assistant WhatsApp Line:', 'cyan');
    log('══════════════════════════════════════════════', 'cyan');
    log('', 'reset');
    
    log('1. 📱 Users can now message the PAI Assistant WhatsApp number', 'blue');
    log('2. 💬 They can ask natural language queries like:', 'blue');
    log('   • "What messages did I get today?"', 'dim');
    log('   • "Show me messages from John yesterday"', 'dim');
    log('   • "Messages containing \'meeting\' from this week"', 'dim');
    log('   • "Messages from 2 days ago"', 'dim');
    log('', 'reset');
    
    log('3. 🤖 PAI Assistant will search their messages and respond', 'blue');
    log('4. ⚙️  Special commands available:', 'blue');
    log('   • "help" - Show help message', 'dim');
    log('   • "reset" - Clear conversation history', 'dim');
    log('   • "status" - Show assistant status', 'dim');
    log('', 'reset');
    
    log('5. 🔒 Each user gets their own conversation context', 'blue');
    log('6. 📊 All queries search the main message database', 'blue');
    log('', 'reset');
  }

  async showNextSteps() {
    log('🎯 Next Steps:', 'yellow');
    log('═══════════════', 'yellow');
    log('', 'reset');
    
    log('1. 🔗 Add webhook routes to your Express app:', 'blue');
    log('   • Add routes in src/routes/webhook.js', 'dim');
    log('   • Use src/controllers/webhookMultiInstance.js', 'dim');
    log('', 'reset');
    
    log('2. 🔄 Start your AI PBX server:', 'blue');
    log('   • npm start', 'dim');
    log('', 'reset');
    
    log('3. 📱 Share PAI Assistant number with users:', 'blue');
    log('   • Users can save it as "PAI Assistant"', 'dim');
    log('   • They can start asking questions immediately', 'dim');
    log('', 'reset');
    
    log('4. 📊 Monitor both instances:', 'blue');
    log('   • Main line: PAI Responder (auto-replies)', 'dim');
    log('   • PAI Assistant line: Query interface', 'dim');
    log('', 'reset');
    
    log('🛠️  Useful Commands:', 'magenta');
    log('   • node scripts/show-pai-assistant-qr.js (show QR again)', 'dim');
    log('   • node scripts/test-multi-instance.js (test both lines)', 'dim');
    log('', 'reset');
  }
}

async function main() {
  const setup = new PaiAssistantLineSetup();
  
  log('🚀 PAI Assistant WhatsApp Line Setup', 'bold');
  log('════════════════════════════════════════', 'blue');
  log('', 'reset');
  
  try {
    // Initialize services
    if (!await setup.initialize()) {
      process.exit(1);
    }

    // Create Evolution API instance
    await setup.createInstance();
    
    // Get QR code for connection
    const qrResult = await setup.getQRCode();
    
    // Setup webhook
    await setup.setupWebhook();
    
    // Test PAI Assistant service
    await setup.testPaiAssistantService();
    
    // Show instance information
    await setup.showInstanceInfo();
    
    // Show usage instructions
    await setup.showUsageInstructions();
    
    // Show next steps
    await setup.showNextSteps();
    
    log('✅ PAI Assistant WhatsApp Line Setup Complete!', 'green');
    log('', 'reset');
    
    // Handle command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--wait-for-connection')) {
      log('⏳ Waiting for WhatsApp connection...', 'yellow');
      log('   (Press Ctrl+C to exit)', 'dim');
      
      const checkInterval = setInterval(async () => {
        try {
          const connected = await setup.checkConnectionStatus();
          if (connected) {
            log('🎉 PAI Assistant WhatsApp is now connected!', 'green');
            clearInterval(checkInterval);
            process.exit(0);
          }
        } catch (error) {
          // Continue checking
        }
      }, 5000);
    }
    
    if (args.includes('--status')) {
      await setup.checkConnectionStatus();
    }

  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Setup interrupted by user', 'yellow');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = PaiAssistantLineSetup;