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
let engine = null;
let isEngineInitialized = false;
let chatEngine = null;
let gameConfig = {
  userElo: 1500,
  strengthPercentage: 10,
  opponentElo: 1650
};

// Highlight toggle state
let highlightsEnabled = true;
let isAnimating = false;
let animationDebounceTimer = null;

// Captured pieces and scoring
let capturedPieces = {
  white: [],
  black: []
};

// Piece values for scoring (standard chess values)
const PIECE_VALUES = {
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
};

// Game timer
let gameStartTime = null;
let gameTimerInterval = null;
let totalGameTime = 0;
let gameTimerStarted = false;

// Chat state
let isGameStarted = false;

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
  
  // Initialize chat engine
  initializeChatEngine();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize UI
  initializeUI();
  
  // Initialize board as interactive
  setBoardInteractive(true);
  
  // Initialize Stockfish engine and auto-start game
  initializeEngine().then(() => {
    autoStartGame();
  }).catch(error => {
    console.error('Engine initialization failed in initializeApp:', error);
  });
  
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
    // Clear any existing board first
    const boardElement = document.getElementById('chessboard');
    if (boardElement) {
      boardElement.innerHTML = ''; // Clear any existing content
    }
    
    // Destroy existing board if it exists
    if (window.board && typeof window.board.destroy === 'function') {
      try {
        window.board.destroy();
      } catch (e) {
        console.log('Note: Could not destroy existing board:', e.message);
      }
    }
    
    const boardConfig = {
      position: 'start',
      draggable: true,
      moveSpeed: 0,
      snapSpeed: 0,
      onDragStart: function(source, piece, position, orientation) {
        console.log('🎯 Drag start:', source, piece);
        
        // Only allow white pieces to be moved
        if (piece.search(/^w/) === -1) {
          return false;
        }
        
        // Game checks
        if (game.game_over()) return false;
        if (game.turn() !== 'w') return false;
        
        selectedSquare = source;
        return true;
      },
      onDrop: function(source, target, piece, newPos, oldPos, orientation) {
        console.log('🎯 Drop attempt:', source, '→', target);
        
        // Attempt the move
        const move = game.move({
          from: source,
          to: target,
          promotion: 'q'
        });
        
        if (move === null) {
          console.log('❌ Invalid move');
          return 'snapback';
        }
        
        console.log('✅ Move made:', move.san);
        selectedSquare = null;
        
        // Update UI
        updateMoveHistory();
        updateTurnIndicator();
        updateGameStatus();
        updateCapturedPieces();
        updateHeaderDisplays();
        updateStatusBar();
        saveGameState();
        
        // Start timer
        if (!gameTimerStarted) {
          startGameTimer();
          gameTimerStarted = true;
        }
        
        // Chat
        if (chatEngine && isGameStarted) {
          handlePlayerMove(move);
        }
        
        // Check game over
        if (game.game_over()) {
          handleGameOver();
        } else if (!game.game_over()) {
          setTimeout(makeComputerMove, 250);
        }
        
        return;
      },
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    console.log('🏁 Initializing ChessBoard with config:', boardConfig);
    board = ChessBoard('chessboard', boardConfig);
    window.board = board; // Store globally for cleanup
    console.log('✅ Chessboard initialized successfully:', board);
    
    console.log('✅ Chessboard using drag-and-drop for piece movement');
    
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
 * Calculate which chess square was clicked based on mouse coordinates
 */
function calculateSquareFromCoordinates(event, boardElement) {
  try {
    const rect = boardElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate which square based on board position
    const squareSize = rect.width / 8; // 8x8 board
    
    const file = Math.floor(x / squareSize);
    const rank = Math.floor(y / squareSize);
    
    // Convert to chess notation (a-h, 1-8)
    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      const fileChar = String.fromCharCode(97 + file); // 97 = 'a'
      const rankNum = 8 - rank; // Flip rank (board is displayed top-to-bottom)
      
      const square = fileChar + rankNum;
      console.log('🟦 Calculated square from coordinates:', square, 'at', x, y);
      return square;
    }
    
    console.log('🟦 Click outside valid board area:', x, y);
    return null;
  } catch (error) {
    console.log('🟦 Error calculating square from coordinates:', error);
    return null;
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
  
  // New game button (header)
  const newGameButtonHeader = document.getElementById('new-game-btn-header');
  if (newGameButtonHeader) {
    newGameButtonHeader.addEventListener('click', newGame);
  }

  // Flip board button (header)
  const flipBoardButtonHeader = document.getElementById('flip-board-btn-header');
  if (flipBoardButtonHeader) {
    flipBoardButtonHeader.addEventListener('click', flipBoard);
  }

  // Highlight toggle button
  const toggleHighlightsButton = document.getElementById('toggle-highlights-btn');
  if (toggleHighlightsButton) {
    toggleHighlightsButton.addEventListener('click', toggleHighlights);
  }

  // ELO input fields
  const userEloInput = document.getElementById('user-elo-input');
  if (userEloInput) {
    userEloInput.addEventListener('change', handleUserEloChange);
    userEloInput.addEventListener('input', handleUserEloChange);
  }

  const aiEloInput = document.getElementById('ai-elo-input');
  if (aiEloInput) {
    aiEloInput.addEventListener('change', handleAiEloChange);
    aiEloInput.addEventListener('input', handleAiEloChange);
  }

  // ELO adjustment buttons
  const eloAdjustButtons = document.querySelectorAll('.elo-adjust');
  eloAdjustButtons.forEach(btn => {
    btn.addEventListener('click', () => adjustElo(btn.dataset.type, parseInt(btn.dataset.delta)));
  });

  // Strength adjustment buttons
  const strengthAdjustButtons = document.querySelectorAll('.strength-adjust');
  strengthAdjustButtons.forEach(btn => {
    btn.addEventListener('click', () => adjustStrength(parseInt(btn.dataset.delta)));
  });

  // Tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Additional game control buttons
  const resignButton = document.getElementById('resign-btn');
  if (resignButton) {
    resignButton.addEventListener('click', resignGame);
  }

  const drawButton = document.getElementById('offer-draw-btn');
  if (drawButton) {
    drawButton.addEventListener('click', offerDraw);
  }

  const flipButton = document.getElementById('flip-board-btn');
  if (flipButton) {
    flipButton.addEventListener('click', flipBoard);
  }

  const toggleCoordinatesButton = document.getElementById('toggle-coordinates');
  if (toggleCoordinatesButton) {
    toggleCoordinatesButton.addEventListener('click', toggleCoordinates);
  }

  const toggleSoundButton = document.getElementById('toggle-sound');
  if (toggleSoundButton) {
    toggleSoundButton.addEventListener('click', toggleSound);
  }

  // Chat event listeners
  const sendMessageButton = document.getElementById('send-message-btn');
  if (sendMessageButton) {
    sendMessageButton.addEventListener('click', () => {
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        sendUserMessage(chatInput.value);
      }
    });
  }

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage(chatInput.value);
      }
    });
  }

  // Quick response buttons
  const quickResponses = document.querySelectorAll('.quick-response');
  quickResponses.forEach(btn => {
    btn.addEventListener('click', () => {
      const message = btn.dataset.message || btn.textContent;
      sendQuickResponse(message);
    });
  });
  
  console.log('Event listeners setup complete');
}

