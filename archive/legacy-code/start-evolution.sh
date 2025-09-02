#!/bin/bash

echo "========================================"
echo "   AI PBX - Evolution API Setup"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Evolution API with PostgreSQL...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running! Please start Docker Desktop first.${NC}"
    exit 1
fi

# Start the services
echo -e "${YELLOW}Starting Docker Compose (this may take a few minutes on first run)...${NC}"
docker-compose -f docker-compose.evolution-working.yml up -d

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to initialize...${NC}"
sleep 10

# Check if PostgreSQL is running
if docker exec evolution-postgres pg_isready -U evolution > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not ready yet. Waiting more...${NC}"
    sleep 20
fi

# Check if Evolution API is running
echo -e "${YELLOW}Checking Evolution API...${NC}"
sleep 5

if curl -s -f http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Evolution API is running${NC}"
    
    # Create WhatsApp instance
    echo -e "${YELLOW}Creating WhatsApp instance...${NC}"
    
    RESPONSE=$(curl -s -X POST http://localhost:8080/instance/create \
        -H "apikey: ai-pbx-key-2024" \
        -H "Content-Type: application/json" \
        -d '{"instanceName": "ai-pbx", "qrcode": true}')
    
    if echo "$RESPONSE" | grep -q "instance"; then
        echo -e "${GREEN}✓ WhatsApp instance created${NC}"
    else
        echo -e "${YELLOW}Instance might already exist or there was an error${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}========================================"
    echo "   Setup Complete!"
    echo "========================================${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open the QR code interface:"
    echo -e "   ${YELLOW}open evolution-qr.html${NC}"
    echo ""
    echo "2. Scan the QR code with WhatsApp"
    echo ""
    echo "3. Your AI PBX is running at:"
    echo -e "   ${YELLOW}http://localhost:3000${NC}"
    echo ""
    echo "Useful commands:"
    echo "  View logs:        docker-compose -f docker-compose.evolution-working.yml logs -f"
    echo "  Stop services:    docker-compose -f docker-compose.evolution-working.yml down"
    echo "  Restart services: docker-compose -f docker-compose.evolution-working.yml restart"
    
else
    echo -e "${RED}✗ Evolution API is not running yet${NC}"
    echo "Docker might still be downloading images. Check with:"
    echo "  docker-compose -f docker-compose.evolution-working.yml logs"
fi