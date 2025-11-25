/**
 * Talking Chess V2 - Clean Canvas Implementation
 * No external dependencies, no flashing, instant moves
 */

// Game state
let game = new Chess();
let engine = null;
let canvas = null;
let ctx = null;

// UI state
let selectedSquare = null;
let legalMoves = [];
let isFlipped = false;
let isPlayerTurn = true;

// Board settings
const BOARD_SIZE = 480;
const SQUARE_SIZE = BOARD_SIZE / 8;

// Colors
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
const HIGHLIGHT_COLOR = 'rgba(255, 255, 0, 0.5)';
const LEGAL_MOVE_COLOR = 'rgba(76, 175, 80, 0.3)';
const SELECTED_COLOR = 'rgba(255, 255, 0, 0.7)';

// Chess pieces - beautiful images
const pieceImages = {};
const PIECE_NAMES = {
  'K': 'wK', 'Q': 'wQ', 'R': 'wR', 'B': 'wB', 'N': 'wN', 'P': 'wP',
  'k': 'bK', 'q': 'bQ', 'r': 'bR', 'b': 'bB', 'n': 'bN', 'p': 'bP'
};

// Load piece images
function loadPieceImages() {
  const baseUrl = 'https://chessboardjs.com/img/chesspieces/wikipedia/';
  
  Object.values(PIECE_NAMES).forEach(pieceName => {
    const img = new Image();
    img.src = `${baseUrl}${pieceName}.png`;
    pieceImages[pieceName] = img;
  });
}

// Call this on initialization
loadPieceImages();

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🎮 Initializing Talking Chess V2...');
  
  try {
    // Get canvas
    canvas = document.getElementById('chess-canvas');
    ctx = canvas.getContext('2d');
    
    // Set up canvas click handler immediately - game works without engine
    canvas.addEventListener('click', handleBoardClick);
    
    // Enable basic game functionality first
    isPlayerTurn = true;
    console.log('✅ Basic chess functionality enabled');
    
    // Initialize engine with timeout and fallback
    console.log('⏳ Initializing Stockfish engine with timeout...');
    await initializeEngineWithTimeout();
    
    // Initial render (with small delay for images to load)
    setTimeout(() => {
      renderBoard();
      updateUI();
      
      // Set initial AI status based on starting ELO
      const initialElo = parseInt(document.getElementById('ai-elo').value) || 1650;
      adjustElo('ai', 0); // This will set the correct status display
      
      // Display system status
      displaySystemStatus();
    }, 500);
    
    console.log('🎮 Chess V2 initialized successfully');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    // Don't alert - just log the error and continue with basic functionality
    console.log('⚠️ Continuing with basic chess functionality...');
  }
});

// Initialize engine with timeout to prevent blocking
async function initializeEngineWithTimeout() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('⚠️ Engine initialization timed out - using fallback mode');
      engine = null;
      resolve(false);
    }, 5000); // 5 second timeout
    
    (async () => {
      try {
        engine = new StockfishEngine();
        await engine.init();
        clearTimeout(timeout);
        console.log('✅ Stockfish engine initialized successfully');
        resolve(true);
      } catch (error) {
        clearTimeout(timeout);
        console.warn('⚠️ Engine initialization failed:', error.message);
        console.log('⚠️ Continuing without AI opponent...');
        engine = null;
        resolve(false);
      }
    })();
  });
}

// Display system status for debugging
function displaySystemStatus() {
  console.log('🎮 =================================');
  console.log('🎮 TALKING CHESS SYSTEM STATUS');
  console.log('🎮 =================================');
  console.log('🎮 Chess Game:', game ? '✅ Available' : '❌ Missing');
  console.log('🎮 Stockfish Engine:', (engine && engine.isReady) ? '✅ Ready' : '⚠️ Using fallback');
  console.log('🎮 Canvas:', (canvas && ctx) ? '✅ Ready' : '❌ Not available');
  console.log('🎮 Player Turn:', isPlayerTurn ? '✅ Yes' : '❌ No');
  console.log('🎮 Script Load Errors:', window.scriptLoadErrors?.length || 0);
  
  if (window.scriptLoadErrors?.length > 0) {
    console.log('🎮 Failed Scripts:', window.scriptLoadErrors.join(', '));
  }
  
  console.log('🎮 Chat Components:', {
    ChatWrapper: typeof ChatWrapper !== 'undefined' ? '✅' : '⚠️',
    ChessMentorIntegration: typeof ChessMentorIntegration !== 'undefined' ? '✅' : '⚠️',
    GameStateCapture: typeof GameStateCapture !== 'undefined' ? '✅' : '⚠️'
  });
  
  console.log('🎮 =================================');
  console.log('🎮 STATUS: Game should be playable', (game && canvas && ctx) ? '✅' : '❌');
  console.log('🎮 =================================');
}

