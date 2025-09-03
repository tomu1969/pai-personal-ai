#!/usr/bin/env node

/**
 * Test direct message sending to simulate a WhatsApp conversation
 * This bypasses Evolution API to test PAI directly
 */

const messageProcessor = require('./src/services/messageProcessor');
const logger = require('./src/utils/logger');

// Suppress verbose logging
logger.transports.forEach(t => t.level = 'error');

async function simulateWhatsAppMessage(text, senderName = 'Personal AI', phone = '573122663099') {
  console.log(`\n📱 Simulating WhatsApp message:`);
  console.log(`From: ${senderName} (${phone})`);
  console.log(`Message: "${text}"`);
  console.log('─'.repeat(50));

  // Create a mock parsed message that would come from Evolution API
  const parsedMessage = {
    messageId: `TEST_${Date.now()}`,
    phone: phone,
    pushName: senderName,
    content: text,
    messageType: 'conversation',
    timestamp: new Date(),
    isGroupMessage: false,
    fromMe: false
  };

  try {
    console.log('🔄 Processing message through PAI system...');
    
    // Process the message through the full pipeline
    const result = await messageProcessor.processMessage(parsedMessage);
    
    console.log('\n📊 Processing Result:');
    console.log(`  • Processed: ${result.processed ? '✅' : '❌'}`);
    console.log(`  • Reason: ${result.reason}`);
    
    if (result.response) {
      console.log(`  • Response sent: ${result.response.sent ? '✅' : '❌'}`);
      if (result.response.content) {
        console.log(`\n💬 PAI Response: "${result.response.content}"`);
      }
    } else {
      console.log(`  • No response generated`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function testFailingConversation() {
  console.log('🔍 Testing Exact Failing Conversation\n');
  console.log('This simulates messages arriving at the webhook');
  console.log('═'.repeat(50));

  // Message 1: "Hola"
  await simulateWhatsAppMessage('Hola');
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Message 2: "Necesito hablar con Tomás"
  await simulateWhatsAppMessage('Necesito hablar con Tomás');
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Test completed');
}

// Run the test
testFailingConversation().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});