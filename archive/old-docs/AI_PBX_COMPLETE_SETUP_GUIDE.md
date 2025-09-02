# 🤖 AI PBX Complete Setup Guide

## 🎯 **What This System Does**

AI PBX is a WhatsApp-based personal assistant that:
- **Automatically receives** WhatsApp messages
- **Analyzes and categorizes** messages (business, personal, urgent, etc.)
- **Generates intelligent responses** using AI
- **Manages conversations** and contact information
- **Provides analytics** and message filtering
- **Stores everything locally** for complete privacy

---

## 🔑 **Required Credentials & Accounts**

### **1. OpenAI API Key (Recommended)**
- **What it's for:** Intelligent AI responses
- **Where to get:** https://platform.openai.com/api-keys
- **Cost:** ~$0.001-0.002 per message processed
- **Format:** `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Required:** No (system works with templates, but AI makes it much better)

### **2. WhatsApp Account**
- **What it's for:** Receiving and sending messages
- **Where to get:** Your existing WhatsApp account
- **Cost:** Free
- **Requirements:** Active WhatsApp on your phone
- **Required:** Yes

### **3. Database (Choose One)**

#### **Option A: SQLite (Recommended for Testing)**
- **What it's for:** Local message storage
- **Cost:** Free
- **Setup:** Automatic (no credentials needed)
- **Storage:** Local file (./data/ai_pbx.db)

#### **Option B: PostgreSQL (Recommended for Production)**
- **What it's for:** Professional database storage
- **Cost:** Free (using Docker)
- **Credentials:** Auto-generated secure password
- **Storage:** Docker container with persistent volumes

### **4. Server/Hosting (Choose One)**

#### **Option A: Local Development**
- **Cost:** Free
- **Requirements:** Your computer running
- **URL:** http://localhost:3000

#### **Option B: Cloud Hosting**
- **Options:** DigitalOcean, AWS, Google Cloud, Heroku
- **Cost:** $5-20/month
- **Requirements:** Domain name and SSL certificate

---

## 🚀 **Complete Installation Guide**

### **Prerequisites**
- Node.js 18+ installed
- Docker installed (for Evolution API and optional PostgreSQL)
- Git installed
- Your computer with internet connection

### **Step 1: Download and Setup**

```bash
# Clone or download the AI PBX project
cd /path/to/your/projects

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### **Step 2: Configure Credentials**

Edit your `.env` file with your actual credentials:

```bash
nano .env
```

**Required Configuration:**
```bash
# Basic Server Settings
NODE_ENV=development
PORT=3000
HOST=localhost

# OpenAI Configuration (GET YOUR API KEY FROM https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_API_KEY_HERE
OPENAI_MODEL=gpt-3.5-turbo

# Assistant Configuration
DEFAULT_ASSISTANT_STATUS=true
AUTO_RESPONSE_TEMPLATE="Hi {{contact_name}}! This is {{owner_name}}'s AI assistant. I'm currently helping manage messages. How can I help you today?"
OWNER_NAME=Your Name Here

# Evolution API Configuration (WhatsApp)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=ai-pbx-evolution-key-2024
EVOLUTION_INSTANCE_ID=ai-pbx-instance
WEBHOOK_URL=http://localhost:3000/webhook

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-here-make-it-long
WEBHOOK_SECRET=your-webhook-secret-key-here

# Database - SQLite (Simple)
DATABASE_URL=sqlite:./data/ai_pbx.db

# OR Database - PostgreSQL (Advanced)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=ai_pbx_dev
# DB_USER=postgres
# DB_PASSWORD=ai_pbx_secure_password_2024
```

### **Step 3: Database Setup**

Choose your database option:

#### **Option A: SQLite (Recommended for beginners)**
```bash
# Create data directory
mkdir -p data

# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

#### **Option B: PostgreSQL (Recommended for production)**
```bash
# Start PostgreSQL with Docker
docker run -d \
  --name ai-pbx-postgres \
  -e POSTGRES_DB=ai_pbx_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=ai_pbx_secure_password_2024 \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15

# Wait 10 seconds for PostgreSQL to start
sleep 10

# Run database migrations
npm run db:migrate

# Seed initial data  
npm run db:seed
```

### **Step 4: Start AI PBX**

```bash
# Start the AI PBX server
npm start

# You should see:
# ✅ Server running on http://localhost:3000
# ✅ Environment: development
# ✅ Health check: http://localhost:3000/health
```

**Test that it's working:**
```bash
# In another terminal, test the health endpoint
curl http://localhost:3000/health

# Should return: {"status":"OK","timestamp":"...","uptime":...}
```

### **Step 5: Set Up WhatsApp Connection**

#### **Start Evolution API (WhatsApp Gateway)**
```bash
# Create Evolution API configuration
cat > docker-compose.whatsapp.yml << 'EOF'
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:v2.1.1
    container_name: whatsapp-evolution
    ports:
      - "8080:8080"
    environment:
      # Server
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      
      # Database (disabled for simplicity)
      - DATABASE_ENABLED=false
      
      # Webhook (connects to your AI PBX)
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_URL=http://host.docker.internal:3000/webhook
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=true
      
      # Authentication
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=ai-pbx-evolution-key-2024
      
      # Logging
      - LOG_LEVEL=ERROR,WARN,INFO
      - LOG_COLOR=true
      
    volumes:
      - evolution_instances:/evolution/instances
    restart: unless-stopped

volumes:
  evolution_instances:
EOF

# Start Evolution API
docker-compose -f docker-compose.whatsapp.yml up -d

