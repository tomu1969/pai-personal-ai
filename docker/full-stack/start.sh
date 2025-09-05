#!/bin/bash
# PAI System - Full Stack Startup Script
# Starts complete PAI system with frontend, backend, Evolution API, and databases

set -e

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="pai-full-stack"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[PAI Full Stack]${NC} $1"
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

print_status "Starting PAI Full Stack System..."

# Check prerequisites
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install docker-compose."
    exit 1
fi

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    print_error "OPENAI_API_KEY environment variable is required!"
    echo "Please export your OpenAI API key:"
    echo "  export OPENAI_API_KEY='your-api-key-here'"
    exit 1
fi

print_success "OpenAI API key found and configured."

# Create network if it doesn't exist
if ! docker network ls | grep -q "pai_network"; then
    print_status "Creating PAI network..."
    docker network create pai_network
fi

# Check for .env file
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating one with defaults..."
    cat > .env << EOF
# Database Configuration
POSTGRES_PASSWORD=evolution123
REDIS_PASSWORD=redis123

# Evolution API
EVOLUTION_API_KEY=pai_evolution_api_key_2025

# Application
NODE_ENV=production
LOG_LEVEL=info
EOF
    print_status ".env file created with default values."
fi

# Build images if they don't exist
print_status "Building application images..."
docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE build

# Start the services
print_status "Starting all services..."
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

# Wait for Backend
print_status "Waiting for AI PBX Backend..."
timeout 120 bash -c 'until curl -sf http://localhost:3000/health >/dev/null; do sleep 5; done'

# Wait for Frontend
print_status "Waiting for AI PBX Frontend..."
timeout 60 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 3; done'

print_success "All services are up and running!"

# Show service status
print_status "Service Status:"
docker-compose -p $PROJECT_NAME ps

echo ""
print_success "🚀 PAI Full Stack System is ready!"
echo ""
echo "🌐 Available Services:"
echo "  • Frontend (React):   http://localhost:5173"
echo "  • Backend (API):      http://localhost:3000"
echo "  • Evolution API:      http://localhost:8080"
echo "  • Health Check:       http://localhost:3000/health"
echo ""
echo "📱 WhatsApp Setup:"
echo "  • PAI Responder QR:   http://localhost:3000/qr-responder"
echo "  • PAI Assistant QR:   http://localhost:3000/qr-assistant"
echo ""
echo "🔗 Optional Services (start with --profile):"
echo "  • pgAdmin:            http://localhost:8081 (admin@pai.local:admin123)"
echo "  • Nginx Proxy:        http://localhost:80"
echo ""
echo "📚 Next Steps:"
echo "  1. Open the frontend at http://localhost:5173"
echo "  2. Configure assistant settings in the web interface"
echo "  3. Scan QR codes to connect WhatsApp devices:"
echo "     - Main line (PAI Responder): http://localhost:3000/qr-responder"
echo "     - Query line (PAI Assistant): http://localhost:3000/qr-assistant"
echo "  4. Test the system by sending messages to your WhatsApp numbers"
echo ""
echo "🛠️  Management Commands:"
echo "  • View logs:          ./logs.sh"
echo "  • Stop services:      ./stop.sh"
echo "  • Reset data:         ./reset.sh"
echo "  • Update images:      ./update.sh"