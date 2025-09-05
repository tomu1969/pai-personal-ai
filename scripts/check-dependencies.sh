#!/bin/bash
# PAI System - Minimal Dependency Verification Script (Bash 3.2+ compatible)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Global variables
ERRORS=0
WARNINGS=0
REQUIRED_PORTS="3000 3001 8080 5432 6379"

# Logging functions
log_info() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] [ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}\n"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if port is available
port_available() {
    local port=$1
    if command_exists lsof; then
        ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
    else
        # Fallback: try to connect
        if (echo >/dev/tcp/localhost/$port) >/dev/null 2>&1; then
            return 1  # Port is in use
        else
            return 0  # Port is available
        fi
    fi
}

# Check if a port is used by PAI's own services
port_used_by_pai_service() {
    local port=$1
    
    if ! command_exists lsof; then
        return 1  # Can't determine, assume not PAI
    fi
    
    # Get the process using the port
    local pid=$(lsof -ti:$port 2>/dev/null | head -1)
    if [[ -z "$pid" ]]; then
        return 1  # No process found
    fi
    
    # Check what process is running
    local cmd=$(ps -p $pid -o comm= 2>/dev/null || echo "")
    local args=$(ps -p $pid -o args= 2>/dev/null || echo "")
    
    case $port in
        3000)
            # Backend port - check if it's our Node.js backend
            if [[ "$cmd" == "node" ]] && [[ "$args" == *"app.js"* || "$args" == *"src/app.js"* ]]; then
                return 0  # It's PAI backend
            fi
            ;;
        3001)
            # Frontend port - check if it's our Node.js dev server
            if [[ "$cmd" == "node" ]] && [[ "$args" == *"vite"* || "$args" == *"dev"* || "$args" == *"client"* || "$args" == *"/client/"* ]]; then
                return 0  # It's PAI frontend
            fi
            ;;
        8080|5432|6379)
            # Docker services - check if it's our Docker containers
            if command_exists docker; then
                case $port in
                    8080)
                        if docker ps --format "table {{.Names}}" | grep -E "(evolution_api|evolution-api)"; then
                            return 0  # It's PAI Evolution API
                        fi
                        ;;
                    5432)
                        if docker ps --format "table {{.Names}}" | grep -E "(evolution-postgres|postgres_evolution)"; then
                            return 0  # It's PAI PostgreSQL
                        fi
                        ;;
                    6379)
                        if docker ps --format "table {{.Names}}" | grep -E "(evolution-redis|redis_evolution)"; then
                            return 0  # It's PAI Redis
                        fi
                        ;;
                esac
            fi
            ;;
    esac
    
    return 1  # Not a PAI service
}

# Get service description for a port
get_port_service_description() {
    local port=$1
    case $port in
        3000) echo "PAI Backend" ;;
        3001) echo "PAI Frontend" ;;
        8080) echo "Evolution API" ;;
        5432) echo "PostgreSQL" ;;
        6379) echo "Redis" ;;
        *) echo "Unknown Service" ;;
    esac
}

# Simple version check - just check major version
check_node_version() {
    local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
    local min_major=18
    
    if [[ $current_version -ge $min_major ]]; then
        log_success "Node.js version $(node --version) is compatible (>= v18)"
        return 0
    else
        log_error "Node.js version $(node --version) is too old. Minimum required: v18"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Main checks
log_header "PAI System - Dependency Verification"
log_info "Starting dependency verification..."

# 1. Check Node.js
log_header "Node.js Environment"
if command_exists node; then
    check_node_version
else
    log_error "Node.js not found. Please install Node.js 18.0.0 or higher"
    log_error "Download from: https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# 2. Check npm
if command_exists npm; then
    npm_version=$(npm --version)
    log_success "npm version $npm_version is available"
else
    log_error "npm not found. npm should be installed with Node.js"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check Docker
log_header "Docker Environment"
if command_exists docker; then
    if docker info >/dev/null 2>&1; then
        docker_version=$(docker --version | sed 's/Docker version //' | sed 's/,.*//')
        log_success "Docker $docker_version is running"
    else
        log_error "Docker is installed but not running. Please start Docker Desktop"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_error "Docker not found. Please install Docker Desktop"
    log_error "Download from: https://www.docker.com/products/docker-desktop"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check Docker Compose
if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
    log_success "Docker Compose is available"
else
    log_error "Docker Compose not found. Please install docker-compose"
    ERRORS=$((ERRORS + 1))
fi

# 5. Check required ports
log_header "Port Availability"
PAI_SERVICES_RUNNING=0
for port in $REQUIRED_PORTS; do
    if port_available $port; then
        log_success "Port $port is available"
    else
        service_desc=$(get_port_service_description $port)
        if port_used_by_pai_service $port; then
            log_warning "Port $port is in use by PAI $service_desc (already running)"
            PAI_SERVICES_RUNNING=$((PAI_SERVICES_RUNNING + 1))
        else
            log_error "Port $port is in use by non-PAI service (required for $service_desc)"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Summary of PAI services status
if [[ $PAI_SERVICES_RUNNING -gt 0 ]]; then
    echo
    log_info "Detected $PAI_SERVICES_RUNNING PAI service(s) already running"
    log_info "These can be reused or restarted by the launch script"
fi

# 6. Check configuration files
log_header "Configuration Files"
if [[ -f ".env" ]]; then
    log_success ".env file found"
    
    # Check critical environment variables
    if grep -q "OPENAI_API_KEY=" .env && ! grep -q "OPENAI_API_KEY=$" .env; then
        log_success "OPENAI_API_KEY is configured"
    else
        log_warning "OPENAI_API_KEY not found in .env file"
        WARNINGS=$((WARNINGS + 1))
    fi
elif [[ -f ".env.example" ]]; then
    log_warning ".env file not found, but .env.example exists"
    log_info "You can copy .env.example to .env and configure it"
    WARNINGS=$((WARNINGS + 1))
else
    log_warning "Neither .env nor .env.example found"
    WARNINGS=$((WARNINGS + 1))
fi

# 7. Check package.json files
if [[ -f "package.json" ]]; then
    log_success "Backend package.json found"
else
    log_error "Backend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

if [[ -f "client/package.json" ]]; then
    log_success "Frontend package.json found"
else
    log_error "Frontend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

# Final summary
log_header "Verification Summary"

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    log_success "✅ All checks passed! System is ready for launch"
    echo -e "\n${GREEN}${BOLD}🚀 You can now run './launch-pai.sh' to start the system${NC}\n"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    log_success "✅ All critical checks passed"
    log_warning "⚠️  Found $WARNINGS warnings (system should still work)"
    echo -e "\n${YELLOW}${BOLD}🚀 You can run './launch-pai.sh' but consider addressing warnings${NC}\n"
    exit 0
else
    log_error "❌ Found $ERRORS critical errors and $WARNINGS warnings"
    echo -e "\n${RED}${BOLD}Please fix the errors above before launching the system${NC}\n"
    
    echo -e "${BOLD}Common solutions:${NC}"
    echo "• Install Node.js 18+: https://nodejs.org/"
    echo "• Install Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "• Stop services using required ports"
    echo "• Run 'npm install' and 'cd client && npm install'"
    echo "• Configure .env file with your API keys"
    
    exit 1
fi