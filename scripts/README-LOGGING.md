# 🔍 AI PBX Logging Scripts

Comprehensive logging and monitoring tools for the AI PBX system.

## Quick Start

### Option 1: NPM Scripts (Recommended)
```bash
# Real-time log monitoring with colors
npm run logs

# CS Ticket System focused logs
npm run logs:cs

# Live system dashboard
npm run logs:live

# Filter logs (example: show only errors)
npm run logs:filter error
```

### Option 2: Direct Script Execution
```bash
# All system logs
./scripts/monitor-logs.sh

# CS-specific logs
./scripts/monitor-cs-logs.sh

# Live dashboard
./scripts/live-monitor.sh

# Filtered logs
./scripts/monitor-logs.sh "CS Ticket"
```

## 📊 Available Logging Tools

### 1. `monitor-logs.sh` - General System Logs
- **Purpose**: Monitor all application logs in real-time
- **Features**: 
  - Color-coded log levels (error, warn, info, debug)
  - System status checks
  - Filtering capabilities
  - Timestamps
- **Usage**: `./scripts/monitor-logs.sh [filter_term]`
- **Examples**:
  ```bash
  ./scripts/monitor-logs.sh                 # All logs
  ./scripts/monitor-logs.sh "error"         # Only errors
  ./scripts/monitor-logs.sh "CS Ticket"     # CS-related logs
  ./scripts/monitor-logs.sh "Evolution"     # Evolution API logs
  ```

### 2. `monitor-cs-logs.sh` - CS Ticket Monitor Logs
- **Purpose**: Focused monitoring for CS Ticket System
- **Features**:
  - CS-specific filtering and colorization
  - Groups Manager activity
  - JavaScript execution logs
  - API endpoint monitoring
- **Usage**: `./scripts/monitor-cs-logs.sh`
- **Filters**: Automatically filters for:
  - CS Ticket Monitor events
  - Groups Manager operations
  - JavaScript console logs
  - `/api/cs/` endpoint calls
  - Group rendering functions

### 3. `live-monitor.sh` - Interactive Dashboard
- **Purpose**: Live system health dashboard
- **Features**:
  - Real-time system status
  - Health checks for all services
  - Recent activity feed
  - Performance metrics
  - Auto-refresh every 2 seconds
- **Usage**: `./scripts/live-monitor.sh`
- **Dashboard includes**:
  - Server status (Node.js, Evolution API)
  - CS Ticket System status
  - Group counts (total/monitored)
  - Memory usage and uptime
  - Recent log entries

## 🎨 Color Coding

### Log Levels
- 🔴 **Red**: Error messages
- 🟡 **Yellow**: Warning messages  
- 🟢 **Green**: Info messages
- 🟣 **Purple**: Debug messages

### System Components
- 🎫 **Cyan**: CS Ticket Monitor
- 👥 **Yellow**: Groups Manager
- 🤖 **White**: PAI Assistant
- 📱 **Blue**: Evolution API
- 🌐 **Green**: HTTP requests
- 🔧 **Purple**: JavaScript/Frontend

## 🔧 Troubleshooting

### Common Issues

**No logs appearing:**
```bash
# Check if log file exists
ls -la logs/combined.log

# Check if server is running
ps aux | grep "node src/app.js"

# Start server if needed
npm start
```

**Permission denied:**
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

**Log file too large:**
```bash
# Archive old logs
mv logs/combined.log logs/combined.log.backup
touch logs/combined.log

# Or use log rotation
logrotate /path/to/logrotate.conf
```

## 📍 Log File Locations

- **Main logs**: `logs/combined.log`
- **Application logs**: `logs/app.log`
- **Error logs**: `logs/error.log`

## 🚀 Usage Scenarios

### Development
```bash
# Monitor all activity during development
npm run logs:live

# Focus on CS issues
npm run logs:cs
```

### Debugging CS Issues
```bash
# Watch CS system in real-time
npm run logs:cs

# Look for specific errors
npm run logs:filter "Groups Manager"
npm run logs:filter "renderGroups"
```

### Production Monitoring
```bash
# System health dashboard
npm run logs:live

# Error monitoring
npm run logs:filter "error"
```

### Testing JavaScript Changes
```bash
# Monitor frontend JavaScript execution
npm run logs:filter "console.log\\|JavaScript"

# Watch for DOM events
npm run logs:filter "DOMContentLoaded\\|renderGroups"
```

## ⚡ Advanced Features

### Filtering Examples
```bash
# Multiple terms (OR logic)
./scripts/monitor-logs.sh "error\\|warn"

# Specific component
./scripts/monitor-logs.sh "Groups Manager"

# HTTP requests only
./scripts/monitor-logs.sh "GET\\|POST"

# Time-based filtering (show last 100 lines)
tail -n 100 logs/combined.log | ./scripts/monitor-logs.sh
```

### Integration with VS Code
Add to VS Code tasks.json:
```json
{
  "label": "Monitor CS Logs",
  "type": "shell",
  "command": "./scripts/monitor-cs-logs.sh",
  "group": "build",
  "presentation": {
    "echo": true,
    "reveal": "always",
    "panel": "new"
  }
}
```

## 📝 Notes

- Scripts auto-detect if the server is running
- Press `Ctrl+C` to exit any monitoring script
- Scripts create log directories if they don't exist
- Compatible with macOS and Linux
- Requires `curl`, `tail`, `grep`, and basic Unix tools

## 🔮 Future Enhancements

- [ ] Web-based log viewer
- [ ] Log analytics dashboard
- [ ] Slack/email alerts
- [ ] Performance metrics
- [ ] Log archival automation