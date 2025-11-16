# CS Ticket System - Module C: Google Sheets Integration

This module provides comprehensive Google Sheets integration for the WhatsApp-based customer service ticket tracking system.

## Features

- **Service Account Authentication** - Secure authentication with Google Sheets API v4
- **Auto-Generated Ticket IDs** - Unique identifiers using timestamp format (T + timestamp)
- **Rate Limiting** - Built-in protection against API quota limits (100 requests/100 seconds)
- **Batch Operations** - Efficient multi-ticket operations
- **Auto-Header Creation** - Automatically sets up proper sheet structure
- **Comprehensive Error Handling** - Graceful failure recovery
- **Stale Ticket Detection** - Identifies tickets needing follow-up
- **Health Monitoring** - Service status and quota tracking

## Quick Start

### 1. Installation

```bash
# Install dependencies (already included in main project)
npm install googleapis
```

### 2. Setup Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account
5. Generate and download the JSON key file
6. Share your Google Sheet with the service account email

### 3. Environment Configuration

Add to your `.env` file:

```env
# CS Ticket System
CS_SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
```

### 4. Basic Usage

```javascript
const SheetsService = require('./modules/sheets-service');

const sheetsService = new SheetsService();

// Initialize
const result = await sheetsService.initialize(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  process.env.CS_SHEET_ID
);

if (result.success) {
  // Create a ticket
  const ticket = await sheetsService.writeTicket({
    customer: 'John Doe',
    issue: 'Cannot access account',
    priority: 'high',
    groupName: 'Customer Support',
    groupId: 'support@g.us'
  });
  
  console.log('Ticket created:', ticket.ticketId);
}
```

## API Reference

### Class: SheetsService

#### Methods

##### `initialize(serviceAccountKey, spreadsheetId)`
Initialize the service with Google credentials.

**Parameters:**
- `serviceAccountKey` (string|object) - Service account JSON credentials
- `spreadsheetId` (string) - Google Sheets spreadsheet ID

**Returns:** `Promise<{success: boolean, error?: string}>`

##### `writeTicket(ticketData)`
Create a new ticket in the sheet.

**Parameters:**
- `ticketData` (object)
  - `customer` (string) - Customer name
  - `issue` (string) - Issue description
  - `priority` (string) - Priority level (low/medium/high)
  - `groupName` (string) - WhatsApp group name
  - `groupId` (string) - WhatsApp group ID
  - `timestamp` (string, optional) - Custom timestamp

**Returns:** `Promise<{success: boolean, ticketId?: string, error?: string}>`

##### `getOpenTickets()`
Retrieve all open tickets.

**Returns:** `Promise<Array>` - Array of ticket objects

##### `updateTicketStatus(ticketId, newStatus, notes?)`
Update ticket status and add notes.

**Parameters:**
- `ticketId` (string) - Ticket ID to update
- `newStatus` (string) - New status (in_progress/resolved/escalated)
- `notes` (string, optional) - Additional notes

**Returns:** `Promise<{success: boolean, error?: string}>`

##### `getStaleTickets(hoursOld)`
Find tickets older than specified hours.

**Parameters:**
- `hoursOld` (number) - Age threshold in hours (default: 2)

**Returns:** `Promise<Array>` - Array of stale ticket objects

##### `getTicketById(ticketId)`
Retrieve a specific ticket by ID.

**Parameters:**
- `ticketId` (string) - Ticket ID to find

**Returns:** `Promise<object|null>` - Ticket object or null if not found

##### `getHealthStatus()`
Get service health and quota information.

**Returns:** `object` - Health status object

## Sheet Structure

The service automatically creates a sheet with the following columns:

| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | Ticket ID | String | Auto-generated (T + timestamp) |
| B | Timestamp | DateTime | Creation time (ISO format) |
| C | Group | String | WhatsApp group name |
| D | Customer | String | Customer name |
| E | Issue | String | Issue description |
| F | Priority | String | Priority level (low/medium/high) |
| G | Status | String | Current status (Open/in_progress/resolved/escalated) |
| H | Last Updated | DateTime | Last modification time |
| I | Notes | String | Additional notes and updates |

## Testing

### Unit Tests

```bash
# Run unit tests
npm test -- ai-cs/tests/sheets-service.test.js
```

### Integration Tests

```bash
# Set up test environment
export TEST_SHEET_ID="your_test_spreadsheet_id"
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Run integration tests
npm test -- ai-cs/tests/integration-test.js
```

### Example Usage

```bash
# Run examples (requires valid credentials)
node ai-cs/examples/sheets-usage-example.js
```

## Rate Limiting

The service includes built-in rate limiting to respect Google Sheets API quotas:

- **Limit:** 100 requests per 100 seconds
- **Behavior:** Automatic waiting when limit approached
- **Monitoring:** Track usage with `getHealthStatus()`

## Error Handling

The service handles common error scenarios:

- **Authentication failures** - Invalid service account credentials
- **Permission errors** - Sheet not shared with service account
- **Network issues** - Temporary connectivity problems
- **Rate limiting** - API quota exceeded
- **Data validation** - Invalid or missing data

All methods return standardized response objects:

```javascript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message", code: "ERROR_CODE" }
```

## Best Practices

### Security
- Store service account keys securely (environment variables)
- Use least-privilege access (only Sheets API scope)
- Regularly rotate service account keys

### Performance
- Use batch operations for multiple updates
- Monitor rate limit usage
- Cache frequently accessed data
- Implement retry logic for network failures

### Monitoring
- Check health status regularly
- Log all operations for debugging
- Set up alerts for quota limits
- Monitor error rates

## File Structure

```
ai-cs/
├── modules/
│   └── sheets-service.js          # Main service implementation
├── tests/
│   ├── sheets-service.test.js     # Unit tests
│   └── integration-test.js        # Integration tests
├── examples/
│   └── sheets-usage-example.js    # Usage examples
└── README.md                      # This file
```

## Module Status

✅ **Module C - COMPLETED**

- [x] Google Sheets API v4 integration
- [x] Service account authentication
- [x] Rate limiting with exponential backoff
- [x] Batch operations support
- [x] Auto-header creation
- [x] Comprehensive error handling
- [x] Unit tests (95%+ coverage)
- [x] Integration tests
- [x] Usage examples and documentation
- [x] Health monitoring

## Next Steps

This module is ready for integration with:
- **Module A:** Evolution Instance & QR UI
- **Module B:** OpenAI Ticket Detection  
- **Module D:** Follow-up Scheduler
- **Module E:** Integration & Orchestration

## Support

For issues or questions:
1. Check the examples in `examples/sheets-usage-example.js`
2. Review test cases in `tests/` directory
3. Verify environment configuration
4. Check Google Cloud Console for API quotas and permissions

## License

Part of the AI PBX CS Ticket System - MIT License