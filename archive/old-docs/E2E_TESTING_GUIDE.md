# AI PBX End-to-End Testing Guide

## 🚀 Quick Start

### Prerequisites
- Docker installed and running
- Node.js and npm installed
- Your phone with WhatsApp installed

### 1. Start the Testing Environment

```bash
# Start both Evolution API and AI PBX
./scripts/start-e2e-test.sh
```

This will:
- Start Evolution API on port 8080
- Start AI PBX on port 3000
- Configure webhooks automatically
- Display connection URLs

### 2. Connect Your Phone

1. **Open your browser** and go to: `http://localhost:8080/instance/connect/ai-pbx-instance`
2. **Scan the QR code** with WhatsApp on your phone:
   - Open WhatsApp
   - Tap Menu (3 dots) → Linked Devices  
   - Tap "Link a Device"
   - Scan the QR code
3. **Wait for connection** - you should see "Connected" status

### 3. Test the Assistant

1. **Send a test message** to your WhatsApp number
2. **Check the response** - the AI assistant should reply automatically
3. **Monitor logs** in the terminal for message processing details

## 🔧 Testing Commands

### Basic Connection Test
```bash
node scripts/test-phone-connection.js
```

### Check Connection Status
```bash
node scripts/test-phone-connection.js --status
```

### Send Test Message
```bash
node scripts/test-phone-connection.js --test +1234567890
```

## 📱 Test Scenarios

### 1. Basic Auto-Response Test
**Send:** "Hi there!"
**Expected:** AI assistant introduces itself and offers help

### 2. Business Inquiry Test  
**Send:** "I need help with my project deadline"
**Expected:** Assistant recognizes business category, high priority

### 3. Support Request Test
**Send:** "How do I reset my password?"
**Expected:** Assistant categorizes as support, offers assistance

### 4. Urgent Message Test
**Send:** "URGENT! System is down!"
**Expected:** Assistant recognizes urgent priority, immediate response

### 5. Spanish Language Test
**Send:** "Hola, necesito ayuda por favor"
**Expected:** Assistant detects Spanish, responds appropriately

### 6. Spam Detection Test
**Send:** "Congratulations! You won $1000! Click here to claim!"
**Expected:** Message flagged as spam, minimal or no response

## 🔍 Monitoring & Debugging

### Check AI PBX Status
```bash
curl http://localhost:3000/api/status
```

### Check Assistant Status
```bash
curl http://localhost:3000/api/assistant/status
```

### View Recent Conversations
```bash
curl http://localhost:3000/api/conversations?limit=5
```

### Evolution API Instance Status
```bash
curl -H "apikey: ai-pbx-evolution-key-2024" \
     http://localhost:8080/instance/connectionState/ai-pbx-instance
```

## 📊 Understanding the Message Flow

1. **WhatsApp Message** → Evolution API
2. **Evolution API** → Webhook → AI PBX `/webhook`
3. **AI PBX Processing:**
   - Parse message (WhatsApp Service)
   - Filter & categorize (Filter Service)
   - AI analysis (AI Service) 
   - Store conversation (Conversation Service)
   - Decide response (Assistant Service)
   - Send response (WhatsApp Service)

## 🔧 Troubleshooting

### Evolution API Not Starting
```bash
# Check Docker status
docker ps

# View Evolution API logs
docker-compose -f docker-compose.evolution.yml logs -f
```

### AI PBX Connection Issues
```bash
# Check if AI PBX is running
curl http://localhost:3000/health

# Check logs for errors
tail -f logs/app.log
```

### WhatsApp Not Connecting
1. Make sure QR code is fresh (they expire)
2. Check if WhatsApp Web is already connected elsewhere
3. Try disconnecting other devices first

### No Assistant Response
1. Check if assistant is enabled:
   ```bash
   curl http://localhost:3000/api/assistant/status
   ```
2. Enable assistant if needed:
   ```bash
   curl -X POST http://localhost:3000/api/assistant/toggle \
        -H "Content-Type: application/json" \
        -d '{"enabled": true}'
   ```

### Webhook Not Working
1. Verify webhook URL in Evolution API:
   ```bash
   curl -H "apikey: ai-pbx-evolution-key-2024" \
        http://localhost:8080/webhook/find/ai-pbx-instance
   ```
2. Test webhook manually:
   ```bash
   curl -X POST http://localhost:3000/webhook/test \
        -H "Content-Type: application/json" \
        -d '{"test": "message"}'
   ```

## 📈 Expected Results

### Successful Setup Shows:
- ✅ Evolution API running on port 8080
- ✅ AI PBX running on port 3000  
- ✅ WhatsApp connected and showing "open" status
- ✅ Webhook configured and receiving events
- ✅ Assistant enabled and processing messages

### Successful Message Processing Shows:
- 📨 Incoming message logged in AI PBX
- 🔍 Message analyzed and categorized  
- 🤖 AI response generated (if OpenAI configured)
- 💬 Auto-response sent back to WhatsApp
- 📊 Statistics updated in assistant status

## ⏹️ Stopping the Test

```bash
./scripts/stop-e2e-test.sh
```

This will stop both Evolution API and AI PBX services.

## 🎯 Next Steps After Testing

1. **Production Deployment:** Configure with real domain and SSL
2. **OpenAI Integration:** Add your OpenAI API key for enhanced AI responses  
3. **Database Setup:** Configure PostgreSQL for persistent storage
4. **Admin Dashboard:** Set up the admin interface for management
5. **Custom Responses:** Customize auto-response templates
6. **Business Rules:** Add custom filtering and routing logic

## 📞 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in the terminal output
3. Test individual components with the provided curl commands
4. Ensure all prerequisites are properly installed