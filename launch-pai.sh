#!/bin/bash
# PAI System - Unified Launch Script
# Launches the complete PAI Assistant system with comprehensive logging and error handling

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_DIR="$PROJECT_ROOT/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Global variables (compatible with older bash)
CLEANUP_DONE=false
STARTED_SERVICES=""

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Main log file
MAIN_LOG="$LOG_DIR/launch_${TIMESTAMP}.log"
exec 1> >(tee -a "$MAIN_LOG")
exec 2> >(tee -a "$MAIN_LOG" >&2)

# Logging functions with both console and file output
log_timestamp() {
    echo -n "[$(date '+%Y-%m-%d %H:%M:%S')]"
}

log_info() {
    echo -e "${CYAN}$(log_timestamp) [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}$(log_timestamp) [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}$(log_timestamp) [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}$(log_timestamp) [ERROR]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${MAGENTA}$(log_timestamp) [DEBUG]${NC} $1"
    fi
}

log_header() {
    echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}\n"
    echo "$(log_timestamp) === $1 ===" >> "$MAIN_LOG"
}

log_step() {
    echo -e "${BOLD}${CYAN}📋 Step $1:${NC} $2"
}

# Error handling and cleanup
cleanup() {
    if [[ "$CLEANUP_DONE" == "true" ]]; then
        return
    fi
    
    CLEANUP_DONE=true
    log_header "🛑 Shutting Down Services"
    
    # Kill background processes using PID files
    if [[ -f "$LOG_DIR/backend.pid" ]]; then
        local pid=$(cat "$LOG_DIR/backend.pid")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping backend (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 3
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$LOG_DIR/backend.pid"
    fi
    
    if [[ -f "$LOG_DIR/frontend.pid" ]]; then
        local pid=$(cat "$LOG_DIR/frontend.pid")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping frontend (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 3
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$LOG_DIR/frontend.pid"
    fi
    
    # Stop Docker services if they were started
    if echo "$STARTED_SERVICES" | grep -q "docker"; then
        log_info "Stopping Docker services..."
        cd "$PROJECT_ROOT/docker/evolution"
        docker-compose down --remove-orphans 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Setup signal handlers
trap cleanup EXIT INT TERM

# Enhanced error handler
error_handler() {
    local line_no=$1
    local bash_lineno=$2
    local last_command=$3
    local exit_code=$4
    
    log_error "❌ Script failed at line $line_no: '$last_command' (exit code: $exit_code)"
    log_error "Call stack:"
    local frame=0
    while caller $frame; do
        ((frame++))
    done
    
    echo -e "\n${RED}${BOLD}🚨 LAUNCH FAILED 🚨${NC}"
    echo -e "${RED}Check the log file for details: ${MAIN_LOG}${NC}"
    echo -e "${RED}You can also run individual checks:${NC}"
    echo -e "${RED}  • ./scripts/check-dependencies.sh${NC}"
    echo -e "${RED}  • ./scripts/service-monitor.sh${NC}"
    
    exit $exit_code
}

# Only set error handler if not already set
if [[ -z "$ERROR_HANDLER_SET" ]]; then
    set -eE
    trap 'error_handler ${LINENO} $BASH_LINENO "$BASH_COMMAND" $?' ERR
    export ERROR_HANDLER_SET=true
fi

# Utility functions
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

wait_for_port() {
    local port=$1
    local timeout=${2:-60}
    local count=0
    
    log_debug "Waiting for port $port to be available..."
    
    while ! nc -z localhost "$port" 2>/dev/null && ! (exec 6<>/dev/tcp/localhost/$port) 2>/dev/null; do
        sleep 2
        count=$((count + 2))
        if [[ $count -ge $timeout ]]; then
            log_error "Timeout waiting for port $port"
            return 1
        fi
        
        if [[ $((count % 10)) -eq 0 ]]; then
            log_debug "Still waiting for port $port... (${count}s)"
        fi
    done
    
    log_debug "Port $port is now available"
    return 0
}

# Check if service is already running
check_existing_services() {
    log_step "🔍" "Checking for existing services"
    
    local conflicts=0
    
    # Check for running processes on required ports
    local ports=(3000 3001 8080 5432 6379)
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            local pid=$(lsof -ti:$port)
            local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            log_warning "Port $port is already in use by process $process_name (PID: $pid)"
            conflicts=$((conflicts + 1))
        fi
    done
    
    if [[ $conflicts -gt 0 ]]; then
        echo -e "\n${YELLOW}Found $conflicts port conflicts. Options:${NC}"
        echo "1. Stop conflicting services and rerun this script"
        echo "2. Continue anyway (may cause issues)"
        echo "3. Exit and resolve conflicts manually"
        echo
        read -p "Choose option [1-3]: " choice
        
        case $choice in
            1)
                log_info "Please stop the conflicting services and rerun this script"
                exit 0
                ;;
            2)
                log_warning "Continuing with port conflicts..."
                ;;
            3|*)
                log_info "Exiting to resolve conflicts manually"
                exit 0
                ;;
        esac
    else
        log_success "No port conflicts detected"
    fi
}

