# AI PBX Codebase File Glossary

This document provides a comprehensive glossary of all files in the AI PBX codebase, organized by which project or component they belong to.

## Table of Contents
- [PAI Responder Files](#pai-responder-files)
- [PAI Assistant Files](#pai-assistant-files)
- [PAI Mortgage Files](#pai-mortgage-files)
- [Mortgage Agent Files](#mortgage-agent-files)
- [Shared/Common Files](#sharedcommon-files)
- [Frontend (React UI) Files](#frontend-react-ui-files)
- [Infrastructure Files](#infrastructure-files)
- [Database Files](#database-files)
- [Testing Files](#testing-files)
- [Documentation Files](#documentation-files)
- [Archive/Legacy Files](#archivelegacy-files)

---

## PAI Responder Files
*Main WhatsApp auto-response assistant*

### Core Service Files
- `src/assistants/pai-responder/service.js` - PAI Responder main service implementation
- `src/services/ai/paiResponderAdapter.js` - Adapter for PAI Responder AI logic
- `prompts/pai_responder.md` - PAI Responder personality and prompt configuration

### Route Files
- `src/routes/qr-responder/index.js` - QR code page for PAI Responder WhatsApp connection

### Test Files
- `scripts/test-pai-responder.js` - PAI Responder testing script

---

## PAI Assistant Files
*Query and search assistant for message history*

### Core Service Files
- `src/assistants/pai-assistant/service.js` - PAI Assistant main service implementation
- `src/assistants/pai-assistant-simplified.js` - Simplified PAI Assistant implementation
- `src/services/ai/paiAssistantAdapter.js` - Adapter for PAI Assistant AI logic
- `src/services/ai/paiAssistantWhatsApp.js` - PAI Assistant WhatsApp integration
- `src/controllers/paiAssistantController.js` - PAI Assistant controller endpoints
- `prompts/pai_assistant.md` - PAI Assistant personality and prompt configuration

### Route Files
- `src/routes/qr-assistant/index.js` - QR code page for PAI Assistant WhatsApp connection

### CLI & Scripts
- `pai-assistant-cli.js` - Command-line interface for PAI Assistant
- `scripts/test-pai-assistant.js` - PAI Assistant testing script
- `scripts/test-simplified-pai.js` - Test script for simplified PAI Assistant

### Database Models
- `src/models/PaiAssistant.js` - PAI Assistant database model

---

## PAI Mortgage Files
*Mortgage qualification specialist assistant*

### Core Service Files
- `src/assistants/pai-mortgage/service.js` - PAI Mortgage main service implementation
- `src/services/ai/paiMortgageAdapter.js` - Adapter for PAI Mortgage AI logic
- `src/services/ai/paiMortgageWhatsApp.js` - PAI Mortgage WhatsApp integration
- `src/controllers/paiMortgageController.js` - PAI Mortgage controller endpoints
- `prompts/pai_mortgage.md` - PAI Mortgage personality and prompt configuration

### Route Files
- `src/routes/qr-mortgage/index.js` - QR code page for PAI Mortgage WhatsApp connection

### Management Scripts
- `scripts/pai-mortgage-manager.sh` - Interactive PAI Mortgage system manager
- `scripts/start-pai-mortgage-system.sh` - Start PAI Mortgage system
- `scripts/stop-pai-mortgage-system.sh` - Stop PAI Mortgage system
- `scripts/restart-pai-mortgage-system.sh` - Restart PAI Mortgage system
- `scripts/initialize-pai-mortgage.js` - Initialize PAI Mortgage configuration

### Database Models & Migrations
- `src/models/PaiMortgage.js` - PAI Mortgage database model
- `database/migrations/20250915002854-create-pai-mortgages.js` - Create PAI Mortgage tables
- `database/migrations/20250917162834-add-pai-mortgage-foreign-key-to-messages.js` - Add PAI Mortgage foreign key

### Test Files
- `tests/services/paiMortgage.test.js` - PAI Mortgage service tests

### Documentation
- `docs/PAI_MORTGAGE_MANAGER.md` - PAI Mortgage manager documentation

---

## Mortgage Agent Files
*Standalone Python-based mortgage agent system (separate project)*

### Core Python Files
- `mortgage-agent/run.py` - Main entry point for mortgage agent
- `mortgage-agent/src/__init__.py` - Package initialization
- `mortgage-agent/src/api.py` - API endpoints
- `mortgage-agent/src/graph.py` - Graph/workflow logic
- `mortgage-agent/src/nodes.py` - Processing nodes
- `mortgage-agent/src/nodes_corrupted.py` - Corrupted nodes backup
- `mortgage-agent/src/router.py` - Request routing
- `mortgage-agent/src/rules_engine.py` - Business rules engine
- `mortgage-agent/src/state.py` - State management
- `mortgage-agent/src/letter_generator.py` - Letter generation logic
- `mortgage-agent/src/email_sender.py` - Email sending functionality

### Setup & Configuration
- `mortgage-agent/setup_gmail.py` - Gmail setup script
- `mortgage-agent/test_email.py` - Email testing script
- `mortgage-agent/requirements.txt` - Python dependencies
- `mortgage-agent/requirements_gmail.txt` - Gmail-specific dependencies

### Tests
- `mortgage-agent/tests/__init__.py` - Test package initialization
- `mortgage-agent/tests/test_clarification.py` - Clarification tests
- `mortgage-agent/tests/test_happy_path.py` - Happy path tests
- `mortgage-agent/tests/test_rules.py` - Rules engine tests

### Documentation
- `mortgage-agent/README.md` - Mortgage agent readme
- `mortgage-agent/PROJECT_SUMMARY.md` - Project summary
- `mortgage-agent/docs/guidelines.md` - Development guidelines
- `mortgage-agent/docs/master_prompt.md` - Master prompt configuration
- `mortgage-agent/docs/questionnaire.md` - Questionnaire documentation
- `mortgage-agent/docs/PREQUALIFICATION_LETTERS.md` - Prequalification letter templates

### Frontend
- `mortgage-agent/static/index.html` - Mortgage agent web interface

---

## Shared/Common Files
*Files used by multiple projects*

### Core Application
- `src/app.js` - Main application entry point
- `src/config/index.js` - Main configuration file
- `src/config/database.js` - Database configuration

### WhatsApp Services (Used by all assistants)
- `src/services/whatsapp/whatsapp.js` - Core WhatsApp service
- `src/services/whatsapp/evolutionMultiInstance.js` - Multi-instance WhatsApp management
- `src/services/whatsapp/messageProcessor.js` - Message processing pipeline

### AI Services (Shared)
- `src/services/ai.js` - Legacy AI service
- `src/services/ai/assistantAI.js` - Core AI assistant logic
- `src/services/ai/openai.js` - OpenAI integration
- `src/services/ai/whatsapp-assistant.js` - WhatsApp AI assistant base

### Controllers (Shared)
- `src/controllers/webhook.js` - Main webhook controller
- `src/controllers/webhookMultiInstance.js` - Multi-instance webhook routing
- `src/controllers/systemController.js` - System control endpoints
- `src/controllers/assistant.js` - Assistant configuration controller
- `src/controllers/chat.js` - Chat management controller

### Services (Shared)
- `src/services/assistant.js` - Assistant service base
- `src/services/assistantMessageHandler.js` - Message handling logic
- `src/services/startup/systemInitializer.js` - System initialization
- `src/services/utils/conversation.js` - Conversation management
- `src/services/utils/filters.js` - Message filtering
- `src/services/utils/groupService.js` - WhatsApp group handling
- `src/services/utils/realtime.js` - Socket.io real-time service

### Database Services (Shared)
- `src/services/database/messageRetrieval.js` - Message retrieval logic
- `src/services/database/messageSearch.js` - Message search functionality
- `src/services/database/queryBuilder.js` - SQL query builder
- `src/services/database/searchParameterParser.js` - Search parameter parsing

### Routes (Shared)
- `src/routes/api.js` - Main API routes
- `src/routes/webhook.js` - Webhook routes
- `src/routes/chat.js` - Chat routes
- `src/routes/logs.js` - Log viewing routes
- `src/routes/qr-page.js` - QR code page route

### Models (Shared)
- `src/models/index.js` - Model exports
- `src/models/Assistant.js` - Assistant model
- `src/models/Contact.js` - Contact model
- `src/models/Conversation.js` - Conversation model
- `src/models/Message.js` - Message model
- `src/models/GroupMetadata.js` - Group metadata model
- `src/models/SummaryHistory.js` - Summary history model
- `src/models/PaiResponder.js` - PAI Responder model

### Shared Assistant Files
- `src/assistants/shared/base-assistant.js` - Base assistant class
- `src/assistants/shared/types.js` - Shared type definitions

### Utilities
- `src/utils/logger.js` - Logging utility
- `src/utils/schemas.js` - Validation schemas
- `src/middleware/errorHandler.js` - Error handling middleware
- `src/middleware/validation.js` - Request validation middleware

---

## Frontend (React UI) Files

### Main Application
- `client/src/App.tsx` - Main React application component
- `client/src/main.tsx` - React entry point
- `client/src/types/index.ts` - TypeScript type definitions
- `client/src/utils/index.ts` - Utility functions

### Components
- `client/src/components/AssistantSettings.tsx` - Assistant settings modal
- `client/src/components/ConversationList.tsx` - Conversation list component
- `client/src/components/MessageView.tsx` - Message view component
- `client/src/components/MessageInput.tsx` - Message input component
- `client/src/components/WhatsAppConnection.tsx` - WhatsApp connection status
- `client/src/components/SettingsIcon.tsx` - Settings icon component

### Services
- `client/src/services/api.ts` - API client service
- `client/src/services/socket.ts` - Socket.io client

### Tests
- `client/src/test/setup.ts` - Test setup
- `client/src/components/__tests__/App.integration.test.tsx` - App integration tests
- `client/src/components/__tests__/AssistantSettings.test.tsx` - Assistant settings tests
- `client/src/components/__tests__/ConversationList.test.tsx` - Conversation list tests
- `client/src/components/__tests__/SettingsIcon.test.tsx` - Settings icon tests

### Configuration
- `client/package.json` - Frontend dependencies
- `client/tsconfig.json` - TypeScript configuration
- `client/vite.config.ts` - Vite configuration
- `client/vitest.config.ts` - Vitest configuration
- `client/tailwind.config.js` - Tailwind CSS configuration
- `client/postcss.config.js` - PostCSS configuration

---

## Infrastructure Files

### Docker
- `docker/evolution/docker-compose.yml` - Evolution API Docker setup
- `docker/evolution/start.sh` - Start Evolution services
- `docker/evolution/stop.sh` - Stop Evolution services
- `docker/full-stack/docker-compose.yml` - Full stack Docker setup
- `docker/full-stack/start.sh` - Start full stack
- `docker/full-stack/nginx.conf` - Nginx configuration
- `docker/full-stack/Dockerfile.backend` - Backend Docker image
- `docker/full-stack/Dockerfile.frontend` - Frontend Docker image

### Scripts
- `scripts/check-dependencies.sh` - Check system dependencies
- `scripts/connect-whatsapp.sh` - WhatsApp connection script
- `scripts/configure-pai.js` - Configure PAI system
- `scripts/reset-instance.js` - Reset WhatsApp instance
- `scripts/service-monitor.sh` - Monitor service status
- `scripts/setup-database.sh` - Database setup
- `scripts/setup-evolution.sh` - Evolution API setup
- `scripts/setup-whatsapp-connection.sh` - WhatsApp connection setup
- `scripts/fix-group-names.js` - Fix group name issues
- `scripts/start-e2e-test.sh` - Start E2E tests
- `scripts/stop-e2e-test.sh` - Stop E2E tests
- `scripts/start-manual.sh` - Manual start script
- `scripts/test-with-webhook.sh` - Test webhook functionality
- `scripts/test-phone-connection.js` - Test phone connection
- `scripts/test-assistant-direct.js` - Direct assistant test
- `launch-pai.sh` - Main launch script

### Configuration Files
- `package.json` - Main Node.js dependencies
- `.env.example` - Environment variables example
- `.eslintrc.js` - ESLint configuration
- `.claude/settings.local.json` - Claude Code settings
- `.claude/agents/docs-maintainer.md` - Documentation maintenance agent
- `.claude/agents/repo-maintenance-scanner.md` - Repository maintenance agent

---

## Database Files

### Migrations
- `database/migrations/20250828203741-create-initial-tables.js` - Initial database schema
- `database/migrations/20250831220325-add-assistant-config-fields.js` - Assistant config fields
- `database/migrations/20250901182539-add-message-type-preferences-to-assistants.js` - Message preferences
- `database/migrations/20250901203919-add-is-group-to-contacts.js` - Group contact flag
- `database/migrations/20250902013919-create-group-metadata.js` - Group metadata table
- `database/migrations/20250902170215-add-summary-tracking.js` - Summary tracking
- `database/migrations/20250902172521-create-assistant-contact.js` - Assistant contact junction
- `database/migrations/20250904191430-create-pai-assistants-separation.js` - PAI assistants separation
- `database/migrations/20250904191839-create-pai-assistants-separation-fixed.js` - Fixed separation

### Seeds
- `database/seeds/20250828204525-create-default-assistant.js` - Default assistant seed

---

## Testing Files

### Unit Tests
- `tests/app.test.js` - Application tests
- `tests/models.test.js` - Model tests
- `tests/setup.test.js` - Setup tests
- `tests/frontend-qr-fix.test.js` - Frontend QR fix tests
- `tests/message-sync-fix.test.js` - Message sync fix tests

### Controller Tests
- `tests/controllers/webhook.test.js` - Webhook controller tests
- `tests/controllers/webhookMultiInstance.test.js` - Multi-instance webhook tests

### Service Tests
- `tests/services/ai.test.js` - AI service tests
- `tests/services/assistant.test.js` - Assistant service tests
- `tests/services/conversation.test.js` - Conversation service tests
- `tests/services/filters.test.js` - Filter service tests
- `tests/services/messageProcessor.test.js` - Message processor tests
- `tests/services/whatsapp.test.js` - WhatsApp service tests

### Integration Tests
- `tests/integration/evolutionMultiInstance.test.js` - Multi-instance integration tests

### Route Tests
- `tests/routes/api.test.js` - API route tests

---

## Documentation Files

### Main Documentation
- `README.md` - Main project readme
- `CLAUDE.md` - Claude AI assistant guide
- `CHANGELOG.md` - Project changelog
- `QUICK_START.md` - Quick start guide

### Docs Directory
- `docs/README.md` - Documentation overview
- `docs/WHATSAPP_CONNECTION_GUIDE.md` - WhatsApp connection guide
- `docs/PAI_MORTGAGE_MANAGER.md` - PAI Mortgage manager documentation

### Legacy Documentation
- `docs/legacy/README.md` - Legacy documentation index
- `docs/legacy/LAUNCH_SYSTEM.md` - Legacy launch system
- `docs/legacy/PAI_MORTGAGE_FIX_RECOVERY.md` - PAI Mortgage fix documentation

---

## Archive/Legacy Files

### Obsolete Scripts
- `archive/obsolete-scripts/chat.js` - Old chat script
- `archive/obsolete-scripts/setup-pai-assistant-line.js` - Old PAI Assistant setup
- `archive/obsolete-scripts/show-pai-assistant-qr.js` - Old QR display script
- `archive/obsolete-scripts/test-both-assistants.js` - Old dual assistant test
- `archive/obsolete-scripts/test-fixes.js` - Old fix tests
- `archive/obsolete-scripts/test-pai-assistant-whatsapp.js` - Old PAI Assistant test

### Legacy Code
- `archive/legacy-code/demo-pai-cli.js` - Demo PAI CLI
- `archive/legacy-code/pai-cli.js` - Legacy PAI CLI
- `archive/legacy-code/quick-whatsapp.js` - Quick WhatsApp script
- `archive/legacy-code/simple-whatsapp.py` - Simple WhatsApp Python script
- `archive/legacy-code/start-evolution.sh` - Old Evolution start script
- `archive/legacy-code/summaryService-deprecated.js` - Deprecated summary service
- `archive/legacy-code/test-config.json` - Test configuration
- `archive/legacy-code/test-cooldown-issue.js` - Cooldown issue test
- `archive/legacy-code/test-diagnosis.js` - Diagnosis test
- `archive/legacy-code/test-message.json` - Test message data
- `archive/legacy-code/test-openai.js` - OpenAI test
- `archive/legacy-code/whatsapp-simple.js` - Simple WhatsApp script
- `archive/legacy-code/run-migration.js` - Migration runner
- `archive/legacy-code/show-qr-code.js` - QR code display
- `archive/legacy-code/README.md` - Legacy code readme

### Old Documentation
- `archive/old-docs/AI_PBX_CHAT_UI.md` - Old chat UI docs
- `archive/old-docs/AI_PBX_COMPLETE_SETUP_GUIDE.md` - Old setup guide
- `archive/old-docs/CREDENTIALS_CHECKLIST.md` - Credentials checklist
- `archive/old-docs/DEVELOPMENT_PLAN.md` - Development plan
- `archive/old-docs/E2E_TESTING_GUIDE.md` - E2E testing guide
- `archive/old-docs/EVOLUTION_API_ACCESS.md` - Evolution API access
- `archive/old-docs/FINAL_SOLUTION.md` - Final solution docs
- `archive/old-docs/README.md` - Old docs readme
- `archive/old-docs/SIMPLE_TEST_GUIDE.md` - Simple test guide
- `archive/old-docs/STORAGE_EXPLANATION.md` - Storage explanation
- `archive/old-docs/WHATSAPP_CONNECTION_SOLUTIONS.md` - Connection solutions

### Test Scripts Archive
- `archive/test-scripts/test-cli-quick.js` - Quick CLI test
- `archive/test-scripts/test-conversation-context.js` - Conversation context test
- `archive/test-scripts/test-conversation-fixes.js` - Conversation fixes test
- `archive/test-scripts/test-direct-message.js` - Direct message test
- `archive/test-scripts/test-e2e-complete.js` - Complete E2E test
- `archive/test-scripts/test-enhanced-conversation-flow.js` - Enhanced conversation test
- `archive/test-scripts/test-prompt-based-pai.js` - Prompt-based PAI test
- `archive/test-scripts/test-realistic-conversations.js` - Realistic conversation test
- `archive/test-scripts/test-simplified-pai.js` - Simplified PAI test
- `archive/test-scripts/test-ultra-simple-assistant.js` - Ultra simple assistant test
- `archive/test-scripts/test-whatsapp-connection.js` - WhatsApp connection test

---

## Summary

This codebase consists of four main projects:

1. **PAI Responder** - Auto-response WhatsApp assistant
2. **PAI Assistant** - Query and search assistant for message history  
3. **PAI Mortgage** - Specialized mortgage qualification assistant
4. **Mortgage Agent** - Standalone Python-based mortgage agent (separate project)

The majority of files are shared infrastructure supporting the triple PAI assistant system (Responder, Assistant, Mortgage), with the Mortgage Agent being a completely separate Python project in the `mortgage-agent/` directory.

Key architectural patterns:
- Multi-instance WhatsApp management via Evolution API
- Shared AI services with adapter pattern for each assistant
- React frontend for unified chat interface
- PostgreSQL database for message storage
- Docker containerization for deployment
- Comprehensive testing and documentation