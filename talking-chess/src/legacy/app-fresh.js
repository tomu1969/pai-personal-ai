/**
 * Talking Chess - Fresh Implementation
 * Clean drag-and-drop chess interface
 */

// Global variables
let board = null;
let game = new Chess();
let engine = null;
let selectedSquare = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🎮 Initializing Talking Chess application...');
  
  try {
    // Initialize Stockfish engine
    engine = new StockfishEngine();
    await engine.init();
    console.log('✅ Stockfish engine initialized');
    
    // Initialize chess board
    initializeChessBoard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update UI
    updateGameStatus();
    updateEloDisplays();
    
    console.log('🎮 Application initialized successfully');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    showError('Failed to initialize chess application: ' + error.message);
  }
});

// Initialize the chess board with drag-and-drop
function initializeChessBoard() {
  console.log('🏁 Initializing chess board...');
  
  const boardConfig = {
    position: 'start',
    draggable: true,
    moveSpeed: 0,
    snapSpeed: 0,
    appearSpeed: 0,
    trashSpeed: 0,
    sparingUseOfAnimation: false,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: function(source, piece, position, orientation) {
      console.log('🎯 Drag start:', source, piece);
      
      // Only allow white pieces to be dragged (human player)
      if (piece.search(/^w/) === -1) {
        console.log('❌ Cannot drag black pieces');
        return false;
      }
      
      // Don't allow moves if game is over
      if (game.game_over()) {
        console.log('❌ Game is over');
        return false;
      }
      
      // Only allow moves if it's white's turn
      if (game.turn() !== 'w') {
        console.log('❌ Not white\'s turn');
        return false;
      }
      
      selectedSquare = source;
      console.log('✅ Drag allowed for', piece, 'from', source);
      return true;
    },
    
    onDrop: function(source, target, piece, newPos, oldPos, orientation) {
      console.log('🎯 Drop attempt:', source, '→', target, 'piece:', piece);
      
      // Attempt the move
      const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
      });
      
      if (move === null) {
        console.log('❌ Invalid move:', source, '→', target);
        return 'snapback';
      }
      
      console.log('✅ Move successful:', move.san);
      
      // ChessBoard.js already updated visually - no need to redraw
      // Update UI after successful move
      updateGameStatus();
      updateMoveHistory();
      
      // Trigger AI response after a short delay
      setTimeout(() => {
        makeComputerMove();
      }, 500);
      
      return; // Allow the move
    }
  };
  
  // Create the board
  board = Chessboard('chessboard', boardConfig);
  
  console.log('✅ Chess board initialized');
}

// Make computer move using Stockfish
async function makeComputerMove() {
  if (game.game_over()) {
    console.log('🏁 Game over, no computer move needed');
    return;
  }
  
  if (game.turn() !== 'b') {
    console.log('⚪ Not black\'s turn, skipping computer move');
    return;
  }
  
  try {
    console.log('🤖 Computer is thinking...');
    updateAIStatus('thinking');
    
    // Get current ELO settings
    const aiElo = parseInt(document.getElementById('ai-elo-input').value) || 1650;
    const strengthAdjustment = getStrengthAdjustment();
    const targetElo = Math.max(800, Math.min(3000, aiElo + strengthAdjustment));
    
    // Get fast engine configuration for quicker moves
    const config = {
      skillLevel: Math.max(1, Math.min(20, Math.round(targetElo / 150))), // 1-20 based on ELO
      depth: 3, // Reduced depth for faster moves
      moveTime: 500 // Only 500ms thinking time
    };
    
    console.log('🤖 Using fast engine config:', config);
    
    // Get best move from Stockfish
    const bestMove = await engine.getBestMove(game.fen(), config, targetElo);
    
    if (!bestMove || bestMove === '(none)') {
      console.log('🤖 No valid moves available for computer');
      updateAIStatus('ready');
      return;
    }
    
    // Parse UCI move (e.g., "e2e4" -> from: "e2", to: "e4")
    const from = bestMove.substring(0, 2);
    const to = bestMove.substring(2, 4);
    const promotion = bestMove.length > 4 ? bestMove.substring(4) : undefined;
    
    console.log(`🤖 Computer move: ${from} → ${to}${promotion ? ' (' + promotion + ')' : ''}`);
    
    // Make the move
    const move = game.move({
      from: from,
      to: to,
      promotion: promotion
    });
    
    if (move) {
      console.log('✅ Computer move successful:', move.san);
      
      // Update computer move on board (single clean update)
      console.log(`🎯 Computer move: ${from} → ${to}`);
      board.position(game.fen(), false);
      
      // Update UI
      updateGameStatus();
      updateMoveHistory();
      
      // Add AI chat message about the move
      addChatMessage('ai', `I played ${move.san}`, true);
      
    } else {
      console.error('❌ Computer move failed:', bestMove);
    }
    
  } catch (error) {
    console.error('❌ Computer move error:', error);
  } finally {
    updateAIStatus('ready');
  }
}

// Update game status display
function updateGameStatus() {
  const turnIndicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const moveNumber = document.getElementById('move-number');
  
  // Update turn indicator
  if (game.turn() === 'w') {
    turnIndicator.className = 'turn-indicator white-turn';
    turnText.textContent = 'White to move';
  } else {
    turnIndicator.className = 'turn-indicator black-turn';
    turnText.textContent = 'Black to move';
  }
  
  // Update move number
  const fullMoveNumber = Math.ceil(game.history().length / 2);
  moveNumber.textContent = fullMoveNumber || 1;
  
  // Check for game over conditions
  if (game.game_over()) {
    let gameOverMessage = '';
    if (game.in_checkmate()) {
      gameOverMessage = game.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
    } else if (game.in_stalemate()) {
      gameOverMessage = 'Game ends in stalemate';
    } else if (game.in_draw()) {
      gameOverMessage = 'Game ends in a draw';
    }
    
    if (gameOverMessage) {
      turnText.textContent = gameOverMessage;
      addChatMessage('system', gameOverMessage, true);
    }
  }
}

