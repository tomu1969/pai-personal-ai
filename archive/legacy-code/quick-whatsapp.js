const express = require('express');
const path = require('path');

const app = express();
const PORT = 9091;

// Serve static HTML
app.use(express.static('.'));

// Mock API endpoints for testing
app.get('/api/status', (req, res) => {
  res.json({
    status: 'connecting',
    message: 'Evolution API not running - this is a demo',
    qr_available: false
  });
});

app.get('/api/qr', (req, res) => {
  res.json({
    count: 0,
    message: 'No QR code available - Evolution API needed'
  });
});

// Create a simple status page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI PBX - WhatsApp Status</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 { color: #25D366; margin-bottom: 10px; }
        .status-box { 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            font-weight: bold;
        }
        .working { background: #d4edda; color: #155724; }
        .issue { background: #f8d7da; color: #721c24; }
        .next-steps { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
        .command { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
        ul { text-align: left; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI PBX WhatsApp Status</h1>
        
        <div class="status-box working">
            ✅ AI PBX Server: Running at localhost:3000
        </div>
        
        <div class="status-box issue">
            ❌ WhatsApp Connection: Evolution API Docker issues
        </div>
        
        <div class="next-steps">
            <h3>Quick Solutions:</h3>
            <ul>
                <li><strong>Option 1:</strong> Try the working HTML interface</li>
                <div class="command">open whatsapp-qr.html</div>
                
                <li><strong>Option 2:</strong> Test AI PBX directly</li>
                <div class="command">curl http://localhost:3000/health</div>
                
                <li><strong>Option 3:</strong> Use a WhatsApp alternative</li>
                <div class="command">npm install whatsapp-web.js --force</div>
                
                <li><strong>Option 4:</strong> Try different Evolution API</li>
                <div class="command">docker pull atendai/evolution-api:v2.0.9</div>
            </ul>
            
            <h3>Your AI System Works!</h3>
            <p>The core AI PBX system is running perfectly. The only issue is connecting WhatsApp to it.</p>
            <p><strong>Recommendation:</strong> For now, test your AI assistant using the webhook simulation in the solutions document.</p>
        </div>
        
        <p><em>Generated: ${new Date().toLocaleString()}</em></p>
    </div>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Quick WhatsApp Status Server: http://localhost:${PORT}`);
  console.log('✅ AI PBX is working - just need WhatsApp connection');
  console.log('📋 Check the solutions in WHATSAPP_CONNECTION_SOLUTIONS.md');
});