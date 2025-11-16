/**
 * Talking Chess - Main Application
 * Step 1: Basic Board Setup and Initialization
 */

// Global application state
let game = null;
let board = null;
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;
let gameConfig = {
  userElo: 1500,
  strengthPercentage: 10,
  opponentElo: 1650
};

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
  try {
    initializeApp();
  } catch (error) {
    handleError('Failed to initialize application', error);
  }
});

/**
 * Main application initialization
 */
function initializeApp() {
  console.log('Initializing Talking Chess...');
  
  // Check if required libraries are loaded
  if (!validateDependencies()) {
    throw new Error('Required chess libraries not loaded');
  }
  
  // Initialize chess game
  initializeChessGame();
  
  // Initialize chessboard
  initializeChessBoard();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize UI
  initializeUI();
  
  console.log('Talking Chess initialized successfully');
}

/**
 * Validate that required dependencies are loaded
 */
function validateDependencies() {
  const dependencies = [
    { name: 'jQuery', check: () => typeof $ !== 'undefined' || typeof jQuery !== 'undefined' },
    { name: 'Chess.js', check: () => typeof Chess !== 'undefined' || (typeof window !== 'undefined' && window.Chess) },
    { name: 'ChessBoard.js', check: () => typeof ChessBoard !== 'undefined' }
  ];
  
  for (const dep of dependencies) {
    if (!dep.check()) {
      console.error(`Missing dependency: ${dep.name}`);
      console.error('Available globals:', Object.keys(window).filter(key => key.toLowerCase().includes('chess') || key.toLowerCase().includes('jquery')));
      return false;
    }
  }
  
  console.log('All dependencies loaded successfully');
  return true;
}

/**
 * Initialize chess game logic
 */
function initializeChessGame() {
  try {
    // Handle different ways Chess.js might be exposed
    const ChessConstructor = typeof Chess !== 'undefined' ? Chess : (window.Chess || window.chess);
    
    if (!ChessConstructor) {
      throw new Error('Chess constructor not found');
    }
    
    game = new ChessConstructor();
    console.log('Chess game initialized');
    console.log('Starting position FEN:', game.fen());
  } catch (error) {
    throw new Error('Failed to initialize chess game: ' + error.message);
  }
}

/**
 * Initialize chessboard display
 */
function initializeChessBoard() {
  try {
    const boardConfig = {
      position: 'start',
      draggable: true,
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd,
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    // Use correct ChessBoard constructor (capital C and B)
    board = ChessBoard('chessboard', boardConfig);
    console.log('Chessboard initialized');
    
    // Resize board to fit container
    window.addEventListener('resize', function() {
      board.resize();
    });
    
  } catch (error) {
    console.error('Chessboard initialization error:', error);
    throw new Error('Failed to initialize chessboard: ' + error.message);
  }
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
  // ELO input changes
  const eloInput = document.getElementById('elo-input');
  if (eloInput) {
    eloInput.addEventListener('input', updateEloCalculation);
    eloInput.addEventListener('blur', validateEloInput);
  }
  
  // Strength percentage changes
  const strengthInput = document.getElementById('strength-input');
  if (strengthInput) {
    strengthInput.addEventListener('input', updateEloCalculation);
  }
  
  // Preset buttons
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => selectPreset(parseInt(btn.dataset.percentage), btn.dataset.name));
  });
  
  // Start game button
  const startButton = document.getElementById('start-game-btn');
  if (startButton) {
    startButton.addEventListener('click', startGame);
  }
  
  console.log('Event listeners setup complete');
}

/**
 * Initialize UI elements
 */
