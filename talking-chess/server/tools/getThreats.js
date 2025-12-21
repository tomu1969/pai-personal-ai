/**
 * Get Threats Tool
 * Returns tactical threats and opportunities in the current position
 * Includes SEE (Static Exchange Evaluation) for capture quality
 */

const { detectHangingPieces } = require('../analyzers/safetyCheck');
const { staticExchangeEvaluation, getVerdict, PIECE_VALUES } = require('../analyzers/see');
const { Chess } = require('chess.js');

/**
 * Analyze threats and opportunities in the current position
 * @param {Object} gameContext - Game context with fen and studentColor
 * @param {string} gameContext.fen - Position in FEN notation
 * @param {'w'|'b'} gameContext.studentColor - Which color the student is playing
 * @returns {Promise<Object>} Threat analysis with hanging pieces, checks, captures
 */
async function getThreats(gameContext) {
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

  const sideToMove = chess.turn();

  // Check if in check
  const inCheck = typeof chess.isCheck === 'function' ? chess.isCheck() : chess.in_check();

  // Find hanging pieces - filter to student's pieces
  let allHangingPieces = [];
  try {
    allHangingPieces = detectHangingPieces(chess);
  } catch (error) {
    console.warn('[TOOL] detectHangingPieces failed:', error.message);
  }

  // Filter to only student's hanging pieces
  const hangingPieces = allHangingPieces.filter(hp => {
    const pieceInfo = getPieceAt(chess, hp.square);
    return pieceInfo && pieceInfo.color === studentColor;
  }).map(hp => ({
    piece: getPieceName(hp.piece),
    square: hp.square,
    canBeCapturedBy: hp.attackedBy || 'opponent piece'
  }));

  // Find available checks (moves that give check)
  const checksAvailable = findChecks(chess);

  // Find available captures WITH tactical evaluation
  const capturesAvailable = evaluateCaptures(chess);

  // Find opponent threats (what they could capture on their next move)
  const opponentThreats = findOpponentThreats(chess, studentColor);

  // Generate warnings from student's perspective
  const warnings = generateWarnings(hangingPieces, inCheck, studentColor, sideToMove, opponentThreats);

  // Add summary for LLM
  const safeCaptureCount = capturesAvailable.filter(c => c.verdict === 'winning' || c.verdict === 'equal').length;
  const summary = generateTacticalSummary(capturesAvailable, checksAvailable, hangingPieces, inCheck, opponentThreats);

  return {
    inCheck,
    hangingPieces,
    checksAvailable,
    capturesAvailable,
    opponentThreats,
    warnings,
    summary
  };
}

/**
 * Evaluate all captures using SEE (Static Exchange Evaluation)
 * @param {Chess} chess - Chess.js instance
 * @returns {Array} Captures with verdict (winning/equal/losing)
 */
function evaluateCaptures(chess) {
  const moves = chess.moves({ verbose: true });
  const captures = moves.filter(m => m.captured);

  return captures.map(move => {
    const seeValue = staticExchangeEvaluation(chess, move);
    const verdict = getVerdict(seeValue);
    const capturedValue = PIECE_VALUES[move.captured] || 0;
    const attackerValue = PIECE_VALUES[move.piece] || 0;

    return {
      move: move.san,
      captures: getPieceName(move.captured),
      capturedValue: Math.round(capturedValue / 100),  // In pawns
      attackerPiece: getPieceName(move.piece),
      attackerValue: Math.round(attackerValue / 100),
      seeValue: Math.round(seeValue / 100),  // In pawns
      verdict,
      givesCheck: move.san.includes('+') || move.san.includes('#'),
      explanation: generateCaptureExplanation(move, seeValue, verdict)
    };
  }).sort((a, b) => {
    // Sort: winning first, then equal, then losing
    const verdictOrder = { winning: 0, equal: 1, losing: 2 };
    if (verdictOrder[a.verdict] !== verdictOrder[b.verdict]) {
      return verdictOrder[a.verdict] - verdictOrder[b.verdict];
    }
    // Within same verdict, sort by SEE value (highest first)
    return b.seeValue - a.seeValue;
  });
}

// SEE functions imported from ../analyzers/see.js

/**
 * Generate human-readable explanation for a capture
 */
function generateCaptureExplanation(move, seeValue, verdict) {
  const attacker = getPieceName(move.piece);
  const captured = getPieceName(move.captured);

  if (verdict === 'winning') {
    return `${attacker} takes ${captured} - wins material`;
  } else if (verdict === 'equal') {
    return `${attacker} takes ${captured} - even trade`;
  } else {
    return `${attacker} takes ${captured} - LOSES material (you lose the ${attacker} back)`;
  }
}

/**
 * Generate tactical summary for LLM
 */
