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
const qrMortgageRoutes = require('./routes/qr-mortgage');
const qrCSRoutes = require('./routes/qr-cs');

const app = express();

if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      'script-src-attr': ["'unsafe-inline'"]
    }
  }
}));
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

// PAI Mortgage QR Code page
app.get('/pai-mortgage/qr', (req, res) => {
  const filePath = path.join(__dirname, '../public/pai-mortgage-qr.html');
  logger.info('PAI Mortgage QR page requested', {
    filePath,
    fileExists: require('fs').existsSync(filePath),
    publicDir: path.join(__dirname, '../public'),
    publicDirExists: require('fs').existsSync(path.join(__dirname, '../public'))
  });
  
  if (!require('fs').existsSync(filePath)) {
    logger.error('PAI Mortgage QR HTML file not found', { filePath });
    return res.status(404).json({
      error: 'QR page not found',
      message: 'PAI Mortgage QR HTML file is missing',
      expectedPath: filePath
    });
  }
  
  res.sendFile(filePath);
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
app.use('/', qrMortgageRoutes);
app.use('/', qrCSRoutes);

app.get('/health', async (req, res) => {
  try {
    const basicHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.nodeEnv,
      // eslint-disable-next-line global-require
      version: require('../package.json').version,
    };

    // Include system health if initializer is available
    if (req.app.locals.systemInitializer) {
      const systemHealth = await req.app.locals.systemInitializer.healthCheck();
      basicHealth.system = systemHealth;
    }

    res.status(200).json(basicHealth);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
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

  // Initialize system with comprehensive startup validation
  const SystemInitializer = require('./services/startup/systemInitializer');
  const systemInitializer = new SystemInitializer();
  
  // Store initializer for health checks regardless of initialization result
  app.locals.systemInitializer = systemInitializer;
  
  try {
    await systemInitializer.initialize();
    logger.info('System initialization completed successfully');
  } catch (error) {
    logger.error('System initialization failed', { error: error.message });
    // Continue with startup even if some initialization fails
    logger.warn('Continuing with partial initialization - system management still available...');
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
