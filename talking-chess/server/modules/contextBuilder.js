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
 * Creates a human-readable description of the current position
 * @param {string} fen - The FEN string
 * @returns {string} - Human-readable position description
 */
function createPositionDescription(fen) {
  const parsed = parseFEN(fen);
  if (!parsed) {
    return "Position cannot be parsed.";
  }

  const { pieces } = parsed;
  
  let description = "Current Position:\n";
  
  // White pieces
  description += "White: ";
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
  description += "Black: ";
  if (pieces.black.pawns.length > 0) {
    description += `Pawns on ${pieces.black.pawns.join(', ')}`;
  } else {
    description += "No pawns";
  }
  
  if (pieces.black.pieces.length > 0) {
    const pieceList = pieces.black.pieces.map(p => `${p.piece} on ${p.square}`).join(', ');
    description += pieces.black.pawns.length > 0 ? `; ${pieceList}` : pieceList;
  }

  return description;
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

  // Create human-readable position description
  const positionDescription = gameContext.fen ? createPositionDescription(gameContext.fen) : 'Position not available';

  const systemPrompt = `You are ${personaName}, a world-class Chess Coach from Russia.
Your student has an ELO of ${userElo}.

Your Goal: Guide the user to find the best move themselves using the Socratic method.
Voice: Direct, intelligent, slightly strict but supportive.

Rules:
- By default, ask probing questions that lead to understanding
- Don't explicitly state the best move unless asked directly
- When user explicitly asks for a move (e.g., "what move should I make?", "what's the best move?", "tell me what to play?", "what would you do here?"):
  * You may suggest the specific move using chess notation
  * Explain WHY this move is good
  * Mention 1-2 alternative moves if relevant
  * Use the engine's recommendation and legal moves for context
- IMPORTANT: Base all move suggestions ONLY on pieces that actually exist on the board (see position description below)
- NEVER suggest moving a piece from a square where no piece exists
- ${adviceLevel}
- Be concise but educational
- Use chess terminology appropriate to their skill level

Current Context:
${positionDescription}

Game Information:
${engineEval.score !== undefined ? `Engine Evaluation: ${engineEval.score > 0 ? '+' : ''}${engineEval.score}` : 'No engine evaluation available'}
${engineEval.bestMove ? `Engine Recommends: ${engineEval.bestMove}` : 'No engine recommendation available'}
${gameContext.legalMoves && gameContext.legalMoves.length > 0 ? `Legal Moves Available: ${gameContext.legalMoves.map(m => m.san).join(', ')}` : 'No legal moves available'}
${gameContext.lastMove ? `Last Move Played: ${gameContext.lastMove}` : ''}
FEN: ${gameContext.fen || 'Position not available'}`;

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
  createPositionDescription
};