# Legacy Documentation

This folder contains historical documentation that has been superseded by newer implementations but is preserved for reference.

## Files

### LAUNCH_SYSTEM.md
- **Status**: Replaced by PAI Mortgage Manager
- **Replacement**: [PAI_MORTGAGE_MANAGER.md](../PAI_MORTGAGE_MANAGER.md)
- **Reason**: The unified launch system has been replaced by the more comprehensive PAI Mortgage management scripts that provide better health monitoring, interactive management, and end-to-end testing.

### PAI_MORTGAGE_FIX_RECOVERY.md
- **Status**: Historical issue resolution
- **Date**: September 2025
- **Reason**: Documents the resolution of QR code limit issues and Evolution API instance management problems. The fixes described have been implemented and integrated into the new management system.

## Current Documentation

For up-to-date system management, see:
- **[PAI_MORTGAGE_MANAGER.md](../PAI_MORTGAGE_MANAGER.md)** - Comprehensive system management guide
- **[WHATSAPP_CONNECTION_GUIDE.md](../WHATSAPP_CONNECTION_GUIDE.md)** - WhatsApp connection procedures
- **[Main README](../../README.md)** - Current project overview

## Migration Notes

If you were using the old launch system:

**Old Command:**
```bash
./launch-pai.sh
```

**New Command:**
```bash
npm run pai
```

The new system provides:
- Interactive status checking
- Comprehensive health dashboard
- End-to-end testing
- Better error handling
- Automated recovery procedures