/**
 * Initialize UI elements
 */
function initializeUI() {
  // Load user preferences if available
  loadUserPreferences();
  
  // Load highlight preference
  loadHighlightPreference();
  
  // Update initial ELO calculation
  updateEloCalculation();
  
  // Ensure game section is always visible (no setup screen anymore)
  const gameSection = document.getElementById('game-section');
  if (gameSection) {
    gameSection.classList.remove('hidden');
  }
  
  // Set initial highlights state
  updateHighlightsClass();
  
  // Try to load saved game state
  const gameLoaded = loadGameState();
  
  if (gameLoaded) {
    console.log('Loaded saved game state');
  } else {
    // Set initial game status for new game
    updateGameStatus('Ready to play');
    updateTurnIndicator();
  }
  
  console.log('UI initialization complete');
}

/**
 * Initialize chat engine
 */
function initializeChatEngine() {
  try {
    console.log('Initializing chat engine...');
    
    if (!window.ChatEngine) {
      console.error('ChatEngine not available');
      return;
    }
    
    chatEngine = new window.ChatEngine();
    console.log('Chat engine initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize chat engine:', error);
  }
}

/**
 * Auto-start the game without setup screen
 */
function autoStartGame() {
  try {
    console.log('Auto-starting game with config:', gameConfig);
    
    if (!isEngineInitialized) {
      console.log('Engine not ready, will start game when engine is initialized');
      return;
    }
    
    // Load user preferences
    loadUserPreferences();
    
    // Update ELO calculation
    updateEloCalculation();
    
    // Reset game state
    game.reset();
    board.position('start');
    lastMove = null;
    selectedSquare = null;
    
    // Reset captured pieces and timer
    resetCapturedPieces();
    resetGameTimer();
    
    // Update UI displays
    updateTurnIndicator();
    updateMoveHistory();
    updateCapturedPiecesDisplay();
    updateHeaderDisplays();
    
    // Mark game as started
    isGameStarted = true;
    
    // Generate welcome message from AI
    if (chatEngine) {
      const greeting = chatEngine.generateGreeting(gameConfig.opponentElo);
      displayChatMessage(greeting);
    }
    
    console.log('Game auto-started successfully');
    
  } catch (error) {
    console.error('Failed to auto-start game:', error);
  }
}

/**
 * Initialize Stockfish engine
 */
async function initializeEngine() {
  try {
    console.log('Initializing Stockfish engine...');
    console.log('Available window properties:', Object.keys(window).filter(key => key.includes('Engine') || key.includes('Config')));
    console.log('StockfishEngine available:', !!window.StockfishEngine);
    console.log('EngineConfig available:', !!window.EngineConfig);
    
    
    // Check if required modules are loaded
    if (!window.StockfishEngine) {
      console.error('StockfishEngine not loaded');
      showEngineError('Stockfish engine module not loaded');
      return;
    }
    
    if (!window.EngineConfig) {
      console.error('EngineConfig not loaded');
      showEngineError('Engine configuration module not loaded');
      return;
    }
    
    console.log('Creating Stockfish engine instance...');
    // Create engine instance
    engine = new window.StockfishEngine();
    
    console.log('Initializing engine...');
    // Initialize engine
    await engine.init();
    
    isEngineInitialized = true;
    console.log('Stockfish engine initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize Stockfish engine:', error);
    isEngineInitialized = false;
    
    // Show user-friendly error message
    showEngineError('Failed to load AI opponent. You can still play against another human.');
  }
}

/**
 * Show engine error message
 */
function showEngineError(message) {
  const aiStatus = document.getElementById('ai-status');
  if (aiStatus) {
    aiStatus.innerHTML = `
      <div class="ai-indicator" style="color: var(--error-color);">
        <span>⚠️ ${message}</span>
      </div>
    `;
    aiStatus.classList.remove('hidden');
  }
}

/**
 * Show module loading status for debugging
 */
