const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');
const logsRoutes = require('./routes/logs');
const chatRoutes = require('./routes/chat');
const assistantRoutes = require('./controllers/assistant');
const qrPageRoutes = require('./routes/qr-page');
const qrAssistantRoutes = require('./routes/qr-assistant');
const qrResponderRoutes = require('./routes/qr-responder');

const app = express();

if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com']
    : true,
  credentials: true,
}));

const morganFormat = config.server.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/admin', express.static(path.join(__dirname, '../admin/public')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// PAI Assistant QR Code page
app.get('/pai-assistant/qr', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pai-assistant-qr.html'));
});

// Test QR page
app.get('/test-qr', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-qr.html'));
});

// Handle favicon requests to avoid 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content response
});

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/', qrPageRoutes);
app.use('/', qrAssistantRoutes);
app.use('/', qrResponderRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    // eslint-disable-next-line global-require
    version: require('../package.json').version,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorHandler);

const startServer = async () => {
  // Listen on all interfaces (0.0.0.0) to accept connections from Docker
  const listenHost = '0.0.0.0';
  const server = app.listen(config.server.port, listenHost, () => {
    logger.info(`Server running on http://0.0.0.0:${config.server.port}`);
    logger.info(`Environment: ${config.server.nodeEnv}`);
    logger.info(`Health check: http://localhost:${config.server.port}/health`);
  });

  // Initialize real-time service
  const realtimeService = require('./services/utils/realtime');
  realtimeService.initialize(server);

  // Initialize multi-instance service
  const evolutionMultiInstance = require('./services/whatsapp/evolutionMultiInstance');
  try {
    await evolutionMultiInstance.initialize();
    logger.info('Multi-instance service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize multi-instance service', { error: error.message });
  }

  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = app;
