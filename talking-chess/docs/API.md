# API Documentation - Talking Chess AI Mentor

This document describes the backend API endpoints for the Talking Chess AI mentor system, including request/response formats, template variables, and error handling.

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Data Formats](#data-formats)
- [Template Variables](#template-variables)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

The Talking Chess AI mentor API provides deterministic chess analysis through a translation model architecture. The API receives chess positions and user questions, processes them through deterministic analyzers, and returns natural language responses.

**Base URL**: `http://localhost:3000`
**Content-Type**: `application/json`

## Authentication

The API uses OpenAI API key for language model integration. Configure in environment:

```bash
OPENAI_API_KEY=sk-proj-your-api-key-here
```

No authentication required for API endpoints (development environment).

## Endpoints

### POST /api/chat

Primary endpoint for chess mentor interactions. Processes chess positions through deterministic analyzers and returns natural language guidance.

#### Request Format

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "pgn": "1. e4 e5 2. Nf3",
  "legalMoves": [
    {
      "from": "e2",
      "to": "e4", 
      "san": "e4",
      "piece": "p",
      "captured": null,
      "promotion": null
    }
  ],
  "userMessage": "What should I do here?",
  "userElo": 1650,
  "personaName": "Irina",
  "engineEval": {
    "score": null,
    "bestMove": null,
    "depth": 0,
    "mate": null
  },
  "chatHistory": [
    {
      "role": "user",
      "content": "How should I develop my pieces?"
    },
    {
      "role": "assistant", 
      "content": "Focus on controlling the center first..."
    }
  ],
  "lastMove": "e4"
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fen` | string | Yes | FEN notation of current position |
| `pgn` | string | No | PGN of current game |
| `legalMoves` | array | Yes | Legal moves in verbose format from chess.js |
| `userMessage` | string | Yes | User's question or comment |
| `userElo` | number | Yes | User's ELO rating (800-3000) |
| `personaName` | string | Yes | AI mentor name (typically "Irina") |
| `engineEval` | object | No | Stockfish evaluation if available |
| `chatHistory` | array | No | Recent conversation history |
| `lastMove` | string | No | Last move made in algebraic notation |

#### Response Format

**Success (200)**:
```json
{
  "success": true,
  "message": "Consider **Nf3** to bring your knight into active play while taking control of important central squares. What aspect of piece development interests you most?",
  "processingTimeMs": 2918
}
```

**Error (400/500)**:
```json
{
  "success": false,
  "error": "Invalid FEN format",
  "details": "FEN must have 6 parts separated by spaces"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether request was successful |
| `message` | string | Natural language response from AI mentor |
| `processingTimeMs` | number | Total processing time in milliseconds |
| `error` | string | Error message (if success = false) |
| `details` | string | Additional error details (if applicable) |

### GET /api/health

Health check endpoint for monitoring API status.

#### Response

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

## Data Formats

### Legal Moves Format

Legal moves must be in chess.js verbose format:

```javascript
[
  {
    "from": "e2",      // Source square
    "to": "e4",        // Destination square  
    "san": "e4",       // Standard algebraic notation
    "piece": "p",      // Piece type (p, r, n, b, q, k)
    "captured": null,  // Captured piece type or null
    "promotion": null  // Promotion piece type or null
  }
]
```

### Chat History Format

```javascript
[
  {
    "role": "user",
    "content": "What should I do in this position?"
  },
  {
    "role": "assistant",
    "content": "Consider developing your knights..."
  }
]
```

### Engine Evaluation Format

```javascript
{
  "score": 0.25,        // Position score in pawns
  "bestMove": "Nf3",    // Best move in algebraic notation
  "depth": 12,          // Search depth
  "mate": null          // Mate in X moves (if applicable)
}
```

## Template Variables

The API uses template variables to structure data for the AI mentor. These are populated by deterministic analyzers:

### Core Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{{BOARD_REALITY}}` | boardRadar.js | `[a1: White Rook] [e1: White King] [e8: Black King]` |
| `{{SAFETY_ALERT}}` | safetyCheck.js | `Position is safe` or `🚨 White is in CHECK!` |
| `{{STRATEGIC_ANALYSIS}}` | moveReasoning.js | `**Nf3**: Develops piece, Controls center squares` |
| `{{userElo}}` | Request | `1650` |
| `{{personaName}}` | Request | `Irina` |
| `{{POSITION_TYPE}}` | moveReasoning.js | `Opening phase - focus on development` |

### Variable Population Process

1. **Input Validation**: Verify FEN, legal moves, and required fields
2. **Analyzer Execution**: Run all three deterministic analyzers
3. **Template Building**: Populate variables in system prompt template
4. **LLM Integration**: Send complete prompt to OpenAI API
5. **Response Processing**: Return natural language response

### Variable Constraints

- **BOARD_REALITY**: Must list all occupied squares with piece descriptions
- **SAFETY_ALERT**: Must indicate safety status or specific threats
- **STRATEGIC_ANALYSIS**: Must only include moves from provided legal moves list

## Error Handling

### Error Types

#### 1. Request Validation Errors (400)

**Invalid FEN**:
```json
{
  "success": false,
  "error": "Invalid FEN format", 
  "details": "FEN must have 6 parts separated by spaces"
}
```

**Missing Required Fields**:
```json
{
  "success": false,
  "error": "Missing required field: userMessage",
  "details": "userMessage is required for mentor interaction"
}
```

**Invalid ELO Range**:
```json
{
  "success": false,
  "error": "Invalid ELO range",
  "details": "ELO must be between 800 and 3000"
}
```

#### 2. Analyzer Errors (500)

**Chess.js Initialization**:
```json
{
  "success": false,
  "error": "Chess analysis failed",
  "details": "Could not create chess instance from FEN"
}
```

**Analyzer Module Error**:
```json
{
  "success": false,
  "error": "Analyzer error", 
  "details": "boardRadar.js returned: [BOARD_RADAR_ERROR: Invalid FEN]"
}
```

#### 3. OpenAI API Errors (500)

**API Key Issues**:
```json
{
  "success": false,
  "error": "OpenAI API error",
  "details": "Invalid API key or quota exceeded"
}
```

**Timeout**:
```json
{
  "success": false,
  "error": "Request timeout",
  "details": "OpenAI API request exceeded 10 second timeout"
}
```

### Error Response Codes

| Code | Description | Retry Strategy |
|------|-------------|----------------|
| 400 | Bad Request - Client error | Fix request and retry |
| 500 | Internal Server Error | Retry after delay |
| 503 | Service Unavailable | Check OpenAI API status |

## Examples

### Basic Chess Question

**Request**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "legalMoves": [
      {"from": "e2", "to": "e4", "san": "e4", "piece": "p"},
      {"from": "g1", "to": "f3", "san": "Nf3", "piece": "n"}
    ],
    "userMessage": "How should I start the game?",
    "userElo": 1500,
    "personaName": "Irina"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Consider **e4** to claim central space and open lines for your pieces, or **Nf3** to develop your knight toward the center. Which opening principle feels most natural to you?",
  "processingTimeMs": 2156
}
```

### Position with Tactical Threat

**Request**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    "legalMoves": [
      {"from": "h5", "to": "f7", "san": "Qxf7#", "piece": "q", "captured": "p"}
    ],
    "userMessage": "What should I do?",
    "userElo": 1800,
    "personaName": "Irina"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "The analysis shows **Qxf7#** delivers checkmate! This Scholar's Mate pattern captures the f7 pawn while simultaneously checkmating the enemy king. Can you see why Black cannot escape this attack?",
  "processingTimeMs": 1893
}
```

### Invalid Position Request

**Request**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "invalid-fen-string",
    "userMessage": "Help me",
    "userElo": 1500,
    "personaName": "Irina"
  }'
```

**Response**:
```json
{
  "success": false,
  "error": "Invalid FEN format",
  "details": "Could not parse FEN string: invalid-fen-string"
}
```

### Health Check

**Request**:
```bash
curl http://localhost:3000/api/health
```

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

## Rate Limiting

The API inherits OpenAI's rate limiting:
- **Requests per minute**: Depends on OpenAI plan
- **Tokens per minute**: Depends on OpenAI plan  
- **Concurrent requests**: Limited by OpenAI quota

Monitor OpenAI usage dashboard for rate limit status.

## Response Times

Typical response times by component:

- **Analyzer execution**: 50-100ms
- **Template building**: 10-20ms  
- **OpenAI API call**: 1500-3000ms
- **Total response time**: 1600-3200ms

Performance varies based on:
- OpenAI API load
- Chess position complexity
- Number of legal moves to analyze

## Development Notes

### Local Testing

```bash
# Start server in development mode
cd server && npm run dev

# Test with curl
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d @test-position.json

# Monitor logs
tail -f server.log
```

### Debugging

Enable debug logging:
```bash
DEBUG=chess:* node index.js
```

Check analyzer outputs in console:
- Look for `🔬 [DETERMINISTIC]` logs
- Verify `BOARD_REALITY`, `SAFETY_ALERT`, `STRATEGIC_ANALYSIS` outputs
- Confirm template variable population

### Integration Testing

```javascript
const request = require('supertest');
const app = require('./server/index');

describe('Chess API', () => {
  test('should analyze starting position', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        legalMoves: [/* ... */],
        userMessage: 'What should I do?',
        userElo: 1500,
        personaName: 'Irina'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBeTruthy();
  });
});
```

This API documentation provides comprehensive coverage of the Talking Chess AI mentor backend, enabling effective integration and debugging of the deterministic translation system.