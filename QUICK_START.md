# 🚀 AI PBX Quick Start (5 Minutes)

## ⚡ **Super Fast Setup**

### **1. Get Your OpenAI API Key (2 minutes)**
1. Go to: https://platform.openai.com/api-keys
2. Sign up/login
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)

### **2. Configure AI PBX (1 minute)**
```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Replace these two lines:**
```bash
OPENAI_API_KEY=your_actual_openai_api_key_here
OWNER_NAME=Your Name
```

**With your actual values:**
```bash
OPENAI_API_KEY=sk-proj-your-copied-key-here
OWNER_NAME=John Smith
```

### **3. Start AI PBX (1 minute)**
```bash
# Install and start
npm install
npm start

# Should see: ✅ Server running on http://localhost:3000
```

### **4. Connect WhatsApp (1 minute)**
```bash
# In another terminal, start WhatsApp gateway
./scripts/setup-whatsapp-connection.sh

# Then:
# 1. Open: http://localhost:8080/manager/instance  
# 2. Create instance: "ai-pbx-instance"
# 3. Scan QR code with WhatsApp
```

### **5. Test It! (30 seconds)**
Send a message to your WhatsApp number → AI assistant responds automatically!

---

## 🎯 **That's It!**

Your AI PBX is now:
- ✅ Receiving WhatsApp messages
- ✅ Analyzing with AI
- ✅ Responding automatically
- ✅ Storing conversations
- ✅ Ready for business!

**For detailed setup, troubleshooting, and production deployment, see:**
- `AI_PBX_COMPLETE_SETUP_GUIDE.md` - Full instructions
- `CREDENTIALS_CHECKLIST.md` - All credentials explained

---

## 🆘 **Quick Troubleshooting**

**AI PBX won't start?**
```bash
# Check if port 3000 is free
lsof -i :3000
```

**OpenAI not working?**
```bash
# Test your API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer your-api-key-here"
```

**WhatsApp not connecting?**
```bash
# Check Evolution API
curl http://localhost:8080
```

**Need help?** Check the full guide: `AI_PBX_COMPLETE_SETUP_GUIDE.md`

---

**🎉 Your AI WhatsApp Assistant is Ready! 🤖📱**