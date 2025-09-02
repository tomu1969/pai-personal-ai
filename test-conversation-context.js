#!/usr/bin/env node

/**
 * Test script to verify conversation context improvements
 */

const aiService = require('./src/services/ai');
const logger = require('./src/utils/logger');

async function testConversationContext() {
  console.log('🧪 Testing Conversation Context Detection\n');

  // Test case 1: Reply to someone else's message (should not respond)
  console.log('Test 1: Reply to someone else\'s comment');
  const test1 = await aiService.analyzeMessage('Sin duda', {
    senderName: 'Papa Santiago',
    recentMessages: 'Tomas: ajajaaj todavía no le he enseñado tanto, apenas lo básico, pero dentro de poco me enseñará él a mi\nPapa Santiago: Sin duda',
  });
  
  console.log('Result:', {
    requiresResponse: test1.requiresResponse,
    reason: test1.responseReason,
    confidence: test1.confidence
  });
  console.log('Expected: requiresResponse = false (reply to others)\n');

  // Test case 2: Direct question (should respond)
  console.log('Test 2: Direct question to assistant');
  const test2 = await aiService.analyzeMessage('Quién eres', {
    senderName: 'Personal AI',
    recentMessages: 'Personal AI: Hola\nTomas: Hola, ¿cómo estás? ¿En qué puedo ayudarte hoy?\nPersonal AI: Quién eres',
  });
  
  console.log('Result:', {
    requiresResponse: test2.requiresResponse,
    reason: test2.responseReason,
    confidence: test2.confidence
  });
  console.log('Expected: requiresResponse = true (direct question)\n');

  // Test case 3: Greeting (should respond)
  console.log('Test 3: Greeting message');
  const test3 = await aiService.analyzeMessage('Hola', {
    senderName: 'Personal AI',
    conversationHistory: false,
  });
  
  console.log('Result:', {
    requiresResponse: test3.requiresResponse,
    reason: test3.responseReason,
    confidence: test3.confidence
  });
  console.log('Expected: requiresResponse = true (greeting)\n');

  console.log('✅ Conversation context testing complete!');
}

// Run the test
testConversationContext().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});