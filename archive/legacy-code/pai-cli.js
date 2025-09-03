#!/usr/bin/env node

/**
 * PAI CLI - Interactive Command Line Interface for Personal AI
 * Chat with your PAI assistant directly from the terminal
 */

const readline = require('readline');
const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const API_BASE_URL = process.env.PAI_API_URL || 'http://localhost:3000';
const ASSISTANT_CONVERSATION_ID = process.env.PAI_CONVERSATION_ID || '00000000-0000-0000-0000-000000000001';
const PAI_HOME = path.join(os.homedir(), '.pai');
const HISTORY_FILE = path.join(PAI_HOME, 'chat-history.json');

// API Endpoints - configurable via environment variables
const ENDPOINTS = {
  CHAT_MESSAGES: process.env.PAI_ENDPOINT_CHAT_MESSAGES || '/api/chat',
  ASSISTANT_CONFIG: process.env.PAI_ENDPOINT_ASSISTANT_CONFIG || '/api/assistant/config',
  WHATSAPP_STATUS: process.env.PAI_ENDPOINT_WHATSAPP_STATUS || '/api/whatsapp/status',
  HEALTH: process.env.PAI_ENDPOINT_HEALTH || '/health'
};

// Create axios client
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Chat history management
let chatHistory = [];

function loadChatHistory() {
  try {
    // Ensure PAI home directory exists
    if (!fs.existsSync(PAI_HOME)) {
      fs.mkdirSync(PAI_HOME, { recursive: true });
    }
    
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      chatHistory = JSON.parse(data);
    }
  } catch (error) {
    console.log(chalk.gray('Starting with fresh chat history'));
    chatHistory = [];
  }
}

function saveChatHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
  } catch (error) {
    console.log(chalk.yellow('Warning: Could not save chat history'));
  }
}

