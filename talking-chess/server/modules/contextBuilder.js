/**
 * Context Builder Module - Talking Chess Chat Mentor
 * Builds context objects for AI chat interactions with deterministic analysis
 */

// Import analyzers
const { Chess } = require('chess.js');
const { getBoardRadar, getPieceCounts } = require('../analyzers/boardRadar');
const { getSafetyStatus } = require('../analyzers/safetyCheck');
const { getStrategicAnalysis, formatStrategicAnalysis, getPositionType } = require('../analyzers/moveReasoning');

/**
 * Parses FEN notation to extract piece positions
 * @param {string} fen - The FEN string to parse
 * @returns {Object} - Object containing piece positions and board state
 */
function parseFEN(fen) {
  if (!fen || typeof fen !== 'string') {
    return null;
  }

  const parts = fen.trim().split(' ');
  if (parts.length < 1) {
    return null;
  }

  const [position] = parts;
  const ranks = position.split('/');
  
  if (ranks.length !== 8) {
    return null;
  }

  const board = {};
  const pieces = {
    white: { pawns: [], pieces: [] },
    black: { pawns: [], pieces: [] }
  };

  // Map piece symbols to names
  const pieceNames = {
    'p': 'pawn', 'r': 'rook', 'n': 'knight', 'b': 'bishop', 'q': 'queen', 'k': 'king',
    'P': 'pawn', 'R': 'rook', 'N': 'knight', 'B': 'bishop', 'Q': 'queen', 'K': 'king'
  };

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rank = ranks[rankIndex];
    let fileIndex = 0;
    
    for (let charIndex = 0; charIndex < rank.length; charIndex++) {
      const char = rank[charIndex];
      
      if (char >= '1' && char <= '8') {
        // Empty squares
        fileIndex += parseInt(char);
      } else if (pieceNames[char]) {
        // Piece found
        const file = String.fromCharCode(97 + fileIndex); // a-h
        const rankNum = 8 - rankIndex; // 8-1
        const square = file + rankNum;
        
        const isWhite = char === char.toUpperCase();
        const pieceName = pieceNames[char];
        
        board[square] = {
          piece: pieceName,
          color: isWhite ? 'white' : 'black',
          symbol: char
        };
        
        if (pieceName === 'pawn') {
          pieces[isWhite ? 'white' : 'black'].pawns.push(square);
        } else {
          pieces[isWhite ? 'white' : 'black'].pieces.push({ piece: pieceName, square });
        }
        
        fileIndex++;
      }
    }
  }

  return { board, pieces };
}

/**
 * Creates a human-readable board state description for the LLM
 * This helps prevent hallucination by giving the LLM ground truth about piece positions
 * @param {string} fen - The FEN string to parse
 * @returns {string} - Human-readable board state
 */
function createBoardStateDescription(fen) {
  const parsed = parseFEN(fen);
  if (!parsed) {
    return "Position cannot be parsed.";
  }

  const { pieces } = parsed;
  let description = "";

  // White pieces
  description += "White: ";
  const whiteParts = [];
  if (pieces.white.pawns.length > 0) {
    whiteParts.push(`Pawns on ${pieces.white.pawns.join(', ')}`);
  }
  // Group other pieces by type
  const whitePiecesByType = {};
  pieces.white.pieces.forEach(p => {
    const capitalizedPiece = p.piece.charAt(0).toUpperCase() + p.piece.slice(1);
    if (!whitePiecesByType[capitalizedPiece]) {
      whitePiecesByType[capitalizedPiece] = [];
    }
    whitePiecesByType[capitalizedPiece].push(p.square);
  });
  for (const [pieceType, squares] of Object.entries(whitePiecesByType)) {
    whiteParts.push(`${pieceType}${squares.length > 1 ? 's' : ''} on ${squares.join(', ')}`);
  }
  description += whiteParts.join('; ') || 'No pieces';

  description += "\n";

  // Black pieces
  description += "Black: ";
  const blackParts = [];
  if (pieces.black.pawns.length > 0) {
    blackParts.push(`Pawns on ${pieces.black.pawns.join(', ')}`);
  }
  // Group other pieces by type
  const blackPiecesByType = {};
  pieces.black.pieces.forEach(p => {
    const capitalizedPiece = p.piece.charAt(0).toUpperCase() + p.piece.slice(1);
    if (!blackPiecesByType[capitalizedPiece]) {
      blackPiecesByType[capitalizedPiece] = [];
    }
    blackPiecesByType[capitalizedPiece].push(p.square);
  });
  for (const [pieceType, squares] of Object.entries(blackPiecesByType)) {
    blackParts.push(`${pieceType}${squares.length > 1 ? 's' : ''} on ${squares.join(', ')}`);
  }
  description += blackParts.join('; ') || 'No pieces';

  return description;
}

