/**
 * @file test-ticket-detector.js
 * @description Test suite for ticket detection module
 * @author CS Ticket System
 * @since November 2025
 */

const ticketDetector = require('./ticket-detector');

/**
 * Test scenarios for ticket detection
 */
const testScenarios = [
  {
    name: 'Obvious Ticket - Account Access',
    message: 'I cannot login to my account',
    sender: 'John Smith',
    expected: { isTicket: true, priority: 'high', category: 'technical' }
  },
  {
    name: 'High Priority Technical Issue',
    message: 'URGENT: The system is down and I need immediate help!',
    sender: 'Maria Garcia',
    expected: { isTicket: true, priority: 'high', category: 'technical' }
  },
  {
    name: 'Billing Question',
    message: 'I have a question about my invoice from last month',
    sender: 'Robert Johnson',
    expected: { isTicket: true, priority: 'medium', category: 'billing' }
  },
  {
    name: 'Spanish Technical Issue',
    message: 'No puedo acceder a mi cuenta, aparece un error',
    sender: 'Carlos López',
    expected: { isTicket: true, priority: 'medium', category: 'technical' }
  },
  {
    name: 'Casual Greeting - Not a Ticket',
    message: 'Hello everyone! How is your day going?',
    sender: 'Sarah Wilson',
    expected: { isTicket: false }
  },
  {
    name: 'Thank You Message - Not a Ticket',
    message: 'Thanks for your help yesterday!',
    sender: 'Mike Davis',
    expected: { isTicket: false }
  },
  {
    name: 'General Question',
    message: 'What are your business hours?',
    sender: 'Lisa Chen',
    expected: { isTicket: true, priority: 'low', category: 'general' }
  },
  {
    name: 'App Bug Report',
    message: 'The mobile app crashes when I try to upload photos',
    sender: 'David Brown',
    expected: { isTicket: true, priority: 'medium', category: 'technical' }
  }
];

/**
 * Test scenarios for status updates
 */
const statusUpdateScenarios = [
  {
    name: 'Ticket Resolution',
    message: 'Ticket T123 has been resolved successfully',
    ticketId: 'T123',
    expected: { isUpdate: true, newStatus: 'resolved', ticketId: 'T123' }
  },
  {
    name: 'Work in Progress',
    message: 'We are currently working on issue #456 and will have an update soon',
    ticketId: null,
    expected: { isUpdate: true, newStatus: 'in_progress' }
  },
  {
    name: 'Escalation Notice',
    message: 'This issue needs to be escalated to the manager',
    ticketId: null,
    expected: { isUpdate: true, newStatus: 'escalated' }
  },
  {
    name: 'Regular Message - Not an Update',
    message: 'Good morning everyone!',
    ticketId: null,
    expected: { isUpdate: false }
  }
];

/**
 * Test scenarios for follow-up message generation
 */
