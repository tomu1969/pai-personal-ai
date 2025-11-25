/**
 * Test Script for Prompt Loading and Variable Substitution
 * Validates that the external prompt system works correctly
 */

const { loadPromptTemplate, fillPromptTemplate, loadAndFillPrompt, validatePromptVariables } = require('./modules/promptLoader');

console.log('🧪 Testing Prompt Loading and Variable Substitution');
console.log('====================================================\n');

/**
 * Test 1: Load raw prompt template
 */
console.log('Test 1: Loading raw prompt template');
try {
  const rawTemplate = loadPromptTemplate('irina-system-prompt');
  console.log('✅ Template loaded successfully');
  console.log(`📊 Template length: ${rawTemplate.length} characters`);
  console.log(`🔍 Contains {{personaName}}: ${rawTemplate.includes('{{personaName}}')}}`);
  console.log(`🔍 Contains {{userElo}}: ${rawTemplate.includes('{{userElo}}')}}`);
} catch (error) {
  console.error('❌ Failed to load template:', error.message);
  process.exit(1);
}

/**
 * Test 2: Variable substitution
 */
console.log('\nTest 2: Variable substitution');
try {
  const template = '{{personaName}} is coaching a player with ELO {{userElo}}. {{adviceLevel}}';
  const variables = {
    personaName: 'Irina',
    userElo: 1600,
    adviceLevel: 'Focus on positional concepts.'
  };
  
  const filled = fillPromptTemplate(template, variables);
  const expected = 'Irina is coaching a player with ELO 1600. Focus on positional concepts.';
  
  if (filled === expected) {
    console.log('✅ Variable substitution works correctly');
  } else {
    console.log('❌ Variable substitution failed');
    console.log('Expected:', expected);
    console.log('Got:', filled);
  }
} catch (error) {
  console.error('❌ Variable substitution error:', error.message);
}

/**
 * Test 3: Top 3 moves extraction and ranking function
 */
console.log('\nTest 3: Top 3 moves extraction and ranking function');
try {
  const { extractTop3Moves } = require('./modules/contextBuilder');
  
  // Test with realistic chess moves and engine evaluation
  const realisticMoves = [
    { san: 'Qxc2#' }, { san: 'Qe3+' }, { san: 'Qd2+' },
    { san: 'Bxa2' }, { san: 'Nd5' }, { san: 'Rf7' }, 
    { san: 'a6' }, { san: 'b5' }, { san: 'g6' }
  ];
  const engineEval = { score: -2.5, bestMove: 'Qxc2#' };
  
  const result1 = extractTop3Moves(realisticMoves, engineEval);
  console.log('✅ Complex position ranking:', result1);
  console.log(`   Top 3: ${result1.top3Moves}`);
  console.log(`   Best: ${result1.bestMove}`);
  
  // Test with simple opening moves
  const openingMoves = [{ san: 'e4' }, { san: 'd4' }, { san: 'Nf3' }, { san: 'c4' }];
  const openingEngine = { bestMove: 'e4' };
  
  const result2 = extractTop3Moves(openingMoves, openingEngine);
  console.log('✅ Opening moves ranking:', result2);
  
  // Test with only 2 moves
  const fewMoves = [{ san: 'Kf7' }, { san: 'Rf7' }];
  const result3 = extractTop3Moves(fewMoves, {});
  console.log('✅ Few moves handled correctly:', result3);
  
  // Test with empty array
  const result4 = extractTop3Moves([], {});
  console.log('✅ Empty moves handled correctly:', result4);
  
} catch (error) {
  console.error('❌ Top 3 moves extraction test failed:', error.message);
}

/**
 * Test 4: Complete prompt generation with realistic data
 */
