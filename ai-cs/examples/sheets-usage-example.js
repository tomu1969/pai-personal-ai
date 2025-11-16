/**
 * Google Sheets Service Usage Examples
 * Module C Implementation Examples
 * 
 * This file demonstrates how to use the SheetsService for CS ticket management
 */

const SheetsService = require('../modules/sheets-service');

// Example configuration
const CONFIG = {
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{"type":"service_account","project_id":"your-project","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"}',
  spreadsheetId: process.env.CS_SHEET_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
};

async function example1_BasicInitialization() {
  console.log('\n=== Example 1: Basic Initialization ===');
  
  const sheetsService = new SheetsService();
  
  try {
    const result = await sheetsService.initialize(
      CONFIG.serviceAccountKey,
      CONFIG.spreadsheetId
    );
    
    if (result.success) {
      console.log('✅ Sheets service initialized successfully');
      
      // Check health status
      const health = sheetsService.getHealthStatus();
      console.log('📊 Health Status:', {
        initialized: health.initialized,
        rateLimitRemaining: health.rateLimitRemaining
      });
      
    } else {
      console.log('❌ Initialization failed:', result.error);
    }
    
    return sheetsService;
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    return null;
  }
}

async function example2_CreateTicket(sheetsService) {
  console.log('\n=== Example 2: Create New Ticket ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return null;
  }
  
  const ticketData = {
    customer: 'Alice Johnson',
    issue: 'Unable to access premium features after payment',
    priority: 'high',
    groupName: 'Premium Support',
    groupId: 'premium-support@g.us'
  };
  
  try {
    const result = await sheetsService.writeTicket(ticketData);
    
    if (result.success) {
      console.log('✅ Ticket created successfully:');
      console.log('   🎫 Ticket ID:', result.ticketId);
      console.log('   📅 Timestamp:', result.timestamp);
      return result.ticketId;
    } else {
      console.log('❌ Failed to create ticket:', result.error);
      return null;
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    return null;
  }
}

async function example3_RetrieveTickets(sheetsService) {
  console.log('\n=== Example 3: Retrieve Open Tickets ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return;
  }
  
  try {
    const openTickets = await sheetsService.getOpenTickets();
    
    console.log(`📋 Found ${openTickets.length} open tickets:`);
    
    if (openTickets.length > 0) {
      openTickets.slice(0, 3).forEach(ticket => { // Show first 3
        console.log(`   🎫 ${ticket.ticketId}: ${ticket.customer} - ${ticket.issue.substring(0, 50)}${ticket.issue.length > 50 ? '...' : ''}`);
        console.log(`      📊 Priority: ${ticket.priority} | 👥 Group: ${ticket.group}`);
      });
      
      if (openTickets.length > 3) {
        console.log(`   ... and ${openTickets.length - 3} more tickets`);
      }
    } else {
      console.log('   🎉 No open tickets found!');
    }
    
    return openTickets;
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    return [];
  }
}

async function example4_UpdateTicketStatus(sheetsService, ticketId) {
  console.log('\n=== Example 4: Update Ticket Status ===');
  
  if (!sheetsService || !ticketId) {
    console.log('⚠️  Sheets service or ticket ID not available');
    return;
  }
  
  try {
    const result = await sheetsService.updateTicketStatus(
      ticketId,
      'in_progress',
      'Assigned to technical team for investigation'
    );
    
    if (result.success) {
      console.log('✅ Ticket status updated successfully');
      console.log('   🎫 Ticket ID:', ticketId);
      console.log('   📈 New Status: in_progress');
      console.log('   📝 Notes: Assigned to technical team for investigation');
    } else {
      console.log('❌ Failed to update ticket:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

async function example5_FindStaleTickets(sheetsService) {
  console.log('\n=== Example 5: Find Stale Tickets ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return;
  }
  
  try {
    const staleTickets = await sheetsService.getStaleTickets(2); // 2 hours old
    
    console.log(`⏰ Found ${staleTickets.length} stale tickets (>2 hours old):`);
    
    if (staleTickets.length > 0) {
      staleTickets.forEach(ticket => {
        const age = Math.round((Date.now() - new Date(ticket.lastUpdated).getTime()) / (1000 * 60 * 60));
        console.log(`   🎫 ${ticket.ticketId}: ${ticket.customer} (${age}h old)`);
        console.log(`      📝 ${ticket.issue.substring(0, 60)}${ticket.issue.length > 60 ? '...' : ''}`);
      });
    } else {
      console.log('   ✨ No stale tickets found - great response times!');
    }
    
    return staleTickets;
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    return [];
  }
}

async function example6_BatchOperations(sheetsService) {
  console.log('\n=== Example 6: Batch Operations ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return;
  }
  
  console.log('📦 Creating multiple tickets in batch...');
  
  const batchTickets = [
    {
      customer: 'Bob Wilson',
      issue: 'Account locked after multiple login attempts',
      priority: 'medium',
      groupName: 'Security Support',
      groupId: 'security@g.us'
    },
    {
      customer: 'Carol Davis',
      issue: 'Billing discrepancy on latest invoice',
      priority: 'low',
      groupName: 'Billing Support',
      groupId: 'billing@g.us'
    },
    {
      customer: 'David Brown',
      issue: 'Feature request: Dark mode for mobile app',
      priority: 'low',
      groupName: 'Product Feedback',
      groupId: 'feedback@g.us'
    }
  ];
  
  try {
    const startTime = Date.now();
    
    // Create tickets in parallel
    const promises = batchTickets.map(ticketData => 
      sheetsService.writeTicket(ticketData)
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Batch operation completed in ${endTime - startTime}ms:`);
    console.log(`   📊 Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      console.log('   🎫 Created tickets:');
      successful.forEach(result => {
        console.log(`      - ${result.ticketId}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('   ⚠️  Failed tickets:');
      failed.forEach(result => {
        console.log(`      - Error: ${result.error}`);
      });
    }
    
    return successful.map(r => r.ticketId);
    
  } catch (error) {
    console.error('💥 Unexpected error in batch operation:', error.message);
    return [];
  }
}

async function example7_ErrorHandling(sheetsService) {
  console.log('\n=== Example 7: Error Handling ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return;
  }
  
  console.log('🧪 Testing error handling scenarios...');
  
  // Test 1: Update non-existent ticket
  console.log('\n📝 Test 1: Update non-existent ticket');
  const result1 = await sheetsService.updateTicketStatus('T999999999', 'resolved');
  if (!result1.success) {
    console.log('✅ Correctly handled non-existent ticket:', result1.error);
  } else {
    console.log('❌ Should have failed for non-existent ticket');
  }
  
  // Test 2: Create ticket with minimal data
  console.log('\n📝 Test 2: Create ticket with minimal data');
  const result2 = await sheetsService.writeTicket({});
  if (result2.success) {
    console.log('✅ Successfully created ticket with defaults:', result2.ticketId);
  } else {
    console.log('❌ Failed to create ticket with minimal data:', result2.error);
  }
  
  // Test 3: Get ticket by ID
  console.log('\n📝 Test 3: Get ticket by ID');
  if (result2.success) {
    const ticket = await sheetsService.getTicketById(result2.ticketId);
    if (ticket) {
      console.log('✅ Successfully retrieved ticket:', ticket.ticketId);
      console.log('   📊 Customer:', ticket.customer);
      console.log('   📊 Priority:', ticket.priority);
    } else {
      console.log('❌ Failed to retrieve ticket by ID');
    }
  }
}

async function example8_RateLimitingDemo(sheetsService) {
  console.log('\n=== Example 8: Rate Limiting Demo ===');
  
  if (!sheetsService) {
    console.log('⚠️  Sheets service not available');
    return;
  }
  
  console.log('⏱️  Testing rate limiting with rapid requests...');
  
  const startTime = Date.now();
  let requestCount = 0;
  
  try {
    // Make rapid requests to demonstrate rate limiting
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        sheetsService.getOpenTickets().then(() => {
          requestCount++;
          console.log(`   ✓ Request ${requestCount} completed`);
        })
      );
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`📊 Rate limiting test results:`);
    console.log(`   ⏱️  Total time: ${endTime - startTime}ms`);
    console.log(`   📈 Requests completed: ${requestCount}`);
    console.log(`   🚦 Average time per request: ${Math.round((endTime - startTime) / requestCount)}ms`);
    
    // Check final health status
    const health = sheetsService.getHealthStatus();
    console.log(`   🏥 Final rate limit remaining: ${health.rateLimitRemaining}`);
    
  } catch (error) {
    console.error('💥 Error during rate limiting test:', error.message);
  }
}

// Main execution function
async function runAllExamples() {
  console.log('🚀 Google Sheets Service Examples');
  console.log('=====================================');
  
  // Initialize service
  const sheetsService = await example1_BasicInitialization();
  if (!sheetsService) {
    console.log('\n❌ Cannot continue - service initialization failed');
    console.log('💡 Make sure to set GOOGLE_SERVICE_ACCOUNT_KEY and CS_SHEET_ID environment variables');
    return;
  }
  
  // Run examples
  const ticketId = await example2_CreateTicket(sheetsService);
  await example3_RetrieveTickets(sheetsService);
  
  if (ticketId) {
    await example4_UpdateTicketStatus(sheetsService, ticketId);
  }
  
  await example5_FindStaleTickets(sheetsService);
  const batchTicketIds = await example6_BatchOperations(sheetsService);
  await example7_ErrorHandling(sheetsService);
  await example8_RateLimitingDemo(sheetsService);
  
  // Cleanup
  if (batchTicketIds.length > 0) {
    console.log('\n🧹 Cleaning up example tickets...');
    const cleanupPromises = batchTicketIds.map(id =>
      sheetsService.updateTicketStatus(id, 'resolved', 'Cleaned up after examples')
    );
    await Promise.all(cleanupPromises);
    console.log('✅ Cleanup completed');
  }
  
  console.log('\n🎉 All examples completed successfully!');
  console.log('\n💡 Tips for production use:');
  console.log('   - Set up proper error logging and monitoring');
  console.log('   - Implement retry logic for network failures');
  console.log('   - Use environment variables for all configuration');
  console.log('   - Monitor API quota usage');
  console.log('   - Consider using Redis for caching frequently accessed data');
}

// Run examples if called directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error running examples:', error);
    process.exit(1);
  });
}

module.exports = {
  example1_BasicInitialization,
  example2_CreateTicket,
  example3_RetrieveTickets,
  example4_UpdateTicketStatus,
  example5_FindStaleTickets,
  example6_BatchOperations,
  example7_ErrorHandling,
  example8_RateLimitingDemo,
  runAllExamples
};