# Load and validate environment
setup_environment() {
    log_step "🔧" "Setting up environment"
    
    # Load environment file
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        log_info "Loading environment from .env file"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
        log_success "Environment loaded from .env"
    elif [[ -f "$PROJECT_ROOT/.env.example" ]]; then
        log_warning ".env file not found, copying from .env.example"
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        log_info "Please edit .env file with your configuration"
        
        # Check if OPENAI_API_KEY is set in environment
        if [[ -z "${OPENAI_API_KEY:-}" ]]; then
            echo -e "\n${YELLOW}⚠️  OPENAI_API_KEY not found!${NC}"
            echo "Please either:"
            echo "1. Set it in your environment: export OPENAI_API_KEY='your-key-here'"
            echo "2. Add it to the .env file"
            echo
            read -p "Do you want to continue without OpenAI? [y/N]: " continue_without_openai
            if [[ ! "$continue_without_openai" =~ ^[Yy]$ ]]; then
                log_info "Please configure OpenAI API key and rerun the script"
                exit 0
            fi
        fi
    else
        log_warning "No environment file found, using defaults"
    fi
    
    # Set default values
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${PORT:-3000}
    export HOST=${HOST:-localhost}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    log_success "Environment setup completed"
}

# Install dependencies if needed
install_dependencies() {
    log_step "📦" "Installing dependencies"
    
    # Backend dependencies
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]] || [[ "$PROJECT_ROOT/package.json" -nt "$PROJECT_ROOT/node_modules" ]]; then
        log_info "Installing backend dependencies..."
        cd "$PROJECT_ROOT"
        npm install --silent
        log_success "Backend dependencies installed"
    else
        log_debug "Backend dependencies are up to date"
    fi
    
    # Frontend dependencies
    if [[ ! -d "$PROJECT_ROOT/client/node_modules" ]] || [[ "$PROJECT_ROOT/client/package.json" -nt "$PROJECT_ROOT/client/node_modules" ]]; then
        log_info "Installing frontend dependencies..."
        cd "$PROJECT_ROOT/client"
        npm install --silent
        log_success "Frontend dependencies installed"
    else
        log_debug "Frontend dependencies are up to date"
    fi
    
    cd "$PROJECT_ROOT"
}

