#!/bin/bash
# PAI Mortgage System - Complete Health-Checked Startup
# Single command to start the entire PAI Mortgage system with comprehensive health checks

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="$LOG_DIR/startup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
EVOLUTION_API_KEY="pai_evolution_api_key_2025"
PAI_MORTGAGE_INSTANCE="pai-mortgage-fresh"
DRY_RUN=false
FORCE_RESTART=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force-restart)
            FORCE_RESTART=true
            shift
            ;;
        --help)
            echo "PAI Mortgage System Startup Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run        Run health checks only, don't start services"
            echo "  --force-restart  Kill existing processes and restart"
            echo "  --help          Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging functions
log_timestamp() {
    echo -n "[$(date '+%Y-%m-%d %H:%M:%S')]"
}

log_info() {
    echo -e "${CYAN}$(log_timestamp) [INFO]${NC} $1" | tee -a "$MAIN_LOG"
}

log_success() {
    echo -e "${GREEN}$(log_timestamp) [SUCCESS]${NC} $1" | tee -a "$MAIN_LOG"
}

log_warning() {
    echo -e "${YELLOW}$(log_timestamp) [WARNING]${NC} $1" | tee -a "$MAIN_LOG"
}

log_error() {
    echo -e "${RED}$(log_timestamp) [ERROR]${NC} $1" | tee -a "$MAIN_LOG"
}

log_section() {
    echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}" | tee -a "$MAIN_LOG"
}

# Health check functions
check_docker_services() {
    log_info "Checking Docker services..."
    
    # Check Evolution API
    if curl -s -H "apikey: $EVOLUTION_API_KEY" http://localhost:8080/health >/dev/null 2>&1; then
        log_success "Evolution API: Running"
    else
        log_error "Evolution API: Not responding"
        return 1
    fi
    
    # Check PostgreSQL
    if docker exec evolution-postgres pg_isready >/dev/null 2>&1; then
        log_success "PostgreSQL: Active"
    else
        log_error "PostgreSQL: Not responding"
        return 1
    fi
    
    # Check Redis
    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis: Ready"
    else
        log_warning "Redis: Not responding (may not be required)"
    fi
    
    return 0
}

check_pai_mortgage_instance() {
    log_info "Checking PAI Mortgage instance..."
    
    # Check connection status
    local response=$(curl -s -H "apikey: $EVOLUTION_API_KEY" \
        "http://localhost:8080/instance/connectionState/$PAI_MORTGAGE_INSTANCE")
    
    local status=$(echo "$response" | jq -r '.instance.state // "unknown"' 2>/dev/null)
    
    if [ "$status" = "open" ]; then
        log_success "PAI Mortgage: Connected ($PAI_MORTGAGE_INSTANCE)"
    else
        log_error "PAI Mortgage: Not connected (status: $status)"
        return 1
    fi
    
    # Check webhook configuration
    local webhook_response=$(curl -s -H "apikey: $EVOLUTION_API_KEY" \
        "http://localhost:8080/webhook/find/$PAI_MORTGAGE_INSTANCE")
    
    local webhook_events=$(echo "$webhook_response" | jq -r '.webhookByEvents // false' 2>/dev/null)
    
    if [ "$webhook_events" = "true" ]; then
        log_success "Webhook Config: Properly configured (webhookByEvents: true)"
    else
        log_error "Webhook Config: Not properly configured"
        return 1
    fi
    
    return 0
}

