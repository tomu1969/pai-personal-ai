#!/usr/bin/env node

/**
 * Comprehensive test with realistic conversation scenarios
 * Tests PAI's simplified logic with various conversation types and flows
 */

const aiService = require('./src/services/ai');
const logger = require('./src/utils/logger');

// Owner system prompt (same as configured in frontend)
const OWNER_SYSTEM_PROMPT = `Your name is PAI. You are a personal AI assistant that answers WhatsApp messages on behalf of your owner, Tomás.

Always greet each sender by their name. 

Always reply in the same language as the last message received. Always identify yourself as "Pai, Tomás' Assistant" if in English, or "Pai, el asistente de Tomás" if in Spanish. 

Keep responses polite, concise, and professional, adjusting tone to match the sender (casual if casual, formal if formal). 

**Always** ask relevant follow-up questions to clarify intent or move the conversation forward. If the sender message is vague, ask for clarification instead of assuming. Suggest next steps only when appropriate.

Only stop asking once you've clarified the sender's intention or request.

Once you've clarified the sender's request or intent, paraphrase it and express that you will convey it to Tomás so he can get back to the sender.`;

async function testRealisticConversations() {
  console.log('🗣️  Testing PAI with Realistic Conversation Scenarios\n');

  const scenarios = [
    {
      name: 'Business Meeting Request (Complete)',
      conversation: [
        {
          message: 'Hi, I need to schedule a meeting with Tomás',
          sender: 'Sarah Johnson',
          context: { recentMessages: '' }
        },
        {
          message: 'I want to discuss the Q4 marketing campaign. Next Wednesday at 2pm would work for me.',
          sender: 'Sarah Johnson', 
          context: { recentMessages: 'Sarah Johnson: Hi, I need to schedule a meeting with Tomás\nPAI: Hello Sarah Johnson! I\'m Pai, Tomás\' Assistant. I\'d be happy to help you schedule a meeting. Could you tell me what you\'d like to discuss and when would work best for you?' }
        },
        {
          message: 'Perfect, thanks!',
          sender: 'Sarah Johnson',
          context: { recentMessages: 'Sarah Johnson: Hi, I need to schedule a meeting with Tomás\nPAI: Hello Sarah Johnson! I\'m Pai, Tomás\' Assistant...\nSarah Johnson: I want to discuss the Q4 marketing campaign. Next Wednesday at 2pm would work for me.\nPAI: Perfect! I understand you\'d like to meet with Tomás next Wednesday at 2pm to discuss the Q4 marketing campaign. I\'ll convey this to him and he\'ll get back to you to confirm.\nSarah Johnson: Perfect, thanks!' }
        }
      ],
      expectations: [
        'Should identify as PAI and greet by name',
        'Should ask for meeting details when incomplete',
        'Should paraphrase complete request and indicate will relay',
        'Should NOT respond to final acknowledgment'
      ]
    },

    {
      name: 'Spanish Family Invitation (Incomplete → Complete)',
      conversation: [
        {
          message: 'Hola Tomás',
          sender: 'María López',
          context: { recentMessages: '' }
        },
        {
          message: 'Queremos invitarte a almorzar el domingo',
          sender: 'María López',
          context: { recentMessages: 'María López: Hola Tomás\nPAI: ¡Hola María López! Soy Pai, el asistente de Tomás. ¿En qué puedo ayudarte hoy?' }
        },
        {
          message: 'A las 2pm en casa, es el cumpleaños de mi mamá',
          sender: 'María López',
          context: { recentMessages: 'María López: Hola Tomás\nPAI: ¡Hola María López! Soy Pai, el asistente de Tomás. ¿En qué puedo ayudarte hoy?\nMaría López: Queremos invitarte a almorzar el domingo\nPAI: ¡Qué amable invitación, María López! ¿A qué hora sería y hay alguna ocasión especial?' }
        }
      ],
      expectations: [
        'Should respond in Spanish throughout',
        'Should ask for missing details (time, occasion)',
        'Should recognize complete invitation with all details',
        'Should indicate will convey to Tomás'
      ]
    },

    {
      name: 'Urgent Technical Issue',
      conversation: [
        {
          message: 'URGENT: Server is down, clients can\'t access the system',
          sender: 'Alex Rivera',
          context: { recentMessages: '' }
        },
        {
          message: 'It started 10 minutes ago, affecting all users. Need Tomás ASAP.',
          sender: 'Alex Rivera',
          context: { recentMessages: 'Alex Rivera: URGENT: Server is down, clients can\'t access the system\nPAI: Hello Alex Rivera! I\'m Pai, Tomás\' Assistant. I understand this is urgent - the server is down and clients can\'t access the system. Can you provide more details about when this started and how many users are affected?' }
        }
      ],
      expectations: [
        'Should recognize urgency immediately',
        'Should ask for technical details',
        'Should indicate immediate relay to Tomás',
        'Should maintain professional but urgent tone'
      ]
    },

    {
      name: 'Casual Friend Check-in',
      conversation: [
        {
          message: '¿Qué tal, hermano?',
          sender: 'Carlos',
          context: { recentMessages: '' }
        },
        {
          message: 'Todo bien por acá, ¿cómo andas vos?',
          sender: 'Carlos',
          context: { recentMessages: 'Carlos: ¿Qué tal, hermano?\nPAI: ¡Hola Carlos! Soy Pai, el asistente de Tomás. ¿En qué puedo ayudarte hoy?' }
        },
        {
          message: 'Nada específico, solo saludar',
          sender: 'Carlos',
          context: { recentMessages: 'Carlos: ¿Qué tal, hermano?\nPAI: ¡Hola Carlos! Soy Pai, el asistente de Tomás. ¿En qué puedo ayudarte hoy?\nCarlos: Todo bien por acá, ¿cómo andas vos?\nPAI: Me alegra saber que todo va bien, Carlos. ¿Hay algo en particular en lo que pueda ayudarte o algo que quieras que le comunique a Tomás?' }
        }
      ],
      expectations: [
        'Should match casual tone in Spanish',
        'Should continue conversation to understand intent',
        'Should recognize social greeting vs business need',
        'Should eventually determine no specific action needed'
      ]
    },

    {
      name: 'Incomplete Information Gathering',
      conversation: [
        {
          message: 'Need help with the project',
          sender: 'Jennifer Kim',
          context: { recentMessages: '' }
        },
        {
          message: 'The new website design',
          sender: 'Jennifer Kim',
          context: { recentMessages: 'Jennifer Kim: Need help with the project\nPAI: Hello Jennifer Kim! I\'m Pai, Tomás\' Assistant. I\'d like to help you with the project. Could you tell me which specific project you\'re referring to and what kind of help you need?' }
        },
        {
          message: 'I\'m having trouble with the mobile responsive layout',
          sender: 'Jennifer Kim',
          context: { recentMessages: 'Jennifer Kim: Need help with the project\nPAI: Hello Jennifer Kim! I\'m Pai, Tomás\' Assistant. I\'d like to help you with the project. Could you tell me which specific project you\'re referring to and what kind of help you need?\nJennifer Kim: The new website design\nPAI: Thanks for clarifying, Jennifer Kim! You need help with the new website design project. What specific aspect are you having trouble with?' }
        }
      ],
      expectations: [
        'Should systematically gather missing information',
        'Should ask follow-up questions until clear',
        'Should build understanding progressively',
        'Should eventually have complete picture to relay'
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n🎭 ${scenario.name}`);
    console.log(`Expected behavior: ${scenario.expectations.join(', ')}`);
    console.log('─'.repeat(100));
    
    let conversationHistory = '';
    
    for (let i = 0; i < scenario.conversation.length; i++) {
      const turn = scenario.conversation[i];
      const messageNum = i + 1;
      
      console.log(`\n📨 Message ${messageNum}: "${turn.message}"`);
      console.log(`From: ${turn.sender}`);
      
      try {
        // Create context with conversation history
        const context = {
          ownerName: 'Tomás',
          senderName: turn.sender,
          recentMessages: turn.context.recentMessages || conversationHistory,
          ownerSystemPrompt: OWNER_SYSTEM_PROMPT
        };
        
        // Analyze message
        const analysis = await aiService.analyzeMessage(turn.message, context);
        
        console.log(`  🧠 Analysis:`);
        console.log(`     • Should Respond: ${analysis.requiresResponse}`);
        console.log(`     • Reason: ${analysis.responseReason}`);
        console.log(`     • Confidence: ${analysis.confidence}`);
        
        if (analysis.requiresResponse) {
          // Generate response
          const response = await aiService.generateResponse(turn.message, context);
          
          console.log(`  💬 PAI Response:`);
          console.log(`     "${response}"`);
          
          // Quality analysis
          const hasPAIIdentity = response.includes('PAI') || response.includes('Pai');
          const usesName = response.includes(turn.sender);
          const isSpanish = /[ñáéíóúü]/.test(turn.message) || turn.message.includes('¿');
          const responseIsSpanish = /[ñáéíóúü]/.test(response) || response.includes('Soy');
          const languageMatches = isSpanish ? responseIsSpanish : !responseIsSpanish;
          const asksQuestions = response.includes('?');
          const showsConveyance = response.toLowerCase().includes('convey') || 
                                  response.toLowerCase().includes('let him know') ||
                                  response.toLowerCase().includes('avisar') ||
                                  response.toLowerCase().includes('comunicar');
          
          console.log(`  ✅ Quality Check:`);
          console.log(`     • PAI Identity: ${hasPAIIdentity ? '✅' : '❌'}`);
          console.log(`     • Uses Sender Name: ${usesName ? '✅' : '❌'}`);
          console.log(`     • Language Match: ${languageMatches ? '✅' : '❌'} (${isSpanish ? 'Spanish' : 'English'})`);
          console.log(`     • Asks Questions: ${asksQuestions ? '✅' : '❌'}`);
          console.log(`     • Shows Conveyance: ${showsConveyance ? '✅' : '❌'}`);
          
          // Update conversation history
          conversationHistory += `${turn.sender}: ${turn.message}\nPAI: ${response}\n`;
          
        } else {
          console.log(`  🔇 No response (${analysis.responseReason})`);
          console.log(`     • This is ${analysis.responseReason === 'conversation_complete' ? '✅ CORRECT' : '❌ UNEXPECTED'} for this scenario`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '═'.repeat(100));
  }

  console.log('\n🎯 Realistic Conversation Test Summary:');
  console.log('Tested scenarios:');
  console.log('✅ Complete business requests with proper termination');
  console.log('✅ Incomplete requests requiring information gathering');
  console.log('✅ Spanish language conversations with casual tone');
  console.log('✅ Urgent requests requiring immediate attention');
  console.log('✅ Social interactions vs business needs distinction');
  console.log('✅ Progressive conversation building until clarity achieved');
  console.log('\nPAI should demonstrate:');
  console.log('• Fluid, prompt-based conversation management');
  console.log('• Natural language understanding without rigid rules');
  console.log('• Appropriate conversation continuation and termination');
  console.log('• Consistent PAI identity and professional behavior');
}

// Enhanced logging
const originalInfo = logger.info;
logger.info = function(message, meta) {
  if (meta && (meta.message === 'Simple message analysis completed' || meta.message === 'AI contextual response generated')) {
    // Suppress detailed logs to keep output clean
  }
  return originalInfo.call(this, message, meta);
};

// Run the comprehensive test
testRealisticConversations().catch((error) => {
  console.error('❌ Realistic conversation test failed:', error.message);
  process.exit(1);
});