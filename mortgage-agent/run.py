#!/usr/bin/env python3
"""
Simple startup script for the Mortgage Pre-Approval Chatbot.
"""
import os
import sys
import subprocess

def check_requirements():
    """Check if requirements are met."""
    print("🔍 Checking requirements...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        return False
    
    # Check if OpenAI API key is set
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  Warning: OPENAI_API_KEY not set")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        print("   The app will still run but LLM extraction may fail")
    
    print("✅ Requirements check complete")
    return True

def install_dependencies():
    """Install required packages."""
    print("📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        return False

def start_server():
    """Start the FastAPI server."""
    print("🚀 Starting Mortgage Pre-Approval Chatbot...")
    print("📱 Web Interface: http://localhost:8000")
    print("🔗 API Docs: http://localhost:8000/docs")
    print("📋 Health Check: http://localhost:8000/health")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "src.api:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")

def main():
    """Main startup function."""
    print("🏠 Mortgage Pre-Approval Chatbot MVP")
    print("=" * 40)
    
    if not check_requirements():
        return
    
    # Ask about dependencies
    install = input("Install/update dependencies? (y/N): ").lower().strip()
    if install in ['y', 'yes']:
        if not install_dependencies():
            return
    
    start_server()

if __name__ == "__main__":
    main()