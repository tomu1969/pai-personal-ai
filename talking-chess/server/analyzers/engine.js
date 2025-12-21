/**
 * Stockfish Engine Wrapper - Server-Side Chess Analysis
 * Uses child_process to run Stockfish WASM via Node.js
 * Falls back to heuristic analysis if engine unavailable
 */

const { Chess } = require('chess.js');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Singleton engine state
let engineProcess = null;
let engineReady = false;
let initPromise = null;
let messageQueue = [];
let currentCallback = null;

// Request queue for serializing engine access
let requestQueue = [];
let isProcessingRequest = false;

/**
 * Find the stockfish engine JS file
 */
function findEngineFile() {
  const srcDir = path.join(__dirname, '../../node_modules/stockfish/src');

  if (!fs.existsSync(srcDir)) {
    return null;
  }

  // Look for single-threaded lite version (smaller, works without CORS)
  const files = fs.readdirSync(srcDir);

  // Prefer lite-single for server use (smaller, no threading issues)
  const liteSingle = files.find(f => f.includes('lite-single') && f.endsWith('.js'));
  if (liteSingle) {
    return path.join(srcDir, liteSingle);
  }

  // Fall back to single-threaded full version
  const single = files.find(f => f.includes('single') && f.endsWith('.js') && !f.includes('lite'));
  if (single) {
    return path.join(srcDir, single);
  }

  // Last resort: any .js file
  const anyJs = files.find(f => f.endsWith('.js') && !f.includes('asm'));
  if (anyJs) {
    return path.join(srcDir, anyJs);
  }

  return null;
}

/**
 * Initialize the Stockfish engine via child process
 * @returns {Promise<boolean>} True if engine ready
 */
async function initEngine() {
  if (engineReady && engineProcess) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve) => {
    try {
      const engineFile = findEngineFile();

      if (!engineFile) {
        console.warn('[ENGINE] Stockfish engine file not found, using fallback');
        resolve(false);
        return;
      }

      console.log('[ENGINE] Starting Stockfish:', path.basename(engineFile));

      // Spawn node with the stockfish js file
      const args = [engineFile];

      // Add experimental flags for older Node.js versions if needed
      const nodeVersion = parseInt(process.version.slice(1), 10);
      if (nodeVersion >= 14 && nodeVersion < 19) {
        args.unshift('--experimental-wasm-threads');
        args.unshift('--experimental-wasm-simd');
      }

      engineProcess = spawn(process.execPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let initTimeout = null;
      let buffer = '';

      engineProcess.stdout.on('data', (data) => {
        buffer += data.toString();

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            handleEngineMessage(line.trim());
          }
        }
      });

      engineProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg && !msg.includes('ExperimentalWarning')) {
          console.error('[ENGINE] stderr:', msg);
        }
      });

      engineProcess.on('error', (err) => {
        console.error('[ENGINE] Process error:', err.message);
        cleanup();
        resolve(false);
      });

      engineProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.warn('[ENGINE] Process exited with code:', code);
        }
        cleanup();
        // Reject any pending requests since engine crashed
        while (requestQueue.length > 0) {
          const { reject } = requestQueue.shift();
          reject(new Error('Engine crashed'));
        }
        isProcessingRequest = false;
      });

      // Wait for UCI ready
      const originalCallback = currentCallback;
      currentCallback = (line) => {
        if (line === 'uciok') {
          clearTimeout(initTimeout);
          engineReady = true;
          console.log('[ENGINE] Stockfish ready');
          currentCallback = originalCallback;
          resolve(true);
        }
      };

      // Send UCI init command
      sendCommand('uci');

      // Timeout after 10 seconds
      initTimeout = setTimeout(() => {
        console.warn('[ENGINE] Initialization timeout, using fallback');
        cleanup();
        resolve(false);
      }, 10000);

    } catch (error) {
      console.error('[ENGINE] Init error:', error.message);
      initPromise = null;
      resolve(false);
    }
  });

  return initPromise;
}

/**
 * Handle engine output messages
 */
function handleEngineMessage(line) {
  if (currentCallback) {
    currentCallback(line);
  }
  messageQueue.push(line);
}

/**
 * Send command to engine
 */
function sendCommand(cmd) {
  if (engineProcess && engineProcess.stdin) {
    engineProcess.stdin.write(cmd + '\n');
  }
}

/**
 * Cleanup engine resources
 */
function cleanup() {
  engineReady = false;
  initPromise = null;
  if (engineProcess) {
    try {
      engineProcess.kill();
    } catch (e) {
      // Ignore
    }
    engineProcess = null;
  }
}

/**
 * Convert UCI move to SAN
 */
function uciToSan(fen, uciMove) {
  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
    const move = chess.move({ from, to, promotion });
    return move ? move.san : null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse centipawn score to pawn units
 */
function cpToPawns(cp) {
  return Math.round(cp / 10) / 10;
}

/**
 * Convert mate score to large value
 */
function mateToPawns(mateIn) {
  const baseValue = 100;
  return mateIn > 0 ? baseValue - mateIn : -baseValue - mateIn;
}

/**
 * Process the next request in the queue
 */
async function processNextRequest() {
  if (isProcessingRequest || requestQueue.length === 0) {
    return;
  }

  isProcessingRequest = true;
  const { fen, options, resolve, reject } = requestQueue.shift();

  try {
    const result = await executeEngineAnalysis(fen, options);
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isProcessingRequest = false;
    // Process next request after a small delay to let engine settle
    if (requestQueue.length > 0) {
      setTimeout(processNextRequest, 50);
    }
  }
}

/**
 * Queue an analysis request (serializes engine access)
 */
function queueAnalysis(fen, options) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fen, options, resolve, reject });
    processNextRequest();
  });
}

