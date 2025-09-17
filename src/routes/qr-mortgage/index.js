const express = require('express');
const router = express.Router();
const evolutionMultiInstance = require('../../services/whatsapp/evolutionMultiInstance');
const logger = require('../../utils/logger');

/**
 * QR Code page for PAI Mortgage
 * This instance is for mortgage qualification and guidance
 */
router.get('/qr-mortgage', async (req, res) => {
  try {
    logger.info('PAI Mortgage QR page requested');
    
    // Initialize if needed
    if (!evolutionMultiInstance.initialized) {
      await evolutionMultiInstance.initialize();
    }

    const qrResult = await evolutionMultiInstance.getQRCode('pai-mortgage');
    
    // Server-side render the QR code directly
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PAI Mortgage - QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #2E8B57 0%, #228B22 100%);
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
            color: #2E8B57;
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
            border: 3px solid #2E8B57;
        }
        .qr-image {
            max-width: 350px;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .badge {
            display: inline-block;
            background: #2E8B57;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .warning {
            background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 500;
        }
        .feature-list {
            text-align: left;
            background: #f0f8f0;
            border-left: 4px solid #2E8B57;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .feature-list h4 {
            color: #2E8B57;
            margin-bottom: 15px;
        }
        .feature-list ul {
            color: #555;
            line-height: 1.8;
        }
        .feature-list ol {
            color: #555;
            line-height: 1.8;
        }
        .refresh-link {
            display: inline-block;
            background: linear-gradient(135deg, #2E8B57 0%, #228B22 100%);
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
        .highlight-box {
            background: linear-gradient(135deg, #2E8B57 0%, #32CD32 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 500;
        }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <div class="container">
        <h1 class="title">🏠 PAI Mortgage</h1>
        <p class="subtitle">Your Personal AI Mortgage Qualification Assistant</p>
        
        <div class="badge">Instance: ${qrResult.instanceId}</div>
        <div class="status-indicator">
            <span class="pulse"></span>
            <span>Auto-refresh every 30 seconds</span>
        </div>

        <div class="highlight-box">
            <strong>🎯 GET PRE-QUALIFIED INSTANTLY!</strong>
            <br>Connect to start your mortgage qualification journey with AI-powered guidance.
        </div>

        <div class="qr-box">
            <h3>📱 Scan this QR Code</h3>
            <img class="qr-image" src="${qrResult.qrCode.base64}" alt="PAI Mortgage QR Code">
        </div>

        <div class="feature-list">
            <h4>💰 What PAI Mortgage Can Help With:</h4>
            <ul>
                <li>🏡 <strong>"I want to buy a $400,000 house with 20% down"</strong> - Instant qualification check</li>
                <li>📊 <strong>"What can I qualify for with 720 credit score?"</strong> - Loan amount estimates</li>
                <li>💵 <strong>"My income is $80k, what's my limit?"</strong> - Affordability analysis</li>
                <li>📈 <strong>"What are current mortgage rates?"</strong> - Real-time rate information</li>
                <li>⚖️ <strong>"Compare FHA vs conventional loans"</strong> - Loan program comparison</li>
                <li>📋 <strong>"What documents do I need?"</strong> - Required documentation checklist</li>
                <li>🧮 <strong>"Calculate payment for $300k at 7%"</strong> - Mortgage calculations</li>
                <li>🔄 <strong>"Explain the mortgage process"</strong> - Step-by-step guidance</li>
            </ul>
        </div>

        <div class="feature-list">
            <h4>📋 Qualification Information I Can Help Collect:</h4>
            <ul>
                <li>💳 <strong>Credit Score</strong> - Current FICO or VantageScore</li>
                <li>💰 <strong>Annual Income</strong> - Gross yearly earnings</li>
                <li>🏠 <strong>Property Value/Loan Amount</strong> - Purchase price or loan needed</li>
                <li>💵 <strong>Down Payment</strong> - Available cash for down payment</li>
                <li>📊 <strong>Debt-to-Income Ratio</strong> - Monthly debt obligations</li>
                <li>🏘️ <strong>Property Type</strong> - Single family, condo, etc.</li>
                <li>📍 <strong>Location</strong> - State/city for local requirements</li>
            </ul>
        </div>

        <div class="feature-list">
            <h4>🚀 How to Connect:</h4>
            <ol>
                <li>Open WhatsApp on your <strong>device</strong></li>
                <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>"Link a Device"</strong></li>
                <li>Scan the QR code above</li>
                <li>Start your mortgage qualification journey!</li>
            </ol>
        </div>

        <div class="feature-list">
            <h4>🎯 Sample Conversations:</h4>
            <ul>
                <li><strong>"I want to buy my first home"</strong> - Get started with basic guidance</li>
                <li><strong>"750 credit score, $100k income, need $500k loan"</strong> - Quick qualification</li>
                <li><strong>"What's better for me: FHA or conventional?"</strong> - Loan comparison</li>
                <li><strong>"How much house can I afford?"</strong> - Affordability calculation</li>
                <li><strong>"I'm self-employed, what do I need?"</strong> - Specialized guidance</li>
            </ul>
        </div>

        <a href="/qr-mortgage" class="refresh-link">🔄 Refresh QR Code</a>
    </div>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    logger.error('Failed to render PAI Mortgage QR page', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #2E8B57 0%, #228B22 100%); min-height: 100vh;">
          <div style="background: white; padding: 40px; border-radius: 20px; max-width: 500px; margin: 0 auto;">
            <h1 style="color: #f5576c;">Failed to Load QR Code</h1>
            <p style="color: #666;">${error.message}</p>
            <a href="/qr-mortgage" style="display: inline-block; background: #2E8B57; color: white; text-decoration: none; padding: 12px 30px; border-radius: 30px; margin-top: 20px;">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;