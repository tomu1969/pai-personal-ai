# 🚀 PAI System Quick Start Guide

Complete setup for dual WhatsApp assistant system with PAI Responder and PAI Assistant.

## 📋 **Prerequisites**
- Docker & Docker Compose installed
- OpenAI API key
- Two WhatsApp phone numbers (or one number + WhatsApp Business)
- 15-20 minutes for full setup

## 🎯 **System Overview**

PAI System consists of two WhatsApp assistants:

**PAI Responder (Main Line)**
- 📱 Auto-responds to all incoming messages
- 🤖 Uses GPT for intelligent responses
- ⚡ Handles customer service, inquiries, general chat

**PAI Assistant (Query Line)** 
- 🔍 Specialized for searching your message history
- 📊 Provides conversation summaries
- 💬 Query interface for finding specific information

## 🚀 **Option 1: Full Stack Setup (Recommended)**

### **Step 1: Get Your OpenAI API Key**
1. Visit: https://platform.openai.com/api-keys
2. Sign up/login → "Create new secret key"
3. Copy the key (starts with `sk-proj-...`)

### **Step 2: Clone and Configure**
```bash
# Clone repository
git clone <repository-url>
cd ai_pbx

# Set your OpenAI API key
export OPENAI_API_KEY='sk-proj-your-actual-key-here'
```

### **Step 3: Start the Full System**
```bash
# Navigate to full-stack setup
cd docker/full-stack

# Start all services (Frontend, Backend, Evolution API, Databases)
./start.sh
```

### **Step 4: Connect Your WhatsApp Devices**

**For PAI Responder (Main Line):**
1. Open: http://localhost:3000/qr-responder
2. Scan QR code with your main WhatsApp device
3. Wait for "Connected" status

**For PAI Assistant (Query Line):**
1. Open: http://localhost:3000/qr-assistant  
2. Scan QR code with your second WhatsApp device/WhatsApp Business
3. Wait for "Connected" status

### **Step 5: Configure Your Assistant**
1. Open the web interface: http://localhost:5173
2. Click the gear icon to open settings
3. Configure:
   - **Assistant Name**: e.g., "PAI"
   - **Owner Name**: Your name
   - **System Prompt**: Customize personality
   - **Greeting Template**: Auto-response message

### **Step 6: Test the System**
1. Send a message to your PAI Responder number → Should get AI response
2. Send a query to your PAI Assistant number: "show me messages from today"
3. Check the web interface for conversation history

## 🔧 **Option 2: Evolution API Only**

If you want to use your own backend:

```bash
# Navigate to Evolution API setup
cd docker/evolution

# Start just Evolution API + databases
./start.sh
```

**Available Services:**
- Evolution API: http://localhost:8080
- PostgreSQL: localhost:5432 (evolution:evolution123)
- Redis: localhost:6379

## 📱 **WhatsApp Instance Configuration**

### **Create PAI Responder Instance**
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: pai_evolution_api_key_2025" \
  -d '{
    "instanceName": "aipbx",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS",
    "webhookUrl": "http://localhost:3000/webhook"
  }'
```

### **Create PAI Assistant Instance**
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: pai_evolution_api_key_2025" \
  -d '{
    "instanceName": "pai-assistant",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS",
    "webhookUrl": "http://localhost:3000/webhook/pai-assistant"
  }'
```

## 🔗 **Service Endpoints**

**Full Stack:**
- Frontend (Chat Interface): http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

**WhatsApp QR Codes:**
- PAI Responder: http://localhost:3000/qr-responder
- PAI Assistant: http://localhost:3000/qr-assistant

**Evolution API:**
- API Console: http://localhost:8080
- Connection Status: http://localhost:8080/instance/connectionState/{instanceName}

**Optional Tools:**
- Database Admin: http://localhost:8081 (admin@pai.local:admin123)
- Nginx Proxy: http://localhost:80 (with --profile nginx)

## 🛠️ **Management Commands**

### **Full Stack:**
```bash
cd docker/full-stack

./start.sh      # Start all services
./stop.sh       # Stop all services
./logs.sh       # View logs
./reset.sh      # Reset all data
./update.sh     # Update images
```

### **Evolution API Only:**
```bash
cd docker/evolution

./start.sh      # Start Evolution API stack
./stop.sh       # Stop services
./logs.sh       # View logs
./reset.sh      # Reset data
```

## 📊 **Testing Your Setup**

### **Test PAI Responder:**
1. Send any message to your main WhatsApp number
2. Should receive intelligent AI response within seconds
3. Try: "Hello", "What can you do?", "Help me with..."

### **Test PAI Assistant:**
1. Send query messages to your assistant WhatsApp number
2. Try these commands:
   - "show me messages from today"
   - "summary of conversations"
   - "messages containing urgent"
   - "who messaged me yesterday?"

### **Web Interface:**
1. Open http://localhost:5173
2. See real-time conversations
3. Toggle assistant on/off per conversation
4. Configure global settings

## 🔧 **Configuration Options**

### **Environment Variables:**
```bash
# Core Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgresql://ai_pbx:aipbx123@localhost:5432/ai_pbx_db

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=pai_evolution_api_key_2025
EVOLUTION_INSTANCE_ID=aipbx
EVOLUTION_PAI_ASSISTANT_INSTANCE_ID=pai-assistant

# Server
PORT=3000
HOST=0.0.0.0
```

### **Assistant Customization:**
- **System Prompt**: Controls AI personality and behavior
- **Owner Name**: Personalizes responses with your name
- **Assistant Name**: What the AI calls itself
- **Auto Response**: Template for automated responses

## ❗ **Troubleshooting**

### **Services Won't Start:**
```bash
# Check Docker status
docker info

# View service logs
docker-compose logs evolution-api
docker-compose logs ai-pbx-backend
```

### **WhatsApp Not Connecting:**
1. Check QR code pages load: http://localhost:3000/qr-responder
2. Verify Evolution API is running: http://localhost:8080
3. Try refreshing QR code after 30 seconds
4. Check instance status: http://localhost:8080/instance/connectionState/aipbx

### **AI Not Responding:**
1. Verify OpenAI API key is set: `echo $OPENAI_API_KEY`
2. Check backend health: http://localhost:3000/health
3. View backend logs for errors
4. Ensure assistant is enabled in web interface

### **Database Issues:**
```bash
# Reset database
cd docker/full-stack
./reset.sh

# Manual database reset
docker volume rm pai_postgres_data
./start.sh
```

## 📚 **Next Steps**

1. **Customize Prompts**: Edit `/prompts/pai_responder.md` for personality
2. **API Integration**: Use REST APIs for custom integrations
3. **Monitoring**: Set up log monitoring and alerts
4. **Backup**: Regular database backups for conversation history
5. **Scaling**: Deploy to cloud for production use

## 🔒 **Security Notes**

- Change default passwords in production
- Use strong API keys
- Enable HTTPS for production deployment
- Regular security updates
- Monitor API usage and costs

## 📞 **Support**

- Check logs: `./logs.sh`
- Reset system: `./reset.sh`  
- View service status: `docker-compose ps`
- Database admin: http://localhost:8081

**Happy messaging with your PAI assistants! 🤖✨**