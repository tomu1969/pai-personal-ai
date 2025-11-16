/**
 * Unit Tests for Google Sheets Integration Service
 * Module C Testing Suite
 */

const SheetsService = require('../modules/sheets-service');

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({}))
    },
    sheets: jest.fn().mockReturnValue({
      spreadsheets: {
        values: {
          get: jest.fn(),
          append: jest.fn(),
          update: jest.fn(),
          batchUpdate: jest.fn()
        }
      }
    })
  }
}));

describe('SheetsService', () => {
  let sheetsService;
  let mockSheets;

  const mockServiceAccount = {
    client_email: 'test@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----'
  };

  const mockSpreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

  beforeEach(() => {
    sheetsService = new SheetsService();
    
    // Get the mocked sheets instance
    const { google } = require('googleapis');
    mockSheets = google.sheets();
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      // Mock successful header check
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Ticket ID', 'Timestamp', 'Group', 'Customer', 'Issue', 'Priority', 'Status', 'Last Updated', 'Notes']] }
      });

      const result = await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);

      expect(result.success).toBe(true);
      expect(sheetsService.spreadsheetId).toBe(mockSpreadsheetId);
    });

    it('should handle initialization with string credentials', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });

      const credentialsString = JSON.stringify(mockServiceAccount);
      const result = await sheetsService.initialize(credentialsString, mockSpreadsheetId);

      expect(result.success).toBe(true);
    });

    it('should create headers if sheet is empty', async () => {
      // Mock empty sheet response
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] }
      });

      mockSheets.spreadsheets.values.update.mockResolvedValue({
        data: { updatedRows: 1 }
      });

      const result = await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);

      expect(result.success).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: mockSpreadsheetId,
        range: 'A1:I1',
        valueInputOption: 'RAW',
        resource: {
          values: [sheetsService.headers]
        }
      });
    });

    it('should handle initialization errors', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));

      const result = await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sheets initialization failed');
    });
  });

  describe('writeTicket', () => {
    beforeEach(async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);
    });

    it('should write a new ticket successfully', async () => {
      const ticketData = {
        customer: 'John Doe',
        issue: 'Cannot login to account',
        priority: 'high',
        groupName: 'Customer Support',
        groupId: 'group123@g.us'
      };

      mockSheets.spreadsheets.values.append.mockResolvedValue({
        data: { updates: { updatedRows: 1 } }
      });

      const result = await sheetsService.writeTicket(ticketData);

      expect(result.success).toBe(true);
      expect(result.ticketId).toMatch(/^T\d+$/);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: mockSpreadsheetId,
        range: 'A:I',
        valueInputOption: 'RAW',
        resource: {
          values: [expect.arrayContaining([
            expect.stringMatching(/^T\d+$/), // Ticket ID
            expect.any(String), // Timestamp
            'Customer Support',  // Group
            'John Doe',         // Customer
            'Cannot login to account', // Issue
            'high',             // Priority
            'Open',             // Status
            expect.any(String), // Last Updated
            expect.stringContaining('group123@g.us') // Notes
          ])]
        }
      });
    });

    it('should handle missing optional fields', async () => {
      const ticketData = {
        issue: 'Basic issue'
      };

      mockSheets.spreadsheets.values.append.mockResolvedValue({
        data: { updates: { updatedRows: 1 } }
      });

      const result = await sheetsService.writeTicket(ticketData);

      expect(result.success).toBe(true);
      
      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const rowData = appendCall.resource.values[0];
      
      expect(rowData[2]).toBe('Unknown'); // Group
      expect(rowData[3]).toBe('Unknown'); // Customer
      expect(rowData[5]).toBe('medium');  // Priority (default)
    });

    it('should handle API errors', async () => {
      mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('API Error'));

      const result = await sheetsService.writeTicket({ issue: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to write ticket');
    });
  });

  describe('getOpenTickets', () => {
    beforeEach(async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);
    });

    it('should retrieve open tickets successfully', async () => {
      const mockData = [
        sheetsService.headers,
        ['T123', '2024-11-02T10:00:00Z', 'Support', 'John', 'Issue 1', 'high', 'Open', '2024-11-02T10:00:00Z', 'Notes'],
        ['T124', '2024-11-02T11:00:00Z', 'Support', 'Jane', 'Issue 2', 'low', 'Resolved', '2024-11-02T11:30:00Z', 'Fixed'],
        ['T125', '2024-11-02T12:00:00Z', 'Support', 'Bob', 'Issue 3', 'medium', 'Open', '2024-11-02T12:00:00Z', 'Pending']
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData }
      });

      const tickets = await sheetsService.getOpenTickets();

      expect(tickets).toHaveLength(2); // Only open tickets
      expect(tickets[0].ticketId).toBe('T123');
      expect(tickets[0].status).toBe('Open');
      expect(tickets[1].ticketId).toBe('T125');
      expect(tickets[1].status).toBe('Open');
    });

    it('should handle empty sheet', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });

      const tickets = await sheetsService.getOpenTickets();

      expect(tickets).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));

      const tickets = await sheetsService.getOpenTickets();

      expect(tickets).toEqual([]);
    });
  });

  describe('updateTicketStatus', () => {
    beforeEach(async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);
    });

    it('should update ticket status successfully', async () => {
      // Mock finding the ticket
      mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [['T123'], ['T124']] }
      });

      mockSheets.spreadsheets.values.batchUpdate.mockResolvedValue({
        data: { replies: [] }
      });

      const result = await sheetsService.updateTicketStatus('T123', 'resolved', 'Issue fixed');

      expect(result.success).toBe(true);
      expect(mockSheets.spreadsheets.values.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: mockSpreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: [
            { range: 'G2', values: [['resolved']] },
            { range: 'H2', values: [[expect.any(String)]] },
            { range: 'I2', values: [['Issue fixed']] }
          ]
        }
      });
    });

    it('should update without notes if not provided', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [['T123']] }
      });

      mockSheets.spreadsheets.values.batchUpdate.mockResolvedValue({
        data: { replies: [] }
      });

      const result = await sheetsService.updateTicketStatus('T123', 'in_progress');

      expect(result.success).toBe(true);
      
      const updateCall = mockSheets.spreadsheets.values.batchUpdate.mock.calls[0][0];
      expect(updateCall.resource.data).toHaveLength(2); // No notes update
    });

    it('should handle ticket not found', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] }
      });

      const result = await sheetsService.updateTicketStatus('T999', 'resolved');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ticket T999 not found');
    });
  });

  describe('getStaleTickets', () => {
    beforeEach(async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);
    });

    it('should identify stale tickets correctly', async () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));

      const mockData = [
        sheetsService.headers,
        ['T123', threeHoursAgo.toISOString(), 'Support', 'John', 'Old issue', 'high', 'Open', threeHoursAgo.toISOString(), 'Stale'],
        ['T124', oneHourAgo.toISOString(), 'Support', 'Jane', 'Recent issue', 'low', 'Open', oneHourAgo.toISOString(), 'Fresh'],
        ['T125', threeHoursAgo.toISOString(), 'Support', 'Bob', 'Resolved issue', 'medium', 'Resolved', now.toISOString(), 'Done']
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData }
      });

      const staleTickets = await sheetsService.getStaleTickets(2); // 2 hours threshold

      expect(staleTickets).toHaveLength(1);
      expect(staleTickets[0].ticketId).toBe('T123');
      expect(staleTickets[0].status).toBe('Open');
    });

    it('should handle empty results', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });

      const staleTickets = await sheetsService.getStaleTickets(2);

      expect(staleTickets).toHaveLength(0);
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);
    });

    it('should track request count', () => {
      expect(sheetsService.requestCount).toBe(1); // From initialization
      
      sheetsService._incrementRequestCount();
      expect(sheetsService.requestCount).toBe(2);
    });

    it('should reset request count after 100 seconds', async () => {
      // Set request time to 101 seconds ago
      sheetsService.requestResetTime = Date.now() - 101000;
      sheetsService.requestCount = 50;

      await sheetsService._checkRateLimit();

      expect(sheetsService.requestCount).toBe(0);
    });
  });

  describe('health status', () => {
    it('should return correct health status when initialized', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [sheetsService.headers] }
      });
      
      await sheetsService.initialize(mockServiceAccount, mockSpreadsheetId);

      const health = sheetsService.getHealthStatus();

      expect(health.initialized).toBe(true);
      expect(health.spreadsheetId).toBe(mockSpreadsheetId);
      expect(health.requestCount).toBeGreaterThan(0);
      expect(health.rateLimitRemaining).toBeLessThan(100);
    });

    it('should return correct health status when not initialized', () => {
      const health = sheetsService.getHealthStatus();

      expect(health.initialized).toBe(false);
      expect(health.spreadsheetId).toBe(null);
      expect(health.requestCount).toBe(0);
    });
  });
});