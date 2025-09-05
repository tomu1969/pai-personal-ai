const express = require('express');
const router = express.Router();
const evolutionMultiInstance = require('../../services/whatsapp/evolutionMultiInstance');
const logger = require('../../utils/logger');

/**
 * QR Code page for PAI Assistant
 * This instance is for users to query their messages
 */
router.get('/qr-assistant', async (req, res) => {
  try {
    logger.info('PAI Assistant QR page requested');
    
    // Initialize if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const qrResult = await evolutionMultiInstance.getQRCode('pai_assistant');
    
    // Server-side render the QR code directly
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PAI Assistant - QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            margin-top: 30px;
        }
        .title {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
            font-weight: bold;
        }
        .subtitle {
            color: #666;
            font-size: 1.1em;
            margin-bottom: 30px;
        }
        .qr-box {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            border: 3px solid #667eea;
        }
        .qr-image {
            max-width: 350px;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .warning {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 500;
        }
        .feature-list {
            text-align: left;
            background: #f8f9ff;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .feature-list h4 {
            color: #667eea;
            margin-bottom: 15px;
        }
        .feature-list ul {
            color: #555;
            line-height: 1.8;
        }
        .refresh-link {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 30px;
            margin: 20px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        .refresh-link:hover {
            transform: scale(1.05);
        }
        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 20px;
            background: #e8f5e9;
            color: #2e7d32;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .pulse {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #4caf50;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <div class="container">
        <h1 class="title">🤖 PAI Assistant</h1>
        <p class="subtitle">Your Personal AI Message Query Assistant</p>
        
        <div class="badge">Instance: ${qrResult.instanceId}</div>
        <div class="status-indicator">
            <span class="pulse"></span>
            <span>Auto-refresh every 30 seconds</span>
        </div>

        <div class="warning">
            <strong>⚠️ IMPORTANT:</strong> Use a different WhatsApp account than your main line!
            <br>This is the PAI Assistant line for querying your messages.
        </div>

        <div class="qr-box">
            <h3>📱 Scan this QR Code</h3>
            <img class="qr-image" src="${qrResult.qrCode.base64}" alt="PAI Assistant QR Code">
        </div>

        <div class="feature-list">
            <h4>💬 What PAI Assistant Can Do:</h4>
            <ul>
                <li>📊 <strong>"What messages did I get today?"</strong> - Get a summary of today's messages</li>
                <li>👤 <strong>"Show me messages from John yesterday"</strong> - Filter by contact and date</li>
                <li>🔍 <strong>"Messages containing 'meeting' from this week"</strong> - Search by content</li>
                <li>📅 <strong>"Messages from last Monday"</strong> - Query by specific dates</li>
                <li>📈 <strong>"Give me a summary of this week"</strong> - Get conversation summaries</li>
            </ul>
        </div>

        <div class="feature-list">
            <h4>🚀 How to Connect:</h4>
            <ol>
                <li>Open WhatsApp on your <strong>secondary device</strong></li>
                <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>"Link a Device"</strong></li>
                <li>Scan the QR code above</li>
                <li>Start messaging for instant AI-powered queries!</li>
            </ol>
        </div>

        <a href="/qr-assistant" class="refresh-link">🔄 Refresh QR Code</a>
    </div>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    logger.error('Failed to render PAI Assistant QR page', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 20px; max-width: 500px; margin: 0 auto;">
            <h1 style="color: #f5576c;">Failed to Load QR Code</h1>
            <p style="color: #666;">${error.message}</p>
            <a href="/qr-assistant" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 30px; border-radius: 30px; margin-top: 20px;">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;