function showModuleStatus() {
  const statusElement = document.getElementById('status-text');
  if (statusElement) {
    const engineConfigAvailable = !!window.EngineConfig;
    const stockfishEngineAvailable = !!window.StockfishEngine;
    
    const status = `
      Module Status: 
      EngineConfig: ${engineConfigAvailable ? '✅' : '❌'}, 
      StockfishEngine: ${stockfishEngineAvailable ? '✅' : '❌'}
    `;
    
    statusElement.textContent = status;
    
    // Log additional info
    console.log('Module loading status:', {
      EngineConfig: engineConfigAvailable,
      StockfishEngine: stockfishEngineAvailable,
      windowKeys: Object.keys(window).filter(key => 
        key.includes('Engine') || key.includes('Config')
      )
    });
  }
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
  
  // Update setup screen displays
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

  // Update in-game displays
  const userEloGameDisplay = document.getElementById('user-elo-value');
  if (userEloGameDisplay) {
    userEloGameDisplay.textContent = userElo;
  }

  const aiEloGameDisplay = document.getElementById('ai-elo-value');
  if (aiEloGameDisplay) {
    aiEloGameDisplay.textContent = stats.opponentElo;
  }

  const gameStrengthDisplay = document.getElementById('strength-percentage');
  if (gameStrengthDisplay) {
    gameStrengthDisplay.textContent = stats.formattedPercentage;
  }

  const difficultyBadge = document.getElementById('difficulty-badge');
  if (difficultyBadge) {
    difficultyBadge.textContent = stats.opponentCategory;
    difficultyBadge.className = `difficulty-badge ${stats.opponentCategory.toLowerCase()}`;
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
 * Handle user ELO input change
 */
function handleUserEloChange() {
  const userEloInput = document.getElementById('user-elo-input');
  if (!userEloInput) return;
  
  const newElo = parseInt(userEloInput.value);
  if (newElo >= 800 && newElo <= 3000) {
    gameConfig.userElo = newElo;
    updateEloCalculation();
  }
}

/**
 * Handle AI ELO input change
 */
function handleAiEloChange() {
  const aiEloInput = document.getElementById('ai-elo-input');
  if (!aiEloInput) return;
  
  const newElo = parseInt(aiEloInput.value);
  if (newElo >= 800 && newElo <= 3000) {
    gameConfig.opponentElo = newElo;
    // Calculate the strength percentage that would give this ELO
    const strengthPercentage = Math.round(((newElo / gameConfig.userElo) - 1) * 100);
    gameConfig.strengthPercentage = Math.max(-50, Math.min(100, strengthPercentage));
    updateHeaderDisplays();
  }
}

/**
 * Adjust ELO rating using +/- buttons
 */
function adjustElo(type, delta) {
  if (!window.EloCalculator) return;
  
  if (type === 'user') {
    // Adjust user ELO
    const currentElo = gameConfig.userElo;
    const newElo = Math.max(800, Math.min(3000, currentElo + delta));
    
    // Update game config
    gameConfig.userElo = newElo;
    
    // Update header input
    const userEloInput = document.getElementById('user-elo-input');
    if (userEloInput) {
      userEloInput.value = newElo;
    }
    
    // Recalculate opponent ELO
    updateEloCalculation();
  }
}

/**
 * Adjust strength percentage using +/- buttons
 */
function adjustStrength(delta) {
  if (!window.EloCalculator) return;
  
  const currentStrength = gameConfig.strengthPercentage;
  const newStrength = Math.max(-50, Math.min(100, currentStrength + delta));
  
  // Update game config
  gameConfig.strengthPercentage = newStrength;
  
  // Update setup screen input
  const strengthInput = document.getElementById('strength-input');
  if (strengthInput) {
    strengthInput.value = newStrength;
  }
  
  // Update in-game display
  const strengthDisplay = document.getElementById('strength-percentage');
  if (strengthDisplay) {
    strengthDisplay.textContent = (newStrength >= 0 ? '+' : '') + newStrength + '%';
  }
  
  // Recalculate opponent ELO
  updateEloCalculation();
}

/**
 * Switch between tabs in the bottom section
 */
function switchTab(tabName) {
  // Remove active class from all tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => btn.classList.remove('active'));
  
  // Remove active class from all tab panels
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabPanels.forEach(panel => panel.classList.remove('active'));
  
  // Add active class to clicked button
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  // Show the corresponding panel
  const activePanel = document.getElementById(`${tabName}-tab`);
  if (activePanel) {
    activePanel.classList.add('active');
  }
}

/**
 * Resign the current game
 */
function resignGame() {
  if (!game) return;
  
  if (confirm('Are you sure you want to resign?')) {
    endGame('resign', 'You resigned the game');
  }
}

/**
 * Offer a draw
 */
function offerDraw() {
  if (!game) return;
  
  if (confirm('Offer a draw?')) {
    // In a real implementation, this would be sent to opponent
    // For now, AI automatically accepts draws
    endGame('draw', 'Draw offered and accepted');
  }
}

/**
 * Flip the board orientation
 */
function flipBoard() {
  if (!board) return;
  
  board.flip();
}

/**
 * Toggle coordinate display
 */
function toggleCoordinates() {
  const button = document.getElementById('toggle-coordinates');
  if (!button) return;
  
  // This would toggle coordinate visibility
  // For now, just toggle button text
  const isShowing = button.textContent.includes('Hide');
  button.innerHTML = isShowing ? 
    '<span class="btn-icon">🔤</span>Show Coordinates' : 
    '<span class="btn-icon">🔤</span>Hide Coordinates';
}

/**
 * Toggle sound effects
 */
function toggleSound() {
  const button = document.getElementById('toggle-sound');
  if (!button) return;
  
  // This would toggle sound effects
  // For now, just toggle button text
  const isOn = button.textContent.includes('Off');
  button.innerHTML = isOn ? 
    '<span class="btn-icon">🔊</span>Sound On' : 
    '<span class="btn-icon">🔇</span>Sound Off';
}

/**
 * Display a chat message in the chat window
 */
function displayChatMessage(message) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages || !message) return;
  
  const messageElement = createChatMessageElement(message);
  chatMessages.appendChild(messageElement);
  
  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Create a chat message DOM element
 */
function createChatMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${message.sender}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = message.sender === 'user' ? '👤' : '🤖';
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  const text = document.createElement('div');
  text.className = 'message-text';
  text.textContent = message.text;
  
  const timestamp = document.createElement('div');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = formatTimestamp(message.timestamp);
  
  content.appendChild(text);
  content.appendChild(timestamp);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  
  return messageDiv;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Send a user message
 */
function sendUserMessage(text) {
  if (!chatEngine || !text.trim()) return;
  
  const message = chatEngine.addMessage('user', text.trim());
  displayChatMessage(message);
  
  // Clear input
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.value = '';
  }
}

