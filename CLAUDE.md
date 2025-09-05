# AI PBX - Claude Assistant Guide

This document provides comprehensive information for Claude AI sessions to understand and work with the AI PBX system.

## System Overview

PAI System is a dual WhatsApp assistant platform that integrates with Evolution API to provide intelligent message filtering, automated responses, and conversation management with a modern React chat interface.

### Dual Assistant Architecture
```
WhatsApp Device 1 (PAI Responder) ↔ Evolution API Instance 1 ↔ AI PBX Backend ↔ React Frontend
WhatsApp Device 2 (PAI Assistant) ↔ Evolution API Instance 2 ↗         ↓
                                                                PostgreSQL Database
                                                                        ↓
                                                                OpenAI GPT Integration
```

## Current Status (September 2025)

✅ **Fully Operational Dual Assistant System:**
- **PAI Responder**: Main WhatsApp line for auto-responses
- **PAI Assistant**: Secondary line for message history queries  
- WhatsApp integration via Evolution API v2.0.9
- Multi-instance Evolution service for dual line management
- Real-time chat interface with Socket.io
- Assistant configuration management
- Message filtering and AI responses
- Connection status monitoring
- Server-side rendered QR code pages for device connection

## Project Structure (Updated September 2025)

```
ai_pbx/
├── src/                           # Backend (Node.js/Express)
│   ├── app.js                     # Main application entry
│   ├── controllers/               # API endpoints
│   │   ├── webhook.js             # WhatsApp webhook handler
│   │   ├── chat.js                # Chat management
│   │   └── assistant.js           # Assistant configuration
│   ├── services/                  # Business logic (reorganized)
│   │   ├── ai/                    # AI services
│   │   │   ├── assistantAI.js     # Core AI intent parsing & response generation
│   │   │   ├── openai.js          # Direct OpenAI API integration
│   │   │   ├── whatsapp-assistant.js # WhatsApp-specific AI assistant
│   │   │   ├── paiResponderAdapter.js # PAI Responder logic
│   │   │   └── paiAssistantAdapter.js # PAI Assistant query logic
│   │   ├── whatsapp/              # WhatsApp services  
│   │   │   ├── whatsapp.js        # Core WhatsApp service
│   │   │   ├── evolutionMultiInstance.js # Multi-instance manager
│   │   │   └── messageProcessor.js # Message processing pipeline
│   │   ├── database/              # Database services
│   │   │   ├── messageRetrieval.js # Message search and retrieval
│   │   │   ├── queryBuilder.js    # Database query building
│   │   │   └── messageSearch.js   # Advanced message search
│   │   ├── utils/                 # Utility services
│   │   │   ├── conversation.js    # Conversation management
│   │   │   ├── filters.js         # Message filtering and analysis
│   │   │   ├── groupService.js    # WhatsApp group handling
│   │   │   └── realtime.js        # Socket.io real-time service
│   │   ├── assistant.js           # Legacy assistant service
│   │   └── assistantMessageHandler.js # Message handler
│   ├── routes/                    # Express routing
│   │   ├── api.js                 # Main API routes
│   │   ├── webhook.js             # Webhook routes
│   │   ├── qr-assistant/          # PAI Assistant QR page
│   │   └── qr-responder/          # PAI Responder QR page
│   ├── models/                    # Sequelize database models
│   │   ├── Assistant.js           # Assistant configuration
│   │   ├── Contact.js             # Contact management
│   │   ├── Conversation.js        # Conversation tracking
│   │   └── Message.js             # Message storage
│   └── utils/                     # Helper functions
├── client/                        # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── ConversationList.tsx
│   │   │   ├── MessageView.tsx
│   │   │   ├── AssistantSettings.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── services/              # API clients
│   │   │   ├── api.ts             # HTTP API calls
│   │   │   └── socket.ts          # Socket.io client
│   │   ├── types/                 # TypeScript definitions
│   │   └── utils/                 # Frontend utilities
├── docker/                        # Docker configurations (NEW)
│   ├── evolution/                 # Evolution API only setup
│   │   ├── docker-compose.yml     # Evolution + PostgreSQL + Redis
│   │   ├── init-db.sql            # Database initialization
│   │   ├── start.sh               # Start script with health checks
│   │   └── stop.sh                # Stop script
│   └── full-stack/                # Complete system setup
│       ├── docker-compose.yml     # Full stack deployment
│       ├── Dockerfile.backend     # Backend container
│       ├── Dockerfile.frontend    # Frontend container
│       ├── nginx.conf             # Reverse proxy config
│       ├── start.sh               # Full stack startup
│       └── stop.sh                # Full stack shutdown
├── archive/                       # Archived files (NEW)
│   └── obsolete-scripts/          # Old scripts moved here
│       ├── chat.js                # Legacy CLI chat
│       ├── show-pai-assistant-qr.js
│       ├── test-fixes.js
│       └── setup-pai-assistant-line.js
├── prompts/                       # AI prompts
│   ├── pai_responder.md           # PAI Responder personality
│   └── pai_assistant.md           # PAI Assistant personality  
├── database/                      # Database migrations
├── tests/                         # Test suites
├── docs/                          # Documentation
└── scripts/                       # Utility scripts
```

