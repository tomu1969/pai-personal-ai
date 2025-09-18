#!/bin/bash
# PAI Mortgage System - Safe Restart Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${CYAN}PAI Mortgage System - Restart${NC}"

# Stop the system
echo "Step 1: Stopping current system..."
"$SCRIPT_DIR/stop-pai-mortgage-system.sh"

# Wait a moment
echo "Step 2: Waiting for cleanup..."
sleep 2

# Start the system
echo "Step 3: Starting system with health checks..."
"$SCRIPT_DIR/start-pai-mortgage-system.sh" --force-restart

echo -e "${BOLD}${CYAN}Restart complete!${NC}"