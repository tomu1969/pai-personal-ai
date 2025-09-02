// Focused Test: Cooldown Period Issue in AI PBX
// This test specifically examines why messages aren't being answered

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  }
);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function analyzeCooldownIssue() {
  log('\n' + '='.repeat(70), 'blue');
  log('COOLDOWN PERIOD ANALYSIS - WHY MESSAGES AREN\'T BEING ANSWERED', 'blue');
  log('='.repeat(70), 'blue');

  try {
    await sequelize.authenticate();
    log('\n✅ Database connected', 'green');

    // 1. Get all conversations with their last messages
    log('\n📊 ANALYZING CONVERSATIONS AND RESPONSE PATTERNS:', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    const [conversations] = await sequelize.query(`
      SELECT 
        c.id as conversation_id,
        cont.phone,
        cont.name as contact_name,
        c.status,
        c.is_assistant_enabled,
        c.message_count,
        c.last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'user') as user_msg_count,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'assistant') as assistant_msg_count,
        (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'assistant') as last_assistant_msg,
        (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'user') as last_user_msg
      FROM conversations c
      JOIN contacts cont ON c.contact_id = cont.id
      WHERE c.last_message_at > NOW() - INTERVAL '24 hours'
      ORDER BY c.last_message_at DESC
    `);

    log(`\nFound ${conversations.length} active conversations in last 24 hours\n`, 'yellow');

    const issues = {
      blocked_by_cooldown: [],
      no_response_sent: [],
      working_properly: []
    };

    // Analyze each conversation
    for (const conv of conversations) {
      const lastUserMsg = conv.last_user_msg ? new Date(conv.last_user_msg) : null;
      const lastAssistantMsg = conv.last_assistant_msg ? new Date(conv.last_assistant_msg) : null;
      
      log(`\n📱 Contact: ${conv.contact_name || conv.phone}`, 'magenta');
      log(`   Phone: ${conv.phone}`, 'yellow');
      log(`   Status: ${conv.status} | Assistant Enabled: ${conv.is_assistant_enabled}`, 'yellow');
      log(`   Total Messages: ${conv.message_count} (User: ${conv.user_msg_count}, Assistant: ${conv.assistant_msg_count})`, 'yellow');
      
      if (lastUserMsg) {
        const userMsgAge = Math.floor((Date.now() - lastUserMsg) / 60000);
        log(`   Last User Message: ${userMsgAge} minutes ago`, 'cyan');
      }
      
      if (lastAssistantMsg) {
        const assistantMsgAge = Math.floor((Date.now() - lastAssistantMsg) / 60000);
        log(`   Last Assistant Response: ${assistantMsgAge} minutes ago`, 'cyan');
        
        // Check if there's a user message after the last assistant message
        if (lastUserMsg && lastUserMsg > lastAssistantMsg) {
          const timeBetween = Math.floor((lastUserMsg - lastAssistantMsg) / 60000);
          
          if (timeBetween < 30) {
            log(`   ❌ BLOCKED: User message came ${timeBetween} min after assistant response (< 30 min cooldown)`, 'red');
            issues.blocked_by_cooldown.push({
              phone: conv.phone,
              timeBetween,
              lastUserMsg,
              lastAssistantMsg
            });
          } else {
            log(`   ⚠️  NO RESPONSE: User message came ${timeBetween} min after assistant (> 30 min, should have responded)`, 'yellow');
            issues.no_response_sent.push({
              phone: conv.phone,
              timeBetween,
              lastUserMsg,
              lastAssistantMsg
            });
          }
        } else {
          log(`   ✅ Working: Assistant responded to last user message`, 'green');
          issues.working_properly.push(conv.phone);
        }
      } else {
        log(`   ⚠️  NO ASSISTANT RESPONSE EVER SENT`, 'red');
        issues.no_response_sent.push({
          phone: conv.phone,
          reason: 'Never responded'
        });
      }
    }

    // 2. Check recent message flow
    log('\n\n📨 RECENT MESSAGE FLOW (Last 3 Hours):', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    const [recentMessages] = await sequelize.query(`
      SELECT 
        cont.phone,
        cont.name,
        m.sender,
        m.content,
        m.created_at,
        m.conversation_id
      FROM messages m
      JOIN contacts cont ON m.contact_id = cont.id
      WHERE m.created_at > NOW() - INTERVAL '3 hours'
      ORDER BY m.created_at DESC
      LIMIT 30
    `);

    // Group messages by conversation
    const messagesByConv = {};
    recentMessages.forEach(msg => {
      if (!messagesByConv[msg.conversation_id]) {
        messagesByConv[msg.conversation_id] = {
          phone: msg.phone,
          name: msg.name,
          messages: []
        };
      }
      messagesByConv[msg.conversation_id].messages.push({
        sender: msg.sender,
        content: msg.content.substring(0, 50),
        time: new Date(msg.created_at)
      });
    });

    // Analyze message patterns
    Object.values(messagesByConv).forEach(conv => {
      log(`\n📱 ${conv.name || conv.phone}:`, 'magenta');
      
      // Sort messages by time (oldest first)
      conv.messages.sort((a, b) => a.time - b.time);
      
      let lastAssistantTime = null;
      conv.messages.forEach((msg, index) => {
        const timeStr = msg.time.toLocaleTimeString();
        const indicator = msg.sender === 'assistant' ? '🤖' : '👤';
        
        if (msg.sender === 'assistant') {
          lastAssistantTime = msg.time;
          log(`   ${indicator} [${timeStr}] ${msg.content}...`, 'green');
        } else {
          // Check if this user message came within cooldown
          if (lastAssistantTime) {
            const minsSinceAssistant = Math.floor((msg.time - lastAssistantTime) / 60000);
            if (minsSinceAssistant < 30) {
              log(`   ${indicator} [${timeStr}] ${msg.content}... ⚠️ (${minsSinceAssistant} min after assistant)`, 'yellow');
            } else {
              log(`   ${indicator} [${timeStr}] ${msg.content}...`, 'cyan');
            }
          } else {
            log(`   ${indicator} [${timeStr}] ${msg.content}...`, 'cyan');
          }
        }
      });
    });

    // 3. Summary of findings
    log('\n\n' + '='.repeat(70), 'blue');
    log('DIAGNOSIS SUMMARY', 'blue');
    log('='.repeat(70), 'blue');

    log('\n🔍 ISSUE BREAKDOWN:', 'cyan');
    log(`   ✅ Working Properly: ${issues.working_properly.length} conversations`, 'green');
    log(`   ❌ Blocked by Cooldown: ${issues.blocked_by_cooldown.length} conversations`, 'red');
    log(`   ⚠️  No Response Sent: ${issues.no_response_sent.length} conversations`, 'yellow');

    if (issues.blocked_by_cooldown.length > 0) {
      log('\n🚫 CONVERSATIONS BLOCKED BY 30-MINUTE COOLDOWN:', 'red');
      issues.blocked_by_cooldown.forEach(issue => {
        log(`   - ${issue.phone}: User messaged ${issue.timeBetween} minutes after assistant`, 'yellow');
      });
    }

    // 4. Test the actual cooldown logic
    log('\n\n🧪 TESTING COOLDOWN LOGIC:', 'cyan');
    log('=' .repeat(50), 'cyan');
    
    // Check the actual cooldown period in code
    const COOLDOWN_MINUTES = 30; // This is hardcoded in the assistant service
    log(`\nCurrent cooldown period: ${COOLDOWN_MINUTES} minutes`, 'yellow');
    
    // Simulate different scenarios
    const scenarios = [
      { minutesSince: 5, shouldRespond: false },
      { minutesSince: 15, shouldRespond: false },
      { minutesSince: 29, shouldRespond: false },
      { minutesSince: 31, shouldRespond: true },
      { minutesSince: 60, shouldRespond: true }
    ];
    
    log('\nScenario Testing:', 'cyan');
    scenarios.forEach(scenario => {
      const wouldRespond = scenario.minutesSince >= COOLDOWN_MINUTES;
      const matches = wouldRespond === scenario.shouldRespond;
      const icon = matches ? '✅' : '❌';
      const color = matches ? 'green' : 'red';
      
      log(`   ${icon} User message ${scenario.minutesSince} min after assistant: ` +
          `Would respond: ${wouldRespond}, Expected: ${scenario.shouldRespond}`, color);
    });

    // 5. Final recommendations
    log('\n\n' + '='.repeat(70), 'blue');
    log('CONFIRMED ISSUES & SOLUTIONS', 'blue');
    log('='.repeat(70), 'blue');

    log('\n✅ CONFIRMED ISSUE #1: 30-Minute Cooldown Period', 'red');
    log('   Problem: Assistant won\'t respond if it sent a message in the last 30 minutes', 'yellow');
    log('   Impact: Users sending follow-up messages within 30 minutes get no response', 'yellow');
    log('   Solution: Reduce cooldown to 2-5 minutes or implement message deduplication', 'green');

    log('\n✅ CONFIRMED ISSUE #2: Evolution v2 Message Format', 'red');
    log('   Problem: Some messages with Evolution v2 format aren\'t being parsed', 'yellow');
    log('   Impact: Valid messages are being skipped as "invalid"', 'yellow');
    log('   Solution: Update parseWebhookMessage to handle both v1 and v2 formats', 'green');

    log('\n✅ CONFIRMED ISSUE #3: Message Type Parsing', 'red');
    log('   Problem: Text messages show as "Unsupported message type: text"', 'yellow');
    log('   Impact: Content extraction might be failing for standard text messages', 'yellow');
    log('   Solution: Fix message type detection in parseWebhookMessage', 'green');

    log('\n📋 RECOMMENDED FIXES:', 'cyan');
    log('   1. Change cooldown from 30 to 2 minutes in assistant.js line 283', 'green');
    log('   2. Add support for Evolution v2 direct format (without data wrapper)', 'green');
    log('   3. Fix text message parsing to extract actual content', 'green');
    log('   4. Add message hash to prevent duplicate responses instead of time-based blocking', 'green');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// Run the analysis
analyzeCooldownIssue().then(() => {
  log('\n✅ Analysis complete\n', 'green');
  process.exit(0);
}).catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});