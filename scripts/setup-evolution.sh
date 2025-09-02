#!/bin/bash

echo "Setting up Evolution API for AI PBX..."

# Create Evolution API directory
mkdir -p ../evolution-api
cd ../evolution-api

# Clone Evolution API
git clone https://github.com/EvolutionAPI/evolution-api.git .

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure environment variables for AI PBX
cat > .env << EOF
# Server Configuration
SERVER_TYPE=http
SERVER_PORT=8080

# CORS Configuration
CORS_ORIGIN=*
CORS_METHODS=POST,GET,PUT,DELETE
CORS_CREDENTIALS=true

# Database Configuration
DATABASE_ENABLED=false

# Instance Configuration
CONFIG_SESSION_PHONE_CLIENT=AI-PBX
CONFIG_SESSION_PHONE_NAME=AI PBX Assistant

# Webhook Configuration
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_URL=http://localhost:3000/webhook
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=true

# Auth Configuration
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=ai-pbx-evolution-key-2024

# Log Configuration
LOG_LEVEL=info
LOG_COLOR=true

# QR Code Configuration
QRCODE_LIMIT=10
QRCODE_COLOR=#198754
EOF

echo "Evolution API setup complete!"
echo "To start: npm run start:dev"
echo "API will be available at: http://localhost:8080"