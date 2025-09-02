# AI PBX WhatsApp Assistant - Development Plan

## Phase 1: Project Foundation & Setup (Days 1-2)

### Step 1.1: Initialize Project
- Create `package.json` with dependencies (Express, Sequelize/Prisma, Jest, dotenv)
- Set up `.env.example` and development environment
- Configure ESLint, Prettier, and Git hooks
- **Test**: `npm install` runs without errors

### Step 1.2: Testing Infrastructure
- Configure Jest with coverage reporting
- Set up test database configuration
- Create test utilities and mock helpers
- **Test**: `npm test` runs empty test suite

### Step 1.3: Basic Express Server
- Create `src/app.js` with Express setup
- Add health check endpoint (`/health`)
- Set up middleware (CORS, JSON parsing, error handling)
- **Test**: Server starts, health endpoint returns 200

## Phase 2: Database & Models (Days 2-3)

### Step 2.1: Database Schema Design
- Create Sequelize/Prisma models:
  - `Assistant` (id, enabled, created_at)
  - `Contact` (id, phone, name, last_seen)
  - `Conversation` (id, contact_id, status, priority, summary)
  - `Message` (id, conversation_id, content, sender, timestamp, message_type)
- **Test**: Migration runs successfully, models validate

### Step 2.2: Model Unit Tests
- Test model validations and relationships
- Test CRUD operations for each model
- Mock database queries
- **Test**: All model tests pass (>90% coverage)

## Phase 3: Evolution API Integration (Days 3-4)

### Step 3.1: WhatsApp Service Layer
- Create `src/services/whatsapp.js`
- Implement Evolution API client:
  - `sendMessage(instanceId, phone, message)`
  - `setWebhook(instanceId, webhookUrl)`
  - Error handling and retry logic
- **Test**: Mock API calls, test error scenarios

### Step 3.2: Webhook Controller
- Create `src/controllers/webhook.js`
- Handle incoming message events
- Validate webhook signatures
- Parse message data structure
- **Test**: Process various message types, handle malformed data

## Phase 4: Assistant Core Logic (Days 4-6)

### Step 4.1: Assistant Service
- Create `src/services/assistant.js`
- Implement toggle on/off functionality
- Auto-response generation
- State management (enabled/disabled)
- **Test**: Toggle states, response generation

### Step 4.2: Message Filtering Service
- Create `src/services/filters.js`
- Categorize messages by type (urgent, business, personal, spam)
- Priority scoring algorithm
- Keyword-based filtering
- **Test**: Various message scenarios, priority accuracy

### Step 4.3: AI Integration (OpenAI)
- Create `src/services/ai.js`
- Message understanding and classification
- Response generation
- Summary creation
- **Test**: Mock AI responses, handle API failures

## Phase 5: Conversation Management (Days 6-7)

### Step 5.1: Conversation Service
- Create `src/services/conversation.js`
- Track conversation state and history
- Handle multi-message interactions
- Context management
- **Test**: Conversation lifecycle, context preservation

### Step 5.2: Contact Management
- Create `src/services/contact.js`
- Contact information storage and retrieval
- Interaction history tracking
- Contact categorization
- **Test**: Contact CRUD operations, history tracking

## Phase 6: Summary & Reporting (Days 7-8)

### Step 6.1: Summary Service
- Create `src/services/summary.js`
- Generate periodic summaries
- Aggregate conversation data
- Export functionality (JSON, CSV)
- **Test**: Summary accuracy, export formats

### Step 6.2: Admin API Endpoints
- Create REST API for admin functions:
  - `POST /api/assistant/toggle`
  - `GET /api/conversations`
  - `GET /api/summary/:period`
  - `POST /api/settings`
- **Test**: All endpoints, authentication, validation

## Phase 7: Admin Dashboard (Days 8-9)

### Step 7.1: Admin Frontend
- Create basic HTML/CSS/JS dashboard in `admin/`
- Toggle assistant on/off
- View conversation summaries
- Display statistics
- **Test**: UI functionality, API integration

### Step 7.2: Dashboard Features
- Real-time status updates (WebSocket/SSE)
- Message filtering controls
- Export functionality
- Settings management
- **Test**: Real-time updates, export downloads

## Phase 8: Integration & E2E Testing (Days 9-10)

### Step 8.1: Integration Tests
- End-to-end webhook to response flow
- Database integration testing
- Evolution API integration testing
- **Test**: Complete message processing pipeline

### Step 8.2: Error Handling & Resilience
- Comprehensive error handling
- Retry mechanisms for API calls
- Graceful degradation when services fail
- Logging and monitoring
- **Test**: Service failure scenarios, recovery

## Phase 9: Deployment & Production (Days 10-11)

### Step 9.1: Docker Configuration
- Create `Dockerfile` and `docker-compose.yml`
- Environment-specific configurations
- Database setup scripts
- **Test**: Clean deployment, service connectivity

### Step 9.2: Security & Performance
- Input sanitization and validation
- Rate limiting
- Environment variable security
- Basic performance optimizations
- **Test**: Security audit, load testing

## Testing Strategy Throughout

### Unit Tests (Each Step)
- Individual function/method testing
- Mock external dependencies
- Edge case coverage
- Target: >90% code coverage

### Integration Tests (Major Features)
- Service interaction testing
- Database integration
- API endpoint testing
- Error scenario testing

### End-to-End Tests (Final Phase)
- Complete user workflows
- Production-like environment
- Performance benchmarks
- Security validation

## Development Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- services/assistant.test.js

# Start development server
npm run dev

# Run linter
npm run lint

# Check types (if using TypeScript)
npm run type-check
```

## Success Criteria

Each phase must meet:
- All unit tests passing
- Code coverage >90%
- No ESLint errors
- Integration tests passing
- Documentation updated