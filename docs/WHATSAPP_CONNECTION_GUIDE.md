# WhatsApp Connection & Message Processing Guide

Complete step-by-step guide for connecting WhatsApp to PAI's triple assistant system and understanding how messages flow through the system.

## 🏠 PAI Mortgage System Quick Start

### **Recommended: Use PAI Mortgage Manager**

For PAI Mortgage system specifically, use the dedicated management script:

```bash
# Interactive system check and startup
./scripts/pai-mortgage-manager.sh

# Quick status check with health dashboard
npm run pai:status

# Start system if not running
npm run pai:start

# Test end-to-end functionality
npm run pai:test
```

**Health Dashboard Example:**
```
🏥 PAI Mortgage System Health Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Docker Services: Evolution API + PostgreSQL
✅ PAI Mortgage: Connected (+57 318 260 1111)
✅ OpenAI API: Valid API key
✅ Backend Service: Running on port 3000
✅ Message Routing: PAI Mortgage handler active
🎉 System Fully Operational!
```

## 🔧 Step-by-Step WhatsApp Connection Process

### **Phase 1: System Startup (Unified Launch)**

1. **PAI Mortgage System Launch (Recommended)**
   ```bash
   # Interactive management
   npm run pai
   
   # Or force start
   npm run pai:start
   ```

2. **Legacy One-Command Launch**
   ```bash
   # Set your OpenAI API key
   export OPENAI_API_KEY='sk-proj-your-key-here'
   
   # Launch complete system
   ./launch-pai.sh
   ```
   
   **What this does automatically:**
   - ✅ Verifies all dependencies (Node.js, Docker, ports)
   - 🐳 Starts Evolution API container (port 8080)
   - 🗄️ Starts PostgreSQL and Redis databases
   - ⚙️ Launches Express backend server (port 3000)
   - 🎨 Starts Vite React frontend (port 3001)
   - 🔍 Performs comprehensive health checks
   - 📊 Displays service status and access URLs

2. **Alternative Launch Methods**
   ```bash
   # Using npm
   npm run launch
   
   # Debug mode with detailed logging
   npm run launch:debug
   
   # Check system health
   npm run monitor
   ```

3. **Manual Launch (if needed)**
   ```bash
   # Backend only
   npm start
   
   # Frontend only  
   cd client && npm run dev
   
   # Docker services only
   cd docker/evolution && docker-compose up -d
   ```

### **Phase 2: WhatsApp Connection (Triple Assistant)**

4. **Connect PAI Responder (Main Assistant)**
   - Visit: `http://localhost:3000/qr-responder`
   - Scan QR code with your main WhatsApp device
   - Handles auto-responses to all incoming messages

5. **Connect PAI Assistant (Query Assistant)**
   - Visit: `http://localhost:3000/qr-assistant`
   - Scan QR code with a second WhatsApp device
   - Handles message history queries and summaries

6. **Connect PAI Mortgage (Mortgage Specialist)**
   - Visit: `http://localhost:3000/qr-mortgage`
   - Scan QR code with a third WhatsApp device
   - Handles mortgage qualification and guidance

7. **Verify All Connections**
   ```bash
   # Check PAI Responder
   curl -H "apikey: pai_evolution_api_key_2025" \
        http://localhost:8080/instance/connectionState/aipbx
   
   # Check PAI Assistant
   curl -H "apikey: pai_evolution_api_key_2025" \
        http://localhost:8080/instance/connectionState/pai-assistant
   
   # Check PAI Mortgage
   curl -H "apikey: pai_evolution_api_key_2025" \
        http://localhost:8080/instance/connectionState/pai-mortgage
   ```
   - All should return: `{"instance": {"state": "open"}}`

### **Phase 3: Assistant Configuration**

8. **Enable Assistants** (via Frontend or API)
   - Frontend: Click gear icon → Toggle "Assistant Enabled"
   - API: `POST /api/assistant/toggle` with `{"enabled": true}`

9. **Configure Assistant Settings**
   - **PAI Responder**: Uses `prompts/pai_responder.md`
   - **PAI Assistant**: Uses `prompts/pai_assistant.md`
   - **PAI Mortgage**: Uses `prompts/pai_mortgage.md`
   - Owner Name: "Tomás" (your name for all assistants)
   - Auto-response templates: Customizable greeting messages

## 📨 Message Flow: Receive → Process → Respond

### **Step 1: Message Reception (Multi-Instance)**
```
Contact's Phone → WhatsApp → Evolution API → Instance-Specific PAI Webhook
```

**What happens:**
1. Someone sends a WhatsApp message to one of your connected numbers
2. Evolution API receives it via WhatsApp Web protocol
3. Evolution API POSTs webhook to the appropriate endpoint:
   - PAI Responder: `http://localhost:3000/webhook`
   - PAI Assistant: `http://localhost:3000/webhook/pai-assistant`
   - PAI Mortgage: `http://localhost:3000/webhook/pai-mortgage`

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
# 1. One-command launch (recommended)
export OPENAI_API_KEY='your-key-here'
./launch-pai.sh

# OR using npm
npm run launch

# 2. Monitor system health
npm run monitor

# 3. Connect WhatsApp
# Visit: http://localhost:3000/qr-responder
# Scan QR code with your phone

# 4. Configure assistant (web interface)
# Visit: http://localhost:3001
# Click gear icon → Configure settings

# 5. Test by sending yourself a WhatsApp message
```

### **Legacy Manual Commands**
```bash
# Manual service startup (if needed)
npm start                    # Backend (port 3000)
cd client && npm run dev     # Frontend (port 3001)
cd docker/evolution && docker-compose up -d  # Docker services

# Direct API assistant toggle
curl -X POST http://localhost:3000/api/assistant/toggle \
     -H "Content-Type: application/json" \
     -d '{"enabled": true}'
```

## 🔍 Monitoring & Debugging

### **New Launch System Tools**
```bash
# Comprehensive system health check
npm run monitor

# Continuous monitoring dashboard
npm run monitor:watch

# Check system dependencies
npm run check-deps

# Launch system debug mode
npm run launch:debug

# Service status dashboard
./scripts/service-monitor.sh dashboard
```

### **API Health Checks**
```bash
# Backend health
curl http://localhost:3000/health

# WhatsApp connection status  
curl http://localhost:3000/api/whatsapp/status

# Assistant configuration
curl http://localhost:3000/api/assistant/config

# Evolution API instance status
curl -H "apikey: pai_evolution_api_key_2025" \
     http://localhost:8080/instance/connectionState/aipbx
```

### **Log Files**
```bash
# Launch system logs
tail -f logs/launch_*.log

# Backend service logs
tail -f logs/backend_*.log

# Frontend service logs  
tail -f logs/frontend_*.log

# Docker services logs
tail -f logs/docker_*.log

# Legacy application logs
tail -f logs/app.log
tail -f logs/error.log

# Evolution API container logs
docker-compose -f docker/evolution/docker-compose.yml logs -f evolution-api
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

**Last Updated:** September 17, 2025  
**PAI Version:** 1.2.0 (Triple Assistant System + PAI Mortgage)  
**Evolution API:** v2.0.9  
**Launch System:** v1.0.0
**New Features:** PAI Mortgage Assistant, Enhanced Multi-Instance Support, OpenAI Integration Fixes