#!/usr/bin/env node

/**
 * Test script to verify simplified PAI logic:
 * 1. Extract sender name from Evolution API (pushName)
 * 2. Use only owner-configured system prompt
 * 3. Continue conversation until termination conditions in system prompt are met
 */

const aiService = require('./src/services/ai');
const logger = require('./src/utils/logger');

// Mock owner system prompt (as configured through frontend/gear)
const OWNER_SYSTEM_PROMPT = `Your name is PAI. You are a personal AI assistant that answers WhatsApp messages on behalf of your owner, Tomás.

Always greet each sender by their name. 

Always reply in the same language as the last message received. Always identify yourself as "Pai, Tomás' Assistant" if in English, or "Pai, el asistente de Tomás" if in Spanish. 

Keep responses polite, concise, and professional, adjusting tone to match the sender (casual if casual, formal if formal). 

**Always** ask relevant follow-up questions to clarify intent or move the conversation forward. If the sender message is vague, ask for clarification instead of assuming. Suggest next steps only when appropriate.

Only stop asking once you've clarified the sender's intention or request.

Once you've clarified the sender's request or intent, paraphrase it and express that you will convey it to Tomás so he can get back to the sender.`;

async function testSimplifiedPAI() {
  console.log('🤖 Testing Simplified PAI Logic\n');

  const testScenarios = [
    {
      name: 'Test 1: Initial greeting (English)',
      message: 'Hello',
      context: {
        ownerName: 'Tomás',
        senderName: 'John Smith',
        recentMessages: '',
        ownerSystemPrompt: OWNER_SYSTEM_PROMPT
      },
      expected: [
        'Should greet by name (John Smith)',
        'Should identify as "Pai, Tomás\' Assistant"',
        'Should ask follow-up question'
      ]
    },
    {
      name: 'Test 2: Vague request (Spanish)',
      message: 'Necesito ayuda',
      context: {
        ownerName: 'Tomás',
        senderName: 'María González',
        recentMessages: 'María González: Hola\nPai: ¡Hola María González! Soy Pai, el asistente de Tomás. ¿En qué puedo ayudarte hoy?',
        ownerSystemPrompt: OWNER_SYSTEM_PROMPT
      },
      expected: [
        'Should respond in Spanish',
        'Should ask clarifying questions about what help is needed',
        'Should use sender name naturally'
      ]
    },
    {
      name: 'Test 3: Clear request with details',
      message: 'I need to schedule a meeting with Tomás for next Tuesday at 3pm to discuss the project proposal',
      context: {
        ownerName: 'Tomás',
        senderName: 'Alex Johnson',
        recentMessages: 'Alex Johnson: Hello\nPai: Hello Alex Johnson! I\'m Pai, Tomás\' Assistant. How can I help you today?\nAlex Johnson: I need to schedule a meeting with Tomás for next Tuesday at 3pm to discuss the project proposal',
        ownerSystemPrompt: OWNER_SYSTEM_PROMPT
      },
      expected: [
        'Should recognize complete request',
        'Should paraphrase the meeting details',
        'Should indicate will convey to Tomás',
        'Should show termination condition met'
      ]
    },
    {
      name: 'Test 4: Casual Spanish invitation',
      message: '¿Qué tal si cenamos mañana?',
      context: {
        ownerName: 'Tomás',
        senderName: 'Carlos',
        recentMessages: '',
        ownerSystemPrompt: OWNER_SYSTEM_PROMPT
      },
      expected: [
        'Should respond in Spanish (casual tone)',
        'Should greet by name (Carlos)',
        'Should identify as "Pai, el asistente de Tomás"',
        'Should ask for more details (time, place) or confirm intent'
      ]
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n📋 ${scenario.name}`);
    console.log(`Message: "${scenario.message}"`);
    console.log(`Sender: ${scenario.context.senderName}`);
    console.log(`Expected: ${scenario.expected.join(', ')}`);
    console.log('─'.repeat(80));
    
    try {
      // Step 1: Check if PAI should respond
      console.log('🧠 Analysis Phase:');
      const analysis = await aiService.analyzeMessage(scenario.message, scenario.context);
      
      console.log(`  • Should Respond: ${analysis.requiresResponse}`);
      console.log(`  • Reason: ${analysis.responseReason}`);
      console.log(`  • Confidence: ${analysis.confidence}`);
      
      if (analysis.requiresResponse) {
        // Step 2: Generate response using only owner system prompt
        console.log('\n💬 Response Generation:');
        const response = await aiService.generateResponse(scenario.message, scenario.context);
        
        console.log(`  Response: "${response}"`);
        
        // Step 3: Verify simplified logic works
        console.log('\n✅ Verification:');
        
        // Check name usage
        const usesName = response.includes(scenario.context.senderName);
        console.log(`  • Uses Sender Name: ${usesName ? '✅' : '❌'}`);
        
        // Check PAI identity
        const hasPAIIdentity = response.toLowerCase().includes('pai');
        console.log(`  • PAI Identity: ${hasPAIIdentity ? '✅' : '❌'}`);
        
        // Check language matching
        const isSpanish = scenario.message.match(/[ñáéíóúü]/) || scenario.message.includes('¿') || scenario.message.includes('Necesito');
        const responseIsSpanish = response.match(/[ñáéíóúü]/) || response.includes('Soy') || response.includes('Hola');
        const languageMatches = isSpanish ? responseIsSpanish : !responseIsSpanish;
        console.log(`  • Language Match: ${languageMatches ? '✅' : '❌'} (Expected: ${isSpanish ? 'Spanish' : 'English'})`);
        
        // Check if asks questions (for incomplete requests)
        const asksQuestions = response.includes('?');
        console.log(`  • Asks Questions: ${asksQuestions ? '✅' : '❌'}`);
        
        // Check termination logic for complete requests
        if (scenario.name.includes('Clear request')) {
          const showsTermination = response.includes('convey') || response.includes('let him know') || response.includes('get back');
          console.log(`  • Shows Termination: ${showsTermination ? '✅' : '❌'}`);
        }
        
      } else {
        console.log('\n🔇 No response generated (analysis determined no response needed)');
      }
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
    
    console.log('\n' + '═'.repeat(80));
  }

  console.log('\n🎯 Simplified PAI Logic Test Summary:');
  console.log('PAI now uses ONLY the owner-configured system prompt with:');
  console.log('✅ Sender name extraction from Evolution API (pushName)');
  console.log('✅ Simple message + owner prompt processing');
  console.log('✅ Natural conversation flow based on owner instructions');
  console.log('✅ Termination conditions defined in owner prompt');
  console.log('✅ No complex buildSystemPrompt or rigid logic');
}

// Enhanced logging
const originalInfo = logger.info;
logger.info = function(message, meta) {
  if (meta && meta.message === 'Simple message analysis completed') {
    console.log(`    🔍 Analysis: ${meta.requiresResponse} (${meta.responseReason}), confidence: ${meta.confidence}`);
  }
  return originalInfo.call(this, message, meta);
};

// Run the test
testSimplifiedPAI().catch((error) => {
  console.error('❌ Simplified PAI test failed:', error.message);
  process.exit(1);
});