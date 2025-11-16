#!/bin/bash

# CS Ticket Monitor Focused Log Script
# Specialized logging for CS Ticket System debugging
# Usage: ./scripts/monitor-cs-logs.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

LOG_FILE="logs/combined.log"

# CS-specific banner
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}   🎫 CS Ticket Monitor - Log Viewer 🎫      ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 Monitoring CS System Events${NC}"
echo -e "${CYAN}📅 Started: $(date)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# CS-specific colorization
colorize_cs_logs() {
    while IFS= read -r line; do
        timestamp=$(date +'%H:%M:%S')
        
        if [[ "$line" =~ "CS Ticket Monitor" ]]; then
            echo -e "${CYAN}[${timestamp}] 🎫 ${line}${NC}"
        elif [[ "$line" =~ "Groups Manager" ]]; then
            echo -e "${YELLOW}[${timestamp}] 👥 ${line}${NC}"
        elif [[ "$line" =~ "getAllGroups\|renderGroups\|loadGroups" ]]; then
            echo -e "${GREEN}[${timestamp}] 📋 ${line}${NC}"
        elif [[ "$line" =~ "JavaScript is running\|DOMContentLoaded\|console.log" ]]; then
            echo -e "${PURPLE}[${timestamp}] 🔧 ${line}${NC}"
        elif [[ "$line" =~ "qr-cs\|/api/cs" ]]; then
            echo -e "${WHITE}[${timestamp}] 🌐 ${line}${NC}"
        elif [[ "$line" =~ "error" ]]; then
            echo -e "${RED}[${timestamp}] ❌ ${line}${NC}"
        elif [[ "$line" =~ "warn" ]]; then
            echo -e "${YELLOW}[${timestamp}] ⚠️  ${line}${NC}"
        elif [[ "$line" =~ "debug" ]]; then
            echo -e "${PURPLE}[${timestamp}] 🔍 ${line}${NC}"
        else
            echo -e "${WHITE}[${timestamp}] ${line}${NC}"
        fi
    done
}

# Check CS system status
show_cs_status() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}🎫 CS Ticket System Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Test CS endpoints
    if curl -s http://localhost:3000/qr-cs > /dev/null 2>&1; then
        echo -e "${GREEN}✅ CS QR Page: Accessible${NC}"
    else
        echo -e "${RED}❌ CS QR Page: Error${NC}"
    fi
    
    if curl -s http://localhost:3000/api/cs/groups > /dev/null 2>&1; then
        echo -e "${GREEN}✅ CS Groups API: Responding${NC}"
        # Show group count
        GROUP_COUNT=$(curl -s http://localhost:3000/api/cs/groups | grep -o '"total":[0-9]*' | cut -d: -f2)
        echo -e "${CYAN}📊 Groups Found: ${GROUP_COUNT:-0}${NC}"
    else
        echo -e "${RED}❌ CS Groups API: Error${NC}"
    fi
    
    if curl -s http://localhost:3000/api/cs/status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ CS Status API: Responding${NC}"
    else
        echo -e "${RED}❌ CS Status API: Error${NC}"
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Trap for graceful exit
trap 'echo -e "\n${YELLOW}🎫 CS Log monitoring stopped${NC}"; exit 0' INT

# Show CS status first
show_cs_status

echo -e "${CYAN}🔄 Monitoring CS-related logs...${NC}"
echo -e "${YELLOW}💡 Filtering for CS, Groups, JavaScript, and API events${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop${NC}"
echo ""

# Create log file if it doesn't exist
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Creating log file...${NC}"
    mkdir -p logs
    touch "$LOG_FILE"
fi

# Monitor CS-specific logs
tail -f "$LOG_FILE" 2>/dev/null | grep --line-buffered -E "(CS|Groups|groups|qr-cs|api/cs|JavaScript|console|DOMContent|renderGroups|loadGroups|getAllGroups)" | colorize_cs_logs