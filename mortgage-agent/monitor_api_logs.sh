#!/bin/bash

# Monitor API logs in real-time with color coding
echo "=========================================="
echo "MORTGAGE API LOG MONITOR"
echo "=========================================="
echo ""
echo "Monitoring API requests and errors..."
echo "Press Ctrl+C to stop"
echo ""

# Create a log file if it doesn't exist
LOG_FILE="api_debug.log"
touch $LOG_FILE

# Clear the log for fresh start
> $LOG_FILE

echo "Waiting for API requests..."
echo ""

# Monitor the log file with color coding
tail -f $LOG_FILE | while read line; do
    if [[ $line == *"ERROR"* ]]; then
        echo -e "\033[31m$line\033[0m"  # Red for errors
    elif [[ $line == *"SUCCESS"* ]]; then
        echo -e "\033[32m$line\033[0m"  # Green for success
    elif [[ $line == *"API Call"* ]]; then
        echo -e "\033[33m$line\033[0m"  # Yellow for API calls
    elif [[ $line == *"WARNING"* ]]; then
        echo -e "\033[35m$line\033[0m"  # Magenta for warnings
    elif [[ $line == *"TRACE"* ]]; then
        echo -e "\033[36m$line\033[0m"  # Cyan for trace
    else
        echo "$line"
    fi
done