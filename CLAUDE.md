# AI PBX - Claude Assistant Guide

This document provides comprehensive information for Claude AI sessions to understand and work with the AI PBX system.

## System Overview

AI PBX is a WhatsApp personal assistant that integrates with Evolution API to provide intelligent message filtering, automated responses, and conversation management with a modern React chat interface.

### Architecture
```
WhatsApp ↔ Evolution API ↔ AI PBX Backend ↔ React Frontend
                               ↓
                          PostgreSQL Database
                               ↓
                          OpenAI GPT Integration
```

## Current Status (September 2025)

✅ **Fully Operational System:**
- WhatsApp integration via Evolution API v2.0.9
- Real-time chat interface with Socket.io
- Assistant configuration management
- Message filtering and AI responses
- Connection status monitoring

## Project Structure

```
ai_pbx/
├── src/                    # Backend (Node.js/Express)
│   ├── app.js             # Main application entry
│   ├── controllers/       # API endpoints
│   │   ├── webhook.js     # WhatsApp webhook handler
│   │   ├── chat.js        # Chat management
│   │   └── assistant.js   # Assistant configuration
│   ├── services/          # Business logic
│   │   ├── whatsapp.js    # Evolution API integration
│   │   ├── assistant.js   # AI message processing
│   │   ├── ai.js          # OpenAI integration
│   │   └── chat.js        # Chat management
│   ├── models/            # Sequelize database models
│   │   ├── Assistant.js   # Assistant configuration
│   │   ├── Contact.js     # Contact management
│   │   ├── Conversation.js# Conversation tracking
│   │   └── Message.js     # Message storage
│   ├── routes/            # Express routing
│   │   ├── api.js         # Main API routes
│   │   └── webhook.js     # Webhook routes
│   └── utils/             # Helper functions
├── client/                # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── ConversationList.tsx
│   │   │   ├── MessageView.tsx
│   │   │   ├── AssistantSettings.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── services/      # API clients
│   │   │   ├── api.ts     # HTTP API calls
│   │   │   └── socket.ts  # Socket.io client
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Frontend utilities
├── database/              # Database migrations
├── tests/                 # Test suites
├── docs/                  # Current documentation
│   └── archive/          # Old documentation
├── legacy/               # Old test files and utilities
└── scripts/              # Utility scripts
```

## Key Components

### Backend Services

**WhatsApp Service** (`src/services/whatsapp.js`):
- Evolution API integration
- Message sending/receiving
- Connection status monitoring
- Webhook message parsing

**Assistant Service** (`src/services/assistant.js`):
- AI-powered message processing
- Configuration management
- 30-minute cooldown system for follow-up messages
- Response filtering and categorization

**WhatsApp Assistant Service** (`src/services/whatsapp-assistant.js`):
- GPT-powered message processing with OpenAI
- Per-contact conversation history management
- Personalized system prompts with assistant/owner names
- Context-aware responses using conversation threads

**Chat Service** (`src/services/chat.js`):
- Conversation management
- Message persistence
- Real-time updates via Socket.io

### Frontend Components

**App.tsx**: Main application component with:
- WebSocket connection management
- WhatsApp connection status monitoring (every 5s polling)
- Global assistant settings modal

**ConversationList.tsx**: 
- Lists all conversations
- Global settings gear icon (always visible)
- Assistant toggle per conversation

**MessageView.tsx**:
- Individual chat interface
- Message rendering with media support
- Real-time message updates

**AssistantSettings.tsx**:
- Configuration modal for:
  - Assistant name
  - Greeting message template
  - System prompt
  - Owner name

## Database Schema

### Key Models:
- **Assistant**: Configuration and settings
- **Contact**: WhatsApp contact information
- **Conversation**: Chat threads with contacts
- **Message**: Individual messages with metadata

### Important Fields:
- `Assistant.systemPrompt`: AI behavior instructions
- `Assistant.autoResponseTemplate`: Greeting message
- `Conversation.isAssistantEnabled`: Per-conversation toggle
- `Message.sender`: 'user', 'assistant', or 'system'

## API Endpoints

### Main Routes (`/api/`):
- `GET /chat` - List conversations
- `GET /chat/:id/messages` - Get conversation messages
- `POST /chat/:id/messages` - Send message
- `GET /assistant/config` - Get assistant settings
- `PUT /assistant/config` - Update assistant settings
- `GET /whatsapp/status` - Check WhatsApp connection

### Webhook Routes (`/webhook/`):
- `POST /` - Receive WhatsApp messages
- `GET /status` - Webhook health check

## Environment Configuration

