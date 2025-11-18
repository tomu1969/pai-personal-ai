/**
 * Stockfish Engine Wrapper Module
 * Manages communication with Stockfish.js engine via Web Worker
 */

class StockfishEngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.isThinking = false;
    this.pendingCallbacks = new Map();
    this.messageId = 0;
    this.currentConfig = null;
    this.evaluationCallbacks = new Set();
    this.currentEvaluation = null;
  }

  /**
   * Initialize the Stockfish engine
   * @returns {Promise} Resolves when engine is ready
   */
  async init() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Initializing Stockfish engine...');
        
        // Check if Web Workers are supported
        if (!window.Worker) {
          throw new Error('Web Workers not supported in this browser');
        }

        // Create Web Worker with Stockfish (try local first, fallback to CDN)
        try {
          this.worker = new Worker('stockfish.js');
          console.log('Using local Stockfish.js');
        } catch (e) {
          console.log('Local Stockfish.js not found, trying CDN...');
          this.worker = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
          console.log('Using CDN Stockfish.js');
        }
        
        // Set up message handler
        this.worker.onmessage = (event) => {
          console.log('Worker message received:', event.data);
          this.handleEngineMessage(event.data);
        };
        
        // Set up error handler  
        this.worker.onerror = (error) => {
          console.error('Stockfish Worker error:', error);
          console.error('Worker error details:', error.message, error.filename, error.lineno);
          reject(new Error('Failed to initialize Stockfish engine: ' + error.message));
        };
        
        console.log('Worker created successfully, sending UCI command...');
        
        // Store initialization callback
        this.pendingCallbacks.set('init', resolve);
        
        // Send UCI initialization command
        this.sendCommand('uci');
        
        // Set timeout for initialization
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Engine initialization timeout'));
          }
        }, 10000);
        
      } catch (error) {
        console.error('Engine initialization failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Send command to Stockfish engine
   * @param {string} command - UCI command to send
   */
  sendCommand(command) {
    if (!this.worker) {
      console.error('Engine not initialized');
      return;
    }
    
    console.log('UCI command:', command);
    this.worker.postMessage(command);
  }

  /**
   * Handle messages from Stockfish engine
   * @param {string} message - Message from engine
   */
  handleEngineMessage(message) {
    console.log('UCI response:', message);
    
    // Engine ready
    if (message === 'uciok') {
      this.isReady = true;
      console.log('Stockfish engine ready');
      
      // Send initial setup commands
      this.sendCommand('ucinewgame');
      this.sendCommand('setoption name UCI_LimitStrength value true');
      
      const initCallback = this.pendingCallbacks.get('init');
      if (initCallback) {
        initCallback();
        this.pendingCallbacks.delete('init');
      }
      return;
    }
    
    // Best move received
    if (message.startsWith('bestmove')) {
      this.isThinking = false;
      const parts = message.split(' ');
      const move = parts[1];
      
      console.log('Engine move:', move);
      
      const moveCallback = this.pendingCallbacks.get('move');
      if (moveCallback) {
        moveCallback(move);
        this.pendingCallbacks.delete('move');
      }
      return;
    }
    
    // Engine info (evaluation, depth, etc.)
    if (message.startsWith('info')) {
      const evaluation = this.parseEvaluation(message);
      if (evaluation && this.shouldBroadcastChange(this.currentEvaluation, evaluation)) {
        this.broadcastEvaluation(evaluation);
      }
      return;
    }
  }

  /**
   * Set engine configuration based on target ELO
   * @param {Object} config - Engine configuration from EngineConfig.getEngineConfig()
   * @param {number} targetElo - Target ELO rating for UCI_Elo option
   */
  setConfiguration(config, targetElo = null) {
    if (!this.isReady) {
      console.error('Engine not ready');
      return;
    }

    if (!window.EngineConfig.validateEngineConfig(config)) {
      console.error('Invalid engine configuration:', config);
      return;
    }

    this.currentConfig = config;
    
    console.log('🔧 Configuring Stockfish engine:', config);
    if (targetElo) {
      console.log(`🎯 Target ELO: ${targetElo}`);
    }
    
    // Set skill level (0-20, where 20 is maximum strength)
    this.sendCommand(`setoption name Skill Level value ${config.skillLevel}`);
    
    // Note: UCI_Elo is not supported by Stockfish.js web worker version
    // Strength limiting is handled through Skill Level and search time/depth instead
    if (targetElo) {
      console.log(`🎯 Target ELO: ${targetElo} (using skill level ${config.skillLevel} instead of UCI_Elo)`);
    }
    
    // Prepare for new game
    this.sendCommand('isready');
  }

  /**
   * Compare two engine configurations for equality
   * @param {Object} config1 - First configuration
   * @param {Object} config2 - Second configuration
   * @returns {boolean} True if configurations are the same
   */
  isSameConfig(config1, config2) {
    if (!config1 || !config2) return false;
    
    return (
      config1.skillLevel === config2.skillLevel &&
      config1.depth === config2.depth &&
      config1.moveTime === config2.moveTime
    );
  }

  /**
   * Set board position
   * @param {string} fen - FEN string representing board position
   */
  setPosition(fen) {
    if (!this.isReady) {
      console.error('Engine not ready');
      return;
    }
    
    console.log('Setting position:', fen);
    this.sendCommand(`position fen ${fen}`);
  }

  /**
   * Request best move from engine
   * @param {string} fen - Current board position in FEN notation
   * @param {Object} config - Engine configuration
   * @param {number} targetElo - Target ELO rating for UCI_Elo option
   * @returns {Promise<string>} Promise resolving to best move in UCI notation
   */
  async getBestMove(fen, config = null, targetElo = null) {
    return new Promise((resolve, reject) => {
      if (!this.isReady) {
        reject(new Error('Engine not ready'));
        return;
      }
      
      if (this.isThinking) {
        reject(new Error('Engine is already thinking'));
        return;
      }
      
      try {
        // Update configuration if provided and different
        if (config && !this.isSameConfig(config, this.currentConfig)) {
          this.setConfiguration(config, targetElo);
        }
        
        // Set position
        this.setPosition(fen);
        
        // Start thinking
        this.isThinking = true;
        
        // Store callback for when move is received
        this.pendingCallbacks.set('move', resolve);
        
        // Request move with time limit and conditionally depth
        const moveTime = this.currentConfig?.moveTime || 1000;
        const depth = this.currentConfig?.depth || 5;
        const skillLevel = this.currentConfig?.skillLevel || 10;
        
        // For low skill levels (1-10), use only time to allow weak play
        // For higher skill levels (11-20), use both time and depth for precise control
        let goCommand;
        if (skillLevel <= 10) {
          goCommand = `go movetime ${moveTime}`;
          console.log(`Requesting move with ${moveTime}ms time limit (skill ${skillLevel}, time-only)`);
        } else {
          goCommand = `go movetime ${moveTime} depth ${depth}`;
          console.log(`Requesting move with ${moveTime}ms time limit, depth ${depth} (skill ${skillLevel})`);
        }
        
        this.sendCommand(goCommand);
        
        // Set timeout for move request
        setTimeout(() => {
          if (this.isThinking) {
            this.isThinking = false;
            this.sendCommand('stop');
            this.pendingCallbacks.delete('move');
            reject(new Error('Engine move timeout'));
          }
        }, moveTime + 5000); // 5 second buffer
        
      } catch (error) {
        this.isThinking = false;
        reject(error);
      }
    });
  }

  /**
   * Stop current engine calculation
   */
  stop() {
    if (this.isThinking) {
      console.log('Stopping engine calculation');
      this.sendCommand('stop');
      this.isThinking = false;
      this.pendingCallbacks.delete('move');
    }
  }

  /**
   * Get engine status
   * @returns {Object} Engine status information
   */
  getStatus() {
    return {
      ready: this.isReady,
      thinking: this.isThinking,
      config: this.currentConfig
    };
  }

  /**
   * Subscribe to evaluation updates
   * @param {Function} callback - Callback function to call with evaluations
   * @returns {Function} Unsubscribe function
   */
  subscribeToEvaluation(callback) {
    this.evaluationCallbacks.add(callback);
    return () => this.evaluationCallbacks.delete(callback);
  }

  /**
   * Broadcast evaluation to all subscribers
   * @param {Object} evaluation - Evaluation object
   */
  broadcastEvaluation(evaluation) {
    this.currentEvaluation = evaluation;
    this.evaluationCallbacks.forEach(callback => {
      try {
        callback(evaluation);
      } catch (error) {
        console.error('Error in evaluation callback:', error);
      }
    });
  }

  /**
   * Parse UCI evaluation string into structured object
   * @param {string} uciString - UCI info string
   * @returns {Object|null} Evaluation object or null if no score
   */
  parseEvaluation(uciString) {
    const scoreMatch = uciString.match(/score cp (-?\d+)/);
    const mateMatch = uciString.match(/score mate (-?\d+)/);
    const pvMatch = uciString.match(/pv (.+)$/);
    const depthMatch = uciString.match(/depth (\d+)/);
    
    if (scoreMatch) {
      return {
        score: parseInt(scoreMatch[1]) / 100, // Convert centipawns to pawns
        bestMove: pvMatch ? pvMatch[1].split(' ')[0] : null,
        depth: depthMatch ? parseInt(depthMatch[1]) : 0,
        mate: null
      };
    }
    
    if (mateMatch) {
      return {
        score: null, // No centipawn score for mate
        bestMove: pvMatch ? pvMatch[1].split(' ')[0] : null,
        depth: depthMatch ? parseInt(depthMatch[1]) : 0,
        mate: parseInt(mateMatch[1])
      };
    }
    
    return null;
  }

  /**
   * Convert centipawns to decimal score
   * @param {number} centipawns - Centipawn value
   * @returns {number} Decimal score
   */
  centipawnsToScore(centipawns) {
    return centipawns / 100;
  }

  /**
   * Determine if evaluation change is significant enough to broadcast
   * @param {Object|null} oldEval - Previous evaluation
   * @param {Object} newEval - New evaluation
   * @returns {boolean} True if should broadcast
   */
  shouldBroadcastChange(oldEval, newEval) {
    // Always broadcast first evaluation
    if (!oldEval) return true;
    
    // Always broadcast if score type changes (mate vs centipawn)
    if ((oldEval.mate !== null) !== (newEval.mate !== null)) return true;
    
    // For centipawn scores, broadcast if change is >= 0.1 pawns
    if (oldEval.score !== null && newEval.score !== null) {
      return Math.abs(newEval.score - oldEval.score) >= 0.1;
    }
    
    // For mate scores, always broadcast changes
    if (oldEval.mate !== null && newEval.mate !== null) {
      return oldEval.mate !== newEval.mate;
    }
    
    return false;
  }

  /**
   * Cleanup engine resources
   */
  destroy() {
    console.log('Destroying Stockfish engine');
    
    this.stop();
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isReady = false;
    this.pendingCallbacks.clear();
    this.evaluationCallbacks.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StockfishEngine;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
  console.log('Loading StockfishEngine module...');
  window.StockfishEngine = StockfishEngine;
  console.log('StockfishEngine module loaded successfully');
}