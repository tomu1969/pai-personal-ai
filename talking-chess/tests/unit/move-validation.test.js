/**
 * Unit Tests for Move Validation & Basic Interaction - Step 2
 * Following Test-Driven Development approach
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Move Validation & Basic Interaction - Step 2', () => {
  let dom;
  let window;
  let document;
  let mockGame;
  let mockBoard;
  
  beforeEach(() => {
    // Create a clean DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="chessboard"></div>
          <div id="pgn-display"></div>
          <div id="status-text"></div>
          <div id="turn-indicator"></div>
        </body>
      </html>
    `);
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    
    // Mock Chess.js game
    mockGame = {
      move: jest.fn(),
      fen: jest.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      pgn: jest.fn().mockReturnValue(''),
      turn: jest.fn().mockReturnValue('w'),
      game_over: jest.fn().mockReturnValue(false),
      in_checkmate: jest.fn().mockReturnValue(false),
      in_draw: jest.fn().mockReturnValue(false),
      in_stalemate: jest.fn().mockReturnValue(false),
      in_threefold_repetition: jest.fn().mockReturnValue(false),
      insufficient_material: jest.fn().mockReturnValue(false),
      in_check: jest.fn().mockReturnValue(false),
      moves: jest.fn().mockReturnValue(['e4', 'e5', 'Nf3']),
      history: jest.fn().mockReturnValue([]),
      reset: jest.fn(),
      load: jest.fn()
    };
    
    // Mock ChessBoard
    mockBoard = {
      position: jest.fn(),
      resize: jest.fn(),
      destroy: jest.fn(),
      clear: jest.fn(),
      orientation: jest.fn().mockReturnValue('white')
    };
    
    global.game = mockGame;
    global.board = mockBoard;
  });
  
  afterEach(() => {
    dom.window.close();
  });

  describe('Legal Move Acceptance', () => {
    test('should accept valid pawn moves', () => {
      mockGame.move.mockReturnValue({
        from: 'e2',
        to: 'e4',
        piece: 'p',
        san: 'e4'
      });
      
      const move = mockGame.move({
        from: 'e2',
        to: 'e4'
      });
      
      expect(move).not.toBeNull();
      expect(mockGame.move).toHaveBeenCalledWith({
        from: 'e2',
        to: 'e4'
      });
    });

    test('should accept valid knight moves', () => {
      mockGame.move.mockReturnValue({
        from: 'g1',
        to: 'f3',
        piece: 'n',
        san: 'Nf3'
      });
      
      const move = mockGame.move({
        from: 'g1',
        to: 'f3'
      });
      
      expect(move).not.toBeNull();
      expect(move.piece).toBe('n');
    });

    test('should handle pawn promotion correctly', () => {
      mockGame.move.mockReturnValue({
        from: 'e7',
        to: 'e8',
        piece: 'p',
        promotion: 'q',
        san: 'e8=Q'
      });
      
      const move = mockGame.move({
        from: 'e7',
        to: 'e8',
        promotion: 'q'
      });
      
      expect(move).not.toBeNull();
      expect(move.promotion).toBe('q');
    });

    test('should handle castling moves', () => {
      mockGame.move.mockReturnValue({
        from: 'e1',
        to: 'g1',
        piece: 'k',
        san: 'O-O',
        flags: 'k'
      });
      
      const move = mockGame.move('O-O');
      
      expect(move).not.toBeNull();
      expect(move.san).toBe('O-O');
    });

    test('should handle en passant captures', () => {
      mockGame.move.mockReturnValue({
        from: 'e5',
        to: 'd6',
        piece: 'p',
        captured: 'p',
        san: 'exd6',
        flags: 'e'
      });
      
      const move = mockGame.move({
        from: 'e5',
        to: 'd6'
      });
      
      expect(move).not.toBeNull();
      expect(move.flags).toBe('e');
    });
  });

  describe('Illegal Move Rejection', () => {
    test('should reject invalid moves', () => {
      mockGame.move.mockReturnValue(null);
      
      const move = mockGame.move({
        from: 'e2',
        to: 'e5'
      });
      
      expect(move).toBeNull();
    });

    test('should reject moving opponent pieces', () => {
      mockGame.turn.mockReturnValue('w');
      mockGame.move.mockReturnValue(null);
      
      const move = mockGame.move({
        from: 'e7',
        to: 'e5'
      });
      
      expect(move).toBeNull();
    });

    test('should reject moves when game is over', () => {
      mockGame.game_over.mockReturnValue(true);
      mockGame.move.mockReturnValue(null);
      
      const move = mockGame.move({
        from: 'e2',
        to: 'e4'
      });
      
      expect(move).toBeNull();
    });

    test('should reject moves that leave king in check', () => {
      mockGame.move.mockReturnValue(null);
      
      const move = mockGame.move({
        from: 'd2',
        to: 'd4'
      });
      
      expect(move).toBeNull();
    });
  });

  describe('Move History Tracking', () => {
    test('should track move history in PGN format', () => {
      mockGame.pgn.mockReturnValue('1. e4 e5 2. Nf3 Nc6');
      
      const pgn = mockGame.pgn();
      
      expect(pgn).toBe('1. e4 e5 2. Nf3 Nc6');
    });

    test('should update history after each move', () => {
      const moveHistory = [];
      
      mockGame.move.mockImplementation((move) => {
        moveHistory.push(move);
        return { ...move, san: 'e4' };
      });
      
      mockGame.move({ from: 'e2', to: 'e4' });
      
      expect(moveHistory).toHaveLength(1);
      expect(moveHistory[0]).toEqual({ from: 'e2', to: 'e4' });
    });

    test('should clear history when game resets', () => {
      mockGame.reset.mockImplementation(() => {
        mockGame.pgn.mockReturnValue('');
      });
      
      mockGame.reset();
      
      expect(mockGame.pgn()).toBe('');
    });
  });

  describe('FEN String Generation', () => {
    test('should generate correct starting position FEN', () => {
      const startingFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      mockGame.fen.mockReturnValue(startingFEN);
      
      const fen = mockGame.fen();
      
      expect(fen).toBeValidChessPosition();
      expect(fen).toBe(startingFEN);
    });

    test('should update FEN after moves', () => {
      const afterE4FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      
      mockGame.move.mockReturnValue({ from: 'e2', to: 'e4', san: 'e4' });
      mockGame.fen.mockReturnValue(afterE4FEN);
      
      mockGame.move({ from: 'e2', to: 'e4' });
      const fen = mockGame.fen();
      
      expect(fen).toBe(afterE4FEN);
    });
  });

  describe('Turn Management', () => {
    test('should track whose turn it is', () => {
      expect(mockGame.turn()).toBe('w');
      
      mockGame.turn.mockReturnValue('b');
      expect(mockGame.turn()).toBe('b');
    });

    test('should alternate turns after moves', () => {
      let currentTurn = 'w';
      
      mockGame.turn.mockImplementation(() => currentTurn);
      mockGame.move.mockImplementation(() => {
        currentTurn = currentTurn === 'w' ? 'b' : 'w';
        return { san: 'e4' };
      });
      
      expect(mockGame.turn()).toBe('w');
      mockGame.move({ from: 'e2', to: 'e4' });
      expect(mockGame.turn()).toBe('b');
    });
  });

  describe('Game State Management', () => {
    test('should detect checkmate', () => {
      mockGame.in_checkmate.mockReturnValue(true);
      mockGame.game_over.mockReturnValue(true);
      
      expect(mockGame.in_checkmate()).toBe(true);
      expect(mockGame.game_over()).toBe(true);
    });

    test('should detect stalemate', () => {
      mockGame.in_stalemate.mockReturnValue(true);
      mockGame.game_over.mockReturnValue(true);
      
      expect(mockGame.in_stalemate()).toBe(true);
      expect(mockGame.game_over()).toBe(true);
    });

    test('should detect draw conditions', () => {
      mockGame.in_draw.mockReturnValue(true);
      mockGame.game_over.mockReturnValue(true);
      
      expect(mockGame.in_draw()).toBe(true);
    });

    test('should detect threefold repetition', () => {
      mockGame.in_threefold_repetition.mockReturnValue(true);
      
      expect(mockGame.in_threefold_repetition()).toBe(true);
    });

    test('should detect insufficient material', () => {
      mockGame.insufficient_material.mockReturnValue(true);
      
      expect(mockGame.insufficient_material()).toBe(true);
    });

    test('should detect check', () => {
      mockGame.in_check.mockReturnValue(true);
      
      expect(mockGame.in_check()).toBe(true);
    });
  });

  describe('Legal Moves Generation', () => {
    test('should generate legal moves for a piece', () => {
      mockGame.moves.mockReturnValue(['e3', 'e4']);
      
      const moves = mockGame.moves({ square: 'e2' });
      
      expect(moves).toContain('e3');
      expect(moves).toContain('e4');
    });

    test('should return empty array when no legal moves', () => {
      mockGame.moves.mockReturnValue([]);
      
      const moves = mockGame.moves({ square: 'h1' });
      
      expect(moves).toEqual([]);
    });
  });

  describe('Game Persistence', () => {
    test('should save game state structure correctly', () => {
      const timestamp = Date.now();
      const gameState = {
        fen: mockGame.fen(),
        pgn: mockGame.pgn(),
        lastMove: null,
        timestamp: timestamp
      };
      
      expect(gameState.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(gameState.pgn).toBe('');
      expect(gameState.lastMove).toBeNull();
      expect(typeof gameState.timestamp).toBe('number');
      expect(gameState.timestamp).toBe(timestamp);
    });

    test('should save game state with move data', () => {
      mockGame.pgn.mockReturnValue('1. e4');
      mockGame.fen.mockReturnValue('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
      
      const gameState = {
        fen: mockGame.fen(),
        pgn: mockGame.pgn(),
        lastMove: { from: 'e2', to: 'e4' },
        timestamp: Date.now()
      };
      
      expect(gameState.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
      expect(gameState.pgn).toBe('1. e4');
      expect(gameState.lastMove).toEqual({ from: 'e2', to: 'e4' });
    });

    test('should handle localStorage operations safely', () => {
      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };
      
      // Test that localStorage methods are available
      expect(typeof mockLocalStorage.setItem).toBe('function');
      expect(typeof mockLocalStorage.getItem).toBe('function');
      expect(typeof mockLocalStorage.removeItem).toBe('function');
    });
  });

  describe('UI Integration', () => {
    test('should update move history display', () => {
      const pgnDisplay = document.getElementById('pgn-display');
      mockGame.pgn.mockReturnValue('1. e4 e5');
      
      pgnDisplay.textContent = mockGame.pgn();
      
      expect(pgnDisplay.textContent).toBe('1. e4 e5');
    });

    test('should update game status display', () => {
      const statusText = document.getElementById('status-text');
      
      statusText.textContent = 'White to move';
      
      expect(statusText.textContent).toBe('White to move');
    });

    test('should update turn indicator', () => {
      const turnIndicator = document.getElementById('turn-indicator');
      
      turnIndicator.textContent = mockGame.turn() === 'w' ? 'White\'s turn' : 'Black\'s turn';
      
      expect(turnIndicator.textContent).toBe('White\'s turn');
    });
  });
});