# 🔧 Evolution API Access Guide

## 🚨 **Issues Found:**
1. Frontend requires API key authentication
2. Manager interface has authentication issues
3. Instance is in "close" state (needs reconnection)

## ✅ **Working Solutions:**

### **Option 1: Direct QR Code Access**
Skip the manager and go directly to the QR code:

**URL:** http://localhost:8080/instance/connect/ai-pbx-instance

This should show the QR code without authentication issues.

### **Option 2: API-Based Management**
Use curl commands instead of the web interface:

```bash
# Check instance status
curl -H "apikey: ai-pbx-evolution-key-2024" \
     "http://localhost:8080/instance/connectionState/ai-pbx-instance"

# Get QR code (returns base64 image)
curl -H "apikey: ai-pbx-evolution-key-2024" \
     "http://localhost:8080/instance/connect/ai-pbx-instance"

# Restart instance if needed
curl -X POST -H "apikey: ai-pbx-evolution-key-2024" \
     "http://localhost:8080/instance/restart/ai-pbx-instance"
```

### **Option 3: Fix Manager Authentication**
The manager interface needs the API key configured. Try accessing:

**URL:** http://localhost:8080/manager/instance?apikey=ai-pbx-evolution-key-2024

## 🔄 **Quick Fix Steps:**

1. **Go directly to QR code:** http://localhost:8080/instance/connect/ai-pbx-instance
2. **If no QR code shows, restart instance:**
   ```bash
   curl -X POST -H "apikey: ai-pbx-evolution-key-2024" \
        "http://localhost:8080/instance/restart/ai-pbx-instance"
   ```
3. **Wait 10 seconds and refresh the QR code page**
4. **Scan QR code with WhatsApp**

## 🎯 **Expected Results:**
- QR code appears on the page
- Scan with WhatsApp → Linked Devices → Link a Device
- Status changes to "open"
- Your AI PBX starts receiving messages

## 🐛 **If Still Having Issues:**
The Evolution API Docker image might have configuration problems. We can:
1. Try a different Evolution API image
2. Use manual Evolution API setup
3. Use alternative WhatsApp integration (whatsapp-web.js)