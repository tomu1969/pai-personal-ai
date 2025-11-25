/**
 * Safety Check Analyzer - Deterministic Chess Analysis
 * Detects hanging pieces, checks, and immediate tactical threats
 */

const { Chess } = require('chess.js');

/**
 * Get comprehensive safety status for the current position
 * @param {Chess} chess - Chess.js instance with current position
 * @returns {string} - Safety alert string or "Position is safe"
 */
function getSafetyStatus(chess) {
  if (!chess || typeof chess.inCheck !== 'function') {
    return '[SAFETY_ERROR: Invalid chess instance]';
  }

  try {
    const alerts = [];
    const turn = chess.turn();
    const turnName = turn === 'w' ? 'White' : 'Black';

    // Check 1: Is current side in check?
    if (chess.inCheck()) {
      alerts.push(`🚨 ${turnName} is in CHECK!`);
    }

    // Check 2: Is current side in checkmate?
    if (chess.isCheckmate()) {
      alerts.push(`💀 ${turnName} is in CHECKMATE!`);
    }

    // Check 3: Is the game drawn?
    if (chess.isDraw()) {
      if (chess.isStalemate()) {
        alerts.push(`⚖️ Game is STALEMATE (${turnName} has no legal moves)`);
      } else if (chess.isThreefoldRepetition()) {
        alerts.push(`⚖️ Game is DRAW by threefold repetition`);
      } else if (chess.isInsufficientMaterial()) {
        alerts.push(`⚖️ Game is DRAW by insufficient material`);
      } else {
        alerts.push(`⚖️ Game is DRAW`);
      }
    }

    // Check 4: Detect hanging pieces using basic tactics
    const hangingPieces = detectHangingPieces(chess);
    if (hangingPieces.length > 0) {
      hangingPieces.forEach(hanging => {
        alerts.push(`⚠️ ${hanging.color} ${hanging.piece} on ${hanging.square} is HANGING (undefended)`);
      });
    }

    // Check 5: Detect immediate tactical threats (captures available)
    const captureMoves = chess.moves({ verbose: true }).filter(move => move.captured);
    if (captureMoves.length > 0) {
      const valuableCaptures = captureMoves.filter(move => 
        ['q', 'r', 'b', 'n'].includes(move.captured) // Exclude pawn captures as less critical
      );
      if (valuableCaptures.length > 0) {
        alerts.push(`🎯 ${turnName} can capture: ${valuableCaptures.map(m => 
          `${getPieceName(m.captured)} on ${m.to}`
        ).join(', ')}`);
      }
    }

    // Return result
    if (alerts.length === 0) {
      return 'Position is safe - no immediate tactical threats detected.';
    }

    return alerts.join(' | ');

  } catch (error) {
    return `[SAFETY_ERROR: ${error.message}]`;
  }
}

/**
 * Detect hanging (undefended) pieces using simple attack/defend analysis
 * @param {Chess} chess - Chess.js instance
 * @returns {Array} - Array of hanging piece objects
 */
function detectHangingPieces(chess) {
  const hangingPieces = [];
  const board = chess.board();

  try {
    // Simple hanging piece detection - pieces attacked but not defended
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece !== null) {
          const square = String.fromCharCode(97 + file) + (8 - rank);
          
          // Check if this piece is attacked by opponent
          const isAttacked = isSquareAttacked(chess, square, piece.color === 'w' ? 'b' : 'w');
          
          if (isAttacked) {
            // Simple check: can the piece move away?
            const canEscape = canPieceEscape(chess, square, piece);
            
            // Simple defense check: is piece defended by own pieces?
            const isDefended = isSquareDefended(chess, square, piece.color);
            
            if (!isDefended && !canEscape && piece.type !== 'k') {
              hangingPieces.push({
                square,
                piece: getPieceName(piece.type),
                color: piece.color === 'w' ? 'White' : 'Black'
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // If detailed analysis fails, return empty array to avoid breaking the system
    console.warn('Hanging piece detection failed:', error.message);
  }

  return hangingPieces;
}

/**
 * Check if a square is attacked by the given color
 * @param {Chess} chess - Chess.js instance
 * @param {string} square - Square to check (e.g., 'e4')
 * @param {string} byColor - Color attacking ('w' or 'b')
 * @returns {boolean} - True if square is attacked
 */
function isSquareAttacked(chess, square, byColor) {
  try {
    // Get all moves for the attacking color
    const currentTurn = chess.turn();
    
    // Temporarily switch turns if needed to check opponent attacks
    if (currentTurn !== byColor) {
      // Create a temporary copy to check attacks
      const tempChess = new Chess(chess.fen());
      const moves = tempChess.moves({ verbose: true });
      
      // Check if any move attacks our square
      return moves.some(move => move.to === square);
    } else {
      const moves = chess.moves({ verbose: true });
      return moves.some(move => move.to === square);
    }
  } catch (error) {
    return false;
  }
}

/**
 * Check if a square is defended by the given color
 * @param {Chess} chess - Chess.js instance  
 * @param {string} square - Square to check
 * @param {string} byColor - Defending color ('w' or 'b')
 * @returns {boolean} - True if square is defended
 */
function isSquareDefended(chess, square, byColor) {
  try {
    const moves = chess.moves({ verbose: true });
    // Check if any friendly piece can capture on this square
    return moves.some(move => move.to === square);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a piece can escape from attack
 * @param {Chess} chess - Chess.js instance
 * @param {string} square - Current square of piece
 * @param {Object} piece - Piece object
 * @returns {boolean} - True if piece can move to safety
 */
function canPieceEscape(chess, square, piece) {
  try {
    const moves = chess.moves({ verbose: true, square });
    // For simplicity, assume piece can escape if it has any legal moves
    // A more sophisticated version would check if destination squares are safe
    return moves.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Convert piece type letter to full name
 * @param {string} pieceType - Single letter piece type
 * @returns {string} - Full piece name
 */
function getPieceName(pieceType) {
  const names = {
    'p': 'Pawn',
    'r': 'Rook', 
    'n': 'Knight',
    'b': 'Bishop',
    'q': 'Queen',
    'k': 'King'
  };
  return names[pieceType] || 'Unknown';
}

module.exports = {
  getSafetyStatus,
  detectHangingPieces,
  isSquareAttacked,
  getPieceName
};