const followUpScenarios = [
  {
    name: 'English High Priority Ticket',
    ticket: {
      id: 'T123',
      customer: 'John Smith',
      issue: 'Cannot access account',
      priority: 'high',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    },
    expected: /HIGH PRIORITY.*3 hours/
  },
  {
    name: 'Spanish Medium Priority Ticket',
    ticket: {
      id: 'T456',
      customer: 'María García',
      issue: 'Problema con facturación',
      priority: 'medium',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    expected: /T456.*María García.*2 horas/
  },
  {
    name: 'Recent Low Priority Ticket',
    ticket: {
      id: 'T789',
      customer: 'David Wilson',
      issue: 'General question about features',
      priority: 'low',
      createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    },
    expected: /T789.*David Wilson/
  }
];

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting CS Ticket Detection Module Tests\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test ticket detection
  console.log('📋 Testing Ticket Detection...');
  for (const scenario of testScenarios) {
    totalTests++;
    try {
      const result = await ticketDetector.detectTicket(scenario.message, scenario.sender);
      
      if (validateTicketResult(result, scenario.expected)) {
        console.log(`✅ ${scenario.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${scenario.name}: FAILED`);
        console.log(`   Expected: ${JSON.stringify(scenario.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name}: ERROR - ${error.message}`);
    }
  }

  console.log('');

  // Test status update detection
  console.log('🔄 Testing Status Update Detection...');
  for (const scenario of statusUpdateScenarios) {
    totalTests++;
    try {
      const result = await ticketDetector.detectStatusUpdate(scenario.message, scenario.ticketId);
      
      if (validateStatusUpdateResult(result, scenario.expected)) {
        console.log(`✅ ${scenario.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${scenario.name}: FAILED`);
        console.log(`   Expected: ${JSON.stringify(scenario.expected)}`);
        console.log(`   Got: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name}: ERROR - ${error.message}`);
    }
  }

  console.log('');

  // Test follow-up message generation
  console.log('📨 Testing Follow-up Message Generation...');
  for (const scenario of followUpScenarios) {
    totalTests++;
    try {
      const result = ticketDetector.generateFollowUpMessage(scenario.ticket);
      
      if (scenario.expected.test(result)) {
        console.log(`✅ ${scenario.name}: PASSED`);
        console.log(`   Message: "${result}"`);
        passedTests++;
      } else {
        console.log(`❌ ${scenario.name}: FAILED`);
        console.log(`   Expected pattern: ${scenario.expected}`);
        console.log(`   Got: "${result}"`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name}: ERROR - ${error.message}`);
    }
  }

  console.log('');

  // Test error handling
  console.log('🛡️ Testing Error Handling...');
  totalTests += 4;

  // Test empty message
  try {
    const result = await ticketDetector.detectTicket('', 'Test User');
    if (result.isTicket === false) {
      console.log('✅ Empty message handling: PASSED');
      passedTests++;
    } else {
      console.log('❌ Empty message handling: FAILED');
    }
  } catch (error) {
    console.log('❌ Empty message handling: ERROR');
  }

  // Test null message
  try {
    const result = await ticketDetector.detectTicket(null, 'Test User');
    if (result.isTicket === false) {
      console.log('✅ Null message handling: PASSED');
      passedTests++;
    } else {
      console.log('❌ Null message handling: FAILED');
    }
  } catch (error) {
    console.log('❌ Null message handling: ERROR');
  }

  // Test invalid ticket for follow-up
  try {
    const result = ticketDetector.generateFollowUpMessage({});
    if (typeof result === 'string' && result.length > 0) {
      console.log('✅ Invalid ticket follow-up: PASSED');
      passedTests++;
    } else {
      console.log('❌ Invalid ticket follow-up: FAILED');
    }
  } catch (error) {
    console.log('❌ Invalid ticket follow-up: ERROR');
  }

  // Test very long message
  try {
    const longMessage = 'Help me '.repeat(200); // Very long message
    const result = await ticketDetector.detectTicket(longMessage, 'Test User');
    if (typeof result.isTicket === 'boolean') {
      console.log('✅ Long message handling: PASSED');
      passedTests++;
    } else {
      console.log('❌ Long message handling: FAILED');
    }
  } catch (error) {
    console.log('❌ Long message handling: ERROR');
  }

  // Print final results
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Module is ready for integration.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
  }

  return {
    total: totalTests,
    passed: passedTests,
    failed: totalTests - passedTests,
    successRate: Math.round((passedTests / totalTests) * 100)
  };
}

/**
 * Validate ticket detection result
 */
function validateTicketResult(result, expected) {
  if (result.isTicket !== expected.isTicket) {
    return false;
  }

  if (!expected.isTicket) {
    return true; // If we expect no ticket and got no ticket, that's correct
  }

  // Validate ticket data
  if (!result.ticketData) {
    return false;
  }

  if (expected.priority && result.ticketData.priority !== expected.priority) {
    return false;
  }

  if (expected.category && result.ticketData.category !== expected.category) {
    return false;
  }

  return true;
}

/**
 * Validate status update result
 */
function validateStatusUpdateResult(result, expected) {
  if (result.isUpdate !== expected.isUpdate) {
    return false;
  }

  if (!expected.isUpdate) {
    return true;
  }

  if (expected.newStatus && result.newStatus !== expected.newStatus) {
    return false;
  }

  if (expected.ticketId && result.ticketId !== expected.ticketId) {
    return false;
  }

  return true;
}

// Export for external use
module.exports = {
  runAllTests,
  testScenarios,
  statusUpdateScenarios,
  followUpScenarios
};

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}