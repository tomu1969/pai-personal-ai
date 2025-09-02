#!/bin/bash

echo "⏹️  Stopping AI PBX End-to-End Test..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop AI PBX (find process on port 3000)
echo "🔄 Stopping AI PBX..."
PID=$(lsof -t -i:3000)
if [ ! -z "$PID" ]; then
    kill $PID
    echo -e "${GREEN}✅ AI PBX stopped${NC}"
else
    echo -e "${YELLOW}⚠️  AI PBX was not running${NC}"
fi

# Stop Evolution API
echo "🔄 Stopping Evolution API..."
docker-compose -f docker-compose.evolution.yml down

echo -e "${GREEN}✅ All services stopped${NC}"

# Show cleanup options
echo ""
echo "🧹 Optional cleanup:"
echo "   - Remove Evolution API data: docker-compose -f docker-compose.evolution.yml down -v"
echo "   - Remove Evolution API image: docker rmi davidsongomes/evolution-api:v2.0.0"