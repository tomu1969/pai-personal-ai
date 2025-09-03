#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/api';

async function configurePAI() {
  console.log('🔧 Configuring PAI with correct system prompt and names\n');

  try {
    // Read the PAI system prompt from the markdown file
    const promptFilePath = path.join(__dirname, '../prompts/pai_responder.md');
    console.log('📖 Reading system prompt from:', promptFilePath);
    
    let systemPrompt;
    try {
      systemPrompt = fs.readFileSync(promptFilePath, 'utf8').trim();
      console.log('✅ System prompt loaded successfully');
    } catch (error) {
      console.error('❌ Failed to read prompt file:', error.message);
      process.exit(1);
    }

    // Prepare the configuration update
    const configUpdate = {
      assistantName: 'PAI',
      ownerName: 'Tomás',
      systemPrompt: systemPrompt
    };

    console.log('\n📤 Updating PAI configuration...');
    console.log('Assistant Name:', configUpdate.assistantName);
    console.log('Owner Name:', configUpdate.ownerName);
    console.log('System Prompt Length:', configUpdate.systemPrompt.length, 'characters');

    // Update the configuration via API
    const response = await axios.put(`${API_BASE_URL}/assistant/config`, configUpdate);
    
    if (response.status === 200) {
      console.log('\n✅ PAI configuration updated successfully!');
      
      // Verify the configuration
      console.log('\n🔍 Verifying configuration...');
      const verifyResponse = await axios.get(`${API_BASE_URL}/assistant/config`);
      
      const config = verifyResponse.data;
      console.log('✓ Assistant Name:', config.assistantName);
      console.log('✓ Owner Name:', config.ownerName);
      console.log('✓ System Prompt:', config.systemPrompt.substring(0, 100) + '...');
      
      console.log('\n🎉 PAI is now configured correctly!');
      console.log('You can test it using: node pai-cli.js');
    } else {
      console.error('❌ Failed to update configuration. Status:', response.status);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.data);
    }
    
    process.exit(1);
  }
}

// Run the configuration
configurePAI();