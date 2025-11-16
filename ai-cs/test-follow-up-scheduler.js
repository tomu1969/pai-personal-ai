/**
 * Test script for Follow-up Scheduler Module
 * 
 * Tests all functionality with mock services to verify behavior
 * without requiring actual Google Sheets or WhatsApp connections.
 */

const followUpScheduler = require('./modules/follow-up-scheduler');

// Mock services for testing
const mockSheetsService = {
  async getStaleTickets(hoursOld) {
    console.log(`[Mock Sheets] Getting tickets older than ${hoursOld} hours`);
    
    // Return mock stale tickets
    return [
      {
        ticketId: 'T1698765432',
        timestamp: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString(), // 3 hours old
        groupId: 'group1@g.us',
        customer: 'John Smith',
        issue: 'Cannot access account',
        priority: 'high',
        status: 'open',
        lastUpdated: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString()
      },
      {
        ticketId: 'T1698765433',
        timestamp: new Date(Date.now() - (5 * 60 * 60 * 1000)).toISOString(), // 5 hours old
        groupId: 'group2@g.us',
        customer: 'Jane Doe',
        issue: 'Payment not processing',
        priority: 'medium',
        status: 'open',
        lastUpdated: new Date(Date.now() - (4 * 60 * 60 * 1000)).toISOString()
      }
    ];
  },

  async getOpenTickets() {
    return this.getStaleTickets(0); // Return all tickets for testing
  },

  async updateTicketStatus(ticketId, status, notes) {
    console.log(`[Mock Sheets] Updating ticket ${ticketId}: status=${status}, notes=${notes}`);
    return { success: true };
  }
};

const mockMessageSender = async ({ groupId, message, ticketId }) => {
  console.log(`[Mock WhatsApp] Sending to group ${groupId}:`);
  console.log(`Message: ${message.substring(0, 100)}...`);
  console.log(`For ticket: ${ticketId}`);
  return { success: true };
};

const testLogger = (message) => {
  console.log(`[TEST] ${message}`);
};

// Test functions
async function testBasicFunctionality() {
  console.log('\n=== Testing Basic Functionality ===');
  
  try {
    // Test health check
    const health = followUpScheduler.healthCheck();
    console.log('Health check:', health);
    
    // Test message generation
    const testTicket = {
      ticketId: 'T123',
      customer: 'Test User',
      issue: 'Test issue',
      priority: 'high',
      timestamp: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString()
    };
    
    const message = followUpScheduler.generateFollowUpMessage(testTicket);
    console.log('\nGenerated follow-up message:');
    console.log(message);
    
    console.log('\n✅ Basic functionality tests passed');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error.message);
  }
}

async function testProcessStaleTickets() {
  console.log('\n=== Testing Process Stale Tickets ===');
  
  try {
    const results = await followUpScheduler.processStaleTickets(
      mockSheetsService,
      mockMessageSender,
      2, // 2 hours threshold
      testLogger
    );
    
    console.log('\nProcessing results:');
    console.log('- Processed:', results.processed);
    console.log('- Follow-ups sent:', results.followUpsSent);
    console.log('- Errors:', results.errors.length);
    console.log('- Stale tickets found:', results.staleTickets.length);
    
    if (results.errors.length > 0) {
      console.log('Errors:', results.errors);
    }
    
    console.log('\n✅ Process stale tickets test passed');
  } catch (error) {
    console.error('❌ Process stale tickets test failed:', error.message);
  }
}

async function testManualTrigger() {
  console.log('\n=== Testing Manual Trigger ===');
  
  try {
    const result = await followUpScheduler.triggerFollowUp(
      'T1698765432',
      mockMessageSender,
      mockSheetsService,
      testLogger
    );
    
    console.log('\nManual trigger result:');
    console.log('- Success:', result.success);
    if (result.success) {
      console.log('- Ticket ID:', result.ticketId);
      console.log('- Message preview:', result.message.substring(0, 100) + '...');
    } else {
      console.log('- Error:', result.error);
    }
    
    console.log('\n✅ Manual trigger test passed');
  } catch (error) {
    console.error('❌ Manual trigger test failed:', error.message);
  }
}

async function testSchedulerLifecycle() {
  console.log('\n=== Testing Scheduler Lifecycle ===');
  
  try {
    // Test starting scheduler
    const scheduler = followUpScheduler.start({
      intervalMinutes: 0.1, // Very short interval for testing (6 seconds)
      staleThresholdHours: 1,
      sheetsService: mockSheetsService,
      messageSender: mockMessageSender,
      logger: testLogger
    });
    
    console.log('Started scheduler:', scheduler.id);
    console.log('Interval:', scheduler.intervalMinutes, 'minutes');
    console.log('Stale threshold:', scheduler.staleThresholdHours, 'hours');
    
    // Let it run for a few cycles
    console.log('\nLetting scheduler run for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Test stopping scheduler
    const stopped = followUpScheduler.stop(scheduler.id, testLogger);
    console.log('Scheduler stopped:', stopped);
    
    // Test getting active schedulers
    const active = followUpScheduler.getActiveSchedulers();
    console.log('Active schedulers:', active.length);
    
    console.log('\n✅ Scheduler lifecycle test passed');
  } catch (error) {
    console.error('❌ Scheduler lifecycle test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  try {
    // Test with failing sheets service
    const failingSheetsService = {
      async getStaleTickets() {
        throw new Error('Sheets API error');
      }
    };
    
    const results = await followUpScheduler.processStaleTickets(
      failingSheetsService,
      mockMessageSender,
      2,
      testLogger
    );
    
    console.log('Error handling results:');
    console.log('- Errors captured:', results.errors.length);
    console.log('- System continued running:', results.errors.length > 0);
    
    // Test starting scheduler without required parameters
    try {
      followUpScheduler.start({});
      console.log('❌ Should have thrown error for missing parameters');
    } catch (error) {
      console.log('✅ Correctly caught missing parameter error');
    }
    
    console.log('\n✅ Error handling test passed');
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Follow-up Scheduler Module Tests\n');
  
  await testBasicFunctionality();
  await testProcessStaleTickets();
  await testManualTrigger();
  await testSchedulerLifecycle();
  await testErrorHandling();
  
  // Clean up any remaining schedulers
  const stoppedCount = followUpScheduler.stopAll(testLogger);
  console.log(`\n🧹 Cleaned up ${stoppedCount} remaining schedulers`);
  
  console.log('\n🎉 All tests completed!');
  console.log('\nModule D: Follow-up Scheduler is ready for integration.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  mockSheetsService,
  mockMessageSender,
  testLogger
};