// Update move history display
function updateMoveHistory() {
  const pgnStatus = document.getElementById('pgn-status');
  const history = game.history();
  
  if (history.length === 0) {
    pgnStatus.textContent = 'Ready to play';
  } else {
    const lastMove = history[history.length - 1];
    pgnStatus.textContent = `Last move: ${lastMove}`;
  }
}

// Update AI status display
function updateAIStatus(status) {
  const strengthDisplay = document.getElementById('strength-display');
  
  switch (status) {
    case 'thinking':
      strengthDisplay.textContent = 'Thinking...';
      break;
    case 'ready':
      const adjustment = getStrengthAdjustment();
      const sign = adjustment >= 0 ? '+' : '';
      strengthDisplay.textContent = `${sign}${adjustment}%`;
      break;
  }
}

// Update ELO displays
function updateEloDisplays() {
  const userEloInput = document.getElementById('user-elo-input');
  const aiEloInput = document.getElementById('ai-elo-input');
  
  // Set default values if not already set
  if (!userEloInput.value) userEloInput.value = 1500;
  if (!aiEloInput.value) aiEloInput.value = 1650;
}

// Get strength adjustment percentage
function getStrengthAdjustment() {
  const aiElo = parseInt(document.getElementById('ai-elo-input').value) || 1650;
  const userElo = parseInt(document.getElementById('user-elo-input').value) || 1500;
  
  const diff = aiElo - userElo;
  return Math.round(diff / 10); // 10 ELO ≈ 1% strength
}

// Set up event listeners
function setupEventListeners() {
  // New game button
  const newGameBtn = document.getElementById('new-game-btn-header');
  if (newGameBtn) {
    newGameBtn.addEventListener('click', startNewGame);
  }
  
  // Flip board button
  const flipBoardBtn = document.getElementById('flip-board-btn-header');
  if (flipBoardBtn) {
    flipBoardBtn.addEventListener('click', () => {
      board.flip();
    });
  }
  
  // ELO adjustment buttons
  document.querySelectorAll('.elo-adjust').forEach(button => {
    button.addEventListener('click', adjustElo);
  });
  
  // Strength adjustment buttons
  document.querySelectorAll('.strength-adjust').forEach(button => {
    button.addEventListener('click', adjustStrength);
  });
  
  // Chat functionality
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-message-btn');
  
  if (chatInput && sendBtn) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
    
    sendBtn.addEventListener('click', sendChatMessage);
  }
  
  // Quick response buttons
  document.querySelectorAll('.quick-response').forEach(button => {
    button.addEventListener('click', () => {
      const message = button.dataset.message;
      addChatMessage('user', message, false);
      setTimeout(() => {
        addChatMessage('ai', getAIResponse(message), true);
      }, 500);
    });
  });
}

// Start a new game
function startNewGame() {
  console.log('🆕 Starting new game...');
  
  game.reset();
  board.start();
  
  updateGameStatus();
  updateMoveHistory();
  updateAIStatus('ready');
  
  // Clear chat
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    chatMessages.innerHTML = '';
    addChatMessage('ai', 'Good luck with our game!', true);
  }
  
  console.log('✅ New game started');
}

// Adjust ELO rating
function adjustElo(event) {
  const button = event.target;
  const type = button.dataset.type;
  const delta = parseInt(button.dataset.delta);
  
  const input = document.getElementById(`${type}-elo-input`);
  if (input) {
    const currentValue = parseInt(input.value) || 1500;
    const newValue = Math.max(800, Math.min(3000, currentValue + delta));
    input.value = newValue;
    
    if (type === 'ai') {
      updateAIStatus('ready');
    }
  }
}

// Adjust AI strength
function adjustStrength(event) {
  const button = event.target;
  const delta = parseInt(button.dataset.delta);
  
  const aiEloInput = document.getElementById('ai-elo-input');
  if (aiEloInput) {
    const currentValue = parseInt(aiEloInput.value) || 1650;
    const newValue = Math.max(800, Math.min(3000, currentValue + delta));
    aiEloInput.value = newValue;
    
    updateAIStatus('ready');
  }
}

// Send chat message
function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  if (!chatInput || !chatInput.value.trim()) return;
  
  const message = chatInput.value.trim();
  addChatMessage('user', message, false);
  chatInput.value = '';
  
  // Simple AI response after delay
  setTimeout(() => {
    addChatMessage('ai', getAIResponse(message), true);
  }, 1000);
}

// Add message to chat
function addChatMessage(sender, message, animated) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  
  const avatar = sender === 'user' ? '👤' : sender === 'ai' ? '🤖' : '⚙️';
  
  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-text">${message}</div>
      <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Get AI response for chat
function getAIResponse(message) {
  const responses = [
    'That\'s a great observation!',
    'I appreciate your perspective.',
    'Let\'s focus on the game!',
    'Good thinking!',
    'Thanks for sharing that.',
    'Interesting point!',
    'Let\'s see how this game develops.'
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Show error message
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  
  if (errorContainer && errorText) {
    errorText.textContent = message;
    errorContainer.classList.remove('hidden');
  } else {
    alert(message);
  }
}

console.log('📜 app-fresh.js loaded successfully');