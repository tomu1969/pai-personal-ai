# PAI - Personal AI

> **Personal AI Assistant** with intelligent WhatsApp integration, AI-powered entity extraction, and real-time chat interface.

## 🚀 Status: Fully Operational (September 2025)

✅ **Complete WhatsApp Integration** - Evolution API v2.0.9  
✅ **AI-Powered Entity Extraction** - OpenAI GPT with structured queries  
✅ **Real-time Chat Interface** - React + Socket.io  
✅ **Smart Assistant Configuration** - Customizable AI behavior  
✅ **Intelligent Database Queries** - Natural language to SQL  
✅ **Connection Monitoring** - Live WhatsApp status tracking  

## ✨ Key Features

### 🧠 **Intelligent AI Processing**
- **Entity Extraction**: Converts natural language to structured database queries
- **Multiple Intent Types**: `message_query`, `contact_query`, `conversation_query`, `summary`
- **Smart Responses**: AI-powered responses using real database results
- **Natural Language Understanding**: "what messages have I received in the last 30 minutes?"

### 💬 **Modern Chat Interface**
- Real-time WhatsApp-style messaging
- WebSocket-powered instant updates
- Per-conversation assistant toggle
- Live connection status monitoring

### ⚙️ **Advanced Configuration**
- Customizable AI personality and behavior
- Flexible message type preferences
- Smart cooldown management
- Priority-based message handling

### 🔍 **Intelligent Query System**
- **Time-based Queries**: "messages from today", "last 20 minutes"
- **Contact Filtering**: "who messaged me yesterday?"
- **Content Search**: "messages containing urgent"
- **Smart Summaries**: AI-generated insights with real data

## 🏗️ Architecture

```
WhatsApp ↔ Evolution API ↔ Node.js Backend ↔ React Frontend
                             ↓
                      AI Entity Extraction
                             ↓
                    PostgreSQL + Query Engine
                             ↓
                        OpenAI GPT Response
```

### Core Components

- **Entity Extraction Service**: Converts natural language to structured entities
- **Query Builder**: Transforms entities into optimized database queries  
- **Message Retrieval**: Executes queries and formats results for AI
- **Real-time WebSocket**: Instant message broadcasting
- **Assistant Handler**: Orchestrates AI processing pipeline

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- OpenAI API key
- PostgreSQL

### Installation

```bash
# 1. Clone and install backend
git clone https://github.com/[your-username]/pai-personal-ai.git
cd pai-personal-ai
npm install

# 2. Install frontend
cd client
npm install
cd ..

# 3. Environment setup
cp .env.example .env
# Edit .env with your credentials

# 4. Start services
docker-compose up -d  # Evolution API + PostgreSQL
npm run migrate       # Database setup
npm run seed         # Default assistant

# 5. Start development
npm run dev          # Backend (port 3000)
cd client && npm run dev  # Frontend (port 5173)
```

### Configuration

```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your_api_key
EVOLUTION_INSTANCE_ID=your_instance

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pai

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-3.5-turbo

# Server
PORT=3000
WEBHOOK_URL=http://localhost:3000/webhook
```

## 🤖 AI Capabilities

### Natural Language Examples

**Message Queries:**
- "Show me messages from the last 30 minutes"
- "What images did John send yesterday?"
- "Messages containing 'urgent' from this week"

**Contact Queries:**
- "Who messaged me today?"
- "Show me group conversations"
- "Contacts named Sarah"

**Smart Summaries:**
- "Summary of today's messages"
- "What happened while I was away?"
- "Urgent items from last week"

### Response Examples

Input: `"messages from the last 20 minutes"`

AI Processing:
- Intent: `summary`
- Entities: `{timeframe: {value: 20, unit: "minutes", relative: "past"}}`
- Query: `SELECT * FROM messages WHERE createdAt >= NOW() - INTERVAL '20 minutes'`
- Result: 22 messages found + AI-generated analysis

## 🛠️ Development

### Project Structure

```
pai-personal-ai/
├── src/                    # Backend (Node.js/Express)
│   ├── services/
│   │   ├── assistantAI.js         # Entity extraction + AI responses
│   │   ├── queryBuilder.js        # SQL query generation
│   │   ├── messageRetrieval.js    # Database query execution
│   │   └── assistantMessageHandler.js # Processing pipeline
│   ├── controllers/        # API endpoints
│   ├── models/            # Sequelize database models
│   └── routes/            # Express routing
├── client/                # React frontend
│   ├── src/components/    # React components
│   └── src/services/      # API + WebSocket clients
├── archive/               # Legacy and deprecated files
└── docs/                 # Documentation
```

### Testing

```bash
npm test              # Unit tests
npm run test:coverage # Coverage report
npm run test:watch    # Watch mode
```

### Key Services

- **assistantAI.js**: Natural language processing and entity extraction
- **queryBuilder.js**: Converts entities to optimized SQL queries
- **messageRetrieval.js**: Executes database queries with formatting
- **whatsapp-assistant.js**: GPT-powered WhatsApp message processing
- **realtime.js**: WebSocket message broadcasting

## 🤖 WhatsApp Assistant

### GPT-Powered Message Processing
The new **WhatsApp Assistant** (`src/services/whatsapp-assistant.js`) provides intelligent responses using OpenAI GPT:

- **Per-Contact Conversations**: Maintains separate conversation histories for each contact
- **Personalized System Prompts**: Uses configurable assistant name and owner information
- **Context Awareness**: Remembers previous messages in each conversation
- **Natural Language Processing**: Powered by GPT-4o-mini or GPT-3.5-turbo

### Integration with Evolution API
```javascript
// Automatic processing when WhatsApp messages arrive
const response = await whatsappAssistant.processMessage(
  message.content,
  contact.phone,
  assistantConfig
);
```

## 🔧 CLI Tools

### Chat Tool (`chat.js`)
Interactive command-line chat with PAI assistant:

```bash
# Start interactive chat session
node chat.js

# Uses the same GPT model and system prompt as WhatsApp
# Maintains conversation history during session
# Reads from prompts/pai_responder.md
```

**Features:**
- Real-time conversation with PAI
- Same personality as WhatsApp assistant
- Proper signal handling (Ctrl+C)
- Environment variable support

## 📊 Features Comparison

| Feature | Old System | New PAI System |
|---------|------------|----------------|
| Query Processing | Regex patterns | AI entity extraction |
| Response Generation | Templates | AI with real data |
| Natural Language | Limited keywords | Full understanding |
| Database Queries | Static | Dynamic optimization |
| Real-time Updates | ❌ | ✅ WebSocket |
| Smart Filtering | Basic | Advanced AI |

## 🔧 API Endpoints

### Core Routes
- `GET /api/chat` - List conversations
- `POST /api/chat/:id/messages` - Send message  
- `GET /api/assistant/config` - Assistant settings
- `GET /api/whatsapp/status` - Connection status

### WebSocket Events
- `new_message` - Real-time message updates
- `typing_indicator` - Typing status
- `conversation_updated` - Conversation changes

## 📈 Recent Updates (September 2025)

✅ **v1.0.0 - PAI Launch**
- Complete rewrite from AI PBX to PAI - Personal AI
- AI-powered entity extraction replaces regex patterns  
- Intelligent database queries with natural language processing
- Real-time WebSocket communication fixes
- Smart assistant responses with actual data analysis
- Modern project structure and documentation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/[your-username]/pai-personal-ai)
- [Documentation](docs/)
- [API Reference](docs/api/)

---

**PAI - Personal AI** | Transforming WhatsApp communication with intelligent AI assistance