console.log('\nTest 4: Complete prompt generation with realistic chess data');
try {
  const testVariables = {
    personaName: 'Irina',
    userElo: 1600,
    adviceLevel: 'Focus on positional concepts, piece coordination, and tactical patterns.',
    TOP_3_MOVES: 'Nf3, Be2, Bc4',
    chatHistory: '',
    BEST_MOVE: 'Nf3',
    positionDescription: `📋 CURRENT BOARD POSITION:
🤍 White pieces: Pawns on a2, b2, c2, e4, f2, g2, h2; king on e1, queen on d1, rook on a1, knight on b1
⚫ Black pieces: Pawns on a7, b7, c7, d6, e5, f7, g7, h7; king on e8, queen on d8

🚫 BLOCKED SQUARES (occupied by pieces):
a1, a2, a7, b1, b2, b7, c2, c7, d1, d6, d8, e1, e4, e5, e8, f2, f7, g2, g7, h2, h7`,
    engineEvaluation: 'Engine Evaluation: +0.3',
    engineRecommendation: '🎯 Engine Recommends: Nf3',
    lastMove: '📝 Last Move: e4',
    fen: 'rnbqkbnr/ppp1pppp/3p4/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  };
  
  const fullPrompt = loadAndFillPrompt('irina-system-prompt', testVariables);
  
  console.log('✅ Complete prompt generated successfully');
  console.log(`📊 Prompt length: ${fullPrompt.length} characters`);
  
  // Verify critical elements are present
  const checks = [
    { name: 'Contains persona name', test: fullPrompt.includes('Irina') },
    { name: 'Contains ELO', test: fullPrompt.includes('1600') },
    { name: 'Contains top 3 moves in boundary', test: fullPrompt.includes('[LEGAL_MOVES_START]') },
    { name: 'Contains top 3 moves', test: fullPrompt.includes('Nf3, Be2, Bc4') },
    { name: 'Contains best move indicator', test: fullPrompt.includes('ENGINE\'S STRONGEST CHOICE') },
    { name: 'Contains boundary markers end', test: fullPrompt.includes('[LEGAL_MOVES_END]') },
    { name: 'Contains engine evaluation', test: fullPrompt.includes('+0.3') },
    { name: 'Contains FEN', test: fullPrompt.includes('rnbqkbnr') },
    { name: 'Contains data constraints', test: fullPrompt.includes('DATA CONSTRAINTS') },
    { name: 'Contains strategic presentation rule', test: fullPrompt.includes('top-ranked options') }
  ];
  
  checks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
  });
  
} catch (error) {
  console.error('❌ Complete prompt generation failed:', error.message);
}

/**
 * Test 5: Template validation
 */
console.log('\nTest 5: Template validation');
try {
  const template = loadPromptTemplate('irina-system-prompt');
  const testVars = {
    personaName: 'Irina',
    userElo: 1500,
    adviceLevel: 'Test advice',
    LEGAL_MOVES_LIST: 'e4, d4, Nf3'
  };
  
  const validation = validatePromptVariables(template, testVars);
  
  console.log('✅ Template validation completed');
  console.log(`📊 Required variables: ${validation.requiredVariables.length}`);
  console.log(`🔍 Required: ${validation.requiredVariables.join(', ')}`);
  console.log(`⚠️  Missing: ${validation.missingVariables.length > 0 ? validation.missingVariables.join(', ') : 'None'}`);
  
  if (validation.missingVariables.length > 0) {
    console.log('❌ Template has missing variables that need to be provided');
  }
  
} catch (error) {
  console.error('❌ Template validation failed:', error.message);
}

/**
 * Test 6: Integration test with contextBuilder
 */
console.log('\nTest 6: Integration test with contextBuilder');
try {
  const { buildPromptContext } = require('./modules/contextBuilder');
  
  const testGameContext = {
    fen: 'rnbqkbnr/ppp1pppp/3p4/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    userElo: 1600,
    personaName: 'Irina',
    legalMoves: [
      { san: 'Nf3' },
      { san: 'd3' },
      { san: 'Be2' },
      { san: 'Bc4' }
    ],
    engineEval: {
      score: 0.3,
      bestMove: 'Nf3'
    },
    lastMove: 'e4',
    userMessage: 'What should I play next?'
  };
  
  const result = buildPromptContext(testGameContext);
  
  console.log('✅ Integration test completed successfully');
  console.log(`📊 System prompt length: ${result.systemPrompt.length} characters`);
  console.log(`📝 User message: "${result.userMessage}"`);
  
  // Verify integration worked
  const integrationChecks = [
    { name: 'System prompt generated', test: result.systemPrompt && result.systemPrompt.length > 0 },
    { name: 'User message preserved', test: result.userMessage === testGameContext.userMessage },
    { name: 'Top 3 moves in boundary markers', test: result.systemPrompt.includes('[LEGAL_MOVES_START]') },
    { name: 'Top 3 moves properly ranked', test: result.systemPrompt.includes('Nf3, Be2, Bc4') },
    { name: 'Best move properly identified', test: result.systemPrompt.includes('ENGINE\'S STRONGEST CHOICE') },
    { name: 'Boundary markers closed', test: result.systemPrompt.includes('[LEGAL_MOVES_END]') },
    { name: 'External prompt loaded', test: result.systemPrompt.includes('top-ranked options') }
  ];
  
  integrationChecks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
  });
  
} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  console.error('Error details:', error.stack);
}

console.log('\n🎉 Prompt loading tests completed!');
console.log('\nTo run this test:');
console.log('cd /Users/tomas/Desktop/ai_pbx/talking-chess/server && node test-prompt-loading.js');