#!/bin/bash

echo "🔄 Setting up database for AI PBX..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Database Options:${NC}"
echo "1. SQLite (Simple, file-based) - Recommended for testing"
echo "2. PostgreSQL (Production-ready) - Recommended for production"
echo ""

read -p "Choose option (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo -e "${YELLOW}🔄 Setting up SQLite database...${NC}"
    
    # Update .env for SQLite
    sed -i '' 's/DB_HOST=localhost/# DB_HOST=localhost/' .env
    sed -i '' 's/DB_PORT=5432/# DB_PORT=5432/' .env
    sed -i '' 's/DB_NAME=ai_pbx_dev/# DB_NAME=ai_pbx_dev/' .env
    sed -i '' 's/DB_USER=postgres/# DB_USER=postgres/' .env
    sed -i '' 's/DB_PASSWORD=password/# DB_PASSWORD=password/' .env
    
    # Add SQLite configuration
    echo "" >> .env
    echo "# SQLite Configuration (for development)" >> .env
    echo "DATABASE_URL=sqlite:./data/ai_pbx.db" >> .env
    
    # Create data directory
    mkdir -p data
    
    echo -e "${GREEN}✅ SQLite configuration added${NC}"
    
elif [ "$choice" = "2" ]; then
    echo -e "${YELLOW}🔄 Setting up PostgreSQL with Docker...${NC}"
    
    # Create PostgreSQL docker-compose
    cat > docker-compose.db.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:15
    container_name: ai-pbx-postgres
    environment:
      POSTGRES_DB: ai_pbx_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ai_pbx_secure_password_2024
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
EOF
    
    # Start PostgreSQL
    docker-compose -f docker-compose.db.yml up -d
    
    # Update .env with secure password
    sed -i '' 's/DB_PASSWORD=password/DB_PASSWORD=ai_pbx_secure_password_2024/' .env
    
    echo -e "${GREEN}✅ PostgreSQL started with Docker${NC}"
    sleep 3
    
else
    echo -e "${RED}❌ Invalid choice${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Running database migrations...${NC}"

# Install missing database dependencies if needed
npm install sqlite3 --save-optional

# Run migrations
npm run db:migrate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database setup complete!${NC}"
    echo ""
    echo -e "${BLUE}💾 Storage Configuration:${NC}"
    if [ "$choice" = "1" ]; then
        echo "   - Database: SQLite (./data/ai_pbx.db)"
        echo "   - Messages: Stored locally in file"
        echo "   - Contacts: Stored locally in file"
        echo "   - Conversations: Stored locally in file"
    else
        echo "   - Database: PostgreSQL (Docker container)"
        echo "   - Messages: Stored in PostgreSQL"
        echo "   - Contacts: Stored in PostgreSQL"
        echo "   - Conversations: Stored in PostgreSQL"
        echo "   - Connection: localhost:5432"
    fi
    echo "   - AI Responses: Generated and stored with each conversation"
    echo "   - Analytics: Message processing statistics tracked"
else
    echo -e "${RED}❌ Database setup failed${NC}"
    echo "Please check the error messages above"
    exit 1
fi