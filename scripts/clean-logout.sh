#!/bin/bash

# Clean Logout Script for Evolution API Instances
# This script ensures complete disconnection without phantom sessions

set -e

API_URL="http://localhost:8080"
API_KEY="${EVOLUTION_API_KEY:-pai_evolution_api_key_2025}"
INSTANCES=("aipbx" "pai-assistant" "cs-monitor")

echo "🔌 Evolution API Clean Logout Script"
echo "==============================================="

# Function to safely call Evolution API
call_api() {
    local method="$1"
    local endpoint="$2"
    local instance="$3"
    local data="$4"
    
    echo "  📡 ${method} ${endpoint}/${instance}"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -X "$method" \
            "${API_URL}${endpoint}/${instance}" \
            -H "apikey: ${API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -s || echo "  ⚠️  Warning: API call failed"
    else
        curl -X "$method" \
            "${API_URL}${endpoint}/${instance}" \
            -H "apikey: ${API_KEY}" \
            -s || echo "  ⚠️  Warning: API call failed"
    fi
    
    echo ""
}

# Function to clean logout a single instance
clean_logout_instance() {
    local instance="$1"
    echo "🔌 Cleaning logout for instance: $instance"
    
    # Step 1: Logout the instance
    echo "  1️⃣  Logging out instance"
    call_api "DELETE" "/instance/logout" "$instance"
    
    # Step 2: Wait a moment for logout to complete
    echo "  ⏳ Waiting for logout to complete..."
    sleep 3
    
    # Step 3: Delete the instance completely
    echo "  2️⃣  Deleting instance"
    call_api "DELETE" "/instance/delete" "$instance"
    
    # Step 4: Wait for deletion to complete
    echo "  ⏳ Waiting for deletion to complete..."
    sleep 2
    
    echo "  ✅ Instance $instance cleaned successfully"
    echo ""
}

# Function to perform complete cleanup
complete_cleanup() {
    echo "🧹 Performing COMPLETE cleanup (removes all sessions)"
    echo "==============================================="
    
    # Logout all instances
    for instance in "${INSTANCES[@]}"; do
        clean_logout_instance "$instance"
    done
    
    # Stop Evolution services
    echo "🛑 Stopping Evolution services..."
    cd /Users/tomas/Desktop/ai_pbx/docker/evolution
    docker-compose down
    
    # Remove volumes to clear all session data
    echo "🗑️  Removing session volumes..."
    docker volume rm pai_evolution_instances pai_evolution_store 2>/dev/null || true
    
    # Restart services
    echo "🚀 Restarting Evolution services..."
    docker-compose up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to initialize..."
    sleep 15
    
    # Recreate instances
    echo "🏗️  Recreating instances..."
    
    # Recreate aipbx
    curl -X POST "${API_URL}/instance/create" \
        -H "apikey: ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "instanceName": "aipbx",
            "integration": "WHATSAPP-BAILEYS",
            "webhook": {
                "enabled": true,
                "url": "http://localhost:3000/webhook",
                "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
            }
        }' -s > /dev/null
    
    # Recreate pai-assistant
    curl -X POST "${API_URL}/instance/create" \
        -H "apikey: ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "instanceName": "pai-assistant",
            "integration": "WHATSAPP-BAILEYS",
            "webhook": {
                "enabled": true,
                "url": "http://localhost:3000/webhook/pai-assistant",
                "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
            }
        }' -s > /dev/null
    
    # Recreate cs-monitor
    curl -X POST "${API_URL}/instance/create" \
        -H "apikey: ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "instanceName": "cs-monitor",
            "integration": "WHATSAPP-BAILEYS",
            "webhook": {
                "enabled": true,
                "url": "http://localhost:3000/webhook/cs-tickets",
                "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "GROUPS_UPSERT"]
            }
        }' -s > /dev/null
    
    echo "✅ Complete cleanup finished!"
    echo ""
    echo "📱 QR Codes available at:"
    echo "  • Main (aipbx): http://localhost:3000/qr-responder"
    echo "  • Assistant: http://localhost:3000/qr-assistant"
    echo "  • CS Monitor: http://localhost:3000/qr-cs"
}

# Main script logic
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [instance_name|--complete|--help]"
    echo ""
    echo "Options:"
    echo "  instance_name    Clean logout specific instance (aipbx, pai-assistant, cs-monitor)"
    echo "  --complete       Perform complete cleanup (all instances + volumes)"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 cs-monitor    # Clean logout just CS Monitor"
    echo "  $0 --complete    # Complete cleanup of all sessions"
    exit 0
elif [ "$1" = "--complete" ]; then
    complete_cleanup
elif [ -n "$1" ]; then
    # Clean logout specific instance
    if [[ " ${INSTANCES[@]} " =~ " $1 " ]]; then
        clean_logout_instance "$1"
        echo "✅ Clean logout completed for $1"
        echo "📱 Reconnect at: http://localhost:3000/qr-${1/aipbx/responder}"
    else
        echo "❌ Error: Invalid instance name '$1'"
        echo "Valid instances: ${INSTANCES[*]}"
        exit 1
    fi
else
    echo "❓ Usage: $0 [instance_name|--complete|--help]"
    echo "Run '$0 --help' for more information"
    exit 1
fi