/**
 * Get Position Analysis Tool
 * Returns phase, evaluation, and positional factors for the current position
 */

const { analyzePosition } = require('../analyzers/engine');
const { getPositionType } = require('../analyzers/moveReasoning');
const { calculateMaterialDiff } = require('../analyzers/positionHeuristics');
const { staticExchangeEvaluation } = require('../analyzers/see');
const { Chess } = require('chess.js');

/**
 * Analyze the current position and return key positional factors
 * @param {Object} gameContext - Game context with fen and studentColor
 * @param {string} gameContext.fen - Position in FEN notation
 * @param {'w'|'b'} gameContext.studentColor - Which color the student is playing
 * @returns {Promise<Object>} Position analysis with eval and heuristics
 */
async function getPositionAnalysis(gameContext) {
  const { fen, studentColor } = gameContext;

  if (!fen) {
    return { error: 'Missing fen in gameContext' };
  }
  if (!studentColor || !['w', 'b'].includes(studentColor)) {
    return { error: 'Invalid or missing studentColor in gameContext' };
  }

  let chess;
  try {
    chess = new Chess(fen);
  } catch (error) {
    return { error: `Invalid FEN: ${error.message}` };
  }

  // Get engine evaluation with multiple best moves
  // Note: Engine returns eval from side-to-move perspective
  const sideToMove = chess.turn(); // 'w' or 'b'
  let rawEvalCp = 0;
  let engineBestMoves = [];
  try {
    const engineResult = await analyzePosition(fen, { depth: 16, multiPv: 5 });
    if (engineResult.bestMoves && engineResult.bestMoves.length > 0) {
      rawEvalCp = (engineResult.bestMoves[0].eval || 0) * 100;
      engineBestMoves = engineResult.bestMoves;
    }
  } catch (error) {
    console.warn('[TOOL] Engine analysis failed, using 0:', error.message);
  }

  // Compute safeMoves - engine suggestions filtered by SEE
  const safeMoves = computeSafeMoves(chess, engineBestMoves);

  // NORMALIZE to student perspective (+ = student advantage)
  // Engine eval is from side-to-move perspective
  // If student == side to move: use as-is
  // If student != side to move: flip sign
  const evalCp = studentColor === sideToMove ? rawEvalCp : -rawEvalCp;

  // Compute essential heuristics only
  const phase = getPositionType(chess);
  const materialDiff = calculateMaterialDiff(fen, studentColor);

  // Generate human-readable eval description
  const evalDescription = describeEval(evalCp);

  // Return concise output - only what LLM needs for conversation
  // Removed verbose heuristics (kingSafety, mobility, pawnStructure) to reduce repetition
  return {
    phase,
    evalCp: Math.round(evalCp),
    evalDescription,
    safeMoves,
    materialDiff
  };
}

/**
 * Compute safe moves from engine suggestions, filtering out losing captures
 * @param {Chess} chess - Chess.js instance
 * @param {Array} engineBestMoves - Engine's best moves
 * @returns {Array<string>} Safe move suggestions (SAN notation)
 */
function computeSafeMoves(chess, engineBestMoves) {
  const safeMoves = [];

  // Get all legal moves to check captures
  const allMoves = chess.moves({ verbose: true });
  const moveMap = new Map(allMoves.map(m => [m.san, m]));

  // Process engine suggestions
  for (const engineMove of engineBestMoves) {
    const san = engineMove.san;
    const verboseMove = moveMap.get(san);

    if (!verboseMove) continue;

    // If it's a capture, check SEE
    if (verboseMove.captured) {
      const seeValue = staticExchangeEvaluation(chess, verboseMove);
      // Only include if not losing material (SEE >= -50)
      if (seeValue >= -50) {
        safeMoves.push(san);
      }
    } else {
      // Non-captures are safe by default
      safeMoves.push(san);
    }

    // Limit to top 5 safe moves
    if (safeMoves.length >= 5) break;
  }

  return safeMoves;
}

/**
 * Generate human-readable description of evaluation
 * @param {number} cp - Centipawns, already normalized to student perspective
 * @returns {string} Human-readable description
 */
function describeEval(cp) {
  const absVal = Math.abs(cp);

  if (absVal < 25) return "Equal position";
  if (absVal < 75) return cp > 0 ? "Slight advantage" : "Slight disadvantage";
  if (absVal < 150) return cp > 0 ? "Clear advantage" : "Clear disadvantage";
  if (absVal < 300) return cp > 0 ? "Winning position" : "Losing position";
  return cp > 0 ? "Decisive advantage" : "Decisive disadvantage";
}

module.exports = getPositionAnalysis;
