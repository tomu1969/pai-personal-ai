# AI PBX - Claude Assistant Guide

This document provides comprehensive information for Claude AI sessions to understand and work with the AI PBX system.

## System Overview

PAI System is a triple WhatsApp assistant platform that integrates with Evolution API to provide intelligent message filtering, automated responses, mortgage qualification assistance, and conversation management with a modern React chat interface.

### Triple Assistant Architecture
```
WhatsApp Device 1 (PAI Responder) ↔ Evolution API Instance 1 ↔ AI PBX Backend ↔ React Frontend
WhatsApp Device 2 (PAI Assistant) ↔ Evolution API Instance 2 ↗         ↓
WhatsApp Device 3 (PAI Mortgage) ↔ Evolution API Instance 3 ↗ PostgreSQL Database
                                                                        ↓
                                                                OpenAI GPT Integration
```

## Current Status (September 2025)

✅ **Fully Operational Triple Assistant System:**
- **PAI Responder**: Main WhatsApp line for auto-responses
- **PAI Assistant**: Secondary line for message history queries
- **PAI Mortgage**: Specialized mortgage qualification and guidance assistant
- WhatsApp integration via Evolution API v2.0.9
- Multi-instance Evolution service for triple line management
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
│   │   ├── webhookMultiInstance.js # Multi-instance webhook routing
│   │   ├── chat.js                # Chat management
│   │   ├── assistant.js           # Assistant configuration
│   │   └── paiMortgageController.js # PAI Mortgage endpoints
│   ├── services/                  # Business logic (reorganized)
│   │   ├── ai/                    # AI services
│   │   │   ├── assistantAI.js     # Core AI intent parsing & response generation
│   │   │   ├── openai.js          # Direct OpenAI API integration
│   │   │   ├── whatsapp-assistant.js # WhatsApp-specific AI assistant
│   │   │   ├── paiResponderAdapter.js # PAI Responder logic
│   │   │   ├── paiAssistantAdapter.js # PAI Assistant query logic
│   │   │   ├── paiMortgageAdapter.js # PAI Mortgage qualification logic
│   │   │   └── paiMortgageWhatsApp.js # PAI Mortgage WhatsApp integration
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
│   │   ├── qr-responder/          # PAI Responder QR page
│   │   └── qr-mortgage/           # PAI Mortgage QR page
│   ├── models/                    # Sequelize database models
│   │   ├── Assistant.js           # Assistant configuration
│   │   ├── Contact.js             # Contact management
│   │   ├── Conversation.js        # Conversation tracking
│   │   ├── Message.js             # Message storage
│   │   └── PaiMortgage.js         # PAI Mortgage data model
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
│   ├── pai_assistant.md           # PAI Assistant personality
│   └── pai_mortgage.md            # PAI Mortgage personality  
├── database/                      # Database migrations
├── tests/                         # Test suites
├── docs/                          # Documentation
└── scripts/                       # Utility scripts
```

## Key Components

### Triple Assistant System

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

**PAI Mortgage (Mortgage Specialist)**:
- **Purpose**: Specialized mortgage qualification and guidance assistant
- **Instance ID**: `pai-mortgage`
- **Webhook Path**: `/webhook/pai-mortgage` 
- **QR Code**: `http://localhost:3000/qr-mortgage`
- **Personality**: Defined in `prompts/pai_mortgage.md`
- **Features**: Bilingual support (English/Spanish), mortgage calculations, qualification assessment

### Backend Services (Reorganized)

**Multi-Instance Evolution Service** (`src/services/whatsapp/evolutionMultiInstance.js`):
- Manages triple WhatsApp instances (PAI Responder, PAI Assistant, PAI Mortgage)
- Handles QR code generation for all devices
- Routes webhooks to appropriate handlers
- Connection status monitoring per instance
- Instance reset and recovery capabilities for QR code limit issues

**AI Services** (`src/services/ai/`):
- `assistantAI.js`: Core AI intent parsing and response generation
- `whatsapp-assistant.js`: WhatsApp-specific AI with conversation history
- `paiResponderAdapter.js`: PAI Responder logic and personality
- `paiAssistantAdapter.js`: PAI Assistant query processing
- `paiMortgageAdapter.js`: PAI Mortgage qualification logic
- `paiMortgageWhatsApp.js`: PAI Mortgage WhatsApp integration
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
- `POST /pai-mortgage` - Receive messages (PAI Mortgage)
- `GET /status` - Webhook health check

### QR Code Routes:
- `GET /qr-responder` - PAI Responder QR code page
- `GET /qr-assistant` - PAI Assistant QR code page
- `GET /qr-mortgage` - PAI Mortgage QR code page
- `GET /qr-direct` - Legacy direct QR access

## Environment Configuration

