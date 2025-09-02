# Legacy Files

This folder contains historical test files, utilities, and documentation that were moved during project organization (September 2025).

## Contents

### Test Files
- `test-*.js` - Various diagnostic and testing scripts
- `test-config.json`, `test-message.json` - Test data files

### Quick Test Scripts  
- `quick-whatsapp.js` - Quick WhatsApp connection test
- `whatsapp-simple.js` - Simple WhatsApp integration test
- `simple-whatsapp.py` - Python WhatsApp test script

### HTML Tools
- `evolution-qr.html` - Evolution API QR code display
- `whatsapp-qr.html` - WhatsApp QR code interface
- `logs-viewer.html` - Log viewing interface

### Docker Configurations
- `docker-compose.evolution*.yml` - Various Evolution API configurations
- `docker-compose.whatsapp*.yml` - WhatsApp-specific Docker setups

### Utilities
- `start-evolution.sh` - Evolution API startup script
- `run-migration.js` - Database migration runner

## Purpose

These files represent the development journey and various experiments conducted during the project's evolution. They have been preserved for historical reference and potential future use, but are not part of the current production system.

## Current System

The active system now uses:
- Main `docker-compose.yml` in project root
- Organized test suites in `/tests/` directory
- Modern React frontend in `/client/`
- Streamlined backend in `/src/`

For current development guidance, see the main [CLAUDE.md](../CLAUDE.md) file.