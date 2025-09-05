const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * QR Code page for PAI Responder
 * This instance is the main WhatsApp line that responds on behalf of the owner
 */
router.get('/qr-responder', async (req, res) => {
  try {
    logger.info('PAI Responder QR page requested');
    
    // For PAI Responder, we use the main Evolution instance
    const axios = require('axios');
    const evolutionApiUrl = config.evolution.apiUrl;
    const evolutionApiKey = config.evolution.apiKey;
    const instanceId = config.evolution.instanceId; // Main instance "aipbx"

    // Get connection status
    const statusResponse = await axios.get(
      `${evolutionApiUrl}/instance/connectionState/${instanceId}`,
      {
        headers: { apikey: evolutionApiKey }
      }
    );

    const isConnected = statusResponse.data?.instance?.state === 'open';

    let qrContent = '';
    if (!isConnected) {
      // Get QR code if not connected
      try {
        const qrResponse = await axios.get(
          `${evolutionApiUrl}/instance/connect/${instanceId}`,
          {
            headers: { apikey: evolutionApiKey }
          }
        );
        
        if (qrResponse.data?.base64) {
          qrContent = `
            <div class="qr-box">
              <h3>📱 Scan this QR Code</h3>
              <img class="qr-image" src="${qrResponse.data.base64}" alt="PAI Responder QR Code">
            </div>`;
        } else if (qrResponse.data?.code) {
          qrContent = `
            <div class="qr-box">
              <h3>📱 QR Code String</h3>
              <p style="word-break: break-all; font-family: monospace; font-size: 0.8em; padding: 20px; background: white; border-radius: 8px;">
                ${qrResponse.data.code}
              </p>
              <p style="color: #666; font-size: 0.9em;">Copy and paste this code in WhatsApp Web</p>
            </div>`;
        }
      } catch (qrError) {
        logger.error('Failed to get QR code for responder', { error: qrError.message });
        qrContent = `
          <div class="error-box">
            <h3>⚠️ QR Code Not Available</h3>
            <p>Unable to generate QR code. Please check Evolution API.</p>
          </div>`;
      }
    } else {
      qrContent = `
        <div class="success-box">
          <h2>✅ WhatsApp Connected!</h2>
          <p>PAI Responder is active and responding to messages.</p>
          <div class="phone-info">
            <strong>Instance:</strong> ${instanceId}<br>
            <strong>Status:</strong> ${statusResponse.data?.instance?.state || 'Connected'}
          </div>
        </div>`;
    }
    
    // Server-side render the QR code page
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PAI Responder - QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
            color: #4facfe;
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
            background: #f0f9ff;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            border: 3px solid #4facfe;
        }
        .success-box {
            background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            color: white;
        }
        .error-box {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            color: #721c24;
        }
        .qr-image {
            max-width: 350px;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .badge {
            display: inline-block;
            background: #4facfe;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .warning {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: #721c24;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 500;
        }
        .feature-list {
            text-align: left;
            background: #f0f9ff;
            border-left: 4px solid #4facfe;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .feature-list h4 {
            color: #4facfe;
            margin-bottom: 15px;
        }
        .feature-list ul {
            color: #555;
            line-height: 1.8;
        }
        .refresh-link {
            display: inline-block;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
            background: #e3f2fd;
            color: #1976d2;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .pulse {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #2196f3;
            animation: pulse 2s infinite;
        }
        .phone-info {
            background: rgba(255,255,255,0.9);
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            color: #333;
            font-size: 0.95em;
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
        <h1 class="title">💬 PAI Responder</h1>
        <p class="subtitle">Your Main WhatsApp AI Assistant</p>
        
        <div class="badge">Instance: ${instanceId}</div>
        <div class="status-indicator">
            <span class="pulse"></span>
            <span>Auto-refresh every 30 seconds</span>
        </div>

        <div class="warning">
            <strong>⚠️ IMPORTANT:</strong> This is your MAIN WhatsApp line!
            <br>PAI Responder will automatically respond to messages on your behalf.
        </div>

        ${qrContent}

        <div class="feature-list">
            <h4>🎯 What PAI Responder Does:</h4>
            <ul>
                <li>📨 <strong>Auto-responds</strong> to incoming messages when you're busy</li>
                <li>🧠 <strong>Context-aware</strong> responses based on conversation history</li>
                <li>👤 <strong>Personalized</strong> responses using your name and style</li>
                <li>⏰ <strong>30-minute cooldown</strong> between automated responses</li>
                <li>📝 <strong>Logs all interactions</strong> for your review</li>
            </ul>
        </div>

        <div class="feature-list">
            <h4>🔧 Setup Instructions:</h4>
            <ol>
                <li>Open WhatsApp on your <strong>main phone</strong></li>
                <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>"Link a Device"</strong></li>
                <li>Scan the QR code above</li>
                <li>PAI Responder will start monitoring and responding!</li>
            </ol>
        </div>

        <div class="feature-list" style="background: #fff3e0; border-left-color: #ff9800;">
            <h4>⚙️ Configuration Status:</h4>
            <ul>
                <li>Assistant Name: <strong>PAI</strong></li>
                <li>Owner Name: <strong>Tomás</strong></li>
                <li>Auto-Response: <strong>${isConnected ? 'Ready' : 'Pending Connection'}</strong></li>
                <li>Message Filtering: <strong>Active</strong></li>
            </ul>
        </div>

        <a href="/qr-responder" class="refresh-link">🔄 Refresh Status</a>
    </div>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    logger.error('Failed to render PAI Responder QR page', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 20px; max-width: 500px; margin: 0 auto;">
            <h1 style="color: #f5576c;">Failed to Load Status</h1>
            <p style="color: #666;">${error.message}</p>
            <a href="/qr-responder" style="display: inline-block; background: #4facfe; color: white; text-decoration: none; padding: 12px 30px; border-radius: 30px; margin-top: 20px;">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;