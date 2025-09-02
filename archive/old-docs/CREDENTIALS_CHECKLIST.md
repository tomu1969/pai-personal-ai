# 🔑 AI PBX Credentials Checklist

## ✅ **Required Credentials & Where to Get Them**

### **🤖 1. OpenAI API Key (Highly Recommended)**
- **Purpose:** Intelligent AI responses and message analysis
- **Where to get:** https://platform.openai.com/api-keys
- **Steps:**
  1. Create account at https://platform.openai.com/
  2. Go to API Keys section
  3. Click "Create new secret key"
  4. Copy the key (starts with `sk-proj-...`)
  5. Add to `.env` file: `OPENAI_API_KEY=sk-proj-your-key-here`
- **Cost:** ~$0.001-0.002 per message (~$5-20/month typical usage)
- **Format:** `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Required:** No (but system is much smarter with it)

### **📱 2. WhatsApp Account**
- **Purpose:** Your phone number that will receive and respond to messages
- **Where to get:** Your existing WhatsApp account
- **Steps:**
  1. Use your current WhatsApp number
  2. Have your phone available to scan QR code
  3. Make sure WhatsApp Web isn't connected elsewhere
- **Cost:** Free
- **Format:** Your phone number
- **Required:** Yes

### **🔐 3. Security Keys (Auto-generated)**
- **Purpose:** Secure your API endpoints and webhooks
- **Where to get:** Generate random secure strings
- **Steps:**
  ```bash
  # Generate secure JWT secret (run this command)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Generate webhook secret (run this command)
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  ```
- **Add to `.env`:**
  ```bash
  JWT_SECRET=your-generated-jwt-secret-here
  WEBHOOK_SECRET=your-generated-webhook-secret-here
  ```
- **Cost:** Free
- **Required:** Yes

### **🗄️ 4. Database (Choose One)**

#### **Option A: SQLite (Recommended for Testing)**
- **Purpose:** Local file-based database
- **Where to get:** Built into the system
- **Steps:** No credentials needed - automatically created
- **Cost:** Free
- **Configuration:** `DATABASE_URL=sqlite:./data/ai_pbx.db`
- **Required:** Yes (choose this OR PostgreSQL)

#### **Option B: PostgreSQL (Recommended for Production)**
- **Purpose:** Professional database server
- **Where to get:** Docker container (included in setup)
- **Steps:** Automatic setup with secure password
- **Cost:** Free (using Docker)
- **Configuration:**
  ```bash
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=ai_pbx_dev
  DB_USER=postgres
  DB_PASSWORD=ai_pbx_secure_password_2024
  ```
- **Required:** Yes (choose this OR SQLite)

### **🌐 5. Domain Name (Optional - Production Only)**
- **Purpose:** Custom URL instead of localhost
- **Where to get:** Domain registrars (GoDaddy, Namecheap, Cloudflare)
- **Steps:**
  1. Purchase domain (e.g., `myaipbx.com`)
  2. Configure DNS to point to your server
  3. Set up SSL certificate
- **Cost:** $10-15/year
- **Format:** `https://yourdomain.com`
- **Required:** No (only for production deployment)

### **☁️ 6. Cloud Hosting (Optional - Production Only)**
- **Purpose:** Run AI PBX on the internet instead of your computer
- **Where to get:** Cloud providers
- **Options:**
  - **DigitalOcean:** $5/month droplet
  - **AWS:** $5-10/month EC2 instance  
  - **Google Cloud:** $5-10/month VM
  - **Heroku:** $7/month dyno
- **Required:** No (only for production deployment)

---

## 🔒 **Credential Security Best Practices**

### **✅ DO:**
- Keep API keys in `.env` file (never in code)
- Use strong, random passwords
- Generate new keys for production
- Regularly rotate API keys
- Back up your `.env` file securely

### **❌ DON'T:**
- Commit `.env` to git (it's in .gitignore)
- Share API keys in screenshots or messages
- Use the same keys for development and production
- Store credentials in plain text files

---

## 📋 **Complete Credentials Setup Template**

Create your `.env` file with these values:

```bash
# ====================
# BASIC SERVER SETTINGS
# ====================
NODE_ENV=development
PORT=3000
HOST=localhost

# ====================
# OPENAI API (GET FROM: https://platform.openai.com/api-keys)
# ====================
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
OPENAI_MODEL=gpt-3.5-turbo

# ====================
# ASSISTANT CONFIGURATION
# ====================
DEFAULT_ASSISTANT_STATUS=true
OWNER_NAME=Your Name Here
AUTO_RESPONSE_TEMPLATE="Hi {{contact_name}}! This is {{owner_name}}'s AI assistant. How can I help you today?"
SUMMARY_INTERVAL_HOURS=6

# ====================
# WHATSAPP (EVOLUTION API)
# ====================
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=ai-pbx-evolution-key-2024
EVOLUTION_INSTANCE_ID=ai-pbx-instance
WEBHOOK_URL=http://localhost:3000/webhook

# ====================
# SECURITY (GENERATE WITH COMMANDS ABOVE)
# ====================
JWT_SECRET=your-generated-jwt-secret-here
WEBHOOK_SECRET=your-generated-webhook-secret-here

# ====================
# DATABASE OPTION A: SQLITE (SIMPLE)
# ====================
DATABASE_URL=sqlite:./data/ai_pbx.db

# ====================
# DATABASE OPTION B: POSTGRESQL (ADVANCED)
# Uncomment these if using PostgreSQL instead of SQLite
# ====================
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=ai_pbx_dev
# DB_USER=postgres
# DB_PASSWORD=ai_pbx_secure_password_2024
# DB_LOGGING=false

# ====================
# LOGGING
# ====================
LOG_LEVEL=info
LOG_FILE=logs/app.log

# ====================
# RATE LIMITING
# ====================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🚀 **Quick Setup Commands**

```bash
# 1. Generate security keys
echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
echo "WEBHOOK_SECRET=$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"

# 2. Copy and edit environment file
cp .env.example .env
nano .env

# 3. Test OpenAI key (replace with your actual key)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-proj-your-actual-key-here"

# 4. Start the system
npm install
npm run db:migrate
npm start
```

---

## ✅ **Credentials Validation Checklist**

Before starting AI PBX, verify:

- [ ] **OpenAI API Key:** Starts with `sk-proj-` and is valid
- [ ] **JWT Secret:** Random 64-character hex string
- [ ] **Webhook Secret:** Random 32-character hex string  
- [ ] **Owner Name:** Your actual name for responses
- [ ] **Database:** Either SQLite path or PostgreSQL credentials
- [ ] **WhatsApp:** Phone ready to scan QR code
- [ ] **Ports:** 3000 and 8080 available on your system
- [ ] **Docker:** Running if using Evolution API

---

## 💰 **Cost Summary**

### **Minimum Cost (Development):**
- AI PBX: **Free**
- SQLite Database: **Free**  
- Local hosting: **Free**
- **Total: $0/month**

### **Recommended Cost (With AI):**
- AI PBX: **Free**
- OpenAI API: **$5-20/month**
- SQLite Database: **Free**
- Local hosting: **Free**
- **Total: $5-20/month**

### **Production Cost:**
- AI PBX: **Free**
- OpenAI API: **$10-30/month**
- Cloud hosting: **$5-20/month**
- Domain name: **$10-15/year**
- **Total: $15-50/month + domain**

---

**🎯 Once you have all credentials, follow the main setup guide in `AI_PBX_COMPLETE_SETUP_GUIDE.md`**