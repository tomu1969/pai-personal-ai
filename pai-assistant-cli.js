#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
// Force load .env file, override existing environment variables (same as chat.js)
require('dotenv').config({ override: true });

const SimplifiedPaiAssistant = require('./src/assistants/pai-assistant-simplified');

// Colors for better CLI experience
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class PaiAssistantCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.assistant = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      console.log(`${colors.cyan}🤖 Initializing PAI Assistant...${colors.reset}`);
      
      this.assistant = new SimplifiedPaiAssistant();
      
      console.log(`${colors.green}✓ PAI Assistant ready!${colors.reset}`);
      console.log(`${colors.dim}Model: ${this.assistant.model}${colors.reset}`);
      console.log(`${colors.dim}Type 'help' for commands, 'quit' to exit${colors.reset}\n`);
      
    } catch (error) {
      console.error(`${colors.red}✗ Failed to initialize PAI Assistant:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  async start() {
    await this.initialize();
    this.isRunning = true;
    this.showWelcome();
    this.askQuestion();
  }

  showWelcome() {
    console.log(`${colors.bright}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  PAI Assistant - WhatsApp Message Summary Tool${colors.reset}`);
    console.log(`${colors.bright}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.yellow}Hi Tomás! I can help you search and summarize your WhatsApp messages.${colors.reset}`);
    console.log(`${colors.dim}Examples:${colors.reset}`);
    console.log(`${colors.dim}  • "What messages did I get today?"${colors.reset}`);
    console.log(`${colors.dim}  • "Show me Laura's messages from yesterday"${colors.reset}`);
    console.log(`${colors.dim}  • "Messages containing 'meeting' from this morning"${colors.reset}\n`);
  }

  async askQuestion() {
    if (!this.isRunning) return;

    this.rl.question(`${colors.blue}Tomás${colors.reset} > `, async (input) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.askQuestion();
        return;
      }

      // Handle special commands
      if (await this.handleSpecialCommand(trimmedInput)) {
        this.askQuestion();
        return;
      }

      // Process message with PAI Assistant
      await this.processUserMessage(trimmedInput);
      this.askQuestion();
    });
  }

  async handleSpecialCommand(input) {
    const lowerInput = input.toLowerCase();

    switch (lowerInput) {
      case 'quit':
      case 'exit':
      case 'bye':
        console.log(`${colors.yellow}👋 Goodbye, Tomás!${colors.reset}`);
        this.isRunning = false;
        this.rl.close();
        return true;

      case 'help':
        this.showHelp();
        return true;

      case 'clear':
        console.clear();
        this.showWelcome();
        return true;

      case 'reset':
        this.assistant.clearHistory();
        console.log(`${colors.green}✓ Conversation history cleared${colors.reset}`);
        return true;

      case 'stats':
        this.showStats();
        return true;

      case 'test':
        await this.runTest();
        return true;

      default:
        return false;
    }
  }

  showHelp() {
    console.log(`\n${colors.bright}Available Commands:${colors.reset}`);
    console.log(`${colors.cyan}  help${colors.reset}     - Show this help message`);
    console.log(`${colors.cyan}  clear${colors.reset}    - Clear the screen`);
    console.log(`${colors.cyan}  reset${colors.reset}    - Reset conversation history`);
    console.log(`${colors.cyan}  stats${colors.reset}    - Show session statistics`);
    console.log(`${colors.cyan}  test${colors.reset}     - Run a test search`);
    console.log(`${colors.cyan}  quit${colors.reset}     - Exit PAI Assistant`);
    
    console.log(`\n${colors.bright}Message Search Examples:${colors.reset}`);
    console.log(`${colors.dim}  "What messages did I receive today?"${colors.reset}`);
    console.log(`${colors.dim}  "Show me messages from Laura yesterday"${colors.reset}`);
    console.log(`${colors.dim}  "Find messages containing 'urgent' from this morning"${colors.reset}`);
    console.log(`${colors.dim}  "Messages from all contacts in the last 2 hours"${colors.reset}\n`);
  }

  showStats() {
    const stats = this.assistant.getStats();
    console.log(`\n${colors.bright}Session Statistics:${colors.reset}`);
    console.log(`${colors.dim}  Conversation length: ${stats.conversationLength} messages${colors.reset}`);
    console.log(`${colors.dim}  Model: ${stats.model}${colors.reset}`);
    console.log(`${colors.dim}  System prompt: ${stats.systemPromptLength} characters${colors.reset}`);
    console.log(`${colors.dim}  Initialized: ${new Date(stats.initialized).toLocaleString()}${colors.reset}\n`);
  }

  async runTest() {
    console.log(`${colors.yellow}🧪 Running test search...${colors.reset}`);
    
    try {
      const testParams = {
        start_date: 'today',
        end_date: 'today',
        sender: 'all',
        limit: 10,
      };

      const results = await this.assistant.testSearch(testParams);
      
      if (results.success) {
        console.log(`${colors.green}✓ Test completed successfully${colors.reset}`);
        console.log(`${colors.dim}  Found: ${results.metadata.totalMessages} messages${colors.reset}`);
        console.log(`${colors.dim}  Grouped: ${results.metadata.groupedConversations} conversations${colors.reset}`);
        
        if (results.messages.length > 0) {
          console.log(`${colors.dim}  Sample: ${results.messages[0].senderName} - ${results.messages[0].summary}${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}✗ Test failed: ${results.error}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗ Test error: ${error.message}${colors.reset}`);
    }
    
    console.log();
  }

  async processUserMessage(message) {
    // Show thinking indicator
    const thinkingInterval = this.showThinking();
    
    try {
      const result = await this.assistant.processMessage(message);
      
      clearInterval(thinkingInterval);
      process.stdout.write('\r'); // Clear thinking dots
      
      if (result.success) {
        // Display response based on type
        switch (result.type) {
          case 'search_results':
            console.log(`${colors.green}📱 PAI:${colors.reset} ${result.message}`);
            if (result.metadata) {
              console.log(`${colors.dim}     (Found ${result.metadata.totalMessages} messages, grouped into ${result.metadata.groupedConversations} conversations)${colors.reset}`);
            }
            break;
          
          case 'conversation':
            console.log(`${colors.green}💬 PAI:${colors.reset} ${result.message}`);
            break;
          
          default:
            console.log(`${colors.green}🤖 PAI:${colors.reset} ${result.message}`);
        }
        
        // Show token usage if available
        if (result.tokensUsed) {
          console.log(`${colors.dim}     (Used ${result.tokensUsed} tokens)${colors.reset}`);
        }
        
      } else {
        console.log(`${colors.red}❌ PAI:${colors.reset} ${result.message}`);
        if (result.error) {
          console.log(`${colors.dim}     Error: ${result.error}${colors.reset}`);
        }
      }
      
    } catch (error) {
      clearInterval(thinkingInterval);
      process.stdout.write('\r');
      console.log(`${colors.red}💥 System Error:${colors.reset} ${error.message}`);
    }
    
    console.log(); // Add spacing
  }

  showThinking() {
    const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    return setInterval(() => {
      process.stdout.write(`\r${colors.yellow}${dots[i]} PAI is thinking...${colors.reset}`);
      i = (i + 1) % dots.length;
    }, 100);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Goodbye!${colors.reset}`);
  process.exit(0);
});

// Start the CLI
const cli = new PaiAssistantCLI();
cli.start().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});