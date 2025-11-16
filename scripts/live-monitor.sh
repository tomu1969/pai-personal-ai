#!/bin/bash

# Live AI PBX System Monitor
# Comprehensive real-time monitoring with multiple views
# Usage: ./scripts/live-monitor.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
LOG_FILE="logs/combined.log"
UPDATE_INTERVAL=2

# Function to clear screen and show header
show_header() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${WHITE}                    🤖 AI PBX Live Monitor                       ${BLUE}║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║ ${CYAN}📅 $(date +'%Y-%m-%d %H:%M:%S') ${YELLOW}| Press Ctrl+C to exit${BLUE}                 ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check system status
check_system_status() {
    echo -e "${BOLD}🏥 System Health Dashboard${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check Node.js server
    if pgrep -f "node src/app.js" > /dev/null; then
        SERVER_PID=$(pgrep -f "node src/app.js")
        echo -e "${GREEN}✅ AI PBX Server: Running (PID: ${SERVER_PID})${NC}"
    else
        echo -e "${RED}❌ AI PBX Server: Not Running${NC}"
        return 1
    fi
    
    # Check Evolution API
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Evolution API: Running${NC}"
    else
        echo -e "${RED}❌ Evolution API: Not Accessible${NC}"
    fi
    
    # Check main endpoints
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Main App: Running${NC}"
    else
        echo -e "${RED}❌ Main App: Not Accessible${NC}"
    fi
    
    # Check CS System
    if curl -s http://localhost:3000/qr-cs > /dev/null 2>&1; then
        echo -e "${GREEN}✅ CS Ticket System: Running${NC}"
        
        # Get groups count
        if curl -s http://localhost:3000/api/cs/groups > /dev/null 2>&1; then
            GROUP_COUNT=$(curl -s http://localhost:3000/api/cs/groups 2>/dev/null | grep -o '"total":[0-9]*' | cut -d: -f2 2>/dev/null || echo "0")
            MONITORED_COUNT=$(curl -s http://localhost:3000/api/cs/groups 2>/dev/null | grep -o '"monitored":[0-9]*' | cut -d: -f2 2>/dev/null || echo "0")
            echo -e "${CYAN}  └─ Groups: ${GROUP_COUNT:-0} total, ${MONITORED_COUNT:-0} monitored${NC}"
        fi
    else
        echo -e "${RED}❌ CS Ticket System: Error${NC}"
    fi
    
    echo ""
}

# Function to show recent logs
show_recent_logs() {
    echo -e "${BOLD}📋 Recent Activity (Last 10 entries)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -f "$LOG_FILE" ]; then
        tail -n 10 "$LOG_FILE" | while IFS= read -r line; do
            if [[ "$line" =~ error ]]; then
                echo -e "${RED}🔴 ${line}${NC}"
            elif [[ "$line" =~ warn ]]; then
                echo -e "${YELLOW}🟡 ${line}${NC}"
            elif [[ "$line" =~ "CS Ticket\|qr-cs\|Groups" ]]; then
                echo -e "${CYAN}🎫 ${line}${NC}"
            elif [[ "$line" =~ "GET\|POST" ]]; then
                echo -e "${GREEN}🌐 ${line}${NC}"
            else
                echo -e "${WHITE}📄 ${line}${NC}"
            fi
        done
    else
        echo -e "${YELLOW}⚠️  No log file found${NC}"
    fi
    
    echo ""
}

# Function to show CS system details
show_cs_details() {
    echo -e "${BOLD}🎫 CS Ticket Monitor Details${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Test CS status endpoint
    if CS_STATUS=$(curl -s http://localhost:3000/api/cs/status 2>/dev/null); then
        if echo "$CS_STATUS" | grep -q '"ready":true'; then
            echo -e "${GREEN}✅ CS System: Initialized and Ready${NC}"
        else
            echo -e "${YELLOW}⚠️  CS System: Initializing...${NC}"
        fi
    else
        echo -e "${RED}❌ CS System: API Error${NC}"
    fi
    
    # Show recent CS activity
    if [ -f "$LOG_FILE" ]; then
        CS_ACTIVITY=$(tail -n 50 "$LOG_FILE" | grep -i "cs\|groups" | tail -n 3)
        if [ ! -z "$CS_ACTIVITY" ]; then
            echo -e "${CYAN}🔄 Recent CS Activity:${NC}"
            echo "$CS_ACTIVITY" | while IFS= read -r line; do
                echo -e "${WHITE}  └─ $(echo $line | cut -c1-80)...${NC}"
            done
        fi
    fi
    
    echo ""
}

# Function to show system metrics
show_metrics() {
    echo -e "${BOLD}📊 System Metrics${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Memory usage
    if command -v ps >/dev/null 2>&1; then
        if SERVER_PID=$(pgrep -f "node src/app.js" 2>/dev/null); then
            MEM_USAGE=$(ps -p $SERVER_PID -o rss= 2>/dev/null | awk '{print $1/1024 " MB"}' 2>/dev/null || echo "N/A")
            echo -e "${CYAN}💾 Memory Usage: ${MEM_USAGE}${NC}"
        fi
    fi
    
    # Uptime
    if command -v ps >/dev/null 2>&1; then
        if SERVER_PID=$(pgrep -f "node src/app.js" 2>/dev/null); then
            UPTIME=$(ps -p $SERVER_PID -o etime= 2>/dev/null | awk '{print $1}' 2>/dev/null || echo "N/A")
            echo -e "${CYAN}⏱️  Process Uptime: ${UPTIME}${NC}"
        fi
    fi
    
    # Log file size
    if [ -f "$LOG_FILE" ]; then
        LOG_SIZE=$(ls -lh "$LOG_FILE" 2>/dev/null | awk '{print $5}' 2>/dev/null || echo "N/A")
        LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
        echo -e "${CYAN}📄 Log File: ${LOG_SIZE} (${LOG_LINES} lines)${NC}"
    fi
    
    echo ""
}

# Function to show controls
show_controls() {
    echo -e "${BOLD}🎮 Controls${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}Ctrl+C:${NC} Exit monitor"
    echo -e "${WHITE}View logs:${NC} ./scripts/monitor-logs.sh"
    echo -e "${WHITE}CS logs:${NC} ./scripts/monitor-cs-logs.sh"
    echo -e "${WHITE}Manual refresh:${NC} curl http://localhost:3000/qr-cs"
    echo ""
}

# Make scripts executable
chmod +x /Users/tomas/Desktop/ai_pbx/scripts/monitor-logs.sh 2>/dev/null || true
chmod +x /Users/tomas/Desktop/ai_pbx/scripts/monitor-cs-logs.sh 2>/dev/null || true

# Trap for graceful exit
trap 'echo -e "\n${YELLOW}👋 Monitor stopped${NC}"; exit 0' INT

# Main monitoring loop
while true; do
    show_header
    
    if check_system_status; then
        show_cs_details
        show_metrics
        show_recent_logs
    else
        echo -e "${RED}❌ System not running. Start with: npm start${NC}"
        echo ""
    fi
    
    show_controls
    
    # Wait for next update
    sleep $UPDATE_INTERVAL
done