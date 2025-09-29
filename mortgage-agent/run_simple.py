#!/usr/bin/env python3
"""
Explicit startup script for the simplified mortgage assistant.
This ensures Render can find and start the application correctly.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from src.simple_api import app
    print("✅ Successfully imported simplified API")
except ImportError as e:
    print(f"❌ Failed to import simplified API: {e}")
    # Fallback to old API if new one fails
    print("⚠️ Falling back to old slot API")
    from src.slot_api import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)