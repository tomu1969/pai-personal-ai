# 📊 AI PBX Storage & Data Flow

## 🗄️ **Where Your Data is Stored**

### **1. Messages Storage**
```
📧 Incoming Messages → Database
├── Content: Original message text
├── Analysis: Category, priority, sentiment  
├── Metadata: Timestamp, sender info, message type
├── AI Analysis: OpenAI insights (if configured)
└── Response: Generated reply content
```

### **2. Conversations Storage**
```
💬 Conversations → Database
├── Contact Information: Phone, name, profile
├── Message History: Complete conversation thread
├── Status: Active, resolved, waiting
├── Priority Level: Urgent, high, medium, low
├── Category: Business, personal, support, etc.
└── Summary: AI-generated conversation summary
```

### **3. Contacts Storage**
```
👤 Contacts → Database  
├── Phone Number: WhatsApp identifier
├── Display Name: Contact name from WhatsApp
├── Profile Picture: Avatar URL (if available)
├── Last Activity: When they last messaged
├── Blocked Status: If contact is blocked
└── Conversation Count: Number of conversations
```

### **4. Assistant Analytics**
```
📈 Statistics → Database
├── Messages Processed: Total count
├── Response Rate: How often assistant responds
├── Category Breakdown: Distribution by type
├── Priority Analysis: Urgent vs normal messages
├── Language Detection: Multi-language support
└── Performance Metrics: Response times, success rates
```

## 🔄 **Complete Message Flow**

```
📱 WhatsApp Message
    ↓
🌐 Evolution API (receives)
    ↓  
📡 Webhook → AI PBX
    ↓
🔍 Message Analysis
    ├── Basic Rules (always works)
    ├── OpenAI Analysis (if API key provided)
    └── Language Detection
    ↓
💾 Store in Database
    ├── Contact (create/update)
    ├── Conversation (create/update)
    └── Message (store with analysis)
    ↓
🤖 Generate Response
    ├── Check if should respond
    ├── Generate AI response (if OpenAI available)
    └── Fallback to template response
    ↓
📤 Send Response
    ├── Evolution API → WhatsApp
    └── Update message status
    ↓
📊 Update Statistics
```

## 🎯 **Database Tables Created**

### **Assistants Table**
- Configuration and status
- Message processing counters  
- Auto-response templates
- Owner information

### **Contacts Table**
- Phone numbers and names
- Profile information
- Activity tracking
- Block status

### **Conversations Table**  
- Contact relationships
- Status and priority
- Category classification
- Message counts and timestamps

### **Messages Table**
- Complete message content
- Analysis results (category, priority, sentiment)
- AI insights (if OpenAI used)
- Response content
- Metadata and timestamps

## 🔒 **Data Security**

### **Local Storage (SQLite)**
- Data stored in `./data/ai_pbx.db` file
- No external dependencies
- Complete privacy and control

### **PostgreSQL Storage**
- Professional database in Docker container
- Encrypted connections
- Backup and restore capabilities
- Production-ready scaling

### **No External Data Sharing**
- Messages never leave your server
- OpenAI API only receives message content for analysis
- No data shared with third parties
- Complete control over your conversations

## 🚀 **API Key Configuration Impact**

### **With OpenAI API Key:**
```javascript
// Enhanced AI responses
const aiResponse = await openai.createChatCompletion({
  model: "gpt-3.5-turbo",
  messages: [
    {role: "system", content: "You are a professional assistant"},
    {role: "user", content: userMessage}
  ],
  temperature: 0.7
});

// Result: Intelligent, context-aware responses
```

### **Without OpenAI API Key:**
```javascript
// Template-based responses
const templateResponse = `Hi ${contactName}! This is ${ownerName}'s 
personal assistant. I'm currently helping filter messages. 
What do you need assistance with?`;

// Result: Simple but effective template responses
```

## 📈 **Storage Growth Estimates**

### **Per Message (~1-5KB each):**
- Basic message: ~1KB
- With AI analysis: ~3KB  
- With media/attachments: ~5KB+

### **Database Size Projections:**
- 100 messages/day = ~150KB/day
- 1,000 messages/day = ~1.5MB/day
- 10,000 messages/day = ~15MB/day

### **Cleanup and Maintenance:**
- Automatic old message cleanup (configurable)
- Database optimization queries
- Storage usage monitoring
- Archive/export capabilities

Your AI PBX is designed to handle everything locally and securely! 🔐✨