function initializeUI() {
  // Load user preferences if available
  loadUserPreferences();
  
  // Update initial ELO calculation
  updateEloCalculation();
  
  // Try to load saved game state
  const gameLoaded = loadGameState();
  
  if (gameLoaded) {
    // Show game section if we loaded a game
    document.getElementById('setup-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
    console.log('Loaded saved game state');
  } else {
    // Set initial game status for new game
    updateGameStatus('Set up your game to start playing');
    updateTurnIndicator();
  }
  
  console.log('UI initialization complete');
}

/**
 * Update ELO calculation display
 */
function updateEloCalculation() {
  if (!window.EloCalculator) return;
  
  const eloInput = document.getElementById('elo-input');
  const strengthInput = document.getElementById('strength-input');
  const strengthDisplay = document.getElementById('strength-percentage');
  const opponentDisplay = document.getElementById('opponent-elo');
  const eloCategory = document.getElementById('elo-category');
  const opponentCategory = document.getElementById('opponent-category');
  const recommendedIndicator = document.getElementById('recommended-indicator');
  
  if (!eloInput || !strengthInput) return;
  
  const userElo = parseInt(eloInput.value) || 1500;
  const strengthPercentage = parseInt(strengthInput.value) || 10;
  
  // Validate inputs using ELO calculator
  const eloValidation = window.EloCalculator.validateEloInput(userElo);
  const percentageValidation = window.EloCalculator.validatePercentageInput(strengthPercentage);
  
  if (!eloValidation.isValid || !percentageValidation.isValid) {
    showValidationErrors(eloValidation, percentageValidation);
    return;
  }
  
  // Clear any validation errors
  clearValidationErrors();
  
  // Calculate using ELO calculator
  const stats = window.EloCalculator.calculateEloStats(userElo, strengthPercentage);
  
  // Update global config
  gameConfig.userElo = userElo;
  gameConfig.strengthPercentage = strengthPercentage;
  gameConfig.opponentElo = stats.opponentElo;
  
  // Update displays
  if (strengthDisplay) {
    strengthDisplay.textContent = stats.formattedPercentage;
  }
  
  if (opponentDisplay) {
    opponentDisplay.textContent = `Target: ${stats.opponentElo}`;
  }
  
  // Update categories
  if (eloCategory) {
    updateEloCategory(eloCategory, stats.userCategory);
  }
  
  if (opponentCategory) {
    updateEloCategory(opponentCategory, stats.opponentCategory);
  }
  
  // Show recommended indicator
  if (recommendedIndicator) {
    if (stats.isRecommended) {
      recommendedIndicator.classList.remove('hidden');
    } else {
      recommendedIndicator.classList.add('hidden');
    }
  }
  
  // Update preset button states
  updatePresetButtons(strengthPercentage);
  
  console.log('ELO calculation updated:', stats);
}

/**
 * Select preset difficulty
 */
function selectPreset(percentage, name) {
  if (!window.EloCalculator) return;
  
  const strengthInput = document.getElementById('strength-input');
  if (strengthInput) {
    strengthInput.value = percentage;
    updateEloCalculation();
    
    // Save user preferences
    window.EloCalculator.saveUserPreferences(gameConfig.userElo, percentage);
  }
}

/**
 * Validate ELO input on blur
 */
function validateEloInput() {
  if (!window.EloCalculator) return;
  
  const eloInput = document.getElementById('elo-input');
  if (!eloInput) return;
  
  const validation = window.EloCalculator.validateEloInput(eloInput.value);
  
  if (!validation.isValid) {
    eloInput.classList.add('error');
    showEloError(validation.error);
  } else {
    eloInput.classList.remove('error');
    eloInput.classList.add('success');
    clearEloError();
  }
}

/**
 * Update ELO category display
 */
function updateEloCategory(element, category) {
  if (!element) return;
  
  element.textContent = category;
  element.className = `elo-category ${category.toLowerCase()}`;
}

/**
 * Update preset button states
 */
function updatePresetButtons(selectedPercentage) {
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    const btnPercentage = parseInt(btn.dataset.percentage);
    const btnName = btn.dataset.name?.toLowerCase() || '';
    
    if (btnPercentage === selectedPercentage) {
      btn.classList.add('active', btnName);
    } else {
      btn.classList.remove('active', 'easy', 'normal', 'hard', 'expert');
      btn.classList.add(btnName);
    }
  });
}