check_openai_api() {
    log_info "Checking OpenAI API configuration..."
    
    # Load .env file and check OpenAI key (unset environment override first)
    cd "$PROJECT_ROOT"
    local openai_check=$(unset OPENAI_API_KEY && node -e "
        require('dotenv').config();
        const key = process.env.OPENAI_API_KEY;
        if (!key || key.includes('your-api')) {
            console.log('INVALID');
            process.exit(1);
        }
        console.log('VALID');
    " 2>/dev/null)
    
    if [ "$openai_check" = "VALID" ]; then
        log_success "OpenAI API: Key configured correctly"
    else
        log_error "OpenAI API: Invalid or missing key in .env"
        return 1
    fi
    
    return 0
}

check_backend_health() {
    log_info "Checking backend service..."
    
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Backend: Running on port 3000"
    else
        log_warning "Backend: Not running (will be started)"
        return 1
    fi
    
    return 0
}

stop_existing_services() {
    log_info "Stopping existing services..."
    
    # Stop Node.js processes
    local node_pids=$(ps aux | grep -E 'node.*app\.js|npm.*start' | grep -v grep | awk '{print $2}')
    if [ -n "$node_pids" ]; then
        echo "$node_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        echo "$node_pids" | xargs kill -KILL 2>/dev/null || true
        log_info "Stopped existing Node.js processes"
    fi
}

start_backend() {
    log_info "Starting backend service..."
    
    cd "$PROJECT_ROOT"
    
    # Ensure correct environment
    unset OPENAI_API_KEY  # Clear any shell override
    
    # Start with proper logging
    npm start > "$LOG_DIR/backend_${TIMESTAMP}.log" 2>&1 &
    local backend_pid=$!
    
    # Wait for backend to start
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Backend: Started successfully (PID: $backend_pid)"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    log_error "Backend: Failed to start within 30 seconds"
    return 1
}

test_message_flow() {
    log_info "Testing message flow..."
    
    # Send test message to PAI Mortgage webhook
    local test_response=$(curl -s -X POST http://localhost:3000/webhook/messages-upsert \
        -H "Content-Type: application/json" \
        -d '{
            "event": "messages.upsert",
            "instance": "pai-mortgage-fresh",
            "data": {
                "key": {"remoteJid": "test@s.whatsapp.net", "fromMe": false, "id": "HEALTH_CHECK"},
                "message": {"conversation": "health check"},
                "pushName": "Health Check",
                "messageType": "conversation"
            }
        }')
    
    local test_status=$(echo "$test_response" | jq -r '.success // false' 2>/dev/null)
    local test_instance=$(echo "$test_response" | jq -r '.instance // "unknown"' 2>/dev/null)
    
    if [ "$test_status" = "true" ] && [ "$test_instance" = "pai-mortgage" ]; then
        log_success "Message Routing: PAI Mortgage handler active"
    else
        log_error "Message Routing: Failed (response: $test_response)"
        return 1
    fi
    
    return 0
}

display_dashboard() {
    echo ""
    echo -e "${BOLD}${GREEN}🏥 PAI Mortgage System Health Dashboard${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get current status
    local docker_status="❌"
    local pai_status="❌"
    local openai_status="❌"
    local backend_status="❌"
    local routing_status="❌"
    
    if check_docker_services >/dev/null 2>&1; then docker_status="✅"; fi
    if check_pai_mortgage_instance >/dev/null 2>&1; then pai_status="✅"; fi
    if check_openai_api >/dev/null 2>&1; then openai_status="✅"; fi
    if check_backend_health >/dev/null 2>&1; then backend_status="✅"; fi
    if test_message_flow >/dev/null 2>&1; then routing_status="✅"; fi
    
    echo -e "$docker_status Docker Services:     Evolution API + PostgreSQL"
    echo -e "$pai_status PAI Mortgage:        Connected (+57 318 260 1111)"
    echo -e "$openai_status OpenAI API:         Valid API Key"
    echo -e "$backend_status Backend Service:    Running on port 3000"
    echo -e "$routing_status Message Routing:    PAI Mortgage Handler Active"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$docker_status$pai_status$openai_status$backend_status$routing_status" = "✅✅✅✅✅" ]; then
        echo -e "${BOLD}${GREEN}🎉 System Ready! Send WhatsApp messages to test.${NC}"
        echo -e "${CYAN}   Logs: $MAIN_LOG${NC}"
        return 0
    else
        echo -e "${BOLD}${RED}⚠️  System has issues. Check logs for details.${NC}"
        return 1
    fi
}

main() {
    echo -e "${BOLD}${MAGENTA}PAI Mortgage System Startup${NC}"
    echo -e "${CYAN}Timestamp: $(date)${NC}"
    echo -e "${CYAN}Log file: $MAIN_LOG${NC}"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}Running in DRY RUN mode - no services will be started${NC}"
    fi
    
    # Phase 1: System Health Check
    log_section "Phase 1: System Health Check"
    
    local health_failed=false
    
    if ! check_docker_services; then
        health_failed=true
    fi
    
    if ! check_pai_mortgage_instance; then
        health_failed=true
    fi
    
    if ! check_openai_api; then
        health_failed=true
    fi
    
    if [ "$health_failed" = true ]; then
        log_error "Critical health checks failed. Cannot proceed."
        exit 1
    fi
    
    # Phase 2: Backend Management
    log_section "Phase 2: Backend Service"
    
    if [ "$DRY_RUN" = false ]; then
        if [ "$FORCE_RESTART" = true ] || ! check_backend_health; then
            if [ "$FORCE_RESTART" = true ]; then
                stop_existing_services
            fi
            
            if ! start_backend; then
                log_error "Failed to start backend service"
                exit 1
            fi
        else
            log_success "Backend: Already running"
        fi
    fi
    
    # Phase 3: System Verification
    log_section "Phase 3: System Verification"
    
    if [ "$DRY_RUN" = false ]; then
        sleep 3  # Allow backend to fully initialize
        
        if ! test_message_flow; then
            log_error "Message flow test failed"
            exit 1
        fi
    fi
    
    # Phase 4: Dashboard
    log_section "Phase 4: System Status"
    
    if display_dashboard; then
        log_success "PAI Mortgage system is fully operational"
        exit 0
    else
        log_error "System has issues"
        exit 1
    fi
}

# Run main function
main "$@"