/**
 * Creates a detailed position analysis including occupied and blocked squares
 * @param {string} fen - The FEN string
 * @param {Array} legalMoves - Array of legal moves with san notation
 * @returns {string} - Comprehensive position description
 */
function createPositionDescription(fen, legalMoves = []) {
  const parsed = parseFEN(fen);
  if (!parsed) {
    return "Position cannot be parsed.";
  }

  const { board, pieces } = parsed;
  const occupiedSquares = Object.keys(board);
  
  let description = "";
  
  // NOTE: Legal moves are now handled separately via LEGAL_MOVES_LIST variable
  // This function focuses only on board position description
  
  description += "📋 CURRENT BOARD POSITION:\n";
  
  // White pieces
  description += "🤍 White pieces: ";
  if (pieces.white.pawns.length > 0) {
    description += `Pawns on ${pieces.white.pawns.join(', ')}`;
  } else {
    description += "No pawns";
  }
  
  if (pieces.white.pieces.length > 0) {
    const pieceList = pieces.white.pieces.map(p => `${p.piece} on ${p.square}`).join(', ');
    description += pieces.white.pawns.length > 0 ? `; ${pieceList}` : pieceList;
  }
  
  description += "\n";
  
  // Black pieces
  description += "⚫ Black pieces: ";
  if (pieces.black.pawns.length > 0) {
    description += `Pawns on ${pieces.black.pawns.join(', ')}`;
  } else {
    description += "No pawns";
  }
  
  if (pieces.black.pieces.length > 0) {
    const pieceList = pieces.black.pieces.map(p => `${p.piece} on ${p.square}`).join(', ');
    description += pieces.black.pawns.length > 0 ? `; ${pieceList}` : pieceList;
  }

  // Blocked squares analysis
  description += "\n\n🚫 BLOCKED SQUARES (occupied by pieces):\n";
  description += occupiedSquares.sort().join(', ');

  // Key blocked square warnings for common mistakes
  const criticalSquares = ['e4', 'e5', 'd4', 'd5', 'f4', 'f5', 'c4', 'c5'];
  const blockedCritical = criticalSquares.filter(sq => board[sq]);
  if (blockedCritical.length > 0) {
    description += "\n⚠️  IMPORTANT: These center squares are BLOCKED: ";
    blockedCritical.forEach(sq => {
      const piece = board[sq];
      description += `${sq} (${piece.color} ${piece.piece}), `;
    });
    description = description.slice(0, -2); // Remove last comma
  }

  return description;
}

/**
 * Validates if a suggested move is legal
 * @param {string} moveNotation - Move in algebraic notation (e.g., "e5", "Nf3")
 * @param {Array} legalMoves - Array of legal moves
 * @returns {Object} - Validation result with isLegal flag and reason
 */
function validateMove(moveNotation, legalMoves = []) {
  if (!moveNotation || !legalMoves.length) {
    return { isLegal: false, reason: "No legal moves available" };
  }

  const legalMovesStr = legalMoves.map(m => m.san || m);
  const isLegal = legalMovesStr.includes(moveNotation);
  
  if (!isLegal) {
    return { 
      isLegal: false, 
      reason: `"${moveNotation}" is not in the legal moves list: ${legalMovesStr.join(', ')}` 
    };
  }

  return { isLegal: true, reason: "Move is legal" };
}

/**
 * Validates that the chess position and legal moves are consistent
 * @param {string} fen - The FEN string
 * @param {Array} legalMoves - Array of legal moves
 * @returns {Object} - Validation result with consistency checks
 */