// Convert canvas coordinates to chess square
function getSquareFromCoords(x, y) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = x - rect.left;
  const canvasY = y - rect.top;
  
  const file = Math.floor(canvasX / SQUARE_SIZE);
  const rank = Math.floor(canvasY / SQUARE_SIZE);
  
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  
  // Convert to chess notation
  const fileChar = String.fromCharCode(97 + (isFlipped ? 7 - file : file)); // a-h
  const rankChar = String(isFlipped ? rank + 1 : 8 - rank); // 1-8
  
  return fileChar + rankChar;
}

// Convert chess square to canvas coordinates
function getSquareCoords(square) {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const rank = parseInt(square[1]) - 1;   // 1=0, 2=1, etc.
  
  const x = (isFlipped ? 7 - file : file) * SQUARE_SIZE;
  const y = (isFlipped ? rank : 7 - rank) * SQUARE_SIZE;
  
  return { x, y };
}

// Validate game state for move processing
function validateGameState() {
  // Check if essential components are available
  if (!game || typeof game.fen !== 'function') {
    console.error('❌ Game object not available or invalid');
    return false;
  }
  
  if (!canvas || !ctx) {
    console.error('❌ Canvas not available or invalid');
    return false;
  }
  
  // Check if game is in a valid state
  try {
    game.fen(); // This will throw if game state is corrupted
    if (game.game_over()) {
      console.log('🏁 Game is over - moves not allowed');
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Game state corrupted:', error.message);
    return false;
  }
}

// Handle board clicks
function handleBoardClick(event) {
  // Validate game state before processing moves
  if (!validateGameState()) {
    console.warn('⚠️ Game state invalid - click ignored');
    return;
  }
  
  if (!isPlayerTurn) {
    console.log('🖱️ Not player turn - click ignored');
    return;
  }
  
  const square = getSquareFromCoords(event.clientX, event.clientY);
  if (!square) return;
  
  console.log('🖱️ Clicked square:', square);
  
  // If clicking on selected square, deselect
  if (selectedSquare === square) {
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
    return;
  }
  
  // If we have a selected piece and click on a legal move, make the move
  if (selectedSquare && legalMoves.includes(square)) {
    makeMove(selectedSquare, square);
    return;
  }
  
  // Select new piece if it belongs to current player
  const piece = game.get(square);
  if (piece && piece.color === game.turn()) {
    selectedSquare = square;
    legalMoves = game.moves({ square: square, verbose: true }).map(move => move.to);
    console.log('✅ Selected piece:', piece, 'Legal moves:', legalMoves);
    renderBoard();
  } else {
    // Clicked on empty square or opponent piece with no selection
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  }
}

// Make a move
function makeMove(from, to) {
  console.log('🎯 Making move:', from, '->', to);
  
  const move = game.move({
    from: from,
    to: to,
    promotion: 'q' // Always promote to queen
  });
  
  if (move) {
    console.log('✅ Move successful:', move.san);
    
    // Clear selection
    selectedSquare = null;
    legalMoves = [];
    
    // Update UI
    renderBoard();
    updateUI();
    addMoveToHistory(move.san);
    
    // Check if game is over
    if (game.game_over()) {
      handleGameOver();
      return move; // Return move object for success indication
    }
    
    // Switch to AI turn
    isPlayerTurn = false;
    document.getElementById('ai-status').textContent = 'Thinking...';
    document.getElementById('ai-status').className = 'ai-status thinking';
    
    // Make computer move with 2 second delay
    console.log('🤖 AI starting to think... (2 second delay)');
    setTimeout(() => {
      console.log('🤖 2 seconds elapsed, making AI move now');
      makeComputerMove();
    }, 2000);
    
    return move; // Return move object for success indication
  } else {
    console.log('❌ Illegal move attempted');
    return false; // Return false for failed moves
  }
}

// Make computer move
async function makeComputerMove() {
  try {
    // Check if engine is available
    if (!engine || !engine.isReady) {
      console.warn('🤖 Engine not available - using random move fallback');
      await makeRandomComputerMove();
      return;
    }
    
    // Get AI difficulty
    const aiElo = parseInt(document.getElementById('ai-elo').value) || 1650;
    
    // Configure AI strength with dramatic differences
    let skillLevel, depth, moveTime;
    
    if (aiElo < 1000) {
      skillLevel = 1;  // Very weak
      depth = 1;
      moveTime = 200;
    } else if (aiElo < 1200) {
      skillLevel = 3;  // Beginner
      depth = 2;
      moveTime = 300;
    } else if (aiElo < 1500) {
      skillLevel = 6;  // Intermediate
      depth = 3;
      moveTime = 500;
    } else if (aiElo < 1800) {
      skillLevel = 10; // Advanced
      depth = 4;
      moveTime = 800;
    } else if (aiElo < 2200) {
      skillLevel = 15; // Expert
      depth = 6;
      moveTime = 1200;
    } else {
      skillLevel = 20; // Master
      depth = 8;
      moveTime = 1500;
    }
    
    const config = {
      skillLevel: skillLevel,
      depth: depth,
      moveTime: moveTime
    };
    
    console.log(`🤖 AI ELO: ${aiElo} | Skill: ${config.skillLevel}/20 | Depth: ${config.depth} | Time: ${config.moveTime}ms`);
    console.log('🤖 Configuration details:', {
      eloRange: aiElo < 1000 ? 'Very Weak' : aiElo < 1200 ? 'Beginner' : aiElo < 1500 ? 'Intermediate' : aiElo < 1800 ? 'Advanced' : aiElo < 2200 ? 'Expert' : 'Master',
      skillPercent: Math.round((skillLevel / 20) * 100) + '%',
      strength: skillLevel <= 5 ? 'Makes obvious mistakes' : skillLevel <= 10 ? 'Decent but flawed' : skillLevel <= 15 ? 'Strong play' : 'Near perfect'
    });
    
    const bestMove = await engine.getBestMove(game.fen(), config, aiElo);
    
    if (bestMove && bestMove !== '(none)') {
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      
      console.log(`🤖 Computer move: ${from} -> ${to}`);
      
      const move = game.move({
        from: from,
        to: to,
        promotion: bestMove.length > 4 ? bestMove.substring(4) : 'q'
      });
      
      if (move) {
        console.log('✅ Computer move successful:', move.san);
        
        // Update UI immediately
        renderBoard();
        updateUI();
        addMoveToHistory(move.san, true);
        
        // Check if game is over
        if (game.game_over()) {
          handleGameOver();
          return;
        }
        
        // Switch back to player turn
        isPlayerTurn = true;
        document.getElementById('ai-status').textContent = 'Ready';
        document.getElementById('ai-status').className = 'ai-status';
      }
    }
  } catch (error) {
    console.error('❌ Computer move failed:', error);
    console.log('🔧 Attempting fallback to random move...');
    await makeRandomComputerMove();
  }
}

// Make random computer move (fallback when engine unavailable)
async function makeRandomComputerMove() {
  try {
    const moves = game.moves();
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      const move = game.move(randomMove);
      console.log('🎲 Random move successful:', move.san);
      
      renderBoard();
      updateUI();
      addMoveToHistory(move.san, true);
      
      // Check if game is over
      if (game.game_over()) {
        handleGameOver();
        return;
      }
    } else {
      console.error('❌ No legal moves available for random fallback');
    }
    
    // Switch back to player turn
    isPlayerTurn = true;
    document.getElementById('ai-status').textContent = 'Ready (Random)';
    document.getElementById('ai-status').className = 'ai-status';
  } catch (error) {
    console.error('❌ Random move failed:', error);
    isPlayerTurn = true;
    document.getElementById('ai-status').textContent = 'Error';
    document.getElementById('ai-status').className = 'ai-status';
  }
}

