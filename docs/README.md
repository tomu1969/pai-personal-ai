# 📚 PAI System Documentation

Complete documentation for PAI - Personal AI WhatsApp assistant system.

## 🚀 Getting Started

### Quick Launch
- **[Main README](../README.md)** - Project overview and features
- **[Quick Start Guide](../QUICK_START.md)** - Dual assistant setup guide
- **[Launch System Guide](LAUNCH_SYSTEM.md)** - Unified launch system documentation

### Essential Guides
- **[WhatsApp Connection Guide](WHATSAPP_CONNECTION_GUIDE.md)** - Complete connection and message flow guide

## 📖 Documentation Structure

```
docs/
├── README.md                    # This documentation index
├── LAUNCH_SYSTEM.md            # Unified launch system guide
├── WHATSAPP_CONNECTION_GUIDE.md # Complete WhatsApp setup guide
├── api/                        # API documentation (coming soon)
├── architecture/               # System architecture docs (coming soon)
└── setup/                     # Setup and configuration guides (coming soon)
```

## 🔧 System Components

### Launch System
- **[launch-pai.sh](../launch-pai.sh)** - Unified system launcher
- **[check-dependencies.sh](../scripts/check-dependencies.sh)** - System verification
- **[service-monitor.sh](../scripts/service-monitor.sh)** - Health monitoring

### Core Services
- **Backend API** (port 3000) - Node.js/Express server
- **Frontend UI** (port 3001) - React/TypeScript interface  
- **Evolution API** (port 8080) - WhatsApp gateway
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache and sessions

## 📋 Quick Reference

### Launch Commands
```bash
./launch-pai.sh           # Start complete system
npm run launch:debug      # Debug mode
npm run check-deps        # Verify dependencies
npm run monitor           # Health monitoring
```

### Service URLs
- **Main Interface**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Evolution API**: http://localhost:8080
- **Health Check**: http://localhost:3000/health

### WhatsApp Setup
- **PAI Responder QR**: http://localhost:3000/qr-responder
- **PAI Assistant QR**: http://localhost:3000/qr-assistant

## 🔍 Troubleshooting

### Common Issues
1. **Port Conflicts** - Use `npm run check-deps` to identify
2. **Docker Issues** - Ensure Docker Desktop is running
3. **WhatsApp Connection** - Check QR code pages and Evolution API
4. **AI Not Responding** - Verify OpenAI API key configuration

### Debug Tools
```bash
npm run launch:debug      # Detailed startup logging
npm run monitor:watch     # Continuous health monitoring
./scripts/service-monitor.sh dashboard  # Service status
```

### Log Files
- **Launch Logs**: `logs/launch_YYYYMMDD_HHMMSS.log`
- **Backend Logs**: `logs/backend_YYYYMMDD_HHMMSS.log`
- **Frontend Logs**: `logs/frontend_YYYYMMDD_HHMMSS.log`
- **Docker Logs**: `logs/docker_YYYYMMDD_HHMMSS.log`

## 📈 Recent Updates

### v1.1.0 - Unified Launch System
- 🚀 One-command system startup
- 🔍 Comprehensive dependency verification
- 📊 Real-time health monitoring
- 🛡️ Enhanced error handling and recovery
- 📝 Structured logging system

### v1.0.0 - PAI Launch  
- Complete AI-powered entity extraction
- Natural language database queries
- Real-time WebSocket communication
- GPT-powered WhatsApp responses

## 🤝 Contributing

1. Read the main [README.md](../README.md) for project overview
2. Follow the [Quick Start Guide](../QUICK_START.md) for setup
3. Use the [Launch System](../LAUNCH_README.md) for development
4. Check [WhatsApp Connection Guide](WHATSAPP_CONNECTION_GUIDE.md) for integration

## 📞 Support

- **System Issues**: Use `npm run check-deps` and `npm run monitor`
- **Launch Problems**: Check `logs/launch_*.log` files
- **WhatsApp Issues**: Refer to [WhatsApp Connection Guide](WHATSAPP_CONNECTION_GUIDE.md)
- **API Issues**: Check backend health at http://localhost:3000/health

---

**PAI - Personal AI Documentation** | Last Updated: September 2025