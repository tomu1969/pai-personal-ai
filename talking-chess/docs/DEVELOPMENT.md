# Development Guide - Talking Chess AI Mentor

This guide covers development practices, testing procedures, and debugging techniques for the Talking Chess deterministic AI mentor system.

## Table of Contents
- [Development Environment Setup](#development-environment-setup)
- [Testing the Deterministic Analyzers](#testing-the-deterministic-analyzers)
- [Adding New Analyzers](#adding-new-analyzers)
- [Debugging the Translation Pipeline](#debugging-the-translation-pipeline)
- [Console Log Interpretation](#console-log-interpretation)
- [Common Development Tasks](#common-development-tasks)
- [Code Quality Standards](#code-quality-standards)

## Development Environment Setup

### Prerequisites
- Node.js 18+ for backend server
- Modern browser with Canvas support
- OpenAI API key for AI mentor functionality

### Environment Configuration
```bash
# Create .env file in project root
echo "OPENAI_API_KEY=sk-proj-your-actual-api-key-here" >> .env
```

### Development Servers
```bash
# Terminal 1: Frontend server
npm start
# Runs on http://localhost:3333

# Terminal 2: Backend API server  
cd server && node index.js
# Runs on http://localhost:3000
```

### Verify Setup
1. Open http://localhost:3333
2. Make a chess move
3. Open chat interface
4. Ask "What should I do here?"
5. Check browser console for deterministic analysis logs

## Testing the Deterministic Analyzers

### Unit Testing Individual Analyzers

**Test boardRadar.js:**
```javascript
const { getBoardRadar } = require('./server/analyzers/boardRadar');

// Starting position test
const startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const result = getBoardRadar(startingFEN);
console.log(result);
// Expected: "[a1: White Rook] [a2: White Pawn] [a7: Black Pawn] [a8: Black Rook] ..."

// Test error handling
console.log(getBoardRadar("invalid-fen"));
// Expected: "[BOARD_RADAR_ERROR: Invalid FEN]"
```

**Test safetyCheck.js:**
```javascript
const { Chess } = require('chess.js');
const { getSafetyStatus } = require('./server/analyzers/safetyCheck');

// Test safe position
const chess1 = new Chess();
console.log(getSafetyStatus(chess1));
// Expected: "Position is safe - no immediate tactical threats detected."

// Test check position
const chess2 = new Chess("rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 3 3");
chess2.move('Qh4'); // Check position
console.log(getSafetyStatus(chess2));
// Expected: "=¨ White is in CHECK!"
```

**Test moveReasoning.js:**
```javascript
const { Chess } = require('chess.js');
const { getStrategicAnalysis } = require('./server/analyzers/moveReasoning');

const chess = new Chess();
const topMoves = ['e4', 'Nf3', 'd4'];
const analysis = getStrategicAnalysis(chess, topMoves);
console.log(analysis);
// Expected: "**e4**: Claims center space, Advances pawn structure | **Nf3**: Develops piece from back rank, Controls center squares | **d4**: Claims center space, Advances pawn structure"
```

### Integration Testing

**Test Complete Analysis Pipeline:**
```javascript
const { buildPromptContext } = require('./server/modules/contextBuilder');

const gameContext = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  legalMoves: [
    {san: 'e4', from: 'e2', to: 'e4'},
    {san: 'Nf3', from: 'g1', to: 'f3'},
    {san: 'd4', from: 'd2', to: 'd4'}
  ],
  userElo: 1500,
  personaName: "Irina"
};

const result = buildPromptContext(gameContext);
console.log('Template Variables:', result.templateVariables);
// Verify all required variables are populated
```

### Position-Specific Testing

**Test Tactical Positions:**
```javascript
// Test hanging piece detection
const hangingPieceFEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3";
const chess = new Chess(hangingPieceFEN);
// Move bishop to undefended square
chess.move('Bxf7+');
const safetyStatus = getSafetyStatus(chess);
console.log(safetyStatus); // Should detect hanging bishop
```

**Test Opening Positions:**
```javascript
// Test development analysis
const openingFEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const chess = new Chess(openingFEN);
const topMoves = chess.moves({ verbose: true }).slice(0, 5).map(m => m.san);
const analysis = getStrategicAnalysis(chess, topMoves);
console.log(analysis); // Should show development priorities
```

## Adding New Analyzers

### Creating a New Analyzer Module

1. **Create analyzer file** (`server/analyzers/myAnalyzer.js`):
```javascript
/**
 * My Custom Analyzer - Deterministic Chess Analysis
 * Provides [specific analysis type]
 */

const { Chess } = require('chess.js');

/**
 * Analyze position for [specific purpose]
 * @param {Chess} chess - Chess.js instance with current position
 * @returns {string} - Formatted analysis result
 */
function getMyAnalysis(chess) {
  if (!chess || typeof chess.moves !== 'function') {
    return '[MY_ANALYSIS_ERROR: Invalid chess instance]';
  }

  try {
    // Your analysis logic here
    const result = performAnalysis(chess);
    return result;
  } catch (error) {
    return `[MY_ANALYSIS_ERROR: ${error.message}]`;
  }
}

function performAnalysis(chess) {
  // Implement your chess analysis using chess.js methods
  // Examples:
  // - chess.board() for piece positions
  // - chess.moves() for legal moves  
  // - chess.inCheck() for check status
  // - chess.isAttacked() for square control
  
  return "Your analysis result";
}

module.exports = {
  getMyAnalysis
};
```

2. **Integrate with contextBuilder.js**:
```javascript
const { getMyAnalysis } = require('../analyzers/myAnalyzer');

// Add to buildPromptContext function
const myAnalysis = getMyAnalysis(chess);
templateVariables.MY_ANALYSIS = myAnalysis;
```

3. **Update prompt template** (`prompts/irina-system-prompt.md`):
```markdown
### = MY CUSTOM ANALYSIS (Engine Computed)
{{MY_ANALYSIS}}
```

### Best Practices for Analyzers

- **Single Responsibility**: Each analyzer should focus on one type of analysis
- **Error Handling**: Always return error strings, never throw exceptions
- **Pure Functions**: No side effects, same input = same output
- **Chess.js Only**: Use only chess.js library for chess logic
- **Descriptive Output**: Return human-readable strings suitable for LLM consumption

## Debugging the Translation Pipeline

### Debugging Workflow

1. **Check Frontend Data Capture**:
```javascript
// In browser console, look for these logs:
// =, [DETERMINISTIC] Capturing game state for reasoning engine...
// =á [DETERMINISTIC] Position facts captured for analysis:

// Verify FEN matches visual board
// Confirm legal moves are correct
```

2. **Check Backend Analysis**:
```javascript
// In server console, look for:
// =, [DETERMINISTIC] Creating Chess instance from FEN: ...
//  [DETERMINISTIC] Analysis completed successfully
// =á Board Reality: [a1: White Rook] ...

// Verify all analyzer outputs are present
```

3. **Check LLM Response**:
```javascript
// In browser console, look for:
// ( [TRANSLATOR MODEL] LLM Response received:
// " Translation Complete: Deterministic facts ’ Natural language

// Verify response contains only moves from STRATEGIC_ANALYSIS
```

### Common Debugging Commands

**Test specific position:**
```bash
# In Node.js REPL
node
> const { Chess } = require('chess.js')
> const chess = new Chess('your-fen-here')
> chess.moves()  // Check legal moves
> chess.board()  // Check piece positions
```

**Test analyzer with curl:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "userMessage": "test",
    "userElo": 1500,
    "personaName": "Irina",
    "legalMoves": []
  }'
```

### Position Validation Issues

**FEN Mismatch Detection:**
```javascript
// Backend logs will show:
// = Position validation result: {
//   isConsistent: false,
//   issues: ['Suspicious knight moves in opening: Na3'],
//   warnings: []
// }

// This indicates frontend/backend position desync
```

**Fix Approach:**
1. Check game state capture in `game-state-capture.js`
2. Verify legal moves extraction
3. Ensure FEN string consistency

## Console Log Interpretation

### Frontend Logs

**Deterministic Data Capture:**
```
=, [DETERMINISTIC] Capturing game state for reasoning engine...
=á [DETERMINISTIC] Position facts captured for analysis:
   " FEN Position: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
   " Current Turn: White to move
   " In Check:  No
   " Game Status: Active
   " Move Count: 0
```

**Data Flow to Backend:**
```
=, [TRANSLATOR MODEL] Raw data being sent to reasoning engine:
PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
=á FEN Position: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
=á Legal Moves (for moveReasoning analyzer): e4, e3, Nf3, Nc3, d4, d3, ...
=á Move Count: 20
=á User ELO: 1650
=á User Message: What should I do here?
PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
<¯ This data will be processed by deterministic analyzers:
   " boardRadar.js ’ BOARD_REALITY facts
   " safetyCheck.js ’ SAFETY_ALERT warnings
   " moveReasoning.js ’ STRATEGIC_ANALYSIS of legal moves
= Analyzers will compute chess facts ’ LLM translates to natural language
```

### Backend Logs

**Analysis Processing:**
```
=, [DETERMINISTIC] Creating Chess instance from FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
 [DETERMINISTIC] Analysis completed successfully
=á Board Reality: [a1: White Rook] [a2: White Pawn] [a7: Black Pawn] [a8: Black Rook] ...
=á Safety Alert: Position is safe - no immediate tactical threats detected.
<¯ Strategic Analysis: **e4**: Claims center space, Advances pawn structure | **Nf3**: Develops piece from back rank, Controls center squares
```

**LLM Integration:**
```
=¨ [BACKEND] CONTEXT BUILDER OUTPUT:
PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
= COMPLETE SYSTEM PROMPT BEING SENT TO AI:
[Full prompt with populated template variables]
PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
Chat response generated in 2918ms
```

## Common Development Tasks

### Adding a New Chess Rule

1. **Implement in analyzer** (e.g., en passant detection):
```javascript
// In moveReasoning.js
function analyzeSingleMove(chess, moveStr) {
  // ... existing analysis
  
  // Check for en passant
  if (moveData.flags && moveData.flags.includes('e')) {
    reasons.push('En passant capture');
  }
  
  return reasons.join(', ');
}
```

2. **Test the implementation**:
```javascript
// Create position with en passant opportunity
const chess = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
const analysis = getStrategicAnalysis(chess, ['exf6']);
// Should show "En passant capture" in output
```

### Modifying LLM Behavior

1. **Update system prompt** (`prompts/irina-system-prompt.md`)
2. **Add new template variables** in `contextBuilder.js`
3. **Test with various positions** to ensure consistency

### Adding Position Validation

1. **Create validation function**:
```javascript
function validatePosition(gameContext) {
  const issues = [];
  
  // Your validation logic
  if (suspiciousCondition) {
    issues.push('Description of issue');
  }
  
  return { isConsistent: issues.length === 0, issues };
}
```

2. **Integrate in chat route** (`server/routes/chat.js`)

## Code Quality Standards

### Mandatory Requirements

1. **Error Handling**: All functions must handle invalid inputs gracefully
2. **Logging**: Use deterministic logging prefixes (`=, [DETERMINISTIC]`)
3. **Documentation**: JSDoc comments for all public functions
4. **Chess.js Only**: No chess logic outside of chess.js library
5. **Pure Functions**: Analyzers must be deterministic and side-effect-free

### Code Style

```javascript
/**
 * Description of what this function does
 * @param {Type} param - Parameter description
 * @returns {Type} - Return value description
 */
function analyzerFunction(param) {
  // Input validation
  if (!param || typeof param !== 'expected-type') {
    return '[ANALYZER_ERROR: Invalid input]';
  }
  
  try {
    // Core logic
    const result = processInput(param);
    return result;
  } catch (error) {
    return `[ANALYZER_ERROR: ${error.message}]`;
  }
}
```

### Testing Requirements

- **Unit tests** for all analyzer functions
- **Integration tests** for complete pipeline
- **Position-specific tests** for tactical/strategic scenarios
- **Error handling tests** for invalid inputs

### Review Checklist

Before submitting changes:
- [ ] All analyzers return error strings, never throw
- [ ] Console logs use proper deterministic prefixes
- [ ] JSDoc comments added for public functions
- [ ] Manual testing with multiple chess positions
- [ ] No chess calculation in non-analyzer modules
- [ ] Template variables properly integrated in prompt

This development guide ensures consistent, reliable implementation of the deterministic translator architecture while maintaining code quality and debugging capabilities.