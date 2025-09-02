#!/bin/bash

echo "🚀 Starting AI PBX End-to-End Test Setup..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${RED}❌ Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -e "   Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to start${NC}"
    return 1
}

echo "📋 Checking prerequisites..."

# Check if Docker is running (for Evolution API)
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check ports
echo "🔍 Checking ports..."
check_port 3000 || exit 1  # AI PBX
check_port 8080 || exit 1  # Evolution API

echo -e "${GREEN}✅ All prerequisites met!${NC}"

# Start Evolution API
echo "🔄 Starting Evolution API..."
docker-compose -f docker-compose.evolution.yml up -d

# Wait for Evolution API to be ready
if ! wait_for_service "http://localhost:8080" "Evolution API"; then
    echo -e "${RED}❌ Failed to start Evolution API${NC}"
    exit 1
fi

# Start AI PBX
echo "🔄 Starting AI PBX..."
npm start &
AI_PBX_PID=$!

# Wait for AI PBX to be ready
if ! wait_for_service "http://localhost:3000/health" "AI PBX"; then
    echo -e "${RED}❌ Failed to start AI PBX${NC}"
    kill $AI_PBX_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}🎉 Both services are running!${NC}"
echo ""
echo "📱 Next steps to connect your phone:"
echo "1. Open browser and go to: http://localhost:8080/instance/connect/ai-pbx-instance"
echo "2. Scan the QR code with WhatsApp on your phone"
echo "3. Once connected, test by sending a message to your WhatsApp number"
echo ""
echo "🔧 Useful URLs:"
echo "   - Evolution API: http://localhost:8080"
echo "   - AI PBX Health: http://localhost:3000/health"
echo "   - AI PBX Status: http://localhost:3000/api/status"
echo ""
echo "⏹️  To stop services, run: ./scripts/stop-e2e-test.sh"

# Keep script running
echo "Press Ctrl+C to stop all services..."
trap 'echo "Stopping services..."; kill $AI_PBX_PID 2>/dev/null; docker-compose -f docker-compose.evolution.yml down; exit 0' INT

wait