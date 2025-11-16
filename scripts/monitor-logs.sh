#!/bin/bash

# AI PBX Log Monitoring Script
# Real-time log viewer with filtering and color coding
# Usage: ./scripts/monitor-logs.sh [filter]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="logs/combined.log"
APP_LOG="logs/app.log"
ERROR_LOG="logs/error.log"
FILTER_TERM=${1:-""}
FOLLOW_MODE=${2:-true}

# Banner
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}        🔍 AI PBX Real-Time Log Monitor        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📁 Monitoring: ${LOG_FILE}${NC}"
echo -e "${CYAN}🔍 Filter: ${FILTER_TERM:-"ALL LOGS"}${NC}"
echo -e "${CYAN}📅 Started: $(date)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to colorize log levels
colorize_logs() {
    while IFS= read -r line; do
        timestamp=$(date +'%H:%M:%S')
        
        if [[ "$line" =~ error ]]; then
            echo -e "${RED}[${timestamp}] ${line}${NC}"
        elif [[ "$line" =~ warn ]]; then
            echo -e "${YELLOW}[${timestamp}] ${line}${NC}"
        elif [[ "$line" =~ info ]]; then
            echo -e "${GREEN}[${timestamp}] ${line}${NC}"
        elif [[ "$line" =~ debug ]]; then
            echo -e "${PURPLE}[${timestamp}] ${line}${NC}"
        elif [[ "$line" =~ "CS Ticket" ]]; then
            echo -e "${CYAN}[${timestamp}] 🎫 ${line}${NC}"
        elif [[ "$line" =~ "PAI" ]]; then
            echo -e "${WHITE}[${timestamp}] 🤖 ${line}${NC}"
        elif [[ "$line" =~ "Evolution" ]]; then
            echo -e "${BLUE}[${timestamp}] 📱 ${line}${NC}"
        elif [[ "$line" =~ "Groups" ]]; then
            echo -e "${YELLOW}[${timestamp}] 👥 ${line}${NC}"
        elif [[ "$line" =~ "GET\|POST\|PUT\|DELETE" ]]; then
            echo -e "${GREEN}[${timestamp}] 🌐 ${line}${NC}"
        else
            echo -e "${WHITE}[${timestamp}] ${line}${NC}"
        fi
    done
}

# Function to check if log file exists
check_log_files() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}⚠️  Log file not found: ${LOG_FILE}${NC}"
        echo -e "${CYAN}📁 Creating logs directory...${NC}"
        mkdir -p logs
        echo -e "${CYAN}🚀 Starting server to generate logs...${NC}"
        echo ""
    fi
}

# Function to display system stats
show_stats() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}📊 System Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check if server is running
    if pgrep -f "node src/app.js" > /dev/null; then
        echo -e "${GREEN}✅ Server: Running${NC}"
        SERVER_PID=$(pgrep -f "node src/app.js")
        echo -e "${CYAN}🆔 PID: ${SERVER_PID}${NC}"
    else
        echo -e "${RED}❌ Server: Not Running${NC}"
    fi
    
    # Check Evolution API
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Evolution API: Accessible${NC}"
    else
        echo -e "${RED}❌ Evolution API: Not Accessible${NC}"
    fi
    
    # Check main app
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Main App: Accessible${NC}"
    else
        echo -e "${RED}❌ Main App: Not Accessible${NC}"
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Trap to handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}📝 Log monitoring stopped${NC}"; exit 0' INT

# Main execution
check_log_files
show_stats

# Start monitoring logs
echo -e "${CYAN}🔄 Starting real-time log monitoring...${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop${NC}"
echo ""

# Tail the log file with filtering and colorization
if [ ! -z "$FILTER_TERM" ]; then
    echo -e "${CYAN}🔍 Filtering logs for: '${FILTER_TERM}'${NC}"
    echo ""
    if command -v tail >/dev/null 2>&1; then
        tail -f "$LOG_FILE" 2>/dev/null | grep --line-buffered "$FILTER_TERM" | colorize_logs
    else
        echo -e "${RED}❌ 'tail' command not found${NC}"
        exit 1
    fi
else
    if command -v tail >/dev/null 2>&1; then
        tail -f "$LOG_FILE" 2>/dev/null | colorize_logs
    else
        echo -e "${RED}❌ 'tail' command not found${NC}"
        exit 1
    fi
fi