### Required Environment Variables:
```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your_api_key
EVOLUTION_INSTANCE_ID=your_instance

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_pbx

# OpenAI
OPENAI_API_KEY=your_openai_key

# Server
PORT=3000
WEBHOOK_URL=http://localhost:3000/webhook
```

## Common Development Tasks

### Start Development Servers:
```bash
# Backend (port 3000)
npm start

# Frontend (port 5173)
cd client && npm run dev
```

### Database Operations:
```bash
# Run migrations
npx sequelize-cli db:migrate

# Create new migration
npx sequelize-cli migration:generate --name migration-name
```

### Testing:
- Unit tests: Located in `/tests/`
- Integration tests: Test with actual Evolution API
- Frontend tests: Jest + Testing Library

## Evolution API Integration

### Version: v2.0.9 (Docker)
- **Container**: `atendai/evolution-api:v2.0.9`
- **Port**: 8080
- **Instance Management**: Via REST API
- **Webhook**: Handles incoming WhatsApp messages

### Key Evolution API Endpoints:
- `GET /instance/connectionState/{instanceId}` - Check connection
- `POST /message/sendText/{instanceId}` - Send message
- `POST /webhook/set/{instanceId}` - Configure webhook
- `GET /instance/qrcode/{instanceId}` - Get QR code

## Known Issues & Solutions

### Issue: Assistant Not Responding
**Cause**: 30-minute cooldown system in `assistant.js`
**Solution**: Check message timing and cooldown logic

### Issue: WebSocket Connection vs WhatsApp Status
**Cause**: Frontend was showing WebSocket status, not actual WhatsApp connection
**Solution**: Implemented separate polling of `/api/whatsapp/status`

### Issue: Settings Gear Icon Not Always Visible
**Cause**: Icon was in MessageView (only shown when chat selected)
**Solution**: Moved to ConversationList header (always visible)

## Development Notes

### Message Processing Flow:
1. WhatsApp → Evolution API → Webhook
2. Webhook parses message → messageProcessor.js
3. Assistant service checks if enabled
4. **WhatsApp Assistant** (`whatsapp-assistant.js`) → GPT processing with conversation history
5. AI-generated response → WhatsApp via Evolution API
6. Real-time updates via Socket.io

### Frontend State Management:
- React hooks for local state
- Socket.io for real-time updates
- Polling for WhatsApp connection status
- Context sharing between components

### Security Considerations:
- No message content permanently stored
- API key protection
- Webhook signature validation (Evolution API doesn't sign)
- Environment variable management

## CLI Tools

### Chat Tool (`chat.js`)
Interactive command-line interface for PAI assistant:

```bash
# Start chat session
node chat.js

# Features:
# - Same GPT model and personality as WhatsApp assistant
# - Uses prompts/pai_responder.md system prompt
# - Maintains conversation history during session
# - Proper environment variable loading
# - Signal handling (Ctrl+C to exit)
```

### Archived CLI Tools
The following tools have been moved to `archive/legacy-code/`:
- `pai-cli.js` - Alternative CLI with API polling (deprecated)
- `demo-pai-cli.js` - Demo CLI implementation
- `show-qr-code.js` - QR code display utility

## Quick Commands

```bash
# Check logs
tail -f logs/combined.log

# Restart Evolution API
docker-compose restart evolution-api

# Check database connection
npm run db:test

# Build for production
npm run build && cd client && npm run build

# Reset assistant stats
curl -X POST http://localhost:3000/api/assistant/reset-stats
```

## Deployment

### Docker Compose:
Main `docker-compose.yml` includes:
- Evolution API v2.0.9
- PostgreSQL database
- Volume mounts for persistence

### Production Checklist:
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Evolution API instance created
- [ ] Webhook URL configured
- [ ] WhatsApp device connected
- [ ] Assistant settings configured

## Recent Updates (September 2025)

- ✅ Fixed config gear icon visibility (moved to global header)
- ✅ Implemented proper WhatsApp connection status monitoring
- ✅ Made connection indicator less obtrusive
- ✅ Added real-time chat interface with Socket.io
- ✅ Implemented assistant configuration management
- ✅ Added periodic WhatsApp status polling (5-second intervals)

## Troubleshooting

### Common Commands for Debugging:
```bash
# Check Evolution API status
curl http://localhost:8080/instance/connectionState/your_instance_id

# Test WhatsApp connection endpoint
curl http://localhost:3000/api/whatsapp/status

# Check assistant configuration
curl http://localhost:3000/api/assistant/config

# Monitor real-time logs
npm run logs:watch
```

This guide should provide sufficient context for any Claude session to understand and work effectively with the AI PBX system.