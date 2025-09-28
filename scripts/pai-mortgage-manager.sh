#!/bin/bash
# PAI Mortgage System Manager - Interactive System Management
# Single command to check status, monitor health, and start system

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}"
}

# Quick system status check
check_system_running() {
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        return 0  # System is running
    else
        return 1  # System is not running
    fi
}

# Health check functions (reused from startup script)
check_docker_services() {
    local status=0
    
    # Check Evolution API
    if curl -s -H "apikey: $EVOLUTION_API_KEY" http://localhost:8080/health >/dev/null 2>&1; then
        echo "✅ Evolution API: Running"
    else
        echo "❌ Evolution API: Not responding"
        status=1
    fi
    
    # Check PostgreSQL
    if docker exec evolution-postgres pg_isready >/dev/null 2>&1; then
        echo "✅ PostgreSQL: Active"
    else
        echo "❌ PostgreSQL: Not responding"
        status=1
    fi
    
    # Check Redis
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis: Ready"
    else
        echo "⚠️  Redis: Not responding (may not be required)"
    fi
    
    return $status
}

check_pai_mortgage_instance() {
    local response=$(curl -s -H "apikey: $EVOLUTION_API_KEY" \
        "http://localhost:8080/instance/connectionState/$PAI_MORTGAGE_INSTANCE" 2>/dev/null)
    
    local status=$(echo "$response" | jq -r '.instance.state // "unknown"' 2>/dev/null)
    
    if [ "$status" = "open" ]; then
        echo "✅ PAI Mortgage: Connected (+57 318 260 1111)"
        return 0
    else
        echo "❌ PAI Mortgage: Not connected (status: $status)"
        return 1
    fi
}

check_openai_api() {
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
        echo "✅ OpenAI API: Key configured correctly"
        return 0
    else
        echo "❌ OpenAI API: Invalid or missing key"
        return 1
    fi
}

check_backend_health() {
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Backend Service: Running on port 3000"
        return 0
    else
        echo "❌ Backend Service: Not running"
        return 1
    fi
}

test_message_routing() {
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
        }' 2>/dev/null)
    
    local test_status=$(echo "$test_response" | jq -r '.success // false' 2>/dev/null)
    local test_instance=$(echo "$test_response" | jq -r '.instance // "unknown"' 2>/dev/null)
    
    if [ "$test_status" = "true" ] && [ "$test_instance" = "pai-mortgage" ]; then
        echo "✅ Message Routing: PAI Mortgage handler active"
        return 0
    else
        echo "❌ Message Routing: Failed or misconfigured"
        return 1
    fi
}

# Display comprehensive health dashboard
show_health_dashboard() {
    echo ""
    echo -e "${BOLD}${GREEN}🏥 PAI Mortgage System Health Dashboard${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local overall_health=0
    
    echo -e "${CYAN}Docker Services:${NC}"
    if ! check_docker_services; then
        overall_health=1
    fi
    
    echo ""
    echo -e "${CYAN}PAI Mortgage Instance:${NC}"
    if ! check_pai_mortgage_instance; then
        overall_health=1
    fi
    
    echo ""
    echo -e "${CYAN}OpenAI Configuration:${NC}"
    if ! check_openai_api; then
        overall_health=1
    fi
    
    echo ""
    echo -e "${CYAN}Backend Service:${NC}"
    if ! check_backend_health; then
        overall_health=1
    fi
    
    echo ""
    echo -e "${CYAN}Message Routing:${NC}"
    if ! test_message_routing; then
        overall_health=1
    fi
    
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ $overall_health -eq 0 ]; then
        echo -e "${BOLD}${GREEN}🎉 System Fully Operational! Ready for WhatsApp messages.${NC}"
        return 0
    else
        echo -e "${BOLD}${RED}⚠️  System has issues. Some components need attention.${NC}"
        return 1
    fi
}

# Prompt user to start system
prompt_user_to_start() {
    echo ""
    echo -e "${YELLOW}The PAI Mortgage system is not currently running.${NC}"
    echo -e "${CYAN}Would you like to start it now? (y/N)${NC}"
    read -r response
    
    case "$response" in
        [yY]|[yY][eE][sS])
            return 0  # User wants to start
            ;;
        *)
            return 1  # User does not want to start
            ;;
    esac
}