# Start Docker services (Evolution API, PostgreSQL, Redis)
start_docker_services() {
    log_step "🐳" "Starting Docker services"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop first"
        exit 1
    fi
    
    cd "$PROJECT_ROOT/docker/evolution"
    
    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        log_info "Creating Docker environment file..."
        cat > .env << EOF
POSTGRES_PASSWORD=evolution123
REDIS_PASSWORD=redis123
EVOLUTION_API_KEY=pai_evolution_api_key_2025
NODE_ENV=production
LOG_LEVEL=error
EOF
    fi
    
    log_info "Starting Evolution API stack..."
    SERVICE_LOGS["docker"]="$LOG_DIR/docker_${TIMESTAMP}.log"
    
    # Start Docker services in background
    docker-compose up -d 2>&1 | tee "${SERVICE_LOGS["docker"]}" &
    
    # Wait for services to be ready
    log_info "Waiting for PostgreSQL..."
    wait_for_port 5432 60
    
    log_info "Waiting for Redis..."  
    wait_for_port 6379 60
    
    log_info "Waiting for Evolution API..."
    wait_for_port 8080 120
    
    # Verify services are healthy using monitor script
    if [[ -x "$PROJECT_ROOT/scripts/service-monitor.sh" ]]; then
        log_info "Verifying Docker services health..."
        if "$PROJECT_ROOT/scripts/service-monitor.sh" wait postgres redis evolution; then
            log_success "All Docker services are healthy"
        else
            log_warning "Some Docker services may not be fully ready"
        fi
    fi
    
    STARTED_SERVICES="$STARTED_SERVICES docker"
    log_success "Docker services started"
    
    cd "$PROJECT_ROOT"
}

# Start backend server
start_backend() {
    log_step "⚙️" "Starting PAI Backend"
    
    cd "$PROJECT_ROOT"
    
    # Set up backend log file
    local backend_log="$LOG_DIR/backend_${TIMESTAMP}.log"
    
    # Start backend server
    log_info "Starting backend server on port ${PORT:-3000}..."
    npm start > "$backend_log" 2>&1 &
    local backend_pid=$!
    echo "$backend_pid" > "$LOG_DIR/backend.pid"
    
    # Wait for backend to be ready
    log_info "Waiting for backend to start..."
    if wait_for_port "${PORT:-3000}" 60; then
        # Verify health endpoint
        local retries=0
        while [[ $retries -lt 30 ]]; do
            if curl -sf "http://localhost:${PORT:-3000}/health" >/dev/null 2>&1; then
                log_success "Backend is healthy and responding"
                break
            fi
            sleep 2
            retries=$((retries + 1))
        done
        
        if [[ $retries -eq 30 ]]; then
            log_warning "Backend started but health check failed"
        fi
    else
        log_error "Backend failed to start"
        return 1
    fi
    
    STARTED_SERVICES="$STARTED_SERVICES backend"
    log_success "PAI Backend started (PID: $backend_pid)"
}

# Start frontend development server
start_frontend() {
    log_step "🎨" "Starting PAI Frontend"
    
    cd "$PROJECT_ROOT/client"
    
    # Set up frontend log file
    local frontend_log="$LOG_DIR/frontend_${TIMESTAMP}.log"
    
    # Get frontend port from vite config
    local frontend_port=3001
    if [[ -f "vite.config.ts" ]]; then
        frontend_port=$(grep -E "port:\s*[0-9]+" vite.config.ts | sed 's/.*port:\s*\([0-9]*\).*/\1/' || echo "3001")
    fi
    
    # Start frontend development server
    log_info "Starting frontend server on port $frontend_port..."
    npm run dev > "$frontend_log" 2>&1 &
    local frontend_pid=$!
    echo "$frontend_pid" > "$LOG_DIR/frontend.pid"
    
    # Wait for frontend to be ready
    log_info "Waiting for frontend to start..."
    if wait_for_port "$frontend_port" 60; then
        # Verify frontend is serving content
        local retries=0
        while [[ $retries -lt 15 ]]; do
            if curl -sf "http://localhost:$frontend_port" >/dev/null 2>&1; then
                log_success "Frontend is serving content"
                break
            fi
            sleep 2
            retries=$((retries + 1))
        done
        
        if [[ $retries -eq 15 ]]; then
            log_warning "Frontend started but content check failed"
        fi
    else
        log_error "Frontend failed to start"
        return 1
    fi
    
    STARTED_SERVICES="$STARTED_SERVICES frontend"
    log_success "PAI Frontend started (PID: $frontend_pid)"
    
    cd "$PROJECT_ROOT"
}

