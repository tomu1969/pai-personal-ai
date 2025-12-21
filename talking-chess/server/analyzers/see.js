/**
 * Static Exchange Evaluation (SEE) Utility
 * Determines if a capture sequence is winning, equal, or losing
 */

const { Chess } = require('chess.js');

// Piece values for SEE calculation
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

/**
 * Static Exchange Evaluation - determines if a capture sequence is winning
 * Simulates optimal play from both sides on a single square
 * @param {Chess} chess - Chess.js instance (will not be modified)
 * @param {Object} move - The capture move (verbose format with san, to, piece, captured)
 * @returns {number} SEE value in centipawns (positive = winning for attacker)
 */
function staticExchangeEvaluation(chess, move) {
  const testChess = new Chess(chess.fen());
  const targetSquare = move.to;

  // Build the gain list - what each side wins at each step
  const gains = [];

  // Step 0: Initial capture
  gains.push(PIECE_VALUES[move.captured] || 0);

  // Make the initial capture
  try {
    testChess.move(move.san);
  } catch (e) {
    return 0; // Invalid move
  }

  // Track value of piece currently on the target square
  let pieceOnSquare = PIECE_VALUES[move.piece] || 0;

  // Simulate the exchange
  const maxDepth = 32;
  for (let depth = 0; depth < maxDepth; depth++) {
    // Find least valuable attacker for current side
    const recapture = findLeastValuableAttacker(testChess, targetSquare);

    if (!recapture) {
      break; // No more attackers, exchange ends
    }

    // Record what this capture gains (the piece currently on the square)
    gains.push(pieceOnSquare);

    // Update piece on square to the new attacker
    pieceOnSquare = PIECE_VALUES[recapture.piece] || 0;

    // Make the recapture
    try {
      testChess.move(recapture.san);
    } catch (e) {
      break;
    }
  }

  // Compute SEE using negamax on the gains array
  // If only one gain (no recapture possible), return it directly
  if (gains.length === 1) {
    return gains[0];
  }

  // Work backwards: for each recapture, the side can choose to take or not
  // But the INITIAL capture is forced (we're evaluating that specific move)
  let runningValue = 0;
  for (let i = gains.length - 1; i >= 1; i--) {
    // Side to move at step i can choose to capture (getting gains[i] - runningValue) or stop (0)
    runningValue = Math.max(0, gains[i] - runningValue);
  }

  // The initial capture is NOT optional - return what the attacker gets minus opponent's best response
  return gains[0] - runningValue;
}

/**
 * Find the least valuable piece attacking a square
 * @param {Chess} chess - Chess.js instance
 * @param {string} square - Target square
 * @returns {Object|null} The capture move or null
 */
function findLeastValuableAttacker(chess, square) {
  const moves = chess.moves({ verbose: true });
  // Find any move to the target square (it will be a capture since there's a piece there)
  const attackers = moves.filter(m => m.to === square);

  if (attackers.length === 0) {
    return null;
  }

  // Sort by piece value (ascending) and return the least valuable
  attackers.sort((a, b) => {
    return (PIECE_VALUES[a.piece] || 0) - (PIECE_VALUES[b.piece] || 0);
  });

  return attackers[0];
}

/**
 * Convert SEE value to verdict
 * @param {number} seeValue - SEE in centipawns
 * @returns {'winning'|'equal'|'losing'} Verdict
 */
function getVerdict(seeValue) {
  if (seeValue > 50) return 'winning';
  if (seeValue >= -50) return 'equal';
  return 'losing';
}

module.exports = {
  staticExchangeEvaluation,
  findLeastValuableAttacker,
  getVerdict,
  PIECE_VALUES
};
