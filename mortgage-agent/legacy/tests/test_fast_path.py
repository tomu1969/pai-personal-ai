#!/usr/bin/env python3
"""
Quick test to verify the fast-path for investment property type.
"""
import requests
import json
import time

base_url = "http://localhost:8000"
conversation_id = f"fast-path-test-{int(time.time())}"

print(f"Testing fast-path for property purpose with conversation: {conversation_id}")
print("=" * 60)

# First, get to the property purpose question
setup_messages = [
    "Hello",
    "125k",
    "500k", 
    "ok yes"
]

print("Setting up conversation to reach property purpose question...")
for i, msg in enumerate(setup_messages, 1):
    print(f"{i}. {msg}")
    response = requests.post(f"{base_url}/chat", json={"message": msg, "conversation_id": conversation_id}, timeout=30)
    if response.status_code == 200:
        data = response.json()
        print(f"   Assistant: {data['response'][:60]}...")
    else:
        print(f"   ERROR: {response.status_code}")
        exit(1)
    time.sleep(0.1)

print("\nNow testing 'investment' response (should be fast-path):")
start = time.time()
response = requests.post(f"{base_url}/chat", json={"message": "investment", "conversation_id": conversation_id}, timeout=30)
elapsed = time.time() - start

print(f"Time: {elapsed:.2f}s")
if response.status_code == 200:
    data = response.json()
    print(f"Response: {data['response']}")
    if elapsed < 1.0:
        print("✅ FAST-PATH SUCCESS: Response under 1 second!")
    else:
        print("❌ SLOW: Response took more than 1 second")
else:
    print(f"ERROR: {response.status_code} - {response.text}")