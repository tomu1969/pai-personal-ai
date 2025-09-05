#!/bin/bash
# PAI System - Evolution API Stack Startup Script
# Starts Evolution API with PostgreSQL and Redis dependencies

set -e

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="pai-evolution"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[PAI Evolution]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Starting PAI Evolution API Stack..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install docker-compose."
    exit 1
fi

# Create network if it doesn't exist
if ! docker network ls | grep -q "pai_network"; then
    print_status "Creating PAI network..."
    docker network create pai_network
fi

# Check for .env file
if [ ! -f .env ]; then
    print_warning ".env file not found. Using default environment variables."
    print_status "You can create a .env file with custom settings:"
    echo "  POSTGRES_PASSWORD=your_password"
    echo "  REDIS_PASSWORD=your_redis_password" 
    echo "  EVOLUTION_API_KEY=your_api_key"
fi

# Start the services
print_status "Starting services..."
docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE up -d

# Wait for services to be healthy
print_status "Waiting for services to be ready..."

# Wait for PostgreSQL
print_status "Waiting for PostgreSQL..."
timeout 60 bash -c 'until docker-compose -p '$PROJECT_NAME' exec -T postgres pg_isready -U evolution; do sleep 2; done'

# Wait for Redis
print_status "Waiting for Redis..."
timeout 60 bash -c 'until docker-compose -p '$PROJECT_NAME' exec -T redis redis-cli -a redis123 ping | grep -q PONG; do sleep 2; done'

# Wait for Evolution API
print_status "Waiting for Evolution API..."
timeout 120 bash -c 'until curl -sf http://localhost:8080 >/dev/null; do sleep 5; done'

print_success "All services are up and running!"

# Show service status
print_status "Service Status:"
docker-compose -p $PROJECT_NAME ps

echo ""
print_success "🚀 PAI Evolution API Stack is ready!"
echo ""
echo "📋 Available Services:"
echo "  • Evolution API:     http://localhost:8080"
echo "  • PostgreSQL:        localhost:5432 (evolution:evolution123)"
echo "  • Redis:             localhost:6379"
echo ""
echo "🔗 Optional Services (start with --profile):"
echo "  • pgAdmin:           http://localhost:8081 (admin@pai.local:admin123)"
echo "    Start with: docker-compose --profile tools up -d pgadmin"
echo ""
echo "📚 Next Steps:"
echo "  1. Create WhatsApp instances using the Evolution API"
echo "  2. Configure webhooks pointing to your AI PBX backend"
echo "  3. Scan QR codes to connect WhatsApp devices"
echo ""
echo "🛠️  Management Commands:"
echo "  • View logs:      ./logs.sh"
echo "  • Stop services:  ./stop.sh"
echo "  • Reset data:     ./reset.sh"