## Key Components

### Dual Assistant System

**PAI Responder (Main Line)**:
- **Purpose**: Auto-responds to all incoming WhatsApp messages
- **Instance ID**: `aipbx` 
- **Webhook Path**: `/webhook`
- **QR Code**: `http://localhost:3000/qr-responder`
- **Personality**: Defined in `prompts/pai_responder.md`

**PAI Assistant (Query Line)**:
- **Purpose**: Specialized for searching message history and providing summaries
- **Instance ID**: `pai-assistant`
- **Webhook Path**: `/webhook/pai-assistant` 
- **QR Code**: `http://localhost:3000/qr-assistant`
- **Personality**: Defined in `prompts/pai_assistant.md`

### Backend Services (Reorganized)

**Multi-Instance Evolution Service** (`src/services/whatsapp/evolutionMultiInstance.js`):
- Manages dual WhatsApp instances
- Handles QR code generation for both devices
- Routes webhooks to appropriate handlers
- Connection status monitoring per instance

**AI Services** (`src/services/ai/`):
- `assistantAI.js`: Core AI intent parsing and response generation
- `whatsapp-assistant.js`: WhatsApp-specific AI with conversation history
- `paiResponderAdapter.js`: PAI Responder logic and personality
- `paiAssistantAdapter.js`: PAI Assistant query processing
- `openai.js`: Direct OpenAI API integration

**Message Processing Pipeline** (`src/services/whatsapp/messageProcessor.js`):
- Handles all incoming WhatsApp messages
- Routes to appropriate assistant based on instance
- Manages conversation context and history
- Error handling and recovery

**Database Services** (`src/services/database/`):
- `messageRetrieval.js`: Advanced message search and filtering
- `queryBuilder.js`: Dynamic SQL query building
- `messageSearch.js`: Full-text search capabilities

### Frontend Components

**App.tsx**: Main application component with:
- WebSocket connection management
- WhatsApp connection status monitoring (every 5s polling)
- Global assistant settings modal
- Dual instance status display

**ConversationList.tsx**: 
- Lists all conversations
- Global settings gear icon (always visible)
- Assistant toggle per conversation
- Instance indicator (Responder vs Assistant)

**MessageView.tsx**:
- Individual chat interface
- Message rendering with media support
- Real-time message updates
- Instance-aware message display

**AssistantSettings.tsx**:
- Configuration modal for both assistants:
  - Assistant names (PAI Responder/Assistant)
  - Greeting message templates
  - System prompts
  - Owner name

## Database Schema

### Key Models:
- **Assistant**: Configuration and settings for both assistants
- **Contact**: WhatsApp contact information
- **Conversation**: Chat threads with contacts
- **Message**: Individual messages with metadata and instance tracking

