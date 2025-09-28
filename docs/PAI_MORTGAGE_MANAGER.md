# 🏠 PAI Mortgage System Manager

Comprehensive guide for managing the PAI Mortgage WhatsApp assistant system with the interactive management script.

## 📋 Overview

The PAI Mortgage Manager (`pai-mortgage-manager.sh`) is a single-command solution for:

- ✅ **System Status Checking** - Real-time health monitoring
- 🚀 **Interactive Startup** - Guided system initialization  
- 🔍 **End-to-End Testing** - Complete functionality verification
- 📊 **Health Dashboard** - Comprehensive system overview
- 🛠️ **Safe Operations** - Automated error handling and recovery

## 🚀 Quick Start

### Daily Operations

```bash
# Check if system is running and show health status
npm run pai:status

# Interactive management (recommended for first-time users)
npm run pai

# Start system without prompting
npm run pai:start

# Test complete message flow
npm run pai:test
```

### Basic Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run pai` | Interactive management | Daily check-ins, troubleshooting |
| `npm run pai:status` | Health dashboard only | Quick status verification |
| `npm run pai:start` | Force start system | Known system is down |
| `npm run pai:test` | End-to-end test | Verify functionality after changes |
| `npm run pai:stop` | Clean shutdown | Maintenance, debugging |
| `npm run pai:restart` | Safe restart | After configuration changes |

## 📊 Health Dashboard

### Understanding the Output

When you run `npm run pai:status`, you'll see:

```bash
🏥 PAI Mortgage System Health Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Docker Services:
✅ Evolution API: Running
✅ PostgreSQL: Active  
⚠️  Redis: Not responding (may not be required)

PAI Mortgage Instance:
✅ PAI Mortgage: Connected (+57 318 260 1111)

OpenAI Configuration:
✅ OpenAI API: Key configured correctly

Backend Service:
✅ Backend Service: Running on port 3000

Message Routing:
✅ Message Routing: PAI Mortgage handler active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 System Fully Operational! Ready for WhatsApp messages.
```

### Status Indicators

| Symbol | Meaning | Action Required |
|--------|---------|----------------|
| ✅ | Component working correctly | None |
| ⚠️ | Warning (may be normal) | Monitor, usually okay |
| ❌ | Component failed | Investigate and fix |

### Common Warnings

**⚠️ Redis: Not responding (may not be required)**
- Normal for basic PAI Mortgage operations
- Redis is optional for core functionality
- Only required for advanced caching features

## 🔄 Interactive Workflows

### Scenario 1: System is Running

```bash
$ npm run pai
PAI Mortgage System Manager
✅ PAI Mortgage system is running

🏥 PAI Mortgage System Health Dashboard
[Health status displayed...]
🎉 System Fully Operational!

Would you like to run an end-to-end test? (y/N)
```

**Options:**
- Press `y` to run test verification
- Press `N` or Enter to exit

### Scenario 2: System is Stopped

```bash
$ npm run pai
PAI Mortgage System Manager
❌ PAI Mortgage system is not running

The PAI Mortgage system is not currently running.
Would you like to start it now? (y/N)
```

**Options:**
- Press `y` to start with full health checks
- Press `N` to exit (use `npm run pai:start` later)

## 🧪 End-to-End Testing

### What the Test Does

The end-to-end test (`npm run pai:test`) verifies complete system functionality:

1. **Sends Realistic Message**: "I'm interested in getting a mortgage for a $300,000 house. What rates do you offer?"
2. **Verifies Routing**: Confirms message reaches PAI Mortgage handler
3. **Checks Response**: Ensures system processes the inquiry correctly

### Test Output

```bash
━━━ End-to-End System Test ━━━
[INFO] Testing complete message flow...
✅ End-to-End Test: PASSED
[INFO] Message successfully routed to PAI Mortgage handler
[INFO] Test message: "I'm interested in getting a mortgage for a $300,000 house. What rates do you offer?"
```

### When to Run Tests

- ✅ After system startup
- ✅ After configuration changes
- ✅ Before important demonstrations
- ✅ During troubleshooting
- ✅ Daily verification (optional)

## 🛠️ System Management Scripts

### Complete Script Suite

| Script | Purpose | Usage |
|--------|---------|-------|
| `pai-mortgage-manager.sh` | Interactive management | `npm run pai` |
| `start-pai-mortgage-system.sh` | Complete startup | `npm run pai:start` |
| `stop-pai-mortgage-system.sh` | Clean shutdown | `npm run pai:stop` |
| `restart-pai-mortgage-system.sh` | Safe restart | `npm run pai:restart` |

### Direct Script Access

```bash
# Direct script execution (alternative to npm)
./scripts/pai-mortgage-manager.sh --status
./scripts/pai-mortgage-manager.sh --start
./scripts/pai-mortgage-manager.sh --test
./scripts/pai-mortgage-manager.sh --help
```

### Script Options

