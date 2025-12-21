/**
 * Test script for Stockfish engine integration
 * Run with: node server/test-engine.js
 */

const { analyzePosition, shutdownEngine } = require('./analyzers/engine');
const { getStrategicAnalysis, formatStrategicAnalysis } = require('./analyzers/moveReasoning');

// Test position - starting position
const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Test position - tactical position where Bxa6 is a trap (from the original issue)
const trapFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

async function runTest() {
  console.log('=== Stockfish Engine Integration Test ===\n');

  try {
    // Test 1: Basic engine analysis
    console.log('Test 1: Starting position analysis');
    console.log('FEN:', startingFen);
    console.log('Analyzing with depth 12, multiPv 3...\n');

    const result1 = await analyzePosition(startingFen, { depth: 12, multiPv: 3 });
    console.log('Engine result:', JSON.stringify(result1, null, 2));
    console.log('');

    // Test 2: Full strategic analysis pipeline
    console.log('Test 2: Full strategic analysis pipeline');
    console.log('FEN:', startingFen);
    const analysis1 = await getStrategicAnalysis(startingFen, { depth: 12, multiPv: 3 });
    console.log('Strategic analysis:', JSON.stringify(analysis1, null, 2));
    console.log('');
    console.log('Formatted for prompt:');
    console.log(formatStrategicAnalysis(analysis1));
    console.log('');

    // Test 3: Tactical position
    console.log('Test 3: Tactical position (Italian Game)');
    console.log('FEN:', trapFen);
    const analysis2 = await getStrategicAnalysis(trapFen, { depth: 14, multiPv: 3 });
    console.log('Formatted analysis:');
    console.log(formatStrategicAnalysis(analysis2));
    console.log('');

    console.log('=== All tests passed! ===');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    shutdownEngine();
    process.exit(0);
  }
}

runTest();
