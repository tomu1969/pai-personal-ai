#!/bin/bash

echo "🔄 Setting up WhatsApp connection for AI PBX..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Prerequisites:${NC}"
echo "✓ AI PBX running on localhost:3000"
echo "✓ Docker installed and running"
echo ""

echo -e "${YELLOW}🚀 Starting Evolution API...${NC}"

# Create a working evolution docker-compose
cat > docker-compose.whatsapp.yml << EOF
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:v2.1.1
    container_name: whatsapp-evolution
    ports:
      - "8080:8080"
    environment:
      # Server
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - SERVER_URL=http://localhost:8080
      
      # Cors
      - CORS_ORIGIN=*
      - CORS_METHODS=POST,GET,PUT,DELETE
      - CORS_CREDENTIALS=true
      
      # Store
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      
      # Database (disabled for simplicity)
      - DATABASE_ENABLED=false
      
      # Webhook
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_URL=http://host.docker.internal:3000/webhook
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=true
      - WEBHOOK_GLOBAL_IGNORE_JID=true
      
      # Auth
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=ai-pbx-whatsapp-key-2024
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      
      # Logs
      - LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,WEBHOOKS
      - LOG_COLOR=true
      - LOG_BAILEYS=error
      
      # Instance
      - CONFIG_SESSION_PHONE_CLIENT=AI-PBX
      - CONFIG_SESSION_PHONE_NAME=AI PBX Assistant
      
      # QR Code
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#198754
      
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    restart: unless-stopped

volumes:
  evolution_instances:
  evolution_store:
EOF

echo -e "${GREEN}✅ Docker compose file created${NC}"

# Start Evolution API
docker-compose -f docker-compose.whatsapp.yml up -d

echo -e "${YELLOW}⏳ Waiting for Evolution API to start...${NC}"
sleep 10

# Check if Evolution API is running
if curl -s http://localhost:8080/manager/instance > /dev/null; then
    echo -e "${GREEN}✅ Evolution API is running!${NC}"
else
    echo -e "${RED}❌ Evolution API failed to start. Checking logs...${NC}"
    docker logs whatsapp-evolution --tail 10
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Evolution API is ready!${NC}"
echo ""
echo -e "${BLUE}📱 Next Steps:${NC}"
echo "1. Open: http://localhost:8080/manager/instance"
echo "2. Create a new instance named 'ai-pbx-instance'"
echo "3. Connect your WhatsApp by scanning the QR code"
echo "4. Test by sending messages to your WhatsApp number"
echo ""
echo -e "${YELLOW}🔧 Management URLs:${NC}"
echo "   - Evolution Manager: http://localhost:8080/manager/instance"
echo "   - API Documentation: http://localhost:8080/docs"
echo "   - AI PBX Health: http://localhost:3000/health"
echo ""
echo -e "${RED}⚠️  Important:${NC}"
echo "   - Use API Key: ai-pbx-whatsapp-key-2024"
echo "   - Webhook is automatically configured"
echo "   - Messages will be processed by AI PBX"