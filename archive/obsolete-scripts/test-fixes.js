#!/usr/bin/env node
require('dotenv').config({ override: true });

const messageSearchService = require('../src/services/messageSearch');
const SimplifiedPaiAssistant = require('../src/assistants/pai-assistant-simplified');

async function testFixes() {
  console.log('🔧 Testing PAI Assistant Fixes\n');

  // Test 1: Contact name search (previously broken)
  console.log('1. Testing contact name search (previously crashed)...');
  try {
    const result = await messageSearchService.searchMessages({
      start_date: 'today',
      end_date: 'today',
      sender: 'Isabel Sofia',
      limit: 5,
    });
    
    if (result.success) {
      console.log('   ✅ Contact search works! Found:', result.metadata.totalMessages, 'messages');
    } else {
      console.log('   ❌ Contact search failed:', result.error);
    }
  } catch (error) {
    console.log('   ❌ Contact search crashed:', error.message);
  }

  // Test 2: Relative date parsing
  console.log('\n2. Testing relative date parsing...');
  try {
    const testDates = ['2 days ago', '1 week ago', 'yesterday', 'today'];
    
    for (const date of testDates) {
      const result = await messageSearchService.searchMessages({
        start_date: date,
        end_date: date,
        limit: 1,
      });
      
      console.log(`   "${date}" → ${result.success ? '✅' : '❌'} (${result.success ? result.metadata.totalMessages : result.error})`);
    }
  } catch (error) {
    console.log('   ❌ Date parsing failed:', error.message);
  }

  // Test 3: Date validation
  console.log('\n3. Testing date validation...');
  try {
    // Test invalid range
    const invalidResult = await messageSearchService.searchMessages({
      start_date: 'today',
      end_date: 'yesterday', // Invalid: start > end
      limit: 5,
    });
    
    if (!invalidResult.success && invalidResult.error.includes('Invalid date range')) {
      console.log('   ✅ Date range validation works');
    } else {
      console.log('   ❌ Date range validation failed');
    }
  } catch (error) {
    console.log('   ❌ Date validation test failed:', error.message);
  }

  // Test 4: AI Function Definition
  console.log('\n4. Testing AI function definition...');
  try {
    const assistant = new SimplifiedPaiAssistant();
    const functionDef = assistant.getFunctionDefinition();
    
    const hasRelativeExamples = functionDef.parameters.properties.start_date.description.includes('2 days ago');
    const hasYearWarning = functionDef.parameters.properties.start_date.description.includes('2025');
    const hasFreshSearch = functionDef.parameters.properties.fresh_search !== undefined;
    
    console.log('   ✅ Relative date examples:', hasRelativeExamples ? '✅' : '❌');
    console.log('   ✅ Year validation warning:', hasYearWarning ? '✅' : '❌');
    console.log('   ✅ Fresh search parameter:', hasFreshSearch ? '✅' : '❌');
  } catch (error) {
    console.log('   ❌ Function definition test failed:', error.message);
  }

  console.log('\n🎉 Fix testing completed! Try the CLI with:');
  console.log('   node pai-assistant-cli.js');
  console.log('\n   Test queries:');
  console.log('   - "messages from Isabel Sofia today"');
  console.log('   - "messages from 2 days ago"');
  console.log('   - "show me messages from last week"');
}

testFixes().catch(console.error);