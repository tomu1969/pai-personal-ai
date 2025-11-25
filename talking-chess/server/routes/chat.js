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
    console.log(`${new Date().toISOString()} - Chat request received`);
    
    // Comprehensive debugging of incoming request
    console.log('🚨 [BACKEND] INCOMING REQUEST ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📥 Request body keys:', Object.keys(req.body || {}));
    console.log('📍 FEN received:', req.body?.fen);
    console.log('📍 User message:', req.body?.userMessage);
    console.log('📍 User ELO:', req.body?.userElo);
    console.log('📍 Legal moves received:', req.body?.legalMoves?.length || 0);
    console.log('📍 Legal moves (first 10):', req.body?.legalMoves?.slice(0, 10));
    console.log('📍 Engine eval:', req.body?.engineEval);
    console.log('═══════════════════════════════════════════════════════');
    
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

    // Build prompt context for AI
    const { systemPrompt, userMessage } = buildPromptContext(gameContext);

    console.log(`${new Date().toISOString()} - Calling OpenAI with ELO ${gameContext.userElo}`);
    
    // Debug what contextBuilder produced
    console.log('🚨 [BACKEND] CONTEXT BUILDER OUTPUT:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Game context after formatting:', {
      fen: gameContext.fen,
      legalMoves: gameContext.legalMoves?.length || 0,
      userElo: gameContext.userElo,
      engineEval: gameContext.engineEval
    });
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 COMPLETE SYSTEM PROMPT BEING SENT TO AI:');
    console.log('═══════════════════════════════════════════');
    console.log(systemPrompt);
    console.log('═══════════════════════════════════════════');

    // Generate AI response
    const aiResponse = await openaiService.generateChatResponse(
      systemPrompt,
      userMessage,
      gameContext.chatHistory
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