/**
 * Show validation errors
 */
function showValidationErrors(eloValidation, percentageValidation) {
  const eloInput = document.getElementById('elo-input');
  const strengthInput = document.getElementById('strength-input');
  
  if (!eloValidation.isValid && eloInput) {
    eloInput.classList.add('error');
    showEloError(eloValidation.error);
  }
  
  if (!percentageValidation.isValid && strengthInput) {
    strengthInput.classList.add('error');
  }
}

/**
 * Clear validation errors
 */
function clearValidationErrors() {
  const eloInput = document.getElementById('elo-input');
  const strengthInput = document.getElementById('strength-input');
  
  if (eloInput) {
    eloInput.classList.remove('error');
    eloInput.classList.add('success');
  }
  
  if (strengthInput) {
    strengthInput.classList.remove('error');
  }
  
  clearEloError();
}

/**
 * Show ELO error message
 */
function showEloError(message) {
  const errorElement = document.getElementById('elo-error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }
}

/**
 * Clear ELO error message
 */
function clearEloError() {
  const errorElement = document.getElementById('elo-error-message');
  if (errorElement) {
    errorElement.classList.add('hidden');
  }
}

/**
 * Load user preferences
 */
function loadUserPreferences() {
  if (!window.EloCalculator) return;
  
  const preferences = window.EloCalculator.loadUserPreferences();
  if (!preferences) return;
  
  const eloInput = document.getElementById('elo-input');
  const strengthInput = document.getElementById('strength-input');
  
  if (eloInput && preferences.userElo) {
    eloInput.value = preferences.userElo;
  }
  
  if (strengthInput && preferences.strengthPercentage !== undefined) {
    strengthInput.value = preferences.strengthPercentage;
  }
  
  console.log('Loaded user preferences:', preferences);
}

/**
 * Start a new game
 */
function startGame() {
  try {
    console.log('Starting new game with config:', gameConfig);
    
    // Save user preferences before starting
    if (window.EloCalculator) {
      window.EloCalculator.saveUserPreferences(gameConfig.userElo, gameConfig.strengthPercentage);
    }
    
    // Reset game state
    game.reset();
    board.position('start');
    clearHighlights();
    lastMove = null;
    selectedSquare = null;
    
    // Show game section, hide setup
    document.getElementById('setup-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
    
    // Update UI
    updateMoveHistory();
    updateTurnIndicator();
    updateGameStatus(`Playing against ${gameConfig.opponentElo} ELO opponent`);
    saveGameState();
    
    console.log('Game started successfully');
    
  } catch (error) {
    handleError('Failed to start game', error);
  }
}

/**
 * Update game status display
 */
function updateGameStatus(message) {
  const statusElement = document.getElementById('status-text');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Handle drag start events
 */
function onDragStart(source, piece, position, orientation) {
  // Only allow moves if it's the player's turn and game is active
  if (game.game_over()) return false;
  
  // Only allow player to move their pieces (white pieces)
  if (piece.search(/^b/) !== -1) return false;
  
  // Highlight selected square
  highlightSquare(source);
  selectedSquare = source;
  
  // Get legal moves for this piece and highlight them
  legalMoves = game.moves({ square: source, verbose: true });
  highlightLegalMoves(legalMoves);
  
  return true;
}

/**
 * Handle piece drop events
 */
function onDrop(source, target) {
  // Clear highlights
  clearHighlights();
  
  // See if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Always promote to queen for now
  });
  
  // Illegal move
  if (move === null) {
    selectedSquare = null;
    return 'snapback';
  }
  
  // Store last move for highlighting
  lastMove = { from: source, to: target };
  
  // Update UI
  updateMoveHistory();
  updateTurnIndicator();
  updateGameStatus();
  saveGameState();
  
  // Check for game over
  if (game.game_over()) {
    setTimeout(handleGameOver, 250);
  } else {
    // Highlight the last move
    highlightLastMove(lastMove);
    
    // Show check if king is in check
    if (game.in_check()) {
      highlightCheck();
    }
  }
  
  selectedSquare = null;
}

/**
 * Handle snap end events
 */
function onSnapEnd() {
  board.position(game.fen());
}

/**
 * Update move history display with improved formatting
 */
function updateMoveHistory() {
  const pgnDisplay = document.getElementById('pgn-display');
  if (pgnDisplay) {
    const pgn = game.pgn();
    pgnDisplay.innerHTML = formatPGN(pgn);
    
    // Auto-scroll to bottom
    pgnDisplay.scrollTop = pgnDisplay.scrollHeight;
  }
}

/**
 * Format PGN with move numbers and proper styling
 */
function formatPGN(pgn) {
  if (!pgn) return '<em>No moves yet</em>';
  
  // Split moves by move numbers
  const moves = pgn.split(/(\d+\.)/).filter(part => part.trim());
  let formattedHTML = '';
  
  for (let i = 0; i < moves.length; i += 2) {
    if (moves[i] && moves[i].includes('.')) {
      const moveNumber = moves[i];
      const movePair = moves[i + 1] || '';
      const [whiteMove, blackMove] = movePair.trim().split(/\s+/);
      
      formattedHTML += '<div class="move-pair">';
      formattedHTML += `<span class="move-number">${moveNumber}</span>`;
      
      if (whiteMove) {
        formattedHTML += `<span class="move-white">${whiteMove}</span>`;
      }
      
      if (blackMove) {
        formattedHTML += `<span class="move-black">${blackMove}</span>`;
      }
      
      formattedHTML += '</div>';
    }
  }
  
  return formattedHTML || pgn;
}

/**
 * Handle game over conditions
 */
function handleGameOver() {
  const statusElement = document.getElementById('game-status');
  const statusText = document.getElementById('status-text');
  let status = '';
  let statusClass = '';
  
  if (game.in_checkmate()) {
    status = game.turn() === 'b' ? 'White wins by checkmate!' : 'Black wins by checkmate!';
    statusClass = 'checkmate';
  } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
    if (game.in_stalemate()) {
      status = 'Game drawn by stalemate';
    } else if (game.in_threefold_repetition()) {
      status = 'Game drawn by threefold repetition';
    } else if (game.insufficient_material()) {
      status = 'Game drawn by insufficient material';
    } else {
      status = 'Game drawn';
    }
    statusClass = 'draw';
  }
  
  if (statusElement && statusText) {
    statusElement.className = `game-status ${statusClass}`;
    statusText.textContent = status;
  }
  
  // Clear highlights
  clearHighlights();
  
  console.log('Game over:', status);
}

