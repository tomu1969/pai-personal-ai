# WhatsApp Connection & Message Processing Guide

Complete step-by-step guide for connecting WhatsApp to PAI and understanding how messages flow through the system.

## 🔧 Step-by-Step WhatsApp Connection Process

### **Phase 1: System Startup**

1. **Start the Backend Server**
   ```bash
   npm start
   ```
   - Loads environment variables from `.env`
   - Initializes Express server on port 3000
   - Connects to PostgreSQL database
   - Sets up WebSocket server for real-time updates

2. **Start Evolution API (WhatsApp Gateway)**
   ```bash
   docker-compose up -d
   ```
   - Starts Evolution API container on port 8080
   - Creates WhatsApp instance: `ai-pbx-instance`
   - Configures webhook endpoint: `http://localhost:3000/webhook`

3. **Start React Frontend**
   ```bash
   cd client && npm run dev
   ```
   - Starts Vite dev server on port 5173
   - Connects to backend API and WebSocket

### **Phase 2: WhatsApp Connection**

4. **Generate QR Code**
   - Visit: `http://localhost:8080/instance/connect/ai-pbx-instance`
   - Evolution API generates fresh QR code
   - QR code expires every 20 seconds, auto-refreshes

5. **Scan QR Code with Your Phone**
   - Open WhatsApp → Menu (3 dots) → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed in browser
   - WhatsApp connects and shows "Connected" status

6. **Verify Connection**
   ```bash
   curl -H "apikey: your-api-key" \
        http://localhost:8080/instance/connectionState/ai-pbx-instance
   ```
   - Should return: `{"instance": {"state": "open"}}`

### **Phase 3: Assistant Configuration**

7. **Enable Assistant** (via Frontend or API)
   - Frontend: Click gear icon → Toggle "Assistant Enabled"
   - API: `POST /api/assistant/toggle` with `{"enabled": true}`

8. **Configure Assistant Settings**
   - Assistant Name: "Pai" (customizable)
   - Owner Name: "Tomás" (your name)
   - System Prompt: Uses `prompts/pai_responder.md`
   - Auto-response template: Greeting message

## 📨 Message Flow: Receive → Process → Respond

### **Step 1: Message Reception**
```
Your Phone → WhatsApp → Evolution API → PAI Webhook
```

**What happens:**
1. Someone sends you a WhatsApp message
2. Evolution API receives it via WhatsApp Web protocol
3. Evolution API POSTs webhook to: `http://localhost:3000/webhook`

**Webhook payload example:**
```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": false,
    "id": "message-id"
  },
  "message": {
    "conversation": "Hello, can you help me?"
  },
  "messageTimestamp": 1693747200,
  "pushName": "John Doe"
}
```

### **Step 2: Webhook Processing**
**File: `src/controllers/webhook.js`**
```javascript
// 1. Parse incoming webhook
const message = parseWhatsAppMessage(req.body);

// 2. Forward to message processor
await messageProcessor.processIncomingMessage(message);
```

### **Step 3: Message Processing Pipeline**
**File: `src/services/messageProcessor.js`**

```javascript
// 1. Extract contact info
const contact = await findOrCreateContact(senderPhone);

// 2. Create/update conversation
const conversation = await findOrCreateConversation(contact.id);

// 3. Store incoming message
const message = await Message.create({
  content: messageText,
  sender: 'user',
  conversationId: conversation.id
});

// 4. Check if assistant should respond
if (conversation.isAssistantEnabled && assistantConfig.enabled) {
  // Process with WhatsApp Assistant
  await processWithAssistant(message, contact, conversation);
}
```

### **Step 4: AI Processing**
**File: `src/services/whatsapp-assistant.js`**

```javascript
// 1. Get conversation history for this contact
const history = this.getConversationHistory(contactPhone, assistantConfig);

// 2. Add user message to history
history.push({ role: 'user', content: messageText });

// 3. Call OpenAI GPT
const response = await this.client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: history,
  temperature: 0.7,
  max_tokens: 500
});

// 4. Extract AI response
const aiResponse = response.choices[0].message.content;

// 5. Update conversation history
history.push({ role: 'assistant', content: aiResponse });
```

### **Step 5: Response Generation**
**File: `src/services/messageProcessor.js`**

```javascript
// 1. Store AI response in database
const responseMessage = await Message.create({
  content: aiResponse,
  sender: 'assistant',
  conversationId: conversation.id
});

// 2. Send response via WhatsApp
await whatsappService.sendMessage(contactPhone, aiResponse);

// 3. Broadcast real-time update
realtime.broadcastMessage(conversation.id, responseMessage);
```

### **Step 6: WhatsApp Response Delivery**
**File: `src/services/whatsapp.js`**

