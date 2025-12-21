/**
 * Coach Event Handler
 * Detects coaching events from student moves and creates trigger messages
 * Includes shouldSpeak policy to prevent over-talking
 */

const getMoveAnalysis = require('../tools/getMoveAnalysis');
const getThreats = require('../tools/getThreats');
const { CoachEventType } = require('../types/analysis');
const { Chess } = require('chess.js');

/**
 * @typedef {'silent' | 'critical' | 'teaching'} CoachMode
 * - silent: Never speak proactively
 * - critical: Only speak for severity 3 events
 * - teaching: Speak for severity 2+ events with throttling
 */

/**
 * Analyze a student move and generate coach events
 * Reuses getMoveAnalysis to avoid duplicating eval logic
 * @param {string} beforeFen - FEN before the student's move
 * @param {string} studentMove - The move the student played (SAN)
 * @param {Object} gameContext - Game context with fen, studentColor, etc.
 * @returns {Promise<Array>} Array of CoachEvent objects
 */
async function analyzeStudentMove(beforeFen, studentMove, gameContext) {
  const events = [];
  const { studentColor } = gameContext;

  if (!beforeFen || !studentMove || !studentColor) {
    console.warn('[COACH] Missing required parameters for analyzeStudentMove');
    return events;
  }

  // Use centralized move analysis (avoids duplicating engine calls)
  const moveResult = await getMoveAnalysis(studentMove, { fen: beforeFen, studentColor });

  if (moveResult.error) {
    console.warn('[COACH] Move analysis failed:', moveResult.error);
    return events; // Invalid move, no events
  }

  const { evalBefore, evalAfter, evalDelta, bestMove, classification } = moveResult;

  // CRITICAL_BLUNDER: blunder classification AND >= 300cp loss
  if (classification === 'blunder' && evalDelta <= -300) {
    events.push({
      type: CoachEventType.CRITICAL_BLUNDER,
      severity: 3,
      studentMove,
      metadata: {
        summary: `Lost ${Math.abs(evalDelta)} centipawns with ${studentMove}`,
        evalDrop: Math.abs(evalDelta),
        bestWas: bestMove
      }
    });
  }

  // MISSED_WIN: Had +300+ but dropped to ~0 or worse
  if (evalBefore >= 300 && evalAfter <= 50) {
    events.push({
      type: CoachEventType.MISSED_WIN,
      severity: 3,
      studentMove,
      metadata: {
        summary: `Had a winning position (+${(evalBefore / 100).toFixed(1)}) but threw it away`,
        winningMove: bestMove
      }
    });
  }

  // HANGING_PIECE: Check position after move for student's hanging pieces
  const afterFen = getPositionAfterMove(beforeFen, studentMove);
  if (afterFen) {
    const threats = await getThreats({ fen: afterFen, studentColor });

    if (threats.hangingPieces && threats.hangingPieces.length > 0) {
      const hangingPiece = threats.hangingPieces[0];
      events.push({
        type: CoachEventType.HANGING_PIECE,
        severity: 2,
        studentMove,
        metadata: {
          summary: `Your ${hangingPiece.piece} on ${hangingPiece.square} is now undefended`,
          hangingPiece
        }
      });
    }
  }

  // MODEL_MOVE: Student found best in complex position
  if (studentMove === bestMove && evalDelta >= -10 && evalBefore > 100) {
    events.push({
      type: CoachEventType.MODEL_MOVE,
      severity: 1,
      studentMove,
      metadata: {
        summary: `Found the best move in a complex position!`
      }
    });
  }

  console.log(`[COACH] Generated ${events.length} events for move ${studentMove}`);
  return events;
}

/**
 * Get FEN after making a move
 * @param {string} fen - Starting FEN
 * @param {string} moveSan - Move in SAN notation
 * @returns {string|null} Resulting FEN or null if move is invalid
 */
function getPositionAfterMove(fen, moveSan) {
  try {
    const chess = new Chess(fen);
    const result = chess.move(moveSan);
    if (!result) return null;
    return chess.fen();
  } catch (error) {
    console.warn('[COACH] Failed to apply move:', error.message);
    return null;
  }
}

/**
 * Determine if Irina should speak about this event
 * Prevents over-talking in non-critical situations
 * @param {Object} event - CoachEvent object
 * @param {Object} context - Context with mode and recent events
 * @param {CoachMode} [context.mode='teaching'] - Coach mode
 * @param {Array} [context.recentEvents=[]] - Recent events for throttling
 * @returns {boolean} True if Irina should speak
 */
function shouldSpeak(event, context = {}) {
  const { mode = 'teaching', recentEvents = [] } = context;

  // Silent mode: never speak proactively
  if (mode === 'silent') {
    return false;
  }

  // Always address severity 3 (critical) events
  if (event.severity === 3) {
    return true;
  }

  // Critical mode: only severity 3
  if (mode === 'critical') {
    return false;
  }

  // Teaching mode: throttle repetition
  // Don't repeat same event type within last 6 moves
  const recentOfType = recentEvents.slice(-6).filter(e => e.type === event.type);
  if (recentOfType.length > 0) {
    return false;
  }

  // Severity 2 events pass in teaching mode
  return event.severity >= 2;
}

/**
 * Create trigger message if event passes shouldSpeak policy
 * @param {Object} event - CoachEvent object
 * @param {Object} [context={}] - Context for shouldSpeak
 * @returns {Object|null} Trigger message or null
 */
function createTriggerMessage(event, context = {}) {
  if (!shouldSpeak(event, context)) {
    return null;
  }

  return {
    role: 'user',
    content: `[COACH_TRIGGER: ${event.type}]
Student just played: ${event.studentMove}
Issue: ${event.metadata.summary}
Severity: ${event.severity}/3

Use your tools to analyze this and provide coaching feedback.`
  };
}

/**
 * Process all events for a move and return trigger messages
 * @param {Array} events - Array of CoachEvent objects
 * @param {Object} context - Context for shouldSpeak
 * @returns {Array} Array of trigger messages
 */
function processMoveEvents(events, context = {}) {
  const triggers = [];

  for (const event of events) {
    const trigger = createTriggerMessage(event, context);
    if (trigger) {
      triggers.push(trigger);
      // Update recent events for throttling
      if (context.recentEvents) {
        context.recentEvents.push(event);
      }
    }
  }

  return triggers;
}

module.exports = {
  analyzeStudentMove,
  createTriggerMessage,
  shouldSpeak,
  processMoveEvents,
  getPositionAfterMove
};
