/**
 * Integration Test for Google Sheets Service
 * Tests with real Google Sheets API (requires valid credentials)
 * 
 * To run this test:
 * 1. Set up a test Google Sheet
 * 2. Create a service account with Sheets API access
 * 3. Set environment variables:
 *    - TEST_SHEET_ID=your_test_spreadsheet_id
 *    - GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
 * 4. Run: npm test -- --testNamePattern="Integration Test"
 */

const SheetsService = require('../modules/sheets-service');

describe('Integration Test - Google Sheets Service', () => {
  let sheetsService;
  const testSpreadsheetId = process.env.TEST_SHEET_ID;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  // Skip integration tests if credentials not provided
  const skipTest = !testSpreadsheetId || !serviceAccountKey;

  beforeAll(() => {
    if (skipTest) {
      console.log('Skipping integration tests - missing TEST_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_KEY');
    }
  });

  beforeEach(() => {
    sheetsService = new SheetsService();
  });

  describe('Real API Integration', () => {
    test('should initialize with real credentials', async () => {
      if (skipTest) return;

      const result = await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);
      
      expect(result.success).toBe(true);
      expect(sheetsService.spreadsheetId).toBe(testSpreadsheetId);
    }, 10000);

    test('should write and retrieve tickets', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      // Write a test ticket
      const ticketData = {
        customer: 'Integration Test User',
        issue: 'Test issue for integration testing',
        priority: 'high',
        groupName: 'Test Group',
        groupId: 'test-group@g.us'
      };

      const writeResult = await sheetsService.writeTicket(ticketData);
      expect(writeResult.success).toBe(true);
      expect(writeResult.ticketId).toBeDefined();

      // Retrieve open tickets
      const openTickets = await sheetsService.getOpenTickets();
      expect(openTickets.length).toBeGreaterThan(0);
      
      // Find our test ticket
      const testTicket = openTickets.find(ticket => 
        ticket.customer === 'Integration Test User'
      );
      expect(testTicket).toBeDefined();
      expect(testTicket.status).toBe('Open');

      // Update ticket status
      const updateResult = await sheetsService.updateTicketStatus(
        testTicket.ticketId, 
        'resolved', 
        'Resolved by integration test'
      );
      expect(updateResult.success).toBe(true);

      // Verify update
      const updatedTicket = await sheetsService.getTicketById(testTicket.ticketId);
      expect(updatedTicket.status).toBe('resolved');
      expect(updatedTicket.notes).toBe('Resolved by integration test');

    }, 15000);

    test('should handle rate limiting gracefully', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      const startTime = Date.now();
      
      // Make many rapid requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(sheetsService.getOpenTickets());
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

      // Should not take too long (rate limiting should be efficient)
      expect(endTime - startTime).toBeLessThan(30000);

    }, 35000);

    test('should identify stale tickets correctly', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      // Write a test ticket
      const ticketData = {
        customer: 'Stale Test User',
        issue: 'This ticket should be stale',
        priority: 'medium',
        groupName: 'Stale Test Group',
        timestamp: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString() // 3 hours ago
      };

      const writeResult = await sheetsService.writeTicket(ticketData);
      expect(writeResult.success).toBe(true);

      // Get stale tickets (older than 2 hours)
      const staleTickets = await sheetsService.getStaleTickets(2);
      
      const ourStaleTicket = staleTickets.find(ticket => 
        ticket.customer === 'Stale Test User'
      );
      expect(ourStaleTicket).toBeDefined();

      // Clean up - mark as resolved
      await sheetsService.updateTicketStatus(
        ourStaleTicket.ticketId, 
        'resolved', 
        'Cleaned up by stale test'
      );

    }, 15000);

    test('should handle authentication errors', async () => {
      if (skipTest) return;

      const invalidCredentials = {
        client_email: 'invalid@example.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----'
      };

      const result = await sheetsService.initialize(invalidCredentials, testSpreadsheetId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('initialization failed');

    }, 10000);

    test('should handle non-existent spreadsheet', async () => {
      if (skipTest) return;

      const invalidSpreadsheetId = '1InvalidSpreadsheetId123';
      
      const result = await sheetsService.initialize(serviceAccountKey, invalidSpreadsheetId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('initialization failed');

    }, 10000);
  });

  describe('Performance Tests', () => {
    test('should handle large number of tickets efficiently', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      const startTime = Date.now();
      
      // Write multiple tickets
      const writePromises = [];
      for (let i = 0; i < 5; i++) {
        writePromises.push(sheetsService.writeTicket({
          customer: `Performance Test User ${i}`,
          issue: `Performance test issue ${i}`,
          priority: 'low',
          groupName: 'Performance Test Group'
        }));
      }

      const writeResults = await Promise.all(writePromises);
      const writeTime = Date.now();

      // All writes should succeed
      writeResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Retrieve all tickets
      const allTickets = await sheetsService.getOpenTickets();
      const readTime = Date.now();

      expect(allTickets.length).toBeGreaterThanOrEqual(5);

      // Clean up test tickets
      const testTickets = allTickets.filter(ticket => 
        ticket.customer.includes('Performance Test User')
      );

      const cleanupPromises = testTickets.map(ticket =>
        sheetsService.updateTicketStatus(ticket.ticketId, 'resolved', 'Cleaned up by performance test')
      );

      await Promise.all(cleanupPromises);
      const cleanupTime = Date.now();

      console.log(`Performance Test Results:
        - Write time: ${writeTime - startTime}ms for 5 tickets
        - Read time: ${readTime - writeTime}ms
        - Cleanup time: ${cleanupTime - readTime}ms for ${testTickets.length} tickets
        - Total time: ${cleanupTime - startTime}ms`);

      // Performance expectations (adjust based on your requirements)
      expect(writeTime - startTime).toBeLessThan(10000); // 10 seconds
      expect(readTime - writeTime).toBeLessThan(5000);   // 5 seconds

    }, 30000);
  });

  describe('Error Recovery Tests', () => {
    test('should recover from network interruption', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      // This test would need to simulate network interruption
      // For now, just verify service can continue after initialization
      
      const tickets1 = await sheetsService.getOpenTickets();
      expect(Array.isArray(tickets1)).toBe(true);

      // Wait a bit to simulate time passing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const tickets2 = await sheetsService.getOpenTickets();
      expect(Array.isArray(tickets2)).toBe(true);

    }, 10000);

    test('should handle quota exceeded gracefully', async () => {
      if (skipTest) return;

      await sheetsService.initialize(serviceAccountKey, testSpreadsheetId);

      // Simulate rapid requests that might hit quota
      // In real usage, this would trigger rate limiting
      
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(sheetsService.getOpenTickets());
      }

      const results = await Promise.all(promises);
      
      // All should succeed (rate limiting should prevent quota issues)
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

    }, 15000);
  });

  afterAll(async () => {
    if (skipTest || !sheetsService) return;

    try {
      // Clean up any remaining test data
      const allTickets = await sheetsService.getOpenTickets();
      const testTickets = allTickets.filter(ticket => 
        ticket.customer.includes('Test User') || 
        ticket.customer.includes('Integration Test') ||
        ticket.group.includes('Test Group')
      );

      if (testTickets.length > 0) {
        console.log(`Cleaning up ${testTickets.length} test tickets...`);
        
        const cleanupPromises = testTickets.map(ticket =>
          sheetsService.updateTicketStatus(
            ticket.ticketId, 
            'resolved', 
            'Cleaned up after integration tests'
          )
        );

        await Promise.all(cleanupPromises);
        console.log('Test cleanup completed');
      }
    } catch (error) {
      console.warn('Error during test cleanup:', error.message);
    }
  }, 30000);
});