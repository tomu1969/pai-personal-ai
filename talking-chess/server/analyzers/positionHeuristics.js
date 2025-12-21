/**
 * Position Heuristics - Calculate positional scores for chess positions
 * Used by getPositionAnalysis tool to provide grounded information
 */

const { Chess } = require('chess.js');

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Calculate material difference from student's perspective
 * @param {string} fen - Position in FEN notation
 * @param {'w'|'b'} studentColor - Which color the student is playing
 * @returns {number} Material difference in pawns (positive = student ahead)
 */
function calculateMaterialDiff(fen, studentColor) {
  const chess = new Chess(fen);
  const board = chess.board();
  let studentMaterial = 0;
  let opponentMaterial = 0;

  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === studentColor) {
          studentMaterial += value;
        } else {
          opponentMaterial += value;
        }
      }
    }
  }

  return studentMaterial - opponentMaterial;
}

/**
 * Calculate mobility score based on legal move count
 * @param {Chess} chess - Chess.js instance with current position
 * @returns {number} Mobility score 0-100
 */
function calculateMobilityScore(chess) {
  const moveCount = chess.moves().length;
  // Average middlegame position has ~30-40 legal moves
  // Score 100 at 50+ moves, scales linearly
  return Math.min(100, Math.round((moveCount / 50) * 100));
}

/**
 * Calculate king safety score for a given color
 * @param {Chess} chess - Chess.js instance with current position
 * @param {'w'|'b'} color - Which king to evaluate
 * @returns {number} King safety score 0-100
 */
function calculateKingSafetyScore(chess, color) {
  let score = 50; // Base score
  const fen = chess.fen();
  const castling = fen.split(' ')[2];
  const kingSquare = findKingSquare(chess, color);

  if (!kingSquare) {
    return 0; // Should never happen in valid position
  }

  // Castled bonus - king on g1/c1 or g8/c8
  const castledSquares = color === 'w' ? ['g1', 'c1'] : ['g8', 'c8'];
  if (castledSquares.includes(kingSquare)) {
    score += 25;
  } else {
    // Can still castle bonus
    const canCastle = color === 'w'
      ? /[KQ]/.test(castling)
      : /[kq]/.test(castling);
    if (canCastle) {
      score += 10;
    }
  }

  // Pawn shield bonus
  score += evaluatePawnShield(chess, kingSquare, color);

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate pawn shield in front of king
 * @param {Chess} chess - Chess.js instance
 * @param {string} kingSquare - King's square (e.g., 'g1')
 * @param {'w'|'b'} color - King's color
 * @returns {number} Bonus/penalty for pawn shield (-15 to +15)
 */
function evaluatePawnShield(chess, kingSquare, color) {
  const board = chess.board();
  const file = kingSquare.charCodeAt(0) - 97; // 0-7
  const rank = parseInt(kingSquare[1], 10);

  // Direction pawns should be (white pawns in front = higher rank)
  const pawnDirection = color === 'w' ? 1 : -1;
  const shieldRank = rank + pawnDirection;

  // Check for pawns on adjacent files in shield position
  let shieldCount = 0;
  const filesToCheck = [file - 1, file, file + 1].filter(f => f >= 0 && f <= 7);

  for (const f of filesToCheck) {
    const boardRank = 8 - shieldRank; // Convert to 0-indexed board array
    if (boardRank >= 0 && boardRank < 8) {
      const piece = board[boardRank][f];
      if (piece && piece.type === 'p' && piece.color === color) {
        shieldCount++;
      }
    }
  }

  // Up to +15 for full shield, -10 for no shield
  return shieldCount > 0 ? shieldCount * 5 : -10;
}

/**
 * Calculate pawn structure score for a given color
 * @param {Chess} chess - Chess.js instance with current position
 * @param {'w'|'b'} color - Which color's pawns to evaluate
 * @returns {number} Pawn structure score 0-100
 */
function calculatePawnStructureScore(chess, color) {
  let score = 70; // Base score (decent structure)
  const pawns = findPawns(chess, color);

  if (pawns.length === 0) {
    return 50; // No pawns = neutral
  }

  // Doubled pawns penalty
  const fileCounts = {};
  for (const pawn of pawns) {
    const file = pawn[0];
    fileCounts[file] = (fileCounts[file] || 0) + 1;
  }
  for (const count of Object.values(fileCounts)) {
    if (count > 1) {
      score -= 10 * (count - 1);
    }
  }

  // Isolated pawns penalty
  for (const pawn of pawns) {
    if (isIsolatedPawn(pawns, pawn)) {
      score -= 8;
    }
  }

  // Passed pawn bonus
  for (const pawn of pawns) {
    if (isPassedPawn(chess, pawn, color)) {
      score += 15;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Find king's square for a given color
 * @param {Chess} chess - Chess.js instance
 * @param {'w'|'b'} color - Which king to find
 * @returns {string|null} Square in algebraic notation (e.g., 'e1')
 */
function findKingSquare(chess, color) {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return String.fromCharCode(97 + c) + (8 - r);
      }
    }
  }
  return null;
}

/**
 * Find all pawns for a given color
 * @param {Chess} chess - Chess.js instance
 * @param {'w'|'b'} color - Which color's pawns to find
 * @returns {string[]} Array of squares (e.g., ['e4', 'd5'])
 */
function findPawns(chess, color) {
  const pawns = [];
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'p' && piece.color === color) {
        pawns.push(String.fromCharCode(97 + c) + (8 - r));
      }
    }
  }
  return pawns;
}