// Render the chess board
function renderBoard() {
  // Clear canvas
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  
  // Draw squares
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const isLight = (rank + file) % 2 === 0;
      ctx.fillStyle = isLight ? LIGHT_SQUARE : DARK_SQUARE;
      
      const x = file * SQUARE_SIZE;
      const y = rank * SQUARE_SIZE;
      
      ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      
      // Get square name
      const fileChar = String.fromCharCode(97 + (isFlipped ? 7 - file : file));
      const rankChar = String(isFlipped ? rank + 1 : 8 - rank);
      const square = fileChar + rankChar;
      
      // Highlight selected square
      if (selectedSquare === square) {
        ctx.fillStyle = SELECTED_COLOR;
        ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      }
      
      // Highlight legal moves
      if (legalMoves.includes(square)) {
        ctx.fillStyle = LEGAL_MOVE_COLOR;
        ctx.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);
      }
    }
  }
  
  // Draw pieces
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const x = (isFlipped ? 7 - file : file) * SQUARE_SIZE;
        const y = (isFlipped ? 7 - rank : rank) * SQUARE_SIZE;
        
        drawPiece(piece.type, piece.color, x, y);
      }
    }
  }
  
  // Draw coordinates (letters and numbers)
  ctx.font = "12px Arial";
  ctx.fillStyle = "#999";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw file letters (a-h) at bottom
  for (let file = 0; file < 8; file++) {
    const fileChar = String.fromCharCode(97 + (isFlipped ? 7 - file : file));
    const x = file * SQUARE_SIZE + SQUARE_SIZE / 2;
    const y = BOARD_SIZE - 5;
    ctx.fillText(fileChar, x, y);
  }

  // Draw rank numbers (1-8) on left
  for (let rank = 0; rank < 8; rank++) {
    const rankNum = isFlipped ? rank + 1 : 8 - rank;
    const x = 5;
    const y = rank * SQUARE_SIZE + SQUARE_SIZE / 2;
    ctx.fillText(rankNum, x, y);
  }
}

