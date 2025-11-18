/**
 * Talking Chess Application
 * Main application file that initializes the chess mentor system
 * and connects it to the existing chess game
 */

class TalkingChessApp {
  constructor() {
    this.mentor = null;
    this.isReady = false;
  }

  /**
   * Initialize the application
   * @param {Object} config - Configuration options
   */
  async init(config = {}) {
    try {
      console.log('[APP] 🔧 Initializing Talking Chess...');

      // Default configuration
      const defaultConfig = {
        personaName: 'Irina',
        userElo: 1500,
        enableAutoResponses: true,
        responseDelay: 1000,
        parentContainerId: 'game-container'
      };

      const finalConfig = { ...defaultConfig, ...config };
      console.log('[APP] ⚙️ Final config:', finalConfig);

      // Initialize the mentor integration
      console.log('[APP] 🤖 Creating ChessMentorIntegration...');
      this.mentor = new ChessMentorIntegration();
      console.log('[APP] 🤖 ChessMentorIntegration created, calling initialize...');
      
      const initSuccess = await this.mentor.initialize(finalConfig);
      console.log('[APP] 🤖 Mentor initialize result:', initSuccess ? '✅ SUCCESS' : '❌ FAILED');

      if (!initSuccess) {
        throw new Error('Failed to initialize mentor system');
      }

      // Connect to the chess game
      console.log('[APP] 🔌 Connecting mentor to chess game with container:', finalConfig.parentContainerId);
      const connectSuccess = this.mentor.connect(finalConfig.parentContainerId);
      console.log('[APP] 🔌 Mentor connect result:', connectSuccess ? '✅ SUCCESS' : '❌ FAILED');

      if (!connectSuccess) {
        throw new Error('Failed to connect to chess game');
      }

      this.isReady = true;
      console.log('[APP] ✅ Talking Chess initialized successfully!');

      // Set up global access for debugging
      if (typeof window !== 'undefined') {
        window.talkingChess = this;
        window.mentor = this.mentor;
        console.log('[APP] 🌐 Global references set: window.talkingChess, window.mentor');
      }

      return true;

    } catch (error) {
      console.error('[APP] ❌ Failed to initialize Talking Chess:', error);
      console.error('[APP] ❌ Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Check if the application is ready
   * @returns {boolean}
   */
  isInitialized() {
    return this.isReady;
  }

  /**
   * Get application status
   * @returns {Object}
   */
  getStatus() {
    return {
      ready: this.isReady,
      mentor: this.mentor ? this.mentor.getStats() : null
    };
  }

  /**
   * Manually send a message (for testing)
   * @param {string} message
   */
  sendMessage(message) {
    if (this.mentor) {
      this.mentor.sendUserMessage(message);
    }
  }

  /**
   * Update configuration
   * @param {Object} config
   */
  updateConfig(config) {
    if (this.mentor) {
      this.mentor.updateConfig(config);
    }
  }

  /**
   * Disconnect and cleanup
   */
  shutdown() {
    if (this.mentor) {
      this.mentor.disconnect();
    }
    this.isReady = false;
    console.log('Talking Chess shut down');
  }
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  // Create global app instance
  window.TalkingChessApp = TalkingChessApp;
  
  // Auto-start when page loads
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[APP] 🚀 DOM loaded, starting Talking Chess initialization...');
    
    // Check if required elements exist
    const gameContainer = document.getElementById('game-container');
    console.log('[APP] 📍 game-container element:', gameContainer ? '✅ FOUND' : '❌ NOT FOUND');
    
    // Check if global chess objects exist
    console.log('[APP] 🎮 window.game:', typeof window.game, window.game ? '✅ EXISTS' : '❌ MISSING');
    console.log('[APP] 🤖 window.engine:', typeof window.engine, window.engine ? '✅ EXISTS' : '❌ MISSING');
    console.log('[APP] 🎯 window.makeMove:', typeof window.makeMove, window.makeMove ? '✅ EXISTS' : '❌ MISSING');
    
    const app = new TalkingChessApp();
    console.log('[APP] 🏗️ TalkingChessApp instance created');
    
    // Initialize with default settings
    console.log('[APP] 🔄 Starting initialization...');
    const success = await app.init();
    
    if (success) {
      console.log('[APP] ✅ Talking Chess initialization SUCCESSFUL!');
      console.log('[APP] 📊 App status:', app.getStatus());
    } else {
      console.error('[APP] ❌ Talking Chess initialization FAILED!');
      console.error('[APP] 📊 App status:', app.getStatus());
    }
  });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TalkingChessApp;
}