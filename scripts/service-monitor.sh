#!/bin/bash
# PAI System - Service Health Monitoring Script
# Monitors and reports on service health status (Compatible with Bash 3.2+)

set -e

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
TIMEOUT=30
RETRY_INTERVAL=2
MAX_RETRIES=15

# Logging functions
log_timestamp() {
    echo -n "[$(date '+%H:%M:%S')]"
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
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${MAGENTA}$(log_timestamp) [DEBUG]${NC} $1"
    fi
}

log_header() {
    echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}\n"
}

# Get service name
get_service_name() {
    case $1 in
        "backend") echo "PAI Backend API" ;;
        "frontend") echo "PAI Frontend (React)" ;;
        "evolution") echo "Evolution API" ;;
        "postgres") echo "PostgreSQL Database" ;;
        "redis") echo "Redis Cache" ;;
        *) echo "Unknown Service" ;;
    esac
}

# Check if a URL is responding
check_http_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local timeout=${3:-10}
    
    log_debug "Checking HTTP endpoint: $url"
    
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $timeout "$url" 2>/dev/null || echo "000")
        if [[ "$response" =~ ^[2-3][0-9][0-9]$ ]]; then
            return 0
        else
            log_debug "HTTP response code: $response"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -q --timeout=$timeout --tries=1 --spider "$url" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    else
        log_error "Neither curl nor wget available for HTTP checks"
        return 1
    fi
}

# Check PostgreSQL connection
check_postgres() {
    local host=${1:-localhost}
    local port=${2:-5432}
    local user=${3:-evolution}
    local db=${4:-evolution_db}
    
    log_debug "Checking PostgreSQL connection: $host:$port"
    
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    elif command -v psql >/dev/null 2>&1; then
        if PGPASSWORD="${DB_PASSWORD:-evolution123}" psql -h "$host" -p "$port" -U "$user" -d "$db" -c "SELECT 1;" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    else
        # Fallback: check if port is responding
        if (echo >/dev/tcp/$host/$port) >/dev/null 2>&1; then
            log_debug "PostgreSQL port is open (cannot verify authentication)"
            return 0
        else
            return 1
        fi
    fi
}

# Check Redis connection
check_redis() {
    local host=${1:-localhost}
    local port=${2:-6379}
    local password=${3:-redis123}
    
    log_debug "Checking Redis connection: $host:$port"
    
    if command -v redis-cli >/dev/null 2>&1; then
        if [[ -n "$password" ]]; then
            if redis-cli -h "$host" -p "$port" -a "$password" ping 2>/dev/null | grep -q "PONG"; then
                return 0
            else
                return 1
            fi
        else
            if redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
                return 0
            else
                return 1
            fi
        fi
    else
        # Fallback: check if port is responding
        if (echo >/dev/tcp/$host/$port) >/dev/null 2>&1; then
            log_debug "Redis port is open (cannot verify authentication)"
            return 0
        else
            return 1
        fi
    fi
}

# Wait for a service to become available
wait_for_service() {
    local service=$1
    local max_wait=${2:-$TIMEOUT}
    local retry_count=0
    local max_retry=$((max_wait / RETRY_INTERVAL))
    local service_name=$(get_service_name "$service")
    
    log_info "Waiting for $service_name..."
    
    while [[ $retry_count -lt $max_retry ]]; do
        if check_service_health "$service"; then
            log_success "$service_name is ready"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        if [[ $retry_count -lt $max_retry ]]; then
            log_debug "Retry $retry_count/$max_retry for $service_name"
            sleep $RETRY_INTERVAL
        fi
    done
    
    log_error "$service_name failed to start within ${max_wait}s"
    return 1
}

# Check individual service health
check_service_health() {
    local service=$1
    
    case $service in
        "backend")
            check_http_endpoint "http://localhost:3000/health"
            ;;
        "frontend")
            check_http_endpoint "http://localhost:3001"
            ;;
        "evolution")
            check_http_endpoint "http://localhost:8080"
            ;;
        "postgres")
            check_postgres
            ;;
        "redis")
            check_redis
            ;;
        *)
            log_error "Unknown service: $service"
            return 1
            ;;
    esac
}

