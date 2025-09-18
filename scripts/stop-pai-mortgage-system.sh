#!/bin/bash
# PAI Mortgage System - Clean Shutdown Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

log_info() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARNING]${NC} $1"
}

echo -e "${BOLD}${CYAN}PAI Mortgage System - Shutdown${NC}"

# Stop Node.js processes
log_info "Stopping Node.js processes..."
node_pids=$(ps aux | grep -E 'node.*app\.js|npm.*start' | grep -v grep | awk '{print $2}' || true)

if [ -n "$node_pids" ]; then
    echo "$node_pids" | xargs kill -TERM 2>/dev/null || true
    log_info "Sent TERM signal, waiting for graceful shutdown..."
    sleep 3
    
    # Check if any are still running
    still_running=$(ps aux | grep -E 'node.*app\.js|npm.*start' | grep -v grep | awk '{print $2}' || true)
    if [ -n "$still_running" ]; then
        log_warning "Some processes still running, sending KILL signal..."
        echo "$still_running" | xargs kill -KILL 2>/dev/null || true
        sleep 1
    fi
    
    log_success "Node.js processes stopped"
else
    log_info "No Node.js processes found"
fi

# Clean up background processes
log_info "Cleaning up background processes..."
pkill -f "npm start" 2>/dev/null || true

log_success "PAI Mortgage system shutdown complete"