```javascript
// Send message via Evolution API
const response = await axios.post(
  `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_ID}`,
  {
    number: contactPhone,
    text: aiResponse
  },
  {
    headers: { 'apikey': EVOLUTION_API_KEY }
  }
);
```

**Final delivery:**
```
PAI Backend → Evolution API → WhatsApp → Your Contact's Phone
```

## 🖥️ Frontend Real-time Updates

### **WebSocket Connection**
**File: `client/src/services/socket.ts`**
```typescript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for new messages
socket.on('new_message', (message) => {
  // Update conversation in real-time
  updateConversationMessages(message);
});
```

### **Frontend Components Update**
1. **ConversationList.tsx** - Shows new message indicator
2. **MessageView.tsx** - Displays new messages instantly
3. **WhatsAppConnection.tsx** - Monitors connection status

## 🔄 Complete Message Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Contact's     │    │   Evolution API  │    │   PAI Backend   │
│   Phone         │───▶│   (Port 8080)    │───▶│   (Port 3000)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ Message         │
                                               │ Processor       │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ WhatsApp        │
                                               │ Assistant       │
                                               │ (GPT)           │
                                               └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Contact's     │◀───│   Evolution API  │◀───│   PAI Backend   │
│   Phone         │    │   (Port 8080)    │    │   (Port 3000)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ React Frontend  │
                                               │ (Port 5173)     │
                                               │ Real-time UI    │
                                               └─────────────────┘
```

## 🔧 Key Configuration Files

### 1. Environment Variables (`.env`)
```bash
# Evolution API Configuration
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE_ID=ai-pbx-instance
WEBHOOK_URL=http://localhost:3000/webhook

# OpenAI Configuration
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/pai

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 2. AI Personality (`prompts/pai_responder.md`)
Contains the system prompt that defines PAI's personality and behavior.

### 3. Assistant Settings
- Assistant Name: Customizable (default: "Pai")
- Owner Name: Your name for personalization
- Auto-response templates and behavior settings

## 🚀 Quick Start Commands

```bash
# 1. Start all services
npm start                    # Backend (port 3000)
cd client && npm run dev     # Frontend (port 5173)
docker-compose up -d         # Evolution API (port 8080)

# 2. Connect WhatsApp
# Visit: http://localhost:8080/instance/connect/ai-pbx-instance
# Scan QR code with your phone

# 3. Enable assistant
curl -X POST http://localhost:3000/api/assistant/toggle \
     -H "Content-Type: application/json" \
     -d '{"enabled": true}'

# 4. Test by sending yourself a WhatsApp message
```

## 🔍 Monitoring & Debugging

### Check System Status
```bash
# Backend health
curl http://localhost:3000/api/status

# WhatsApp connection
curl http://localhost:3000/api/whatsapp/status

# Assistant configuration
curl http://localhost:3000/api/assistant/config

# Evolution API instance status
curl -H "apikey: your-api-key" \
     http://localhost:8080/instance/connectionState/ai-pbx-instance
```

### View Logs
```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# Evolution API logs
docker-compose logs -f evolution-api
```

## 🐛 Common Issues & Solutions

### Issue: QR Code Not Displaying
- **Cause**: Evolution API not running or authentication issues
- **Solution**: Restart Evolution API and check API key

### Issue: Assistant Not Responding  
- **Cause**: Assistant disabled or OpenAI API issues
- **Solution**: Check assistant status and OpenAI API key

### Issue: Messages Not Syncing
- **Cause**: WebSocket connection problems
- **Solution**: Refresh frontend and check WebSocket logs

### Issue: WhatsApp Disconnects
- **Cause**: WhatsApp Web session expired
- **Solution**: Re-scan QR code to reconnect

## 📊 Message Processing Timeline

| Step | Component | Time | Description |
|------|-----------|------|-------------|
| 1 | Evolution API | ~50ms | Receive WhatsApp message |
| 2 | Webhook Controller | ~10ms | Parse and validate message |
| 3 | Message Processor | ~100ms | Store message, check rules |
| 4 | WhatsApp Assistant | ~1-3s | GPT processing |
| 5 | Response Sender | ~200ms | Send via Evolution API |
| 6 | Real-time Update | ~50ms | WebSocket broadcast |

**Total Response Time: 1.5-4 seconds**

## 🎯 Success Indicators

✅ **System Ready:**
- Backend running on port 3000
- Evolution API running on port 8080
- Frontend accessible on port 5173
- WhatsApp connection status: "open"
- Assistant status: "enabled"

✅ **Message Flow Working:**
- Incoming messages appear in frontend
- AI responses sent to WhatsApp
- Real-time updates in browser
- Conversation history maintained

Now PAI will automatically respond to your WhatsApp messages using GPT intelligence! 🤖📱

---

**Last Updated:** September 2025  
**PAI Version:** 1.0.0  
**Evolution API:** v2.0.9