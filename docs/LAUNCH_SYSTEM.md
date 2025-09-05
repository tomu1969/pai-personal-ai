# 🚀 PAI System - Unified Launch System

## Quick Start

Launch the entire PAI system with a single command:

```bash
./launch-pai.sh
```

Or using npm:

```bash
npm run launch
```

## What It Does

The unified launch script automatically:

1. **✅ Verifies Dependencies** - Checks Node.js, npm, Docker, ports, and disk space
2. **🐳 Starts Infrastructure** - Launches PostgreSQL, Redis, and Evolution API via Docker
3. **⚙️ Starts Backend** - Launches PAI backend API server (port 3000)
4. **🎨 Starts Frontend** - Launches React development server (port 3001)  
5. **🔍 Health Checks** - Verifies all services are responding correctly
6. **📊 Status Dashboard** - Shows service status and access URLs

## Available Commands

### Main Commands
```bash
# Launch complete system
./launch-pai.sh
npm run launch

# Launch with debug logging
./launch-pai.sh --debug
npm run launch:debug

# Check dependencies only
./launch-pai.sh --check-only  
npm run launch:check
```

### Utility Commands
```bash
# Check system dependencies
./scripts/check-dependencies.sh
npm run check-deps

# Monitor service health
./scripts/service-monitor.sh
npm run monitor

# Continuous monitoring
./scripts/service-monitor.sh continuous
npm run monitor:watch
```

## System Requirements

### Required
- **Node.js** 18.0.0+ (for backend and frontend)
- **Docker** with Docker Compose (for Evolution API, PostgreSQL, Redis)
- **2GB RAM** and **2GB disk space** minimum

### Required Ports
- `3000` - PAI Backend API
- `3001` - PAI Frontend (React)
- `8080` - Evolution API (WhatsApp)
- `5432` - PostgreSQL Database
- `6379` - Redis Cache

## Service URLs

Once launched, access these URLs:

- **📱 Main Interface**: http://localhost:3001
- **🔧 Backend API**: http://localhost:3000  
- **📊 Health Check**: http://localhost:3000/health
- **🤖 Evolution API**: http://localhost:8080

### WhatsApp Setup
- **🔗 PAI Responder QR**: http://localhost:3000/qr-responder
- **🔍 PAI Assistant QR**: http://localhost:3000/qr-assistant

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Essential Configuration
OPENAI_API_KEY=sk-proj-your-openai-key-here
DATABASE_URL=postgresql://evolution:evolution123@localhost:5432/evolution_db

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=pai_evolution_api_key_2025
EVOLUTION_INSTANCE_ID=aipbx
```

## Log Files

All logs are saved to `/logs/` directory:

- **Main log**: `logs/launch_YYYYMMDD_HHMMSS.log`
- **Backend logs**: `logs/backend_YYYYMMDD_HHMMSS.log`  
- **Frontend logs**: `logs/frontend_YYYYMMDD_HHMMSS.log`
- **Docker logs**: `logs/docker_YYYYMMDD_HHMMSS.log`

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using ports
./scripts/check-dependencies.sh

# See current service status  
./scripts/service-monitor.sh
```

**Services not starting:**
```bash
# View logs
ls -la logs/

# Debug mode
DEBUG=true ./launch-pai.sh --debug
```

**Dependencies missing:**
```bash
# Check what's missing
./scripts/check-dependencies.sh

# Fix Node.js version issues
nvm install 18
nvm use 18
```

### Recovery Commands

```bash
# Stop all services
pkill -f "node src/app.js"
pkill -f "vite"
docker-compose -f docker/evolution/docker-compose.yml down

# Clean restart
rm -f logs/*.pid
./launch-pai.sh
```

## Features

### 🔍 Smart Dependency Checking
- Verifies Node.js, npm, Docker versions
- Checks port availability  
- Validates disk space and memory
- Tests environment configuration

### 📊 Real-time Monitoring  
- Service health dashboard
- Automatic failure detection
- Process monitoring with PID tracking
- Continuous health checks

### 🛡️ Error Handling
- Graceful shutdown on Ctrl+C
- Automatic cleanup of processes
- Detailed error logging
- Recovery suggestions

### 🎨 Enhanced Logging
- Color-coded output levels
- Timestamped entries  
- Separate log files per service
- Debug mode for troubleshooting

## Integration

The launch system integrates with existing PAI components:

- **Evolution API v2.0.9** for WhatsApp integration
- **PostgreSQL** for conversation storage
- **Redis** for caching and sessions
- **React + Vite** frontend with Socket.io
- **Express.js** backend with real-time updates

## Quick Commands Reference

```bash
# Start system
./launch-pai.sh

# Check health  
./scripts/service-monitor.sh

# View logs
tail -f logs/launch_*.log

# Stop system
# Press Ctrl+C in launch terminal
```

The PAI system is now ready with comprehensive launch automation! 🎉