### Required Environment Variables:
```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=pai_evolution_api_key_2025
EVOLUTION_INSTANCE_ID=aipbx
EVOLUTION_PAI_ASSISTANT_INSTANCE_ID=pai-assistant
PAI_MORTGAGE_INSTANCE_ID=pai-mortgage

# Webhook URLs  
WEBHOOK_URL=http://localhost:3000/webhook
EVOLUTION_PAI_ASSISTANT_WEBHOOK_URL=http://localhost:3000/webhook/pai-assistant
PAI_MORTGAGE_WEBHOOK_URL=http://localhost:3000/webhook/pai-mortgage

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

### Testing Triple Assistant Setup:
1. **Connect PAI Responder**: Visit `http://localhost:3000/qr-responder`
2. **Connect PAI Assistant**: Visit `http://localhost:3000/qr-assistant`
3. **Connect PAI Mortgage**: Visit `http://localhost:3000/qr-mortgage`
4. **Test Auto-Response**: Send message to PAI Responder number
5. **Test Queries**: Send "show me messages from today" to PAI Assistant
6. **Test Mortgage**: Send "I want to apply for a $350,000 mortgage" to PAI Mortgage

## Evolution API Integration

### Version: v2.0.9 (Docker)
- **Container**: `atendai/evolution-api:v2.0.9`
- **Port**: 8080
- **Multi-Instance**: Supports triple WhatsApp connections
- **Webhook**: Handles incoming messages from all instances

### Key Evolution API Endpoints:
- `GET /instance/connectionState/{instanceId}` - Check connection
- `POST /message/sendText/{instanceId}` - Send message
- `POST /webhook/set/{instanceId}` - Configure webhook
- `GET /instance/qrcode/{instanceId}` - Get QR code
- `POST /instance/create` - Create new instance

## PAI Mortgage Assistant Status (September 2025)

✅ **PAI Mortgage is Now Fully Operational**

### Recent Fixes Applied Today:

**1. OpenAI API Key Integration Fixed**:
- Fixed environment variable override issue that was preventing API key access
- Corrected OpenAI configuration loading in PAI Mortgage services
- Verified API key is properly passed to OpenAI client initialization

**2. Evolution API Authentication Resolved**:
- Fixed API key mismatches between different Evolution instances
- Resolved webhook configuration issues with proper "enabled" property
- Updated webhook payload format to match Evolution API v2.0.9 requirements

**3. Enhanced Webhook Routing**:
- Added comprehensive multi-instance webhook routing for PAI Mortgage
- Implemented instance-specific message processing pipeline
- Added proper error handling and logging for PAI Mortgage messages

**4. Comprehensive Logging and Debugging**:
- Added detailed logging throughout PAI Mortgage processing pipeline
- Implemented conversation context tracking
- Added bilingual response verification (English/Spanish)

**5. QR Code Connection Working**:
- PAI Mortgage QR code page fully functional at `/qr-mortgage`
- Instance creation and management working properly
- Connection status monitoring implemented

**6. Mortgage Qualification Features**:
- AI-powered mortgage qualification assessment
- Bilingual support (English/Spanish automatic detection)
- Real-time mortgage calculations and recommendations
- FHA, Conventional, VA, and USDA loan program guidance

### Environment Variable Troubleshooting:

**Common Issues and Solutions**:

1. **OpenAI API Key Not Working**:
   ```bash
   # Verify key is set correctly
   echo $OPENAI_API_KEY
   
   # Check if key starts with sk-proj- or sk-
   # Ensure no extra spaces or quotes in .env file
   ```

2. **Evolution API Key Mismatch**:
   ```bash
   # Ensure all instances use same API key
   EVOLUTION_API_KEY=pai_evolution_api_key_2025
   
   # Check Evolution API is accessible
   curl -H "apikey: pai_evolution_api_key_2025" http://localhost:8080/instance/list
   ```

3. **Instance Creation Fails**:
   ```bash
   # Reset problematic instance
   node scripts/reset-instance.js pai-mortgage
   
   # Check webhook endpoint is responding
   curl http://localhost:3000/webhook/pai-mortgage
   ```

### Known Working Configuration:
```env
# Verified working environment variables
OPENAI_API_KEY=sk-proj-your-actual-key-here
EVOLUTION_API_KEY=pai_evolution_api_key_2025
PAI_MORTGAGE_INSTANCE_ID=pai-mortgage
PAI_MORTGAGE_WEBHOOK_URL=http://localhost:3000/webhook/pai-mortgage
```

## Known Issues & Solutions

### Issue: Triple Instance Management
**Solution**: Use `evolutionMultiInstance.js` service for proper instance routing

### Issue: QR Code JavaScript Not Loading
**Solution**: Server-side rendered QR pages at `/qr-responder`, `/qr-assistant`, and `/qr-mortgage`

### Issue: Message Routing Between Instances  
**Solution**: Webhook path-based routing (`/webhook` vs `/webhook/pai-assistant` vs `/webhook/pai-mortgage`)

### Issue: Assistant Configuration Conflicts
**Solution**: Separate prompts and configurations per assistant type

### Issue: QR Code Limit Errors (RESOLVED)
**Solution**: Automated instance reset capabilities using `scripts/reset-instance.js`

