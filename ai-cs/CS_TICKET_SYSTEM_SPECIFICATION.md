# CS Ticket System - Modular Development Specification

## System Overview
A WhatsApp-based customer service ticket tracking system that:
- Monitors WhatsApp groups for CS tickets using AI
- Automatically logs tickets to Google Sheets
- Sends follow-up messages for stale tickets
- Updates ticket status based on group responses

## Architecture Diagram
```
WhatsApp Groups → Evolution API → Webhook Handler → OpenAI Detection
                                                         ↓
                                                   Google Sheets
                                                         ↑
                                              Follow-up Scheduler
```

## Execution Plan for Coding Agents

### Phase 1: Parallel Development (All 4 agents work simultaneously)
**These modules can be developed independently without dependencies:**

#### Agent A: Evolution Instance & QR UI
#### Agent B: OpenAI Ticket Detection  
#### Agent C: Google Sheets Integration
#### Agent D: Follow-up Scheduler

### Phase 2: Sequential Development (After Phase 1 completes)

#### Agent E: Integration & Orchestration
**Waits for:** Agents A, B, C, D to complete
**Integrates:** All modules into working system

#### Agent F: Testing & Validation
**Waits for:** Agent E to complete
**Tests:** End-to-end functionality

---

## Module A: Evolution Instance & QR UI
**Agent: A** | **Can work: PARALLEL** | **Dependencies: None**

### Files to Create
```
ai_pbx/ai-cs/
├── modules/
│   └── evolution-setup.js
└── ui/
    └── qr-cs.html
```

### Specifications

#### `modules/evolution-setup.js`
```javascript
module.exports = {
  // Function to register CS instance with Evolution API
  async registerCSInstance(evolutionService) {
    // Returns: { success: boolean, instanceId: string, error?: string }
  },
  
  // Function to get connection status
  async getConnectionStatus(instanceId) {
    // Returns: { connected: boolean, qrCode?: string }
  },
  
  // Function to reset instance if needed
  async resetInstance(instanceId) {
    // Returns: { success: boolean }
  }
};
```

