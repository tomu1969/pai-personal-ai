/**
 * Chat Engine for Talking Chess
 * Handles AI personality and context-aware messaging
 */

class ChatEngine {
  constructor() {
    this.messageHistory = [];
    this.aiPersonality = 'friendly'; // friendly, competitive, teacher
    this.gameContext = {
      gameState: 'starting',
      moveCount: 0,
      lastMove: null,
      isPlayerTurn: true,
      position: null,
      evaluation: 0
    };
    
    this.messageTemplates = {
      greeting: [
        "Hello! I'm ChessBot, ready to play at {targetElo} ELO. Good luck and have fun!",
        "Hey there! I'm excited to play with you today. I'll be playing at {targetElo} strength.",
        "Welcome to our game! I'm ChessBot, calibrated to {targetElo} ELO. Let's have a great match!"
      ],
      
      opening: {
        'e4': [
          "The King's Pawn! A classic and aggressive opening choice.",
          "Ah, e4 - the best by test, as Bobby Fischer said!",
          "Starting with the most popular opening move. Nice choice!"
        ],
        'd4': [
          "The Queen's Pawn - solid and positional. I like it!",
          "Going for the Queen's Gambit territory. Interesting approach!",
          "A strategic opening choice. This could get complex quickly!"
        ],
        'Nf3': [
          "The Réti Opening! Flexible and full of possibilities.",
          "Starting with a knight - keeping your options open. Smart!",
          "A hypermodern approach. I wonder what you're planning..."
        ],
        'c4': [
          "The English Opening! Taking control from the side.",
          "Interesting choice - the English can lead to rich positions.",
          "Going for territorial control. This could get strategic!"
        ]
      },
      
      moveCommentary: {
        good: [
          "Excellent move! I didn't expect that.",
          "Very nice! You're playing well today.",
          "Great choice! That puts me in a tough spot.",
          "Impressive! You're really thinking ahead.",
          "Brilliant! That's exactly what I would have played."
        ],
        interesting: [
          "Interesting move! Let me think about this...",
          "Hmm, that's an unusual choice. I like it!",
          "Creative! I haven't seen that before.",
          "That's a unique approach to this position.",
          "Curious move - you might be onto something!"
        ],
        questionable: [
          "Are you sure about that? I see some tactics coming...",
          "That might give me some opportunities. We'll see!",
          "Interesting choice, but I think I can take advantage of that.",
          "Bold move! Though it might be a bit risky.",
          "I'm not sure about that one, but maybe you see something I don't!"
        ],
        blunder: [
          "Oh no! That looks like it might be a mistake.",
          "Oops! I think you might want to double-check that move.",
          "Hmm, that gives me a big opportunity. Thanks!",
          "I think you might have overlooked something there.",
          "Are you trying a new strategy? That seems risky!"
        ]
      },
      
      gameEvents: {
        check: [
          "Check! Your king needs to find safety.",
          "That's check! Time to move your king.",
          "Check! How will you get out of this one?"
        ],
        capture: [
          "Nice capture! Thanks for the piece.",
          "Ouch! You got me there.",
          "Good eye! That was a nice tactical shot.",
          "Well played! I walked right into that one."
        ],
        promotion: [
          "A new queen! This changes everything.",
          "Promotion time! What are you going to choose?",
          "Your pawn made it! This could be decisive."
        ],
        castle: [
          "Good timing for castling - safety first!",
          "Nice! Getting your king to safety.",
          "Smart castling - your king looks much safer now."
        ]
      },
      
      thinking: [
        "Let me think about this position...",
        "Hmm, interesting position. Give me a moment...",
        "Analyzing the position... this is tricky!",
        "Lots of possibilities here. Calculating...",
        "This position has some nice tactics. Thinking..."
      ],
      
      endgame: {
        winning: [
          "I think I have a good advantage now!",
          "This position is looking favorable for me.",
          "I like my chances from here!"
        ],
        losing: [
          "You're playing really well! I'm in trouble.",
          "Nice technique! You're outplaying me.",
          "I need to be careful here - you have the advantage."
        ],
        draw: [
          "This looks pretty equal to me.",
          "Balanced position - it could go either way!",
          "Neither of us has a clear advantage here."
        ]
      },
      
      gameEnd: {
        playerWins: [
          "Well played! You earned that victory.",
          "Congratulations! You outplayed me fair and square.",
          "Great game! You were the better player today.",
          "Excellent! You played really well. Good game!"
        ],
        aiWins: [
          "Good game! Thanks for the challenge.",
          "That was fun! Want to play again?",
          "Nice effort! You played well despite the result.",
          "Great game! I enjoyed our match."
        ],
        draw: [
          "A fair result! Good game.",
          "Well fought draw! That was enjoyable.",
          "Equal battle! Thanks for the good game.",
          "A balanced game - good job!"
        ]
      }
    };
  }

  /**
   * Add a message to the chat
   */
  addMessage(sender, text, timestamp = new Date()) {
    const message = {
      id: this.messageHistory.length + 1,
      sender: sender, // 'user' or 'ai'
      text: text,
      timestamp: timestamp
    };
    
    this.messageHistory.push(message);
    return message;
  }