# Wait for it to start
echo "Waiting for Evolution API to start..."
sleep 15
```

#### **Connect Your WhatsApp**
1. **Open your browser:** http://localhost:8080/manager/instance
2. **Create new instance:**
   - Name: `ai-pbx-instance`
   - Token: `ai-pbx-evolution-key-2024`
   - Webhook URL: `http://localhost:3000/webhook`
3. **Connect WhatsApp:**
   - Click "Connect"
   - Scan QR code with WhatsApp (Menu → Linked Devices → Link a Device)
   - Wait for "Connected" status

### **Step 6: Test Your AI PBX**

#### **Send Test Message**
1. Send a message to your WhatsApp number from another phone
2. Watch your AI PBX terminal - you should see message processing
3. Your AI assistant should respond automatically!

#### **Test Different Message Types**
- **"Hi there!"** → Basic greeting response
- **"I need help with my project deadline"** → Business category  
- **"URGENT! System is down!"** → High priority handling
- **"¿Puedes ayudarme?"** → Spanish language detection

---

## 🔧 **Management & Monitoring**

### **Check System Status**
```bash
# AI PBX Health
curl http://localhost:3000/health

# Assistant Status
curl http://localhost:3000/api/assistant/status

# Recent Conversations
curl "http://localhost:3000/api/conversations?limit=5"

# System Statistics
curl http://localhost:3000/api/status
```

### **Evolution API Management**
- **Manager Interface:** http://localhost:8080/manager/instance
- **API Documentation:** http://localhost:8080/docs
- **Instance Status:** Check connection status and QR codes

### **Database Management**

#### **SQLite**
```bash
# View database file
ls -la data/ai_pbx.db

# Connect to database (if sqlite3 installed)
sqlite3 data/ai_pbx.db
.tables
.quit
```

#### **PostgreSQL**
```bash
# Connect to database
docker exec -it ai-pbx-postgres psql -U postgres -d ai_pbx_dev

# View tables
\dt
\q
```

---

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **AI PBX Won't Start**
```bash
# Check for port conflicts
lsof -i :3000

# Check environment variables
cat .env

# Check logs
npm start
# Look for error messages
```

#### **OpenAI Not Working**
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# Check .env file
grep OPENAI_API_KEY .env
```

#### **WhatsApp Not Connecting**
```bash
# Check Evolution API logs
docker logs whatsapp-evolution

# Check if Evolution API is running
curl http://localhost:8080

# Verify webhook configuration
curl -H "apikey: ai-pbx-evolution-key-2024" \
     http://localhost:8080/webhook/find/ai-pbx-instance
```

#### **Database Issues**
```bash
# SQLite: Check if file exists and is writable
ls -la data/
chmod 755 data/
chmod 644 data/ai_pbx.db

# PostgreSQL: Check if container is running
docker ps | grep postgres
docker logs ai-pbx-postgres
```

### **Performance Optimization**

#### **For High Message Volume**
```bash
# Use PostgreSQL instead of SQLite
# Add database indexing
# Configure message cleanup intervals
# Monitor system resources
```

#### **For Production Deployment**
```bash
# Use PM2 for process management
npm install -g pm2
pm2 start src/app.js --name ai-pbx

# Configure nginx reverse proxy
# Set up SSL certificates
# Configure domain name
# Set up monitoring and alerts
```

---

## 🌐 **Production Deployment**

### **Cloud Hosting Options**

#### **DigitalOcean Droplet ($5/month)**
1. Create Ubuntu 22.04 droplet
2. Install Node.js, Docker, and nginx
3. Clone your AI PBX project
4. Configure domain and SSL
5. Use PM2 for process management

#### **Heroku (Free tier available)**
1. Create Heroku app
2. Add PostgreSQL add-on
3. Configure environment variables
4. Deploy using Git

#### **AWS/Google Cloud**
1. Create VM instance
2. Configure security groups
3. Set up load balancer
4. Configure auto-scaling

### **Domain and SSL Setup**
```bash
# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Configure nginx
sudo nano /etc/nginx/sites-available/ai-pbx
```

---

## 📊 **System Architecture**

```
📱 WhatsApp Messages
    ↓
🌐 Evolution API (Port 8080)
    ↓ (Webhook)
🤖 AI PBX Server (Port 3000)
    ├── 🔍 Message Analysis
    ├── 🧠 OpenAI Processing
    ├── 💾 Database Storage
    └── 📤 Response Generation
    ↓
📱 WhatsApp Response
```

---

## 📈 **Cost Breakdown**

### **Development/Testing (Free)**
- AI PBX: Free
- Evolution API: Free
- SQLite Database: Free
- Local hosting: Free
- **Total: $0/month**

### **Production with OpenAI**
- AI PBX: Free
- OpenAI API: ~$5-20/month (depends on usage)
- Cloud hosting: $5-20/month
- Domain name: $10-15/year
- **Total: ~$10-40/month**

---

## ✅ **Success Checklist**

Before going live, ensure:

- [ ] AI PBX starts without errors
- [ ] Database migrations completed
- [ ] OpenAI API key working (test with curl)
- [ ] Evolution API connected and running
- [ ] WhatsApp QR code scanned and connected
- [ ] Test messages processed correctly  
- [ ] AI responses generated properly
- [ ] All credentials configured securely
- [ ] Webhook receiving messages
- [ ] Database storing conversations
- [ ] Log files created and readable

---

## 🎯 **Next Steps After Setup**

1. **Customize responses** - Edit templates in `.env`
2. **Add business rules** - Modify filtering logic
3. **Set up monitoring** - Add alerts for system health
4. **Configure backups** - Regular database backups
5. **Scale up** - Move to production hosting
6. **Add features** - Admin dashboard, analytics, etc.

---

**🎉 Congratulations! Your AI PBX is now ready to handle WhatsApp messages automatically! 🤖📱**

For support and updates, check the project documentation and logs regularly.