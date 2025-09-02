# 🚀 Simple AI PBX Testing Guide

## ✅ What's Working Right Now

Your AI PBX is **already running and working**! Here's how to test it immediately:

### **Step 1: Test the Webhook Directly**

```bash
# Test webhook with a simple message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": [{
      "key": {"id": "test-123", "fromMe": false, "remoteJid": "1234567890@s.whatsapp.net"},
      "message": {"conversation": "Hello! Can you help me?"},
      "messageTimestamp": 1640995200,
      "pushName": "Test User"
    }]
  }'
```

**Expected Response:**
```json
{"success": true}
```

### **Step 2: Test Different Message Types**

**Business Message:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert", 
    "data": [{
      "key": {"id": "test-456", "fromMe": false, "remoteJid": "1234567890@s.whatsapp.net"},
      "message": {"conversation": "I need help with my project deadline"},
      "messageTimestamp": 1640995200,
      "pushName": "Business Client"
    }]
  }'
```

**Urgent Message:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "data": [{
      "key": {"id": "test-789", "fromMe": false, "remoteJid": "1234567890@s.whatsapp.net"},
      "message": {"conversation": "URGENT! System is down!"},
      "messageTimestamp": 1640995200,
      "pushName": "IT Admin"
    }]
  }'
```

### **Step 3: Check Processing Results**

```bash
# Check system status
curl http://localhost:3000/api/status

# Test webhook functionality
curl -X POST http://localhost:3000/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

## 🔍 What You Should See

When you send test messages, check your terminal where AI PBX is running. You should see:

1. **Message Received** - Incoming webhook logged
2. **Message Parsed** - WhatsApp message structure processed
3. **Analysis Complete** - Category and priority determined
4. **Processing Pipeline** - Each step of message handling

## 📱 Connect Real WhatsApp (Next Steps)

### **Option A: Use WhatsApp Business API**
1. Get WhatsApp Business API access
2. Configure webhook URL: `http://localhost:3000/webhook`
3. Test with real messages

### **Option B: Use Evolution API (Manual Setup)**
1. Clone Evolution API: `git clone https://github.com/EvolutionAPI/evolution-api.git`
2. Configure environment to point to: `http://localhost:3000/webhook`
3. Follow their documentation for phone connection

### **Option C: Use Other WhatsApp Libraries**
- whatsapp-web.js
- baileys
- Any webhook-based WhatsApp solution

## 🎯 Key URLs for Testing

- **Health Check:** http://localhost:3000/health
- **System Status:** http://localhost:3000/api/status  
- **Webhook Endpoint:** http://localhost:3000/webhook
- **Test Webhook:** http://localhost:3000/webhook/test

## 🧪 Advanced Testing

Create a simple script to test multiple scenarios:

```bash
#!/bin/bash
echo "Testing AI PBX with various message types..."

# Test greeting
curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "messages.upsert", "data": [{"key": {"id": "1", "fromMe": false, "remoteJid": "test@s.whatsapp.net"}, "message": {"conversation": "Hi there!"}, "pushName": "Tester"}]}' 

echo "✅ Greeting test sent"

# Test business
curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "messages.upsert", "data": [{"key": {"id": "2", "fromMe": false, "remoteJid": "test@s.whatsapp.net"}, "message": {"conversation": "Need help with project"}, "pushName": "Client"}]}'

echo "✅ Business test sent"

# Test urgent  
curl -s -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "messages.upsert", "data": [{"key": {"id": "3", "fromMe": false, "remoteJid": "test@s.whatsapp.net"}, "message": {"conversation": "URGENT HELP NEEDED!"}, "pushName": "Emergency"}]}'

echo "✅ Urgent test sent"
echo "🔍 Check your AI PBX terminal for processing logs!"
```

## 🎉 Success Indicators

Your AI PBX is working if you see:
- ✅ Webhook receives messages successfully
- ✅ Messages are parsed and categorized
- ✅ Processing pipeline completes without errors
- ✅ Logs show analysis results (category, priority, sentiment)

## 📞 Ready for Real Phone Connection

Once you see the webhook tests working, your AI PBX is **ready for real WhatsApp connection**!

Just configure any WhatsApp integration to send webhooks to:
`http://your-domain.com:3000/webhook`

**Your AI PBX Assistant is fully operational! 🤖✨**