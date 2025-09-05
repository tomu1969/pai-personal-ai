#!/bin/bash
# PAI System - Dependency Verification Script
# Verifies all required dependencies and system requirements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

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

# Global variables
ERRORS=0
WARNINGS=0
REQUIRED_PORTS=(3000 3001 8080 5432 6379)

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if port is available
port_available() {
    local port=$1
    if command_exists lsof; then
        ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
    elif command_exists netstat; then
        ! netstat -tuln | grep -q ":$port "
    else
        # Fallback: try to bind to port
        (echo >/dev/tcp/localhost/$port) >/dev/null 2>&1
        return $?
    fi
}

# Version comparison
version_compare() {
    if [[ $1 == $2 ]]; then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    # Fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            # Fill empty fields in ver2 with zeros
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

check_node_version() {
    local min_version="18.0.0"
    local current_version=$(node --version | sed 's/v//')
    
    version_compare $current_version $min_version
    local result=$?
    
    if [[ $result -eq 2 ]]; then
        log_error "Node.js version $current_version is too old. Minimum required: $min_version"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        log_success "Node.js version $current_version is compatible"
        return 0
    fi
}

check_npm_version() {
    local min_version="8.0.0"
    local current_version=$(npm --version)
    
    version_compare $current_version $min_version
    local result=$?
    
    if [[ $result -eq 2 ]]; then
        log_warning "npm version $current_version is old. Recommended: $min_version+"
        WARNINGS=$((WARNINGS + 1))
    else
        log_success "npm version $current_version is compatible"
    fi
}

# Main dependency checks
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
    check_npm_version
else
    log_error "npm not found. npm should be installed with Node.js"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check Docker
log_header "Docker Environment"
if command_exists docker; then
    if docker info >/dev/null 2>&1; then
        local docker_version=$(docker --version | sed 's/Docker version //' | sed 's/,.*//')
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
    local compose_version=""
    if command_exists docker-compose; then
        compose_version=$(docker-compose --version | sed 's/.*version //' | sed 's/,.*//')
        log_success "Docker Compose $compose_version is available"
    else
        compose_version=$(docker compose version --short 2>/dev/null || echo "built-in")
        log_success "Docker Compose $compose_version (built-in) is available"
    fi
else
    log_error "Docker Compose not found. Please install docker-compose"
    ERRORS=$((ERRORS + 1))
fi

# 5. Check Git (optional but recommended)
if command_exists git; then
    local git_version=$(git --version | sed 's/git version //')
    log_success "Git $git_version is available"
else
    log_warning "Git not found. Recommended for development"
    WARNINGS=$((WARNINGS + 1))
fi

# 6. Check required ports
log_header "Port Availability"
for port in "${REQUIRED_PORTS[@]}"; do
    if port_available $port; then
        log_success "Port $port is available"
    else
        case $port in
            3000) log_error "Port $port is in use (required for PAI Backend)" ;;
            3001) log_error "Port $port is in use (required for PAI Frontend)" ;;
            8080) log_error "Port $port is in use (required for Evolution API)" ;;
            5432) log_error "Port $port is in use (required for PostgreSQL)" ;;
            6379) log_error "Port $port is in use (required for Redis)" ;;
        esac
        ERRORS=$((ERRORS + 1))
    fi
done

# 7. Check disk space
log_header "System Resources"
if command_exists df; then
    local available_space=$(df -h . | awk 'NR==2 {print $4}' | sed 's/[^0-9.]//g')
    local available_gb=$(echo "$available_space" | head -c -1)
    
    if (( $(echo "$available_gb >= 2" | bc -l 2>/dev/null || echo "1") )); then
        log_success "Sufficient disk space available (${available_space}GB)"
    else
        log_warning "Low disk space: ${available_space}GB available. Recommended: 2GB+"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_warning "Cannot check disk space (df command not available)"
    WARNINGS=$((WARNINGS + 1))
fi

# 8. Check memory
if command_exists free; then
    local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7/1024}')
    if [[ $available_mem -ge 2 ]]; then
        log_success "Sufficient memory available (${available_mem}GB free)"
    else
        log_warning "Low memory: ${available_mem}GB available. Recommended: 2GB+"
        WARNINGS=$((WARNINGS + 1))
    fi
elif command_exists vm_stat; then
    # macOS
    local free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
    local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
    local free_mb=$((free_pages * page_size / 1024 / 1024))
    local free_gb=$((free_mb / 1024))
    
    if [[ $free_gb -ge 2 ]]; then
        log_success "Sufficient memory available (~${free_gb}GB free)"
    else
        log_warning "Low memory: ~${free_gb}GB available. Recommended: 2GB+"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_warning "Cannot check memory usage"
    WARNINGS=$((WARNINGS + 1))
fi

# 9. Check environment files
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
    
    if grep -q "DATABASE_URL=" .env; then
        log_success "DATABASE_URL is configured"
    else
        log_warning "DATABASE_URL not found in .env file"
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

# 10. Check package.json files
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

# 11. Check node_modules
if [[ -d "node_modules" ]]; then
    log_success "Backend dependencies appear to be installed"
else
    log_warning "Backend node_modules not found. Run 'npm install'"
    WARNINGS=$((WARNINGS + 1))
fi

if [[ -d "client/node_modules" ]]; then
    log_success "Frontend dependencies appear to be installed"
else
    log_warning "Frontend node_modules not found. Run 'cd client && npm install'"
    WARNINGS=$((WARNINGS + 1))
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
    
    if [[ $ERRORS -gt 0 ]]; then
        echo -e "${BOLD}Common solutions:${NC}"
        echo "• Install Node.js 18+: https://nodejs.org/"
        echo "• Install Docker Desktop: https://www.docker.com/products/docker-desktop"
        echo "• Stop services using required ports"
        echo "• Run 'npm install' and 'cd client && npm install'"
        echo "• Configure .env file with your API keys"
    fi
    
    exit 1
fi