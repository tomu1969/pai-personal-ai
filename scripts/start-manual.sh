#!/bin/bash

echo "🚀 Starting AI PBX (Manual Setup - No Docker)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if port 3000 is available
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Port 3000 is already in use${NC}"
    echo "Please stop the service using port 3000 or use a different port"
    exit 1
fi

echo -e "${GREEN}✅ Port 3000 is available${NC}"

# Start AI PBX
echo -e "${YELLOW}🔄 Starting AI PBX...${NC}"
npm start &
AI_PBX_PID=$!

# Wait for AI PBX to be ready
echo -e "${YELLOW}⏳ Waiting for AI PBX to start...${NC}"
sleep 3

# Test if AI PBX is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ AI PBX is running!${NC}"
else
    echo -e "${RED}❌ AI PBX failed to start${NC}"
    kill $AI_PBX_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}🎉 AI PBX is ready!${NC}"
echo ""
echo "📱 To connect your phone, you'll need to set up Evolution API separately:"
echo "1. Follow the Evolution API installation guide: https://github.com/EvolutionAPI/evolution-api"
echo "2. Configure webhook URL: http://localhost:3000/webhook"
echo "3. Use API key: ai-pbx-evolution-key-2024"
echo ""
echo "🔧 Useful URLs:"
echo "   - AI PBX Health: http://localhost:3000/health"
echo "   - AI PBX Status: http://localhost:3000/api/status"
echo "   - Assistant Status: http://localhost:3000/api/assistant/status"
echo ""
echo "⏹️  Press Ctrl+C to stop AI PBX"

# Keep script running
trap 'echo "Stopping AI PBX..."; kill $AI_PBX_PID 2>/dev/null; exit 0' INT
wait