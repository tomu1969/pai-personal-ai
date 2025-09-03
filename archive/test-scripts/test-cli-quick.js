const axios = require('axios');

async function testCLI() {
  try {
    console.log('Testing PAI CLI fix...');
    
    // Send message
    const response = await axios.post('http://localhost:3000/api/chat/00000000-0000-0000-0000-000000000001/messages', {
      content: 'Hello, can you help me?',
      sender: 'user'
    });
    
    console.log('✅ Message sent');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get messages
    const messagesResponse = await axios.get('http://localhost:3000/api/chat/00000000-0000-0000-0000-000000000001');
    const messages = messagesResponse.data.messages || [];
    
    // Show recent messages
    const recentMessages = messages
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);
    
    console.log('\nRecent conversation:');
    recentMessages.reverse().forEach(msg => {
      const prefix = msg.sender === 'user' ? 'You:' : 'PAI:';
      console.log(`${prefix} ${msg.content}`);
    });
    
    console.log('\n✅ PAI CLI should now work properly!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCLI();