# Perform post-startup validation
post_startup_validation() {
    log_step "✅" "Validating system health"
    
    # Use service monitor for comprehensive health check
    if [[ -x "$PROJECT_ROOT/scripts/service-monitor.sh" ]]; then
        log_info "Running comprehensive health check..."
        if "$PROJECT_ROOT/scripts/service-monitor.sh" monitor; then
            log_success "All services passed health check"
        else
            log_warning "Some services may have issues (check service monitor output above)"
        fi
    fi
    
    # Test critical endpoints
    local endpoints=(
        "http://localhost:3000/health,Backend Health"
        "http://localhost:3001,Frontend"
        "http://localhost:8080,Evolution API"
        "http://localhost:3000/api/whatsapp/status,WhatsApp API"
        "http://localhost:3000/api/assistant/config,Assistant API"
    )
    
    log_info "Testing critical endpoints..."
    local failed_endpoints=0
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS=',' read -r endpoint name <<< "$endpoint_info"
        if curl -sf "$endpoint" >/dev/null 2>&1; then
            log_success "$name: ✅"
        else
            log_error "$name: ❌ Not responding"
            failed_endpoints=$((failed_endpoints + 1))
        fi
    done
    
    if [[ $failed_endpoints -eq 0 ]]; then
        log_success "All endpoints are responding"
    else
        log_warning "$failed_endpoints endpoint(s) are not responding"
    fi
}

# Display success information and next steps
show_success_info() {
    log_header "🎉 PAI System Launch Successful!"
    
    echo -e "${GREEN}${BOLD}✅ All services are running successfully!${NC}\n"
    
    echo -e "${BOLD}🌐 Service URLs:${NC}"
    echo "  • 📱 Main Interface:      http://localhost:3001"
    echo "  • 🔧 Backend API:         http://localhost:3000"
    echo "  • 📊 API Health Check:    http://localhost:3000/health"
    echo "  • 🤖 Evolution API:       http://localhost:8080"
    echo
    
    echo -e "${BOLD}📱 WhatsApp Setup:${NC}"
    echo "  • 🔗 PAI Responder QR:    http://localhost:3000/qr-responder"
    echo "  • 🔍 PAI Assistant QR:    http://localhost:3000/qr-assistant"
    echo
    
    echo -e "${BOLD}📋 Next Steps:${NC}"
    echo "  1. 📱 Open the main interface: http://localhost:3001"
    echo "  2. ⚙️  Configure assistant settings (click gear icon)"
    echo "  3. 📲 Scan QR codes to connect WhatsApp devices"
    echo "  4. 💬 Test by sending messages to your WhatsApp numbers"
    echo
    
    echo -e "${BOLD}🛠️  Management:${NC}"
    echo "  • 📊 Monitor services:    ./scripts/service-monitor.sh"
    echo "  • 📝 View logs:          ls -la $LOG_DIR/"
    echo "  • 🛑 Stop system:        Press Ctrl+C"
    echo
    
    echo -e "${BOLD}📁 Log Files:${NC}"
    echo "  • 📋 Main log:           $MAIN_LOG"
    echo "  • 📝 Backend logs:       $LOG_DIR/backend_${TIMESTAMP}.log"
    echo "  • 📝 Frontend logs:      $LOG_DIR/frontend_${TIMESTAMP}.log"
    echo "  • 📝 Docker logs:        $LOG_DIR/docker_${TIMESTAMP}.log"
    echo
    
    # Show running processes
    echo -e "${BOLD}🔄 Running Processes:${NC}"
    if [[ -f "$LOG_DIR/backend.pid" ]]; then
        local backend_pid=$(cat "$LOG_DIR/backend.pid")
        if kill -0 "$backend_pid" 2>/dev/null; then
            echo "  • Backend: PID $backend_pid ✅"
        else
            echo "  • Backend: PID $backend_pid ❌ (not running)"
        fi
    fi
    
    if [[ -f "$LOG_DIR/frontend.pid" ]]; then
        local frontend_pid=$(cat "$LOG_DIR/frontend.pid")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            echo "  • Frontend: PID $frontend_pid ✅"
        else
            echo "  • Frontend: PID $frontend_pid ❌ (not running)"
        fi
    fi
    echo
    
    log_success "PAI System is ready for use! 🚀"
    log_info "Press Ctrl+C to stop all services gracefully"
}

