const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');

const router = express.Router();

// Store active SSE connections
const clients = new Set();

// Broadcast log to all connected clients
function broadcastLog(logData) {
  const data = `data: ${JSON.stringify(logData)}\n\n`;
  clients.forEach((client) => {
    client.write(data);
  });
}

// Hook into the logger to capture all logs
if (logger && logger.on) {
  logger.on('data', (log) => {
    broadcastLog({
      timestamp: new Date(),
      level: log.level,
      message: log.msg || log.message,
      service: 'ai-pbx',
      ...log,
    });
  });
}

// SSE endpoint for real-time logs
router.get('/stream', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Connected to log stream',
  })}\n\n`);

  // Add client to the set
  clients.add(res);

  // Remove client on disconnect
  req.on('close', () => {
    clients.delete(res);
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Get recent logs from file
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logFile = path.join(__dirname, '../../logs/app.log');

    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [] });
    }

    // Read last N lines from log file
    exec(`tail -n ${limit} ${logFile}`, (error, stdout) => {
      if (error) {
        logger.error('Failed to read log file', { error: error.message });
        return res.status(500).json({ error: 'Failed to read logs' });
      }

      const logs = stdout.split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, level: 'info' };
          }
        });

      res.json({ logs });
    });
  } catch (error) {
    logger.error('Error fetching recent logs', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Docker logs for services
router.get('/docker/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const lines = parseInt(req.query.lines) || 50;

    const serviceMap = {
      evolution: 'evolution_api',
      postgres: 'evolution-postgres',
      redis: 'evolution-redis',
    };

    const containerName = serviceMap[service];
    if (!containerName) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    exec(`docker logs ${containerName} --tail ${lines} 2>&1`, (error, stdout, stderr) => {
      if (error) {
        logger.error('Failed to get Docker logs', {
          service,
          error: error.message,
        });
        return res.status(500).json({ error: 'Failed to get Docker logs' });
      }

      const logs = stdout.split('\n')
        .filter((line) => line.trim())
        .map((line) => ({
          message: line,
          service,
          level: line.includes('error') ? 'error'
            : line.includes('warn') ? 'warn' : 'info',
          timestamp: new Date(),
        }));

      res.json({ logs });
    });
  } catch (error) {
    logger.error('Error fetching Docker logs', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear logs
router.delete('/clear', (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../logs/app.log');

    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '');
      logger.info('Logs cleared');
    }

    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    logger.error('Failed to clear logs', { error: error.message });
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Export logs
router.get('/export', (req, res) => {
  try {
    const logFile = path.join(__dirname, '../../logs/app.log');

    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ error: 'No logs found' });
    }

    res.download(logFile, `ai-pbx-logs-${Date.now()}.log`);
  } catch (error) {
    logger.error('Failed to export logs', { error: error.message });
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

module.exports = router;