#### `ui/qr-cs.html`
- Copy template from `/src/routes/qr-responder/index.js`
- Modify:
  - Title: "CS Ticket Monitor"
  - Instance ID: "cs-ticket-monitor"
  - Features list: Ticket monitoring capabilities
  - Color scheme: Use green tones (#4caf50)

### Requirements
- Must use existing Evolution API configuration
- Instance ID: `cs-ticket-monitor`
- Webhook path: `/webhook/cs-tickets`
- Auto-refresh every 30 seconds
- Server-side rendered (no client JavaScript)

### Testing Checklist
- [ ] Instance registers successfully
- [ ] QR code displays when not connected
- [ ] Shows connected status when linked
- [ ] Page auto-refreshes
- [ ] Handles Evolution API errors gracefully

---

## Module B: OpenAI Ticket Detection
**Agent: B** | **Can work: PARALLEL** | **Dependencies: None**

### Files to Create
```
ai_pbx/ai-cs/
└── modules/
    └── ticket-detector.js
```

### Specifications

#### `modules/ticket-detector.js`
```javascript
module.exports = {
  // Main detection function
  async detectTicket(messageText, senderName) {
    // Input: WhatsApp message text and sender name
    // Returns: {
    //   isTicket: boolean,
    //   ticketData?: {
    //     customer: string,
    //     issue: string,
    //     priority: 'low' | 'medium' | 'high',
    //     category?: string
    //   }
    // }
  },
  
  // Detect status updates for existing tickets
  async detectStatusUpdate(messageText, ticketId) {
    // Returns: {
    //   isUpdate: boolean,
    //   newStatus?: 'in_progress' | 'resolved' | 'escalated',
    //   updateNotes?: string
    // }
  },
  
  // Generate follow-up message
  generateFollowUpMessage(ticket) {
    // Returns: string (WhatsApp message text)
  }
};
```

### OpenAI Prompts

#### Ticket Detection Prompt
```
You are a CS ticket detector. Analyze the message and determine if it's a customer service ticket.
Look for: complaints, issues, problems, requests for help, bug reports.

Return JSON:
{
  "isTicket": boolean,
  "customer": "extracted customer name or 'Unknown'",
  "issue": "brief description of the problem",
  "priority": "low/medium/high based on urgency",
  "category": "technical/billing/general/other"
}

Message: [MESSAGE_TEXT]
Sender: [SENDER_NAME]
```

### Requirements
- Use `gpt-4o-mini` model for cost efficiency
- Response format: JSON
- Handle multiple languages (detect and respond in same language)
- Timeout: 5 seconds max
- Fallback: Return `{isTicket: false}` on error

### Testing Checklist
- [ ] Detects obvious tickets ("I can't login to my account")
- [ ] Ignores casual conversation
- [ ] Extracts customer name correctly
- [ ] Assigns appropriate priority
- [ ] Handles non-English messages
- [ ] Returns false for non-tickets

---

## Module C: Google Sheets Integration
**Agent: C** | **Can work: PARALLEL** | **Dependencies: None**

### Files to Create
```
ai_pbx/ai-cs/
└── modules/
    └── sheets-service.js
```

### Specifications

#### `modules/sheets-service.js`
```javascript
module.exports = {
  // Initialize Google Sheets client
  async initialize(serviceAccountKey, spreadsheetId) {
    // Returns: sheets client instance
  },
  
  // Write new ticket to sheet
  async writeTicket(ticketData) {
    // Input: { customer, issue, priority, groupName, groupId, timestamp }
    // Returns: { success: boolean, ticketId: string, error?: string }
  },
  
  // Get all open tickets
  async getOpenTickets() {
    // Returns: Array of ticket objects
  },
  
  // Update ticket status
  async updateTicketStatus(ticketId, newStatus, notes) {
    // Returns: { success: boolean }
  },
  
  // Get tickets older than N hours
  async getStaleTickets(hoursOld) {
    // Returns: Array of stale tickets
  }
};
```

### Google Sheet Structure
| Column | Field | Type | Example |
|--------|-------|------|---------|
| A | Ticket ID | String | T1698765432 |
| B | Timestamp | DateTime | 2024-11-02T10:30:00Z |
| C | Group | String | Customer Support |
| D | Customer | String | John Smith |
| E | Issue | String | Cannot access account |
| F | Priority | String | high |
| G | Status | String | Open |
| H | Last Updated | DateTime | 2024-11-02T11:00:00Z |
| I | Notes | String | Awaiting response |

### Requirements
- Use Google Sheets API v4
- Service account authentication
- Batch operations where possible
- Handle rate limits (100 requests/100 seconds)
- Auto-create headers if missing

### Testing Checklist
- [ ] Connects with service account
- [ ] Writes new tickets with auto-generated ID
- [ ] Retrieves open tickets
- [ ] Updates status correctly
- [ ] Handles sheet not found error
- [ ] Manages rate limits

---

## Module D: Follow-up Scheduler
**Agent: D** | **Can work: PARALLEL** | **Dependencies: None**

### Files to Create
```
ai_pbx/ai-cs/
└── modules/
    └── follow-up-scheduler.js
```

### Specifications

#### `modules/follow-up-scheduler.js`
```javascript
module.exports = {
  // Start the scheduler
  start(config) {
    // config: { intervalMinutes, staleThresholdHours }
    // Returns: schedulerInstance
  },
  
  // Stop the scheduler
  stop(schedulerInstance) {
    // Returns: void
  },
  
  // Process stale tickets (called by scheduler)
  async processStaleTickets(sheetsService, messageSender) {
    // Gets stale tickets from sheets
    // Sends follow-up messages
    // Returns: { processed: number, errors: Array }
  },
  
  // Manual trigger for testing
  async triggerFollowUp(ticketId, messageSender) {
    // Returns: { success: boolean }
  }
};
```

### Scheduling Logic
```javascript
// Run every 30 minutes
setInterval(() => {
  // 1. Get tickets from Google Sheets
  // 2. Filter tickets > 2 hours old with status "Open"
  // 3. For each stale ticket:
  //    - Generate follow-up message
  //    - Send to WhatsApp group
  //    - Update "Last Updated" in sheet
}, 30 * 60 * 1000);
```

### Requirements
- Use `node-cron` or `setInterval`
- Default: Check every 30 minutes
- Stale threshold: 2 hours (configurable)
- Prevent duplicate follow-ups (check Last Updated)
- Graceful shutdown

### Testing Checklist
- [ ] Scheduler starts and stops correctly
- [ ] Identifies stale tickets accurately
- [ ] Sends follow-up messages
- [ ] Updates last follow-up time
- [ ] Handles errors without crashing
- [ ] Manual trigger works

---

## Module E: Integration & Orchestration
**Agent: E** | **Can work: SEQUENTIAL** | **Dependencies: A, B, C, D**

### Files to Create
```
ai_pbx/ai-cs/
├── index.js                 # Main entry point
├── webhook-handler.js       # Webhook route handler
└── config.js               # Configuration
```

### Integration Tasks

#### `index.js` - Main Orchestrator
```javascript
// 1. Load all modules
const evolutionSetup = require('./modules/evolution-setup');
const ticketDetector = require('./modules/ticket-detector');
const sheetsService = require('./modules/sheets-service');
const followUpScheduler = require('./modules/follow-up-scheduler');

// 2. Initialize services
async function initialize() {
  // Register Evolution instance
  // Initialize Google Sheets
  // Start follow-up scheduler
  // Register webhook routes
}

// 3. Export for main app integration
module.exports = { initialize, webhookHandler };
```

#### `webhook-handler.js` - Message Processing
```javascript
async function handleWebhook(req, res) {
  // 1. Extract message from webhook payload
  // 2. Check if from group (remoteJid contains '@g.us')
  // 3. Extract group name from message.pushName or group metadata
  // 4. Call ticket detector with message + group info
  // 5. If ticket: write to sheets with group name
  // 6. If status update: update sheets
  // 7. Return 200 OK
}
```

#### `config.js` - Configuration Management
```javascript
module.exports = {
  evolution: {
    instanceId: process.env.CS_INSTANCE_ID || 'cs-ticket-monitor',
    webhookPath: '/webhook/cs-tickets'
  },
  sheets: {
    spreadsheetId: process.env.CS_SHEET_ID,
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  },
  followUp: {
    intervalMinutes: 30,
    staleThresholdHours: 2
  }
};
```

### Integration Requirements
- Wire all modules together
- Handle module initialization errors
- Provide health check endpoint
- Logging for debugging
- Graceful shutdown

### Testing Checklist
- [ ] All modules initialize correctly
- [ ] Webhook receives and processes messages
- [ ] Tickets appear in Google Sheets
- [ ] Follow-ups trigger on schedule
- [ ] Status updates work
- [ ] System recovers from errors

---

## Module F: Testing & Validation
**Agent: F** | **Can work: SEQUENTIAL** | **Dependencies: E**

### Files to Create
```
ai_pbx/ai-cs/
└── tests/
    ├── test-end-to-end.js
    ├── test-ticket-detection.js
    ├── test-sheets.js
    └── test-scenarios.md
```

### Test Scenarios

#### Scenario 1: New Ticket Creation
1. Send message to group: "Help! I can't access my account #12345"
2. Verify ticket appears in Google Sheets with correct group name
3. Check ticket ID generated
4. Confirm priority assigned
5. Ensure group name is captured accurately

#### Scenario 2: Follow-up Trigger
1. Create ticket manually in sheet (3 hours old)
2. Wait for scheduler or trigger manually
3. Verify follow-up message sent to group
4. Check "Last Updated" field updated

#### Scenario 3: Status Update
1. Create open ticket
2. Send message: "Ticket T123 is resolved"
3. Verify status changes to "resolved" in sheet
4. Confirm no follow-ups sent for resolved tickets

#### Scenario 4: Non-Ticket Messages
1. Send casual messages to group
2. Verify no tickets created
3. Confirm system ignores non-tickets

### Testing Requirements
- Use real WhatsApp test group
- Test Google Sheets (separate test sheet)
- Measure response times
- Test error recovery
- Document all test results

---

## Interface Contracts

### Module Communication
All modules communicate through function calls with these standard response formats:

#### Success Response
```javascript
{
  success: true,
  data: { ... },
  timestamp: "2024-11-02T10:30:00Z"
}
```

#### Error Response
```javascript
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE",
  timestamp: "2024-11-02T10:30:00Z"
}
```

### Event Flow
1. WhatsApp Message → Evolution Webhook
2. Webhook → Ticket Detector
3. Detector → Sheets Writer
4. Scheduler → Sheets Reader → WhatsApp Sender

---

## Environment Variables

Add to `/Users/tomas/Desktop/ai_pbx/.env`:

```env
# CS Ticket System
CS_INSTANCE_ID=cs-ticket-monitor
CS_SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
CS_CHECK_INTERVAL_MINUTES=30
CS_STALE_THRESHOLD_HOURS=2
```

---

## Development Timeline

### Day 1 (Parallel Development)
- **Morning**: All agents (A, B, C, D) start their modules
- **Afternoon**: Continue development, unit testing

### Day 2 (Integration)
- **Morning**: Agent E integrates all modules
- **Afternoon**: Agent E fixes integration issues

### Day 3 (Testing)
- **Morning**: Agent F runs end-to-end tests
- **Afternoon**: Fix bugs, final validation

---

## Success Criteria

### Module Completion
- [ ] Module A: QR page accessible, Evolution instance registers
- [ ] Module B: Accurately detects 90% of test tickets
- [ ] Module C: Reads/writes to Google Sheets without errors
- [ ] Module D: Scheduler runs reliably for 24 hours
- [ ] Module E: All modules work together seamlessly
- [ ] Module F: All test scenarios pass

### System Validation
- [ ] Processes 100 messages without crashing
- [ ] Detects and logs tickets within 5 seconds
- [ ] Follow-ups sent for all stale tickets
- [ ] Status updates reflected in sheet
- [ ] System recovers from Evolution API disconnection
- [ ] Google Sheets rate limits handled

---

## Notes for Agents

### Agent Independence
- Each module must be testable in isolation
- Use mock data for testing without dependencies
- Document all functions with JSDoc
- Handle errors gracefully

### Integration Points
- All modules export standard interface
- Use async/await consistently
- Return promises from all async functions
- Log errors with context

### Code Quality
- Use existing code patterns from the repo
- Follow the project's error handling style
- Add comments for complex logic
- Keep functions small and focused

---

## Questions for Product Owner

Before starting development, clarify:
1. Which WhatsApp groups should be monitored?
2. What constitutes a "ticket" vs normal message?
3. Should follow-ups be sent to specific people or whole group?
4. Any specific ticket ID format required?
5. Should resolved tickets be archived?

---

This specification allows each agent to work independently while ensuring all pieces fit together perfectly.