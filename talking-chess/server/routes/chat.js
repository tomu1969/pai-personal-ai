/**
 * Chat Routes - Talking Chess Chat Mentor
 * API endpoints for chess mentor chat functionality
 */

const express = require('express');
const router = express.Router();
const OpenAIService = require('../services/openai');
const { formatGameContext, buildPromptContext } = require('../modules/contextBuilder');

// Initialize OpenAI service
const openaiService = new OpenAIService();

/**
 * POST /api/chat
 * Send a chat message to the chess mentor AI
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('[CHAT] Request received - FEN:', req.body?.fen?.substring(0, 30) + '...');

    // Validate request body
    if (!req.body || !req.body.userMessage) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userMessage is required'
      });
    }

    // Format and validate game context
    let gameContext;
    try {
      gameContext = formatGameContext(req.body);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid Game Context',
        message: error.message
      });
    }

    // Build prompt context for AI (now async due to engine analysis)
    console.log('[CHAT] Building prompt context with engine analysis...');
    const { systemPrompt, userMessage } = await buildPromptContext(gameContext);

    console.log(`[CHAT] Calling OpenAI with ELO ${gameContext.userElo}`);
    console.log('[CHAT] System prompt length:', systemPrompt.length);
    console.log('[CHAT] System prompt preview:', systemPrompt.substring(0, 500) + '...');

    // Extract student color from FEN (side to move)
    // FEN format: position activeColor castling enPassant halfmove fullmove
    const fenParts = gameContext.fen.split(' ');
    const studentColor = fenParts[1] || 'w'; // 'w' or 'b'

    // Build gameContext for tool calling
    const toolGameContext = {
      fen: gameContext.fen,
      studentColor
    };

    console.log('[CHAT] Tool context:', { fen: gameContext.fen.substring(0, 30) + '...', studentColor });

    // Generate AI response with tool calling support
    const aiResponse = await openaiService.generateChatResponse(
      systemPrompt,
      userMessage,
      gameContext.chatHistory,
      toolGameContext
    );

    const processingTime = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - Chat response generated in ${processingTime}ms`);

    // Return response
    res.json({
      success: true,
      message: aiResponse,
      personaName: gameContext.personaName,
      processingTimeMs: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Chat API error:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate response',
      processingTimeMs: processingTime
    });
  }
});

/**
 * GET /api/chat/health
 * Check chat service health
 */
router.get('/health', async (req, res) => {
  try {
    const isConnected = await openaiService.validateConnection();
    
    res.json({
      status: 'healthy',
      openaiConnected: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat health check error:', error);
    
    res.status(500).json({
      status: 'unhealthy',
      openaiConnected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;