# Run end-to-end test
run_end_to_end_test() {
    log_section "End-to-End System Test"
    
    log_info "Testing complete message flow..."
    
    # Test with a realistic mortgage inquiry
    local test_message="I'm interested in getting a mortgage for a $300,000 house. What rates do you offer?"
    local test_response=$(curl -s -X POST http://localhost:3000/webhook/messages-upsert \
        -H "Content-Type: application/json" \
        -d "{
            \"event\": \"messages.upsert\",
            \"instance\": \"pai-mortgage-fresh\",
            \"data\": {
                \"key\": {\"remoteJid\": \"573182601111@s.whatsapp.net\", \"fromMe\": false, \"id\": \"E2E_TEST_$(date +%s)\"},
                \"message\": {\"conversation\": \"$test_message\"},
                \"pushName\": \"Test Customer\",
                \"messageType\": \"conversation\"
            }
        }" 2>/dev/null)
    
    local test_status=$(echo "$test_response" | jq -r '.success // false' 2>/dev/null)
    local test_instance=$(echo "$test_response" | jq -r '.instance // "unknown"' 2>/dev/null)
    
    if [ "$test_status" = "true" ] && [ "$test_instance" = "pai-mortgage" ]; then
        log_success "✅ End-to-End Test: PASSED"
        log_info "Message successfully routed to PAI Mortgage handler"
        log_info "Test message: \"$test_message\""
        return 0
    else
        log_error "❌ End-to-End Test: FAILED"
        log_error "Response: $test_response"
        return 1
    fi
}

# Start the system using existing startup script
start_system() {
    log_section "Starting PAI Mortgage System"
    
    log_info "Launching system with comprehensive health checks..."
    
    if "$SCRIPT_DIR/start-pai-mortgage-system.sh"; then
        log_success "System startup completed successfully"
        
        # Wait a moment for full initialization
        sleep 2
        
        # Run end-to-end test
        if run_end_to_end_test; then
            log_success "🎉 System is fully operational and tested!"
            return 0
        else
            log_warning "System started but end-to-end test failed"
            return 1
        fi
    else
        log_error "System startup failed"
        return 1
    fi
}

# Main function
main() {
    echo -e "${BOLD}${MAGENTA}PAI Mortgage System Manager${NC}"
    echo -e "${CYAN}Timestamp: $(date)${NC}"
    echo ""
    
    # Parse command line arguments
    case "${1:-}" in
        --status|-s)
            # Just show status and exit
            if check_system_running; then
                show_health_dashboard
            else
                echo -e "${RED}System is not running${NC}"
                exit 1
            fi
            exit 0
            ;;
        --start|-t)
            # Force start without prompting
            start_system
            exit $?
            ;;
        --test|-e)
            # Run end-to-end test only
            if check_system_running; then
                run_end_to_end_test
            else
                echo -e "${RED}System is not running. Cannot run test.${NC}"
                exit 1
            fi
            exit $?
            ;;
        --help|-h)
            echo "PAI Mortgage System Manager"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  (no args)    Interactive mode - check status and optionally start"
            echo "  --status, -s Show system status and health dashboard"
            echo "  --start, -t  Start system without prompting"
            echo "  --test, -e   Run end-to-end test (system must be running)"
            echo "  --help, -h   Show this help message"
            echo ""
            exit 0
            ;;
    esac
    
    # Interactive mode - check if system is running
    if check_system_running; then
        log_success "✅ PAI Mortgage system is running"
        show_health_dashboard
        
        # Offer to run end-to-end test
        echo ""
        echo -e "${CYAN}Would you like to run an end-to-end test? (y/N)${NC}"
        read -r test_response
        
        case "$test_response" in
            [yY]|[yY][eE][sS])
                run_end_to_end_test
                ;;
        esac
    else
        log_warning "❌ PAI Mortgage system is not running"
        
        if prompt_user_to_start; then
            start_system
        else
            echo -e "${CYAN}System remains stopped. Use '$0 --start' to start without prompting.${NC}"
            exit 0
        fi
    fi
}

# Run main function with all arguments
main "$@"