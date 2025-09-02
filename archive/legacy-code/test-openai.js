const axios = require('axios');
require('dotenv').config();

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No OpenAI API key found in .env file');
    return;
  }
  
  console.log('🔍 Testing OpenAI API key...');
  console.log(`Key starts with: ${apiKey.substring(0, 10)}...`);
  console.log(`Key length: ${apiKey.length} characters`);
  
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Say "Hello, the API key works!" in exactly those words.'
          }
        ],
        max_tokens: 50,
        temperature: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ API Key is VALID!');
    console.log('Response:', response.data.choices[0].message.content);
    console.log('Model used:', response.data.model);
    console.log('Tokens used:', response.data.usage.total_tokens);
    
    // Test with a more complex request like the AI PBX would use
    console.log('\n📝 Testing message analysis (like AI PBX uses)...');
    
    const analysisResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant analyzing WhatsApp messages. Respond with JSON.'
          },
          {
            role: 'user',
            content: 'Analyze this message and return JSON with category, priority, and sentiment: "Hi, I need urgent help with my order!"'
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Message analysis works!');
    console.log('Analysis result:', analysisResponse.data.choices[0].message.content);
    
    console.log('\n🎉 SUCCESS: Your OpenAI API key is working perfectly!');
    console.log('The AI PBX can now use intelligent responses.');
    
  } catch (error) {
    console.error('❌ API Key is INVALID or there was an error:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data.error?.message || error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  The API key is invalid or expired.');
        console.error('Please check your OpenAI account and generate a new key.');
      } else if (error.response.status === 429) {
        console.error('\n⚠️  Rate limit exceeded or quota reached.');
        console.error('Check your OpenAI account usage and billing.');
      } else if (error.response.status === 400) {
        console.error('\n⚠️  Bad request. The API key format might be incorrect.');
      }
    } else {
      console.error('Network error:', error.message);
    }
    
    console.log('\n💡 To fix this:');
    console.log('1. Go to https://platform.openai.com/api-keys');
    console.log('2. Create a new API key');
    console.log('3. Update the OPENAI_API_KEY in your .env file');
    console.log('4. Make sure you have credits in your OpenAI account');
  }
}

// Run the test
testOpenAIKey();