# Wait for user interrupt
wait_for_interrupt() {
    echo -e "${CYAN}System is running... Press Ctrl+C to stop${NC}"
    
    # Keep script running and monitor services
    while true; do
        sleep 10
        
        # Check if critical processes are still running
        local failed_services=""
        if [[ -f "$LOG_DIR/backend.pid" ]]; then
            local backend_pid=$(cat "$LOG_DIR/backend.pid")
            if ! kill -0 "$backend_pid" 2>/dev/null; then
                failed_services="$failed_services backend"
                log_error "Backend process (PID $backend_pid) has stopped unexpectedly"
            fi
        fi
        
        if [[ -f "$LOG_DIR/frontend.pid" ]]; then
            local frontend_pid=$(cat "$LOG_DIR/frontend.pid")
            if ! kill -0 "$frontend_pid" 2>/dev/null; then
                failed_services="$failed_services frontend"
                log_error "Frontend process (PID $frontend_pid) has stopped unexpectedly"
            fi
        fi
        
        if [[ -n "$failed_services" ]]; then
            log_error "Some services have failed: $failed_services"
            log_info "Check log files in $LOG_DIR/ for details"
            break
        fi
    done
}

# Main execution flow
main() {
    # Clear screen and show header
    clear
    log_header "🚀 PAI System - Unified Launch Script"
    
    log_info "Starting PAI System launch sequence..."
    log_info "Logs will be saved to: $MAIN_LOG"
    echo
    
    # Run dependency verification first
    log_step "🔍" "Running dependency verification"
    if [[ -x "$PROJECT_ROOT/scripts/check-dependencies.sh" ]]; then
        if "$PROJECT_ROOT/scripts/check-dependencies.sh"; then
            log_success "Dependency verification passed"
        else
            log_error "Dependency verification failed"
            log_info "Please run './scripts/check-dependencies.sh' separately for details"
            exit 1
        fi
    else
        log_warning "Dependency verification script not found, skipping..."
    fi
    
    # Execute launch sequence
    check_existing_services
    setup_environment
    install_dependencies
    start_docker_services
    start_backend
    start_frontend
    post_startup_validation
    
    # Show success information
    show_success_info
    
    # Keep running until interrupted
    wait_for_interrupt
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "PAI System - Unified Launch Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  help, -h, --help    Show this help message"
        echo "  --debug             Enable debug logging"
        echo "  --no-deps           Skip dependency installation"
        echo "  --check-only        Run dependency check only"
        echo ""
        echo "Environment variables:"
        echo "  DEBUG=true          Enable debug output"
        echo "  SKIP_DEPS=true      Skip dependency installation"
        echo ""
        echo "This script will:"
        echo "  1. Verify system dependencies"
        echo "  2. Start Docker services (Evolution API, PostgreSQL, Redis)"
        echo "  3. Start PAI backend server"
        echo "  4. Start PAI frontend development server"
        echo "  5. Perform health checks"
        echo "  6. Display access URLs and next steps"
        echo ""
        exit 0
        ;;
    "--debug")
        export DEBUG=true
        shift
        ;;
    "--no-deps")
        export SKIP_DEPS=true
        shift
        ;;
    "--check-only")
        if [[ -x "$PROJECT_ROOT/scripts/check-dependencies.sh" ]]; then
            exec "$PROJECT_ROOT/scripts/check-dependencies.sh"
        else
            echo "Dependency check script not found"
            exit 1
        fi
        ;;
esac

# Ensure we're in the correct directory
cd "$PROJECT_ROOT"

# Run main function
main "$@"