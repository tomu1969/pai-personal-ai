const express = require('express');
const router = express.Router();
const evolutionMultiInstance = require('../services/whatsapp/evolutionMultiInstance');
const logger = require('../utils/logger');

router.get('/qr-direct', async (req, res) => {
  try {
    logger.info('Direct QR page requested');
    
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
    <title>PAI Assistant QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .title {
            color: #007bff;
            margin-bottom: 20px;
            font-size: 2em;
        }
        .qr-image {
            max-width: 400px;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 20px auto;
        }
        .warning {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .instructions {
            text-align: left;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        .refresh-link {
            display: inline-block;
            background: #007bff;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 6px;
            margin: 10px;
        }
        .refresh-link:hover {
            background: #0056b3;
        }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <div class="container">
        <h1 class="title">🤖 PAI Assistant WhatsApp Line</h1>
        
        <div class="warning">
            <strong>⚠️ IMPORTANT:</strong> Use a different WhatsApp account than your main line!
            <br>This could be WhatsApp Business, a different device, or a secondary account.
        </div>

        <h3>Scan this QR Code:</h3>
        <img class="qr-image" src="${qrResult.qrCode.base64}" alt="PAI Assistant QR Code">
        <p>Instance: ${qrResult.instanceId}</p>
        <p style="color: #666; font-size: 0.9em;">Page auto-refreshes every 30 seconds</p>

        <div class="instructions">
            <h4>📱 How to Connect:</h4>
            <ol>
                <li>Open WhatsApp on your PAI Assistant device</li>
                <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>"Link a Device"</strong></li>
                <li>Scan the QR code above</li>
                <li>Once connected, users can message this number with queries</li>
            </ol>
        </div>

        <a href="/qr-direct" class="refresh-link">🔄 Refresh QR Code</a>
    </div>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    logger.error('Failed to render QR page', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: red;">Failed to Load QR Code</h1>
          <p>${error.message}</p>
          <a href="/qr-direct">Try Again</a>
        </body>
      </html>
    `);
  }
});

module.exports = router;