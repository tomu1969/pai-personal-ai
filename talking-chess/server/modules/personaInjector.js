/**
 * Persona Injector Module - Talking Chess Chat Mentor
 * Injects persona characteristics into AI system prompts
 */

const path = require('path');

// Available personas
const PERSONAS = {
  'Irina': require('../personas/irina')
};

/**
 * Injects persona into system prompt based on context
 * @param {Object} context - Game and user context
 * @returns {string} - Complete system prompt with persona
 */
function injectPersona(context) {
  const { personaName = 'Irina', userElo = 1500, engineEval = {} } = context;
  
  const persona = PERSONAS[personaName];
  if (!persona) {
    throw new Error(`Persona ${personaName} not found`);
  }
  
  // Select appropriate instruction level based on ELO
  let instructions;
  if (userElo < 1200) {
    instructions = persona.instructions.lowElo;
  } else if (userElo < 1800) {
    instructions = persona.instructions.midElo;
  } else {
    instructions = persona.instructions.highElo;
  }
  
  // Build system prompt
  const systemPrompt = `You are ${persona.name}, a world-class Chess Coach from Russia.

Your student has an ELO rating of ${userElo}.

CORE IDENTITY:
${persona.origin}

PERSONALITY & TONE:
${persona.tone}

YOUR GOAL:
${persona.philosophy}

TEACHING APPROACH:
${instructions}

STRICT RULES:
${persona.principles.map(principle => `- ${principle}`).join('\n')}

CURRENT GAME CONTEXT:
${engineEval.score !== undefined ? `Engine Evaluation: ${engineEval.score > 0 ? '+' : ''}${engineEval.score}` : 'No evaluation available'}
${engineEval.bestMove ? `Engine Best Move: ${engineEval.bestMove}` : 'No best move available'}
${context.fen ? `Position (FEN): ${context.fen}` : ''}
${context.lastMove ? `Last Move Played: ${context.lastMove}` : ''}
${context.pgn ? `Game Progress: ${context.pgn}` : ''}

Remember: Guide through questions and hints, never explicitly state the best move unless explicitly asked "What is the best move?"`;

  return systemPrompt;
}

/**
 * Validates if response follows Socratic method principles
 * @param {string} response - AI response to validate
 * @returns {boolean} - True if follows Socratic method
 */
function validateSocraticResponse(response) {
  // Check for explicit move commands
  if (containsExplicitMove(response)) {
    return false;
  }
  
  // Check for questioning patterns
  const hasQuestion = /\?/.test(response);
  const hasThinkingPrompt = /consider|think|notice|evaluate|examine|what|how|why|which/i.test(response);
  
  return hasQuestion || hasThinkingPrompt;
}

/**
 * Detects if response contains explicit move suggestions
 * @param {string} response - Response text to check
 * @returns {boolean} - True if contains explicit moves
 */
function containsExplicitMove(response) {
  const explicitPatterns = [
    /\b(play|move|take|capture)\s+[a-h][1-8]/i,
    /\b(play|move)\s+(your\s+)?(queen|king|rook|bishop|knight|pawn)/i,
    /\b(castle|castling)\s+(kingside|queenside|now|immediately)/i,
    /^(play|move)\s+[A-Z]/i, // Chess notation like "Play e4"
    /\b(the best move is|you should play|move the)/i,
    /^play\s+[a-z0-9]/i, // "Play e4", "Play Nf3"
    /^move\s+/i, // "Move your queen", "Move the knight"
    /\btake\s+with\s+the/i, // "Take with the queen"
    /\bmove\s+the\s+(queen|king|rook|bishop|knight|pawn)/i, // "Move the knight to f3"
    /^castle\s/i // "Castle kingside"
  ];
  
  return explicitPatterns.some(pattern => pattern.test(response));
}

/**
 * Assesses the educational quality of a response
 * @param {string} response - Response to assess
 * @returns {Object} - Quality metrics
 */
function assessResponseQuality(response) {
  const isEducational = response.length > 20 && 
    (/learn|understand|concept|principle|why|because/i.test(response) || 
     /position|strategy|tactic|development/i.test(response));
  
  const isSocratic = validateSocraticResponse(response);
  const hasExplicitMove = containsExplicitMove(response);
  const hasQuestion = /\?/.test(response);
  const encouragingTone = /good|well|excellent|correct|right direction/i.test(response);
  
  let score = 0;
  if (isEducational) score += 0.3;
  if (isSocratic) score += 0.3;
  if (!hasExplicitMove) score += 0.2;
  if (hasQuestion) score += 0.1;
  if (encouragingTone) score += 0.1;
  
  return {
    isEducational,
    isSocratic,
    hasExplicitMove,
    hasQuestion,
    encouragingTone,
    score: Math.min(1.0, score)
  };
}

module.exports = {
  injectPersona,
  validateSocraticResponse,
  containsExplicitMove,
  assessResponseQuality
};