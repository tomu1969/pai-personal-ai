#!/usr/bin/env node

/**
 * Test script to verify PAI's prompt-based conversation system
 */

const aiService = require('./src/services/ai');
const logger = require('./src/utils/logger');

async function testPAIPromptSystem() {
  console.log('🤖 Testing PAI Prompt-Based System\n');

  const testCases = [
    {
      name: 'Test 1: First greeting - should identify as PAI',
      message: 'Hola',
      context: {
        ownerName: 'Tomás',
        senderName: 'Personal AI',
        recentMessages: '',
        isFirstMessage: true,
      },
      expectedResponse: true,
      expectedReason: 'greeting'
    },
    {
      name: 'Test 2: Dinner invitation - should acknowledge and relay',
      message: 'Cenamos hoy?',
      context: {
        ownerName: 'Tomás', 
        senderName: 'Personal AI',
        recentMessages: 'Personal AI: Hola\nPAI: Hola! Soy PAI, el asistente personal de Tomás...\nPersonal AI: Cenamos hoy?',
      },
      expectedResponse: true,
      expectedReason: 'invitation_for_owner'
    },
    {
      name: 'Test 3: Reply to others - should not respond',
      message: 'Sin duda',
      context: {
        ownerName: 'Tomás',
        senderName: 'Papa Santiago',
        recentMessages: 'Tomás: todavía no le he enseñado tanto, apenas lo básico\nPapa Santiago: Sin duda',
      },
      expectedResponse: false,
      expectedReason: 'reply_to_others'
    },
    {
      name: 'Test 4: Question about owner - should respond',
      message: 'Quién eres?',
      context: {
        ownerName: 'Tomás',
        senderName: 'Personal AI',
        recentMessages: 'PAI: Hola! Soy PAI, el asistente personal de Tomás\nPersonal AI: Quién eres?',
      },
      expectedResponse: true,
      expectedReason: 'direct_question'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`Message: "${testCase.message}"`);
    
    try {
      // Test AI analysis decision
      const analysis = await aiService.analyzeMessage(testCase.message, testCase.context);
      
      console.log(`Result:`, {
        requiresResponse: analysis.requiresResponse,
        reason: analysis.responseReason,
        intent: analysis.intent,
        confidence: analysis.confidence
      });

      const success = analysis.requiresResponse === testCase.expectedResponse;
      console.log(`✅ Decision: ${success ? 'CORRECT' : '❌ INCORRECT'}`);
      
      if (success && testCase.expectedResponse) {
        // Test response generation
        const response = await aiService.generateResponse(testCase.message, {
          ...testCase.context,
          analysis,
          ownerSystemPrompt: 'Sé amigable y profesional. Usa un tono casual pero respetuoso.'
        });
        
        console.log(`Response: "${response}"`);
        console.log(`Identity Check: ${response.includes('PAI') ? '✅ Contains PAI identity' : '❌ Missing PAI identity'}`);
        
        if (testCase.expectedReason === 'greeting') {
          console.log(`Greeting Check: ${response.includes('asistente') ? '✅ Identifies as assistant' : '❌ Missing assistant role'}`);
        }
        
        if (testCase.expectedReason === 'invitation_for_owner') {
          console.log(`Relay Check: ${response.includes('avisar') || response.includes('transmitiré') ? '✅ Offers to relay' : '❌ Missing relay offer'}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
    
    console.log('─'.repeat(60));
  }

  console.log('\n🎯 Summary: PAI Prompt-Based System Testing Complete!');
  console.log('The system should now:');
  console.log('✅ Always identify as PAI when appropriate');
  console.log('✅ Recognize invitations and offer to relay them');
  console.log('✅ Avoid responding to replies meant for others');
  console.log('✅ Use natural language understanding instead of rigid rules');
}

// Run the test
testPAIPromptSystem().catch((error) => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});