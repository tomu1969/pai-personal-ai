/**
 * Talking Chess Chat Mentor Server
 * Express server providing conversational AI mentor "Irina" 
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const config = require('./config');

// Initialize Express app
const app = express();

// Middleware
app.use(compression());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/chat', require('./routes/chat'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server (only if not being required for testing)
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`🚀 Talking Chess Chat Server running on port ${config.port}`);
    console.log(`🎯 Environment: ${config.nodeEnv}`);
    console.log(`🔗 CORS origin: ${config.corsOrigin}`);
  });
}

module.exports = app;