function addToHistory(role, message) {
  chatHistory.push({
    role,
    message,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 50 messages to prevent file from growing too large
  if (chatHistory.length > 50) {
    chatHistory = chatHistory.slice(-50);
  }
  
  saveChatHistory();
}

// API functions
async function sendMessageToPAI(message) {
  let sentMessageTimestamp = null;
  
  try {
    // Send the message
    console.log(chalk.gray(`📤 Sending message to ${ASSISTANT_CONVERSATION_ID}...`));
    const sendResponse = await apiClient.post(`${ENDPOINTS.CHAT_MESSAGES}/${ASSISTANT_CONVERSATION_ID}/messages`, {
      content: message,
      sender: 'user'
    });
    
    console.log(chalk.gray(`✓ Message sent successfully (${sendResponse.status})`));
    sentMessageTimestamp = Date.now();
    
    // Poll for assistant response with exponential backoff
    const maxWaitTime = 20000; // 20 seconds
    const startTime = Date.now();
    let attempt = 0;
    let lastAssistantMessage = null;
    
    console.log(chalk.gray(`🔍 Polling for assistant response (sent at ${new Date(sentMessageTimestamp).toLocaleTimeString()})...`));
    
    while (Date.now() - startTime < maxWaitTime) {
      attempt++;
      
      try {
        const messagesResponse = await apiClient.get(`${ENDPOINTS.CHAT_MESSAGES}/${ASSISTANT_CONVERSATION_ID}`);
        const messages = messagesResponse.data.messages || [];
        
        // Log current polling state  
        const assistantMessages = messages.filter(msg => msg.sender === 'assistant');
        const recentMessages = assistantMessages.filter(msg => new Date(msg.createdAt).getTime() > sentMessageTimestamp);
        
        console.log(chalk.gray(`   Attempt ${attempt}: Found ${assistantMessages.length} total assistant messages, ${recentMessages.length} recent ones`));
        
        // Find assistant messages created after we sent our message
        const recentAssistantMessages = messages
          .filter(msg => msg.sender === 'assistant')
          .filter(msg => new Date(msg.createdAt).getTime() > sentMessageTimestamp)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (recentAssistantMessages.length > 0) {
          const assistantMessage = recentAssistantMessages[0];
          if (!lastAssistantMessage || assistantMessage.id !== lastAssistantMessage.id) {
            console.log(chalk.gray(`✓ Found assistant response after ${Date.now() - startTime}ms`));
            return {
              success: true,
              message: assistantMessage
            };
          }
        }
        
        // Exponential backoff: 500ms, 1000ms, 1500ms, 2000ms, then 2000ms
        const delay = Math.min(500 + (attempt * 500), 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (pollError) {
        // Log polling error but continue trying
        console.log(chalk.gray(`Polling attempt ${attempt} failed: ${pollError.message}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Timeout reached
    return {
      success: false,
      message: {
        content: "I'm taking longer than usual to respond. The message was sent, but the response may appear in your next session.",
        sender: 'system'
      }
    };
    
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data.message || error.response.data.error || 'Unknown error'}`);
    } else if (error.request) {
      throw new Error('Cannot connect to PAI API. Make sure the backend server is running on port 3000.');
    } else {
      throw new Error(`Request Error: ${error.message}`);
    }
  }
}

async function getAssistantConfig() {
  try {
    const response = await apiClient.get(ENDPOINTS.ASSISTANT_CONFIG);
    return response.data;
  } catch (error) {
    return null;
  }
}

async function getConversationMessages() {
  try {
    const response = await apiClient.get(`${ENDPOINTS.CHAT_MESSAGES}/${ASSISTANT_CONVERSATION_ID}?limit=10`);
    return response.data.messages || [];
  } catch (error) {
    return [];
  }
}

async function ensureConversationExists() {
  try {
    const response = await apiClient.get(`${ENDPOINTS.CHAT_MESSAGES}/${ASSISTANT_CONVERSATION_ID}`);
    if (response.data && response.data.conversation) {
      return { exists: true, conversation: response.data.conversation };
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { exists: false, error: 'Conversation not found' };
    }
    return { exists: false, error: error.message };
  }
  return { exists: false, error: 'Unknown error' };
}

// CLI Interface
class PAIChatCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });
    
    this.setupSignalHandlers();
    this.isWaitingForResponse = false;
  }

  setupSignalHandlers() {
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Goodbye! Your chat history has been saved.'));
      this.rl.close();
      process.exit(0);
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log(chalk.gray('\n🔄 PAI CLI is shutting down...'));
      this.rl.close();
      process.exit(0);
    });
    
    // Handle readline SIGINT as backup
    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Goodbye! Your chat history has been saved.'));
      this.rl.close();
      process.exit(0);
    });
  }

  async start() {
    await this.displayWelcome();
    await this.displayRecentMessages();
    this.startChatLoop();
  }

  async displayWelcome() {
    console.log(chalk.cyan('\n==========================================='));
    console.log(chalk.cyan('🤖 PAI CLI - Personal AI Assistant'));
    console.log(chalk.cyan('==========================================='));
    
    // Check conversation exists
    const conversationCheck = await ensureConversationExists();
    if (!conversationCheck.exists) {
      console.log(chalk.yellow(`⚠ Warning: Assistant conversation (${ASSISTANT_CONVERSATION_ID}) not accessible`));
      console.log(chalk.gray(`   Error: ${conversationCheck.error}`));
      console.log(chalk.gray('   You can still use the CLI, but responses may not work correctly.\n'));
    }
    
    // Get assistant configuration
    const config = await getAssistantConfig();
    if (config) {
      console.log(chalk.gray(`Assistant: ${config.ownerName || 'PAI'}'s Personal AI`));
      console.log(chalk.gray(`Status: ${config.enabled ? 'Active' : 'Inactive'}`));
    }
    
    console.log(chalk.gray('\nCommands:'));
    console.log(chalk.gray('  /help     - Show help'));
    console.log(chalk.gray('  /history  - Show recent chat history'));
    console.log(chalk.gray('  /clear    - Clear screen'));
    console.log(chalk.gray('  /status   - Show PAI status'));
    console.log(chalk.gray('  /exit     - Exit CLI'));
    console.log(chalk.gray('\nPress Ctrl+C to exit anytime\n'));
  }

  async displayRecentMessages() {
    const messages = await getConversationMessages();
    if (messages.length > 0) {
      console.log(chalk.gray('--- Recent conversation ---'));
      messages.slice(-5).forEach(msg => {
        const isUser = msg.sender === 'user';
        const color = isUser ? chalk.blue : chalk.green;
        const sender = isUser ? 'You' : 'PAI';
        const time = new Date(msg.createdAt).toLocaleTimeString();
        console.log(color(`${sender} [${time}]: ${msg.content}`));
      });
      console.log(chalk.gray('--- End recent conversation ---\n'));
    }
  }

  startChatLoop() {
    this.rl.prompt();
    
    this.rl.on('line', async (input) => {
      const message = input.trim();
      
      if (!message) {
        this.rl.prompt();
        return;
      }

      // Handle commands
      if (message.startsWith('/')) {
        await this.handleCommand(message);
        this.rl.prompt();
        return;
      }

      // Send message to PAI
      await this.sendMessage(message);
      this.rl.prompt();
    });
  }

  async handleCommand(command) {
    const [cmd, ...args] = command.toLowerCase().split(' ');
    
    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      
      case '/history':
        this.showHistory();
        break;
      
      case '/clear':
        console.clear();
        await this.displayWelcome();
        break;
      
      case '/status':
        await this.showStatus();
        break;
      
      case '/exit':
      case '/quit':
        console.log(chalk.yellow('Goodbye! 👋'));
        process.exit(0);
        break;
      
      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        this.showHelp();
    }
  }

  showHelp() {
    console.log(chalk.cyan('\nAvailable Commands:'));
    console.log(chalk.gray('  /help     - Show this help message'));
    console.log(chalk.gray('  /history  - Show local chat history'));
    console.log(chalk.gray('  /clear    - Clear screen and show welcome'));
    console.log(chalk.gray('  /status   - Show PAI system status'));
    console.log(chalk.gray('  /exit     - Exit the CLI'));
    console.log(chalk.gray('\nJust type your message and press Enter to chat with PAI!\n'));
  }

  showHistory() {
    console.log(chalk.cyan('\n--- Local Chat History ---'));
    if (chatHistory.length === 0) {
      console.log(chalk.gray('No chat history found.'));
    } else {
      chatHistory.slice(-10).forEach(entry => {
        const color = entry.role === 'user' ? chalk.blue : chalk.green;
        const time = new Date(entry.timestamp).toLocaleString();
        console.log(color(`${entry.role} [${time}]: ${entry.message}`));
      });
    }
    console.log(chalk.cyan('--- End History ---\n'));
  }

  async showStatus() {
    try {
      console.log(chalk.cyan('\n--- PAI System Status ---'));
      
      // Check backend health
      const healthResponse = await apiClient.get(ENDPOINTS.HEALTH);
      console.log(chalk.green('✓ Backend API: Online'));
      console.log(chalk.gray(`  Uptime: ${Math.round(healthResponse.data.uptime / 60)} minutes`));
      
      // Check assistant config
      const config = await getAssistantConfig();
      if (config) {
        console.log(chalk.green('✓ Assistant: Configured'));
        console.log(chalk.gray(`  Owner: ${config.ownerName || 'Not set'}`));
        console.log(chalk.gray(`  Status: ${config.enabled ? 'Active' : 'Inactive'}`));
      } else {
        console.log(chalk.yellow('⚠ Assistant: Configuration unavailable'));
      }
      
      // Check WhatsApp connection
      try {
        const whatsappResponse = await apiClient.get(ENDPOINTS.WHATSAPP_STATUS);
        const isConnected = whatsappResponse.data.connected;
        console.log(isConnected ? chalk.green('✓ WhatsApp: Connected') : chalk.yellow('⚠ WhatsApp: Not connected'));
      } catch (error) {
        console.log(chalk.red('✗ WhatsApp: Status unavailable'));
      }
      
    } catch (error) {
      console.log(chalk.red('✗ Cannot connect to PAI backend'));
      console.log(chalk.gray(`  Error: ${error.message}`));
    }
    console.log(chalk.cyan('--- End Status ---\n'));
  }

  async sendMessage(message) {
    if (this.isWaitingForResponse) {
      console.log(chalk.yellow('Please wait for PAI to respond before sending another message...'));
      return;
    }

    this.isWaitingForResponse = true;
    addToHistory('user', message);

    // Show typing indicator
    const typingInterval = this.showTypingIndicator();

    try {
      const response = await sendMessageToPAI(message);
      clearInterval(typingInterval);
      process.stdout.write('\r\x1b[K'); // Clear typing indicator
      
      // Display PAI response
      if (response.message && response.message.content) {
        const paiMessage = response.message.content;
        console.log(chalk.green(`PAI: ${paiMessage}`));
        addToHistory('assistant', paiMessage);
      } else {
        console.log(chalk.yellow('PAI: (No response received)'));
      }
      
    } catch (error) {
      clearInterval(typingInterval);
      process.stdout.write('\r\x1b[K'); // Clear typing indicator
      console.log(chalk.red(`Error: ${error.message}`));
      
      // Suggest troubleshooting
      if (error.message.includes('Cannot connect')) {
        console.log(chalk.gray('💡 Try running: npm start (in the main directory)'));
      }
    }
    
    this.isWaitingForResponse = false;
    console.log(); // Add blank line for readability
  }

  showTypingIndicator() {
    let dots = 0;
    return setInterval(() => {
      const dotStr = '.'.repeat((dots % 3) + 1);
      process.stdout.write(`\rPAI is typing${dotStr}   `);
      dots++;
    }, 500);
  }
}

// Main execution
async function main() {
  // Check for required dependencies
  try {
    require.resolve('chalk');
    require.resolve('axios');
  } catch (e) {
    console.log('Installing required dependencies...');
    require('child_process').execSync('npm install chalk axios', { stdio: 'inherit' });
  }

  // Load chat history
  loadChatHistory();

  // Start CLI
  const cli = new PAIChatCLI();
  await cli.start();
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.log(chalk.red('\n💥 Unexpected error occurred:'));
  console.log(chalk.gray(`   ${error.message}`));
  console.log(chalk.gray('   PAI CLI will continue running. Use /exit to quit safely.'));
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.red('\n⚠ Unhandled promise rejection:'));
  console.log(chalk.gray(`   ${reason?.message || reason}`));
  console.log(chalk.gray('   PAI CLI will continue running. Use /exit to quit safely.'));
});

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n💥 Failed to start PAI CLI:'), error.message);
    console.log(chalk.gray('Please check your configuration and try again.'));
    process.exit(1);
  });
}

module.exports = { PAIChatCLI };