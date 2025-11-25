/**
 * Board Radar Analyzer - Deterministic Chess Analysis
 * Provides exact occupied square listing for verification against visual board
 */

const { Chess } = require('chess.js');

/**
 * Get board radar showing exactly which squares are occupied by which pieces
 * @param {string} fen - The FEN string to analyze
 * @returns {string} - Formatted string of occupied squares with piece details
 */
function getBoardRadar(fen) {
  if (!fen || typeof fen !== 'string') {
    return '[BOARD_RADAR_ERROR: Invalid FEN]';
  }

  try {
    const chess = new Chess(fen);
    const board = chess.board();
    const occupiedSquares = [];

    // Iterate through the 8x8 board array
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece !== null) {
          const square = String.fromCharCode(97 + file) + (8 - rank); // Convert to algebraic notation
          const color = piece.color === 'w' ? 'White' : 'Black';
          const pieceNames = {
            'p': 'Pawn', 'r': 'Rook', 'n': 'Knight', 
            'b': 'Bishop', 'q': 'Queen', 'k': 'King'
          };
          const pieceName = pieceNames[piece.type] || 'Unknown';
          
          occupiedSquares.push(`[${square}: ${color} ${pieceName}]`);
        }
      }
    }

    if (occupiedSquares.length === 0) {
      return '[BOARD_RADAR: Empty board detected - possible error]';
    }

    // Sort squares for consistent output (a1, a2, ..., h8)
    occupiedSquares.sort((a, b) => {
      const squareA = a.match(/\[([a-h][1-8]):/)[1];
      const squareB = b.match(/\[([a-h][1-8]):/)[1];
      return squareA.localeCompare(squareB);
    });

    return occupiedSquares.join(' ');
  } catch (error) {
    return `[BOARD_RADAR_ERROR: ${error.message}]`;
  }
}

/**
 * Get a summary count of pieces for quick verification
 * @param {string} fen - The FEN string to analyze
 * @returns {Object} - Object with piece counts by color
 */
function getPieceCounts(fen) {
  if (!fen || typeof fen !== 'string') {
    return { error: 'Invalid FEN' };
  }

  try {
    const chess = new Chess(fen);
    const board = chess.board();
    const counts = {
      white: { total: 0, pawns: 0, pieces: 0 },
      black: { total: 0, pawns: 0, pieces: 0 }
    };

    board.flat().forEach(piece => {
      if (piece !== null) {
        const color = piece.color === 'w' ? 'white' : 'black';
        counts[color].total++;
        if (piece.type === 'p') {
          counts[color].pawns++;
        } else {
          counts[color].pieces++;
        }
      }
    });

    return counts;
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  getBoardRadar,
  getPieceCounts
};