/**
 * Update turn indicator
 */
function updateTurnIndicator() {
  const turnIndicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const pieceIcon = turnIndicator?.querySelector('.piece-icon');
  
  if (!turnIndicator || !turnText || !pieceIcon) return;
  
  const currentTurn = game.turn();
  
  if (currentTurn === 'w') {
    turnIndicator.className = 'turn-indicator white-turn';
    turnText.textContent = 'White to move';
    pieceIcon.textContent = '♔';
  } else {
    turnIndicator.className = 'turn-indicator black-turn';
    turnText.textContent = 'Black to move';
    pieceIcon.textContent = '♚';
  }
}

/**
 * Update game status with special conditions
 */
function updateGameStatus() {
  const statusElement = document.getElementById('game-status');
  const statusText = document.getElementById('status-text');
  
  if (!statusElement || !statusText) return;
  
  // Reset classes
  statusElement.className = 'game-status';
  
  if (game.in_check()) {
    statusElement.classList.add('check');
    statusText.textContent = `${game.turn() === 'w' ? 'White' : 'Black'} is in check!`;
  } else if (game.game_over()) {
    // This will be handled by handleGameOver
    return;
  } else {
    statusText.textContent = `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
  }
}

/**
 * Highlight a square
 */
function highlightSquare(square) {
  const squareEl = document.querySelector(`[data-square="${square}"]`);
  if (squareEl) {
    squareEl.classList.add('square-highlight');
  }
}

/**
 * Highlight legal moves
 */
function highlightLegalMoves(moves) {
  moves.forEach(move => {
    const squareEl = document.querySelector(`[data-square="${move.to}"]`);
    if (squareEl) {
      squareEl.classList.add('square-legal-move');
      
      // Add special class for captures
      if (move.captured) {
        squareEl.classList.add('occupied');
      }
    }
  });
}

/**
 * Highlight the last move made
 */
function highlightLastMove(move) {
  if (!move) return;
  
  const fromSquare = document.querySelector(`[data-square="${move.from}"]`);
  const toSquare = document.querySelector(`[data-square="${move.to}"]`);
  
  if (fromSquare) fromSquare.classList.add('square-last-move');
  if (toSquare) toSquare.classList.add('square-last-move');
}

/**
 * Highlight king in check
 */
function highlightCheck() {
  const turn = game.turn();
  const king = turn === 'w' ? 'wK' : 'bK';
  
  // Find the king's square
  const position = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = position[rank][file];
      if (piece && piece.type === 'k' && piece.color === turn) {
        const square = String.fromCharCode(97 + file) + (8 - rank);
        const squareEl = document.querySelector(`[data-square="${square}"]`);
        if (squareEl) {
          squareEl.classList.add('square-in-check');
        }
        break;
      }
    }
  }
}

/**
 * Clear all highlights
 */
function clearHighlights() {
  document.querySelectorAll('.square-highlight, .square-legal-move, .square-last-move, .square-in-check')
    .forEach(square => {
      square.classList.remove('square-highlight', 'square-legal-move', 'square-last-move', 'square-in-check', 'occupied');
    });
}

/**
 * Save game state to localStorage
 */
function saveGameState() {
  try {
    const gameState = {
      fen: game.fen(),
      pgn: game.pgn(),
      lastMove: lastMove,
      timestamp: Date.now()
    };
    
    localStorage.setItem('chess-game-state', JSON.stringify(gameState));
  } catch (error) {
    console.warn('Failed to save game state:', error);
  }
}

/**
 * Load game state from localStorage
 */
function loadGameState() {
  try {
    const saved = localStorage.getItem('chess-game-state');
    if (!saved) return null;
    
    const gameState = JSON.parse(saved);
    
    // Load the position
    if (gameState.fen && game.load(gameState.fen)) {
      lastMove = gameState.lastMove;
      
      // Update UI
      board.position(gameState.fen);
      updateMoveHistory();
      updateTurnIndicator();
      updateGameStatus();
      
      if (lastMove) {
        highlightLastMove(lastMove);
      }
      
      if (game.in_check()) {
        highlightCheck();
      }
      
      return true;
    }
  } catch (error) {
    console.warn('Failed to load game state:', error);
    localStorage.removeItem('chess-game-state');
  }
  
  return false;
}

/**
 * Handle application errors
 */
function handleError(message, error) {
  console.error(message, error);
  
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  
  if (errorContainer && errorText) {
    errorText.textContent = `${message}: ${error.message}`;
    errorContainer.classList.remove('hidden');
  } else {
    // Fallback error display
    alert(`Error: ${message}\n${error.message}`);
  }
}

/**
 * Global error handler
 */
window.addEventListener('error', function(event) {
  handleError('Unexpected error occurred', event.error);
});

/**
 * Global unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', function(event) {
  handleError('Unhandled promise rejection', new Error(event.reason));
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeApp,
    validateDependencies,
    updateEloCalculation,
    gameConfig
  };
}