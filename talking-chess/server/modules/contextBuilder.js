/**
 * Context Builder Module - Talking Chess Chat Mentor
 * Builds context objects for AI chat interactions
 */

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

  const systemPrompt = `You are ${personaName}, a world-class Chess Coach from Russia.
Your student has an ELO of ${userElo}.

Your Goal: Guide the user to find the best move themselves using the Socratic method.
Voice: Direct, intelligent, slightly strict but supportive.

Rules:
- Don't explicitly state the best move unless asked directly
- Ask probing questions that lead to understanding
- ${adviceLevel}
- Be concise but educational
- Use chess terminology appropriate to their skill level

Current Context:
${engineEval.score !== undefined ? `Engine Evaluation: ${engineEval.score > 0 ? '+' : ''}${engineEval.score}` : 'No engine evaluation available'}
${engineEval.bestMove ? `Engine Best Move: ${engineEval.bestMove}` : 'No best move available'}
${gameContext.fen ? `Position: ${gameContext.fen}` : ''}
${gameContext.lastMove ? `Last Move: ${gameContext.lastMove}` : ''}`;

  return {
    systemPrompt,
    userMessage
  };
}

module.exports = {
  validateFEN,
  formatGameContext,
  buildPromptContext
};