// Draw a chess piece
function drawPiece(type, color, x, y) {
  const pieceChar = color === 'w' ? type.toUpperCase() : type.toLowerCase();
  const pieceName = PIECE_NAMES[pieceChar];
  const image = pieceImages[pieceName];
  
  if (image && image.complete && image.naturalWidth > 0) {
    // Draw the beautiful PNG image
    const padding = SQUARE_SIZE * 0.1; // 10% padding
    const size = SQUARE_SIZE - (padding * 2);
    ctx.drawImage(image, x + padding, y + padding, size, size);
  } else {
    // Fallback to Unicode if image not loaded
    const unicodePieces = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    
    const symbol = unicodePieces[pieceChar];
    if (symbol) {
      ctx.font = `${SQUARE_SIZE * 0.8}px serif`;
      ctx.fillStyle = color === 'w' ? '#ffffff' : '#000000';
      ctx.strokeStyle = color === 'w' ? '#000000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const centerX = x + SQUARE_SIZE / 2;
      const centerY = y + SQUARE_SIZE / 2;
      
      ctx.strokeText(symbol, centerX, centerY);
      ctx.fillText(symbol, centerX, centerY);
    }
  }
}

// Update UI elements
function updateUI() {
  const status = document.getElementById('game-status');
  
  if (game.game_over()) {
    if (game.in_checkmate()) {
      status.textContent = game.turn() === 'w' ? 'Black wins!' : 'White wins!';
    } else if (game.in_stalemate()) {
      status.textContent = 'Stalemate - Draw!';
    } else if (game.in_draw()) {
      status.textContent = 'Draw!';
    }
  } else {
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    const check = game.in_check() ? ' (Check!)' : '';
    status.textContent = `${turn} to move${check}`;
  }
}

// Add move to history
function addMoveToHistory(move, isComputer = false) {
  const history = document.getElementById('move-history');
  const moveNumber = Math.ceil(game.history().length / 2);
  
  if (game.history().length % 2 === 1) {
    // White's move
    history.innerHTML += `<div>${moveNumber}. ${move}`;
  } else {
    // Black's move
    const lastLine = history.lastElementChild;
    if (lastLine) {
      lastLine.innerHTML += ` ${move}</div>`;
    }
  }
  
  history.scrollTop = history.scrollHeight;
}

// Handle game over
function handleGameOver() {
  isPlayerTurn = false;
  console.log('🏁 Game over');
  
  let message = '';
  if (game.in_checkmate()) {
    message = game.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
  } else if (game.in_stalemate()) {
    message = 'Game ended in stalemate!';
  } else if (game.in_draw()) {
    message = 'Game ended in a draw!';
  }
  
  if (message) {
    setTimeout(() => alert(message), 100);
  }
}

