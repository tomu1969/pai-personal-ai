#!/usr/bin/env node

/**
 * Demo script showing PAI CLI working properly
 */

const axios = require('axios');
const chalk = require('chalk');

const API_BASE_URL = 'http://localhost:3000';
const ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';

async function demoConversation() {
  console.log(chalk.cyan('🤖 PAI CLI Demo - Fixed Echo Issue'));
  console.log(chalk.cyan('=====================================\n'));

  const testMessages = [
    'Hello PAI',
    'How are you today?',
    'Can you help me with a summary?',
    'What can you do?'
  ];

  for (const message of testMessages) {
    console.log(chalk.blue(`You: ${message}`));
    
    try {
      // Send message
      await axios.post(`${API_BASE_URL}/api/chat/${ASSISTANT_CONVERSATION_ID}/messages`, {
        content: message,
        sender: 'user'
      });
      
      // Wait for AI response
      console.log(chalk.gray('PAI is thinking...'));
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Get latest response
      const response = await axios.get(`${API_BASE_URL}/api/chat/${ASSISTANT_CONVERSATION_ID}`);
      const messages = response.data.messages || [];
      
      const latestAssistantMessage = messages
        .filter(msg => msg.sender === 'assistant')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      
      if (latestAssistantMessage) {
        console.log(chalk.green(`PAI: ${latestAssistantMessage.content}`));
      } else {
        console.log(chalk.yellow('PAI: (No response yet)'));
      }
      
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
      break;
    }
  }
  
  console.log(chalk.cyan('Demo completed! PAI CLI is working properly.'));
  console.log(chalk.gray('Run: node pai-cli.js to start interactive chat'));
}

demoConversation().catch(error => {
  console.error(chalk.red('Demo failed:'), error.message);
});