/**
 * Send a quick response
 */
function sendQuickResponse(text) {
  sendUserMessage(text);
}

/**
 * Display AI thinking indicator
 */
function showAIThinking() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-message ai thinking';
  thinkingDiv.id = 'ai-thinking-indicator';
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '🤖';
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  const indicator = document.createElement('div');
  indicator.className = 'thinking-indicator';
  indicator.innerHTML = 'Thinking<span class="thinking-dots"><span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span></span>';
  
  content.appendChild(indicator);
  thinkingDiv.appendChild(avatar);
  thinkingDiv.appendChild(content);
  chatMessages.appendChild(thinkingDiv);
  
  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Hide AI thinking indicator
 */
function hideAIThinking() {
  const thinkingIndicator = document.getElementById('ai-thinking-indicator');
  if (thinkingIndicator) {
    thinkingIndicator.remove();
  }
}

/**
 * Update header displays with current game state
 */
function updateHeaderDisplays() {
  // Update ELO input fields
  const userEloInput = document.getElementById('user-elo-input');
  if (userEloInput) {
    userEloInput.value = gameConfig.userElo;
  }
  
  const aiEloInput = document.getElementById('ai-elo-input');
  if (aiEloInput) {
    aiEloInput.value = gameConfig.opponentElo;
  }
  
  const strengthDisplay = document.getElementById('strength-display');
  if (strengthDisplay) {
    strengthDisplay.textContent = (gameConfig.strengthPercentage >= 0 ? '+' : '') + gameConfig.strengthPercentage + '%';
  }
  
  // Update material status
  updateMaterialAdvantage();
  
  // Update move count
  const moveNumber = document.getElementById('move-number');
  if (moveNumber && game) {
    moveNumber.textContent = Math.ceil(game.history().length / 2);
  }
}

/**
 * Update material advantage display
 */
function updateMaterialAdvantage() {
  const materialStatus = document.getElementById('material-status');
  if (!materialStatus || !game) return;
  
  const whiteScore = calculateMaterialScore('white');
  const blackScore = calculateMaterialScore('black');
  const advantage = whiteScore - blackScore;
  
  if (advantage > 0) {
    materialStatus.textContent = `Material: White +${advantage}`;
  } else if (advantage < 0) {
    materialStatus.textContent = `Material: Black +${Math.abs(advantage)}`;
  } else {
    materialStatus.textContent = 'Material: Even';
  }
}

/**
 * Calculate material score for a side
 */
function calculateMaterialScore(color) {
  const pieces = game.board().flat();
  let score = 0;
  
  pieces.forEach(piece => {
    if (piece && piece.color === (color === 'white' ? 'w' : 'b')) {
      score += PIECE_VALUES[piece.type] || 0;
    }
  });
  
  return score;
}

/**
 * Update status bar with game information
 */
function updateStatusBar() {
  // Update PGN status
  const pgnStatus = document.getElementById('pgn-status');
  if (pgnStatus && game) {
    const history = game.history({ verbose: true });
    if (history.length > 0) {
      const lastMove = history[history.length - 1];
      pgnStatus.textContent = `${Math.ceil(history.length / 2)}.${history.length % 2 === 1 ? '' : '..'} ${lastMove.san}`;
    } else {
      pgnStatus.textContent = 'Ready to play';
    }
  }
  
  // Update captured pieces status
  const capturedStatus = document.getElementById('captured-pieces-status');
  if (capturedStatus) {
    const whiteCaptures = capturedPieces.white;
    const blackCaptures = capturedPieces.black;
    
    if (whiteCaptures.length === 0 && blackCaptures.length === 0) {
      capturedStatus.textContent = 'None yet';
    } else {
      const whitePieces = whiteCaptures.map(p => getPieceSymbol(p, 'white')).join('');
      const blackPieces = blackCaptures.map(p => getPieceSymbol(p, 'black')).join('');
      capturedStatus.textContent = `${whitePieces} vs ${blackPieces}`;
    }
  }
  
  // Update opening name (placeholder for now)
  const openingName = document.getElementById('opening-name');
  if (openingName) {
    const moveCount = game ? game.history().length : 0;
    if (moveCount === 0) {
      openingName.textContent = 'Opening: Starting position';
    } else if (moveCount < 6) {
      openingName.textContent = 'Opening: In progress';
    } else {
      openingName.textContent = 'Opening: Middle game';
    }
  }
}

/**
 * Get piece symbol for display
 */
function getPieceSymbol(pieceType, color) {
  const symbols = {
    'p': color === 'white' ? '♙' : '♟',
    'r': color === 'white' ? '♖' : '♜',
    'n': color === 'white' ? '♘' : '♞',
    'b': color === 'white' ? '♗' : '♝',
    'q': color === 'white' ? '♕' : '♛',
    'k': color === 'white' ? '♔' : '♚'
  };
  return symbols[pieceType] || '';
}

/**
 * Handle player move for chat interaction
 */