// Game control functions
function newGame() {
  game.reset();
  selectedSquare = null;
  legalMoves = [];
  isPlayerTurn = true;
  
  document.getElementById('move-history').innerHTML = 'Game started. Make your first move!';
  document.getElementById('ai-status').textContent = 'Ready';
  document.getElementById('ai-status').className = 'ai-status';
  
  renderBoard();
  updateUI();
  
  console.log('🆕 New game started');
}

function flipBoard() {
  isFlipped = !isFlipped;
  renderBoard();
  console.log('🔄 Board flipped');
}

function undoMove() {
  if (game.history().length === 0) return;
  
  // Undo last move (and computer move if it was computer's turn)
  game.undo();
  if (!isPlayerTurn && game.history().length > 0) {
    game.undo();
  }
  
  isPlayerTurn = true;
  selectedSquare = null;
  legalMoves = [];
  
  document.getElementById('ai-status').textContent = 'Ready';
  document.getElementById('ai-status').className = 'ai-status';
  
  // Rebuild move history
  const history = document.getElementById('move-history');
  history.innerHTML = 'Game started. Make your first move!';
  
  const moves = game.history();
  for (let i = 0; i < moves.length; i++) {
    addMoveToHistory(moves[i], i % 2 === 1);
  }
  
  renderBoard();
  updateUI();
  
  console.log('↶ Move undone');
}

function adjustElo(player, delta) {
  if (player !== 'ai') return; // Only allow AI ELO adjustment
  
  const input = document.getElementById('ai-elo');
  const currentValue = parseInt(input.value) || 1650;
  const newValue = Math.max(800, Math.min(3000, currentValue + delta));
  input.value = newValue;
  
  // Show what this ELO translates to in terms of AI settings (same logic as makeComputerMove)
  let skillLevel, depth, moveTime, difficultyLabel, strength;
  
  if (newValue < 1000) {
    skillLevel = 1; depth = 1; moveTime = 200; difficultyLabel = 'Very Weak'; strength = 'Makes terrible moves';
  } else if (newValue < 1200) {
    skillLevel = 3; depth = 2; moveTime = 300; difficultyLabel = 'Beginner'; strength = 'Makes obvious mistakes';
  } else if (newValue < 1500) {
    skillLevel = 6; depth = 3; moveTime = 500; difficultyLabel = 'Intermediate'; strength = 'Decent but flawed';
  } else if (newValue < 1800) {
    skillLevel = 10; depth = 4; moveTime = 800; difficultyLabel = 'Advanced'; strength = 'Good player';
  } else if (newValue < 2200) {
    skillLevel = 15; depth = 6; moveTime = 1200; difficultyLabel = 'Expert'; strength = 'Very strong';
  } else {
    skillLevel = 20; depth = 8; moveTime = 1500; difficultyLabel = 'Master'; strength = 'Near perfect';
  }
  
  console.log(`🎯 AI ELO adjusted to ${newValue} (${difficultyLabel})`);
  console.log(`   → Skill Level: ${skillLevel}/20 (${Math.round((skillLevel/20)*100)}%)`);
  console.log(`   → Search Depth: ${depth} moves ahead`);
  console.log(`   → Calculation Time: ${moveTime}ms`);
  console.log(`   → Playing Strength: ${strength}`);
  
  // Update AI status to show difficulty level
  const aiStatus = document.getElementById('ai-status');
  const aiDetails = document.getElementById('ai-details');
  
  if (aiStatus && !aiStatus.classList.contains('thinking')) {
    aiStatus.textContent = `Ready (${difficultyLabel})`;
  }
  
  // Update detailed AI info
  if (aiDetails) {
    aiDetails.textContent = `Skill: ${skillLevel}/20 (${Math.round((skillLevel/20)*100)}%) | ${difficultyLabel}`;
    aiDetails.style.color = skillLevel <= 5 ? '#ff6b6b' : skillLevel <= 10 ? '#ffa500' : skillLevel <= 15 ? '#4CAF50' : '#2196F3';
    
    // Brief flash effect to show change
    aiDetails.style.background = '#4CAF50';
    aiDetails.style.borderRadius = '3px';
    aiDetails.style.padding = '2px 6px';
    setTimeout(() => {
      aiDetails.style.background = '';
      aiDetails.style.borderRadius = '';
      aiDetails.style.padding = '';
    }, 500);
  }
  
  // Show toast notification
  showToast(`AI difficulty updated: ${newValue} ELO (${difficultyLabel})`);
  
  // Log the ELO change
  logEloChange(currentValue, newValue, difficultyLabel, 'button');
}