function validatePositionConsistency(fen, legalMoves = []) {
  const issues = [];
  
  if (!fen) {
    issues.push("Missing FEN string");
    return { isConsistent: false, issues };
  }
  
  if (!legalMoves || legalMoves.length === 0) {
    issues.push("No legal moves provided - possible stalemate or checkmate");
  }
  
  try {
    // Basic FEN validation
    const fenParts = fen.split(' ');
    if (fenParts.length !== 6) {
      issues.push(`Invalid FEN format: expected 6 parts, got ${fenParts.length}`);
    }
    
    // Check if position looks like starting position but has advanced moves
    const isStartPosition = fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    if (isStartPosition && legalMoves.some(m => (m.san || m).includes('x'))) {
      issues.push("Starting position but legal moves include captures - possible desync");
    }
    
    // Check for impossible moves in opening position
    if (isStartPosition && legalMoves.some(m => {
      const san = m.san || m;
      return san.includes('N') && ['Na4', 'Nb5', 'Nd5', 'Ne4', 'Ng4', 'Nh5'].includes(san);
    })) {
      issues.push("Starting position but has impossible knight moves - likely position mismatch");
    }
    
    // Check for excessive legal moves (usually indicates wrong position)
    if (legalMoves.length > 50) {
      issues.push(`Unusually high number of legal moves: ${legalMoves.length} (possible position error)`);
    }
    
    // Extract move notation for analysis
    const sanMoves = legalMoves.map(m => m.san || m);
    
    // Check for knight moves that don't match common opening patterns
    const knightMoves = sanMoves.filter(move => move.match(/^N[a-h][1-8]/));
    if (knightMoves.length > 0) {
      // In opening, typical knight moves are Nf3, Nc3, Ng1-f3, Nb1-c3
      const validOpeningKnightMoves = ['Nf3', 'Nc3', 'Ne2', 'Nh3'];
      const suspiciousKnightMoves = knightMoves.filter(move => !validOpeningKnightMoves.includes(move));
      if (suspiciousKnightMoves.length > 0 && fenParts[5] === '1') { // Move 1
        issues.push(`Suspicious knight moves in opening: ${suspiciousKnightMoves.join(', ')}`);
      }
    }
    
  } catch (error) {
    issues.push(`FEN parsing error: ${error.message}`);
  }
  
  return {
    isConsistent: issues.length === 0,
    issues,
    warnings: issues.filter(issue => issue.includes('possible') || issue.includes('suspicious'))
  };
}

/**
 * Validates FEN (Forsyth-Edwards Notation) string format
 * @param {string} fen - The FEN string to validate
 * @returns {boolean} - True if valid FEN format
 */
function validateFEN(fen) {
  if (!fen || typeof fen !== 'string') {
    return false;
  }

  // Basic FEN structure: pieces castling enpassant halfmove fullmove
  const parts = fen.trim().split(' ');
  if (parts.length !== 6) {
    return false;
  }

  const [position, activeColor, castling, enPassant, halfmove, fullmove] = parts;

  // Validate position (8 ranks separated by /)
  const ranks = position.split('/');
  if (ranks.length !== 8) {
    return false;
  }

  // Validate each rank
  for (const rank of ranks) {
    let squares = 0;
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        squares += parseInt(char);
      } else if ('prnbqkPRNBQK'.includes(char)) {
        squares += 1;
      } else {
        return false;
      }
    }
    if (squares !== 8) {
      return false;
    }
  }

  // Validate active color
  if (activeColor !== 'w' && activeColor !== 'b') {
    return false;
  }

  // Validate castling rights
  if (!/^(-|[KQkq]+)$/.test(castling)) {
    return false;
  }

  // Validate en passant
  if (!/^(-|[a-h][36])$/.test(enPassant)) {
    return false;
  }

  // Validate halfmove and fullmove counters
  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) {
    return false;
  }

  return true;
}

/**
 * Formats game context object with defaults and validation
 * @param {Object} input - Raw context input
 * @returns {Object} - Formatted game context
 */