  /**
   * Get a random message from a template array
   */
  getRandomMessage(templates, context = {}) {
    if (!Array.isArray(templates) || templates.length === 0) {
      return "...";
    }
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    let message = templates[randomIndex];
    
    // Replace placeholders with context values
    Object.keys(context).forEach(key => {
      const placeholder = `{${key}}`;
      if (message.includes(placeholder)) {
        message = message.replace(placeholder, context[key]);
      }
    });
    
    return message;
  }

  /**
   * Generate greeting message when game starts
   */
  generateGreeting(targetElo) {
    const context = { targetElo: targetElo };
    const message = this.getRandomMessage(this.messageTemplates.greeting, context);
    return this.addMessage('ai', message);
  }

  /**
   * Generate opening commentary
   */
  generateOpeningComment(move) {
    // Detect common openings
    let openingKey = null;
    
    if (move.includes('e4')) openingKey = 'e4';
    else if (move.includes('d4')) openingKey = 'd4';
    else if (move.includes('Nf3')) openingKey = 'Nf3';
    else if (move.includes('c4')) openingKey = 'c4';
    
    if (openingKey && this.messageTemplates.opening[openingKey]) {
      const message = this.getRandomMessage(this.messageTemplates.opening[openingKey]);
      return this.addMessage('ai', message);
    }
    
    return null;
  }

  /**
   * Generate move commentary based on move quality
   */
  generateMoveComment(moveQuality, move) {
    let templates = [];
    
    switch (moveQuality) {
      case 'excellent':
      case 'good':
        templates = this.messageTemplates.moveCommentary.good;
        break;
      case 'interesting':
        templates = this.messageTemplates.moveCommentary.interesting;
        break;
      case 'questionable':
        templates = this.messageTemplates.moveCommentary.questionable;
        break;
      case 'blunder':
        templates = this.messageTemplates.moveCommentary.blunder;
        break;
      default:
        templates = this.messageTemplates.moveCommentary.interesting;
    }
    
    const message = this.getRandomMessage(templates);
    return this.addMessage('ai', message);
  }

  /**
   * Generate event-specific commentary
   */
  generateEventComment(event, context = {}) {
    let templates = [];
    
    switch (event) {
      case 'check':
        templates = this.messageTemplates.gameEvents.check;
        break;
      case 'capture':
        templates = this.messageTemplates.gameEvents.capture;
        break;
      case 'promotion':
        templates = this.messageTemplates.gameEvents.promotion;
        break;
      case 'castle':
        templates = this.messageTemplates.gameEvents.castle;
        break;
    }
    
    if (templates.length > 0) {
      const message = this.getRandomMessage(templates, context);
      return this.addMessage('ai', message);
    }
    
    return null;
  }

  /**
   * Generate thinking message
   */
  generateThinkingMessage() {
    const message = this.getRandomMessage(this.messageTemplates.thinking);
    return this.addMessage('ai', message);
  }

  /**
   * Generate position evaluation comment
   */
  generateEvaluationComment(evaluation) {
    let type = 'draw';
    
    if (evaluation > 150) type = 'winning';
    else if (evaluation < -150) type = 'losing';
    
    const templates = this.messageTemplates.endgame[type];
    if (templates && templates.length > 0) {
      const message = this.getRandomMessage(templates);
      return this.addMessage('ai', message);
    }
    
    return null;
  }

  /**
   * Generate game end message
   */
  generateGameEndMessage(result) {
    let templates = [];
    
    switch (result) {
      case 'player_wins':
        templates = this.messageTemplates.gameEnd.playerWins;
        break;
      case 'ai_wins':
        templates = this.messageTemplates.gameEnd.aiWins;
        break;
      case 'draw':
        templates = this.messageTemplates.gameEnd.draw;
        break;
    }
    
    if (templates.length > 0) {
      const message = this.getRandomMessage(templates);
      return this.addMessage('ai', message);
    }
    
    return null;
  }

  /**
   * Update game context for better message generation
   */
  updateGameContext(context) {
    this.gameContext = { ...this.gameContext, ...context };
  }

  /**
   * Get all messages
   */
  getAllMessages() {
    return this.messageHistory;
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
  }

  /**
   * Get the last N messages
   */
  getRecentMessages(count = 10) {
    return this.messageHistory.slice(-count);
  }

  /**
   * Simple move quality analyzer (can be enhanced with engine evaluation)
   */
  analyzeMoveQuality(previousEval, currentEval, isPlayerMove) {
    if (!previousEval && !currentEval) return 'interesting';
    
    const evalChange = currentEval - previousEval;
    const significantChange = Math.abs(evalChange) > 50;
    
    if (isPlayerMove) {
      // Player move - positive change is good for player
      if (evalChange > 100) return 'excellent';
      if (evalChange > 25) return 'good';
      if (evalChange < -100) return 'blunder';
      if (evalChange < -25) return 'questionable';
    } else {
      // AI move - negative change is good for AI
      if (evalChange < -100) return 'excellent';
      if (evalChange < -25) return 'good';
      if (evalChange > 100) return 'blunder';
      if (evalChange > 25) return 'questionable';
    }
    
    return 'interesting';
  }
}

// Make ChatEngine available globally
if (typeof window !== 'undefined') {
  window.ChatEngine = ChatEngine;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatEngine;
}