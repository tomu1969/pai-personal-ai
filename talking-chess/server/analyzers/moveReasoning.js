/**
 * Move Reasoning Analyzer - Engine-Based Chess Analysis
 * Provides strategic analysis using Stockfish engine evaluations
 */

const { Chess } = require('chess.js');
const { analyzePosition } = require('./engine');

/**
 * Get strategic analysis using Stockfish engine
 * @param {string} fen - Position in FEN notation
 * @param {Object} options - Analysis options
 * @param {number} options.depth - Search depth (default: 16)
 * @param {number} options.multiPv - Number of lines to analyze (default: 3)
 * @returns {Promise<Array>} Array of move analyses with labels and evaluations
 */
async function getStrategicAnalysis(fen, options = {}) {
  const { depth = 16, multiPv = 3 } = options;

  try {
    console.log(`[STRATEGY] Analyzing position with depth ${depth}, multiPv ${multiPv}`);

    // Get engine evaluation
    const engineResult = await analyzePosition(fen, { depth, multiPv });

    if (!engineResult.bestMoves || engineResult.bestMoves.length === 0) {
      console.error('[STRATEGY] Engine returned no moves');
      return [];
    }

    const chess = new Chess(fen);
    const analyses = [];

    // Best eval is from the first move (highest ranked by engine)
    const bestEval = engineResult.bestMoves[0].eval;

    for (const move of engineResult.bestMoves) {
      // Calculate quality label based on eval difference from best move
      const label = getQualityLabel(bestEval, move.eval);

      // Generate human-readable explanation
      const explanation = generateMoveExplanation(chess, move.san);

      analyses.push({
        san: move.san,
        uci: move.uci,
        eval: move.eval,
        mateIn: move.mateIn,
        label,
        explanation,
        pvSan: move.pvSan
      });
    }

    console.log(`[STRATEGY] Analysis complete: ${analyses.length} moves evaluated`);
    return analyses;

  } catch (error) {
    console.error('[STRATEGY] Engine analysis failed:', error.message);
    // Return empty array on failure - contextBuilder will handle fallback
    return [];
  }
}

/**
 * Determine quality label based on evaluation difference from best move
 * @param {number} bestEval - Evaluation of the best move
 * @param {number} moveEval - Evaluation of this move
 * @returns {string} Quality label
 */
function getQualityLabel(bestEval, moveEval) {
  const diff = bestEval - moveEval;

  if (diff <= 0.3) return 'best';
  if (diff <= 0.8) return 'ok';
  if (diff <= 1.5) return 'inaccurate';
  if (diff <= 3.0) return 'mistake';
  return 'blunder';
}

/**
 * Generate human-readable explanation for a move
 * @param {Chess} chess - Chess.js instance with current position
 * @param {string} san - Move in SAN notation
 * @returns {string} Explanation of what the move does
 */
function generateMoveExplanation(chess, san) {
  try {
    const possibleMoves = chess.moves({ verbose: true });
    const moveData = possibleMoves.find(m => m.san === san);

    if (!moveData) {
      return 'positional move';
    }

    const reasons = [];

    // Captures
    if (moveData.captured) {
      const capturedPiece = getPieceName(moveData.captured);
      reasons.push(`captures ${capturedPiece}`);
    }

    // Check
    if (san.includes('+')) {
      reasons.push('gives check');
    }

    // Checkmate
    if (san.includes('#')) {
      reasons.push('delivers checkmate');
    }

    // Castling
    if (moveData.flags.includes('k') || moveData.flags.includes('q')) {
      const side = moveData.flags.includes('k') ? 'kingside' : 'queenside';
      reasons.push(`castles ${side} for king safety`);
    }

    // Piece development
    const pieceType = moveData.piece;
    const fromSquare = moveData.from;
    const toSquare = moveData.to;

    if ((pieceType === 'n' || pieceType === 'b') && isBackRankSquare(fromSquare)) {
      reasons.push('develops piece');
    }

    // Center control
    if (isCenterSquare(toSquare)) {
      if (pieceType === 'p') {
        reasons.push('claims center');
      } else {
        reasons.push('controls center');
      }
    }

    // Promotion
    if (moveData.promotion) {
      reasons.push(`promotes to ${getPieceName(moveData.promotion)}`);
    }

    // Default descriptions by piece type
    if (reasons.length === 0) {
      reasons.push(getDefaultDescription(pieceType));
    }

    return reasons.join(', ');

  } catch (error) {
    return 'positional move';
  }
}

/**
 * Format strategic analysis array into a string for the prompt
 * @param {Array} analyses - Array of move analyses
 * @returns {string} Formatted string for prompt injection
 */
function formatStrategicAnalysis(analyses) {
  if (!analyses || analyses.length === 0) {
    return '[ANALYSIS_ERROR: No moves analyzed]';
  }

  return analyses.map(move => {
    const evalStr = move.mateIn
      ? `mate in ${Math.abs(move.mateIn)}`
      : `${move.eval >= 0 ? '+' : ''}${move.eval.toFixed(1)}`;

    return `**${move.san}** (${move.label}, eval: ${evalStr}): ${move.explanation}`;
  }).join('\n');
}

// Helper functions

function getPieceName(pieceType) {
  const names = {
    'p': 'pawn',
    'r': 'rook',
    'n': 'knight',
    'b': 'bishop',
    'q': 'queen',
    'k': 'king'
  };
  return names[pieceType] || 'piece';
}

function isBackRankSquare(square) {
  return square.includes('1') || square.includes('8');
}

function isCenterSquare(square) {
  return ['d4', 'd5', 'e4', 'e5'].includes(square);
}

function getDefaultDescription(pieceType) {
  const descriptions = {
    'p': 'pawn move',
    'n': 'knight maneuver',
    'b': 'bishop development',
    'r': 'rook activation',
    'q': 'queen activity',
    'k': 'king move'
  };
  return descriptions[pieceType] || 'positional move';
}

/**
 * Get position type based on material and move count
 * @param {Chess} chess - Chess.js instance
 * @returns {string} Position phase description
 */
function getPositionType(chess) {
  try {
    const fen = chess.fen();
    const piecePart = fen.split(' ')[0];

    // Count major/minor pieces (excluding pawns and kings)
    const pieceCount = (piecePart.match(/[qrbnQRBN]/g) || []).length;
    const moveNumber = parseInt(fen.split(' ')[5], 10) || 1;

    if (moveNumber <= 10 && pieceCount >= 12) {
      return 'Opening';
    } else if (pieceCount <= 6) {
      return 'Endgame';
    } else {
      return 'Middlegame';
    }
  } catch (error) {
    return 'Unknown';
  }
}

module.exports = {
  getStrategicAnalysis,
  formatStrategicAnalysis,
  generateMoveExplanation,
  getQualityLabel,
  getPositionType,
  getPieceName
};