# Get service detailed status
get_service_details() {
    local service=$1
    
    case $service in
        "backend")
            if check_http_endpoint "http://localhost:3000/health" 10; then
                local health_response=$(curl -s --max-time 5 "http://localhost:3000/health" 2>/dev/null || echo "{}")
                echo "Health: $health_response"
                
                # Check specific endpoints
                if check_http_endpoint "http://localhost:3000/api/whatsapp/status" 10; then
                    echo "WhatsApp API: ✅ Available"
                else
                    echo "WhatsApp API: ❌ Not responding"
                fi
                
                if check_http_endpoint "http://localhost:3000/api/assistant/config" 10; then
                    echo "Assistant API: ✅ Available"
                else
                    echo "Assistant API: ❌ Not responding"
                fi
            fi
            ;;
        "evolution")
            if check_http_endpoint "http://localhost:8080" 10; then
                echo "Evolution API: ✅ Running"
                
                # Check instances if possible
                local instances_response=$(curl -s --max-time 5 -H "apikey: pai_evolution_api_key_2025" "http://localhost:8080/instance/fetchInstances" 2>/dev/null || echo "[]")
                local instance_count=$(echo "$instances_response" | grep -o '"instanceName"' | wc -l | tr -d ' ')
                echo "Instances: $instance_count configured"
            fi
            ;;
        "postgres")
            if check_postgres; then
                echo "PostgreSQL: ✅ Connected"
                if command -v psql >/dev/null 2>&1; then
                    local db_size=$(PGPASSWORD="evolution123" psql -h localhost -U evolution -d evolution_db -t -c "SELECT pg_size_pretty(pg_database_size('evolution_db'));" 2>/dev/null | xargs || echo "Unknown")
                    echo "Database size: $db_size"
                fi
            fi
            ;;
        "redis")
            if check_redis; then
                echo "Redis: ✅ Connected"
                if command -v redis-cli >/dev/null 2>&1; then
                    local memory_usage=$(redis-cli -a redis123 info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "Unknown")
                    echo "Memory usage: $memory_usage"
                fi
            fi
            ;;
    esac
}

# Monitor all services
monitor_services() {
    local services="postgres redis evolution backend frontend"
    local all_healthy=true
    
    log_header "Service Health Monitor"
    
    for service in $services; do
        local service_name=$(get_service_name "$service")
        log_info "Checking $service_name..."
        
        if check_service_health "$service"; then
            log_success "$service_name: ✅ Healthy"
            
            # Get additional details
            local details=$(get_service_details "$service")
            if [[ -n "$details" ]]; then
                echo -e "${CYAN}  Details:${NC}"
                echo "$details" | sed 's/^/    /'
            fi
        else
            log_error "$service_name: ❌ Unhealthy"
            all_healthy=false
        fi
        echo
    done
    
    return $([ "$all_healthy" = true ] && echo 0 || echo 1)
}

# Display service status dashboard
show_status_dashboard() {
    log_header "PAI System Status Dashboard"
    
    printf "%-25s %-15s %-20s\n" "Service" "Status" "Endpoint"
    printf "%-25s %-15s %-20s\n" "-------" "------" "--------"
    
    local services="postgres redis evolution backend frontend"
    for service in $services; do
        local service_name=$(get_service_name "$service")
        local endpoint=""
        
        case $service in
            "backend") endpoint="http://localhost:3000" ;;
            "frontend") endpoint="http://localhost:3001" ;;
            "evolution") endpoint="http://localhost:8080" ;;
            "postgres") endpoint="localhost:5432" ;;
            "redis") endpoint="localhost:6379" ;;
        esac
        
        local status_color=""
        local status_symbol=""
        if check_service_health "$service"; then
            status_color="${GREEN}"
            status_symbol="✅ Healthy"
        else
            status_color="${RED}"
            status_symbol="❌ Down"
        fi
        
        printf "%-25s ${status_color}%-15s${NC} %-20s\n" "$service_name" "$status_symbol" "$endpoint"
    done
    
    echo
    
    # Show quick access URLs
    echo -e "${BOLD}Quick Access:${NC}"
    echo "  • Main Interface:     http://localhost:3001"
    echo "  • API Health:         http://localhost:3000/health"
    echo "  • Evolution Console:  http://localhost:8080"
    echo "  • PAI Responder QR:   http://localhost:3000/qr-responder"
    echo "  • PAI Assistant QR:   http://localhost:3000/qr-assistant"
}

# Continuous monitoring mode
continuous_monitor() {
    local interval=${1:-30}
    
    log_info "Starting continuous monitoring (checking every ${interval}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        clear
        monitor_services
        show_status_dashboard
        
        echo -e "\n${CYAN}Last check: $(date)${NC}"
        echo -e "Next check in ${interval}s... (Press Ctrl+C to stop)"
        
        sleep $interval
    done
}

# Handle command line arguments
case "${1:-monitor}" in
    "monitor"|"check")
        monitor_services
        show_status_dashboard
        exit $?
        ;;
    "wait")
        shift
        for service in "$@"; do
            local valid_services="backend frontend evolution postgres redis"
            if echo "$valid_services" | grep -q "$service"; then
                wait_for_service "$service"
            else
                log_error "Unknown service: $service"
                echo "Available services: $valid_services"
                exit 1
            fi
        done
        ;;
    "continuous"|"watch")
        continuous_monitor "${2:-30}"
        ;;
    "dashboard"|"status")
        show_status_dashboard
        ;;
    "help"|"-h"|"--help")
        echo "PAI System Service Monitor"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  monitor          Check all services once (default)"
        echo "  wait SERVICE     Wait for specific service to be ready"
        echo "  continuous [N]   Monitor continuously every N seconds (default: 30)"
        echo "  dashboard        Show status dashboard only"
        echo "  help             Show this help"
        echo ""
        echo "Available services: backend frontend evolution postgres redis"
        echo ""
        echo "Environment variables:"
        echo "  DEBUG=true       Enable debug logging"
        echo "  TIMEOUT=30       Default timeout for service checks"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac