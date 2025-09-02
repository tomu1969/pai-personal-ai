#!/bin/bash

echo "📱 WhatsApp Connection Helper"
echo "============================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

API_KEY="ai-pbx-evolution-key-2024"
INSTANCE_NAME="ai-pbx-instance"
BASE_URL="http://localhost:8080"

echo -e "${BLUE}🔍 Checking Evolution API...${NC}"
if ! curl -s $BASE_URL > /dev/null; then
    echo -e "${RED}❌ Evolution API is not running on $BASE_URL${NC}"
    echo "Please start it with: docker-compose -f docker-compose.evolution-complete.yml up -d"
    exit 1
fi

echo -e "${GREEN}✅ Evolution API is running${NC}"

echo -e "${BLUE}📊 Checking instance status...${NC}"
RESPONSE=$(curl -s -H "apikey: $API_KEY" "$BASE_URL/instance/connectionState/$INSTANCE_NAME")
STATE=$(echo $RESPONSE | jq -r '.instance.state')

echo "Current state: $STATE"

if [ "$STATE" = "open" ]; then
    echo -e "${GREEN}🎉 WhatsApp is already connected!${NC}"
    echo "You can send messages to your WhatsApp number and the AI will respond."
    exit 0
elif [ "$STATE" = "connecting" ] || [ "$STATE" = "close" ]; then
    echo -e "${YELLOW}⏳ Getting QR code for connection...${NC}"
    
    # Try to get QR code
    QR_RESPONSE=$(curl -s -H "apikey: $API_KEY" "$BASE_URL/instance/connect/$INSTANCE_NAME")
    
    if echo "$QR_RESPONSE" | jq -e '.base64' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ QR Code generated!${NC}"
        echo ""
        echo -e "${BLUE}📱 To connect your WhatsApp:${NC}"
        echo "1. Open WhatsApp on your phone"
        echo "2. Go to Menu (3 dots) → Linked Devices"
        echo "3. Tap 'Link a Device'"
        echo "4. Open this URL in your browser and scan the QR code:"
        echo ""
        echo -e "${YELLOW}   👉 $BASE_URL/instance/connect/$INSTANCE_NAME${NC}"
        echo ""
        echo "The QR code will refresh automatically until you scan it."
    else
        echo -e "${YELLOW}⏳ QR code not ready yet. Waiting...${NC}"
        sleep 5
        echo "Please try opening this URL in your browser:"
        echo -e "${YELLOW}   👉 $BASE_URL/instance/connect/$INSTANCE_NAME${NC}"
    fi
else
    echo -e "${RED}❌ Unknown state: $STATE${NC}"
    echo "Raw response: $RESPONSE"
fi

echo ""
echo -e "${BLUE}🔧 Management URLs:${NC}"
echo "   Evolution Manager: $BASE_URL/manager/instance"
echo "   Instance Connection: $BASE_URL/instance/connect/$INSTANCE_NAME"
echo "   AI PBX Health: http://localhost:3000/health"

echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Open the connection URL above in your browser"
echo "2. Scan QR code with WhatsApp"
echo "3. Wait for 'Connected' status"
echo "4. Send a test message to your WhatsApp number"
echo "5. Watch your AI assistant respond!"

echo ""
echo -e "${BLUE}🧪 Test webhook (optional):${NC}"
echo "curl -X POST http://localhost:3000/webhook/test -H 'Content-Type: application/json' -d '{\"test\":\"message\"}'"