#!/usr/bin/env python3
"""
Simple WhatsApp Status Interface
Shows current status and next steps for WhatsApp connection
"""

import os
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from datetime import datetime

class WhatsAppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Generate a sample QR code
            qr_data = "https://web.whatsapp.com/qr?code=sample"
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>AI PBX - WhatsApp Connection</title>
    <style>
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px; margin: 0 auto; padding: 20px; text-align: center;
            background: #f5f5f5;
        }}
        .container {{ 
            background: white; padding: 30px; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        h1 {{ color: #25D366; }}
        .qr-container {{ 
            margin: 30px 0; padding: 20px; border: 2px dashed #ddd;
            border-radius: 12px; min-height: 300px; display: flex;
            align-items: center; justify-content: center;
        }}
        .instructions {{ 
            background: #e3f2fd; padding: 20px; border-radius: 8px;
            margin: 20px 0; text-align: left;
        }}
        .instructions h3 {{ margin-top: 0; color: #1976d2; }}
        .error {{ color: #dc3545; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI PBX WhatsApp Connection</h1>
        <p>Connect your WhatsApp to the AI Assistant</p>
        
        <div class="qr-container">
            <div class="error">
                <h3>⚠️ Setup Required</h3>
                <p>For a working WhatsApp connection, you need to:</p>
                <ol>
                    <li>Install a proper WhatsApp Web library (whatsapp-web.js)</li>
                    <li>Or use Evolution API with proper configuration</li>
                    <li>Or use WhatsApp Business API</li>
                </ol>
                <p><strong>Current Status:</strong> Demo mode - QR code would appear here</p>
            </div>
        </div>
        
        <div class="instructions">
            <h3>📱 Next Steps:</h3>
            <ol>
                <li>Fix the npm installation issues to install whatsapp-web.js</li>
                <li>Or fix the Evolution API Docker configuration</li>
                <li>Or consider using WhatsApp Business API</li>
                <li>Once working, scan the QR code with WhatsApp</li>
                <li>Test your AI assistant!</li>
            </ol>
        </div>
        
        <p><em>Generated at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</em></p>
    </div>
</body>
</html>
            """
            self.wfile.write(html_content.encode())
            
        elif self.path == '/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            status = {
                "status": "demo",
                "message": "This is a demo WhatsApp connection interface",
                "ai_pbx_status": "ready",
                "timestamp": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(status).encode())
        else:
            self.send_error(404)

def run_server():
    try:
        server = HTTPServer(('localhost', 9090), WhatsAppHandler)
        print("🚀 Simple WhatsApp Demo Server started at: http://localhost:9090")
        print("📱 Open the URL above to see the connection interface")
        print("⚠️  This is a demo - real WhatsApp integration requires proper setup")
        print("🔄 Press Ctrl+C to stop")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        server.shutdown()

if __name__ == "__main__":
    # Try to open browser automatically
    try:
        webbrowser.open('http://localhost:9090')
    except:
        pass
    
    run_server()