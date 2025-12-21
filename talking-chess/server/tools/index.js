/**
 * Tool Registry - Central hub for Irina's chess analysis tools
 * Provides OpenAI function definitions and dispatches tool calls
 */

const getPositionAnalysis = require('./getPositionAnalysis');
const getMoveAnalysis = require('./getMoveAnalysis');
const getThreats = require('./getThreats');
const compareMoves = require('./compareMoves');

/**
 * OpenAI function/tool definitions for the API request
 * These define the schema that OpenAI uses for function calling
 */
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_position_analysis",
      description: "Get detailed analysis of the current position including phase (opening/middlegame/endgame), evaluation in centipawns, and positional factors like material balance, king safety, mobility, and pawn structure.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_move_analysis",
      description: "Analyze a specific move - either one the student played or is considering. Returns classification (best/good/inaccuracy/mistake/blunder), evaluation change, what the best move was, and an explanation.",
      parameters: {
        type: "object",
        properties: {
          move: {
            type: "string",
            description: "The move in SAN notation (e.g., 'Nf3', 'exd5', 'O-O')"
          }
        },
        required: ["move"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_threats",
      description: "Get tactical threats and opportunities in the current position. Returns hanging pieces, available checks, capture opportunities, and warnings about dangers.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_moves",
      description: "Compare two candidate moves side-by-side. Use when the student asks 'should I play X or Y?'. Returns evaluation and classification for both moves with a recommendation.",
      parameters: {
        type: "object",
        properties: {
          move1: {
            type: "string",
            description: "First move to compare in SAN notation"
          },
          move2: {
            type: "string",
            description: "Second move to compare in SAN notation"
          }
        },
        required: ["move1", "move2"]
      }
    }
  }
];

/**
 * Execute a tool by name with given arguments
 * @param {string} name - Tool name (e.g., 'get_position_analysis')
 * @param {Object} args - Arguments parsed from OpenAI's function call
 * @param {Object} gameContext - Current game context with fen, studentColor, etc.
 * @returns {Promise<Object>} Tool result
 */
async function executeTool(name, args, gameContext) {
  console.log(`[TOOL] Executing ${name}`, args);

  try {
    switch (name) {
      case 'get_position_analysis':
        return await getPositionAnalysis(gameContext);

      case 'get_move_analysis':
        if (!args.move) {
          return { error: 'Missing required parameter: move' };
        }
        return await getMoveAnalysis(args.move, gameContext);

      case 'get_threats':
        return await getThreats(gameContext);

      case 'compare_moves':
        if (!args.move1 || !args.move2) {
          return { error: 'Missing required parameters: move1 and move2' };
        }
        return await compareMoves(args.move1, args.move2, gameContext);

      default:
        console.error(`[TOOL] Unknown tool: ${name}`);
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`[TOOL] Error executing ${name}:`, error.message);
    return { error: `Tool execution failed: ${error.message}` };
  }
}

/**
 * Get tool names for logging/debugging
 * @returns {string[]} Array of tool names
 */
function getToolNames() {
  return toolDefinitions.map(t => t.function.name);
}

module.exports = {
  toolDefinitions,
  executeTool,
  getToolNames
};
