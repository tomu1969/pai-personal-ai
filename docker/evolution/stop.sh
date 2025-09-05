#!/bin/bash
# PAI System - Evolution API Stack Stop Script
# Safely stops all Evolution API services

set -e

# Configuration
PROJECT_NAME="pai-evolution"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[PAI Evolution]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_status "Stopping PAI Evolution API Stack..."

# Stop services gracefully
docker-compose -p $PROJECT_NAME down

print_success "All services stopped successfully!"

echo ""
echo "📋 Data preserved in volumes:"
echo "  • pai_evolution_instances (WhatsApp sessions)"
echo "  • pai_evolution_store (Evolution API data)"
echo "  • pai_postgres_data (Database data)"
echo "  • pai_redis_data (Redis cache)"
echo ""
echo "🔄 To restart: ./start.sh"
echo "🗑️  To remove all data: ./reset.sh"