### Important Fields:
- `Assistant.systemPrompt`: AI behavior instructions
- `Assistant.autoResponseTemplate`: Greeting message
- `Conversation.isAssistantEnabled`: Per-conversation toggle
- `Message.sender`: 'user', 'assistant', or 'system'
- `Message.instanceId`: Tracks which WhatsApp instance received/sent

## API Endpoints

### Main Routes (`/api/`):
- `GET /chat` - List conversations
- `GET /chat/:id/messages` - Get conversation messages
- `POST /chat/:id/messages` - Send message
- `GET /assistant/config` - Get assistant settings
- `PUT /assistant/config` - Update assistant settings
- `GET /whatsapp/status` - Check WhatsApp connection status

### Webhook Routes (`/webhook/`):
- `POST /` - Receive WhatsApp messages (PAI Responder)
- `POST /pai-assistant` - Receive messages (PAI Assistant)
- `GET /status` - Webhook health check

### QR Code Routes:
- `GET /qr-responder` - PAI Responder QR code page
- `GET /qr-assistant` - PAI Assistant QR code page
- `GET /qr-direct` - Legacy direct QR access

## Environment Configuration

### Required Environment Variables:
```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=pai_evolution_api_key_2025
EVOLUTION_INSTANCE_ID=aipbx
EVOLUTION_PAI_ASSISTANT_INSTANCE_ID=pai-assistant

# Webhook URLs  
WEBHOOK_URL=http://localhost:3000/webhook
EVOLUTION_PAI_ASSISTANT_WEBHOOK_URL=http://localhost:3000/webhook/pai-assistant

# Database
DATABASE_URL=postgresql://ai_pbx:aipbx123@localhost:5432/ai_pbx_db

# OpenAI
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Server
PORT=3000
HOST=0.0.0.0
```

## Docker Deployment

### Option 1: Full Stack (Recommended)
```bash
cd docker/full-stack
export OPENAI_API_KEY='your-key-here'
./start.sh
```

**Services Started:**
- AI PBX Backend (port 3000)
- AI PBX Frontend (port 5173) 
- Evolution API (port 8080)
- PostgreSQL (port 5432)
- Redis (port 6379)

### Option 2: Evolution API Only
```bash
cd docker/evolution  
./start.sh
```

**Services Started:**
- Evolution API (port 8080)
- PostgreSQL (port 5432)
- Redis (port 6379)

## Common Development Tasks

### Start Development Servers:
```bash
# Backend (port 3000)
npm start

# Frontend (port 5173)
cd client && npm run dev

# Full Stack with Docker
cd docker/full-stack && ./start.sh
```

### Database Operations:
```bash
# Run migrations
npx sequelize-cli db:migrate

# Create new migration
npx sequelize-cli migration:generate --name migration-name
```

### Testing Dual Assistant Setup:
1. **Connect PAI Responder**: Visit `http://localhost:3000/qr-responder`
2. **Connect PAI Assistant**: Visit `http://localhost:3000/qr-assistant`
3. **Test Auto-Response**: Send message to PAI Responder number
4. **Test Queries**: Send "show me messages from today" to PAI Assistant

## Evolution API Integration

### Version: v2.0.9 (Docker)
- **Container**: `atendai/evolution-api:v2.0.9`
- **Port**: 8080
- **Multi-Instance**: Supports dual WhatsApp connections
- **Webhook**: Handles incoming messages from both instances

### Key Evolution API Endpoints:
- `GET /instance/connectionState/{instanceId}` - Check connection
- `POST /message/sendText/{instanceId}` - Send message
- `POST /webhook/set/{instanceId}` - Configure webhook
- `GET /instance/qrcode/{instanceId}` - Get QR code
- `POST /instance/create` - Create new instance

## Known Issues & Solutions

### Issue: Dual Instance Management
**Solution**: Use `evolutionMultiInstance.js` service for proper instance routing

### Issue: QR Code JavaScript Not Loading
**Solution**: Server-side rendered QR pages at `/qr-responder` and `/qr-assistant`