function formatGameContext(input) {
  if (!input.fen) {
    throw new Error('FEN is required');
  }

  if (!validateFEN(input.fen)) {
    throw new Error('Invalid FEN format');
  }

  // Set defaults
  const context = {
    fen: input.fen,
    pgn: input.pgn || '',
    lastMove: input.lastMove || null,
    userElo: input.userElo || 1500,
    personaName: input.personaName || 'Irina',
    engineEval: input.engineEval || {
      score: 0.0,
      bestMove: null
    },
    legalMoves: input.legalMoves || [],
    chatHistory: input.chatHistory || [],
    userMessage: input.userMessage || ''
  };

  // Truncate chat history to last 10 messages
  if (context.chatHistory.length > 10) {
    context.chatHistory = context.chatHistory.slice(-10);
  }

  return context;
}

/**
 * Ranks chess moves by strength and returns top 3 with best move identification
 * @param {Array} legalMoves - Array of legal moves with san notation
 * @param {Object} engineEval - Engine evaluation with score and bestMove
 * @returns {Object} - Object containing top3Moves string and bestMove
 */
function extractTop3Moves(legalMoves = [], engineEval = {}) {
  if (!legalMoves || legalMoves.length === 0) {
    return {
      top3Moves: 'No legal moves available',
      bestMove: null
    };
  }

  // Convert moves to consistent format
  const moves = legalMoves.map(m => m.san || m);
  
  // If only 1-3 moves, return all
  if (moves.length <= 3) {
    return {
      top3Moves: moves.join(', '),
      bestMove: engineEval.bestMove || moves[0]
    };
  }

  // Ranking algorithm: prioritize engine best move, then strategic principles
  const rankedMoves = moves.map(move => {
    let score = 0;
    
    // Primary: Engine best move gets highest priority
    if (engineEval.bestMove && move === engineEval.bestMove) {
      score += 1000;
    }
    
    // Secondary: Captures (indicated by 'x' in algebraic notation)
    if (move.includes('x')) {
      score += 100;
    }
    
    // Tertiary: Piece development (knights and bishops)
    if (/^[NB]/.test(move)) {
      score += 50;
    }
    
    // Quaternary: Central pawn moves (e4, e5, d4, d5)
    if (/^[ed][45]$/.test(move)) {
      score += 30;
    }
    
    // Quinary: Castling (0-0, 0-0-0)
    if (move.includes('0-0')) {
      score += 25;
    }
    
    // Senary: Check moves (indicated by '+')
    if (move.includes('+')) {
      score += 20;
    }
    
    // Septenary: Promotion moves (indicated by '=')
    if (move.includes('=')) {
      score += 15;
    }
    
    return { move, score };
  });

  // Sort by score (highest first) and take top 3
  const sortedMoves = rankedMoves
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.move);

  return {
    top3Moves: sortedMoves.join(', '),
    bestMove: engineEval.bestMove || sortedMoves[0]
  };
}

/**
 * Builds system prompt context for AI based on user ELO and game state
 * Now async to support Stockfish engine analysis
 * @param {Object} gameContext - Formatted game context
 * @returns {Promise<Object>} - Prompt context for AI
 */