// Toast notification function
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  // Hide after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// ELO change logging function
function logEloChange(oldValue, newValue, difficultyLabel, changeMethod) {
  const timestamp = new Date().toISOString();
  const gameState = game.history().length > 0 ? 'during_game' : 'before_game';
  const moveCount = Math.ceil(game.history().length / 2);
  
  console.log('🎯 AI ELO CHANGE LOG');
  console.log(`   📅 Timestamp: ${timestamp}`);
  console.log(`   📊 ELO Change: ${oldValue} → ${newValue} (${newValue > oldValue ? '+' : ''}${newValue - oldValue})`);
  console.log(`   🎮 Difficulty: ${difficultyLabel}`);
  console.log(`   🖱️  Method: ${changeMethod === 'button' ? 'Plus/Minus Buttons' : 'Direct Input'}`);
  console.log(`   🏁 Game State: ${gameState} (Move ${moveCount || 1})`);
  console.log(`   💪 Impact: ${getEloImpactDescription(oldValue, newValue)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Get description of ELO impact
function getEloImpactDescription(oldValue, newValue) {
  const difference = Math.abs(newValue - oldValue);
  const direction = newValue > oldValue ? 'Increased' : 'Decreased';
  
  if (difference >= 500) {
    return `${direction} dramatically - expect major change in playing strength`;
  } else if (difference >= 200) {
    return `${direction} significantly - noticeable difference in AI skill`;
  } else if (difference >= 100) {
    return `${direction} moderately - subtle but measurable change`;
  } else {
    return `${direction} slightly - minor adjustment in difficulty`;
  }
}

// Add event listener for direct ELO input changes
document.addEventListener('DOMContentLoaded', function() {
  const aiEloInput = document.getElementById('ai-elo');
  
  if (aiEloInput) {
    let timeoutId;
    
    aiEloInput.addEventListener('input', function() {
      // Clear previous timeout to avoid multiple toasts
      clearTimeout(timeoutId);
      
      // Wait for 500ms after user stops typing
      timeoutId = setTimeout(() => {
        const newValue = parseInt(this.value) || 1650;
        const clampedValue = Math.max(800, Math.min(3000, newValue));
        
        // Update value if it was clamped
        if (newValue !== clampedValue) {
          this.value = clampedValue;
        }
        
        // Determine difficulty level (same logic as adjustElo)
        let difficultyLabel;
        if (clampedValue < 1000) {
          difficultyLabel = 'Very Weak';
        } else if (clampedValue < 1200) {
          difficultyLabel = 'Beginner';
        } else if (clampedValue < 1500) {
          difficultyLabel = 'Intermediate';
        } else if (clampedValue < 1800) {
          difficultyLabel = 'Advanced';
        } else if (clampedValue < 2200) {
          difficultyLabel = 'Expert';
        } else {
          difficultyLabel = 'Master';
        }
        
        showToast(`AI difficulty set: ${clampedValue} ELO (${difficultyLabel})`);
        
        // Log the ELO change
        logEloChange(newValue, clampedValue, difficultyLabel, 'input');
        
        // Also update the AI details display
        const skillLevel = clampedValue < 1000 ? 1 :
                          clampedValue < 1200 ? 3 :
                          clampedValue < 1500 ? 6 :
                          clampedValue < 1800 ? 10 :
                          clampedValue < 2200 ? 15 : 20;
        
        const aiDetails = document.getElementById('ai-details');
        if (aiDetails) {
          aiDetails.textContent = `Skill: ${skillLevel}/20 (${Math.round((skillLevel/20)*100)}%) | ${difficultyLabel}`;
          aiDetails.style.color = skillLevel <= 5 ? '#ff6b6b' : skillLevel <= 10 ? '#ffa500' : skillLevel <= 15 ? '#4CAF50' : '#2196F3';
        }
      }, 500);
    });
  }
});

console.log('📜 Chess V2 script loaded successfully');

// Make game and engine globally accessible for chat integration
window.game = game;
window.engine = engine;
window.makeMove = makeMove;

console.log('🔗 Global references created for chat integration');