/**
 * Execute analysis on the engine (internal - called by queue processor)
 */
async function executeEngineAnalysis(fen, options) {
  const { depth, multiPv, timeout } = options;

  return new Promise((resolve, reject) => {
    const results = new Map();
    let timeoutId = null;

    const cleanup = () => {
      clearTimeout(timeoutId);
      currentCallback = null;
    };

    currentCallback = (line) => {
      // Parse info lines
      if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
        const parsed = parseInfoLine(line);
        if (parsed && parsed.multipv) {
          results.set(parsed.multipv, parsed);
        }
      }

      // Best move signals completion
      if (line.startsWith('bestmove')) {
        cleanup();
        resolve(formatResults(fen, results));
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      if (results.size > 0) {
        resolve(formatResults(fen, results));
      } else {
        reject(new Error('Engine timeout'));
      }
    }, timeout);

    // Send analysis commands
    sendCommand('ucinewgame');
    sendCommand(`position fen ${fen}`);
    sendCommand(`setoption name MultiPV value ${multiPv}`);
    sendCommand(`go depth ${depth}`);
  });
}

/**
 * Analyze position with the Stockfish engine (queued)
 */
async function analyzeWithEngine(fen, options) {
  return queueAnalysis(fen, options);
}

/**
 * Parse UCI info line
 */
function parseInfoLine(line) {
  const result = {};

  const multipvMatch = line.match(/multipv (\d+)/);
  result.multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;

  const depthMatch = line.match(/depth (\d+)/);
  result.depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

  const cpMatch = line.match(/score cp (-?\d+)/);
  const mateMatch = line.match(/score mate (-?\d+)/);

  if (cpMatch) {
    result.scoreCp = parseInt(cpMatch[1], 10);
    result.eval = cpToPawns(result.scoreCp);
  } else if (mateMatch) {
    result.mateIn = parseInt(mateMatch[1], 10);
    result.eval = mateToPawns(result.mateIn);
  } else {
    return null;
  }

  const pvMatch = line.match(/ pv (.+)$/);
  if (pvMatch) {
    result.pvUci = pvMatch[1].trim().split(' ');
    result.uci = result.pvUci[0];
  } else {
    return null;
  }

  return result;
}

/**
 * Format engine results
 */
function formatResults(fen, results) {
  const bestMoves = [];
  const sortedResults = Array.from(results.values()).sort((a, b) => a.multipv - b.multipv);

  for (const data of sortedResults) {
    const san = uciToSan(fen, data.uci);
    if (!san) continue;

    let pvSan = '';
    if (data.pvUci && data.pvUci.length > 0) {
      const pvChess = new Chess(fen);
      const sanMoves = [];
      for (const uciMove of data.pvUci.slice(0, 5)) {
        const from = uciMove.substring(0, 2);
        const to = uciMove.substring(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
        const move = pvChess.move({ from, to, promotion });
        if (move) {
          sanMoves.push(move.san);
        } else {
          break;
        }
      }
      pvSan = sanMoves.join(' ');
    }

    bestMoves.push({
      san,
      uci: data.uci,
      eval: data.eval,
      mateIn: data.mateIn || null,
      pvSan,
      depth: data.depth
    });
  }

  return { bestMoves };
}

/**
 * Fallback analysis using chess.js heuristics
 */
function analyzeWithFallback(chess) {
  console.log('[ENGINE] Using fallback heuristic analysis');

  const moves = chess.moves({ verbose: true });

  const scoredMoves = moves.map(move => {
    let score = 0;

    // Captures
    if (move.captured) {
      const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
      score += (pieceValues[move.captured] || 0) * 10;
    }

    // Checks
    if (move.san.includes('+')) score += 5;
    if (move.san.includes('#')) score += 100;

    // Center control
    if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) score += 3;

    // Castling
    if (move.flags.includes('k') || move.flags.includes('q')) score += 4;

    // Development
    if ((move.piece === 'n' || move.piece === 'b') &&
        (move.from.includes('1') || move.from.includes('8'))) {
      score += 2;
    }

    return { move, score };
  });

  scoredMoves.sort((a, b) => b.score - a.score);
  const topMoves = scoredMoves.slice(0, 3);

  const bestMoves = topMoves.map((item, index) => ({
    san: item.move.san,
    uci: item.move.from + item.move.to + (item.move.promotion || ''),
    eval: 0.5 - (index * 0.2),
    mateIn: null,
    pvSan: item.move.san,
    depth: 1
  }));

  return { bestMoves };
}

/**
 * Main analysis function - tries engine, falls back to heuristics
 * @param {string} fen - Position in FEN notation
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis result with best moves
 */
async function analyzePosition(fen, options = {}) {
  const { depth = 16, multiPv = 3, timeout = 8000 } = options;

  // Validate FEN
  let chess;
  try {
    chess = new Chess(fen);
  } catch (error) {
    throw new Error(`Invalid FEN: ${error.message}`);
  }

  // Check for game over
  if (chess.isGameOver()) {
    return { bestMoves: [], gameOver: true };
  }

  // Try engine analysis
  try {
    const ready = await initEngine();
    if (ready) {
      return await analyzeWithEngine(fen, { depth, multiPv, timeout });
    }
  } catch (error) {
    console.warn('[ENGINE] Engine analysis failed:', error.message);
  }

  // Fall back to heuristics
  return analyzeWithFallback(chess);
}

/**
 * Shutdown the engine
 */
function shutdownEngine() {
  console.log('[ENGINE] Shutting down');
  if (engineProcess) {
    sendCommand('quit');
  }
  cleanup();
}

module.exports = {
  analyzePosition,
  initEngine,
  shutdownEngine,
  uciToSan
};
