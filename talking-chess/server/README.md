# Chess AI Mentor Server

This is the backend server for the Talking Chess AI mentor system, implementing a deterministic translator model architecture for reliable chess guidance.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Analyzer Modules](#analyzer-modules)
- [Development](#development)
- [Debugging](#debugging)

## Overview

The Chess AI Mentor Server provides deterministic chess analysis through a revolutionary translator model approach:

- **Deterministic Analysis**: All chess facts computed using chess.js library
- **Zero Hallucination**: AI cannot calculate moves or tactics
- **Translation Only**: LLM converts computed facts to natural language
- **Educational Focus**: Socratic method with strategic questions

## Architecture

```
Client Request → Input Validation → Analyzer Pipeline → Context Builder → OpenAI Translation → Response
```

### Core Components

```
server/
├── index.js                    # Express server entry point
├── config.js                   # Server configuration
├── routes/
│   └── chat.js                 # Chess mentor API endpoints
├── analyzers/                  # Deterministic chess analysis modules
│   ├── boardRadar.js          # Piece position verification
│   ├── safetyCheck.js         # Threat detection and safety analysis  
│   └── moveReasoning.js       # Strategic move analysis
├── modules/
│   ├── contextBuilder.js      # Template variable integration
│   └── personaInjector.js     # AI persona management
├── services/
│   └── openai.js              # OpenAI API integration
└── prompts/
    └── irina-system-prompt.md # AI mentor system prompt
```

## Installation

### Prerequisites
- Node.js 18+
- OpenAI API key

### Setup
```bash
# Install dependencies
cd server
npm install

# Configure environment
echo "OPENAI_API_KEY=sk-proj-your-api-key-here" >> ../.env
echo "OPENAI_MODEL=gpt-4o-mini" >> ../.env
echo "PORT=3000" >> ../.env

# Start server
node index.js
```

### Verify Installation
```bash
# Health check
curl http://localhost:3000/api/health

# Test analysis
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "legalMoves": [{"from":"e2","to":"e4","san":"e4","piece":"p"}],
    "userMessage": "What should I do?",
    "userElo": 1500,
    "personaName": "Irina"
  }'
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for language model |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model to use |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |

### Chess Analysis Configuration

```javascript
// In contextBuilder.js
const CONFIG = {
  MAX_TOP_MOVES: 8,           // Maximum moves to analyze
  POSITION_VALIDATION: true,  // Enable position validation
  LOGGING_ENABLED: true,      // Enable detailed logging
  TIMEOUT_MS: 10000          // API timeout
};
```

## API Endpoints

### POST /api/chat

Primary chess mentor endpoint. Processes positions through deterministic analyzers.

**Request**:
```json
{
  "fen": "string (required)",
  "legalMoves": "array (required)", 
  "userMessage": "string (required)",
  "userElo": "number (required)",
  "personaName": "string (required)",
  "chatHistory": "array (optional)",
  "engineEval": "object (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Natural language chess guidance",
  "processingTimeMs": 2500
}
```

### GET /api/health

Server health check with analyzer status.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "analyzers": {
    "boardRadar": "functional",
    "safetyCheck": "functional",
    "moveReasoning": "functional"
  },
  "openai": "connected"
}
```

## Analyzer Modules

### boardRadar.js - Position Verification

**Purpose**: Provides exact piece positions for verification against visual board

```javascript
const { getBoardRadar } = require('./analyzers/boardRadar');

// Example usage
const result = getBoardRadar('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
console.log(result);
// Output: "[a1: White Rook] [a2: White Pawn] [a7: Black Pawn] ..."
```

**Key Functions**:
- `getBoardRadar(fen)`: Returns formatted string of occupied squares
- `getPieceCounts(fen)`: Returns piece count summary for validation

### safetyCheck.js - Threat Detection

**Purpose**: Identifies hanging pieces, checks, and immediate threats

```javascript
const { Chess } = require('chess.js');
const { getSafetyStatus } = require('./analyzers/safetyCheck');

// Example usage
const chess = new Chess('fen-string');
const result = getSafetyStatus(chess);
console.log(result);
// Output: "Position is safe" or "🚨 White is in CHECK!"
```

**Detection Features**:
- Check/checkmate/stalemate detection
- Hanging piece analysis (attacked but undefended)
- Immediate capture opportunities
- Draw condition identification

### moveReasoning.js - Strategic Analysis

**Purpose**: Maps legal moves to strategic chess principles

```javascript
const { Chess } = require('chess.js');
const { getStrategicAnalysis } = require('./analyzers/moveReasoning');

// Example usage
const chess = new Chess();
const topMoves = ['e4', 'Nf3', 'd4'];
const result = getStrategicAnalysis(chess, topMoves);
console.log(result);
// Output: "**e4**: Claims center space | **Nf3**: Develops piece, Controls center"
```

**Analysis Categories**:
- Piece development from back rank
- Center control (d4, d5, e4, e5)
- Captures and tactical elements
- Castling for king safety
- Pawn structure advancement

## Development

### Adding New Analyzers

1. **Create analyzer file** (`analyzers/myAnalyzer.js`):
```javascript
const { Chess } = require('chess.js');

function getMyAnalysis(chess) {
  if (!chess || typeof chess.moves !== 'function') {
    return '[MY_ANALYSIS_ERROR: Invalid chess instance]';
  }
  
  try {
    // Your analysis logic using chess.js methods
    return 'Your analysis result';
  } catch (error) {
    return `[MY_ANALYSIS_ERROR: ${error.message}]`;
  }
}

module.exports = { getMyAnalysis };
```

2. **Integrate in contextBuilder.js**:
```javascript
const { getMyAnalysis } = require('../analyzers/myAnalyzer');

// In buildPromptContext function
const myAnalysis = getMyAnalysis(chess);
templateVariables.MY_ANALYSIS = myAnalysis;
```

3. **Update system prompt template** with new variable.

### Testing Analyzers

```bash
# Test individual analyzer
node -e "
const { getBoardRadar } = require('./analyzers/boardRadar');
console.log(getBoardRadar('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
"

# Test complete pipeline
curl -X POST http://localhost:3000/api/chat -d @test-data.json
```

### Code Quality Requirements

- **Error Handling**: All functions must return error strings, never throw
- **Pure Functions**: Analyzers must be deterministic and side-effect-free
- **Chess.js Only**: No chess logic outside chess.js library
- **JSDoc Comments**: All public functions must be documented
- **Logging**: Use deterministic logging prefixes for debugging

## Debugging

### Enable Debug Logging

```bash
# Start with debug output
DEBUG=chess:* node index.js

# Or set environment variable
export DEBUG=chess:*
node index.js
```

### Log Interpretation

**Deterministic Analysis Logs**:
```
🔬 [DETERMINISTIC] Creating Chess instance from FEN: rnbqkbnr/pppppppp...
✅ [DETERMINISTIC] Analysis completed successfully
📡 Board Reality: [a1: White Rook] [a2: White Pawn] ...
🛡️ Safety Alert: Position is safe - no immediate tactical threats
🎯 Strategic Analysis: **e4**: Claims center space | **Nf3**: Develops piece
```

**Context Building Logs**:
```
🚨 [BACKEND] CONTEXT BUILDER OUTPUT:
📍 Game context after formatting: { fen: '...', legalMoves: 20, ... }
🔍 COMPLETE SYSTEM PROMPT BEING SENT TO AI:
[Full prompt with populated template variables]
```

### Common Issues

**Position Validation Failures**:
```
❌ POSITION VALIDATION FAILED: ['Suspicious knight moves in opening: Na3']
```
*Solution*: Check legal moves consistency between frontend and backend

**Analyzer Errors**:
```
[BOARD_RADAR_ERROR: Invalid FEN]
```
*Solution*: Verify FEN format and chess.js compatibility

**OpenAI API Issues**:
```
OpenAI API error: Invalid API key or quota exceeded
```
*Solution*: Check API key and usage quotas

### Performance Monitoring

```bash
# Monitor response times
curl -w "@curl-format.txt" -X POST http://localhost:3000/api/chat -d @test.json

# Where curl-format.txt contains:
#     time_namelookup:  %{time_namelookup}\n
#        time_connect:  %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#    time_pretransfer:  %{time_pretransfer}\n
#       time_redirect:  %{time_redirect}\n
#  time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n
```

### Development Workflow

1. **Local Testing**:
```bash
# Terminal 1: Start server with logging
DEBUG=chess:* node index.js

# Terminal 2: Test specific positions
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{
  "fen": "test-position-fen",
  "legalMoves": [],
  "userMessage": "test question", 
  "userElo": 1500,
  "personaName": "Irina"
}'
```

2. **Integration Testing**:
```bash
# Start both frontend and backend
npm start                    # Frontend on :3333
cd server && node index.js  # Backend on :3000

# Test complete pipeline
# 1. Open http://localhost:3333
# 2. Make moves on chess board
# 3. Open chat and ask questions
# 4. Verify logs in both terminals
```

3. **Production Deployment**:
```bash
# Set production environment
export NODE_ENV=production
export OPENAI_API_KEY=your-production-key

# Start with process manager
pm2 start index.js --name chess-mentor-api

# Monitor logs
pm2 logs chess-mentor-api
```

## File Structure Reference

```
server/
├── index.js                    # Express app with CORS and middleware
├── config.js                   # Environment configuration
├── routes/
│   └── chat.js                 # /api/chat endpoint with validation
├── analyzers/                  # Deterministic chess analysis
│   ├── boardRadar.js          # Position verification: getBoardRadar()
│   ├── safetyCheck.js         # Threat detection: getSafetyStatus()  
│   └── moveReasoning.js       # Strategic analysis: getStrategicAnalysis()
├── modules/
│   ├── contextBuilder.js      # Template integration: buildPromptContext()
│   └── personaInjector.js     # AI persona: injectPersona()
├── services/
│   └── openai.js              # OpenAI API: callOpenAI()
├── package.json               # Dependencies: express, chess.js, openai
└── README.md                  # This file
```

This server implements a production-ready deterministic chess analysis API that eliminates AI hallucination through computed facts and constrained language generation.