#!/bin/bash

# Terminal-based log monitor with color coding and filtering
# Run this in a separate terminal window to monitor the conversation processing

clear

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          MORTGAGE AGENT - REAL-TIME LOG MONITOR               ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Monitoring: conversation_debug.log                           ║"
echo "║  Press Ctrl+C to stop                                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

LOG_FILE="conversation_debug.log"

# Create log file if it doesn't exist
touch $LOG_FILE

# Function to colorize output based on content
colorize_output() {
    while IFS= read -r line; do
        if [[ $line == *"[ERROR]"* ]] || [[ $line == *"FAILED"* ]] || [[ $line == *"Exception"* ]]; then
            echo -e "\033[31m$line\033[0m"  # Red for errors
        elif [[ $line == *"[SUCCESS]"* ]] || [[ $line == *"completed"* ]]; then
            echo -e "\033[32m$line\033[0m"  # Green for success
        elif [[ $line == *"[API_CALL]"* ]] || [[ $line == *"API Call"* ]]; then
            echo -e "\033[35m$line\033[0m"  # Magenta for API calls
        elif [[ $line == *"[WARNING]"* ]] || [[ $line == *"timeout"* ]]; then
            echo -e "\033[33m$line\033[0m"  # Yellow for warnings
        elif [[ $line == *"[DEBUG]"* ]] || [[ $line == *"[ENTITIES]"* ]]; then
            echo -e "\033[36m$line\033[0m"  # Cyan for debug
        elif [[ $line == *"[TRACE]"* ]] || [[ $line == *"→"* ]] || [[ $line == *"←"* ]]; then
            echo -e "\033[90m$line\033[0m"  # Gray for trace
        elif [[ $line == *"[STEP]"* ]]; then
            echo -e "\033[1;37m$line\033[0m"  # Bold white for steps
        elif [[ $line == *"==="* ]]; then
            echo -e "\033[1;34m$line\033[0m"  # Bold blue for separators
        else
            echo "$line"  # Default color
        fi
    done
}

echo "Waiting for logs..."
echo "───────────────────────────────────────────────────────────────"
echo ""

# Monitor the log file with color coding
tail -F $LOG_FILE 2>/dev/null | colorize_output