### Issue: Message Routing Between Instances  
**Solution**: Webhook path-based routing (`/webhook` vs `/webhook/pai-assistant`)

### Issue: Assistant Configuration Conflicts
**Solution**: Separate prompts and configurations per assistant type

## Development Notes

### Message Processing Flow:
1. WhatsApp → Evolution API → Webhook (instance-specific)
2. `evolutionMultiInstance.js` → Routes to appropriate handler
3. `messageProcessor.js` → Processes message with context
4. **PAI Responder**: Auto-response generation
5. **PAI Assistant**: Query processing and database search
6. Response → WhatsApp via correct Evolution instance
7. Real-time updates via Socket.io

### Dual Instance Benefits:
- **Separation of Concerns**: Auto-responses vs queries
- **Specialized Prompts**: Different personalities per function
- **Reduced Conflicts**: No confusion between response types
- **Scalability**: Independent scaling per function

### Frontend State Management:
- React hooks for local state
- Socket.io for real-time updates
- Polling for WhatsApp connection status per instance
- Context sharing between components
- Instance-aware UI components

### Security Considerations:
- Multi-instance webhook validation
- API key protection per instance
- Environment variable management
- Webhook signature validation (Evolution API)
- Database access controls

## Quick Commands

```bash
# Check logs
tail -f logs/combined.log

# Restart services
docker-compose restart evolution-api

# Check database connection
npm run db:test

# Build for production
npm run build && cd client && npm run build

# Check instance status (PAI Responder)
curl http://localhost:8080/instance/connectionState/aipbx

# Check instance status (PAI Assistant) 
curl http://localhost:8080/instance/connectionState/pai-assistant

# Test webhook routing
curl -X POST http://localhost:3000/webhook -d '{"test": "responder"}'
curl -X POST http://localhost:3000/webhook/pai-assistant -d '{"test": "assistant"}'
```

## Deployment

### Docker Compose:
- **Full Stack**: Complete system in containers
- **Evolution Only**: Just Evolution API + databases
- **Health Checks**: Automatic service monitoring
- **Volume Persistence**: Data survives container restarts

### Production Checklist:
- [ ] Environment variables configured for both instances
- [ ] Database migrations run
- [ ] Both Evolution API instances created
- [ ] Webhook URLs configured correctly
- [ ] Both WhatsApp devices connected
- [ ] Assistant settings configured for both
- [ ] QR code access secured
- [ ] Monitoring and logging enabled

## Recent Updates (September 2025)

- ✅ **Dual Assistant Architecture**: PAI Responder + PAI Assistant
- ✅ **Multi-Instance Evolution Service**: Manages both WhatsApp connections
- ✅ **Repository Reorganization**: Clean folder structure with proper separation
- ✅ **Comprehensive Documentation**: JSDoc comments on all service files
- ✅ **Docker Infrastructure**: Full containerization with health checks
- ✅ **Server-Side QR Pages**: JavaScript-free QR code display
- ✅ **Management Scripts**: Easy deployment and monitoring
- ✅ **Advanced Message Processing**: Intent parsing and query handling
- ✅ **Database Service Layer**: Optimized message retrieval and search

## Troubleshooting

### Common Commands for Debugging:
```bash
# Check Evolution API status (both instances)
curl http://localhost:8080/instance/connectionState/aipbx
curl http://localhost:8080/instance/connectionState/pai-assistant

# Test webhook endpoints
curl http://localhost:3000/api/whatsapp/status

# Check assistant configurations
curl http://localhost:3000/api/assistant/config

# Monitor logs by service
docker-compose logs evolution-api
docker-compose logs ai-pbx-backend

# View real-time message processing
tail -f logs/combined.log | grep "Message processing"
```

### Docker Management:
```bash
# Full stack startup
cd docker/full-stack && ./start.sh

# Evolution only startup  
cd docker/evolution && ./start.sh

# View service status
docker-compose ps

# Reset all data
docker-compose down -v
```

This guide provides comprehensive context for any Claude session to understand and work effectively with the dual assistant PAI System.