### Issue: Environment Variable Override (RESOLVED)
**Solution**: Fixed OpenAI API key loading in services, proper environment variable hierarchy

## Development Notes

### Message Processing Flow:
1. WhatsApp → Evolution API → Webhook (instance-specific)
2. `evolutionMultiInstance.js` → Routes to appropriate handler
3. `messageProcessor.js` → Processes message with context
4. **PAI Responder**: Auto-response generation
5. **PAI Assistant**: Query processing and database search
6. **PAI Mortgage**: Mortgage qualification and guidance
7. Response → WhatsApp via correct Evolution instance
8. Real-time updates via Socket.io

### Triple Instance Benefits:
- **Separation of Concerns**: Auto-responses vs queries vs mortgage services
- **Specialized Prompts**: Different personalities per function
- **Reduced Conflicts**: No confusion between response types
- **Scalability**: Independent scaling per function
- **Service Specialization**: Dedicated mortgage expertise without cluttering other assistants

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

# Check instance status (PAI Mortgage)
curl http://localhost:8080/instance/connectionState/pai-mortgage

# Test webhook routing
curl -X POST http://localhost:3000/webhook -d '{"test": "responder"}'
curl -X POST http://localhost:3000/webhook/pai-assistant -d '{"test": "assistant"}'
curl -X POST http://localhost:3000/webhook/pai-mortgage -d '{"test": "mortgage"}'

# Reset PAI Mortgage instance (if QR code limit reached)
node scripts/reset-instance.js pai-mortgage
```

## Deployment

### Docker Compose:
- **Full Stack**: Complete system in containers
- **Evolution Only**: Just Evolution API + databases
- **Health Checks**: Automatic service monitoring
- **Volume Persistence**: Data survives container restarts

### Production Checklist:
- [ ] Environment variables configured for all three instances
- [ ] Database migrations run
- [ ] All Evolution API instances created (aipbx, pai-assistant, pai-mortgage)
- [ ] Webhook URLs configured correctly for all instances
- [ ] All three WhatsApp devices connected
- [ ] Assistant settings configured for all assistants
- [ ] QR code access secured
- [ ] Monitoring and logging enabled
- [ ] PAI Mortgage instance reset script available
- [ ] OpenAI API key properly configured for all services

## Recent Updates (September 2025)

- ✅ **PAI Mortgage Assistant Launch** (September 17, 2025): Fully operational mortgage qualification assistant
- ✅ **OpenAI API Integration Fixes**: Resolved environment variable override issues
- ✅ **Evolution API Authentication Fix**: Fixed webhook configuration and API key mismatches
- ✅ **Triple Assistant Architecture**: PAI Responder + PAI Assistant + PAI Mortgage
- ✅ **Instance Reset Capabilities**: Automated QR code limit recovery with `reset-instance.js`
- ✅ **Enhanced Webhook Routing**: Multi-instance message processing pipeline
- ✅ **Bilingual Support**: English/Spanish automatic language detection for PAI Mortgage
- ✅ **Comprehensive Logging**: Detailed debugging and error tracking across all services
- ✅ **Multi-Instance Evolution Service**: Manages three WhatsApp connections
- ✅ **Repository Reorganization**: Clean folder structure with proper separation
- ✅ **Comprehensive Documentation**: JSDoc comments on all service files
- ✅ **Docker Infrastructure**: Full containerization with health checks
- ✅ **Server-Side QR Pages**: JavaScript-free QR code display for all instances
- ✅ **Management Scripts**: Easy deployment and monitoring
- ✅ **Advanced Message Processing**: Intent parsing and query handling
- ✅ **Database Service Layer**: Optimized message retrieval and search

## Troubleshooting

### Common Commands for Debugging:
```bash
# Check Evolution API status (all instances)
curl http://localhost:8080/instance/connectionState/aipbx
curl http://localhost:8080/instance/connectionState/pai-assistant
curl http://localhost:8080/instance/connectionState/pai-mortgage

# Test webhook endpoints
curl http://localhost:3000/api/whatsapp/status
curl http://localhost:3000/webhook/pai-mortgage

# Check assistant configurations
curl http://localhost:3000/api/assistant/config

# Reset PAI Mortgage instance if needed
node scripts/reset-instance.js pai-mortgage

# Monitor logs by service
docker-compose logs evolution-api
docker-compose logs ai-pbx-backend

# View real-time message processing
tail -f logs/combined.log | grep "Message processing"
tail -f logs/combined.log | grep "PAI Mortgage"

# Test PAI Mortgage webhook
curl -X POST http://localhost:3000/webhook/pai-mortgage \
  -H "Content-Type: application/json" \
  -d '{"key":{"id":"test","remoteJid":"test@s.whatsapp.net","fromMe":false},"message":{"conversation":"Test mortgage query"},"pushName":"Test User"}'
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

This guide provides comprehensive context for any Claude session to understand and work effectively with the triple assistant PAI System, including the newly operational PAI Mortgage assistant with all recent fixes and improvements.