function generateTacticalSummary(captures, checks, hanging, inCheck, opponentThreats = []) {
  const parts = [];

  if (inCheck) {
    parts.push("YOU ARE IN CHECK - must respond to check");
  }

  const winning = captures.filter(c => c.verdict === 'winning');
  const losing = captures.filter(c => c.verdict === 'losing');

  if (winning.length > 0) {
    parts.push(`${winning.length} winning capture(s) available: ${winning.map(c => c.move).join(', ')}`);
  }

  if (losing.length > 0) {
    parts.push(`WARNING: ${losing.length} capture(s) LOSE material - avoid: ${losing.map(c => c.move).join(', ')}`);
  }

  if (checks.length > 0) {
    parts.push(`${checks.length} check(s) available: ${checks.join(', ')}`);
  }

  if (hanging.length > 0) {
    parts.push(`DANGER: ${hanging.length} piece(s) hanging: ${hanging.map(h => h.piece + ' on ' + h.square).join(', ')}`);
  }

  // Add opponent threats to summary (winning OR equal trades on pieces)
  const significantThreats = opponentThreats.filter(t =>
    t.verdict === 'winning' ||
    (t.verdict === 'equal' && ['queen', 'rook', 'bishop', 'knight'].includes(t.threatens))
  );
  if (significantThreats.length > 0) {
    const threatList = significantThreats.slice(0, 3).map(t => `${t.threatens} on ${t.threatenedSquare} (${t.move})`).join(', ');
    parts.push(`OPPONENT THREATENS: ${threatList}`);
  }

  if (parts.length === 0) {
    parts.push("No immediate tactical opportunities or threats");
  }

  return parts.join('. ');
}

/**
 * Find what the opponent threatens (captures they could make on their turn)
 * @param {Chess} chess - Chess.js instance
 * @param {string} studentColor - Student's color ('w' or 'b')
 * @returns {Array} List of opponent's threatening captures
 */
function findOpponentThreats(chess, studentColor) {
  // Create a copy and make a null move to see opponent's perspective
  const testChess = new Chess(chess.fen());

  // Swap the turn by modifying FEN
  const fenParts = testChess.fen().split(' ');
  fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w';  // Flip side to move

  let opponentChess;
  try {
    opponentChess = new Chess(fenParts.join(' '));
  } catch (e) {
    // Invalid position after turn swap (shouldn't happen in normal games)
    return [];
  }

  // Get all opponent captures
  const opponentMoves = opponentChess.moves({ verbose: true });
  const opponentCaptures = opponentMoves.filter(m => m.captured);

  // Filter to captures of student's pieces and evaluate with SEE
  const threats = opponentCaptures.map(move => {
    const seeValue = staticExchangeEvaluation(opponentChess, move);
    const verdict = getVerdict(seeValue);

    return {
      move: move.san,
      threatens: getPieceName(move.captured),
      threatenedSquare: move.to,
      attackerPiece: getPieceName(move.piece),
      seeValue: Math.round(seeValue / 100),
      verdict,  // From opponent's view: 'winning' means bad for student
      explanation: `${getPieceName(move.piece)} can take ${getPieceName(move.captured)} on ${move.to}`
    };
  }).filter(t => t.verdict === 'winning' || t.verdict === 'equal')  // Only real threats
    .sort((a, b) => b.seeValue - a.seeValue);  // Biggest threats first

  return threats;
}

/**
 * Get piece at a square
 */
function getPieceAt(chess, square) {
  try {
    return chess.get(square);
  } catch (error) {
    return null;
  }
}

/**
 * Find all moves that give check
 */
function findChecks(chess) {
  const moves = chess.moves({ verbose: true });
  return moves
    .filter(m => m.san.includes('+') || m.san.includes('#'))
    .map(m => m.san);
}

/**
 * Get human-readable piece name
 */
function getPieceName(type) {
  const names = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king'
  };
  return names[type?.toLowerCase()] || 'piece';
}

/**
 * Generate warning messages for the student
 */
function generateWarnings(hangingPieces, inCheck, studentColor, sideToMove, opponentThreats = []) {
  const warnings = [];

  if (inCheck && sideToMove === studentColor) {
    warnings.push("You are in check!");
  }

  for (const piece of hangingPieces) {
    warnings.push(`Your ${piece.piece} on ${piece.square} is undefended!`);
  }

  // Add warnings for significant opponent threats (winning OR equal trades on valuable pieces)
  const seriousThreats = opponentThreats.filter(t =>
    t.verdict === 'winning' ||
    (t.verdict === 'equal' && ['queen', 'rook', 'bishop', 'knight'].includes(t.threatens))
  );
  for (const threat of seriousThreats.slice(0, 2)) {  // Max 2 threats
    warnings.push(`Your ${threat.threatens} on ${threat.threatenedSquare} is threatened by ${threat.attackerPiece}!`);
  }

  return warnings;
}

module.exports = getThreats;