function handlePlayerMove(move) {
  if (!chatEngine || !move) return;
  
  // Generate opening comment for first few moves
  if (game.history().length <= 6) {
    const openingComment = chatEngine.generateOpeningComment(move.san);
    if (openingComment) {
      setTimeout(() => displayChatMessage(openingComment), 800);
      return;
    }
  }
  
  // Check for special events
  if (move.captured) {
    const captureComment = chatEngine.generateEventComment('capture');
    if (captureComment) {
      setTimeout(() => displayChatMessage(captureComment), 800);
      return;
    }
  }
  
  if (move.flags.includes('k') || move.flags.includes('q')) {
    const castleComment = chatEngine.generateEventComment('castle');
    if (castleComment) {
      setTimeout(() => displayChatMessage(castleComment), 800);
      return;
    }
  }
  
  if (move.promotion) {
    const promotionComment = chatEngine.generateEventComment('promotion');
    if (promotionComment) {
      setTimeout(() => displayChatMessage(promotionComment), 800);
      return;
    }
  }
  
  // Generate general move commentary occasionally
  if (Math.random() < 0.3) { // 30% chance for general commentary
    const moveComment = chatEngine.generateMoveComment('interesting', move.san);
    if (moveComment) {
      setTimeout(() => displayChatMessage(moveComment), 800);
    }
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
  
  const eloInput = document.getElementById('user-elo-input') || document.getElementById('elo-input');
  const strengthInput = document.getElementById('strength-input');
  
  // Update gameConfig to match loaded preferences
  if (preferences.userElo) {
    gameConfig.userElo = preferences.userElo;
    if (eloInput) {
      eloInput.value = preferences.userElo;
    }
  }
  
  if (preferences.strengthPercentage !== undefined) {
    gameConfig.strengthPercentage = preferences.strengthPercentage;
    if (strengthInput) {
      strengthInput.value = preferences.strengthPercentage;
    }
  }
  
  // Update opponent ELO based on user ELO
  updateEloCalculation();
  
  console.log('Loaded user preferences:', preferences);
  console.log('Updated gameConfig:', gameConfig);
}

/**
 * Load highlight preference from localStorage
 */
function loadHighlightPreference() {
  try {
    const saved = localStorage.getItem('chess-highlights-enabled');
    if (saved !== null) {
      highlightsEnabled = JSON.parse(saved);
      console.log('Loaded highlight preference:', highlightsEnabled);
    }
  } catch (error) {
    console.warn('Failed to load highlight preference:', error);
    highlightsEnabled = true; // Default to enabled
  }
  updateHighlightButton();
}

/**
 * Save highlight preference to localStorage
 */
function saveHighlightPreference() {
  try {
    localStorage.setItem('chess-highlights-enabled', JSON.stringify(highlightsEnabled));
  } catch (error) {
    console.warn('Failed to save highlight preference:', error);
  }
}

/**
 * Toggle highlights on/off
 */
function toggleHighlights() {
  console.log('🎯 Toggling highlights from', highlightsEnabled, 'to', !highlightsEnabled);
  highlightsEnabled = !highlightsEnabled;
  saveHighlightPreference();
  updateHighlightButton();
  updateHighlightsClass();
  
  // Clear highlights if disabling
  if (!highlightsEnabled) {
    console.log('🎯 Clearing highlights because highlights disabled');
  } else if (selectedSquare) {
    // Re-show highlights if re-enabling and a square is selected
    console.log('🎯 Re-showing highlights for selected square:', selectedSquare);
    highlightSquare(selectedSquare);
    if (legalMoves.length > 0) {
      highlightLegalMoves(legalMoves);
    }
  }
}

/**
 * Update highlight toggle button text and state
 */
function updateHighlightButton() {
  const button = document.getElementById('toggle-highlights-btn');
  const text = document.getElementById('highlight-toggle-text');
  
  if (button && text) {
    text.textContent = highlightsEnabled ? 'Highlights On' : 'Highlights Off';
    button.className = highlightsEnabled ? 
      'header-button secondary-button' : 
      'header-button secondary-button highlights-disabled';
    button.title = highlightsEnabled ? 
      'Click to disable move highlights' : 
      'Click to enable move highlights';
  }
}

/**
 * Update highlights class on board container
 */
function updateHighlightsClass() {
  console.log('🎯 updateHighlightsClass() called - DISABLED to prevent any class changes');
  // Completely disabled to prevent any CSS class changes that could cause flashing
  return;
}

/**
 * Convert piece type to Unicode symbol
 */
function getPieceSymbol(piece, color) {
  const symbols = {
    'p': color === 'w' ? '♙' : '♟',
    'r': color === 'w' ? '♖' : '♜',  
    'n': color === 'w' ? '♘' : '♞',
    'b': color === 'w' ? '♗' : '♝',
    'q': color === 'w' ? '♕' : '♛',
    'k': color === 'w' ? '♔' : '♚'
  };
  return symbols[piece] || '';
}

/**
 * Update captured pieces display and calculate scores
 */
function updateCapturedPieces() {
  // Get current board position
  const history = game.history({ verbose: true });
  
  // Reset captured pieces
  capturedPieces.white = [];
  capturedPieces.black = [];
  
  // Process all moves to find captures
  history.forEach(move => {
    if (move.captured) {
      const capturingColor = move.color;
      const capturedPiece = move.captured;
      
      // Add to appropriate captured array
      if (capturingColor === 'w') {
        capturedPieces.white.push(capturedPiece);
      } else {
        capturedPieces.black.push(capturedPiece);
      }
    }
  });
  
  // Sort captured pieces by value (ascending)
  capturedPieces.white.sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
  capturedPieces.black.sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
  
  // Update display
  updateCapturedPiecesDisplay();
}

/**
 * Update the visual display of captured pieces
 */
function updateCapturedPiecesDisplay() {
  // Update white captured pieces (captured by white)
  const whiteCapturedContainer = document.querySelector('#captured-white .captured-pieces-container');
  const whiteScoreElement = document.getElementById('score-white');
  
  if (whiteCapturedContainer) {
    whiteCapturedContainer.innerHTML = '';
    capturedPieces.white.forEach(piece => {
      const pieceElement = document.createElement('span');
      pieceElement.className = 'captured-piece';
      pieceElement.textContent = getPieceSymbol(piece, 'b'); // Show black piece
      pieceElement.title = getPieceFullName(piece);
      whiteCapturedContainer.appendChild(pieceElement);
    });
  }
  
  // Update black captured pieces (captured by black)
  const blackCapturedContainer = document.querySelector('#captured-black .captured-pieces-container');
  const blackScoreElement = document.getElementById('score-black');
  
  if (blackCapturedContainer) {
    blackCapturedContainer.innerHTML = '';
    capturedPieces.black.forEach(piece => {
      const pieceElement = document.createElement('span');
      pieceElement.className = 'captured-piece';
      pieceElement.textContent = getPieceSymbol(piece, 'w'); // Show white piece
      pieceElement.title = getPieceFullName(piece);
      blackCapturedContainer.appendChild(pieceElement);
    });
  }
  
  // Calculate and display scores
  const whiteScore = capturedPieces.white.reduce((sum, piece) => sum + PIECE_VALUES[piece], 0);
  const blackScore = capturedPieces.black.reduce((sum, piece) => sum + PIECE_VALUES[piece], 0);
  const scoreDifference = whiteScore - blackScore;
  
  if (whiteScoreElement) {
    const scoreText = scoreDifference > 0 ? `+${scoreDifference}` : scoreDifference === 0 ? '0' : `${scoreDifference}`;
    whiteScoreElement.textContent = scoreText;
    whiteScoreElement.className = 'score ' + (scoreDifference > 0 ? 'positive' : scoreDifference < 0 ? 'negative' : 'neutral');
  }
  
  if (blackScoreElement) {
    const scoreText = scoreDifference < 0 ? `+${Math.abs(scoreDifference)}` : scoreDifference === 0 ? '0' : `-${scoreDifference}`;
    blackScoreElement.textContent = scoreText;
    blackScoreElement.className = 'score ' + (scoreDifference < 0 ? 'positive' : scoreDifference > 0 ? 'negative' : 'neutral');
  }
}

/**
 * Get full name of piece for tooltip
 */
function getPieceFullName(piece) {
  const names = {
    'p': 'Pawn',
    'r': 'Rook', 
    'n': 'Knight',
    'b': 'Bishop',
    'q': 'Queen',
    'k': 'King'
  };
  return names[piece] || '';
}

/**
 * Reset captured pieces for new game
 */
function resetCapturedPieces() {
  capturedPieces.white = [];
  capturedPieces.black = [];
  updateCapturedPiecesDisplay();
}

/**
 * Start the game timer
 */
function startGameTimer() {
  gameStartTime = Date.now();
  totalGameTime = 0;
  
  // Clear any existing timer
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
  }
  
  // Update timer display every second
  gameTimerInterval = setInterval(updateTimerDisplay, 1000);
  
  // Initial display
  updateTimerDisplay();
}