```bash
# Show help
./scripts/pai-mortgage-manager.sh --help

# Available options:
  (no args)    Interactive mode - check status and optionally start
  --status, -s Show system status and health dashboard
  --start, -t  Start system without prompting
  --test, -e   Run end-to-end test (system must be running)
  --help, -h   Show help message
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Backend Not Running

**Symptoms:**
```bash
❌ Backend Service: Not running
```

**Solution:**
```bash
npm run pai:start
# Will start backend with full health checks
```

#### 2. PAI Mortgage Not Connected

**Symptoms:**
```bash
❌ PAI Mortgage: Not connected (status: close)
```

**Solution:**
1. Check WhatsApp device connection
2. Visit QR code page: http://localhost:3000/qr-mortgage
3. Scan QR code with PAI Mortgage phone
4. Run `npm run pai:test` to verify

#### 3. OpenAI API Key Issues

**Symptoms:**
```bash
❌ OpenAI API: Invalid or missing key
```

**Solution:**
1. Check `.env` file has correct `OPENAI_API_KEY`
2. Ensure no environment variable override
3. Restart system: `npm run pai:restart`

#### 4. Evolution API Not Responding

**Symptoms:**
```bash
❌ Evolution API: Not responding
```

**Solution:**
```bash
# Restart Docker services
cd docker/evolution
./start.sh

# Then restart PAI system
npm run pai:restart
```

#### 5. Message Routing Failed

**Symptoms:**
```bash
❌ Message Routing: Failed or misconfigured
```

**Solution:**
1. Check webhook configuration in Evolution API
2. Verify instance name is `pai-mortgage-fresh`
3. Run test: `npm run pai:test`
4. If still failing, restart: `npm run pai:restart`

### Debug Mode

For detailed troubleshooting:

```bash
# Check startup logs
tail -f logs/startup_*.log

# Check backend logs
tail -f logs/app.log

# Manual health checks
curl http://localhost:3000/health
curl http://localhost:8080/health
```

## 📅 Best Practices

### Daily Operations

1. **Morning Check**
   ```bash
   npm run pai:status
   ```

2. **Start if Needed**
   ```bash
   npm run pai  # Interactive prompt
   ```

3. **Test Functionality**
   ```bash
   npm run pai:test  # Verify everything works
   ```

### Weekly Maintenance

1. **System Restart**
   ```bash
   npm run pai:restart
   ```

2. **Log Cleanup**
   ```bash
   # Clean old logs (if needed)
   find logs/ -name "*.log" -mtime +7 -delete
   ```

3. **Health Verification**
   ```bash
   npm run pai:test
   ```

### Before Important Events

1. **Complete System Check**
   ```bash
   npm run pai:status
   npm run pai:test
   ```

2. **Backup Configuration**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d)
   ```

3. **Document System State**
   ```bash
   npm run pai:status > system-status-$(date +%Y%m%d).log
   ```

## 🚨 Emergency Procedures

### System Completely Down

1. **Check Docker Services**
   ```bash
   docker ps
   cd docker/evolution && ./start.sh
   ```

2. **Restart Everything**
   ```bash
   npm run pai:restart
   ```

3. **Verify Recovery**
   ```bash
   npm run pai:test
   ```

### WhatsApp Connection Lost

1. **Check Connection Status**
   ```bash
   npm run pai:status
   ```

2. **Reconnect Device**
   - Visit: http://localhost:3000/qr-mortgage
   - Scan QR code with PAI Mortgage phone

3. **Test Recovery**
   ```bash
   npm run pai:test
   ```

### OpenAI API Issues

1. **Check API Key**
   ```bash
   grep OPENAI_API_KEY .env
   ```

2. **Test API Access**
   ```bash
   # Verify key works
   curl -H "Authorization: Bearer YOUR_KEY" https://api.openai.com/v1/models
   ```

3. **Restart System**
   ```bash
   npm run pai:restart
   ```

## 📖 Advanced Usage

### Custom Health Checks

```bash
# Check specific components
curl http://localhost:3000/api/system/status
curl http://localhost:8080/instance/connectionState/pai-mortgage-fresh
```

### Manual Testing

```bash
# Send custom test message
curl -X POST http://localhost:3000/webhook/messages-upsert \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "pai-mortgage-fresh", 
    "data": {
      "key": {"remoteJid": "test@s.whatsapp.net", "fromMe": false, "id": "TEST123"},
      "message": {"conversation": "Custom test message"},
      "pushName": "Test User",
      "messageType": "conversation"
    }
  }'
```

### Performance Monitoring

```bash
# Monitor resource usage
docker stats evolution-postgres evolution-redis evolution-api

# Check disk space
df -h

# Monitor memory
free -h
```

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview and features
- **[WhatsApp Connection Guide](WHATSAPP_CONNECTION_GUIDE.md)** - Complete setup guide
- **[CLAUDE.md](../CLAUDE.md)** - Claude AI assistant guide
- **[Legacy Documentation](legacy/)** - Historical reference

## 💡 Tips and Tricks

### Aliases for Quick Access

Add to your shell profile (`.bashrc`, `.zshrc`):

```bash
alias pai='npm run pai'
alias pai-status='npm run pai:status'
alias pai-start='npm run pai:start'
alias pai-test='npm run pai:test'
```

### Monitoring Shortcuts

```bash
# Watch health status
watch -n 5 'npm run pai:status'

# Monitor logs in real-time
tail -f logs/app.log | grep PAI

# Check system resources
watch -n 2 'docker stats --no-stream'
```

### Automation Ideas

```bash
# Cron job for daily health check (example)
0 9 * * * cd /path/to/ai_pbx && npm run pai:status >> daily-health.log
```

---

**Need Help?** Check the [troubleshooting section](#🔧-troubleshooting) or refer to [CLAUDE.md](../CLAUDE.md) for detailed technical information.