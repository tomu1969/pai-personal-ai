/**
 * Get Move Analysis Tool
 * Analyzes a specific move and returns classification, eval change, and explanation
 */

const { analyzePosition } = require('../analyzers/engine');
const { Chess } = require('chess.js');

/**
 * Analyze a specific move in the current position
 * @param {string} moveSan - Move in SAN notation (e.g., 'Nf3', 'exd5')
 * @param {Object} gameContext - Game context with fen and studentColor
 * @param {string} gameContext.fen - Position in FEN notation
 * @param {'w'|'b'} gameContext.studentColor - Which color the student is playing
 * @returns {Promise<Object>} Move analysis with classification and explanation
 */
async function getMoveAnalysis(moveSan, gameContext) {
  const { fen, studentColor } = gameContext;

  if (!fen) {
    return { error: 'Missing fen in gameContext' };
  }
  if (!moveSan) {
    return { error: 'Missing move parameter' };
  }

  let chess;
  try {
    chess = new Chess(fen);
  } catch (error) {
    return { error: `Invalid FEN: ${error.message}` };
  }

  // Validate move is legal
  const legalMoves = chess.moves();
  if (!legalMoves.includes(moveSan)) {
    // Try to find similar moves for better error message
    const similar = legalMoves.filter(m =>
      m.toLowerCase().includes(moveSan.toLowerCase().replace(/[+#x]/g, ''))
    );
    if (similar.length > 0) {
      return { error: `Illegal move: ${moveSan}. Did you mean: ${similar.join(', ')}?` };
    }
    return { error: `Illegal move: ${moveSan}. Legal moves: ${legalMoves.slice(0, 10).join(', ')}${legalMoves.length > 10 ? '...' : ''}` };
  }

  // Get side to move (this is the student making the move)
  const sideToMove = chess.turn();

  // Get eval BEFORE move (with best move info)
  // Engine returns eval from side-to-move perspective
  let bestMove = { san: legalMoves[0], eval: 0 };
  try {
    const beforeResult = await analyzePosition(fen, { depth: 16, multiPv: 3 });
    if (beforeResult.bestMoves && beforeResult.bestMoves.length > 0) {
      bestMove = beforeResult.bestMoves[0];
    }
  } catch (error) {
    console.warn('[TOOL] Engine analysis before move failed:', error.message);
  }

  // Normalize to student perspective
  // Before move: if student == side to move, use as-is; else flip
  const bestMoveEvalRaw = (bestMove.eval || 0) * 100;
  const bestMoveEval = studentColor === sideToMove ? bestMoveEvalRaw : -bestMoveEvalRaw;

  // Make the move and get eval AFTER
  chess.move(moveSan);
  const afterFen = chess.fen();
  const afterSideToMove = chess.turn(); // This is now the opponent

  let evalAfterRaw = 0;
  try {
    const afterResult = await analyzePosition(afterFen, { depth: 16, multiPv: 1 });
    if (afterResult.bestMoves && afterResult.bestMoves.length > 0) {
      evalAfterRaw = (afterResult.bestMoves[0].eval || 0) * 100;
    }
  } catch (error) {
    console.warn('[TOOL] Engine analysis after move failed:', error.message);
  }

  // Normalize to student perspective
  // After move: now opponent is to move, so if student != afterSideToMove, use as-is; else flip
  const evalAfter = studentColor === afterSideToMove ? evalAfterRaw : -evalAfterRaw;
  const evalBefore = bestMoveEval;
  const evalDelta = evalAfter - evalBefore;

  // Check if this was the best move
  const isBest = moveSan === bestMove.san;

  // Classification based on eval loss
  const classification = classifyMove(evalDelta, isBest);

  // Generate explanation
  const explanation = generateExplanation(moveSan, bestMove.san, evalDelta, classification);

  return {
    move: moveSan,
    classification,
    evalBefore: Math.round(evalBefore),
    evalAfter: Math.round(evalAfter),
    evalDelta: Math.round(evalDelta),
    bestMove: bestMove.san,
    bestMoveEval: Math.round(bestMoveEval),
    explanation
  };
}

/**
 * Classify a move based on eval delta
 * @param {number} evalDelta - Change in eval (negative = worse)
 * @param {boolean} isBest - Whether this was the engine's best move
 * @returns {string} Classification: best, good, inaccuracy, mistake, blunder
 */
function classifyMove(evalDelta, isBest) {
  if (isBest && evalDelta >= -10) return 'best';
  if (evalDelta > -50) return 'good';
  if (evalDelta > -150) return 'inaccuracy';
  if (evalDelta > -300) return 'mistake';
  return 'blunder';
}

/**
 * Generate human-readable explanation for the move
 * @param {string} move - The played move
 * @param {string} best - The best move
 * @param {number} delta - Eval change
 * @param {string} classification - Move classification
 * @returns {string} Explanation
 */
function generateExplanation(move, best, delta, classification) {
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  switch (classification) {
    case 'best':
      return `${move} is the best move in this position.`;
    case 'good':
      if (move === best) {
        return `${move} is the best move.`;
      }
      return `${move} is a good move. ${best} was slightly better (${deltaStr} cp).`;
    case 'inaccuracy':
      return `${move} is an inaccuracy (${deltaStr} cp). ${best} was better.`;
    case 'mistake':
      return `${move} is a mistake (${deltaStr} cp). ${best} was much better.`;
    case 'blunder':
      return `${move} is a blunder (${deltaStr} cp). ${best} was necessary.`;
    default:
      return `${move} evaluated at ${deltaStr} cp compared to best.`;
  }
}

module.exports = getMoveAnalysis;