/**
 * Stop the game timer
 */
function stopGameTimer() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  
  // Calculate final time
  if (gameStartTime) {
    totalGameTime = Math.floor((Date.now() - gameStartTime) / 1000);
  }
}

/**
 * Reset the game timer
 */
function resetGameTimer() {
  stopGameTimer();
  gameStartTime = null;
  totalGameTime = 0;
  gameTimerStarted = false;
  updateTimerDisplay();
}

/**
 * Update the timer display
 */
function updateTimerDisplay() {
  const timerElement = document.getElementById('timer-display');
  if (!timerElement) return;
  
  let seconds;
  if (gameStartTime && gameTimerInterval) {
    // Game is running
    seconds = Math.floor((Date.now() - gameStartTime) / 1000);
  } else {
    // Game stopped or not started
    seconds = totalGameTime;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  timerElement.textContent = formattedTime;
}

/**
 * Get formatted game duration
 */
function getGameDuration() {
  const seconds = totalGameTime || (gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Start a new game with current settings
 */
function newGame() {
  try {
    console.log('Starting new game with existing config:', gameConfig);
    
    // Reset game state
    game.reset();
    board.position('start');
    lastMove = null;
    selectedSquare = null;
    
    // Reset captured pieces and timer
    resetCapturedPieces();
    resetGameTimer();
    
    // Reset chat
    if (chatEngine) {
      chatEngine.clearHistory();
      
      // Clear chat messages from UI
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }
      
      // Generate new greeting
      const greeting = chatEngine.generateGreeting(gameConfig.opponentElo);
      if (greeting) {
        setTimeout(() => displayChatMessage(greeting), 500);
      }
    }
    
    // Update UI
    updateMoveHistory();
    updateTurnIndicator();
    updateHeaderDisplays();
    updateStatusBar();
    const difficultyName = window.EngineConfig.getDifficultyDescription(gameConfig.opponentElo);
    updateGameStatus(`Playing against ${gameConfig.opponentElo} ELO (${difficultyName}) opponent`);
    saveGameState();
    
    console.log('New game started successfully');
    
    // If it's black's turn (somehow), make AI move
    if (game.turn() === 'b' && isEngineInitialized) {
      setTimeout(makeComputerMove, 500);
    }
    
  } catch (error) {
    handleError('Failed to start new game', error);
  }
}

/**
 * Return to setup screen to change ELO/difficulty settings
 */
function backToSetup() {
  try {
    console.log('Returning to setup screen');
    
    // Clear any saved game state so we don't auto-load it
    localStorage.removeItem('chess-game-state');
    
    // Hide game section, show setup
    document.getElementById('game-section').classList.add('hidden');
    document.getElementById('setup-section').classList.remove('hidden');
    
    // Update setup section with current values
    const eloInput = document.getElementById('elo-input');
    const strengthInput = document.getElementById('strength-input');
    
    if (eloInput && gameConfig.userElo) {
      eloInput.value = gameConfig.userElo;
    }
    
    if (strengthInput && gameConfig.strengthPercentage !== undefined) {
      strengthInput.value = gameConfig.strengthPercentage;
    }
    
    // Update displays
    updateEloCalculation();
    
    console.log('Returned to setup screen successfully');
    
  } catch (error) {
    handleError('Failed to return to setup', error);
  }
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
    lastMove = null;
    selectedSquare = null;
    
    // Reset captured pieces and timer
    resetCapturedPieces();
    resetGameTimer();
    
    // Show game section, hide setup
    document.getElementById('setup-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
    
    // Update UI
    updateMoveHistory();
    updateTurnIndicator();
    const difficultyName = window.EngineConfig.getDifficultyDescription(gameConfig.opponentElo);
    updateGameStatus(`Playing against ${gameConfig.opponentElo} ELO (${difficultyName}) opponent`);
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

// Drag and drop handlers removed - using click-only system

// onDrop function removed - using click-only system

// onSnapEnd function removed - using click-only system

// REMOVED - Using drag and drop instead of clicks

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
  
  // Stop timer and clear highlights
  stopGameTimer();
  clearHighlights();
  
  console.log('Game over:', status, '- Duration:', getGameDuration());
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
  
  // CSS class changes DISABLED to prevent flashing
  console.log('🎮 Turn indicator visual updates DISABLED to prevent flashing');
  
  if (currentTurn === 'w') {
    turnText.textContent = 'White to move';
    pieceIcon.textContent = '♔';
  } else {
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
  
  // All CSS class changes DISABLED to prevent flashing
  console.log('🎮 Game status visual updates DISABLED to prevent flashing');
  
  if (game.in_check()) {
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
  console.log('🟠 highlightSquare() called for:', square, '- DISABLED to prevent flashing');
  // Completely disabled to prevent flashing
  return;
}

/**
 * Highlight legal moves
 */
function highlightLegalMoves(moves) {
  console.log('🟣 highlightLegalMoves() called with', moves.length, 'moves - DISABLED to prevent flashing');
  // Completely disabled to prevent flashing
  return;
}

/**
 * Highlight the last move made
 */
function highlightLastMove(move) {
  console.log('🔵 highlightLastMove() called - DISABLED to prevent flashing');
  // Completely disabled to prevent flashing
  return;
}

/**
 * Highlight king in check
 */
function highlightCheck() {
  console.log('🟦 highlightCheck() called - DISABLED to prevent flashing');
  // Completely disabled to prevent flashing
  return;
}

/**
 * Clear all highlights
 */
function clearHighlights() {
  console.log('🔵 clearHighlights() called - DISABLED (no highlights to clear)');
  // Completely disabled since we're not using highlights anymore
  return;
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
 * Make computer move using Stockfish engine
 */
async function makeComputerMove() {
  console.log('🤖 makeComputerMove called - engine initialized:', isEngineInitialized, 'game turn:', game.turn());
  
  if (!isEngineInitialized || !engine) {
    console.log('🤖 Engine not available for computer move');
    return;
  }
  
  if (game.turn() !== 'b') {
    console.log('🤖 Not black\'s turn, skipping computer move');
    return;
  }
  
  try {
    console.log('🤖 Computer is thinking...');
    
    // Show AI thinking in chat
    if (chatEngine && isGameStarted) {
      showAIThinking();
    }
    
    // Disable board interactions during AI turn
    setBoardInteractive(false);
    console.log('🤖 Board interaction disabled for AI turn');
    
    // Get engine configuration based on target ELO
    const engineConfig = window.EngineConfig.getRandomizedEngineConfig(gameConfig.opponentElo);
    const difficultyName = window.EngineConfig.getDifficultyDescription(gameConfig.opponentElo);
    
    console.log(`🤖 AI Thinking: ${gameConfig.opponentElo} ELO (${difficultyName})`);
    console.log(`⚙️ Engine settings: Skill=${engineConfig.skillLevel}, Depth=${engineConfig.depth}, Time=${engineConfig.moveTime}ms`);
    console.log('📊 Full config:', engineConfig);
    
    // Get current position
    const fen = game.fen();
    
    // Request best move from engine with timeout protection
    const timeout = engineConfig.moveTime + 10000; // Add 10 second buffer to engine timeout
    
    let move;
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Engine timeout')), timeout)
      );
      
      // Race between engine move and timeout
      move = await Promise.race([
        engine.getBestMove(fen, engineConfig, gameConfig.opponentElo),
        timeoutPromise
      ]);
      
    } catch (timeoutError) {
      console.warn('Engine timeout, making random legal move:', timeoutError.message);
      // Make a random legal move as fallback
      const legalMoves = game.moves();
      if (legalMoves.length === 0) {
        throw new Error('No legal moves available');
      }
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      const fallbackResult = game.move(randomMove);
      if (!fallbackResult) {
        throw new Error('Failed to make timeout fallback move');
      }
      console.log('Computer played (timeout fallback):', fallbackResult.san);
      
      // Update board position immediately (no animations)
      board.position(game.fen());
      lastMove = { from: fallbackResult.from, to: fallbackResult.to };
      updateMoveHistory();
      updateTurnIndicator();
      updateGameStatus();
      updateCapturedPieces();
      updateHeaderDisplays();
      updateStatusBar();
      saveGameState();
      
      setBoardInteractive(true);
      hideAIThinking();
      
      if (chatEngine && isGameStarted) {
        setTimeout(() => {
          const moveComment = chatEngine.generateMoveComment('interesting', fallbackResult.san);
          if (moveComment) {
            displayChatMessage(moveComment);
          }
        }, 500);
      }
      
      // No visual highlighting - just check game state
      if (game.game_over()) {
        setTimeout(handleGameOver, 500);
      }
      
      return; // Exit early since we handled the move
    }
    
    if (!move || move === '(none)') {
      throw new Error('Engine returned no move');
    }
    
    console.log('Engine suggests move:', move);
    
    // Convert UCI move to chess.js move format
    const engineMove = parseUCIMove(move);
    
    // Validate the move before executing it
    const legalMoves = game.moves({ verbose: true });
    const moveString = typeof engineMove === 'string' ? engineMove : 
                      `${engineMove.from}${engineMove.to}${engineMove.promotion || ''}`;
    
    // Check if the move is in legal moves
    const isLegalMove = legalMoves.some(legalMove => {
      const legalMoveString = `${legalMove.from}${legalMove.to}${legalMove.promotion || ''}`;
      return legalMoveString === moveString;
    });
    
    let result;
    if (!isLegalMove) {
      console.warn(`Engine suggested illegal move: ${move}. Making random legal move instead.`);
      // Make a random legal move as fallback
      const randomLegalMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      result = game.move(randomLegalMove);
      if (!result) {
        throw new Error('Failed to make fallback move');
      }
      console.log('Computer played (fallback):', result.san);
    } else {
      // Make the move
      result = game.move(engineMove);
      
      if (!result) {
        throw new Error(`Invalid engine move: ${move}`);
      }
      console.log('Computer played:', result.san);
    }
    
    // Use optimized move animation to prevent flashing
    console.log('🎯 Computer move flags:', result.flags, 'From:', result.from, 'To:', result.to);
    
    // Mark animation start
    isAnimating = true;
    
    // ALL MOVES: Use immediate board position update (no animations or delays)
    console.log('🎯 Computer move - using immediate board update (no animations)');
    board.position(game.fen());
    isAnimating = false;
    
    // Store last move for highlighting
    lastMove = { from: result.from, to: result.to };
    
    // Update UI
    updateMoveHistory();
    updateTurnIndicator();
    updateGameStatus();
    updateCapturedPieces();
    updateHeaderDisplays();
    updateStatusBar();
    saveGameState();
    
    // Hide AI thinking and re-enable board
    if (chatEngine && isGameStarted) {
      hideAIThinking();
      
      // Generate AI move commentary
      setTimeout(() => {
        const moveComment = chatEngine.generateMoveComment('good', result.san);
        if (moveComment) {
          displayChatMessage(moveComment);
        }
      }, 500);
    }
    
    // Critical: Always re-enable board after computer move
    setBoardInteractive(true);
    console.log('🤖 Computer move complete, board re-enabled');
    
    // No visual highlighting - just check game state
    if (game.game_over()) {
      setTimeout(handleGameOver, 500);
    }
    
  } catch (error) {
    console.error('🤖 Computer move failed:', error);
    
    // Critical: Always restore board state regardless of what went wrong
    try {
      setBoardInteractive(true);
      isAnimating = false;
      console.log('🤖 Board interaction restored after error');
    } catch (restoreError) {
      console.error('🤖 Failed to restore board interaction:', restoreError);
    }
    
    try {
      hideAIThinking();
    } catch (hideError) {
      console.error('🤖 Failed to hide AI thinking:', hideError);
    }
    
    // No visual effects to clear
    
    // Update UI to reflect current state
    updateTurnIndicator();
    updateStatusBar();
    
    // Show error message but keep the game playable
    showEngineError('AI opponent encountered an error. Game continues - your turn.');
    
    // Add fallback chat message if chat engine is available
    if (chatEngine && isGameStarted) {
      setTimeout(() => {
        const errorMessage = chatEngine.addMessage('ai', 'Oops! I had a thinking error. Your turn to move!');
        displayChatMessage(errorMessage);
      }, 1000);
    }
  }
}

/**
 * Parse UCI move notation to chess.js move object
 * @param {string} uciMove - Move in UCI format (e.g., 'e2e4', 'e7e8q')
 * @returns {Object|string} Move object or string for chess.js
 */
function parseUCIMove(uciMove) {
  if (!uciMove || uciMove.length < 4) {
    throw new Error('Invalid UCI move format');
  }
  
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = uciMove.length > 4 ? uciMove.slice(4) : null;
  
  const move = { from, to };
  if (promotion) {
    move.promotion = promotion;
  }
  
  return move;
}

/**
 * Show/hide AI thinking indicator
 * @param {boolean} show - Whether to show the thinking indicator
 */
function showAIThinking(show) {
  const aiStatus = document.getElementById('ai-status');
  if (!aiStatus) return;
  
  if (show) {
    aiStatus.innerHTML = `
      <div class="ai-indicator">
        <div class="thinking-spinner"></div>
        <span>AI thinking...</span>
      </div>
    `;
    aiStatus.classList.remove('hidden');
  } else {
    aiStatus.classList.add('hidden');
  }
}

/**
 * Enable/disable board interactions
 * @param {boolean} interactive - Whether the board should be interactive
 */
function setBoardInteractive(interactive) {
  // This would ideally disable chessboard.js interactions
  // For now, we'll just track the state and check it in onDragStart
  const previousState = window.boardInteractive;
  window.boardInteractive = interactive;
  
  console.log('🎮 Board interaction changed from', previousState, 'to', interactive);
  
  // Visual feedback DISABLED to prevent flashing
  console.log('🎮 Visual feedback for board state DISABLED to prevent flashing');
  // No CSS class changes to prevent any visual effects
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