const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "ai-pbx-client"
    })
});

// Generate QR code
client.on('qr', (qr) => {
    console.log('\n📱 WhatsApp QR Code Generated!');
    console.log('Scan this QR code with your WhatsApp mobile app:\n');
    qrcode.generate(qr, {small: true});
    console.log('\nInstructions:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Tap Menu (3 dots) → Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Scan the QR code above');
    console.log('5. Wait for "Ready" message\n');
});

// Client is ready
client.on('ready', () => {
    console.log('✅ WhatsApp Client is ready!');
    console.log('🎉 You can now send messages to your WhatsApp number.');
    console.log('Your AI PBX Assistant is connected and ready!\n');
});

// Handle authentication failures
client.on('auth_failure', msg => {
    console.error('❌ Authentication failed:', msg);
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('⚠️  WhatsApp Client was disconnected:', reason);
});

// Handle incoming messages
client.on('message', async (message) => {
    console.log(`📨 Message received from ${message.from}:`);
    console.log(`   Content: ${message.body}`);
    
    // Forward to AI PBX webhook
    try {
        const fetch = require('node-fetch');
        const webhookData = {
            event: 'messages.upsert',
            instance: 'ai-pbx-instance',
            data: {
                key: {
                    remoteJid: message.from,
                    fromMe: false,
                    id: message.id._serialized
                },
                message: {
                    conversation: message.body
                },
                messageTimestamp: Date.now()
            }
        };
        
        const response = await fetch('http://localhost:3000/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
        });
        
        console.log(`📡 Forwarded to AI PBX: ${response.ok ? 'Success' : 'Failed'}`);
        
    } catch (error) {
        console.error('❌ Error forwarding to AI PBX:', error.message);
    }
});

// Initialize the client
console.log('🚀 Starting WhatsApp Client...');
client.initialize();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down WhatsApp client...');
    client.destroy();
    process.exit();
});