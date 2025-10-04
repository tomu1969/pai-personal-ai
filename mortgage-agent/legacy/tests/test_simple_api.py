#!/usr/bin/env python3
"""
Test script for the simplified mortgage assistant API.
Runs the new API and tests the conversation flow.
"""

import subprocess
import time
import requests
import signal
import sys
from threading import Thread

API_URL = "http://localhost:8002/chat"

def start_server():
    """Start the simplified API server."""
    try:
        return subprocess.Popen([
            sys.executable, "-m", "uvicorn", "src.simple_api:app",
            "--host", "0.0.0.0", "--port", "8002", "--reload"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as e:
        print(f"Failed to start server: {e}")
        return None

def test_conversation():
    """Test a full conversation flow."""
    print("🧪 Testing simplified mortgage assistant...")
    
    conversation_id = None
    
    test_messages = [
        "Hello",
        "I have 250k for down payment", 
        "Property costs 1 million",
        "Investment property",
        "Los Angeles",
        "California", 
        "Yes I have passport",
        "Yes I have US visa",
        "Yes I can provide income documentation",
        "Yes I have reserves"
    ]
    
    for i, message in enumerate(test_messages):
        try:
            payload = {"message": message}
            if conversation_id:
                payload["conversation_id"] = conversation_id
            
            response = requests.post(API_URL, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                conversation_id = data["conversation_id"]
                
                print(f"\n{i+1}. User: {message}")
                print(f"   Assistant: {data['response']}")
                
                if data.get("complete"):
                    print("\n✅ Conversation completed successfully!")
                    break
            else:
                print(f"❌ Error {response.status_code}: {response.text}")
                break
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            break

def main():
    """Main test function."""
    print("🚀 Starting Simplified Mortgage Assistant API Test")
    print("=" * 60)
    
    # Start server
    print("Starting server on port 8002...")
    server = start_server()
    
    if not server:
        print("❌ Failed to start server")
        return
    
    # Wait for server to start
    print("Waiting for server to be ready...")
    for attempt in range(10):
        try:
            response = requests.get("http://localhost:8002/health", timeout=2)
            if response.status_code == 200:
                print("✅ Server is ready!")
                break
        except:
            pass
        time.sleep(1)
    else:
        print("❌ Server failed to start")
        server.terminate()
        return
    
    try:
        # Run tests
        test_conversation()
        
    finally:
        # Cleanup
        print("\n🧹 Stopping server...")
        server.terminate()
        server.wait()
        print("✅ Server stopped")

if __name__ == "__main__":
    main()