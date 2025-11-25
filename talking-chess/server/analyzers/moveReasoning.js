/**
 * Move Reasoning Analyzer - Deterministic Chess Analysis
 * Provides specific strategic reasons for chess moves based on computed analysis
 */

const { Chess } = require('chess.js');

/**
 * Get strategic analysis for a list of top moves
 * @param {Chess} chess - Chess.js instance with current position
 * @param {Array} topMoves - Array of top move strings (e.g., ['Nf3', 'e4', 'd4'])
 * @returns {string} - Formatted strategic analysis of moves
 */
function getStrategicAnalysis(chess, topMoves) {
  if (!chess || typeof chess.moves !== 'function') {
    return '[STRATEGY_ERROR: Invalid chess instance]';
  }

  if (!topMoves || topMoves.length === 0) {
    return '[STRATEGY_ERROR: No moves provided for analysis]';
  }

  try {
    const moveAnalyses = [];
    
    // Analyze each provided move
    topMoves.forEach(moveStr => {
      const analysis = analyzeSingleMove(chess, moveStr);
      if (analysis) {
        moveAnalyses.push(`**${moveStr}**: ${analysis}`);
      }
    });

    if (moveAnalyses.length === 0) {
      return '[STRATEGY_ERROR: No valid moves could be analyzed]';
    }

    return moveAnalyses.join(' | ');

  } catch (error) {
    return `[STRATEGY_ERROR: ${error.message}]`;
  }
}

/**
 * Analyze a single move and provide strategic reasoning
 * @param {Chess} chess - Chess.js instance
 * @param {string} moveStr - Move in SAN notation (e.g., 'Nf3')
 * @returns {string} - Strategic reasoning for the move
 */
function analyzeSingleMove(chess, moveStr) {
  try {
    // Get detailed move information
    const possibleMoves = chess.moves({ verbose: true });
    const moveData = possibleMoves.find(move => move.san === moveStr);
    
    if (!moveData) {
      return `[Invalid move: ${moveStr} not legal in current position]`;
    }

    const reasons = [];
    
    // Analyze based on move characteristics
    
    // 1. Captures
    if (moveData.captured) {
      const capturedPiece = getPieceName(moveData.captured);
      reasons.push(`Captures ${capturedPiece}`);
    }
    
    // 2. Checks
    if (moveData.san.includes('+')) {
      reasons.push('Gives check');
    }
    
    // 3. Checkmate
    if (moveData.san.includes('#')) {
      reasons.push('Delivers checkmate');
    }
    
    // 4. Castling
    if (moveData.flags.includes('k') || moveData.flags.includes('q')) {
      const side = moveData.flags.includes('k') ? 'kingside' : 'queenside';
      reasons.push(`Castles ${side} for king safety`);
    }
    
    // 5. Piece development and strategic factors
    const pieceType = moveData.piece;
    const fromSquare = moveData.from;
    const toSquare = moveData.to;
    
    // Development analysis
    if (pieceType === 'n' || pieceType === 'b') {
      if (isBackRankSquare(fromSquare)) {
        reasons.push('Develops piece from back rank');
      }
      
      if (isCenterSquare(toSquare) || controlsCenterSquares(chess, moveData)) {
        reasons.push('Controls center squares');
      }
    }
    
    // Pawn moves
    if (pieceType === 'p') {
      if (isCenterSquare(toSquare)) {
        reasons.push('Claims center space');
      }
      
      if (isPawnAdvancement(moveData)) {
        reasons.push('Advances pawn structure');
      }
    }
    
    // Queen moves
    if (pieceType === 'q') {
      if (isEarlyQueenMove(chess, moveData)) {
        reasons.push('Early queen development (risky)');
      } else {
        reasons.push('Activates queen');
      }
    }
    
    // King moves
    if (pieceType === 'k') {
      if (!isCastlingMove(moveData)) {
        reasons.push('King move for safety or activity');
      }
    }
    
    // 6. Tactical patterns
    if (createsFork(chess, moveData)) {
      reasons.push('Creates fork opportunity');
    }
    
    if (pinsPiece(chess, moveData)) {
      reasons.push('Pins opponent piece');
    }
    
    // 7. Positional factors
    if (improvesPiecePosition(chess, moveData)) {
      reasons.push('Improves piece positioning');
    }
    
    // If no specific reasons found, provide general assessment
    if (reasons.length === 0) {
      reasons.push(getGeneralMoveAssessment(chess, moveData));
    }
    
    return reasons.join(', ');
    
  } catch (error) {
    return `[Error analyzing ${moveStr}: ${error.message}]`;
  }
}

/**
 * Helper functions for move analysis
 */

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

function isExtendedCenterSquare(square) {
  return ['c3', 'c4', 'c5', 'c6', 'd3', 'd4', 'd5', 'd6', 
          'e3', 'e4', 'e5', 'e6', 'f3', 'f4', 'f5', 'f6'].includes(square);
}

function controlsCenterSquares(chess, moveData) {
  // Simple check: if piece lands on extended center
  return isExtendedCenterSquare(moveData.to);
}

function isPawnAdvancement(moveData) {
  if (moveData.piece !== 'p') return false;
  
  const fromRank = parseInt(moveData.from[1]);
  const toRank = parseInt(moveData.to[1]);
  
  // White pawn advancing (increasing rank number)
  if (fromRank < toRank) return true;
  // Black pawn advancing (decreasing rank number)
  if (fromRank > toRank) return true;
  
  return false;
}

function isEarlyQueenMove(chess, moveData) {
  if (moveData.piece !== 'q') return false;
  
  // Consider it early if few pieces are developed
  const history = chess.history();
  return history.length < 8; // Arbitrary threshold for "early"
}

function isCastlingMove(moveData) {
  return moveData.flags.includes('k') || moveData.flags.includes('q');
}

function createsFork(chess, moveData) {
  // Simple fork detection would require position analysis after the move
  // For now, return false to avoid complexity
  return false;
}

function pinsPiece(chess, moveData) {
  // Simple pin detection would require analyzing piece alignments
  // For now, return false to avoid complexity
  return false;
}

function improvesPiecePosition(chess, moveData) {
  // Simple heuristic: moving from edge to center is usually improvement
  const fromFile = moveData.from[0];
  const toFile = moveData.to[0];
  
  const edgeFiles = ['a', 'h'];
  const centralFiles = ['d', 'e'];
  
  // Moving from edge to center
  if (edgeFiles.includes(fromFile) && centralFiles.includes(toFile)) {
    return true;
  }
  
  return false;
}

function getGeneralMoveAssessment(chess, moveData) {
  // Provide general assessment based on piece type
  const assessments = {
    'p': 'Pawn move affects structure',
    'n': 'Knight move for better squares',
    'b': 'Bishop repositioning',
    'r': 'Rook activation',
    'q': 'Queen maneuver',
    'k': 'King repositioning'
  };
  
  return assessments[moveData.piece] || 'Positional move';
}

/**
 * Get a simplified strategic summary for position type
 * @param {Chess} chess - Chess.js instance
 * @returns {string} - Position type description
 */
function getPositionType(chess) {
  try {
    const history = chess.history();
    const moveCount = history.length;
    
    if (moveCount < 8) {
      return 'Opening phase - focus on development and center control';
    } else if (moveCount < 40) {
      return 'Middlegame - tactical and strategic maneuvering';
    } else {
      return 'Endgame - king activity and pawn promotion';
    }
  } catch (error) {
    return 'Position analysis unavailable';
  }
}

module.exports = {
  getStrategicAnalysis,
  analyzeSingleMove,
  getPositionType,
  getPieceName
};