/**
 * Check if a pawn is isolated (no friendly pawns on adjacent files)
 * @param {string[]} pawns - All friendly pawn squares
 * @param {string} pawn - The pawn to check
 * @returns {boolean} True if isolated
 */
function isIsolatedPawn(pawns, pawn) {
  const file = pawn.charCodeAt(0);
  const adjacentFiles = [file - 1, file + 1];

  for (const otherPawn of pawns) {
    if (otherPawn === pawn) continue;
    const otherFile = otherPawn.charCodeAt(0);
    if (adjacentFiles.includes(otherFile)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a pawn is passed (no enemy pawns blocking or attacking its path)
 * @param {Chess} chess - Chess.js instance
 * @param {string} pawn - Pawn square to check
 * @param {'w'|'b'} color - Pawn's color
 * @returns {boolean} True if passed
 */
function isPassedPawn(chess, pawn, color) {
  const board = chess.board();
  const file = pawn.charCodeAt(0) - 97;
  const rank = parseInt(pawn[1], 10);
  const enemyColor = color === 'w' ? 'b' : 'w';

  // Files to check (pawn's file and adjacent files)
  const filesToCheck = [file - 1, file, file + 1].filter(f => f >= 0 && f <= 7);

  // Ranks to check (all ranks ahead of the pawn)
  const ranksToCheck = [];
  if (color === 'w') {
    for (let r = rank + 1; r <= 8; r++) ranksToCheck.push(r);
  } else {
    for (let r = rank - 1; r >= 1; r--) ranksToCheck.push(r);
  }

  // Check for enemy pawns blocking the path
  for (const f of filesToCheck) {
    for (const r of ranksToCheck) {
      const boardRank = 8 - r;
      if (boardRank >= 0 && boardRank < 8) {
        const piece = board[boardRank][f];
        if (piece && piece.type === 'p' && piece.color === enemyColor) {
          return false;
        }
      }
    }
  }

  return true;
}

module.exports = {
  calculateMaterialDiff,
  calculateMobilityScore,
  calculateKingSafetyScore,
  calculatePawnStructureScore,
  findKingSquare,
  findPawns,
  isIsolatedPawn,
  isPassedPawn,
  PIECE_VALUES
};
