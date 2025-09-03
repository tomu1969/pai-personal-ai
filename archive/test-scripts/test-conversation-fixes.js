#!/usr/bin/env node

/**
 * Test script to verify the three PAI conversation fixes:
 * 1. PAI identity in responses
 * 2. Continuing conversation after urgent requests  
 * 3. Using contact names in greetings
 */

const aiService = require('./src/services/ai');
const assistantService = require('./src/services/assistant');
const logger = require('./src/utils/logger');

async function testConversationFixes() {
  console.log('🔧 Testing PAI Conversation Fixes\n');

  // Simulate the exact conversation that had issues
  const conversationScenario = [
    {
      name: 'Message 1: Initial greeting',
      message: 'Hola',
      context: {
        ownerName: 'Tomás',
        senderName: 'Personal AI',
        recentMessages: '',
        isFirstMessage: true,
      },
      expectedFixes: [
        'Should identify as PAI (not just "asistente de Tomás")',
        'Should greet using sender name "Personal AI"',
        'Should respond to greeting'
      ]
    },
    {
      name: 'Message 2: Urgent request (previously ignored)',
      message: 'Necesito hablar con Tomás urgente',
      context: {
        ownerName: 'Tomás',
        senderName: 'Personal AI', 
        recentMessages: 'Personal AI: Hola\nPAI: Hola Personal AI! Soy PAI, el asistente personal de Tomás. ¿En qué puedo ayudarte hoy?',
        isFirstMessage: false,
      },
      expectedFixes: [
        'Should recognize as urgent request',
        'Should continue conversation (not ignore)',
        'Should identify as PAI in response',
        'Should acknowledge urgency and offer to relay immediately'
      ]
    }
  ];

  for (const scenario of conversationScenario) {
    console.log(`\n📋 ${scenario.name}`);
    console.log(`Message: "${scenario.message}"`);
    console.log(`Expected fixes: ${scenario.expectedFixes.join(', ')}`);
    console.log('─'.repeat(80));
    
    try {
      // Test 1: AI Analysis (should recognize message type correctly)
      console.log('🧠 AI Analysis:');
      const analysis = await aiService.analyzeMessage(scenario.message, scenario.context);
      
      console.log(`  • Category: ${analysis.category}`);
      console.log(`  • Priority: ${analysis.priority}`);
      console.log(`  • Intent: ${analysis.intent}`);
      console.log(`  • Requires Response: ${analysis.requiresResponse}`);
      console.log(`  • Response Reason: ${analysis.responseReason}`);
      console.log(`  • Confidence: ${analysis.confidence}`);

      // Test 2: Response Generation (should fix all three issues)
      if (analysis.requiresResponse) {
        console.log('\n💬 PAI Response:');
        const response = await aiService.generateResponse(scenario.message, {
          ...scenario.context,
          analysis,
          ownerSystemPrompt: 'Sé amigable y profesional. Usa un tono casual pero respetuoso.'
        });
        
        console.log(`  "${response}"`);
        
        // Verify fixes
        console.log('\n✅ Fix Verification:');
        
        // Fix 1: PAI Identity
        const hasPAIIdentity = response.includes('PAI');
        console.log(`  • PAI Identity: ${hasPAIIdentity ? '✅ FIXED' : '❌ NOT FIXED'}`);
        
        // Fix 2: Contact Name Usage  
        const usesContactName = response.includes('Personal AI');
        console.log(`  • Contact Name: ${usesContactName ? '✅ FIXED' : '❌ NOT FIXED'}`);
        
        // Fix 3: Urgent Response (for second message)
        if (scenario.message.includes('urgente')) {
          const handlesUrgency = response.includes('urgente') || response.includes('inmediatamente') || response.includes('avisar');
          console.log(`  • Urgent Handling: ${handlesUrgency ? '✅ FIXED' : '❌ NOT FIXED'}`);
        }
        
        // Additional checks
        const isSpanish = /[ñáéíóúü]/.test(response) || response.includes('Hola') || response.includes('Soy');
        console.log(`  • Spanish Language: ${isSpanish ? '✅ CORRECT' : '❌ INCORRECT'}`);
        
      } else {
        console.log('\n❌ CRITICAL ERROR: Analysis says no response needed!');
      }
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
    
    console.log('\n' + '═'.repeat(80));
  }

  // Test 3: Template fallback (should use new PAI template)
  console.log('\n🎯 Template Fallback Test:');
  try {
    const template = await assistantService.generateAutoResponse('Personal AI');
    console.log(`Template: "${template}"`);
    
    const templateHasPAI = template.includes('PAI');
    const templateUsesName = template.includes('Personal AI');
    
    console.log(`✅ Template Verification:`);
    console.log(`  • Uses PAI identity: ${templateHasPAI ? '✅ FIXED' : '❌ NOT FIXED'}`);
    console.log(`  • Uses contact name: ${templateUsesName ? '✅ FIXED' : '❌ NOT FIXED'}`);
  } catch (error) {
    console.error('❌ Template test failed:', error.message);
  }

  console.log('\n🎯 Summary: PAI Conversation Fix Testing Complete!');
  console.log('The system should now:');
  console.log('✅ Always identify as PAI (not generic "asistente")');
  console.log('✅ Continue conversations after urgent requests');
  console.log('✅ Use contact names in greetings');
  console.log('✅ Handle urgent requests with appropriate priority');
}

// Enhanced logging for debugging
const originalLog = logger.info;
logger.info = function(message, meta) {
  if (meta && (meta.message === 'Message analyzed by AI' || meta.message === 'AI contextual response generated')) {
    console.log(`🔍 ${message}:`, meta);
  }
  return originalLog.call(this, message, meta);
};

// Run the test
testConversationFixes().catch((error) => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});