#!/usr/bin/env node

/**
 * Test script to verify PAI's enhanced conversation flow:
 * - Continues conversation until sender's need is fully understood/resolved
 * - Asks clarifying questions for incomplete requests
 * - Stops responding only when there's clear closure or no response from sender
 */

const aiService = require('./src/services/ai');
const logger = require('./src/utils/logger');

async function testEnhancedConversationFlow() {
  console.log('🔄 Testing Enhanced PAI Conversation Flow\n');

  const conversationScenarios = [
    {
      name: 'Scenario 1: Vague Request → Should Ask for Clarification',
      messages: [
        {
          content: 'Hola',
          context: { ownerName: 'Tomás', senderName: 'Juan', recentMessages: '', isFirstMessage: true }
        },
        {
          content: 'Necesito ayuda',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Juan', 
            recentMessages: 'Juan: Hola\nPAI: Hola Juan! Soy PAI, el asistente personal de Tomás. ¿En qué puedo ayudarte hoy?\nJuan: Necesito ayuda',
            isFirstMessage: false 
          }
        }
      ],
      expectedBehavior: [
        'Should respond to greeting with PAI identity',
        'Should ask clarifying questions about what help is needed',
        'Should continue conversation until specific need is identified'
      ]
    },
    {
      name: 'Scenario 2: Incomplete Invitation → Should Request Details',
      messages: [
        {
          content: 'Hola',
          context: { ownerName: 'Tomás', senderName: 'Maria', recentMessages: '', isFirstMessage: true }
        },
        {
          content: 'Quería invitar a Tomás a cenar',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Maria', 
            recentMessages: 'Maria: Hola\nPAI: Hola Maria! Soy PAI, el asistente personal de Tomás. ¿En qué puedo ayudarte hoy?\nMaria: Quería invitar a Tomás a cenar',
            isFirstMessage: false 
          }
        }
      ],
      expectedBehavior: [
        'Should respond to greeting',
        'Should recognize invitation but ask for missing details (when, where, etc.)',
        'Should continue until complete invitation details are gathered'
      ]
    },
    {
      name: 'Scenario 3: Clear Closure → Should Stop Responding',
      messages: [
        {
          content: 'Hola',
          context: { ownerName: 'Tomás', senderName: 'Carlos', recentMessages: '', isFirstMessage: true }
        },
        {
          content: 'Necesito hablar con Tomás sobre el proyecto urgente',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Carlos', 
            recentMessages: 'Carlos: Hola\nPAI: Hola Carlos! Soy PAI, el asistente personal de Tomás. ¿En qué puedo ayudarte hoy?\nCarlos: Necesito hablar con Tomás sobre el proyecto urgente',
            isFirstMessage: false 
          }
        },
        {
          content: 'Perfecto, gracias',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Carlos', 
            recentMessages: 'Carlos: Hola\nPAI: Hola Carlos! Soy PAI...\nCarlos: Necesito hablar con Tomás sobre el proyecto urgente\nPAI: Hola Carlos, soy PAI. Entiendo que necesitas hablar con Tomás urgentemente sobre el proyecto. Le voy a avisar inmediatamente.\nCarlos: Perfecto, gracias',
            isFirstMessage: false 
          }
        }
      ],
      expectedBehavior: [
        'Should respond to greeting',
        'Should handle urgent request appropriately', 
        'Should NOT respond to "Perfecto, gracias" as it indicates clear closure'
      ]
    },
    {
      name: 'Scenario 4: Ongoing Information Gathering → Should Continue',
      messages: [
        {
          content: 'Hola',
          context: { ownerName: 'Tomás', senderName: 'Ana', recentMessages: '', isFirstMessage: true }
        },
        {
          content: 'Quiero organizar una reunión',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Ana', 
            recentMessages: 'Ana: Hola\nPAI: Hola Ana! Soy PAI, el asistente personal de Tomás. ¿En qué puedo ayudarte hoy?\nAna: Quiero organizar una reunión',
            isFirstMessage: false 
          }
        },
        {
          content: 'Para el viernes',
          context: { 
            ownerName: 'Tomás', 
            senderName: 'Ana', 
            recentMessages: 'Ana: Hola\nPAI: Hola Ana!...\nAna: Quiero organizar una reunión\nPAI: Soy PAI. Para poder ayudarte mejor, ¿podrías darme más detalles sobre la reunión? ¿Cuándo sería y sobre qué tema?\nAna: Para el viernes',
            isFirstMessage: false 
          }
        }
      ],
      expectedBehavior: [
        'Should respond to greeting',
        'Should ask for meeting details when request is incomplete',
        'Should continue gathering information (still needs time, topic, attendees, etc.)'
      ]
    }
  ];

  for (const scenario of conversationScenarios) {
    console.log(`\n🎭 ${scenario.name}`);
    console.log(`Expected: ${scenario.expectedBehavior.join(', ')}`);
    console.log('─'.repeat(100));
    
    for (let i = 0; i < scenario.messages.length; i++) {
      const message = scenario.messages[i];
      const messageNum = i + 1;
      
      console.log(`\n📨 Message ${messageNum}: "${message.content}"`);
      
      try {
        // Analyze the message
        const analysis = await aiService.analyzeMessage(message.content, message.context);
        
        console.log(`  🧠 Analysis:`);
        console.log(`     • Requires Response: ${analysis.requiresResponse}`);
        console.log(`     • Reason: ${analysis.responseReason}`);
        console.log(`     • Priority: ${analysis.priority}`);
        console.log(`     • Intent: ${analysis.intent}`);
        console.log(`     • Confidence: ${analysis.confidence}`);
        
        // Generate response if needed
        if (analysis.requiresResponse) {
          const response = await aiService.generateResponse(message.content, {
            ...message.context,
            analysis
          });
          
          console.log(`  💬 PAI Response: "${response}"`);
          
          // Analyze response quality
          const hasPAIIdentity = response.includes('PAI');
          const usesName = response.includes(message.context.senderName);
          const asksQuestion = response.includes('?');
          
          console.log(`  ✅ Quality Check:`);
          console.log(`     • PAI Identity: ${hasPAIIdentity ? '✅' : '❌'}`);
          console.log(`     • Uses Name: ${usesName ? '✅' : '❌'}`);
          console.log(`     • Asks Questions: ${asksQuestion ? '✅' : '❌'}`);
          
        } else {
          console.log(`  🔇 No response (${analysis.responseReason})`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '═'.repeat(100));
  }

  console.log('\n🎯 Enhanced Conversation Flow Test Summary:');
  console.log('PAI should now:');
  console.log('✅ Continue conversations until sender\'s need is fully understood');
  console.log('✅ Ask clarifying questions for incomplete requests');
  console.log('✅ Gather complete information before relaying to owner');
  console.log('✅ Stop responding only when there\'s clear closure or complete information');
  console.log('✅ Act as an intelligent intermediary, not just a message relay');
}

// Enhanced logging
const originalInfo = logger.info;
logger.info = function(message, meta) {
  if (meta && meta.message === 'Message analyzed by AI') {
    console.log(`    🔍 AI Analysis: ${meta.tokensUsed} tokens, confidence: ${meta.confidence}`);
  } else if (meta && meta.message === 'AI contextual response generated') {
    console.log(`    🤖 Response Generated: ${meta.responseLength} chars, ${meta.tokensUsed} tokens`);
  }
  return originalInfo.call(this, message, meta);
};

// Run the test
testEnhancedConversationFlow().catch((error) => {
  console.error('❌ Enhanced conversation test failed:', error.message);
  process.exit(1);
});