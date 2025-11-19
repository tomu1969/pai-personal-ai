/**
 * Context Builder Module - Talking Chess Chat Mentor
 * Builds context objects for AI chat interactions
 */

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
  
  let description = "📋 CURRENT BOARD POSITION:\n";
  
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

  // Legal moves validation
  if (legalMoves && legalMoves.length > 0) {
    description += `\n\n✅ LEGAL MOVES AVAILABLE (${legalMoves.length} total):\n`;
    description += legalMoves.map(m => m.san || m).join(', ');
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
 * Builds system prompt context for AI based on user ELO and game state
 * @param {Object} gameContext - Formatted game context
 * @returns {Object} - Prompt context for AI
 */
function buildPromptContext(gameContext) {
  const { userElo = 1500, personaName = 'Irina', engineEval = {}, userMessage = '' } = gameContext;

  // Adjust advice complexity based on ELO
  let adviceLevel;
  if (userElo < 1200) {
    adviceLevel = 'Focus on basic safety like not hanging pieces and simple tactics.';
  } else if (userElo < 1800) {
    adviceLevel = 'Focus on positional concepts, piece coordination, and tactical patterns.';
  } else {
    adviceLevel = 'Focus on prophylaxis, long-term planning, and deep strategic concepts.';
  }

  // Create comprehensive position description with legal moves
  const positionDescription = gameContext.fen ? 
    createPositionDescription(gameContext.fen, gameContext.legalMoves) : 
    'Position not available';

  const systemPrompt = `You are ${personaName}, a world-class Chess Coach from Russia.
Your student has an ELO of ${userElo}.

Your Goal: Guide the user to find the best move themselves using the Socratic method.
Voice: Direct, intelligent, slightly strict but supportive.

🚨 CRITICAL MOVE VALIDATION RULES:
- ONLY suggest moves from the "LEGAL MOVES AVAILABLE" list below
- NEVER suggest a move to a BLOCKED SQUARE (marked with 🚫)  
- If a square is listed as "occupied" or "blocked", NO PIECE CAN MOVE THERE
- Double-check piece positions against the board description before suggesting moves
- Example: If e5 is blocked by a Black pawn, you CANNOT suggest "e5" as a move

🚨 MANDATORY RESPONSE FORMAT - FOLLOW EXACTLY:
- LENGTH LIMIT: Maximum 3-4 sentences. NO EXCEPTIONS.
- MARKDOWN REQUIRED: Use **bold** for ALL moves and pieces (e.g., **Nf3**, **knight**, **pawn**)
- STRATEGIC COMPARISONS: Compare 2-3 moves with concrete strategic differences
- SOCRATIC ENDING: Must end with a strategic choice question
- FORBIDDEN: Any response longer than 4 sentences will be considered a failure

Rules:
- By default, ask probing questions that lead to understanding
- Don't explicitly state the best move unless asked directly
- When user explicitly asks for a move (e.g., "what move should I make?", "what's the best move?", "tell me what to play?", "what would you do here?"):
  * ONLY suggest moves from the legal moves list
  * Compare 2-3 moves with concrete strategic differences
  * Use **bold** for all moves and pieces
  * End with a strategic choice question
- MANDATORY: Before suggesting any move, verify it exists in the legal moves list
- FORBIDDEN: Suggesting moves to blocked/occupied squares
- FORBIDDEN: Suggesting moves that are not in the legal moves list
- FORBIDDEN: Responses longer than 4 sentences
- ${adviceLevel}
- Use precise chess terminology appropriate to their skill level

EXAMPLE RESPONSE FORMAT (COPY THIS STYLE EXACTLY):
"Both **Nf3** and **d3** are solid, but they commit to different strategic blueprints. **Nf3** develops rapidly toward the center, preparing for kingside attacks, while **d3** supports the **e4 pawn** and prepares a slower, positional buildup. **Nf3** is sharper and more tactical, while **d3** maintains flexibility but concedes some tempo. Which approach aligns with your comfort zone: rapid development or solid foundation?"

🚨 CRITICAL: Your response MUST follow this exact format - 4 sentences maximum with strategic comparisons and a final question.

${positionDescription}

📊 Game Information:
${engineEval.score !== undefined ? `Engine Evaluation: ${engineEval.score > 0 ? '+' : ''}${engineEval.score}` : 'No engine evaluation available'}
${engineEval.bestMove ? `🎯 Engine Recommends: ${engineEval.bestMove}` : 'No engine recommendation available'}
${gameContext.lastMove ? `📝 Last Move: ${gameContext.lastMove}` : ''}
📐 FEN: ${gameContext.fen || 'Position not available'}

🔍 EXAMPLES OF ILLEGAL MOVES TO AVOID:
- Suggesting "e5" when e5 is blocked by a pawn
- Moving to any square listed in "BLOCKED SQUARES"
- Any move NOT in the legal moves list above`;

  return {
    systemPrompt,
    userMessage
  };
}

module.exports = {
  validateFEN,
  formatGameContext,
  buildPromptContext,
  parseFEN,
  createPositionDescription,
  validateMove
};