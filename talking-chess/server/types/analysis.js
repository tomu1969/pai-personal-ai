/**
 * Analysis Types - Central type definitions for Irina's tool-based architecture
 */

/**
 * @typedef {'w' | 'b'} Color
 */

/**
 * @typedef {Object} GameContext
 * @property {string} fen - Current position in FEN notation
 * @property {Color} studentColor - Which color the student is playing
 * @property {string} [gameId] - Optional game identifier
 * @property {number} [ply] - Optional ply number
 */

/**
 * Coach event types - used to trigger Irina's coaching responses
 */
const CoachEventType = {
  // Phase 1: Live events
  CRITICAL_BLUNDER: "CRITICAL_BLUNDER",   // evalDelta <= -300
  MISSED_WIN: "MISSED_WIN",               // Had +300+, threw it away
  MISSED_TACTIC: "MISSED_TACTIC",         // Best was forcing, gain >= 150cp
  HANGING_PIECE: "HANGING_PIECE",         // Piece left undefended
  MODEL_MOVE: "MODEL_MOVE",               // Student found best move

  // Phase 2: Game-level events (future)
  REPEATED_THEME: "REPEATED_THEME",       // Same issue 3+ times
  PHASE_TRANSITION: "PHASE_TRANSITION",   // Entering new phase with advantage
  TIME_MISMANAGEMENT: "TIME_MISMANAGEMENT", // If timestamps provided
  GAME_SUMMARY: "GAME_SUMMARY"            // End-of-game recap
};

/**
 * @typedef {'silent' | 'critical' | 'teaching'} CoachMode
 * - silent: Never speak proactively
 * - critical: Only speak for severity 3 events
 * - teaching: Speak for severity 2+ events with throttling
 */

/**
 * @typedef {Object} CoachEvent
 * @property {string} type - One of CoachEventType values
 * @property {1|2|3} severity - 1=optional, 2=recommended, 3=must address
 * @property {string} studentMove - The move that triggered this event
 * @property {Object} metadata - Event-specific details
 * @property {string} metadata.summary - Human-readable summary
 */

/**
 * @typedef {Object} PositionAnalysis
 * @property {string} phase - "opening" | "middlegame" | "endgame"
 * @property {number} evalCp - Centipawns, normalized to student perspective
 * @property {string} evalDescription - Human-readable eval description
 * @property {number} materialDiff - Material difference (student - opponent)
 * @property {number} kingSafety - 0-100 score for student's king
 * @property {number} mobility - 0-100 score based on legal moves
 * @property {number} pawnStructure - 0-100 score for student's pawns
 */

/**
 * @typedef {Object} MoveAnalysis
 * @property {string} move - The analyzed move in SAN
 * @property {string} classification - "best" | "good" | "inaccuracy" | "mistake" | "blunder"
 * @property {number} evalBefore - Centipawns before move
 * @property {number} evalAfter - Centipawns after move
 * @property {number} evalDelta - Change in eval (negative = worse)
 * @property {string} bestMove - The best move in position
 * @property {number} bestMoveEval - Eval of best move
 * @property {string} explanation - Human-readable explanation
 */

/**
 * @typedef {Object} ThreatAnalysis
 * @property {boolean} inCheck - Whether side to move is in check
 * @property {Array<{piece: string, square: string}>} hangingPieces - Undefended pieces
 * @property {string[]} checksAvailable - Available check moves
 * @property {Array<{move: string, captures: string, givesCheck: boolean}>} capturesAvailable
 * @property {string[]} warnings - Human-readable warnings
 */

/**
 * @typedef {Object} MoveComparison
 * @property {Object} move1 - First move analysis
 * @property {Object} move2 - Second move analysis
 * @property {string} recommendation - Recommended move
 * @property {string} reasoning - Why one is better
 */

module.exports = { CoachEventType };
