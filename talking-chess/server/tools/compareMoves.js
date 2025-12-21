/**
 * Compare Moves Tool
 * Side-by-side comparison of two candidate moves
 */

const getMoveAnalysis = require('./getMoveAnalysis');

/**
 * Compare two candidate moves and provide a recommendation
 * @param {string} move1 - First move in SAN notation
 * @param {string} move2 - Second move in SAN notation
 * @param {Object} gameContext - Game context with fen and studentColor
 * @returns {Promise<Object>} Comparison result with recommendation
 */
async function compareMoves(move1, move2, gameContext) {
  if (!move1 || !move2) {
    return { error: 'Both move1 and move2 are required' };
  }

  if (move1 === move2) {
    return { error: 'Cannot compare a move with itself' };
  }

  // Analyze both moves in parallel for efficiency
  const [analysis1, analysis2] = await Promise.all([
    getMoveAnalysis(move1, gameContext),
    getMoveAnalysis(move2, gameContext)
  ]);

  // Handle errors from either analysis
  if (analysis1.error) {
    return { error: `Error analyzing ${move1}: ${analysis1.error}` };
  }
  if (analysis2.error) {
    return { error: `Error analyzing ${move2}: ${analysis2.error}` };
  }

  // Determine which move is better based on eval after
  const betterMove = analysis1.evalAfter >= analysis2.evalAfter ? move1 : move2;
  const reasoning = generateReasoning(analysis1, analysis2);

  return {
    move1: {
      move: move1,
      eval: analysis1.evalAfter,
      classification: analysis1.classification,
      note: analysis1.explanation
    },
    move2: {
      move: move2,
      eval: analysis2.evalAfter,
      classification: analysis2.classification,
      note: analysis2.explanation
    },
    recommendation: betterMove,
    reasoning
  };
}

/**
 * Generate reasoning for the recommendation
 * @param {Object} a1 - Analysis of move1
 * @param {Object} a2 - Analysis of move2
 * @returns {string} Reasoning explanation
 */
function generateReasoning(a1, a2) {
  const diff = Math.abs(a1.evalAfter - a2.evalAfter);
  const better = a1.evalAfter >= a2.evalAfter ? a1 : a2;
  const worse = a1.evalAfter >= a2.evalAfter ? a2 : a1;

  // Nearly equal moves
  if (diff < 20) {
    if (better.classification === worse.classification) {
      return `Both moves are roughly equal. Either is fine.`;
    }
    return `Both moves are close in evaluation, but ${better.move} has a slightly better classification.`;
  }

  // Clear difference
  if (diff < 100) {
    return `${better.move} is better by about ${Math.round(diff / 10) / 10} pawns.`;
  }

  // Large difference
  if (diff < 300) {
    return `${better.move} is significantly better (+${Math.round(diff)} cp). ${worse.move} would be ${worse.classification === 'blunder' ? 'a blunder' : 'much weaker'}.`;
  }

  // Huge difference
  return `${better.move} is clearly winning. ${worse.move} would be a serious mistake (${worse.classification}).`;
}

module.exports = compareMoves;