async function buildPromptContext(gameContext) {
  const { loadAndFillPrompt } = require('./promptLoader');
  const { userElo = 1500, personaName = 'Irina', userMessage = '' } = gameContext;

  // Adjust advice complexity based on ELO
  let adviceLevel;
  if (userElo < 1200) {
    adviceLevel = 'beginner';
  } else if (userElo < 1800) {
    adviceLevel = 'intermediate';
  } else {
    adviceLevel = 'advanced';
  }

  // Validate position consistency before processing
  const validation = validatePositionConsistency(gameContext.fen, gameContext.legalMoves);
  console.log('[CONTEXT] Position validation:', validation.isConsistent ? 'OK' : validation.issues);

  // === ENGINE-BASED ANALYSIS ===
  let safetyAlert = '[ANALYSIS_ERROR: Could not analyze safety]';
  let strategicAnalysis = '[ANALYSIS_ERROR: Could not analyze moves]';
  let positionType = 'Unknown';

  try {
    console.log('[CONTEXT] Starting engine analysis for FEN:', gameContext.fen);
    const chess = new Chess(gameContext.fen);

    // Get safety status (synchronous)
    safetyAlert = getSafetyStatus(chess);
    positionType = getPositionType(chess);

    // Get engine-based strategic analysis (async)
    const analysisResult = await getStrategicAnalysis(gameContext.fen, {
      depth: 16,
      multiPv: 3
    });

    // Format the analysis for the prompt
    strategicAnalysis = formatStrategicAnalysis(analysisResult);

    console.log('[CONTEXT] Engine analysis complete');
    console.log('[CONTEXT] Safety:', safetyAlert);
    console.log('[CONTEXT] Strategic Analysis:', strategicAnalysis);

  } catch (error) {
    console.error('[CONTEXT] Analysis failed:', error.message);
    safetyAlert = `[ANALYSIS_ERROR: ${error.message}]`;
    strategicAnalysis = `[ANALYSIS_ERROR: ${error.message}]`;
  }

  // Generate board state description to prevent LLM hallucination about piece positions
  const boardState = createBoardStateDescription(gameContext.fen);
  console.log('[CONTEXT] Board State:', boardState);

  // Extract prior suggestions to prevent repetition
  const priorSuggestions = extractPriorSuggestions(gameContext.chatHistory || []);
  const priorSuggestionsText = priorSuggestions.length > 0
    ? `You already suggested: ${priorSuggestions.join(', ')}. Suggest something different.`
    : '';
  console.log('[CONTEXT] Prior suggestions:', priorSuggestions);

  // Prepare template variables
  // Note: With tool-based architecture, STRATEGIC_ANALYSIS is optional backup
  // The AI will call get_position_analysis tool for accurate eval
  const templateVariables = {
    personaName,
    userElo,
    adviceLevel,
    SAFETY_ALERT: safetyAlert,
    STRATEGIC_ANALYSIS: strategicAnalysis, // Kept for fallback prompt
    POSITION_TYPE: positionType,
    BOARD_STATE: boardState,
    PRIOR_SUGGESTIONS: priorSuggestionsText,
    fen: gameContext.fen || 'Position not available'
  };

  try {
    // Load and fill the external prompt template
    const systemPrompt = loadAndFillPrompt('irina-system-prompt', templateVariables);

    return {
      systemPrompt,
      userMessage
    };
  } catch (error) {
    console.error('[CONTEXT] Failed to load prompt template:', error.message);

    // Fallback to minimal embedded prompt
    const fallbackPrompt = `You are ${personaName}, a chess coach. Student ELO: ${userElo}.

## MOVE OPTIONS (Engine Analysis)
These are the ONLY moves you can discuss:
${strategicAnalysis}

## RULES
1. Only discuss moves listed above
2. Recommend "best" or "ok" moves only
3. Max 3-4 sentences

${safetyAlert}`;

    return {
      systemPrompt: fallbackPrompt,
      userMessage
    };
  }
}

/**
 * Extract move suggestions from chat history
 * Looks for bold moves (**move**) in assistant messages
 * @param {Array} chatHistory - Array of {role, content} messages
 * @returns {Array<string>} - Array of suggested move SANs
 */
function extractPriorSuggestions(chatHistory = []) {
  const suggestions = new Set();

  // Regex to match bold moves like **e5**, **Nf3**, **exd5**
  const boldMoveRegex = /\*\*([A-Za-z0-9+#=x-]+)\*\*/g;

  // Also match moves mentioned as "play X" or "suggest X" or "try X"
  const verbMoveRegex = /(?:play|suggest|try|consider|recommend)\s+\*?\*?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)\*?\*?/gi;

  for (const msg of chatHistory) {
    if (msg.role === 'assistant' && msg.content) {
      // Find bold moves
      let match;
      while ((match = boldMoveRegex.exec(msg.content)) !== null) {
        const move = match[1];
        // Basic validation: looks like a chess move
        if (/^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?$/.test(move) ||
            /^O-O(?:-O)?$/.test(move)) {
          suggestions.add(move);
        }
      }

      // Find verb-prefixed moves
      while ((match = verbMoveRegex.exec(msg.content)) !== null) {
        const move = match[1];
        suggestions.add(move);
      }
    }
  }

  return Array.from(suggestions);
}

module.exports = {
  validateFEN,
  formatGameContext,
  buildPromptContext,
  parseFEN,
  createPositionDescription,
  validateMove,
  extractTop3Moves,
  validatePositionConsistency,
  extractPriorSuggestions
};